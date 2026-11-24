/* Mystery Island - game rules for the illustrated adventure (no DOM, fully testable).
   The player stands at x (0..1 across the scene) in a named scene. */

const REACH = 0.13; // how close (in scene widths) you must stand to a hotspot to use it

class Game {
  constructor(data, characterKey = "castaway", name = "Player") {
    this.D = data;                                   // { CHARACTERS, SCENES, START_SCENE, START_X, WIDTHS_PER_ENERGY }
    this.character = data.CHARACTERS[characterKey] ? characterKey : "castaway";
    const c = data.CHARACTERS[this.character];
    this.name = name || "Player";
    this.maxEnergy = c.energy;
    this.energy = c.energy;
    this.speed = c.speed;                            // scene widths per second
    this.tire = c.tire || 1;
    this.scene = data.START_SCENE;
    this.x = data.START_X;
    this.facing = "right";
    this.moving = false;
    this.inventory = [];
    this.taken = {};
    this.bridgeRepaired = false;
    this.won = false;
    this.over = false;
    this.walked = 0;
    this.message = "";
    this.messageTtl = 0;
    this.events = [];
    this.target = null;                              // tap-to-walk destination (x), or null
  }

  get sceneData() { return this.D.SCENES[this.scene]; }
  say(t, ttl = 3.4) { this.message = t; this.messageTtl = ttl; }

  /* the furthest right the player may stand in this scene right now */
  maxX() {
    const s = this.sceneData;
    if (s.blockRight && !this.bridgeRepaired) return s.blockRight;
    return 1;
  }

  /* dir: -1, 0, +1 from keys. dt in seconds. Returns nothing; sets events. */
  update(dt, dir = 0) {
    if (this.messageTtl > 0) { this.messageTtl -= dt; if (this.messageTtl <= 0) this.message = ""; }
    if (this.over) { this.moving = false; return; }

    // keyboard cancels a tap-to-walk target
    if (dir !== 0) this.target = null;
    let move = dir;
    if (move === 0 && this.target !== null) {
      const d = this.target - this.x;
      if (Math.abs(d) < 0.008) { this.target = null; }
      else move = Math.sign(d);
    }

    this.moving = false;
    if (move === 0) return;

    this.facing = move > 0 ? "right" : "left";
    let nx = this.x + move * this.speed * dt;
    const limit = this.maxX();
    let blocked = false;
    if (nx > limit) { nx = limit; blocked = true; }
    const moved = Math.abs(nx - this.x);
    this.x = nx;
    if (blocked && dir !== 0 && moved < 1e-6) this.hintBlocked();
    if (moved > 1e-6) { this.moving = true; this.drain(moved); }
    if (blocked && this.target !== null) this.target = null;

    this.checkExits();
  }

  hintBlocked() {
    if (this.scene === "bridge" && !this.bridgeRepaired) this.say("The planks are gone. You need to repair the bridge.");
  }

  drain(widths) {
    this.walked += widths * this.tire;
    while (this.walked >= this.D.WIDTHS_PER_ENERGY && !this.over) {
      this.walked -= this.D.WIDTHS_PER_ENERGY;
      this.spend(1, "You are getting tired.");
    }
  }

  spend(n, msg) {
    this.energy = Math.max(0, this.energy - n);
    this.events.push("tired");
    if (this.energy <= 0) {
      this.over = true; this.moving = false; this.target = null;
      this.say("Your energy is gone. You collapse on the island.", 6);
      this.events.push("lose");
    } else if (msg) {
      this.say(`${msg} Energy: ${this.energy}`);
    }
  }

  /* walking off an edge moves you to the neighbouring scene */
  checkExits() {
    const s = this.sceneData;
    for (const ex of s.exits) {
      const off = ex.side === "left" ? this.x <= 0.0 : this.x >= 1.0;
      if (!off) continue;
      if (ex.needs && !this[ex.needs]) continue;
      this.scene = ex.to; this.x = ex.enter; this.target = null;
      this.events.push("scene");
      this.say(this.sceneData.text, 4.2);
      return true;
    }
    // clamp so you cannot walk into the void at an edge with no exit
    if (this.x < 0) this.x = 0;
    if (this.x > 1) this.x = 1;
    return false;
  }

  hotspotsHere() {
    return this.sceneData.hotspots.filter((h) => !(h.kind === "pickup" && this.taken[h.id]) &&
      !(h.kind === "bridge" && this.bridgeRepaired) && !(h.kind === "beacon" && this.won));
  }

  /* hotspot the player is standing close enough to use, if any */
  nearby() {
    for (const h of this.hotspotsHere()) {
      if (Math.abs(this.x - h.x) <= Math.max(REACH, h.r * 0.9)) return h;
    }
    return null;
  }

  prompt() {
    const h = this.nearby();
    if (!h) return "";
    if (h.kind === "bridge") return this.inventory.includes("rope") ? "Repair the bridge with the rope" : "The bridge is broken. You need a rope";
    if (h.kind === "beacon") return this.inventory.includes("lantern") ? "Light the beacon" : "The beacon is dark. You need a lantern";
    return h.label;
  }

  /* tap on the scene: if you tap a hotspot, walk to it; otherwise walk to that spot */
  tap(x, y) {
    if (this.over) return;
    const hit = this.hotspotsHere().find((h) => Math.hypot(x - h.x, (y - h.y) * 0.8) <= h.r);
    if (hit) {
      if (this.nearby() === hit) { this.interact(); return; }
      this.target = Math.min(Math.max(hit.x, 0), this.maxX());
      this.pendingUse = hit.id;
      return;
    }
    this.pendingUse = null;
    this.target = Math.min(Math.max(x, 0), this.maxX());
  }

  /* called each frame so a tap on an object walks there and then uses it */
  autoUse() {
    if (this.pendingUse && this.target === null) {
      const id = this.pendingUse; this.pendingUse = null;
      const h = this.nearby();
      if (h && h.id === id) this.interact();
    }
  }

  interact() {
    if (this.over) return false;
    const h = this.nearby();
    if (!h) return false;

    if (h.kind === "pickup") {
      this.taken[h.id] = true; this.inventory.push(h.item); this.events.push("pickup");
      const c = this.D.CHARACTERS[this.character];
      if (this.character === "scavenger" && this.energy < this.maxEnergy) {
        this.energy += 1; this.say(`You found the ${h.item}! Scavenger's luck: +1 energy.`);
      } else this.say(`You found the ${h.item}!`);
      return true;
    }
    if (h.kind === "bridge") {
      if (!this.inventory.includes("rope")) { this.say("The bridge is broken. You need a rope."); this.events.push("deny"); return false; }
      this.bridgeRepaired = true; this.events.push("build");
      this.say("You lash the rope across the gap. The bridge holds.");
      if (this.character === "sailor") this.spend(1, "The old planks wear you out.");
      return true;
    }
    if (h.kind === "beacon") {
      if (!this.inventory.includes("lantern")) { this.say("The beacon is dark. You need a lantern."); this.events.push("deny"); return false; }
      this.won = true; this.over = true; this.events.push("win");
      this.say("You light the beacon. The rescue boat arrives. YOU WIN!", 8);
      return true;
    }
    return false;
  }
}

if (typeof module !== "undefined") module.exports = { Game, REACH };
