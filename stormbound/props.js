/* Stormbound props: palms, ferns, rocks, ruins, keeper's cabin, generator shed, lighthouse, wreck, rope anchor. Code geometry only. */
import * as THREE from "three";
const T = window.SBT;
const M = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9 }, o));
const mat = { trunk: M(0x4d3a28), leaf: M(0x24502f, { side: THREE.DoubleSide }), leaf2: M(0x2e6137, { side: THREE.DoubleSide }), rock: M(0x474a48), rock2: M(0x34373a), stone: M(0x6a6c66), stone2: M(0x57595a), wood: M(0x4a3523), wood2: M(0x2e2118), roof: M(0x2b3237), metal: M(0x30383c, { metalness: 0.6, roughness: 0.5 }),
  white: M(0xd8d4c6), red: M(0x7a2d27), glass: M(0xffd9a0, { emissive: 0xffb866, emissiveIntensity: 0.0 }), rope: M(0xb59a68), canvas: M(0x6d6a55), ruin: M(0x5d6a5a) };
const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();   // seeded so every run is the same island
const put = (parent, geo, m, x, y, z, o = {}) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); if (o.rot) mesh.rotation.set(...o.rot); if (o.scale) mesh.scale.set(...o.scale); mesh.castShadow = o.cast !== false; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
const box = (p, m, x, y, z, w, h, d, o) => put(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, o);
const cyl = (p, m, x, y, z, rt, rb, h, seg, o) => put(p, new THREE.CylinderGeometry(rt, rb, h, seg || 10), m, x, y, z, o);

/* Vegetation is merged into a few big meshes (one per material) so the whole jungle costs a handful of draw calls.
   Wind sway is done in the vertex shader (see windify): each vertex moves more the higher it is above its plant's base,
   so trees and ferns bend without 360 separate animated objects. */
function windify(material, uniforms) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uWind = uniforms.uWind;
    sh.vertexShader = "uniform float uTime; uniform float uWind; attribute vec2 aSway;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      `#include <begin_vertex>
       float sw = aSway.x; float ph = aSway.y; float g = 0.35 + uWind;
       float bend = sw * sw * 0.07 * g;
       transformed.x += sin(uTime * 1.7 + ph + position.x * 0.5) * bend * 2.0;
       transformed.z += cos(uTime * 1.3 + ph * 1.3 + position.z * 0.5) * bend * 1.6;`);
  };
  return material;
}
function bake(geo, x, y, z, rotY, scale, swayHeight, phase) {
  // returns a copy of geo transformed into world space, with per-vertex sway weight = height above its base / swayHeight
  const g = geo.clone(); g.rotateY(rotY); g.scale(scale, scale, scale); g.translate(x, y, z);
  const p = g.attributes.position, sw = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { sw[i * 2] = Math.max(0, (p.getY(i) - y) / swayHeight); sw[i * 2 + 1] = phase; }
  g.setAttribute("aSway", new THREE.BufferAttribute(sw, 2)); return g;
}
function mergeGeos(list) {
  let vc = 0, ic = 0; for (const g of list) { vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), sw = new Float32Array(vc * 2), col = new Float32Array(vc * 3), idx = new Uint32Array(ic); let vo = 0, io = 0;
  for (const g of list) { const n = g.attributes.position.count; pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); sw.set(g.attributes.aSway.array, vo * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, vo * 3); else col.fill(1, vo * 3, (vo + n) * 3);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo; else for (let i = 0; i < n; i++) idx[io++] = vo + i; vo += n; }
  const m = new THREE.BufferGeometry(); m.setAttribute("position", new THREE.BufferAttribute(pos, 3)); m.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); m.setAttribute("aSway", new THREE.BufferAttribute(sw, 2)); m.setAttribute("color", new THREE.BufferAttribute(col, 3)); m.setIndex(new THREE.BufferAttribute(idx, 1)); return m;
}
function tint(g, r, gg, b) { const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = gg; c[i * 3 + 2] = b; } g.setAttribute("color", new THREE.BufferAttribute(c, 3)); return g; }

export function buildProps(scene, W) {
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0 } }; W.windU = uniforms;
  const trunkL = [], leafL = [], fernL = [], rockL = [];
  const leafMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), uniforms);
  const trunkMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), uniforms);
  const frondGeo = (() => { const g = new THREE.PlaneGeometry(0.9, 4.2, 1, 4); g.translate(0, 2.1, 0); const bp = g.attributes.position; for (let k = 0; k < bp.count; k++) bp.setZ(k, -Math.pow(bp.getY(k) / 4.2, 2) * 2.4); g.rotateX(-1.15); g.computeVertexNormals(); return g; })();
  const fernGeo = (() => { const g = new THREE.PlaneGeometry(0.35, 1.5, 1, 3); g.translate(0, 0.75, 0); const bp = g.attributes.position; for (let k = 0; k < bp.count; k++) bp.setZ(k, -Math.pow(bp.getY(k) / 1.5, 2) * 0.9); g.rotateX(-0.5); g.computeVertexNormals(); return g; })();
  const segGeo = new THREE.CylinderGeometry(0.14, 0.2, 1, 7); segGeo.translate(0, 0.5, 0);
  const C = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

  function palm(x, z, s) {
    const y0 = T.height(x, z) - 0.2, ph = rnd() * 6.28, rot = rnd() * 6.28, lean = (rnd() - 0.5) * 0.45, H = (6 + rnd() * 3) * s, segs = 5; let px = 0, py = 0;
    for (let i = 0; i < segs; i++) { const dx = Math.sin(lean) * (H / segs), dy = Math.cos(lean * 0.4) * (H / segs), L = Math.hypot(dx, dy);
      const g = segGeo.clone(); g.scale(s * (1 - i * 0.09), L + 0.05, s * (1 - i * 0.09)); g.rotateZ(-Math.atan2(dx, dy)); g.translate(px, py, 0); trunkL.push(tint(bake(g, x, y0, z, rot, 1, H, ph), ...C(0x4d3a28))); px += dx; py += dy; }
    for (let i = 0; i < 9; i++) { const g = frondGeo.clone(); g.scale(s, s, s); g.rotateY(i / 9 * Math.PI * 2 + rnd() * 0.3); g.translate(px, py, 0); leafL.push(tint(bake(g, x, y0, z, rot, 1, H, ph), ...C(i % 2 ? 0x24502f : 0x2e6137))); }
    W.addCollider(x, z, 0.5 * s, 99);
  }
  function fern(x, z, s) { const y0 = T.height(x, z), ph = rnd() * 6.28; for (let i = 0; i < 7; i++) { const g = fernGeo.clone(); g.scale(s, s, s); g.rotateY(i / 7 * Math.PI * 2 + rnd() * 0.2); fernL.push(tint(bake(g, x, y0 + 0.05, z, 0, 1, 1.6 * s, ph), ...C(i % 2 ? 0x24502f : 0x2e6137))); } }
  const rockGeo = new THREE.DodecahedronGeometry(1, 0).toNonIndexed();
  function rock(x, z, s, dark) { const g = rockGeo.clone(); g.scale(s * (0.9 + rnd() * 0.6), s * (0.6 + rnd() * 0.5), s * (0.9 + rnd() * 0.6)); g.rotateY(rnd() * 6); g.translate(x, T.height(x, z) + 0.2 * s, z); g.computeVertexNormals();
    const sw = new Float32Array(g.attributes.position.count * 2); g.setAttribute("aSway", new THREE.BufferAttribute(sw, 2)); rockL.push(tint(g, ...(dark ? C(0x34373a) : C(0x474a48)))); W.addCollider(x, z, s * 0.9, s * 0.8); }
  const free = (x, z) => { for (const p of Object.values(T.POI)) if (Math.hypot(x - p.x, z - p.z) < 9) return false; return true; };
  const jungleOK = (x, z) => { const h = T.height(x, z); return h > 1.8 && z < 52 && z > -30 && free(x, z); };
  let n = 0, tries = 0; while (n < 130 && tries++ < 3000) { const x = (rnd() - 0.5) * 190, z = -28 + rnd() * 78; if (jungleOK(x, z)) { palm(x, z, 0.85 + rnd() * 0.6); n++; } }
  n = 0; tries = 0; while (n < 190 && tries++ < 4000) { const x = (rnd() - 0.5) * 190, z = -30 + rnd() * 90; if (jungleOK(x, z) || (z > 40 && T.height(x, z) > 1.4 && free(x, z))) { fern(x, z, 0.8 + rnd() * 0.8); n++; } }
  n = 0; tries = 0; while (n < 14 && tries++ < 800) { const x = (rnd() - 0.5) * 120, z = 52 + rnd() * 30; if (T.height(x, z) > 1.3 && free(x, z)) { palm(x, z, 0.8 + rnd() * 0.4); n++; } }
  n = 0; tries = 0; while (n < 26 && tries++ < 1500) { const x = (rnd() - 0.5) * 150, z = -40 - rnd() * 60; if (T.height(x, z) > 8 && free(x, z)) { palm(x, z, 0.7 + rnd() * 0.4); n++; } }
  n = 0; tries = 0; while (n < 70 && tries++ < 3000) { const x = (rnd() - 0.5) * 200, z = (rnd() - 0.5) * 210; if (T.height(x, z) > -0.5 && free(x, z)) { rock(x, z, 0.5 + rnd() * 1.6, rnd() > 0.5); n++; } }
  for (let i = 0; i < 40; i++) { const x = -90 + rnd() * 180, z = -34 + 3 + rnd() * 6; if (T.height(x, z) > 1 && free(x, z)) rock(x, z, 1 + rnd() * 1.5, true); }
  const add = (list, material, cast) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeos(list), material); m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; };
  add(trunkL, trunkMat, true); add(leafL, leafMat, true); add(fernL, leafMat, false); add(rockL, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), true);
  W.windU = uniforms;
  return { mat, put, box, cyl, rnd };
}
