/* Mystery Island: character pose blending.
   The survivors are single painted figures, so a pose is a transform of that same picture:
   lean, vertical bob, squash/stretch, a small sway, a breathing scale, and a turn squash when the facing flips.
   Every channel is eased toward its target each frame, so changing action never snaps. Pure maths, no DOM. */
(() => {
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // each state describes a target pose; channels not listed fall back to 0 (sx, sy fall back to 1)
  class PoseBlender {
    constructor() {
      this.p = { lean: 0, bob: 0, sx: 1, sy: 1, sway: 0, breathe: 0, tilt: 0, drop: 0, lift: 0 };
      this.turn = 0;          // 0..1, decays after the facing flips
      this.lastFacing = 1;
      this.interact = 0;      // 0..1 reach animation timer
      this.hurt = 0;
      this.time = 0;
      this.state = "idle"; this.prevState = "idle";
    }
    kick(kind) { if (kind === "doublejump") this.airFlip = 1; else if (kind === "interact") this.interact = 1; else if (kind === "hurt") this.hurt = 1; }

    // g: the Game; returns the blended pose to draw with
    update(dt, g) {
      this.time += dt;
      const run = g.c.run, speedN = clamp(Math.abs(g.vx) / run, 0, 1.6), moving = Math.abs(g.vx) > 30;
      if (g.facing !== this.lastFacing) { this.turn = 1; this.lastFacing = g.facing; }
      this.turn = Math.max(0, this.turn - dt * 5.5);
      this.airFlip = Math.max(0, (this.airFlip || 0) - dt * 2.2); this.interact = Math.max(0, this.interact - dt * 2.4); this.hurt = Math.max(0, this.hurt - dt * 3);

      // ---- pick the state ----
      let st = "idle";
      if (g.over && !g.won) st = "collapse";
      else if (g.inWater) st = g.submerged ? "dive" : "swim";
      else if (g.hang) st = "hang";
      else if (g.climbing > 0) st = "climbup";
      else if (g.vaulting > 0) st = "vault";
      else if (g.rolling > 0) st = "roll";
      else if (this.airFlip > 0) st = "flip";
      else if (g.sliding > 0) st = "slide";
      else if (!g.onGround && g.wall !== 0) st = "wall";
      else if (!g.onGround) st = g.vy < -250 ? "rise" : g.vy > 300 ? "fall" : "apex";
      else if (g.squash > 0.08) st = "land";
      else if (g.crouching) st = moving ? "crouchwalk" : "crouch";
      else if (g.sprinting && moving) st = "sprint";
      else if (moving) st = speedN > 0.72 ? "run" : "walk";
      this.state = st;

      // ---- target channels ----
      const t = { lean: 0, bob: 0, sx: 1, sy: 1, sway: 0, breathe: 0, tilt: 0, drop: 0, lift: 0 };
      const ph = g.runTime * Math.PI * 2 * 0.5;                          // stride phase advances with distance, so feet-equivalent motion matches speed
      const step = Math.abs(Math.sin(ph)), side = Math.sin(ph);
      switch (st) {
        case "idle": {
          // breathing: slow chest rise, tiny weight shift, never frozen
          const b = Math.sin(this.time * 1.9), w = Math.sin(this.time * 0.63);
          t.breathe = b; t.sy = 1 + b * 0.012; t.sx = 1 - b * 0.006; t.sway = w * 0.012; t.lean = w * 0.01; t.bob = (b * 0.5 + 0.5) * 1.5; break;
        }
        case "walk": t.lean = speedN * 0.07; t.bob = step * 9 * speedN; t.sway = side * 0.02; t.sy = 1 + step * 0.012; t.sx = 1 - step * 0.008; break;
        case "run": t.lean = speedN * 0.15; t.bob = step * 15 * speedN; t.sway = side * 0.035; t.sy = 1 + step * 0.02; t.sx = 1 - step * 0.014; break;
        case "sprint": t.lean = 0.24 + (speedN - 1) * 0.1; t.bob = step * 20; t.sway = side * 0.05; t.sy = 0.985 + step * 0.026; t.sx = 1.02 - step * 0.02; t.drop = 4; break;
        case "rise": { const k = clamp(-g.vy / 1100, 0, 1); t.sy = 1 + 0.11 * k; t.sx = 1 - 0.08 * k; t.lean = clamp(g.vx / run, -1, 1) * 0.1 - 0.02; t.lift = 6 * k; break; }
        case "apex": t.sy = 1.02; t.sx = 0.99; t.lean = clamp(g.vx / run, -1, 1) * 0.06; t.sway = Math.sin(this.time * 7) * 0.012; break;
        case "fall": { const k = clamp(g.vy / 1500, 0, 1); t.sy = 1 + 0.08 * k; t.sx = 1 - 0.06 * k; t.lean = clamp(g.vx / run, -1, 1) * 0.12 + 0.04; t.sway = Math.sin(this.time * 14) * 0.02 * k; break; }
        case "land": { const k = g.squash; t.sy = 1 - 0.24 * k; t.sx = 1 + 0.22 * k; t.drop = 6 * k; t.lean = clamp(g.vx / run, -1, 1) * 0.08; break; }
        case "crouch": { const b = Math.sin(this.time * 2.1); t.sy = 0.74 + b * 0.008; t.sx = 1.08; t.lean = 0.1; t.drop = 0; break; }
        case "crouchwalk": t.sy = 0.74 + step * 0.015; t.sx = 1.08; t.lean = 0.14; t.bob = step * 4; t.sway = side * 0.02; break;
        case "slide": t.sy = 0.62; t.sx = 1.18; t.lean = -0.5; t.drop = -2; break;     // leaning back with the feet forward
        case "wall": t.lean = g.wall * 0.2; t.sy = 1.03; t.sx = 0.98; t.sway = Math.sin(this.time * 9) * 0.012; break;
        case "swim": { const s = Math.sin(this.time * (3 + Math.abs(g.vx) / 90)); t.sy = 0.94; t.sx = 1.04; t.lean = 0.36 * (Math.abs(g.vx) > 20 ? 1 : 0.4) + s * 0.04; t.bob = 0; t.lift = 0; t.drop = 0 + s * 3; t.sway = s * 0.03; break; }      // body tilted forward, rocking with the stroke
        case "dive": { const s = Math.sin(this.time * 4); t.sy = 0.9; t.sx = 1.06; t.lean = 1.1 + s * 0.05; t.drop = s * 3; break; }                  // head down, stroking
        case "hang": { const b = Math.sin(this.time * 3.1); t.sy = 1.12 + b * 0.012; t.sx = 0.9; t.lean = -0.04 + b * 0.012; t.lift = 8; t.sway = Math.sin(this.time * 2.3) * 0.02; break; }   // stretched by the arms, hanging
        case "climbup": { const k = 1 - g.climbing / CLIMB_TIME; t.sy = 1.06 - 0.3 * Math.sin(k * Math.PI); t.sx = 0.96 + 0.1 * Math.sin(k * Math.PI); t.lean = 0.28 * Math.sin(k * Math.PI); t.lift = 4; break; }
        case "vault": { const k = 1 - g.vaulting / VAULT_TIME; t.sy = 0.86 + 0.1 * k; t.sx = 1.1 - 0.06 * k; t.lean = 0.3 - 0.35 * k; t.lift = 3; break; }
        case "roll": { const k = 1 - g.rolling / ROLL_TIME; t.sy = 0.62; t.sx = 1.12; t.tilt = k * Math.PI * 2 * g.facing; t.drop = -2; break; }
        case "flip": { const k = 1 - this.airFlip; t.sy = 0.96; t.sx = 1.04; t.tilt = k * Math.PI * 2 * g.facing * 0.9; t.lift = 4; break; }
        case "collapse": t.lean = 0.9; t.sy = 0.55; t.sx = 1.1; t.drop = 0; break;
      }
      // turning: a quick squash across the body as you swing round
      if (this.turn > 0) { t.sx *= 1 - 0.22 * Math.sin(this.turn * Math.PI); t.sway += (1 - this.turn) * 0.0; }
      // interaction: lean forward and reach
      if (this.interact > 0) { const k = Math.sin(this.interact * Math.PI); t.lean += 0.22 * k; t.sy *= 1 - 0.05 * k; t.sx *= 1 + 0.04 * k; }
      // taking a hit: flinch back
      if (this.hurt > 0) { t.lean -= 0.18 * this.hurt; t.sy *= 1 - 0.06 * this.hurt; }

      // ---- blend: different channels follow at different speeds so motion feels weighty, not mechanical ----
      // the slide's backward lean is a big swing, so it is eased in and out slowly; everything else is quick
      const leanRate = st === "slide" ? 7 : this.prevState === "slide" ? 6 : 11;
      const k = { lean: leanRate, bob: 22, sx: st === "land" ? 34 : 18, sy: st === "land" ? 34 : 18, sway: 14, breathe: 8, tilt: st === "roll" || st === "flip" ? 40 : 14, drop: 20, lift: 16 };
      this.prevState = st;
      // slew limit: no channel may move faster than its cap per second, so a big change of target (sprint to slide to crouch) is always a smooth swing
      const cap = { lean: 2.4, bob: 260, sx: 5, sy: 5, sway: 1.4, breathe: 20, tilt: 60, drop: 120, lift: 120 };
      for (const c in this.p) { const next = damp(this.p[c], t[c], k[c], dt), maxStep = cap[c] * dt; this.p[c] += Math.max(-maxStep, Math.min(maxStep, next - this.p[c])); }
      return this.p;
    }
  }
  window.PoseBlender = PoseBlender;
})();
