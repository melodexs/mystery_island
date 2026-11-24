/* Mystery Island - animated side-scroller: physics and rules (no DOM, fully testable).
   The world is WORLD_W units wide and WORLD_H tall (1 unit = 1 source pixel of the painting).
   y grows downward. The player stands on platforms; there is a gap in the bridge to jump or repair. */

const WORLD_W = 4096, WORLD_H = 1024;
const GROUND_Y = 880;                 // top of the walkable ground
const GRAVITY = 2600;                 // units/s^2
const COYOTE = 0.09;                  // seconds you can still jump after leaving an edge
const JUMP_BUFFER = 0.11;             // seconds a jump press is remembered before landing
const PLAYER_W = 70, PLAYER_H = 190;  // collision box (feet at bottom centre)
const CROUCH_H = 120;                 // box height while crouching or sliding
const SPRINT_MUL = 1.3;               // sprint speed multiplier
const CROUCH_MUL = 0.45;              // crouch-walk speed multiplier
const SLIDE_SPEED = 1.5;              // slide starts at this multiple of run speed
const SLIDE_TIME = 0.65;              // seconds a slide lasts
const SLIDE_COOLDOWN = 0.5;
const WALL_SLIDE_MAX = 260;           // max fall speed while clinging to a wall
const WALL_JUMP_X = 520, WALL_JUMP_Y = 900;
const DOUBLE_JUMP_MUL = 0.82;         // the air jump is a little weaker than the first
const ROLL_TIME = 0.55, ROLL_SPEED = 1.15;   // a roll after a hard landing keeps momentum
const HANG_MIN = 70, HANG_MAX = 200;  // ledge top this far above the feet can be grabbed
const CLIMB_TIME = 0.5;               // seconds to pull up from a hang
const VAULT_TIME = 0.32;              // seconds a vault over a low block takes
const SPRINT_DRAIN = 1.25;            // sprinting tires you a bit faster than jogging

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
const UNITS_PER_ENERGY = 1200;       // ground run per energy point; the best route is ~3730 units
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
    this.sprinting = false; this.crouching = false; this.sliding = 0; this.slideCd = 0; this.slideDir = 1;
    this.wall = 0;                                   // -1 left wall, 1 right wall, 0 none
    this.wallJumpLock = 0;                           // brief lock on steering after a wall-jump
    this.airJumpUsed = false;                        // double jump spent
    this.rolling = 0; this.rollDir = 1;              // roll timer
    this.hang = null;                                // {p, side, t}: grabbing a ledge
    this.climbing = 0; this.climbTo = null;          // pull-up timer and destination
    this.vaulting = 0; this.vaultFrom = null; this.vaultTo = null;
    this.airTime = 0; this.speedFx = 0;              // for camera effects
    this.squash = 0; this.hardLand = 0;              // landing squash 0..1
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

  /* a wall is the side of a raised platform; returns -1 (wall on the left), 1 (right), or 0 */
  wallAt() {
    const top = this.y - this.boxH(), bottom = this.y;
    for (const p of this.platforms()) {
      if (p.y >= GROUND_Y - 5) continue;                       // only raised blocks are walls
      if (bottom <= p.y + 8) continue;                         // standing above it
      if (bottom - p.y <= 70) continue;                        // low ledge: you mantle it, you do not cling
      if (Math.abs((this.x + PLAYER_W / 2) - p.x) < 10 && this.x < p.x) return 1;          // touching its left face
      if (Math.abs((this.x - PLAYER_W / 2) - (p.x + p.w)) < 10 && this.x > p.x + p.w) return -1; // touching its right face
    }
    return 0;
  }
  boxH() { return (this.crouching || this.sliding > 0) ? CROUCH_H : PLAYER_H; }

  /* input: {dir:-1|0|1, jump:bool(pressed this frame), jumpHeld:bool, sprint:bool, crouch:bool(held), slide:bool(pressed)} */
  update(dt, input = {}) {
    if (this.messageTtl > 0) { this.messageTtl -= dt; if (this.messageTtl <= 0) this.message = ""; }
    this.dust.forEach((d) => (d.t += dt)); this.dust = this.dust.filter((d) => d.t < 0.5);
    this.squash = Math.max(0, this.squash - dt * 5);
    if (this.over) { this.vx = 0; return; }
    const cin = input;

    // --- ledge hang: held in place until you climb up (up/jump) or let go (down) ---
    if (this.hang) {
      this.hang.t += dt; this.vx = 0; this.vy = 0;
      if (cin.jump || (cin.dir === this.hang.side && this.hang.t > 0.45)) this.startClimb();
      else if (cin.crouch || cin.slide) this.dropFromHang();
      this.runTime = 0; return;
    }
    // --- pull-up: a scripted, smooth move from the hang to the top of the block ---
    if (this.climbing > 0) {
      this.climbing -= dt; const k = 1 - Math.max(0, this.climbing) / CLIMB_TIME, e = k * k * (3 - 2 * k);
      this.x = this.climbFrom.x + (this.climbTo.x - this.climbFrom.x) * e;
      this.y = this.climbFrom.y + (this.climbTo.y - this.climbFrom.y) * (k < 0.6 ? Math.pow(k / 0.6, 1.4) * 0.92 : 0.92 + (k - 0.6) / 0.4 * 0.08);
      this.vx = 0; this.vy = 0;
      if (this.climbing <= 0) { this.x = this.climbTo.x; this.y = this.climbTo.y; this.onGround = true; this.climbing = 0; this.climbTo = null; this.events.push("mantle"); this.dust.push({ x: this.x, y: this.y, t: 0 }); }
      return;
    }
    // --- vault: a flowing hop over a low block while moving ---
    if (this.vaulting > 0) {
      this.vaulting -= dt; const k = 1 - Math.max(0, this.vaulting) / VAULT_TIME;
      this.x = this.vaultFrom.x + (this.vaultTo.x - this.vaultFrom.x) * k;
      this.y = this.vaultFrom.y + (this.vaultTo.y - this.vaultFrom.y) * k - Math.sin(k * Math.PI) * 55;
      if (this.vaulting <= 0) { this.x = this.vaultTo.x; this.y = this.vaultTo.y; this.onGround = true; this.vaulting = 0; this.vx = this.vaultDir * this.c.run * 0.9; this.events.push("land"); }
      return;
    }
    this.rolling = Math.max(0, this.rolling - dt);

    const c = this.c; let dir = input.dir || 0;
    this.slideCd = Math.max(0, this.slideCd - dt); this.wallJumpLock = Math.max(0, this.wallJumpLock - dt);
    if (this.wallJumpLock > 0) dir = this.facing;           // committed to the wall-jump direction for a moment

    // crouch / slide
    const wantCrouch = !!input.crouch;
    if (input.slide && this.onGround && this.sliding <= 0 && this.slideCd <= 0 && Math.abs(this.vx) > c.run * 0.6) {
      this.sliding = SLIDE_TIME; this.slideDir = Math.sign(this.vx) || this.facing; this.vx = this.slideDir * c.run * SLIDE_SPEED;
      this.events.push("slide"); this.dust.push({ x: this.x, y: this.y, t: 0 });
    }
    if (this.rolling > 0) { this.vx = this.rollDir * c.run * ROLL_SPEED * (0.75 + 0.25 * (this.rolling / ROLL_TIME)); this.crouching = false; }
    if (this.sliding > 0) {
      this.sliding -= dt;
      // friction bleeds the burst down toward a crouch-walk and never reverses you
      const floor = c.run * CROUCH_MUL, spd = Math.abs(this.vx);
      this.vx = this.slideDir * Math.max(floor, spd - (c.run * SLIDE_SPEED - floor) / SLIDE_TIME * dt);
      if (this.sliding <= 0) { this.sliding = 0; this.slideCd = SLIDE_COOLDOWN; }
      if (Math.random() < 0.6) this.dust.push({ x: this.x - this.slideDir * 20, y: this.y, t: 0.1 });
    }
    this.crouching = this.onGround && (wantCrouch || this.sliding > 0);
    this.sprinting = !!input.sprint && dir !== 0 && this.onGround && !this.crouching && this.sliding <= 0;

    // horizontal: accelerate toward the target speed, with a little momentum
    const maxSpeed = c.run * (this.sprinting ? SPRINT_MUL : this.crouching ? CROUCH_MUL : 1);
    if (this.sliding <= 0 && this.rolling <= 0) {
      const target = dir * maxSpeed, accel = this.onGround ? (this.sprinting ? 4200 : 3600) : 2200;
      if (this.vx < target) this.vx = Math.min(target, this.vx + accel * dt);
      else if (this.vx > target) this.vx = Math.max(target, this.vx - (dir === 0 ? 4200 : accel) * dt);
    }
    if (dir !== 0 && this.sliding <= 0) this.facing = dir;

    // wall cling: touching the side of a block in the air and pushing into it slows the fall
    this.wall = (!this.onGround) ? this.wallAt() : 0;
    if (this.wall !== 0) this.airJumpUsed = false;
    const pushingWall = this.wall !== 0 && dir === this.wall;
    if (this.wall !== 0 && !pushingWall) { /* drifting past a wall does nothing */ }

    // jump with coyote time + buffering
    if (input.jump) this.jumpBuf = JUMP_BUFFER; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = this.onGround ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && this.wall !== 0 && pushingWall && this.coyote <= 0) {
      this.vy = -WALL_JUMP_Y; this.vx = -this.wall * WALL_JUMP_X; this.facing = -this.wall; this.wallJumpLock = 0.18;
      this.jumpBuf = 0; this.wall = 0; this.events.push("walljump"); this.dust.push({ x: this.x, y: this.y - 80, t: 0 });
    } else if (this.jumpBuf > 0 && this.coyote > 0) {
      if (this.sliding > 0) { this.sliding = 0; this.slideCd = SLIDE_COOLDOWN; }
      this.vy = -c.jump; this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.events.push("jump");
      this.dust.push({ x: this.x, y: this.y, t: 0 });
    }
    else if (input.jump && !this.onGround && this.coyote <= 0 && !this.airJumpUsed && this.wall === 0 && this.jumpBuf > 0) {
      // double jump: one extra push in the air, a little weaker, and it restores your height control
      this.airJumpUsed = true; this.vy = -c.jump * DOUBLE_JUMP_MUL; this.jumpBuf = 0; this.events.push("doublejump"); this.dust.push({ x: this.x, y: this.y - 20, t: 0.15 });
    }
    // variable jump height: release early to cut the jump short
    if (!input.jumpHeld && this.vy < -420) this.vy = -420;

    // integrate
    const prevY = this.y, prevX = this.x;
    this.vy += GRAVITY * dt;
    if (pushingWall && this.vy > WALL_SLIDE_MAX) this.vy = WALL_SLIDE_MAX;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.x = Math.max(PLAYER_W / 2, Math.min(WORLD_W - PLAYER_W / 2, this.x));
    // mantle: if you are pressing into a block and its top is just above your feet, you pull yourself up onto it
    if (!this.onGround && dir !== 0 && this.vy > -200) {
      for (const p of this.platforms()) {
        if (p.y >= GROUND_Y - 5) continue;
        const rise = this.y - p.y;                                           // how far the top is above our feet
        const touching = dir > 0 ? Math.abs((this.x + PLAYER_W / 2) - p.x) < 14 && this.x < p.x
                               : Math.abs((this.x - PLAYER_W / 2) - (p.x + p.w)) < 14 && this.x > p.x + p.w;
        if (touching && rise > -10 && rise <= 70) { this.y = p.y; this.vy = 0; this.x += dir * (PLAYER_W / 2 + 6); this.onGround = true; this.events.push("mantle"); this.dust.push({ x: this.x, y: p.y, t: 0 }); break; }
      }
    }
    // vault: running into a low block (top just above the feet) while on the ground flows over it instead of stopping dead
    if (this.onGround && dir !== 0 && Math.abs(this.vx) > c.run * 0.7 && this.sliding <= 0 && !this.crouching) {
      const p = this.ledgeAhead(dir, 20, HANG_MIN - 5);
      if (p) {
        const tx = dir > 0 ? p.x + p.w + PLAYER_W / 2 + 6 : p.x - PLAYER_W / 2 - 6;
        // only vault when the block is thin enough to clear in one hop and there is ground on the far side
        if (p.w <= 260 && this.supportAt(tx, this.y - 20) !== null) {
          this.vaulting = VAULT_TIME; this.vaultDir = dir; this.vaultFrom = { x: this.x, y: this.y }; this.vaultTo = { x: tx, y: this.supportAt(tx, this.y - 20) }; this.events.push("vault"); this.dust.push({ x: this.x, y: this.y, t: 0 });
          return;
        }
      }
    }
    // ledge grab: falling or jumping toward a block whose top is above the feet but within reach, you catch the edge
    if (!this.onGround && this.vy > -120 && dir !== 0 && this.wallJumpLock <= 0) {
      const p = this.ledgeAhead(dir, HANG_MIN, HANG_MAX);
      if (p) { this.startHang(p, dir); return; }
    }
    // solid sides: you cannot walk through a crate or rock, you must jump onto it
    for (const p of this.platforms()) {
      if (p.y >= GROUND_Y - 5) continue;
      const feet = this.y, head = this.y - this.boxH();
      if (feet <= p.y + 6) continue;                                      // above the top: fine
      if (head >= p.y + 160) continue;                                    // far below the block
      if (this.x + PLAYER_W / 2 > p.x && this.x - PLAYER_W / 2 < p.x + p.w) {
        if (prevX + PLAYER_W / 2 <= p.x + 2) { this.x = p.x - PLAYER_W / 2; if (this.vx > 0) this.vx = 0; }
        else if (prevX - PLAYER_W / 2 >= p.x + p.w - 2) { this.x = p.x + p.w + PLAYER_W / 2; if (this.vx < 0) this.vx = 0; }
      }
    }

    // land on platforms (only when falling)
    const wasGround = this.onGround;
    this.onGround = false;
    if (this.vy >= 0) {
      const top = this.supportAt(this.x, prevY);
      if (top !== null && this.y >= top && prevY <= top + 10) {
        if (!wasGround && this.vy > 220) { this.squash = Math.min(1, Math.max(0.28, this.vy / 1400)); this.hardLand = Math.min(1, Math.max(0.1, (this.vy - 220) / 1280)); this.events.push("land"); this.dust.push({ x: this.x, y: top, t: 0 }); }
        const hardLanding = !wasGround && this.vy > 650;
        this.y = top; this.vy = 0; this.onGround = true; this.airJumpUsed = false;
        if (hardLanding && (dir !== 0 || input.slide) && this.sliding <= 0) {
          // roll out of the fall: you keep your momentum and shrug off the impact
          this.rolling = ROLL_TIME; this.rollDir = dir || this.facing; this.vx = this.rollDir * c.run * ROLL_SPEED; this.squash = 0.1; this.events.push("roll");
        }
      }
    }

    // run animation clock and footstep dust
    if (this.onGround && Math.abs(this.vx) > 40) {
      const before = Math.floor(this.runTime * 2);
      this.runTime += dt * (Math.abs(this.vx) / 60);
      if (Math.floor(this.runTime * 2) !== before) this.events.push("step");
      this.distance += Math.abs(this.x - prevX);
      // walking is tiring: one energy per this many units run on the ground
      const per = UNITS_PER_ENERGY / (c.drain * (this.sprinting ? SPRINT_DRAIN : 1));
      while (this.distance >= per && !this.over) { this.distance -= per; this.spend(1, "You are getting tired."); }
    } else if (this.onGround) this.runTime = 0;

    this.airTime = this.onGround ? 0 : this.airTime + dt;
    this.speedFx += ((this.sprinting ? 1 : this.sliding > 0 ? 0.7 : 0) - this.speedFx) * Math.min(1, dt * 6);

    // fell into the chasm
    if (this.y > KILL_Y) this.fall();

    // checkpoints
    for (let i = this.checkpoint + 1; i < CHECKPOINTS.length; i++) if (this.x >= CHECKPOINTS[i].x) this.checkpoint = i;
  }

  /* nearest raised block whose near edge is in front of us and whose top is within a vertical window above the feet */
  ledgeAhead(dir, minRise, maxRise) {
    if (!dir) return null;
    for (const p of this.platforms()) {
      if (p.y >= GROUND_Y - 5) continue;
      const rise = this.y - p.y;
      if (rise < minRise || rise > maxRise) continue;
      const gap = dir > 0 ? p.x - (this.x + PLAYER_W / 2) : (this.x - PLAYER_W / 2) - (p.x + p.w);
      if (gap > -8 && gap < 26 && ((dir > 0 && this.x < p.x) || (dir < 0 && this.x > p.x + p.w))) return p;
    }
    return null;
  }

  /* grab the edge of a block: stop, hang by the hands just under the top */
  startHang(p, dir) {
    this.hang = { p, side: dir, t: 0 }; this.vx = 0; this.vy = 0; this.onGround = false; this.airJumpUsed = false;
    this.x = dir > 0 ? p.x - PLAYER_W / 2 - 4 : p.x + p.w + PLAYER_W / 2 + 4; this.y = p.y + 150;   // hands at the top edge, feet hang below
    this.events.push("hang");
  }
  /* pull up from a hang onto the top of the block */
  startClimb() {
    const h = this.hang; if (!h) return;
    this.climbing = CLIMB_TIME; this.climbFrom = { x: this.x, y: this.y };
    this.climbTo = { x: h.side > 0 ? h.p.x + PLAYER_W / 2 + 10 : h.p.x + h.p.w - PLAYER_W / 2 - 10, y: h.p.y };
    this.hang = null; this.events.push("climb");
  }
  dropFromHang() { const h = this.hang; if (!h) return; this.x -= h.side * (PLAYER_W / 2 + 6); this.hang = null; this.vy = 0; this.events.push("drop"); }

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

if (typeof module !== "undefined") module.exports = { Game, CHARACTERS, PLATFORMS, BRIDGE, OBJECTS, START, CHECKPOINTS, WORLD_W, WORLD_H, GROUND_Y, GRAVITY, PLAYER_W, PLAYER_H, KILL_Y, CROUCH_H, SPRINT_MUL, SLIDE_SPEED, SLIDE_TIME };
