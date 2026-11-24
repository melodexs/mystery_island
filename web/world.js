/* Stormbound 3D world: terrain mesh, sea, sky, storm, vegetation and landmarks. Builds only what the scene needs. */
import * as THREE from "three";
const T = window.SBT;
export function buildWorld(scene) {
  const W = { animated: [], sway: [], colliders: [], pois: {}, flags: {} };
  /* ---- terrain: vertex-coloured grid from the same height function the physics uses ---- */
  const SIZE = T.HALF * 2, SEG = 220, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const sand = new THREE.Color(0x8c8466), wet = new THREE.Color(0x5b5845), grass = new THREE.Color(0x2f4a35), jungle = new THREE.Color(0x1f3a2a), rock = new THREE.Color(0x4a4d4a), cliff = new THREE.Color(0x3d403f), moss = new THREE.Color(0x35503b);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = T.height(x, z); pos.setY(i, h);
    const hx = T.height(x + 1.2, z) - h, hz = T.height(x, z + 1.2) - h, slope = Math.hypot(hx, hz) / 1.2, n = T.noise(x * 0.3, z * 0.3);
    if (h < 0.5) c.copy(wet); else if (h < 2.4 && z > 40) c.copy(sand).lerp(wet, n * 0.3); else if (slope > 0.75) c.copy(h > 12 ? cliff : rock).lerp(moss, n * 0.25);
    else if (h > 14) c.copy(grass).lerp(rock, 0.25 + n * 0.3); else c.copy(jungle).lerp(grass, n * 0.5 + (z > 30 ? 0.3 : 0));
    c.multiplyScalar(0.85 + n * 0.3); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, flatShading: false }));
  land.receiveShadow = true; scene.add(land); W.land = land;

  /* ---- sea: animated waves in a vertex shader-free way (CPU, low segment count) ---- */
  const seaGeo = new THREE.PlaneGeometry(900, 900, 120, 120); seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x14323c, roughness: 0.22, metalness: 0.35, transparent: true, opacity: 0.93 }));
  sea.position.y = -0.35; scene.add(sea); W.sea = sea; const seaBase = Float32Array.from(seaGeo.attributes.position.array);
  W.animated.push((t) => { const p = seaGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = seaBase[i * 3], z = seaBase[i * 3 + 2]; p.setY(i, Math.sin(x * 0.06 + t * 1.3) * 0.32 + Math.cos(z * 0.08 + t * 1.0) * 0.24 + Math.sin((x + z) * 0.03 + t * 0.6) * 0.45); } p.needsUpdate = true; seaGeo.computeVertexNormals(); });
  W.seaLevelAt = (x, z, t) => -0.35 + Math.sin(x * 0.06 + t * 1.3) * 0.32 + Math.cos(z * 0.08 + t * 1.0) * 0.24 + Math.sin((x + z) * 0.03 + t * 0.6) * 0.45;

  /* ---- sky, fog, storm lights ---- */
  scene.background = new THREE.Color(0x1c2a31); scene.fog = new THREE.FogExp2(0x1f2f36, 0.0085);
  const hemi = new THREE.HemisphereLight(0x9fb5be, 0x1b241d, 1.0); scene.add(hemi); W.hemi = hemi;
  const sun = new THREE.DirectionalLight(0xc3d3d8, 1.5); sun.position.set(-60, 90, 40); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 300 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target); W.sun = sun;
  const flash = new THREE.PointLight(0xbfe3ff, 0, 600, 1.2); flash.position.set(-60, 90, -40); scene.add(flash); W.flash = flash;
  // cloud deck: a few big dark soft cards drifting overhead
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0x28363d, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
  const clouds = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(60 + Math.random() * 60, 16), cloudMat); m.rotation.x = Math.PI / 2; m.position.set((Math.random() - 0.5) * 500, 110 + Math.random() * 30, (Math.random() - 0.5) * 500); m.scale.set(1.6, 1, 1); scene.add(m); clouds.push(m); }
  W.animated.push((t, dt) => { for (const m of clouds) { m.position.x += dt * 2.2; if (m.position.x > 300) m.position.x = -300; } });

  /* ---- rain: a particle volume that follows the player ---- */
  const RAIN = 2600, rp = new Float32Array(RAIN * 3); for (let i = 0; i < RAIN; i++) { rp[i * 3] = (Math.random() - 0.5) * 70; rp[i * 3 + 1] = Math.random() * 40; rp[i * 3 + 2] = (Math.random() - 0.5) * 70; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xaac4cf, size: 0.11, transparent: true, opacity: 0.45, depthWrite: false })); rain.frustumCulled = false; scene.add(rain); W.rain = rain;
  W.updateRain = (dt, center, wind) => { const p = rg.attributes.position; for (let i = 0; i < RAIN; i++) { let y = p.getY(i) - (26 + (i % 7)) * dt; let x = p.getX(i) + wind * 6 * dt; if (y < 0) { y += 40; } if (x > 35) x -= 70; p.setY(i, y); p.setX(i, x); } p.needsUpdate = true; rain.position.set(center.x, center.y - 4, center.z); };

  W.addCollider = (x, z, r, h) => W.colliders.push({ x, z, r, h: h || 99 });
  return W;
}
