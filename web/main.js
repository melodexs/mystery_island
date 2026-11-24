/* Mystery Island - animated painted side-scroller: browser layer.
   Physics and rules live in world.js (Game). This file draws, animates and listens. */
(() => {
  const $ = (id) => document.getElementById(id);
  let state = "title";              // title | select | boat | playing | ending
  let game = null, chosen = null, muted = false;

  function show(id) { document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active")); $(id).classList.add("active"); }

  /* ---------------- audio ---------------- */
  let actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
    if (actx && actx.state === "suspended") actx.resume();
    return actx;
  }
  function beep(freq, dur = 0.12, type = "sine", vol = 0.06, slide = 0) {
    const a = audio(); if (!a || muted) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  function noise(dur, freq, vol) {
    const a = audio(); if (!a || muted) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = "lowpass"; f.frequency.value = freq; g.gain.value = vol; s.buffer = buf; s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  const thunder = () => noise(1.6, 200, 0.4);
  // continuous wind and rain bed, louder when you move fast
  let amb = null;
  function startAmbience() {
    const a = audio(); if (!a || amb) return;
    const n = a.sampleRate * 2, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; src.loop = true; f.type = "lowpass"; f.frequency.value = 500; g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start(); amb = { f, g };
  }
  function updateAmbience(speedFx) { if (!amb || !actx) return; const t = actx.currentTime; amb.g.gain.setTargetAtTime(muted ? 0 : 0.035 + speedFx * 0.05, t, 0.2); amb.f.frequency.setTargetAtTime(500 + speedFx * 900, t, 0.2); }
  const SFX = {
    jump:   () => beep(300, .14, "triangle", .05, 260),
    land:   () => noise(.12, 500, .18),
    step:   () => { const cave = game && game.x > 1500 && game.x < 2500, sand = game && game.x < 1500; noise(.05, cave ? 1500 : sand ? 380 : 800, cave ? .09 : .06); if (cave) beep(110, .05, "sine", .02); },
    slide:  () => noise(.5, 900, .12),
    splash: () => { noise(.35, 900, .2); beep(180, .18, "sine", .06, 90); },
    exitwater: () => noise(.2, 800, .1),
    climbout: () => { noise(.3, 700, .12); beep(150, .12, "sine", .04, 110); },
    breath: () => { beep(520, .12, "square", .04); beep(520, .12, "square", .04, 520, .18); },
    doublejump: () => { noise(.08, 1400, .08); beep(420, .16, "triangle", .05, 320); },
    hang:   () => { noise(.1, 700, .12); beep(120, .1, "sine", .04); },
    climb:  () => { noise(.25, 600, .1); },
    drop:   () => noise(.1, 500, .08),
    vault:  () => { noise(.18, 1000, .09); beep(260, .1, "triangle", .03, 180); },
    roll:   () => { noise(.35, 700, .14); },
    walljump: () => { noise(.1, 1200, .1); beep(340, .12, "triangle", .05, 200); },
    pickup: () => { beep(660, .09, "triangle"); setTimeout(() => beep(990, .14, "triangle"), 90); },
    build:  () => { beep(180, .12, "square", .05); setTimeout(() => beep(240, .12, "square", .05), 120); setTimeout(() => beep(330, .2, "square", .05), 240); },
    deny:   () => beep(140, .18, "sawtooth", .05),
    tired:  () => beep(260, .25, "sine", .05, -120),
    fall:   () => beep(400, .6, "sawtooth", .05, -330),
    win:    () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .3, "triangle", .07), i * 150)),
    lose:   () => [330, 262, 196, 130].forEach((f, i) => setTimeout(() => beep(f, .35, "sawtooth", .05), i * 200)),
  };
  $("mute").addEventListener("click", () => { muted = !muted; $("mute").textContent = muted ? "Sound off" : "Sound on"; });

  /* ---------------- lightning ---------------- */
  let boltTimer = null, flash = 0;
  function startStorm() {
    stopStorm();
    const tick = () => {
      if (state === "playing") { flash = 1; setTimeout(thunder, 300 + Math.random() * 500); }
      else if (state === "boat") { const el = $("boat-bolt"); el.classList.remove("go"); void el.offsetWidth; el.classList.add("go"); setTimeout(thunder, 400); }
      boltTimer = setTimeout(tick, 5000 + Math.random() * 8000);
    };
    boltTimer = setTimeout(tick, 2500);
  }
  function stopStorm() { clearTimeout(boltTimer); }

  /* ---------------- art ---------------- */
  const IMG = {};
  function load(name, src) { const i = new Image(); i.src = src; IMG[name] = i; return i; }
  ["world_1", "world_2", "world_3"].forEach((n) => load(n, `img/${n}.jpg`));
  Object.keys(CHARACTERS).forEach((k) => { load("fig_" + k, `img/fig_${k}.png`); load("face_" + k, `img/${k}.jpg`); });
  ["boat", "landing", "title"].forEach((n) => load(n, `img/${n}.jpg`));
  const WORLD_PIECES = [{ n: "world_1", x: 0, w: 1365 }, { n: "world_2", x: 1365, w: 1365 }, { n: "world_3", x: 2730, w: 1366 }];

  /* ---------------- canvas + camera ---------------- */
  const cv = $("view"), ctx = cv.getContext("2d");
  let VW = 0, VH = 0, DPR = 1, SCALE = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    VW = window.innerWidth; VH = window.innerHeight;
    cv.width = Math.floor(VW * DPR); cv.height = Math.floor(VH * DPR);
    cv.style.width = VW + "px"; cv.style.height = VH + "px";
    SCALE = VH / WORLD_H;                       // world height fills the screen height
  }
  window.addEventListener("resize", resize); resize();
  const cam = { x: 0, shake: 0, zoom: 1, kick: 0, ox: 0, oy: 0 };

  /* ---------------- input ---------------- */
  const keys = new Set(); let jumpPressed = false, usePressed = false, slidePressed = false;
  const touch = { dir: 0, jumpHeld: false, sprint: false, crouch: false };
  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "KeyA"].includes(e.code)) { keys.add("l"); e.preventDefault(); }
    if (["ArrowRight", "KeyD"].includes(e.code)) { keys.add("r"); e.preventDefault(); }
    if (["ArrowUp", "KeyW", "Space"].includes(e.code)) { if (!keys.has("j") && state === "playing") jumpPressed = true; keys.add("j"); e.preventDefault(); }
    if (["ShiftLeft", "ShiftRight"].includes(e.code)) { keys.add("s"); e.preventDefault(); }
    if (["KeyC", "ControlLeft", "ArrowDown", "KeyS"].includes(e.code)) { if (!keys.has("c") && state === "playing") slidePressed = true; keys.add("c"); e.preventDefault(); }
    if (e.code === "KeyE" && !e.repeat) { if (state === "playing") usePressed = true; }
    if ((e.code === "Enter" || e.code === "Space") && state === "boat") { nextStory(); e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => {
    if (["ArrowLeft", "KeyA"].includes(e.code)) keys.delete("l");
    if (["ArrowRight", "KeyD"].includes(e.code)) keys.delete("r");
    if (["ArrowUp", "KeyW", "Space"].includes(e.code)) keys.delete("j");
    if (["ShiftLeft", "ShiftRight"].includes(e.code)) keys.delete("s");
    if (["KeyC", "ControlLeft", "ArrowDown", "KeyS"].includes(e.code)) keys.delete("c");
  });
  window.addEventListener("blur", () => { keys.clear(); touch.dir = 0; touch.jumpHeld = false; });

  // virtual stick (left side): drag left/right
  const stick = $("stick"), knob = $("knob"); let stickId = null, stickCx = 0;
  stick.addEventListener("pointerdown", (e) => { stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch (_) {} const r = stick.getBoundingClientRect(); stickCx = r.left + r.width / 2; moveStick(e); e.preventDefault(); });
  stick.addEventListener("pointermove", (e) => { if (e.pointerId === stickId) moveStick(e); });
  const endStick = (e) => { if (e.pointerId !== stickId) return; stickId = null; touch.dir = 0; touch.far = false; knob.style.transform = "translate(-50%,-50%)"; };
  stick.addEventListener("pointerup", endStick); stick.addEventListener("pointercancel", endStick); stick.addEventListener("lostpointercapture", endStick);
  function moveStick(e) {
    const r = stick.getBoundingClientRect(), half = r.width / 2;
    const dx = Math.max(-half, Math.min(half, e.clientX - stickCx));
    knob.style.transform = `translate(calc(-50% + ${dx * 0.7}px), -50%)`;
    touch.dir = Math.abs(dx) < half * 0.22 ? 0 : (dx > 0 ? 1 : -1);
    touch.far = Math.abs(dx) > half * 0.92;
  }
  const jb = $("btn-jump");
  jb.addEventListener("pointerdown", (e) => { jumpPressed = true; touch.jumpHeld = true; try { jb.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
  const jup = () => { touch.jumpHeld = false; };
  jb.addEventListener("pointerup", jup); jb.addEventListener("pointercancel", jup); jb.addEventListener("lostpointercapture", jup);
  $("btn-use").addEventListener("pointerdown", (e) => { usePressed = true; e.preventDefault(); });
  const sb = $("btn-sprint"), cb = $("btn-slide");
  sb.addEventListener("pointerdown", (e) => { touch.sprint = !touch.sprint; sb.classList.toggle("on", touch.sprint); e.preventDefault(); });
  cb.addEventListener("pointerdown", (e) => { slidePressed = true; touch.crouch = true; cb.classList.add("on"); try { cb.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
  const cup = () => { touch.crouch = false; cb.classList.remove("on"); };
  cb.addEventListener("pointerup", cup); cb.addEventListener("pointercancel", cup); cb.addEventListener("lostpointercapture", cup);
  document.addEventListener("gesturestart", (e) => e.preventDefault());

  function readInput() {
    const l = keys.has("l") || touch.dir < 0, r = keys.has("r") || touch.dir > 0;
    // full-stick push on touch sprints automatically, like a Call of Duty Mobile stick
    return { dir: (r ? 1 : 0) - (l ? 1 : 0), jump: jumpPressed, jumpHeld: keys.has("j") || touch.jumpHeld,
             sprint: keys.has("s") || touch.sprint || touch.far, crouch: keys.has("c") || touch.crouch, slide: slidePressed };
  }

  /* ---------------- drawing ---------------- */
  // world transform: base scale, then zoom about the screen centre, then shake and landing kick
  function camT() {
    const s = DPR * SCALE * cam.zoom, cx = cv.width / 2, cy = cv.height * 0.62;
    ctx.setTransform(s, 0, 0, s, cx - cx * cam.zoom + cam.ox * DPR, cy - cy * cam.zoom + cam.oy * DPR);
  }
  const fx = { rain: Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random(), s: .6 + Math.random() })) };

  function drawWorld() {
    const W = VW / SCALE;                                  // visible world width in world units
    const parallaxX = cam.x * 0.0;                          // painting is the main layer; storm layer below drifts
    ctx.save(); camT();
    ctx.fillStyle = "#04100f"; ctx.fillRect(0, 0, VW / SCALE, WORLD_H);
    for (const p of WORLD_PIECES) {
      const img = IMG[p.n]; if (!img.complete || !img.naturalWidth) continue;
      const sx = p.x - cam.x;
      if (sx + p.w < -2 || sx > W + 2) continue;
      if (window.ALIVE) ALIVE.drawPiece(ctx, img, sx, p.w, WORLD_H, game ? game.x : 0, game ? game.y : 0, GROUND_Y, p.x); else ctx.drawImage(img, sx, 0, p.w + 1, WORLD_H);
    }
    if (window.ALIVE) ALIVE.drawOverlay(ctx, W, WORLD_H, cam.x);
    ctx.restore();
  }

  function drawGround() {
    ctx.save(); camT();
    const W = VW / SCALE;
    for (const p of game.platforms()) {
      const sx = p.x - cam.x; if (sx + p.w < -4 || sx > W + 4) continue;
      const lifted = p.y < GROUND_Y - 20;                  // rocks and crates are raised
      // soft painted slab: dark top edge with a faint rim light, fading into the scene
      const g = ctx.createLinearGradient(0, p.y, 0, p.y + (lifted ? 60 : 130));
      g.addColorStop(0, lifted ? "rgba(46,62,60,.96)" : "rgba(10,18,17,.92)"); g.addColorStop(1, "rgba(4,10,9,0)");
      ctx.fillStyle = g; ctx.fillRect(sx, p.y, p.w, lifted ? 60 : 130);
      ctx.fillStyle = lifted ? "rgba(140,200,190,.55)" : "rgba(95,211,196,.18)"; ctx.fillRect(sx, p.y - 1, p.w, 3);
      if (lifted) {
        const faceH = GROUND_Y - p.y;                           // the block's body, down to the ground
        const fg = ctx.createLinearGradient(0, p.y, 0, GROUND_Y); fg.addColorStop(0, "rgba(40,56,54,.96)"); fg.addColorStop(1, "rgba(14,24,23,.96)");
        ctx.fillStyle = fg; ctx.fillRect(sx, p.y, p.w, faceH);
        ctx.fillStyle = "rgba(140,200,190,.5)"; ctx.fillRect(sx, p.y, 4, faceH); ctx.fillRect(sx + p.w - 4, p.y, 4, faceH);   // lit side edges
        ctx.fillStyle = "rgba(0,0,0,.35)"; for (let i = 1; i < 3; i++) ctx.fillRect(sx + 8, p.y + faceH * i / 3, p.w - 16, 3);   // plank or rock seams
      }
    }
    // the broken bridge: show jagged plank stubs on each side until repaired
    if (!game.bridgeRepaired) {
      ctx.fillStyle = "rgba(40,28,18,.95)";
      for (let i = 0; i < 3; i++) { ctx.fillRect(2830 - cam.x - 90 + i * 28, GROUND_Y - 4, 22, 10 + i * 4); ctx.fillRect(3290 - cam.x + 68 - i * 28, GROUND_Y - 4, 22, 10 + i * 4); }
    } else {
      ctx.fillStyle = "rgba(112,78,44,.95)";
      for (let i = 0; i < 20; i++) ctx.fillRect(2830 - cam.x + i * 23, GROUND_Y - 6, 21, 12);
      ctx.fillStyle = "rgba(200,160,100,.5)"; ctx.fillRect(2830 - cam.x, GROUND_Y - 8, 460, 3);
    }
    ctx.restore();
  }

  function drawObjects(t) {
    ctx.save(); camT();
    for (const o of game.objectsHere()) {
      const sx = o.x - cam.x; if (sx < -200 || sx > VW / SCALE + 200) continue;
      const pulse = 0.55 + 0.45 * Math.sin(t / 380);
      const g = ctx.createRadialGradient(sx, o.y, 0, sx, o.y, o.r);
      g.addColorStop(0, `rgba(255,215,122,${0.42 * pulse})`); g.addColorStop(1, "rgba(255,215,122,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, o.y, o.r, 0, 7); ctx.fill();
      // little icon
      ctx.fillStyle = "#ffd77a"; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 3;
      if (o.id === "rope") { ctx.beginPath(); ctx.ellipse(sx, o.y, 26, 14, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(sx, o.y, 16, 8, 0, 0, 7); ctx.stroke(); }
      else if (o.id === "lantern") { ctx.fillRect(sx - 12, o.y - 20, 24, 34); ctx.fillStyle = "#fff1b8"; ctx.fillRect(sx - 7, o.y - 14, 14, 22); }
      else if (o.id === "beacon") { ctx.beginPath(); ctx.arc(sx, o.y, 22, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }

  /* the painted survivor: the same picture, posed by PoseBlender (idle breathing, walk, run, sprint, jump, fall, land, crouch, slide, turn, wall-cling, interact) */
  const pose = new PoseBlender();
  function drawPlayer(dt) {
    const img = IMG["fig_" + chosen]; if (!img.complete || !img.naturalWidth) return;
    const P = pose.update(dt, game);
    const h = PLAYER_H * 1.12, w = h * (img.naturalWidth / img.naturalHeight);
    const px = game.x - cam.x, py = game.y;
    ctx.save(); camT();
    // shadow on whatever you stand on; shrinks as you leave it, widens when you slide
    const lift = game.onGround ? 0 : Math.min(1, (GROUND_Y - game.y) / 300 + 0.2);
    if (!game.inWater) { ctx.fillStyle = `rgba(0,0,0,${0.45 - lift * 0.2})`;
    ctx.beginPath(); ctx.ellipse(px, (game.onGround ? py : GROUND_Y) + 4, (46 + (pose.state === "slide" ? 26 : 0)) * (1 - lift * 0.4) * (1 + P.breathe * 0.01), 9, 0, 0, 7); ctx.fill(); }
    // dust puffs
    for (const d of game.dust) { const a = 1 - d.t / 0.5; ctx.fillStyle = `rgba(190,205,200,${0.35 * a})`; ctx.beginPath(); ctx.arc(d.x - cam.x + (d.t * 40) * (d.x % 2 ? 1 : -1), d.y - 6 - d.t * 30, 10 + d.t * 28, 0, 7); ctx.fill(); }
    // the figure, pivoting at the feet: bob and lift raise it, drop sinks it, lean and sway rotate it, sx and sy squash and stretch it
    ctx.translate(px, py - P.bob - P.lift + P.drop);
    ctx.rotate((P.lean + P.sway) * game.facing);
    if (P.tilt) { ctx.translate(0, -h * 0.4); ctx.rotate(P.tilt); ctx.translate(0, h * 0.4); }
    ctx.scale(game.facing * P.sx, P.sy);
    if (game.inWater) {
      // above the waterline: normal. below it: the same painting, darker and bluer, as if seen through the water
      ctx.drawImage(img, -w / 2, -h, w, h);
    } else ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  /* Water in front of the swimmer: the part below the surface is veiled with the water's own tone (sampled from the painting), with surface ripples and splash droplets. */
  let waterTone = null;
  function sampleWaterTone() {
    // the water's own lit colour, read from the painting: the average of the brightest quarter of the chasm pixels, so the veil is a tone that already exists there
    try {
      const c = document.createElement("canvas"); c.width = 96; c.height = 24; const x = c.getContext("2d", { willReadFrequently: true });
      const p = WORLD_PIECES.find((q) => q.x <= WATER.x0 + 200 && q.x + q.w > WATER.x0 + 200); const img = p && IMG[p.n]; if (!img || !img.naturalWidth) return;
      x.drawImage(img, WATER.x0 + 20 - p.x, 930, WATER.x1 - WATER.x0 - 40, 94, 0, 0, 96, 24); const d = x.getImageData(0, 0, 96, 24).data;
      const px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2], d[i] + d[i + 1] + d[i + 2]]);
      px.sort((a, b) => b[3] - a[3]); const top = px.slice(0, Math.floor(px.length / 4)); let r = 0, g = 0, b = 0; for (const q of top) { r += q[0]; g += q[1]; b += q[2]; }
      waterTone = [Math.round(r / top.length), Math.round(g / top.length), Math.round(b / top.length)];
    } catch (e) { waterTone = [83, 100, 113]; }
  }
  function drawWater(dt, t) {
    if (!game || (!game.inWater && !game.splashes.length)) return;
    if (!waterTone) sampleWaterTone(); const [r, g, b] = waterTone || [36, 49, 55];
    ctx.save(); camT();
    const sy = WATER.surface, px = game.x - cam.x;
    if (game.inWater) {
      // veil over everything below the surface near the swimmer
      const grad = ctx.createLinearGradient(0, sy, 0, sy + 200); grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`); grad.addColorStop(1, `rgba(${r},${g},${b},0.82)`);
      ctx.fillStyle = grad; ctx.fillRect(px - 120, sy, 240, 260);
      // surface line with a gentle wave
      ctx.strokeStyle = `rgba(170,205,210,0.5)`; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = -120; i <= 120; i += 6) { const y = sy + Math.sin((i + t * 90) * 0.06) * 2.2; i === -120 ? ctx.moveTo(px + i, y) : ctx.lineTo(px + i, y); } ctx.stroke();
      // bubbles rise from a diving swimmer
      if (game.submerged) for (let i = 0; i < 5; i++) { const k = ((t * 0.7 + i * 0.21) % 1), bx = px + Math.sin(i * 7 + t * 2) * 14, by = game.y - 40 - k * 140; ctx.strokeStyle = `rgba(190,225,230,${0.55 * (1 - k)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, 2 + i % 3, 0, 7); ctx.stroke(); }
    }
    // ripple rings and droplets from every splash
    for (const s of game.splashes) {
      const a = 1 - s.t / 0.9, sx = s.x - cam.x;
      ctx.strokeStyle = `rgba(185,215,220,${0.6 * a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy + 2, 14 + s.t * 90 * s.k, 3 + s.t * 14 * s.k, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(sx, sy + 2, 8 + s.t * 55 * s.k, 2 + s.t * 8 * s.k, 0, 0, 7); ctx.stroke();
      if (s.k > 0.35) for (let i = 0; i < 9; i++) { const ang = -Math.PI / 2 + (i - 4) * 0.28, v = 150 + (i % 3) * 60, dx = Math.cos(ang) * v * s.t * s.k, dy = Math.sin(ang) * v * s.t * s.k + 520 * s.t * s.t; ctx.fillStyle = `rgba(200,225,228,${0.8 * a})`; ctx.beginPath(); ctx.arc(sx + dx, sy + dy, 2.5 * (1 - s.t / 1.2), 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }
  function drawWeather(dt, t) {
    // rain in screen space, drifting with the camera for parallax
    ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.strokeStyle = "rgba(190,225,235,.3)"; ctx.lineWidth = 1; ctx.beginPath();
    for (const d of fx.rain) {
      d.y += dt * (1.0 + d.s * .7); d.x -= dt * .12 + (game.vx / 60000);
      if (d.y > 1) { d.y = -.05; d.x = Math.random() * 1.15; }
      if (d.x < 0) d.x += 1.1; if (d.x > 1.1) d.x -= 1.1;
      const x = d.x * VW, y = d.y * VH; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 13 * d.s);
    }
    ctx.stroke();
    // foreground mist band for depth, moving faster than the world
    const mx = (-cam.x * SCALE * 1.4) % VW;
    const g = ctx.createLinearGradient(0, VH * 0.82, 0, VH);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,8,8,.55)"); ctx.fillStyle = g; ctx.fillRect(0, VH * 0.82, VW, VH * 0.18);
    ctx.restore();
    if (flash > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(212,242,238,${flash * 0.4})`; ctx.fillRect(0, 0, cv.width, cv.height); ctx.restore(); flash = Math.max(0, flash - dt * 2.2); }
  }

  function updateCamera(dt) {
    // sprint opens the view a little (feels fast); landings kick the camera down and shake it
    const wantZoom = 1 - game.speedFx * 0.06;
    cam.zoom += (wantZoom - cam.zoom) * Math.min(1, dt * 5);
    cam.shake = Math.max(0, cam.shake - dt * 3.2); cam.kick = Math.max(0, cam.kick - dt * 4);
    const sh = cam.shake * cam.shake * 14; cam.ox = (Math.random() - 0.5) * sh; cam.oy = (Math.random() - 0.5) * sh + cam.kick * 16;
    const W = VW / SCALE;
    const lookAhead = game.facing * Math.min(1, Math.abs(game.vx) / game.c.run) * 130;   // camera leads the run
    const want = Math.max(0, Math.min(WORLD_W - W, game.x + lookAhead - W * 0.45));
    cam.x += (want - cam.x) * Math.min(1, dt * 5);
    cam.x = Math.max(0, Math.min(Math.max(0, WORLD_W - W), cam.x));
  }

  /* ---------------- HUD ---------------- */
  function buildHud() {
    $("hud-face").src = `img/${chosen}.jpg`;
    $("hud-name").textContent = `${game.name} (${CHARACTERS[chosen].title})`;
    const en = $("energy"); en.innerHTML = "";
    for (let i = 0; i < game.maxEnergy; i++) { const p = document.createElement("span"); p.className = "pip"; en.appendChild(p); }
  }
  let lastInv = "";
  function placeName() { const x = game.x; return x < 1500 ? (x < 700 ? "Beach" : "Jungle") : x < 2500 ? "Cave" : x < 3290 ? "Old Bridge" : "Lighthouse"; }
  function updateHud() {
    $("hud-loc").textContent = placeName();
    { const bt = $("breath"); const show = game.submerged || game.breath < 5.95; bt.classList.toggle("on", show); bt.classList.toggle("low", game.breath < 2); $("breath-fill").style.transform = `scaleX(${Math.max(0, game.breath / BREATH_MAX)})`; }
    document.querySelectorAll("#energy .pip").forEach((p, i) => p.classList.toggle("full", i < game.energy));
    const k = game.inventory.join(",");
    if (k !== lastInv) { lastInv = k; const inv = $("inventory"); inv.innerHTML = ""; if (!game.inventory.length) inv.innerHTML = '<span class="empty">empty</span>'; game.inventory.forEach((it) => { const t = document.createElement("span"); t.className = "item"; t.textContent = it; inv.appendChild(t); }); }
    $("message").textContent = game.message; $("message").style.opacity = game.message ? 1 : 0;
    const pr = game.over ? "" : game.prompt();
    $("prompt").textContent = pr ? `${pr}  [E]` : ""; $("prompt").style.opacity = pr ? 1 : 0;
    $("btn-use").classList.toggle("ready", !!pr);
    $("goal").textContent = goalText();
  }
  function goalText() {
    if (game.won) return "";
    const R = game.inventory.includes("rope"), L = game.inventory.includes("lantern");
    if (!R) return "Goal: find the rope in the jungle";
    if (!L) return "Goal: climb the crates in the cave for the lantern";
    if (!game.bridgeRepaired) return "Goal: repair the old bridge";
    return "Goal: light the beacon at the lighthouse";
  }

  /* ---------------- boat opening ---------------- */
  const STORY = [
    { img: "boat",    text: "The storm came out of nowhere. Your boat is all that is left, and the sea is winning." },
    { img: "boat",    text: "Through the rain you see a light: a lighthouse on a black island. It flickers, then dies." },
    { img: "landing", text: "The waves throw you onto the sand. Find a rope and a lantern, fix the bridge, and light the beacon." },
  ];
  let storyIdx = 0;
  function showStory() {
    const st = STORY[storyIdx]; $("boat-bg").style.backgroundImage = `url('img/${st.img}.jpg')`;
    const el = $("story-text"); el.textContent = ""; let i = 0; clearInterval(showStory.t);
    showStory.t = setInterval(() => { el.textContent = st.text.slice(0, ++i); if (i >= st.text.length) clearInterval(showStory.t); }, 22);
    $("story-next").textContent = storyIdx === STORY.length - 1 ? "Wake on the beach" : "Continue";
  }
  function nextStory() {
    const st = STORY[storyIdx];
    if ($("story-text").textContent.length < st.text.length) { clearInterval(showStory.t); $("story-text").textContent = st.text; return; }
    if (++storyIdx >= STORY.length) { beginGame(); return; }
    showStory();
  }
  $("story-next").addEventListener("click", () => { audio(); nextStory(); });
  $("story-skip").addEventListener("click", () => { clearInterval(showStory.t); beginGame(); });

  /* ---------------- flow ---------------- */
  function startBoat() { game = new Game(chosen, $("name-input").value.trim()); state = "boat"; storyIdx = 0; show("screen-boat"); showStory(); startStorm(); }
  function beginGame() {
    clearInterval(showStory.t);
    state = "playing"; jumpPressed = usePressed = slidePressed = false; lastInv = "~"; cam.x = 0; lastT = performance.now();
    show("screen-game"); resize(); buildHud(); startAmbience();
    game.say(`${game.name}, find the rope and the lantern. Light the beacon.`, 5); startStorm();
  }
  function endGame() {
    stopStorm(); const title = $("end-title"), text = $("end-text");
    if (game.won) { title.textContent = "YOU WIN!"; title.className = "win"; text.textContent = `The beacon blazes. The rescue boat is coming. You survived the island, ${game.name}.`; $("end-bg").style.backgroundImage = "url('img/title.jpg')"; }
    else { title.textContent = "GAME OVER"; title.className = "lose"; text.textContent = "The island claims another traveler."; $("end-bg").style.backgroundImage = "url('img/world_2.jpg')"; }
    state = "title"; show("screen-end");
  }

  function buildCards() {
    const box = $("cards"); box.innerHTML = "";
    Object.entries(CHARACTERS).forEach(([key, c]) => {
      const card = document.createElement("button"); card.type = "button"; card.className = "card"; card.dataset.key = key;
      card.innerHTML = `<img src="img/${key}.jpg" alt="${c.title}"><span class="c-title">${c.title}</span><span class="c-blurb">${c.blurb}</span><span class="c-perk">${c.perk}</span>`;
      card.addEventListener("click", () => { chosen = key; document.querySelectorAll(".card").forEach((x) => x.classList.toggle("sel", x.dataset.key === key)); $("begin").disabled = false; });
      box.appendChild(card);
    });
  }
  $("start").addEventListener("click", () => { audio(); chosen = null; $("begin").disabled = true; buildCards(); state = "select"; show("screen-select"); });
  $("name-form").addEventListener("submit", (e) => { e.preventDefault(); audio(); if (!chosen) return; if (!$("name-input").value.trim()) { $("name-error").hidden = false; return; } $("name-error").hidden = true; startBoat(); });
  $("quit").addEventListener("click", () => { if (state === "playing") { game.over = true; game.won = false; endGame(); } });
  $("again").addEventListener("click", () => { $("name-input").value = ""; state = "title"; show("screen-title"); });

  /* is the player pressed up against the side of a raised rock or crate? */
  function blockedByBlock(dir) {
    for (const p of game.platforms()) {
      if (p.y >= GROUND_Y - 5) continue;
      const edge = dir > 0 ? p.x - (game.x + PLAYER_W / 2) : (game.x - PLAYER_W / 2) - (p.x + p.w);
      if (edge > -6 && edge < 8) return true;
    }
    return false;
  }

  /* ---------------- loop ---------------- */
  let lastT = performance.now(), hinted = false;
  const STEP = 1 / 120; let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - lastT) / 1000, 0.05); lastT = now;
    if (state !== "playing" && state !== "ending") return;
    if (state === "playing") {
      const input = readInput(); acc += dt;                      // fixed physics step keeps jumps identical on every device
      let first = true;
      while (acc >= STEP) { game.update(STEP, { dir: input.dir, jump: first && input.jump, jumpHeld: input.jumpHeld, sprint: input.sprint, crouch: input.crouch, slide: first && input.slide }); first = false; acc -= STEP; }
      if (!hinted && game.onGround && input.dir !== 0 && Math.abs(game.vx) < 5 && blockedByBlock(input.dir)) { hinted = true; game.say("Jump to climb it. Jump again against its wall to wall-jump.", 5); }
      jumpPressed = false; slidePressed = false;
      updateAmbience(game.speedFx);
      if (usePressed) { game.interact(); usePressed = false; }
      game.events.splice(0).forEach((ev) => {
        if (SFX[ev]) SFX[ev]();
        if (ev === "splash") { cam.shake = Math.max(cam.shake, 0.35); }
        if (ev === "doublejump") { pose.kick("doublejump"); cam.shake = Math.max(cam.shake, 0.12); }
        if (ev === "roll") { cam.shake = Math.max(cam.shake, 0.3); cam.kick = Math.max(cam.kick, 0.5); }
        if (ev === "hang") cam.shake = Math.max(cam.shake, 0.22);
        if (ev === "vault") cam.shake = Math.max(cam.shake, 0.1);
        if (window.ALIVE && (ev === "roll" || ev === "vault" || ev === "mantle" || ev === "doublejump")) ALIVE.disturb(game.x, game.y, 1.2);
        if (ev === "pickup" || ev === "build" || ev === "deny") pose.kick("interact"); if (ev === "tired") pose.kick("hurt");
        if (window.ALIVE) { if (ev === "step") ALIVE.disturb(game.x, game.y, 0.5 + game.speedFx * 0.6); else if (ev === "land") ALIVE.disturb(game.x, game.y, 0.8 + game.hardLand * 1.6); else if (ev === "slide" || ev === "walljump") ALIVE.disturb(game.x, game.y, 1.1); }
        if (ev === "land") { cam.shake = Math.max(cam.shake, 0.25 + game.hardLand * 0.75); cam.kick = Math.max(cam.kick, game.hardLand); }
        if (ev === "walljump") cam.shake = Math.max(cam.shake, 0.35);
        if (ev === "slide") cam.shake = Math.max(cam.shake, 0.2);
        if (ev === "fall") cam.shake = 1;
        if (ev === "win" || ev === "lose") { state = "ending"; setTimeout(endGame, ev === "win" ? 2800 : 2200); }
      });
    }
    if (window.ALIVE && game && (state === "playing" || state === "ending")) ALIVE.update(dt, game, cam.x, VW / SCALE, 0);
    updateCamera(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    drawWorld(); drawGround(); drawObjects(now); drawPlayer(dt); drawWater(dt, now); drawWeather(dt, now); updateHud();
  }
  requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => { lastT = performance.now(); acc = 0; });

  window.__game = { get game() { return game; }, get state() { return state; }, get cam() { return cam; }, get scale() { return SCALE; } };
})();
