/* MYSTERY ISLAND: Stormbound. Engine glue: scene, camera, loop, HUD. Rules: rules.js. Terrain: terrain.js. Controller: player.js. Non-combat. */
import * as THREE from "three";
import { buildWorld } from "./world.js"; import { buildProps } from "./props.js"; import { buildLandmarks } from "./landmarks.js"; import { buildCharacter, poseCharacter } from "./character.js";
import { audioInit, ambience, thunder, SND, setMuted, isMuted, debugLevels } from "./audio.js"; import { createLog, LOG_PAGES } from "./log.js"; import { Save } from "./save.js"; import { createInput } from "./input.js"; import { buildInteractables, nearest } from "./interact.js";
const { Game, SURVIVORS, OBJECTIVES, MAX_HEALTH } = window.SB, { Player } = window.SBP, T = window.SBT, POI = T.POI;
const $ = (id) => document.getElementById(id), clamp = (v, a, b) => Math.min(b, Math.max(a, v)), damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

const canvas = $("gl"), renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
const LOW = matchMedia("(max-width: 820px)").matches || (navigator.hardwareConcurrency || 8) <= 4;
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.5 : 2)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 700);
const W = buildWorld(scene), P = buildProps(scene, W), L = buildLandmarks(scene, W, P); if (LOW) W.sun.shadow.mapSize.set(1024, 1024);
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const input = createInput(canvas);
const klog = createLog({ root: $("logmodal"), body: $("log-body"), title: $("log-title"), date: $("log-date"), count: $("log-count"), prev: $("logprev"), next: $("lognext") });
const toggleLog = () => { if (!game || mode === "title" || mode === "select") return; if (klog.isOpen()) { klog.close(); logClosedAt = performance.now(); paused = false; } else { klog.openAt(); paused = true; if (document.exitPointerLock) document.exitPointerLock(); } SND.click(); };

/* ---------- state ---------- */
let mode = "loading", chosen = "scout", game = null, player = null, avatar = null, avatarK = {}, flashOn = false, t = 0, paused = false, flashT = 0, nextThunder = 6, bolt = 0, inTower = false, towerT = 0, towerFrom = null, shakeT = 0, stepT = 0, beamT = 0, clearT = 0, fallWarn = 0, gustSmooth = 0, sheltered = false, stats = { time: 0, falls: 0 };
const cam = { yaw: Math.PI, pitch: 0.3, dist: 5.4, pos: new THREE.Vector3(), look: new THREE.Vector3() }; let interactables = [], focus = null;
const SENS = 0.0042;

/* ---------- title: slow camera pan along the coast toward the lighthouse ---------- */
function titleCam(dt) { const s = t * 0.045, x = Math.sin(s) * 70 - 10, z = 92 - Math.cos(s * 0.8) * 14; camera.position.set(x, T.height(x, z) + 7 + Math.sin(s * 2) * 1.2, z); camera.lookAt(-4, 24, -92); }

/* ---------- survivor cards: each shows a live 3D preview of its own jointed character ---------- */
function buildCards() {
  const holder = $("cards"); holder.innerHTML = "";
  for (const [key, s] of Object.entries(SURVIVORS)) {
    const b = document.createElement("button"); b.className = "card" + (key === chosen ? " sel" : ""); b.dataset.k = key;
    b.innerHTML = `<canvas width="300" height="300"></canvas><div class="mono mt-2">${s.tag}</div><div class="nm">${s.name}</div>`; holder.appendChild(b);
    b.addEventListener("click", () => { chosen = key; document.querySelectorAll(".card").forEach((c) => c.classList.toggle("sel", c === b)); $("perk").textContent = s.perk; SND.click(); });
  }
  $("perk").textContent = SURVIVORS[chosen].perk;
}
const previews = [];
function initPreviews() {
  for (const card of document.querySelectorAll(".card")) {
    const key = card.dataset.k, cv = card.querySelector("canvas"), r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setSize(300, 300, false); r.setPixelRatio(1);
    const sc = new THREE.Scene(), cm = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cm.position.set(0, 1.15, 4.3); cm.lookAt(0, 0.95, 0);
    sc.add(new THREE.HemisphereLight(0xcfe3ea, 0x1b2a2a, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 3, 3); sc.add(d);
    const ch = buildCharacter(key); sc.add(ch); previews.push({ r, sc, cm, ch, k: {} });
  }
}

/* ---------- starting a run ---------- */
function startGame(saved) {
  audioInit(); const restored = saved ? Game.restore(saved) : null; if (restored) chosen = restored.key; const s = SURVIVORS[chosen]; game = restored || new Game(chosen); if (!restored) klog.setUnlocked([]);
  const sp = POI.spawn; player = new Player(sp.x, sp.z, { sprint: s.sprint, jump: s.jump, crouch: s.crouch }, W.colliders); player.yaw = Math.PI; cam.yaw = 0; cam.pitch = 0.32;
  if (avatar) scene.remove(avatar); avatar = buildCharacter(chosen); avatar.userData.lightBoost = s.light; scene.add(avatar); avatarK = {}; flashOn = false; inTower = false; stats = { time: 0, falls: 0 };
  // reset the world's one-way changes so Play Again starts fresh
  L.items.ropePickup.visible = true; L.items.hangingRope.visible = false; L.items.keyObj.visible = true; L.items.journalObj.visible = true; L.items.fuel1.visible = true; L.items.fuel2.visible = true;
  L.items.lhDoor.rotation.y = 0; if (L.items._doorPos) L.items.lhDoor.position.copy(L.items._doorPos); else L.items._doorPos = L.items.lhDoor.position.clone();
  L.items.beam.visible = false; L.items.beamSpot.intensity = 0; L.lights.gen.intensity = 0; L.lights.cabin.intensity = 0; L.items.genLamp.material.emissiveIntensity = 0; L.items.lampGlass.material.emissiveIntensity = 0; clearT = 0; beamT = 0; bolt = 0;
  interactables = buildInteractables(L, game, ctx); buildInv(); if (restored) applySaved(saved); $("hud").classList.remove("hidden"); $("touch").classList.toggle("hidden", !(input.touchOn || matchMedia("(pointer:coarse)").matches));
  document.body.classList.add("playing"); mode = "play"; paused = false; toast(restored ? "Welcome back. Your progress was restored." : "The boat is gone. The island is all you have. Find the rope.", 5200); SND.click(); lastSaved = 0; persist(true);
}
const ctx = {
  sfx: (n) => SND[n] && SND[n](), startClimb: () => { const lo = { x: player.x, z: player.z, y: player.y }, hi = { x: POI.anchor.x, z: T.WALL_Z - 5, y: T.height(POI.anchor.x, T.WALL_Z - 5) }; player.startClimb(lo, hi); },
  startTower: () => { towerFrom = { x: player.x, z: player.z }; inTower = true; towerT = 0; },
  generatorOn: () => { L.lights.gen.intensity = 14; L.items.genLamp.material.emissiveIntensity = 3; L.lights.cabin.intensity = 5; document.body.classList.add("power"); },
  beaconOn: () => { beamT = 0.001; L.items.beam.visible = true; L.items.lampGlass.material.emissiveIntensity = 2.4; },
  showJournal: () => { klog.unlock(["p2", "p3", "p4", "p5"]); persist(true); setTimeout(() => { klog.openAt("p2"); paused = true; if (document.exitPointerLock) document.exitPointerLock(); }, 450); },
  notePage: (id, msg) => { klog.unlock([id]); persist(true); setTimeout(() => { if (mode === "play") toast(msg, 4200); }, 2600); }          // after the pickup message has been read
};

/* ---------- HUD ---------- */
const INV = [["rope", "🪢", "ROPE"], ["key", "🗝️", "KEY"], ["fuel", "⛽", "FUEL"], ["journal", "📖", "JOURNAL"]];
function buildInv() { $("inv").innerHTML = INV.map(([k, ic, nm]) => `<div class="slot" id="slot-${k}">${ic}<small>${nm}</small><b id="n-${k}"></b></div>`).join(""); }
function hud() {
  const o = OBJECTIVES[Math.min(game.objectiveIndex, 3)]; $("objective").textContent = `${Math.min(game.objectiveIndex + 1, 4)}/4  ${o.title}`; $("objhint").textContent = o.hint;
  let h = ""; for (let i = 0; i < MAX_HEALTH; i++) h += `<span class="${i < game.health ? "on" : "off"}">♥</span>`; $("hearts").innerHTML = h;
  const sp = $("stam"); sp.style.width = game.stamina + "%"; sp.classList.toggle("low", game.stamina < 20); $("warm").style.width = game.warmth * 100 + "%"; $("warm").classList.toggle("low", game.warmth < 0.25);
  for (const [k] of INV) { const has = k === "fuel" ? game.inv.fuel > 0 : game.inv[k]; $("slot-" + k).classList.toggle("has", !!has); $("n-" + k).textContent = k === "fuel" && game.inv.fuel > 0 ? "×" + game.inv.fuel : ""; }
  const pr = $("prompt"); if (focus) { pr.classList.remove("hidden"); $("prompt-text").textContent = typeof focus.label === "function" ? focus.label() : focus.label; } else pr.classList.add("hidden");
  $("cold").style.boxShadow = `inset 0 0 ${60 + (1 - game.warmth) * 120}px ${(1 - game.warmth) * 40}px rgba(120,180,240,${(1 - game.warmth) * 0.55})`; $("vignette").style.opacity = game.health <= 2 ? 1 : 0.7;
}
let toastT = 0; function toast(msg, ms = 3200) { const el = $("toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), ms); }

/* ---------- camera: orbit behind the player, pulled in when terrain or trees would block the view ---------- */
function updateCamera(dt) {
  const [lx, ly] = input.takeLook(); cam.yaw -= lx * SENS; cam.pitch = clamp(cam.pitch + ly * SENS, -0.25, 1.15);
  const look = new THREE.Vector3(player.x, player.y + (player.crouching ? 1.0 : 1.5), player.z);
  const want = cam.dist * (player.sprinting ? 1.12 : 1) * (player.swimming ? 0.9 : 1); let d = want;
  const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  for (let s = 0.6; s <= want; s += 0.4) { const x = look.x + dir.x * s, y = look.y + dir.y * s, z = look.z + dir.z * s; if (y < T.height(x, z) + 0.35) { d = Math.max(1.1, s - 0.5); break; } }
  cam.dist = damp(cam.dist, 5.4, 2, dt); const k = d < cam.curD || !cam.curD ? 30 : 7; cam.curD = damp(cam.curD || d, d, k, dt);
  const sh = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 0.18 : 0;
  const target = new THREE.Vector3(look.x + dir.x * cam.curD + sh, look.y + dir.y * cam.curD + sh, look.z + dir.z * cam.curD);
  const gh = T.height(target.x, target.z) + 0.4; if (target.y < gh) target.y = gh; if (W.seaLevelAt && target.y < 0.2 && T.height(target.x, target.z) < 0) target.y = Math.max(target.y, 0.3);
  cam.pos.lerp(target, 1 - Math.exp(-(mode === "play" ? 40 : 6) * dt)); camera.position.copy(cam.pos); camera.lookAt(look);
  const fovT = 66 + (player.sprinting ? 7 : 0) + (inTower ? -4 : 0); camera.fov = damp(camera.fov, fovT, 6, dt); camera.updateProjectionMatrix();
}

/* ---------- one gameplay step ---------- */
function step(dt) {
  if (game.over) { endTick(dt); return; }
  stats.time += dt; input.poll();
  if (input.consume("flashEdge")) { flashOn = !flashOn; SND.click(); }
  const sp = SURVIVORS[chosen];
  // movement is camera-relative: rotate the input axes by the camera yaw
  const fx = input.fx, fz = input.fz, c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
  const mvx = fx * c + fz * s, mvz = -fx * s + fz * c;                 // world-space move vector; forward input is fz = -1
  const wantsSprint = input.sprint && Math.hypot(fx, fz) > 0.1; const jumpNow = input.consume("jumpEdge");
  if (!inTower && !player.climbing) {
    const stamina = { ok: game.stamina > 1 && game.exhausted <= 0 };
    player.update(dt, { fx: mvx, fz: mvz, jump: jumpNow, sprint: wantsSprint, crouch: input.crouch }, stamina);
    if (player.jumped) { game.useStamina(6); SND.jump(); }
    if (player.sprinting) game.useStamina(14 * dt); else game.regenStamina(dt, Math.hypot(fx, fz) > 0.1);
    if (Math.hypot(fx, fz) > 0.1) player.yaw = lerpAngle(player.yaw, Math.atan2(mvx, mvz), 1 - Math.exp(-14 * dt));   // face the way you move
  } else if (player.climbing) { player.update(dt, { fx: 0, fz: 0 }, { ok: true }); game.useStamina(0); if (player.climbDone) { player.climbDone = false; toast("You reach the cliff top. The keeper's cabin is just ahead."); } }
  // landing: fall damage, splash, thump
  if (player.justLanded > 0.24) { const drop = player.landed; if (drop > 1.5) { SND.land(drop); shakeT = clamp(drop / 10, 0.1, 0.9); } const hearts = game.land(drop, false); if (hearts) { SND.hurt(); shakeT = 1; stats.falls++; toast(hearts > 1 ? "A brutal fall. You are badly hurt." : "You land hard."); } player.justLanded = 0; player.landed = 0; }
  if (player.splash) { SND.splash(); player.splash = 0; if (player.vy < -6) shakeT = 0.3; }
  if (player.swimming && player.fallStart - player.y > 5) player.fallStart = player.y;
  // footsteps
  if (player.onGround && player.speed > 1.2) { stepT -= dt * player.speed; if (stepT <= 0) { stepT = 2.6; SND.step(player.sprinting, surfaceAt(player)); } } else stepT = 0;
  // weather hazards: shelter = inside the cabin or shed footprint, or in the lamp room
  const nearGen = game.flags.generatorOn && Math.hypot(player.x - POI.shed.x, player.z - POI.shed.z) < 9; sheltered = inTower || inBuilding(player, POI.cabin, 3.8, 3) || inBuilding(player, POI.shed, 3.2, 2.7);
  game.tickWeather(dt, !sheltered && !player.swimming, nearGen);
  const gust = window.SB.Game.gust(game.time); gustSmooth = damp(gustSmooth, gust, 4, dt); if (gust > 0.7 && !sheltered && !game._gustWarned) { game._gustWarned = true; toast(game.warmth < 0.6 ? "The cold is getting to you. Find shelter." : "A cold gust rolls in. Get out of the wind."); } if (gust < 0.1) game._gustWarned = false;
  if (gust > 0.3 && !sheltered && player.onGround) { const push = gust * 0.9 / sp.endure; player.x += Math.sin(1.1) * push * dt; player.z += Math.cos(1.1) * push * dt; }
  // interact prompt + press
  focus = nearest(interactables, player, sp.scan, inTower); const useNow = input.consume("useEdge");
  if (useNow && !player.climbing && !inTower) avatarK.reach = 1;                          // E always plays the reach animation, even with nothing in range
  if (focus && useNow && !player.climbing) { const msg = focus.act(); if (msg) toast(msg, focus.id === "cabin" ? 3000 : 3600); }
  else if (useNow && !focus) SND.click();
  if (game.objectiveIndex !== lastObj) { lastObj = game.objectiveIndex; persist(true); } else persist(false);
  if (inTower) towerTick(dt);
  if (game.won) beginWin();
  if (game.over && !game.won) beginLose();
}
function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; }
function inBuilding(p, c, hx, hz) { return Math.abs(p.x - c.x) < hx && Math.abs(p.z - c.z) < hz && p.y < T.height(c.x, c.z) + 4; }
function surfaceAt(p) { const h = p.y; if (h < 2 && p.z > 40) return "sand"; if (inBuilding(p, POI.cabin, 3.8, 3)) return "wood"; return T.height(p.x, p.z) > 12 ? "rock" : "grass"; }

/* the lighthouse stair: a scripted spiral up the tower, then you stand at the lamp */
function towerTick(dt) {
  towerT = Math.min(1, towerT + dt / 4.2); const e = towerT * towerT * (3 - 2 * towerT), a = e * Math.PI * 7, r = 2.1, c = POI.lighthouse, top = L.items.lhTopY - T.height(c.x, c.z) + 0.6;
  if (towerT < 1) { player.x = c.x + Math.sin(a) * r * (1 - e * 0.35); player.z = c.z + Math.cos(a) * r * (1 - e * 0.35); player.y = T.height(c.x, c.z) + 0.2 + e * (top - 0.2); player.vx = player.vz = 0; player.speed = 3; cam.yaw = lerpAngle(cam.yaw, a + Math.PI, 0.05); }
  else { player.x = c.x + 0.4; player.z = c.z + 0.6; player.y = T.height(c.x, c.z) + top; player.speed = 0; }
}
/* ending: beam sweeps, storm clears; or a quiet game over */
function beginWin() { if (mode === "end") return; mode = "ending"; SND.win(); clearT = 0; endAt = performance.now() + 7000; toast("The beam sweeps the sea. The storm breaks.", 6000); }
function beginLose() { if (mode === "end") return; mode = "ending"; endAt = performance.now() + 1800; }
let endAt = 0;
function endTick(dt) {
  if (mode === "ending" && performance.now() > endAt) { mode = "end"; showEnd(); }
}
function showEnd() {
  if (game.won) { Save.markComplete(chosen, Math.round(stats.time)); } else { Save.clear(); }
  const won = game.won, m = Math.floor(stats.time / 60), s = Math.floor(stats.time % 60); $("end").classList.remove("hidden"); document.exitPointerLock && document.exitPointerLock();
  $("end-kicker").textContent = won ? "THE BEACON BURNS" : "THE ISLAND WINS THIS TIME"; $("end-title").textContent = won ? "The storm is over." : "You couldn't hold on.";
  $("end-text").textContent = won ? "The lighthouse sweeps the black water, and far off on the mainland, somebody sees it." : "Cold and bruises caught up with you. Wash ashore again and try a different route.";
  $("end-stats").textContent = `${SURVIVORS[chosen].name}  •  ${m}m ${String(s).padStart(2, "0")}s  •  ${stats.falls} hard fall${stats.falls === 1 ? "" : "s"}  •  ${game.health}/5 hearts`;
}

/* ---------- world animation: storm, thunder, lights, beam, clearing sky ---------- */
function worldTick(dt) {
  W.animated.forEach((f) => f(t, dt)); const gust = game ? gustSmooth : 0.2, wind = gust; W.windU.uWind.value = wind * 2.2; W.windU.uTime.value = t;
  const cl = clearT; // 0 storm .. 1 clear
  const dark = 1 - cl * 0.7; W.hemi.intensity = (0.85 + bolt * 2) * (0.7 + cl * 0.7); W.sun.intensity = (1.4 + bolt * 3) * (0.6 + cl * 0.9);
  scene.fog.density = 0.0085 * (1 - cl * 0.55); scene.background.setRGB(0.11 + cl * 0.2, 0.165 + cl * 0.22, 0.19 + cl * 0.3 + bolt * 0.3); scene.fog.color.copy(scene.background); renderer.toneMappingExposure = 1.1 + bolt * 0.4;
  W.rain.material.opacity = 0.45 * (1 - cl); W.rain.visible = cl < 0.98;
  nextThunder -= dt; if (nextThunder <= 0 && cl < 0.5) { nextThunder = 9 + Math.random() * 16; bolt = 1; flashT = 0; setTimeout(thunder, 500 + Math.random() * 1400); } bolt = Math.max(0, bolt - dt * 3.2); W.flash.intensity = bolt * 1200;
  if (beamT > 0) { beamT += dt; L.items.beam.rotation.y += dt * 0.9; L.items.beamSpot.intensity = Math.min(1, beamT) * 9000; clearT = clamp(beamT / 7, 0, 1); }
  if (L.items.lampGlass.material.emissiveIntensity > 0 && beamT === 0) L.items.lampGlass.material.emissiveIntensity = 0;
  ambience(gust, 1 - cl, clamp(1 - Math.max(0, T.height(player ? player.x : 0, player ? player.z : 80)) / 3, 0, 1) * (player && player.z > 60 ? 1 : 0.3), cl > 0.5 || sheltered, genHumLevel(), t);
}

/* generator hum: loudest beside the shed, still faintly audible across the island once it runs */
function genHumLevel() { if (!game || !game.flags.generatorOn || !player) return 0; const d = Math.hypot(player.x - POI.shed.x, player.z - POI.shed.z); return clamp(1.15 - d / 70, 0.12, 1); }
/* ---------- main loop ---------- */
let last = performance.now(); const clock = { acc: 0 };
function frame(now) {
  requestAnimationFrame(frame); let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mode === "loading") return;
  if (!paused) t += dt; if (paused || mode === "title" || mode === "select") frame.prev = now;
  if (mode === "title" || mode === "select") { W.animated.forEach((f) => f(t, dt)); W.windU.uTime.value = t; W.windU.uWind.value = 0.5 + Math.sin(t * 0.3) * 0.3; titleCam(dt); W.rain.position.set(camera.position.x, camera.position.y - 4, camera.position.z); W.updateRain(dt, camera.position, 0.5); nextThunder -= dt; if (nextThunder <= 0) { nextThunder = 8 + Math.random() * 8; bolt = 1; } bolt = Math.max(0, bolt - dt * 3); W.flash.intensity = bolt * 900; for (const p of previews) { p.k.phase = (p.k.phase || 0) + dt; p.ch.rotation.y = Math.sin(t * 0.7) * 0.55 + 0.25; poseCharacter(p.ch, { speed: 0, onGround: true, swimming: false, climbing: false, crouching: false, sprinting: false, justLanded: 0 }, t, dt, false, p.k); p.r.render(p.sc, p.cm); } }
  else if (game) {
    if (klog.isOpen() || performance.now() < logClosedAt + 400) input.pauseEdge = false;   // Esc / P belong to the log while it is open, and for a moment after it closes
    if (input.consume("pauseEdge") && (mode === "play")) { paused = !paused; $("help").classList.toggle("hidden", !paused); if (paused && document.exitPointerLock) document.exitPointerLock(); }
    if (!paused) { if (mode === "play" || mode === "ending") { /* fixed sub-steps: a slow frame still advances the game by real time, in small physics-safe slices */ let rem = Math.min(0.25, (now - (frame.prev || now)) / 1000 || dt); for (let n = 0; rem > 1e-4 && n < 8; n++) { const h = Math.min(rem, 1 / 60); step(h); rem -= h; } } frame.prev = now; worldTick(dt); updateCamera(dt); shakeT = Math.max(0, shakeT - dt * 2.4);
      avatar.position.set(player.x, player.y, player.z); avatar.rotation.y = player.yaw; avatar.userData.lightBoost = SURVIVORS[chosen].light; poseCharacter(avatar, player, t, dt, flashOn, avatarK); avatar.visible = true;
      W.updateRain(dt, camera.position, gustSmooth); W.sun.position.set(player.x - 60, player.y + 90, player.z + 40); W.sun.target.position.set(player.x, player.y, player.z); W.sun.target.updateMatrixWorld(); hud(); }
  }
  renderer.render(scene, camera);
}

/* ---------- save / resume ---------- */
let lastSaved = 0, lastObj = 0, logClosedAt = 0;
const CHECKPOINTS = { 0: "beach", 1: "ruins", 2: "cabin", 3: "shed" };
function checkpointPos(game) {          // where to stand when resuming: the start of the current objective, never mid-air or inside the cliff
  const o = game.objectiveIndex, P = POI;
  if (o >= 3 && game.flags.generatorOn) return { x: P.lighthouse.x + 2, z: P.lighthouse.z + 9 };
  if (o >= 2) return { x: P.cabin.x + 1.4, z: P.cabin.z + 4.5 };
  if (o === 1) return { x: P.anchor.x, z: P.anchor.z + 5 };
  return { x: P.spawn.x, z: P.spawn.z };
}
function persist(force) {
  if (!game || game.over || game.won) return; const now = performance.now(); if (!force && now - lastSaved < 4000) return; lastSaved = now;
  const s = game.snapshot(); s.logPages = klog.unlocked(); s.at = checkpointPos(game); s.stats = { falls: stats.falls }; Save.write(s);
}
function applySaved(d) {                 // replay the one-way changes so the world matches the progress, then stand at the checkpoint
  const f = game.flags, I = L.items; klog.setUnlocked(d.logPages || []); stats.falls = (d.stats && d.stats.falls) || 0; stats.time = game.time;
  if (game.inv.rope || f.ropeAnchored) I.ropePickup.visible = false; if (f.ropeAnchored) I.hangingRope.visible = true;
  if (f.cabinSearched) { I.keyObj.visible = false; I.journalObj.visible = false; } if (game.fuelFound.beach) I.fuel1.visible = false; if (game.fuelFound.cabin) I.fuel2.visible = false;
  if (f.generatorOn) ctx.generatorOn(); if (f.lighthouseOpen) { I.lhDoor.rotation.y = -1.7; I.lhDoor.position.x += 0.7; I.lhDoor.position.z += 0.5; }
  const at = checkpointPos(game); player.x = at.x; player.z = at.z; player.y = T.height(at.x, at.z); player.vx = player.vz = player.vy = 0; player.onGround = true; player.fallStart = player.y;
  const face = game.objectiveIndex >= 2 ? Math.PI : 0; cam.yaw = face; cam.pos.set(player.x, player.y + 3, player.z + 5);
}
function showResume(d) {
  const o = OBJECTIVES[Math.min(Math.max(0, (Game.restore(d) || { objectiveIndex: 0 }).objectiveIndex), 3)], sv = SURVIVORS[d.key];
  $("resume-title").textContent = sv.name; $("resume-text").textContent = `Objective ${Math.min((Game.restore(d) || { objectiveIndex: 0 }).objectiveIndex + 1, 4)}/4: ${o.title}. ${d.health}/5 hearts.`; show("resume");
  $("resume-go").onclick = () => { show(null); previews.length = 0; startGame(d); }; $("resume-new").onclick = () => { Save.clear(); mode = "select"; show("select"); buildCards(); initPreviews(); };
}
/* mute + log buttons and shortcuts */
function syncMute() { const m = isMuted(); $("mutebtn").setAttribute("aria-pressed", m ? "true" : "false"); $("mutebtn").setAttribute("aria-label", m ? "Unmute sound" : "Mute sound"); $("muteicon").textContent = m ? "🔇" : "🔊"; }
function toggleMute() { audioInit(); setMuted(!isMuted()); syncMute(); }
$("mutebtn").addEventListener("click", toggleMute); $("logbtn").addEventListener("click", toggleLog); $("logclose").addEventListener("click", toggleLog); $("logprev").addEventListener("click", () => { klog.flip(-1); SND.click(); }); $("lognext").addEventListener("click", () => { klog.flip(1); SND.click(); });
addEventListener("keydown", (e) => { if (e.repeat) return; if (e.code === "KeyM") toggleMute(); if (e.code === "KeyL") toggleLog(); if ((e.code === "Escape" || e.code === "KeyP") && klog.isOpen()) { klog.close(); logClosedAt = performance.now(); paused = false; input.pauseEdge = false; } });
syncMute();
/* ---------- screens ---------- */
function show(id) { for (const s of ["title", "select", "help", "end", "loading", "resume"]) $(s).classList.toggle("hidden", s !== id); }
$("deploy").addEventListener("click", () => { audioInit(); SND.click(); const sv = Save.read(); if (sv && !sv.complete && Game.restore(sv)) { mode = "select"; showResume(sv); return; } mode = "select"; show("select"); buildCards(); initPreviews(); if (sv && sv.complete && SURVIVORS[sv.key]) $("perk").textContent = `You lit the beacon as ${SURVIVORS[sv.key].name}. Pick someone new for a different route.`; });
$("enter").addEventListener("click", () => { show(null); previews.length = 0; startGame(); });
$("again").addEventListener("click", () => { $("end").classList.add("hidden"); klog.close(); mode = "select"; document.body.classList.remove("playing", "power"); $("hud").classList.add("hidden"); if (avatar) avatar.visible = false; clearT = 0; beamT = 0; show("select"); buildCards(); initPreviews(); });
$("helpbtn").addEventListener("click", () => { paused = true; $("help").classList.remove("hidden"); });
$("helpclose").addEventListener("click", () => { paused = false; $("help").classList.add("hidden"); });
addEventListener("blur", () => { if (mode === "play") { paused = true; $("help").classList.remove("hidden"); } });
requestAnimationFrame(() => { mode = "title"; show("title"); }); requestAnimationFrame(frame);
window.__sb = { audio: debugLevels, get avatar() { return avatar; }, get avatarK() { return avatarK; }, klog, get game() { return game; }, get player() { return player; }, get mode() { return mode; }, get inTower() { return inTower; }, cam, input, scene, camera, W, L, T, startGame, setChosen: (k) => (chosen = k), get focus() { return focus; }, get paused() { return paused; }, interact: () => { input.useEdge = true; }, ctx };
