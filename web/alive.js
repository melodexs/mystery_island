/* Mystery Island: "alive world" motion layer.
   Adds motion on top of the EXISTING painting without changing a single painted pixel's colour or position at rest:
   - a very slow, sub-pixel wind sway that warps the existing painting in horizontal strips (strength fades toward the ground),
   - drifting mist and a soft light shimmer drawn with transparent overlays,
   - a local ripple of the painting around the player's feet (grass and ground reacting to movement),
   - footstep dust, wind-blown leaves and rain splashes as particles.
   Everything can be turned off with ALIVE.enabled = false, which restores the original drawing exactly. */
(() => {
  const ALIVE = { enabled: true, wind: 0.5, windTarget: 0.5, time: 0, strips: 48, gust: 0, nextGust: 6, leaves: [], splashes: [], mist: [], ripple: [], perf: { ms: 0, n: 0, scale: 1 } };
  ALIVE.birds = []; ALIVE.shadows = []; ALIVE.nextFlock = 3;
  for (let i = 0; i < 3; i++) ALIVE.shadows.push({ x: Math.random() * 4600 - 300, w: 520 + Math.random() * 420, v: 14 + Math.random() * 12, a: 0.10 + Math.random() * 0.07 });
  for (let i = 0; i < 9; i++) ALIVE.mist.push({ x: Math.random(), y: 0.45 + Math.random() * 0.4, s: 0.35 + Math.random() * 0.5, v: 0.004 + Math.random() * 0.01, a: 0.04 + Math.random() * 0.05 });

  ALIVE.update = function (dt, game, camX, viewW, storm) {
    this.time += dt;
    this.nextGust -= dt; if (this.nextGust <= 0) { this.gust = 0.6 + Math.random() * 0.7; this.nextGust = 5 + Math.random() * 9; }
    this.gust = Math.max(0, this.gust - dt * 0.35);
    this.wind += (this.windTarget + this.gust * 0.6 - this.wind) * Math.min(1, dt * 0.8);
    // leaves lifted off the scene by gusts and by the player running past
    if (this.leaves.length < 22 && Math.random() < dt * (1.2 + this.wind * 3)) this.leaves.push({ x: camX + Math.random() * viewW, y: 200 + Math.random() * 500, vx: 60 + Math.random() * 120, vy: 10 + Math.random() * 40, r: Math.random() * 6, vr: (Math.random() - 0.5) * 6, s: 3 + Math.random() * 4, t: 0 });
    for (const l of this.leaves) { l.t += dt; l.x += (l.vx + this.wind * 120) * dt; l.y += (l.vy + Math.sin(l.t * 2.4) * 40) * dt; l.r += l.vr * dt; }
    this.leaves = this.leaves.filter((l) => l.x < camX + viewW + 80 && l.y < 960 && l.t < 14);
    for (const m of this.mist) { m.x += m.v * dt * (1 + this.wind); if (m.x > 1.3) m.x = -0.3; }
    // distant birds crossing the sky in loose flocks, quicker in a gust; they only appear while the player is in the world
    this.nextFlock -= dt;
    if (this.nextFlock <= 0 && this.birds.length < 14) {
      const n = 2 + Math.floor(Math.random() * 4), y0 = 70 + Math.random() * 150, dir = Math.random() < 0.7 ? 1 : -1, x0 = dir > 0 ? camX - 80 : camX + viewW + 80;
      for (let i = 0; i < n; i++) this.birds.push({ x: x0 - dir * i * (34 + Math.random() * 30), y: y0 + (Math.random() - 0.5) * 50 + i * 6, dir, v: 70 + Math.random() * 30, ph: Math.random() * 6, s: 0.8 + Math.random() * 0.5 });
      this.nextFlock = 9 + Math.random() * 14;
    }
    for (const b of this.birds) { b.x += b.dir * b.v * (1 + this.wind * 0.5) * dt; b.y += Math.sin(this.time * 0.9 + b.ph) * 6 * dt; b.ph += dt * (7 + this.wind * 3); }
    this.birds = this.birds.filter((b) => b.x > camX - 200 && b.x < camX + viewW + 200);
    // slow cloud shadows sliding across the land, so the light seems to move with the sky
    for (const c of this.shadows) { c.x += c.v * dt * (1 + this.wind); if (c.x > 4500) c.x = -c.w; }
    // ripple sources: where the player's feet disturb the ground
    for (const r of this.ripple) r.t += dt; this.ripple = this.ripple.filter((r) => r.t < 0.9);
    for (const s of this.splashes) s.t += dt; this.splashes = this.splashes.filter((s) => s.t < 0.5);
  };
  ALIVE.disturb = function (x, y, strength) { this.ripple.push({ x, y, t: 0, k: strength }); if (this.ripple.length > 12) this.ripple.shift(); };

  /* Draw one painted piece with a gentle sway. `img` is the original painting; nothing is repainted: the same pixels are drawn,
     just shifted a fraction of a pixel to a few pixels per strip, so the picture breathes. At wind 0 it is identical to a plain drawImage. */
  ALIVE.drawPiece = function (ctx, img, sx, w, worldH, playerX, playerY, groundY, worldX) {
    if (!this.enabled) { ctx.drawImage(img, sx, 0, w + 1, worldH); return; }
    const N = this.strips, sh = img.naturalHeight / N, dh = worldH / N, t = this.time;
    for (let i = 0; i < N; i++) {
      const yN = i / N;                                              // 0 top .. 1 bottom
      // sway is strongest in the upper-middle (foliage, sky, sea surface) and fades to nothing at the ground and the very top
      const band = Math.sin(Math.min(1, yN * 1.25) * Math.PI) * (1 - Math.max(0, (yN - 0.72) / 0.28));
      const phase = t * 1.1 + i * 0.35 + (sx + worldX) * 0.004;
      let off = Math.sin(phase) * 2.2 * band * this.wind * 1.6 + Math.sin(phase * 2.3 + 1.7) * 0.9 * band * this.wind;
      // the strips near the ground react to the player's feet: a short decaying wave that pushes the painting sideways around each footfall.
      // a strip is only affected when the footfall is on this piece of the painting (horizontal falloff is applied per piece below)
      const sy = i * dh, wy = sy + dh / 2;
      for (const r of this.ripple) {
        const vert = Math.exp(-Math.pow((wy - (r.y - 60)) / 110, 2));                 // only strips around foot height
        const horiz = Math.exp(-Math.pow(((worldX + w / 2) - r.x) / (w * 0.6), 2));   // only pieces near the footfall
        off += Math.sin(r.t * 15 - wy * 0.045) * Math.exp(-r.t * 4.2) * r.k * 4.5 * vert * horiz;
      }
      ctx.drawImage(img, 0, i * sh, img.naturalWidth, sh + 0.6, sx + off, sy, w + 1, dh + 0.6);
    }
  };

  /* Overlay: drifting mist and a soft moving shimmer. Pure transparent gradients over the painting. */
  ALIVE.drawOverlay = function (ctx, viewW, worldH, camX) {
    if (!this.enabled) return;
    ctx.save();
    for (const m of this.mist) {
      const x = m.x * viewW, y = m.y * worldH, r = m.s * viewW * 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(170,205,205,${m.a * (0.6 + this.wind * 0.5)})`); g.addColorStop(1, "rgba(170,205,205,0)");
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // cloud shadows: wide soft dark patches over the ground band
    for (const c of this.shadows) {
      const x = c.x - camX + c.w / 2; if (x < -c.w || x > viewW + c.w) continue;
      const g = ctx.createRadialGradient(x, worldH * 0.78, 0, x, worldH * 0.78, c.w * 0.6); g.addColorStop(0, `rgba(2,10,12,${c.a})`); g.addColorStop(1, "rgba(2,10,12,0)");
      ctx.save(); ctx.translate(x, worldH * 0.78); ctx.scale(1, 0.38); ctx.translate(-x, -worldH * 0.78); ctx.fillStyle = g; ctx.fillRect(x - c.w, worldH * 0.78 - c.w, c.w * 2, c.w * 2); ctx.restore();
    }
    // birds: dark flapping silhouettes
    ctx.strokeStyle = "rgba(6,14,16,.8)"; ctx.lineCap = "round";
    for (const b of this.birds) {
      const x = b.x - camX, flap = Math.sin(b.ph) * 5 * b.s, w = 9 * b.s; ctx.lineWidth = 1.8 * b.s;
      ctx.beginPath(); ctx.moveTo(x - w, b.y - flap * b.dir * 0.2 - flap * 0.3); ctx.quadraticCurveTo(x - w * 0.4, b.y - 3 * b.s - flap, x, b.y); ctx.quadraticCurveTo(x + w * 0.4, b.y - 3 * b.s - flap, x + w, b.y - flap * 0.3); ctx.stroke();
    }
    // wind-blown leaves
    ctx.fillStyle = "rgba(70,110,84,.9)";
    for (const l of this.leaves) { ctx.save(); ctx.translate(l.x - camX, l.y); ctx.rotate(l.r); ctx.beginPath(); ctx.ellipse(0, 0, l.s * 1.6, l.s * 0.7, 0, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.restore();
  };

  window.ALIVE = ALIVE;
})();
