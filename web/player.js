/* Stormbound player controller: no DOM, no three.js, so it can be tested in Node. Units: metres, seconds.
   Movement is camera-relative. Hazards are falls, cold and stamina only. */
(function (root) {
  const T = typeof require !== "undefined" && typeof module !== "undefined" ? require("./terrain.js") : root.SBT;
  const R = 0.38, EYE = 1.62, GRAV = 24, WALK = 3.6, RUN = 5.6, SPRINT = 8.2, CROUCH = 2.0, SWIM = 2.6, JUMP_V = 8.0, CLIMB_SPEED = 2.2;
  const MAX_STEP = 0.55;           // can step up this much instantly (kerbs, small rocks)
  const MAX_SLOPE = 0.95;          // rise/run you can walk up
  const SEA = -0.15;               // water surface (waves ride on top of this visually)

  class Player {
    constructor(x, z, perks, colliders) {
      this.x = x; this.z = z; this.y = T.height(x, z); this.vx = 0; this.vz = 0; this.vy = 0; this.yaw = 0;
      this.perks = perks || { sprint: 1, jump: 1, crouch: 1 }; this.colliders = colliders || [];
      this.onGround = true; this.crouching = false; this.sprinting = false; this.swimming = false; this.climbing = false; this.climbT = 0; this.climbFrom = null; this.climbTo = null;
      this.fallStart = this.y; this.landed = 0; this.speed = 0; this.moveAmt = 0; this.justLanded = 0; this.coyote = 0; this.jumpBuf = 0; this.canClimb = false;
    }
    get h() { return this.crouching ? 1.15 : 1.8; }
    groundY() { return T.height(this.x, this.z); }
    inWater() { return this.groundY() < SEA - 0.1 && this.y < SEA + 0.9; }
    /* push out of solid obstacles (trees, rocks, buildings): circle vs circle in the xz plane, if we are below their top */
    resolve() { for (const c of this.colliders) { if (this.y > T.height(c.x, c.z) + c.h - 0.2) continue; const dx = this.x - c.x, dz = this.z - c.z, d = Math.hypot(dx, dz), m = c.r + R; if (d < m && d > 1e-4) { this.x = c.x + dx / d * m; this.z = c.z + dz / d * m; } } }
    /* in: {fx, fz (-1..1 camera-relative axes), jump(pressed), jumpHeld, sprint, crouch, useStamina(fn)} */
    update(dt, inp, stamina) {
      this.justLanded = Math.max(0, this.justLanded - dt);
      if (this.climbing) return this.updateClimb(dt);
      const mag = Math.min(1, Math.hypot(inp.fx, inp.fz)); this.moveAmt = mag;
      const wasWater = this.swimming; this.swimming = this.inWater();
      // crouch only on land, and only stand up if there is room (always, here: no ceilings outside the cabin)
      this.crouching = !!inp.crouch && !this.swimming && this.onGround;
      const canSprint = stamina && stamina.ok && !this.crouching && !this.swimming && mag > 0.1 && inp.sprint && this.onGround;
      this.sprinting = !!canSprint;
      let target = this.swimming ? SWIM : this.crouching ? CROUCH * this.perks.crouch : this.sprinting ? SPRINT * this.perks.sprint : mag > 0.55 ? RUN : WALK;
      target *= mag > 0.01 ? Math.max(0.35, mag) : 0;
      // slope slows uphill
      const gy = this.groundY(), ahead = T.height(this.x + Math.sin(this.yaw) * 0.0 + inp.fx * 0.6, this.z + inp.fz * 0.6);
      const dx = inp.fx, dz = inp.fz, len = Math.hypot(dx, dz) || 1; let wx = dx / len * target, wz = dz / len * target;
      // acceleration: snappy on the ground, softer in the air and water
      const acc = this.onGround ? (target > 0.01 ? 14 : 18) : this.swimming ? 6 : 3.2, k = 1 - Math.exp(-acc * dt);
      this.vx += (wx - this.vx) * k; this.vz += (wz - this.vz) * k;
      // horizontal move with slope + obstacle handling, in two axes so you slide along walls
      const move = (ox, oz) => { const nx = this.x + ox, nz = this.z + oz, cur = this.onGround ? this.y : Infinity, ny = T.height(nx, nz);
        if (this.onGround) {
          // judge steepness over a 0.7 m probe ahead, not over one frame's tiny step (a smooth 4:1 ramp never exceeds a per-frame limit)
          const run = Math.hypot(ox, oz) || 1e-6, ux = ox / run, uz = oz / run, PROBE = 0.7, ahead = T.height(this.x + ux * PROBE, this.z + uz * PROBE);
          const slope = (ahead - this.groundY()) / PROBE; if (slope > MAX_SLOPE && ahead - this.groundY() > MAX_STEP) return false;
          // ALSO judge the true steepness of the ground you are about to stand on (the full gradient, not just along your heading).
          // Without this, walking diagonally across a steep face reads as a gentle slope and you can 'staircase' up a cliff.
          const E = 0.5, gx = (T.height(nx + E, nz) - T.height(nx - E, nz)) / (2 * E), gz = (T.height(nx, nz + E) - T.height(nx, nz - E)) / (2 * E);
          if (Math.hypot(gx, gz) > MAX_SLOPE * 1.6 && ny > this.y - 0.02) return false;   // steep ground ahead and not downhill: blocked
        }
        if (!this.onGround && !this.swimming && ny > this.y + 0.15) return false;     // airborne: terrain above your feet is solid, you cannot fly into a wall
        this.x = nx; this.z = nz; return true; };
      const sx = this.vx * dt, sz = this.vz * dt; if (!move(sx, sz)) { if (!move(sx, 0) ) this.vx = 0; if (!move(0, sz)) this.vz = 0; }
      this.resolve();
      this.speed = Math.hypot(this.vx, this.vz);
      // jump: buffered and with a little coyote time, so it feels responsive
      this.jumpBuf = inp.jump ? 0.14 : Math.max(0, this.jumpBuf - dt); this.coyote = this.onGround ? 0.1 : Math.max(0, this.coyote - dt);
      if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0) && !this.swimming) { this.vy = JUMP_V * this.perks.jump * (this.crouching ? 0.8 : 1); this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.fallStart = this.y; this.crouching = false; this.jumped = true; } else this.jumped = false;
      const g = this.groundY();
      if (this.swimming) {                                   // buoyancy: float at the surface, press jump to dive-kick up, crouch to dive
        const surf = SEA + 0.35; this.vy += ((surf - this.y) * 6 - this.vy * 3) * dt; if (inp.crouch) this.vy -= 5 * dt; this.y += this.vy * dt; this.onGround = false; this.fallStart = this.y;
        if (this.y < g + 0.1) this.y = g + 0.1; if (!wasWater) this.splash = 1;
      } else if (this.onGround) {
        // glue to the ground on slopes, but leave it if the ground falls away fast (walking off a ledge)
        if (g < this.y - 0.7 && g < this.y - this.speed * dt * 1.2 - 0.25) { this.onGround = false; this.fallStart = this.y; this.vy = 0; } else { this.y += (g - this.y) * Math.min(1, dt * 22); if (Math.abs(g - this.y) < 0.02) this.y = g; }
      }
      if (!this.onGround && !this.swimming) {
        this.vy -= GRAV * dt; this.y += this.vy * dt;
        if (this.y <= g) {
          const e = 0.5, sx = (T.height(this.x + e, this.z) - T.height(this.x - e, this.z)) / (2 * e), sz = (T.height(this.x, this.z + e) - T.height(this.x, this.z - e)) / (2 * e), steep = Math.hypot(sx, sz);
          if (steep > MAX_SLOPE * 1.35) {                 // too steep to stand on: slide DOWNHILL, never up
            const n = steep || 1, dxn = -sx / n, dzn = -sz / n;                  // unit vector pointing downhill
            this.vx = dxn * 5; this.vz = dzn * 5;                                 // push away from the face (replaces any momentum into it)
            const nx = this.x + this.vx * dt, nz = this.z + this.vz * dt; this.x = nx; this.z = nz;
            this.y = Math.min(this.y, Math.max(T.height(nx, nz), this.y - 3 * dt)); // follow the terrain down, never lift
            this.vy = Math.max(this.vy, -12); this.sliding = true; this.onGround = false;
          } else { const drop = this.fallStart - g; this.y = g; this.vy = 0; this.onGround = true; this.landed = drop; this.justLanded = 0.25; this.sliding = false; }
        }
      }
      this.resolve();
      return this;
    }
    /* rope climb: a scripted smooth move from the foot of the wall to the top, with the player held to the wall */
    startClimb(from, to) { this.climbing = true; this.climbT = 0; this.climbFrom = { ...from }; this.climbTo = { ...to }; this.vx = this.vz = this.vy = 0; this.onGround = false; this.crouching = false; this.sprinting = false; }
    updateClimb(dt) {
      const dist = Math.hypot(this.climbTo.x - this.climbFrom.x, this.climbTo.z - this.climbFrom.z) + Math.abs(this.climbTo.y - this.climbFrom.y);
      this.climbT = Math.min(1, this.climbT + dt * CLIMB_SPEED / Math.max(4, dist)); const e = this.climbT * this.climbT * (3 - 2 * this.climbT);
      this.x = this.climbFrom.x + (this.climbTo.x - this.climbFrom.x) * e; this.z = this.climbFrom.z + (this.climbTo.z - this.climbFrom.z) * e; this.y = this.climbFrom.y + (this.climbTo.y - this.climbFrom.y) * e;
      if (this.climbT >= 1) { this.climbing = false; this.onGround = true; this.fallStart = this.y; this.climbDone = true; }
      return this;
    }
  }
  const api = { Player, R, EYE, WALK, RUN, SPRINT, CROUCH, SWIM, JUMP_V, GRAV, SEA, MAX_SLOPE };
  if (typeof module !== "undefined") module.exports = api; else root.SBP = api;
})(typeof window !== "undefined" ? window : globalThis);
