/* Stormbound landmarks: every interactable object in the quest. Each returns its group and registers colliders. */
import * as THREE from "three";
const T = window.SBT;
export function buildLandmarks(scene, W, P) {
  const { mat, put, box, cyl } = P, POI = T.POI, out = { items: {}, lights: {} };
  const at = (k, y0) => { const g = new THREE.Group(); g.position.set(POI[k].x, T.height(POI[k].x, POI[k].z) + (y0 || 0), POI[k].z); scene.add(g); return g; };
  const wall = (g, x, z, w, d, h) => { W.addCollider(g.position.x + x, g.position.z + z, Math.max(w, d) / 2, h); };

  /* ---- jungle ruins (rope): broken stone walls, pillars and a moss-covered altar with a coiled rope ---- */
  { const g = at("ruins"); out.items.ruins = g; const s = mat.ruin;
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 0.4; box(g, s, Math.cos(a) * 6, 1.1 + (i % 2) * 0.5, Math.sin(a) * 6, 5, 2.2 + (i % 2), 0.9, { rot: [0, a + 1.57, (i - 1.5) * 0.04] }); W.addCollider(g.position.x + Math.cos(a) * 6, g.position.z + Math.sin(a) * 6, 2.4, 3); }
    for (let i = 0; i < 3; i++) cyl(g, mat.stone2, -2 + i * 2, 1.6, -2.4, 0.45, 0.55, 3.2 - i * 0.7, 8);
    box(g, mat.stone, 0, 0.5, 0, 2.2, 1, 1.4); W.addCollider(g.position.x, g.position.z, 1.3, 1.2);
    const coil = new THREE.Group(); coil.position.set(0, 1.25, 0); g.add(coil); for (let i = 0; i < 4; i++) put(coil, new THREE.TorusGeometry(0.34 - i * 0.05, 0.065, 6, 14), mat.rope, 0, i * 0.1, 0, { rot: [Math.PI / 2, 0, 0] });
    out.items.ropePickup = coil; }

  /* ---- rope anchor at the foot of the cliff: a steel ring on a post, and (once used) a rope hanging up the wall ---- */
  { const g = at("anchor"); out.items.anchor = g; cyl(g, mat.metal, 0, 0.8, 0, 0.12, 0.14, 1.6, 8); put(g, new THREE.TorusGeometry(0.34, 0.07, 8, 16), mat.metal, 0, 1.6, 0, { rot: [0, Math.PI / 2, 0] });
    const rope = new THREE.Group(); rope.visible = false; g.add(rope); const wallH = T.height(POI.anchor.x, T.WALL_Z - 6) - T.height(POI.anchor.x, POI.anchor.z); const len = wallH + 2.5;
    put(rope, new THREE.CylinderGeometry(0.07, 0.07, len, 6), mat.rope, 0, len / 2, -3.6, { cast: false, rot: [0.07, 0, 0] });
    for (let i = 0; i < len / 0.7; i++) put(rope, new THREE.TorusGeometry(0.1, 0.03, 5, 8), mat.rope, 0, 0.5 + i * 0.7, -3.58 - i * 0.05, { cast: false, rot: [Math.PI / 2, 0, 0] });
    out.items.hangingRope = rope; out.items.wallH = wallH; }

  /* ---- keeper's cabin on the plateau: log walls, pitched roof, glowing window, door, table with the key and journal ---- */
  { const g = at("cabin"); out.items.cabin = g; box(g, mat.wood, 0, 1.6, 0, 7, 3.2, 5.4); box(g, mat.wood2, 0, 1.2, 2.72, 1.2, 2.4, 0.18); box(g, mat.glass, -2.1, 1.9, 2.72, 1.1, 0.9, 0.1, { cast: false });
    // pitched roof from two slabs
    box(g, mat.roof, 0, 3.9, 1.5, 7.8, 0.22, 3.4, { rot: [0.55, 0, 0] }); box(g, mat.roof, 0, 3.9, -1.5, 7.8, 0.22, 3.4, { rot: [-0.55, 0, 0] }); box(g, mat.wood2, 0, 3.55, 0, 7.4, 0.35, 0.35);
    cyl(g, mat.stone2, 2.6, 4.2, -1.2, 0.35, 0.35, 2.2, 6); wall(g, 0, 0, 7, 5.4, 6);
    // interior: table with key + journal (visible through the open front)
    box(g, mat.wood, 1.4, 0.75, -1.2, 1.8, 0.1, 0.9); out.items.cabinTable = new THREE.Vector3(g.position.x + 1.4, g.position.y + 0.85, g.position.z - 1.2);
    const key = new THREE.Group(); key.position.set(1.0, 0.86, -1.2); g.add(key); put(key, new THREE.TorusGeometry(0.07, 0.025, 6, 12), M2(0xc9a33c), 0, 0.03, 0, { rot: [Math.PI / 2, 0, 0] }); put(key, new THREE.BoxGeometry(0.2, 0.025, 0.03), M2(0xc9a33c), 0.14, 0.03, 0); out.items.keyObj = key;
    const jr = new THREE.Group(); jr.position.set(1.8, 0.88, -1.2); g.add(jr); put(jr, new THREE.BoxGeometry(0.34, 0.05, 0.44), M2(0x6b3d2a), 0, 0, 0, { rot: [0, 0.4, 0] }); out.items.journalObj = jr;
    const cl = new THREE.PointLight(0xffb866, 0.0, 14, 2); cl.position.set(0, 2.4, 0); g.add(cl); out.lights.cabin = cl; out.items.cabinWindow = mat.glass; }

  /* ---- fuel canisters: red jerrycans (beach wreck + cabin porch) ---- */
  const jerry = (g, x, z) => { const c = new THREE.Group(); c.position.set(x, 0.0, z); g.add(c); put(c, new THREE.BoxGeometry(0.42, 0.62, 0.22), mat.red, 0, 0.31, 0); put(c, new THREE.BoxGeometry(0.16, 0.08, 0.1), mat.metal, 0.08, 0.66, 0); return c; };
  { const g = at("wreck"); out.items.wreck = g; // beached boat hull
    const hull = put(g, new THREE.CylinderGeometry(1.7, 1.2, 7.5, 10, 1, false, 0, 3.1), mat.wood2, 0, 0.9, 0, { rot: [0, 0, Math.PI / 2 + 0.15], scale: [1, 1, 1] }); hull.rotation.set(0.2, 0.5, Math.PI / 2); cyl(g, mat.wood, 3.4, 2.8, -1, 0.1, 0.12, 5.4, 6, { rot: [0.5, 0, 0.35] });
    put(g, new THREE.PlaneGeometry(3.2, 2.6), mat.canvas, 3.1, 2.9, -2, { rot: [0.2, 0.6, 0.2] }); W.addCollider(g.position.x, g.position.z, 3.4, 2.5);
    out.items.fuel1 = jerry(g, -3.4, 2.3); }
  { const g = at("cabinFuel"); out.items.fuel2 = jerry(g, 0, 0); box(g, mat.wood, 0, 0.18, 0, 1.2, 0.36, 0.9); out.items.fuel2.position.y = 0.36; }

  /* ---- generator shed: low shed with a big engine inside and a fuel port; a green lamp goes on when it runs ---- */
  { const g = at("shed"); out.items.shed = g; box(g, mat.stone2, 0, 1.4, 0, 6, 2.8, 5); box(g, mat.roof, 0, 3.0, 0, 6.6, 0.3, 5.6); box(g, mat.wood2, 0, 1.0, 2.52, 1.8, 2.0, 0.15);
    const gen = new THREE.Group(); gen.position.set(0, 0, 4.3); g.add(gen); box(gen, mat.metal, 0, 0.7, 0, 2.2, 1.1, 1.2); cyl(gen, mat.metal, -0.5, 1.4, 0, 0.3, 0.3, 0.5, 10); box(gen, mat.red, 0.55, 1.35, 0, 0.9, 0.35, 0.8);
    const lamp = put(gen, new THREE.SphereGeometry(0.14, 12, 8), M2(0x223022, { emissive: 0x22ff66, emissiveIntensity: 0 }), 0.85, 1.4, 0.62, { cast: false }); out.items.genLamp = lamp; out.items.generator = gen;
    W.addCollider(g.position.x, g.position.z, 3.2, 3); W.addCollider(g.position.x, g.position.z + 4.3, 1.4, 1.4);
    const gl = new THREE.PointLight(0x66ff99, 0, 12, 2); gl.position.set(0, 2, 4.3); g.add(gl); out.lights.gen = gl; }

  /* ---- lighthouse on the peak: tall tapering stone tower with red bands, a door, a stair core, a gallery and a lamp room ---- */
  { const g = at("lighthouse"); out.items.lighthouse = g; const H = 26;
    cyl(g, mat.white, 0, H / 2, 0, 3.0, 4.6, H, 18); for (let i = 0; i < 4; i++) cyl(g, mat.red, 0, 3 + i * 6.2, 0, 3.0 + (H - 3 - i * 6.2) * 0.0615 * 0 + 3.55 - (3 + i * 6.2) * 0.0615 + 0.02, 3.55 - (3 + i * 6.2) * 0.0615 + 0.12, 1.6, 18);
    cyl(g, mat.metal, 0, H + 0.2, 0, 3.7, 3.7, 0.5, 18); cyl(g, mat.stone2, 0, H + 1.35, 0, 1.9, 2.0, 2.2, 14);   // gallery, lantern room base
    const glass = put(g, new THREE.CylinderGeometry(1.9, 1.9, 2.2, 14, 1, true), M2(0xbfe9ff, { transparent: true, opacity: 0.35, emissive: 0xffe9b0, emissiveIntensity: 0 }), 0, H + 1.35, 0, { cast: false }); out.items.lampGlass = glass;
    cyl(g, mat.roof, 0, H + 3.0, 0, 0.0, 2.4, 1.3, 14); box(g, mat.wood2, 0, 1.3, 4.1, 1.6, 2.6, 0.2); out.items.lhDoor = g.children[g.children.length - 1];
    // beam pivot (rotates when lit)
    const beam = new THREE.Group(); beam.position.set(0, H + 1.35, 0); beam.visible = false; g.add(beam);
    const cone = put(beam, new THREE.ConeGeometry(7, 120, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, fog: false }), 0, 0, 60, { cast: false, rot: [Math.PI / 2, 0, 0] });
    const spot = new THREE.SpotLight(0xfff1c4, 0, 260, 0.2, 0.5, 1); spot.position.set(0, 0, 0); spot.target.position.set(0, 0, 100); beam.add(spot, spot.target);
    out.items.beam = beam; out.items.beamSpot = spot; W.addCollider(g.position.x, g.position.z, 4.6, 40);
    out.items.lhTopY = g.position.y + H + 0.8; out.items.lhPos = g.position; }
  return out;
}
function M2(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o || {})); }
