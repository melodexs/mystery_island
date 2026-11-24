/* Stormbound terrain: one pure height function so physics, placement and tests all agree. Units: metres.
   x east, z south. South = beach landing. Middle = jungle lowland. A cliff wall crosses the island at z=-34;
   above it is a plateau (keeper's cabin), and the lighthouse stands on the peak in the far north. */
(function (root) {
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    return hash(xi, zi) * (1 - u) * (1 - v) + hash(xi + 1, zi) * u * (1 - v) + hash(xi, zi + 1) * (1 - u) * v + hash(xi + 1, zi + 1) * u * v; }

  const HALF = 120, WALL_Z = -34, PLATEAU = 16;
  const POI = {
    spawn:      { x: 6,   z: 78 },
    wreck:      { x: -20, z: 72 },       // fuel canister 1
    ruins:      { x: -46, z: 24 },       // rope
    shed:       { x: 52,  z: 6 },        // generator shed
    anchor:     { x: 14,  z: -30 },      // rope anchor, at the foot of the cliff
    cabin:      { x: 22,  z: -56 },      // keeper's cabin on the plateau
    cabinFuel:  { x: 32,  z: -52 },      // fuel canister 2
    lighthouse: { x: -4,  z: -92 }       // on the peak
  };
  const FLAT = ["spawn", "wreck", "ruins", "shed", "anchor", "cabin", "cabinFuel", "lighthouse"];

  /* base island: a rounded blob that falls to the sea; smooth, no cliff yet */
  function island(x, z) {
    const dx = x / 100, dz = (z + 6) / 98, r = Math.sqrt(dx * dx + dz * dz);
    const land = 1 - smooth(0.78, 1.0, r);                              // 1 inland, 0 at the shore
    const rolling = (noise(x * 0.04 + 9, z * 0.04 + 4) - 0.5) * 5 + (noise(x * 0.11, z * 0.11) - 0.5) * 1.6;
    // beach: low and flat in the south, rising gently inland
    const beachRise = smooth(92, 28, z) * 4.5;
    let h = land * (2.6 + beachRise + rolling * smooth(70, 30, z)) - (1 - land) * 3.0;
    return h;
  }
  function raw(x, z) {
    let h = island(x, z);
    // plateau + wall: step up by PLATEAU across z = WALL_Z (steep, ~4 m wide so it reads as a cliff)
    const up = smooth(WALL_Z + 2.5, WALL_Z - 2.5, z); // 0 south of wall, 1 north of it
    const island0 = 1 - smooth(0.80, 1.0, Math.sqrt((x / 100) ** 2 + ((z + 6) / 98) ** 2));
    /* the wall runs right out to the water so nobody can walk round its end. Inside a wider outline the plateau is
       full height; beyond it the ground falls away in a short sheer sea cliff rather than fading as a ramp. */
    const rr = Math.sqrt((x / 104) ** 2 + ((z + 6) / 100) ** 2), plateauMask = 1 - smooth(0.97, 1.0, rr);   // 1 inside, 0 outside
    h += up * PLATEAU * plateauMask;
    if (up > 0.5 && plateauMask > 0.5 && h < 3) h = 3 + up * 13;                                            // north of the wall stays high, even at the shore
    // lighthouse peak
    h += 9 * Math.exp(-(((x - POI.lighthouse.x) / 20) ** 2 + ((z - POI.lighthouse.z) / 18) ** 2)) * island0;
    return h;
  }
  /* flat pads: blend each point of interest to a level platform so buildings sit properly */
  const PAD = {}; for (const k of FLAT) PAD[k] = raw(POI[k].x, POI[k].z);
  const PAD_R = { spawn: 7, wreck: 6, ruins: 7, shed: 7, anchor: 5, cabin: 8, cabinFuel: 4, lighthouse: 9 };
  function height(x, z) {
    let h = raw(x, z);
    for (const k of FLAT) { const p = POI[k], d = Math.hypot(x - p.x, z - p.z), R = PAD_R[k]; if (d < R * 1.8) { const w = 1 - smooth(R, R * 1.8, d); h = h + (PAD[k] - h) * w; } }
    return h;
  }
  const LIGHTHOUSE_BASE = raw(POI.lighthouse.x, POI.lighthouse.z);
  const api = { HALF, WALL_Z, PLATEAU, POI, height, smooth, noise, LIGHTHOUSE_BASE, SEA: 0 };
  if (typeof module !== "undefined") module.exports = api; else root.SBT = api;
})(typeof window !== "undefined" ? window : globalThis);
