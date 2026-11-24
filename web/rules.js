/* MYSTERY ISLAND: Stormbound. Game rules, no DOM and no three.js, so they can be unit tested in Node.
   Non-combat: hazards are falls, cold and stamina only. */
(function (root) {
  const SURVIVORS = {
    scout:  { name: "ISLAND SCOUT",   tag: "01 / SCOUT",   mono: "IS", perk: "Light kit: +20% sprint speed, higher jump.",            sprint: 1.2,  jump: 1.25, scan: 1.0, drain: 1.0,  endure: 1.0,  crouch: 1.0,  light: 1.0 },
    radio:  { name: "RADIO KEEPER",   tag: "02 / RADIO",   mono: "RK", perk: "Field pack: wider interact radius, slower stamina drain.", sprint: 1.0,  jump: 1.0,  scan: 1.6, drain: 0.7,  endure: 1.0,  crouch: 1.0,  light: 1.0 },
    sailor: { name: "OLD SAILOR",     tag: "03 / SAILOR",  mono: "OS", perk: "Heavy kit: tougher against storm winds and falls.",      sprint: 0.95, jump: 0.95, scan: 1.0, drain: 1.0,  endure: 1.5,  crouch: 1.0,  light: 1.0 },
    night:  { name: "NIGHT WALKER",   tag: "04 / NIGHT",   mono: "NW", perk: "Dark kit: faster crouch-walk, brighter flashlight.",      sprint: 1.0,  jump: 1.0,  scan: 1.0, drain: 1.0,  endure: 1.0,  crouch: 1.5,  light: 1.7 }
  };
  const MAX_HEALTH = 5, MAX_STAMINA = 100;
  const FALL_SAFE = 5.5, FALL_PER_HEART = 4;          // metres: safe drop, then one heart per extra 4 m
  const COLD_RATE = 0.05;                              // warmth lost per second when exposed (0..1 scale, 1 = warm)
  const WARM_RATE = 0.12;                              // warmth regained per second in shelter / near lit generator
  const GUST_PERIOD = 22, GUST_LEN = 7;                // storm gust every 22 s, lasting 7 s

  /* sequential objectives */
  const OBJECTIVES = [
    { id: "rope",   title: "Find the rope in the jungle",              hint: "Search the overgrown ruins in the jungle." },
    { id: "cliff",  title: "Scale the cliffside to the keeper's cabin", hint: "Use the rope at the cliff anchor, then search the cabin." },
    { id: "power",  title: "Restore power at the generator shed",       hint: "Find 2 fuel canisters, then refuel the generator." },
    { id: "beacon", title: "Bring the lighthouse beacon back to life",  hint: "The lighthouse stands on the cliff top. Use the rope again to climb back up, unlock the door, and light the lamp." }
  ];

  class Game {
    constructor(key) {
      const s = SURVIVORS[key] || SURVIVORS.scout; this.key = SURVIVORS[key] ? key : "scout"; this.s = s;
      this.health = MAX_HEALTH; this.stamina = MAX_STAMINA; this.warmth = 1;
      this.inv = { rope: false, key: false, journal: false, fuel: 0 };
      this.flags = { ropeAnchored: false, cabinSearched: false, generatorOn: false, lighthouseOpen: false, beaconOn: false, shelterUsed: false };
      this.fuelFound = { beach: false, cabin: false };
      this.over = false; this.won = false; this.msg = ""; this.time = 0; this.exhausted = 0; this.log = [];
    }
    get objectiveIndex() {
      if (this.flags.beaconOn) return 4;
      if (this.flags.generatorOn) return 3;
      if (this.flags.ropeAnchored) return 2;
      if (this.inv.rope) return 1;
      return 0;
    }
    get objective() { return OBJECTIVES[Math.min(this.objectiveIndex, 3)]; }
    say(m) { this.msg = m; this.log.push(m); return m; }

    /* stamina: sprinting and climbing cost it, resting restores it. Returns true if the action was allowed. */
    useStamina(amount) {
      const cost = amount * this.s.drain;
      if (this.stamina < 1) { this.exhausted = 1.2; return false; }
      this.stamina = Math.max(0, this.stamina - cost); return true;
    }
    regenStamina(dt, moving) { if (this.exhausted > 0) this.exhausted -= dt; this.stamina = Math.min(MAX_STAMINA, this.stamina + (moving ? 8 : 20) * dt); }

    /* falling: a drop (in metres) above the safe height costs hearts. The Old Sailor's endurance shrinks the damage. */
    land(dropMetres, inWater) {
      if (inWater || dropMetres <= FALL_SAFE) return 0;
      const hearts = Math.max(1, Math.floor((dropMetres - FALL_SAFE) / FALL_PER_HEART * (1 / this.s.endure)) + 1);
      this.hurt(hearts, "You fall hard."); return hearts;
    }
    hurt(h, why) { if (this.over) return; this.health = Math.max(0, this.health - h); this.say(why || "Ouch."); if (this.health <= 0) { this.over = true; this.won = false; this.say("The island wins this time. Your strength gives out."); } }

    /* checkpoint: a small plain-JSON snapshot of progress. Restoring never revives a finished or dead run. */
    snapshot() { return { v: 1, key: this.key, health: this.health, stamina: this.stamina, warmth: this.warmth, inv: { ...this.inv }, flags: { ...this.flags }, fuelFound: { ...this.fuelFound }, time: this.time }; }
    static restore(d) {
      if (!d || d.v !== 1 || !SURVIVORS[d.key]) return null;
      const g = new Game(d.key), num = (v, lo, hi, dflt) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);
      g.health = Math.max(1, num(d.health, 1, MAX_HEALTH, MAX_HEALTH)); g.stamina = num(d.stamina, 0, MAX_STAMINA, MAX_STAMINA); g.warmth = num(d.warmth, 0, 1, 1); g.time = num(d.time, 0, 1e7, 0);
      for (const k of Object.keys(g.inv)) if (d.inv && k in d.inv) g.inv[k] = k === "fuel" ? Math.min(2, Math.max(0, d.inv[k] | 0)) : !!d.inv[k];
      for (const k of Object.keys(g.flags)) if (d.flags && k in d.flags) g.flags[k] = !!d.flags[k];
      for (const k of Object.keys(g.fuelFound)) if (d.fuelFound && k in d.fuelFound) g.fuelFound[k] = !!d.fuelFound[k];
      if (g.flags.beaconOn) return null;                    // a completed run is not resumable: it becomes a replay prompt instead
      return g;
    }

    /* is a storm gust blowing at time t (seconds)? */
    static gust(t) { const p = t % GUST_PERIOD; return p > GUST_PERIOD - GUST_LEN ? Math.sin((p - (GUST_PERIOD - GUST_LEN)) / GUST_LEN * Math.PI) : 0; }
    /* cold: exposed to a gust without shelter drains warmth; at zero, hearts start to go. Sheltered or beside the running generator warms you. */
    tickWeather(dt, exposed, nearWarmth) {
      if (this.over) return; this.time += dt;
      const g = Game.gust(this.time);
      if (exposed && g > 0.2) this.warmth = Math.max(0, this.warmth - COLD_RATE * (0.5 + g) / this.s.endure * dt);
      else if (!exposed || nearWarmth) this.warmth = Math.min(1, this.warmth + WARM_RATE * dt);          // shelter or the running generator: full recovery
      else this.warmth = Math.min(1, this.warmth + WARM_RATE * 0.35 * dt);                              // calm air between gusts: slow recovery on your feet
      if (this.warmth <= 0) { this._coldT = (this._coldT || 0) + dt; if (this._coldT >= 9) { this._coldT = 0; this.hurt(1, "The cold bites. Find shelter."); } } else this._coldT = 0;
    }

    /* ---- interactions: each returns a message, or null if nothing happened ---- */
    pickRope() { if (this.inv.rope) return null; this.inv.rope = true; return this.say("You found the Climbing Rope in the ruins."); }
    useAnchor() {
      if (!this.inv.rope) return this.say("A steel anchor ring. You need a rope.");
      if (this.flags.ropeAnchored) return this.say("The rope is already secured.");
      this.flags.ropeAnchored = true; return this.say("You secure the rope. The cliff is climbable now.");
    }
    searchCabin() {
      if (!this.flags.ropeAnchored) return this.say("The cabin is up on the cliff. You need a way up.");
      if (this.flags.cabinSearched) return this.say("You already searched the cabin.");
      this.flags.cabinSearched = true; this.inv.key = true; this.inv.journal = true;
      return this.say("You find a Brass Key and the Keeper's Journal.");
    }
    pickFuel(where) {
      if (this.fuelFound[where]) return null; this.fuelFound[where] = true; this.inv.fuel++;
      return this.say(this.inv.fuel >= 2 ? "Second fuel canister. That should be enough." : "You pick up a Fuel Canister.");
    }
    useGenerator() {
      if (this.flags.generatorOn) return this.say("The generator hums steadily.");
      if (!this.flags.cabinSearched) return this.say("A dead generator. You might find clues in the cabin.");
      if (this.inv.fuel < 2) return this.say(`The tank is empty. Fuel canisters: ${this.inv.fuel} of 2.`);
      this.inv.fuel -= 2; this.flags.generatorOn = true; return this.say("The generator coughs, then roars to life. Power flows to the lighthouse.");
    }
    useLighthouseDoor() {
      if (this.flags.lighthouseOpen) return this.say("The door is open.");
      if (!this.inv.key) return this.say("The lighthouse door is locked. The keeper had a brass key.");
      this.flags.lighthouseOpen = true; return this.say("The Brass Key turns. The lighthouse door swings open.");
    }
    useBeacon() {
      if (this.flags.beaconOn || this.over) return null;
      if (!this.flags.lighthouseOpen) return this.say("You can't reach the lamp from here.");
      if (!this.flags.generatorOn) return this.say("The lamp is dark. The generator is not running.");
      this.flags.beaconOn = true; this.over = true; this.won = true;
      return this.say("The beam sweeps the sea. The storm breaks, and the mainland answers.");
    }
  }
  const api = { Game, SURVIVORS, OBJECTIVES, MAX_HEALTH, MAX_STAMINA, FALL_SAFE, GUST_PERIOD, GUST_LEN };
  if (typeof module !== "undefined") module.exports = api; else root.SB = api;
})(typeof window !== "undefined" ? window : globalThis);
