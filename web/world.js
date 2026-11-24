/* Mystery Island - animated side-scroller: physics and rules (no DOM, fully testable).
   The world is WORLD_W units wide and WORLD_H tall (1 unit = 1 source pixel of the painting).
   y grows downward. The player stands on platforms; there is a gap in the bridge to jump or repair. */

const WORLD_W = 4096, WORLD_H = 1024;
const GROUND_Y = 880;                 // top of the walkable ground
const GRAVITY = 2600;                 // units/s^2
const COYOTE = 0.09;                  // seconds you can still jump after leaving an edge
const JUMP_BUFFER = 0.11;             // seconds a jump press is remembered before landing
const PLAYER_W = 70, PLAYER_H = 190;  // collision box (feet at bottom centre)

const CHARACTERS = {
  castaway:  { title: "The Castaway",   energy: 5, run: 430, jump: 980, drain: 1.0, blurb: "Rugged and steady. No tricks, no weaknesses.", perk: "Balanced: 5 energy." },
  explorer:  { title: "The Explorer",   energy: 5, run: 480, jump: 1040, drain: 0.75, blurb: "Sharp-eyed and quick on her feet.",           perk: "Quick: runs faster, jumps higher, tires 25% slower." },
  sailor:    { title: "The Old Sailor", energy: 6, run: 380, jump: 900, drain: 1.0, blurb: "Tough and weathered, but slow on old planks.", perk: "Hardy: 6 energy. Slow: repairing the bridge costs 1." },
  scavenger: { title: "The Scavenger",  energy: 4, run: 450, jump: 1000, drain: 1.0, blurb: "Small, clever, always finding something.",     perk: "Resourceful: pickups restore 1 energy. Only 4 energy." },
};

/* Solid platforms: {x, w, y} = top surface. Everything else at ground level is a pit unless listed. */
const PLATFORMS = [
  { id: "beach",   x: 0,    w: 1500, y: GROUND_Y },                 // beach and jungle floor
  { id: "cave",    x: 1500, w: 1000, y: GROUND_Y },                 // cave floor
  { id: "ledge1",  x: 2500, w: 330,  y: GROUND_Y },                 // west edge of the chasm
  // the chasm: x 2830..3290 (460 wide) has NO floor until the bridge is repaired
  { id: "ledge2",  x: 3290, w: 806,  y: GROUND_Y },                 // east side up to the lighthouse
  // a few rocks and crates to jump onto, giving real platforming
  { id: "rock1",   x: 560,  w: 190,  y: GROUND_Y - 110 },
  { id: "crate1",  x: 1800, w: 190,  y: GROUND_Y - 110 },
  { id: "crate2",  x: 2040, w: 200,  y: GROUND_Y - 220 },
];
const BRIDGE = { id: "bridge", x: 2830, w: 460, y: GROUND_Y, needsRepair: true };
const UNITS_PER_ENERGY = 1500;       // ground run per energy point; the best route is ~3730 units so it costs about half the bar
const KILL_Y = WORLD_H + 200;          // fall below this and you lose a life of energy and respawn

/* Things to pick up or use. Positions are world units; r is the reach radius. */
const OBJECTS = [
  { id: "rope",    kind: "pickup", item: "rope",    x: 1180, y: GROUND_Y - 120, r: 130, label: "Take the rope" },
  { id: "lantern", kind: "pickup", item: "lantern", x: 2140, y: GROUND_Y - 300, r: 130, label: "Take the lantern" },
  { id: "bridge",  kind: "bridge",                  x: 2780, y: GROUND_Y - 60,  r: 150, label: "Repair the bridge" },
  { id: "beacon",  kind: "beacon",                  x: 3960, y: GROUND_Y - 260, r: 170, label: "Light the beacon" },
];
const START = { x: 250, y: GROUND_Y };
const CHECKPOINTS = [ { x: 250 }, { x: 1560 }, { x: 2540 }, { x: 3340 } ];

class Game {
  constructor(characterKey = "castaway", name = "Player") {
    this.character = CHARACTERS[characterKey] ? characterKey : "castaway";
    const c = CHARACTERS[this.character];
    this.name = name || "Player";
    this.maxEnergy = c.energy; this.energy = c.energy;
    this.x = START.x; this.y = START.y;            // feet position
    this.vx = 0; this.vy = 0;
    this.facing = 1; this.onGround = true;
    this.coyote = 0; this.jumpBuf = 0;
    this.runTime = 0;                                // drives the stride animation
    this.squash = 0;                                 // landing squash 0..1
    this.dust = [];                                  // dust puffs {x,y,t}
    this.inventory = []; this.taken = {};
    this.bridgeRepaired = false;
    this.won = false; this.over = false;
    this.distance = 0; this.checkpoint = 0;
    this.message = ""; this.messageTtl = 0; this.events = [];
    this.fallen = 0;
  }
  get c() { return CHARACTERS[this.character]; }
  say(t, ttl = 3.4) { this.message = t; this.messageTtl = ttl; }

  platforms() { return this.bridgeRepaired ? PLATFORMS.concat([BRIDGE]) : PLATFORMS; }

  /* highest platform top at (x) that is at or below the feet's previous position */
  supportAt(x, prevY) {
    let best = null;
    for (const p of this.platforms()) {
      if (x >= p.x - 8 && x <= p.x + p.w + 8 && p.y >= prevY - 6) { if (best === null || p.y < best) best = p.y; }
    }
    return best;
  }

  /* input: {dir:-1|0|1, jump:bool(pressed this frame), jumpHeld:bool} */
  update(dt, input = {}) {
    if (this.messageTtl > 0) { this.messageTtl -= dt; if (this.messageTtl <= 0) this.message = ""; }
    this.dust.forEach((d) => (d.t += dt)); this.dust = this.dust.filter((d) => d.t < 0.5);
    this.squash = Math.max(0, this.squash - dt * 5);
    if (this.over) { this.vx = 0; return; }

    const c = this.c, dir = input.dir || 0;
    // horizontal: accelerate toward the target speed, with a little momentum
    const target = dir * c.run, accel = this.onGround ? 3600 : 2200;
    if (this.vx < target) this.vx = Math.min(target, this.vx + accel * dt);
    else if (this.vx > target) this.vx = Math.max(target, this.vx - (dir === 0 ? 4200 : accel) * dt);
    if (dir !== 0) this.facing = dir;

    // jump with coyote time + buffering
    if (input.jump) this.jumpBuf = JUMP_BUFFER; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = this.onGround ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = -c.jump; this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.events.push("jump");
      this.dust.push({ x: this.x, y: this.y, t: 0 });
    }
    // variable jump height: release early to cut the jump short
    if (!input.jumpHeld && this.vy < -420) this.vy = -420;

    // integrate
    const prevY = this.y, prevX = this.x;
    this.vy += GRAVITY * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.x = Math.max(PLAYER_W / 2, Math.min(WORLD_W - PLAYER_W / 2, this.x));

    // land on platforms (only when falling)
    const wasGround = this.onGround;
    this.onGround = false;
    if (this.vy >= 0) {
      const top = this.supportAt(this.x, prevY);
      if (top !== null && this.y >= top && prevY <= top + 10) {
        if (!wasGround && this.vy > 500) { this.squash = Math.min(1, this.vy / 1400); this.events.push("land"); this.dust.push({ x: this.x, y: top, t: 0 }); }
        this.y = top; this.vy = 0; this.onGround = true;
      }
    }

    // run animation clock and footstep dust
    if (this.onGround && Math.abs(this.vx) > 40) {
      const before = Math.floor(this.runTime * 2);
      this.runTime += dt * (Math.abs(this.vx) / 60);
      if (Math.floor(this.runTime * 2) !== before) this.events.push("step");
      this.distance += Math.abs(this.x - prevX);
      // walking is tiring: one energy per this many units run on the ground
      const per = UNITS_PER_ENERGY / c.drain;
      while (this.distance >= per && !this.over) { this.distance -= per; this.spend(1, "You are getting tired."); }
    } else if (this.onGround) this.runTime = 0;

    // fell into the chasm
    if (this.y > KILL_Y) this.fall();

    // checkpoints
    for (let i = this.checkpoint + 1; i < CHECKPOINTS.length; i++) if (this.x >= CHECKPOINTS[i].x) this.checkpoint = i;
  }

  fall() {
    this.fallen++; this.events.push("fall");
    this.spend(1, "You fall into the dark water!");
    if (this.over) return;
    this.x = CHECKPOINTS[this.checkpoint].x; this.y = GROUND_Y - 400; this.vx = 0; this.vy = 0;
  }

  spend(n, msg) {
    this.energy = Math.max(0, this.energy - n); this.events.push("tired");
    if (this.energy <= 0) { this.over = true; this.vx = 0; this.say("Your energy is gone. You collapse on the island.", 6); this.events.push("lose"); }
    else if (msg) this.say(`${msg} Energy: ${this.energy}`);
  }

  objectsHere() {
    return OBJECTS.filter((o) => !(o.kind === "pickup" && this.taken[o.id]) &&
      !(o.kind === "bridge" && this.bridgeRepaired) && !(o.kind === "beacon" && this.won));
  }
  nearby() {
    for (const o of this.objectsHere()) {
      if (Math.hypot(this.x - o.x, (this.y - PLAYER_H / 2) - o.y) <= o.r + PLAYER_W) return o;
    }
    return null;
  }
  prompt() {
    const o = this.nearby(); if (!o) return "";
    if (o.kind === "bridge") return this.inventory.includes("rope") ? "Repair the bridge with the rope" : "The bridge is broken. You need a rope";
    if (o.kind === "beacon") return this.inventory.includes("lantern") ? "Light the beacon" : "The beacon is dark. You need a lantern";
    return o.label;
  }
  interact() {
    if (this.over) return false;
    const o = this.nearby(); if (!o) return false;
    if (o.kind === "pickup") {
      this.taken[o.id] = true; this.inventory.push(o.item); this.events.push("pickup");
      if (this.character === "scavenger" && this.energy < this.maxEnergy) { this.energy++; this.say(`You found the ${o.item}! Scavenger's luck: +1 energy.`); }
      else this.say(`You found the ${o.item}!`);
      return true;
    }
    if (o.kind === "bridge") {
      if (!this.inventory.includes("rope")) { this.say("The bridge is broken. You need a rope."); this.events.push("deny"); return false; }
      this.bridgeRepaired = true; this.events.push("build");
      this.say("You lash the rope across the gap. The bridge holds.");
      if (this.character === "sailor") this.spend(1, "The old planks wear you out.");
      return true;
    }
    if (o.kind === "beacon") {
      if (!this.inventory.includes("lantern")) { this.say("The beacon is dark. You need a lantern."); this.events.push("deny"); return false; }
      this.won = true; this.over = true; this.events.push("win");
      this.say("You light the beacon. The rescue boat arrives. YOU WIN!", 8);
      return true;
    }
    return false;
  }
}

if (typeof module !== "undefined") module.exports = { Game, CHARACTERS, PLATFORMS, BRIDGE, OBJECTS, START, CHECKPOINTS, WORLD_W, WORLD_H, GROUND_Y, GRAVITY, PLAYER_W, PLAYER_H, KILL_Y };
