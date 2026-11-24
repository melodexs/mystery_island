const { Game, SURVIVORS, OBJECTIVES } = require("../rules.js");
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "-", e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || "") + ` expected ${b} got ${a}`); };

t("four survivors, no military labels", () => {
  eq(Object.keys(SURVIVORS).length, 4);
  for (const s of Object.values(SURVIVORS)) if (/OPERATIVE|RECON|BLACK OPS|TEAM LEADER|ASSAULT|TACTICAL/i.test(s.name + s.tag + s.perk)) throw new Error("military wording: " + s.name);
});
t("perks match the brief", () => {
  eq(SURVIVORS.scout.sprint, 1.2); if (SURVIVORS.scout.jump <= 1) throw new Error("scout jump");
  if (SURVIVORS.radio.scan <= 1 || SURVIVORS.radio.drain >= 1) throw new Error("radio");
  if (SURVIVORS.sailor.endure <= 1) throw new Error("sailor"); if (SURVIVORS.night.crouch <= 1 || SURVIVORS.night.light <= 1) throw new Error("night");
});
t("objectives start at rope", () => { const g = new Game("scout"); eq(g.objective.id, "rope"); eq(OBJECTIVES.length, 4); });
t("full route wins in order", () => {
  const g = new Game("scout");
  g.pickRope(); eq(g.objective.id, "cliff");
  g.useAnchor(); g.searchCabin(); eq(g.objective.id, "power"); eq(g.inv.key && g.inv.journal, true);
  g.pickFuel("beach"); g.pickFuel("cabin"); eq(g.inv.fuel, 2); g.useGenerator(); eq(g.objective.id, "beacon");
  g.useLighthouseDoor(); g.useBeacon(); eq(g.won, true); eq(g.over, true);
});
t("cabin needs the rope anchored first", () => { const g = new Game("scout"); g.searchCabin(); eq(g.inv.key, false); g.pickRope(); g.searchCabin(); eq(g.inv.key, false, "rope not anchored yet"); });
t("anchor needs the rope", () => { const g = new Game("scout"); g.useAnchor(); eq(g.flags.ropeAnchored, false); });
t("generator needs 2 fuel and the cabin visit", () => {
  const g = new Game("scout"); g.pickFuel("beach"); g.useGenerator(); eq(g.flags.generatorOn, false);
  g.pickRope(); g.useAnchor(); g.searchCabin(); g.useGenerator(); eq(g.flags.generatorOn, false, "only 1 fuel");
  g.pickFuel("cabin"); g.useGenerator(); eq(g.flags.generatorOn, true); eq(g.inv.fuel, 0);
});
t("fuel cannot be picked twice", () => { const g = new Game("scout"); g.pickFuel("beach"); eq(g.pickFuel("beach"), null); eq(g.inv.fuel, 1); });
t("lighthouse needs the key; beacon needs door and power", () => {
  const g = new Game("scout"); g.useLighthouseDoor(); eq(g.flags.lighthouseOpen, false);
  g.inv.key = true; g.useLighthouseDoor(); eq(g.flags.lighthouseOpen, true);
  g.useBeacon(); eq(g.won, false, "no power"); g.flags.generatorOn = true; g.useBeacon(); eq(g.won, true);
});
t("beacon cannot be lit through a closed door", () => { const g = new Game("scout"); g.flags.generatorOn = true; g.useBeacon(); eq(g.won, false); });
t("short fall is safe, long fall costs hearts", () => { const g = new Game("scout"); eq(g.land(4), 0); eq(g.health, 5); if (g.land(12) < 1) throw new Error("no damage"); if (g.health >= 5) throw new Error("health"); });
t("landing in water is safe", () => { const g = new Game("scout"); eq(g.land(30, true), 0); eq(g.health, 5); });
t("sailor takes less fall damage than scout", () => { const a = new Game("scout"), b = new Game("sailor"); const da = a.land(20), db = b.land(20); if (!(db < da)) throw new Error(`${db} vs ${da}`); });
t("fall damage can end the game", () => { const g = new Game("scout"); g.land(80); eq(g.over, true); eq(g.won, false); eq(g.health, 0); });
t("stamina drains and radio drains slower", () => { const a = new Game("scout"), b = new Game("radio"); a.useStamina(30); b.useStamina(30); if (!(b.stamina > a.stamina)) throw new Error("radio not slower"); });
t("stamina empty blocks the action and recovers", () => { const g = new Game("scout"); g.stamina = 0; eq(g.useStamina(5), false); g.regenStamina(2, false); if (g.stamina < 30) throw new Error("no regen"); });
t("gust pattern: calm then wind", () => { eq(Game.gust(0), 0); if (Game.gust(19) < 0.5) throw new Error("expected gust at 19s"); });
t("exposed in a gust loses warmth; shelter restores it", () => {
  const g = new Game("scout"); g.time = 14.9; for (let i = 0; i < 120; i++) g.tickWeather(0.1, true, false); if (!(g.warmth < 1)) throw new Error("no cold");
  const w = g.warmth; for (let i = 0; i < 50; i++) g.tickWeather(0.1, false, false); if (!(g.warmth > w)) throw new Error("no warming");
});
t("sailor resists cold better", () => {
  const a = new Game("scout"), b = new Game("sailor"); a.time = b.time = 14.9; for (let i = 0; i < 60; i++) { a.tickWeather(0.1, true, false); b.tickWeather(0.1, true, false); }
  if (!(b.warmth > a.warmth)) throw new Error(`sailor ${b.warmth} scout ${a.warmth}`);
});
t("long exposure at zero warmth costs a heart", () => {
  const g = new Game("scout"); g.warmth = 0; g.time = 14.9; for (let i = 0; i < 80; i++) g.tickWeather(0.1, true, false); if (!(g.health < 5)) throw new Error("no cold damage");
});
t("a dead player cannot win", () => { const g = new Game("scout"); g.inv.key = true; g.flags.generatorOn = true; g.flags.lighthouseOpen = true; g.hurt(5); eq(g.over, true); g.useBeacon(); eq(g.won, false); eq(g.flags.beaconOn, false); });
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
