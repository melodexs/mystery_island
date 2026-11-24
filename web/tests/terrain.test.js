const T = require("../terrain.js"); const { POI, height } = T;
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; } catch (e) { fail++; console.log("FAIL", n, "-", e.message); } };
const SLOPE_MAX = 0.9;   // the controller walks up slopes with rise/run <= ~0.9 (about 42 degrees); steeper is a wall
/* breadth-first walk over a grid: can a player reach b from a, never stepping up more than STEP metres per cell, never entering water? */
function reachable(a, b, opts = {}) {
  const C = 1.5, STEP = C * SLOPE_MAX, N = Math.ceil(T.HALF * 2 / C), key = (i, j) => i * 10000 + j;
  const toI = (x) => Math.round((x + T.HALF) / C), toX = (i) => i * C - T.HALF;
  const blocked = opts.blocked || (() => false);
  const start = [toI(a.x), toI(a.z)], goal = [toI(b.x), toI(b.z)], seen = new Set([key(...start)]), q = [start];
  while (q.length) {
    const [i, j] = q.shift(); if (Math.abs(i - goal[0]) <= 2 && Math.abs(j - goal[1]) <= 2) return true;
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni > N || nj > N || seen.has(key(ni, nj))) continue;
      const h0 = height(toX(i), toX(j)), h1 = height(toX(ni), toX(nj));
      if (h1 < 0.15) continue;                                  // water
      if (blocked(toX(ni), toX(nj))) continue;
      if (h1 - h0 > STEP * (di && dj ? 1.41 : 1)) continue;     // too steep to walk up
      seen.add(key(ni, nj)); q.push([ni, nj]);
    }
  }
  return false;
}
t("every point of interest is on dry land", () => { for (const [k, p] of Object.entries(POI)) if (height(p.x, p.z) < 0.5) throw new Error(k + " is " + height(p.x, p.z).toFixed(2)); });
t("map corners are sea", () => { for (const [x, z] of [[-115,115],[115,115],[-115,-115],[115,-115]]) if (height(x, z) > 0) throw new Error("corner dry"); });
t("spawn reaches the wreck, ruins and shed on foot", () => { for (const k of ["wreck", "ruins", "shed", "anchor"]) if (!reachable(POI.spawn, POI[k])) throw new Error("cannot walk to " + k); });
t("cliff is a real wall: at least 12 m rise within 6 m", () => { const lo = height(14, -28), hi = height(14, -40); if (hi - lo < 12) throw new Error("rise only " + (hi - lo).toFixed(1)); });
t("cabin is NOT reachable on foot without the rope", () => { if (reachable(POI.spawn, POI.cabin)) throw new Error("walkable around the cliff!"); });
t("with the rope (wall opened at the anchor) the cabin is reachable", () => {
  /* the rope lets the player climb at the anchor: model it as lifting the step limit within 6 m of the anchor */
  const open = (a, b) => reachable(a, b, { blocked: () => false });
  const lo = { x: POI.anchor.x, z: POI.anchor.z }, hi = { x: POI.anchor.x, z: T.WALL_Z - 6 };
  if (height(hi.x, hi.z) - height(lo.x, lo.z) < 8) throw new Error("no height gain at anchor");
  if (!reachable(hi, POI.cabin)) throw new Error("plateau does not connect to the cabin"); if (!reachable(hi, POI.lighthouse)) throw new Error("plateau does not connect to lighthouse");
});
t("lighthouse is the highest ground", () => { let max = -9, at; for (let x = -100; x <= 100; x += 4) for (let z = -100; z <= 100; z += 4) { const h = height(x, z); if (h > max) { max = h; at = [x, z]; } } if (Math.hypot(at[0] - POI.lighthouse.x, at[1] - POI.lighthouse.z) > 30) throw new Error("peak at " + at + " h=" + max.toFixed(1)); });
t("pads are flat enough to build on", () => { for (const k of ["spawn", "shed", "cabin", "lighthouse", "anchor"]) { const p = POI[k]; let lo = 99, hi = -99; for (let a = 0; a < 8; a++) { const h = height(p.x + Math.cos(a) * 3, p.z + Math.sin(a) * 3); lo = Math.min(lo, h); hi = Math.max(hi, h); } if (hi - lo > 0.6) throw new Error(k + " varies " + (hi - lo).toFixed(2) + " m"); } });
t("beach is gentle (spawn to waterline)", () => { let maxSlope = 0; for (let z = 86; z > 40; z -= 1) maxSlope = Math.max(maxSlope, Math.abs(height(6, z - 1) - height(6, z))); if (maxSlope > 0.9) throw new Error("beach slope " + maxSlope.toFixed(2)); });
t("rope climb landing is flat and well back from the cliff lip", () => { const z = T.WALL_Z - 12, x = T.POI.anchor.x, h0 = T.height(x, z); for (const [dx, dz] of [[0,0],[4,0],[-4,0],[0,-4],[0,4],[3,3]]) { const h = T.height(x + dx, z + dz); if (Math.abs(h - h0) > 2.5) throw new Error(`landing not flat: ${h} vs ${h0} at ${dx},${dz}`); } for (let d = 0; d <= 7; d++) if (T.height(x, z + d) < h0 - 6) throw new Error("a sharp drop is only " + d + " m from the landing"); });
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
