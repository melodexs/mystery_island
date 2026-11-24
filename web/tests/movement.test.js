/* Movement tests for the real Game class. Run: node web/tests/movement.test.js */
const fs = require("fs"), path = require("path");
global.window = global;
eval(fs.readFileSync(path.join(__dirname, "../world.js"), "utf8") + "\nglobalThis.Game=Game; globalThis.GROUND_Y=GROUND_Y; globalThis.PLATFORMS=PLATFORMS; globalThis.PLAYER_W=PLAYER_W; globalThis.WORLD_W=WORLD_W;");

let pass = 0, fail = 0;
const ok = (n, c, i = "") => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n + (i !== "" ? "  [" + i + "]" : "")); };
const STEP = 1 / 120;
function mk(ch = "castaway", x = 3400, y = GROUND_Y) { const g = new Game(ch, "T"); g.x = x; g.y = y; for (let i = 0; i < 30; i++) g.update(STEP, {}); return g; }
function run(g, secs, inp, until) { const out = { events: [] }; const n = Math.round(secs / STEP); for (let i = 0; i < n; i++) { g.update(STEP, { ...inp, jump: inp.jump && i === 0, slide: inp.slide && i === 0 }); out.events.push(...g.events.splice(0)); if (until && until(g)) { out.stoppedAt = i * STEP; break; } } return out; }

// ---------- double jump ----------
{
  const g = mk(); g.update(STEP, { jump: true, jumpHeld: true }); run(g, 0.25, { jumpHeld: true });   // first jump, rising
  const h1 = GROUND_Y - g.y; const e = []; g.update(STEP, { jump: true, jumpHeld: true }); e.push(...g.events.splice(0));
  ok("double jump fires in the air", e.includes("doublejump"), e.join());
  let top = g.y; for (let i = 0; i < 400; i++) { g.update(STEP, { jumpHeld: true }); top = Math.min(top, g.y); g.events.length = 0; }
  ok("double jump gains extra height", GROUND_Y - top > h1 + 60, "first-jump height " + h1.toFixed(0) + " peak " + (GROUND_Y - top).toFixed(0));
  const g2 = mk(); g2.update(STEP, { jump: true, jumpHeld: true }); run(g2, 0.25, { jumpHeld: true }); g2.update(STEP, { jump: true, jumpHeld: true }); g2.events.length = 0; run(g2, 0.1, { jumpHeld: true });
  g2.update(STEP, { jump: true, jumpHeld: true }); ok("no triple jump", !g2.events.includes("doublejump"));
  const g3 = mk(); g3.update(STEP, { jump: true, jumpHeld: true }); run(g3, 3, {}); ok("lands again after double jump", g3.onGround);
  g3.update(STEP, { jump: true, jumpHeld: true }); run(g3, 0.25, { jumpHeld: true }); const e3 = []; g3.update(STEP, { jump: true, jumpHeld: true }); e3.push(...g3.events.splice(0)); ok("double jump restored after landing", e3.includes("doublejump"));
  const g4 = mk(); g4.update(STEP, { jump: true, jumpHeld: true }); ok("ground jump is not counted as a double jump", !g4.events.includes("doublejump"));
}

// ---------- roll ----------
{
  const g = mk(); g.y = GROUND_Y - 520; g.onGround = false; g.vy = 0;
  const o = run(g, 1.5, { dir: 1 }); ok("hard landing while moving triggers a roll", o.events.includes("roll"), o.events.filter((x) => x === "roll").length + "x");
  const g2 = mk(); g2.y = GROUND_Y - 520; g2.onGround = false; g2.vy = 0; run(g2, 1.5, {}, (q) => q.onGround); ok("a still landing does not roll", !g2.rolling);
  const g3 = mk(); g3.y = GROUND_Y - 520; g3.onGround = false; g3.vy = 0; let rolled = false, minV = 1e9, maxV = 0;
  for (let i = 0; i < 400; i++) { g3.update(STEP, { dir: 1 }); if (g3.events.splice(0).includes("roll")) rolled = true; if (rolled && g3.rolling > 0) { minV = Math.min(minV, g3.vx); maxV = Math.max(maxV, g3.vx); } }
  ok("rolling keeps momentum forward (vx > 300 throughout)", rolled && minV > 300, "min " + minV.toFixed(0) + " max " + maxV.toFixed(0));
  const g4 = mk(); g4.y = GROUND_Y - 520; g4.onGround = false; g4.vy = 0; run(g4, 2.2, { dir: 1 }); ok("roll ends and the player returns to normal control", g4.rolling === 0 && g4.onGround);
}

// ---------- ledge hang, climb-up, drop ----------
const crate2 = PLATFORMS.find((p) => p.id === "crate2");     // x 2040, top GROUND_Y-220 (a 220 high block: needs a hang)
{
  const g = mk("castaway", crate2.x - 60, GROUND_Y - 140); g.onGround = false; g.vy = -100;
  let hung = false; for (let i = 0; i < 200 && !hung; i++) { g.update(STEP, { dir: 1, jumpHeld: true }); if (g.events.splice(0).includes("hang")) hung = true; }
  ok("falling toward a high ledge grabs it", hung && g.hang, g.hang ? "hanging at y " + g.y.toFixed(0) : "no hang");
  const y0 = g.y; run(g, 1, {}); ok("a hang holds in place (no sliding)", g.hang && Math.abs(g.y - y0) < 0.01 && g.vx === 0);
  const e = []; g.update(STEP, { jump: true }); e.push(...g.events.splice(0)); ok("jump while hanging starts a climb", e.includes("climb") && g.climbing > 0);
  run(g, 0.8, {}); ok("the climb ends standing on top of the block", g.onGround && Math.abs(g.y - crate2.y) < 0.5 && g.x >= crate2.x && g.x <= crate2.x + crate2.w, "x " + g.x.toFixed(0) + " y " + g.y.toFixed(0));
  const g2 = mk("castaway", crate2.x - 60, GROUND_Y - 140); g2.onGround = false; g2.vy = -100; for (let i = 0; i < 200 && !g2.hang; i++) { g2.update(STEP, { dir: 1, jumpHeld: true }); g2.events.length = 0; }
  const e2 = []; g2.update(STEP, { crouch: true }); e2.push(...g2.events.splice(0)); ok("crouch while hanging lets go", e2.includes("drop") && !g2.hang); run(g2, 2, {}); ok("after letting go the player lands on the ground", g2.onGround && g2.y === GROUND_Y);
}
{ // the climb must be smooth: no teleport
  const g = mk("castaway", crate2.x - 60, GROUND_Y - 140); g.onGround = false; g.vy = -100; for (let i = 0; i < 200 && !g.hang; i++) { g.update(STEP, { dir: 1, jumpHeld: true }); g.events.length = 0; }
  g.update(STEP, { jump: true }); let px = g.x, py = g.y, worst = 0; for (let i = 0; i < 100; i++) { g.update(STEP, {}); worst = Math.max(worst, Math.hypot(g.x - px, g.y - py)); px = g.x; py = g.y; }
  ok("climb moves smoothly (max step < 12 units per 1/120s)", worst < 12, worst.toFixed(2));
}

// ---------- vault ----------
const rock1 = PLATFORMS.find((p) => p.id === "rock1");       // x 560 w 190, top GROUND_Y-110 (too high to vault, only to jump onto)
{
  // there is no low block in the level yet; add one to test the vault logic, then remove it
  const low = { id: "testlow", x: 1000, w: 90, y: GROUND_Y - 55 }; PLATFORMS.push(low);
  const g = mk("castaway", 700, GROUND_Y); const o = run(g, 3, { dir: 1, sprint: true }, (q) => q.x > 1200);
  PLATFORMS.splice(PLATFORMS.indexOf(low), 1);
  ok("running into a low block vaults it", o.events.includes("vault"), o.events.filter((x) => x === "vault").length + "x");
  ok("the vault carries you past the block", g.x > 1100, "x " + g.x.toFixed(0));
  ok("you land back on the ground after a vault", g.onGround && g.y === GROUND_Y, g.y);
  const low2 = { id: "testlow2", x: 1000, w: 90, y: GROUND_Y - 55 }; PLATFORMS.push(low2);
  const g2 = mk("castaway", 700, GROUND_Y); const o2 = run(g2, 3, { dir: 1 }, (q) => q.x > 1200); PLATFORMS.splice(PLATFORMS.indexOf(low2), 1);
  ok("walking slowly into a low block still passes it (mantle or vault)", g2.x > 1100 || o2.events.includes("mantle") || o2.events.includes("vault"), "x " + g2.x.toFixed(0));
}

// ---------- invariants over random play ----------
{
  let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let bad = 0, stuck = 0, offmap = 0;
  for (let trial = 0; trial < 30; trial++) {
    const g = mk(["castaway", "explorer", "sailor", "scavenger"][trial % 4], 250 + rnd() * 3500, GROUND_Y);
    let still = 0, lastX = g.x;
    for (let i = 0; i < 120 * 12; i++) {
      const inp = { dir: rnd() < 0.4 ? 0 : rnd() < 0.5 ? 1 : -1, sprint: rnd() < 0.3, jump: rnd() < 0.02, jumpHeld: rnd() < 0.5, crouch: rnd() < 0.05, slide: rnd() < 0.01 };
      g.update(STEP, inp); g.events.length = 0; if (g.over) break;
      if (![g.x, g.y, g.vx, g.vy].every(Number.isFinite)) bad++;
      if (g.x < 0 || g.x > WORLD_W) offmap++;
      if (g.onGround && g.y > GROUND_Y + 1) bad++;
    }
  }
  ok("random play: no NaN, no underground, no leaving the map", bad === 0 && offmap === 0, "bad " + bad + " offmap " + offmap);
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
