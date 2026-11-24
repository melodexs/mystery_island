/* Water and swimming tests for the real Game class. Run: node web/tests/water.test.js */
const fs = require("fs"), path = require("path"); global.window = global;
eval(fs.readFileSync(path.join(__dirname, "../world.js"), "utf8") + "\nglobalThis.Game=Game;globalThis.GROUND_Y=GROUND_Y;globalThis.WATER=WATER;globalThis.PLAYER_H=PLAYER_H;globalThis.BREATH_MAX=BREATH_MAX;");
let pass = 0, fail = 0; const ok = (n, c, i = "") => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n + (i !== "" ? "  [" + i + "]" : "")); };
const STEP = 1 / 120;
function mk(ch = "castaway", x = 2700, y = GROUND_Y) { const g = new Game(ch, "T"); g.x = x; g.y = y; for (let i = 0; i < 30; i++) g.update(STEP, {}); return g; }
function run(g, secs, inp, until) { const ev = []; const n = Math.round(secs / STEP); for (let i = 0; i < n; i++) { g.update(STEP, { ...inp, jump: inp.jump && i === 0, slide: inp.slide && i === 0 }); ev.push(...g.events.splice(0)); if (until && until(g)) break; } return ev; }

// falling into the chasm now means water, not instant death
{
  const g = mk("castaway", 3050, GROUND_Y - 300); g.onGround = false; g.vy = 0;
  const ev = run(g, 2, {});
  ok("falling into the chasm splashes into water", ev.includes("splash"), ev.filter((e) => e !== "step").join());
  ok("you are swimming, not dead", g.inWater && !g.over, "inWater " + g.inWater + " energy " + g.energy);
  ok("you float with your shoulders at the surface (no sinking to the floor)", g.y > WATER.surface && g.y < WATER.surface + PLAYER_H, "y " + g.y.toFixed(0));
  ok("falling into the cold water costs exactly 1 energy", g.energy === g.maxEnergy - 1, g.energy);
  ok("never respawned (still in the chasm column)", g.x > WATER.x0 && g.x < WATER.x1, g.x.toFixed(0));
}
// swimming horizontally
{
  const g = mk("castaway", 3050, GROUND_Y - 100); g.onGround = false; run(g, 1.5, {}); const x0 = g.x;
  run(g, 1, { dir: 1 }); ok("you can swim right", g.x > x0 + 80, "moved " + (g.x - x0).toFixed(0)); const vNormal = g.vx;
  ok("a normal swim is slower than running", Math.abs(vNormal) < g.c.run * 0.7, vNormal.toFixed(0));
  const sw = mk("castaway", 3050, GROUND_Y - 100); sw.onGround = false; run(sw, 1.5, {}); run(sw, 0.8, { dir: 1, sprint: true }); ok("sprint-swimming is allowed to be quicker than a normal swim but still slower than sprinting on land", sw.vx > g.c.run * 0.4 && sw.vx < g.c.run * 1.3, sw.vx.toFixed(0));
  const m = mk("castaway", 3000, GROUND_Y - 100); m.onGround = false; run(m, 1.5, {}); const ys = []; for (let i = 0; i < 120 * 0.7; i++) { m.update(STEP, { dir: 1 }); m.events.length = 0; ys.push(m.y); }
  ok("swimming holds a steady depth in open water (no bobbing wildly)", Math.max(...ys) - Math.min(...ys) < 12 && m.inWater, "range " + (Math.max(...ys) - Math.min(...ys)).toFixed(1));
}
// diving and surfacing, breath
{
  const g = mk("castaway", 3050, GROUND_Y - 100); g.onGround = false; run(g, 1.5, {});
  run(g, 1.5, { crouch: true }); ok("holding crouch dives underwater", g.submerged && g.y > WATER.surface + PLAYER_H, "y " + g.y.toFixed(0));
  const b0 = g.breath; run(g, 1, { crouch: true }); ok("breath drains underwater", g.breath < b0 - 0.8, b0.toFixed(2) + " -> " + g.breath.toFixed(2));
  run(g, 3, { jumpHeld: true }); ok("holding jump swims back up", !g.submerged, "y " + g.y.toFixed(0));
  run(g, 4, {}); ok("breath recovers at the surface", g.breath > 5, g.breath.toFixed(2));
}
{
  const g = mk("castaway", 3050, GROUND_Y - 100); g.onGround = false; run(g, 1.2, {}); const ev = run(g, 9, { crouch: true });
  ok("staying under too long costs a further energy (cold 1 + gasp 1)", g.energy === g.maxEnergy - 2 || g.over, "energy " + g.energy);
  ok("after running out of air you are put safely on the bank", g.onGround && !g.inWater && (g.x < WATER.x0 || g.x > WATER.x1), "x " + g.x.toFixed(0));
  ok("a breath warning is raised", ev.includes("breath"));
}
// climbing out
{
  const g = mk("castaway", 3050, GROUND_Y - 100); g.onGround = false; run(g, 1.5, {});
  const ev = run(g, 6, { dir: 1 }, (q) => q.onGround && !q.inWater); ok("swimming into the east bank climbs out onto the bank (within 60 units of its edge)", ev.includes("climbout") && g.onGround && g.x > WATER.x1 && g.x < WATER.x1 + 60, "x " + g.x.toFixed(0) + " y " + g.y.toFixed(0));
  const g2 = mk("castaway", 3050, GROUND_Y - 100); g2.onGround = false; run(g2, 1.5, {}); const ev2 = run(g2, 6, { dir: -1 }, (q) => q.onGround && !q.inWater); ok("swimming into the west bank climbs out onto the bank (within 60 units of its edge)", ev2.includes("climbout") && g2.onGround && g2.x < WATER.x0 && g2.x > WATER.x0 - 60, "x " + g2.x.toFixed(0));
}
// the chasm can now be crossed by swimming; the bridge is still faster and is solid above water
{
  const g = mk("castaway", 2700, GROUND_Y); const ev = run(g, 14, { dir: 1, sprint: true }, (q) => q.x > 3400);
  ok("you can cross the chasm WITHOUT the rope by swimming, but it costs energy", g.x > 3300 && g.onGround && !g.over && g.energy < g.maxEnergy, "x " + g.x.toFixed(0) + " energy " + g.energy);
  const b = mk("castaway", 2700, GROUND_Y); b.bridgeRepaired = true; const evb = run(b, 6, { dir: 1, sprint: true }, (q) => q.x > 3400);
  ok("with the bridge repaired you run across without getting wet or losing energy", b.x > 3300 && !evb.includes("splash") && b.energy === b.maxEnergy, "energy " + b.energy);
}
// existing rules still hold: the bridge-gated win path
{
  const g = mk("castaway", 250, GROUND_Y); ok("dry land is not water", !g.inWater);
  const dry = mk("castaway", 1000, GROUND_Y); run(dry, 2, { dir: 1 }); ok("running on the beach never enters water code", !dry.inWater && dry.breath === BREATH_MAX);
}
// invariants under random swimming
{
  let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let bad = 0;
  for (let t = 0; t < 20; t++) { const g = mk("castaway", 3000 + rnd() * 100, GROUND_Y - 200); g.onGround = false; for (let i = 0; i < 120 * 10 && !g.over; i++) { g.update(STEP, { dir: rnd() < 0.3 ? 0 : rnd() < 0.5 ? 1 : -1, crouch: rnd() < 0.3, jumpHeld: rnd() < 0.3, jump: rnd() < 0.01, sprint: rnd() < 0.2 }); g.events.length = 0; if (![g.x, g.y, g.vx, g.vy, g.breath].every(Number.isFinite) || g.y > WATER.floor + 1 || g.breath < -0.01 || g.breath > BREATH_MAX + 0.01) bad++; } }
  ok("random swimming: finite, within water, breath always in range", bad === 0, "bad " + bad);
}

// REGRESSION: surfacing with jump held used to flip in/out of the water and charge the cold cost every time, killing the player
{
  const g = mk("castaway", 3050, GROUND_Y - 300); g.onGround = false; const ev = run(g, 1.5, {});
  const e1 = g.energy; const evd = run(g, 1.5, { crouch: true }); const evs = run(g, 4, { jumpHeld: true });
  const splashes = [...ev, ...evd, ...evs].filter((e) => e === "splash").length;
  ok("diving then surfacing with jump held charges the cold cost only once", splashes === 1 && g.energy === g.maxEnergy - 1 && !g.over, "splashes " + splashes + " energy " + g.energy);
  ok("hammering jump at the surface never drowns the swimmer", (() => { const q = mk("castaway", 3050, GROUND_Y - 300); q.onGround = false; for (let i = 0; i < 120 * 10; i++) { q.update(STEP, { jumpHeld: true, jump: i % 20 === 0 }); q.events.length = 0; } return !q.over && q.energy === q.maxEnergy - 1; })());
  const g2 = mk("castaway", 3050, GROUND_Y - 300); g2.onGround = false; run(g2, 1.5, {}); run(g2, 6, { dir: 1 }, (q) => q.onGround && !q.inWater && !q.climbing); run(g2, 0.5, {});
  const eAfter = g2.energy; g2.x = 3050; g2.y = GROUND_Y - 300; g2.onGround = false; g2.vy = 0; run(g2, 1.5, {});
  ok("a second swim after drying off is cold again (costs 1 more)", g2.energy === eAfter - 1, eAfter + " -> " + g2.energy);
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
