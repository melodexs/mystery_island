/* Stormbound survivors: four distinct jointed humanoids built from code geometry (no downloaded models).
   Skeleton: hips > torso > (head, armL, armR), hips > legL, legR. Pose is computed each frame from player state. */
import * as THREE from "three";
const MK = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.82 }, o));
const LOOKS = {
  scout:  { skin: 0xd9a77b, top: 0x3f7f86, pants: 0x2d3a44, boots: 0x2a2320, hair: 0x2b1d14, hat: null,      pack: "small", build: 0.94, height: 1.0,  accent: 0xe0a340, bandana: 0xc8553d },
  radio:  { skin: 0xb98563, top: 0x59693a, pants: 0x3b3d33, boots: 0x2a2a26, hair: 0x1c1613, hat: "cap",     pack: "radio", build: 1.0,  height: 1.0,  accent: 0xd0d0c0, bandana: null },
  sailor: { skin: 0xc79672, top: 0x1f3550, pants: 0x2a2f36, boots: 0x1a1a1a, hair: 0xb8b4aa, hat: "beanie",  pack: "coat",  build: 1.2,  height: 1.04, accent: 0xb89a4a, bandana: null, beard: 0xb8b4aa },
  night:  { skin: 0x8a5d44, top: 0x24262b, pants: 0x1b1d21, boots: 0x111113, hair: 0x0e0d0c, hat: "hood",    pack: "slim",  build: 0.98, height: 1.02, accent: 0x55c7d4, bandana: 0x24262b }
};
export function buildCharacter(key) {
  const L = LOOKS[key] || LOOKS.scout, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = MK(L.skin), top = MK(L.top), pants = MK(L.pants), boots = MK(L.boots, { roughness: 0.7 }), hair = MK(L.hair), acc = MK(L.accent, { metalness: 0.2 });
  const add = (parent, geo, m, x, y, z, o = {}) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); if (o.rot) mesh.rotation.set(...o.rot); if (o.scale) mesh.scale.set(...o.scale); mesh.castShadow = true; parent.add(mesh); return mesh; };
  const B = L.build, S = L.height; body.scale.set(B, S, B);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  add(hips, new THREE.BoxGeometry(0.36, 0.2, 0.22), pants, 0, 0, 0);
  const torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso);
  add(torso, new THREE.CylinderGeometry(0.21, 0.19, 0.5, 10), top, 0, 0.27, 0, { scale: [1, 1, 0.72] });
  add(torso, new THREE.CylinderGeometry(0.235, 0.21, 0.14, 10), top, 0, 0.5, 0, { scale: [1, 1, 0.74] });           // shoulders
  add(torso, new THREE.BoxGeometry(0.32, 0.05, 0.2), acc, 0, 0.02, 0);                                              // belt
  // head
  const head = new THREE.Group(); head.position.set(0, 0.7, 0); torso.add(head);
  add(head, new THREE.SphereGeometry(0.13, 14, 12), skin, 0, 0.12, 0, { scale: [1, 1.08, 1] });
  add(head, new THREE.CylinderGeometry(0.055, 0.06, 0.1, 8), skin, 0, -0.01, 0);                                    // neck
  add(head, new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.14, -0.012, { scale: [1.02, 1.02, 1.04] });
  add(head, new THREE.SphereGeometry(0.018, 6, 6), MK(0x111111), -0.045, 0.14, 0.12); add(head, new THREE.SphereGeometry(0.018, 6, 6), MK(0x111111), 0.045, 0.14, 0.12);
  if (L.beard) add(head, new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.5), MK(L.beard), 0, 0.09, 0.05, { scale: [1, 1, 0.8] });
  if (L.hat === "cap") { add(head, new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), MK(0x424a30), 0, 0.17, 0); add(head, new THREE.BoxGeometry(0.2, 0.02, 0.12), MK(0x424a30), 0, 0.16, 0.15); }
  if (L.hat === "beanie") add(head, new THREE.SphereGeometry(0.143, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), MK(0x6a2f2b), 0, 0.165, 0);
  if (L.hat === "hood") { add(head, new THREE.SphereGeometry(0.16, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), top, 0, 0.14, -0.02, { scale: [1, 1.05, 1.08] }); }
  if (L.bandana) add(head, new THREE.TorusGeometry(0.1, 0.024, 6, 14), MK(L.bandana), 0, 0.0, 0, { rot: [Math.PI / 2, 0, 0] });
  // arms: shoulder pivot > upper > elbow pivot > fore > hand
  const mkArm = (side) => { const sh = new THREE.Group(); sh.position.set(0.27 * side, 0.52, 0); torso.add(sh);
    add(sh, new THREE.CylinderGeometry(0.058, 0.05, 0.3, 8), top, 0, -0.14, 0); const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    add(el, new THREE.CylinderGeometry(0.05, 0.042, 0.28, 8), top, 0, -0.13, 0); add(el, new THREE.SphereGeometry(0.048, 8, 8), skin, 0, -0.29, 0); return { sh, el }; };
  const armL = mkArm(-1), armR = mkArm(1);
  // legs: hip pivot > upper > knee pivot > shin > foot
  const mkLeg = (side) => { const hp = new THREE.Group(); hp.position.set(0.1 * side, -0.05, 0); hips.add(hp);
    add(hp, new THREE.CylinderGeometry(0.083, 0.07, 0.42, 8), pants, 0, -0.2, 0); const kn = new THREE.Group(); kn.position.y = -0.42; hp.add(kn);
    add(kn, new THREE.CylinderGeometry(0.07, 0.058, 0.42, 8), pants, 0, -0.2, 0); add(kn, new THREE.BoxGeometry(0.11, 0.08, 0.24), boots, 0, -0.44, 0.04); return { hp, kn }; };
  const legL = mkLeg(-1), legR = mkLeg(1);
  // pack / gear per survivor
  if (L.pack === "small") add(torso, new THREE.BoxGeometry(0.24, 0.28, 0.1), acc, 0, 0.3, -0.17);
  if (L.pack === "radio") { add(torso, new THREE.BoxGeometry(0.34, 0.42, 0.18), MK(0x3a3d2c), 0, 0.3, -0.2); add(torso, new THREE.CylinderGeometry(0.008, 0.008, 0.6, 5), MK(0x111111), 0.12, 0.8, -0.22); add(torso, new THREE.BoxGeometry(0.1, 0.07, 0.04), MK(0xd9a63a), 0, 0.3, -0.3); }
  if (L.pack === "coat") { add(hips, new THREE.CylinderGeometry(0.2, 0.3, 0.5, 10, 1, true), top, 0, -0.22, 0, { scale: [1, 1, 0.75] }); add(torso, new THREE.BoxGeometry(0.34, 0.2, 0.16), MK(0x4a3a24), 0, 0.2, -0.17); }
  if (L.pack === "slim") { add(torso, new THREE.BoxGeometry(0.2, 0.32, 0.08), MK(0x1a1b1e), 0, 0.3, -0.16); }
  // flashlight: held in the right hand, a real spotlight attached to the hand
  const torch = new THREE.Group(); torch.position.set(0, -0.3, 0.02); armR.el.add(torch); add(torch, new THREE.CylinderGeometry(0.03, 0.026, 0.17, 8), MK(0x222222, { metalness: 0.6 }), 0, 0, 0.05, { rot: [Math.PI / 2, 0, 0] });
  const lens = add(torch, new THREE.CircleGeometry(0.026, 10), new THREE.MeshBasicMaterial({ color: 0xfff6d6 }), 0, 0, 0.138); lens.visible = false;
  const spot = new THREE.SpotLight(0xfff0cc, 0, 38, 0.5, 0.55, 1.4); spot.position.set(0, 0, 0.1); const tgt = new THREE.Object3D(); tgt.position.set(0, 0, 8); torch.add(spot, tgt); spot.target = tgt;
  root.userData = { key, hips, torso, head, armL, armR, legL, legR, spot, lens, torch, S, height: 1.8 * S };
  return root;
}
/* pose from player state. t = time, p = player, k = smoothing state held per character */
export function poseCharacter(root, p, t, dt, flashOn, k) {
  const u = root.userData, speed = p.speed, sw = Math.min(1, speed / 6), crouch = p.crouching ? 1 : 0, air = !p.onGround && !p.swimming && !p.climbing ? 1 : 0, swim = p.swimming ? 1 : 0, climb = p.climbing ? 1 : 0;
  k.phase = (k.phase || 0) + speed * dt * (p.sprinting ? 1.35 : 1.5); k.crouch = (k.crouch || 0) + (crouch - (k.crouch || 0)) * Math.min(1, dt * 12); k.air = (k.air || 0) + (air - (k.air || 0)) * Math.min(1, dt * 10);
  k.lean = (k.lean || 0) + (Math.min(0.5, speed / 16) * (p.sprinting ? 1.4 : 1) - (k.lean || 0)) * Math.min(1, dt * 8); k.land = Math.max(0, (k.land || 0) - dt * 3.2); if (p.justLanded > 0.2) k.land = Math.min(1, (p.landed || 0) / 8 + 0.15);
  const ph = k.phase, swing = Math.sin(ph) * 0.9 * sw * (1 - k.air * 0.6), swing2 = Math.sin(ph + Math.PI) * 0.9 * sw * (1 - k.air * 0.6), cr = k.crouch;
  u.hips.position.y = 0.95 - cr * 0.34 - k.land * 0.12 + Math.abs(Math.cos(ph)) * 0.035 * sw * (1 - k.air);
  u.hips.rotation.x = k.lean * 0.55 + cr * 0.2 + swim * 0.9 + climb * -0.1; u.torso.rotation.x = k.lean * 0.35 - swim * 0.2; u.torso.rotation.y = Math.sin(ph) * 0.12 * sw;
  u.legL.hp.rotation.x = swing - cr * 0.9 - k.air * 0.5 * (1) + swim * Math.sin(t * 5) * 0.4 + climb * Math.sin(t * 4) * 0.6; u.legR.hp.rotation.x = swing2 - cr * 0.9 - k.air * 0.2 + swim * Math.sin(t * 5 + 3) * 0.4 - climb * Math.sin(t * 4) * 0.6;
  u.legL.kn.rotation.x = Math.max(0, -swing) * 0.9 + cr * 1.4 + k.air * 0.7 + climb * 0.5; u.legR.kn.rotation.x = Math.max(0, -swing2) * 0.9 + cr * 1.4 + k.air * 0.3 + climb * 0.5;
  const armSwing = sw * (p.sprinting ? 1.2 : 0.8);
  u.armL.sh.rotation.x = swing2 * armSwing - k.air * 0.9 + swim * Math.sin(t * 4) * 0.9 - climb * 2.4 * (0.6 + 0.4 * Math.sin(t * 4)); u.armL.el.rotation.x = -0.3 - sw * 0.5 - k.air * 0.5 - climb * 0.6;
  const holding = flashOn ? 1 : 0; u.armR.sh.rotation.x = (swing * armSwing * (1 - holding)) + holding * -1.25 - k.air * 0.9 + swim * Math.sin(t * 4 + 2) * 0.9 - climb * 2.4 * (0.6 - 0.4 * Math.sin(t * 4)); u.armR.el.rotation.x = -0.3 - sw * 0.5 * (1 - holding) - holding * 0.35 - climb * 0.6;
  u.armL.sh.rotation.z = 0.08 + k.air * 0.5 + swim * 0.3; u.armR.sh.rotation.z = -0.08 - k.air * 0.5 - swim * 0.3;
  // idle breathing: slow chest rise and a tiny shoulder/head sway, fading out as soon as you move
  u.head.rotation.x = 0; u.torso.rotation.z = 0;
  const idle = Math.max(0, 1 - sw * 3) * (1 - k.air) * (1 - swim) * (1 - climb), br = Math.sin(t * 1.9);
  u.torso.scale.set(1 + br * 0.012 * idle, 1 + br * 0.02 * idle, 1 + br * 0.012 * idle); u.torso.rotation.z += Math.sin(t * 0.8) * 0.012 * idle; u.armL.sh.rotation.x += br * 0.03 * idle; u.armR.sh.rotation.x += br * 0.03 * idle;
  // interaction reach: when E is pressed, the right arm extends forward and waves back, then relaxes (k.reach counts 1 -> 0 over 0.7 s)
  if (k.reach > 0) { k.reach = Math.max(0, k.reach - dt / 0.7); const r = k.reach, e = Math.sin((1 - r) * Math.PI), wave = Math.sin((1 - r) * Math.PI * 4) * 0.25 * e;
    u.armR.sh.rotation.x = u.armR.sh.rotation.x * (1 - e) + (-1.55) * e; u.armR.sh.rotation.z = u.armR.sh.rotation.z * (1 - e) + (-0.2 + wave) * e; u.armR.el.rotation.x = u.armR.el.rotation.x * (1 - e) + (-0.35 + wave * 0.8) * e; u.torso.rotation.x += 0.12 * e; u.head.rotation.x += 0.1 * e; }
  u.head.rotation.x += -k.lean * 0.5 - swim * 0.5; u.spot.intensity = flashOn ? 55 * (u.lightBoost || 1) : 0; u.lens.visible = !!flashOn;
}
