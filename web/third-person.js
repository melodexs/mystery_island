import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101d22);
scene.fog = new THREE.FogExp2(0x17262b, 0.0105);

const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
$("world").appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9db8bd, 0x17201d, 1.25));
const moon = new THREE.DirectionalLight(0xb8d2d7, 2.2);
moon.position.set(-35, 55, 20); moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -65; moon.shadow.camera.right = 65;
moon.shadow.camera.top = 65; moon.shadow.camera.bottom = -65;
scene.add(moon);
const beaconLight = new THREE.PointLight(0xffd99a, 0, 38, 2);
beaconLight.position.set(0, 18, -36); scene.add(beaconLight);

const mats = {
  grass: new THREE.MeshStandardMaterial({ color: 0x263b32, roughness: 1 }),
  darkGrass: new THREE.MeshStandardMaterial({ color: 0x172820, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x303638, roughness: 0.96 }),
  stone2: new THREE.MeshStandardMaterial({ color: 0x454747, roughness: 0.92 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x171e22, roughness: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.9 }),
  window: new THREE.MeshStandardMaterial({ color: 0xffc66f, emissive: 0xff9b3c, emissiveIntensity: 1.7 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x172b22, roughness: 1 }),
  sand: new THREE.MeshStandardMaterial({ color: 0x565449, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: 0x102d38, roughness: 0.28, metalness: 0.22 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x252d30, metalness: 0.7, roughness: 0.45 })
};
function box(parent, x,y,z, sx,sy,sz, material, cast=true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), material);
  m.position.set(x,y,z); m.castShadow=cast; m.receiveShadow=true; parent.add(m); return m;
}
function cylinder(parent,x,y,z,rt,rb,h,material,segments=12) {
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function cone(parent,x,y,z,r,h,material,segments=4) {
  const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,segments),material);
  m.position.set(x,y,z);m.rotation.y=Math.PI/4;m.castShadow=true;parent.add(m);return m;
}

// A broad, irregular rocky island rising from a storm-dark sea.
const islandShape = new THREE.Shape();
islandShape.moveTo(-43,-30); islandShape.bezierCurveTo(-55,-13,-45,23,-24,31);
islandShape.bezierCurveTo(-8,42,24,35,39,18); islandShape.bezierCurveTo(53,4,40,-25,19,-34);
islandShape.bezierCurveTo(0,-43,-30,-43,-43,-30);
const island = new THREE.Mesh(new THREE.ExtrudeGeometry(islandShape,{depth:5,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:1.3,bevelThickness:1.4}),mats.stone);
island.rotation.x=-Math.PI/2; island.position.y=-4.5; island.receiveShadow=true; scene.add(island);
const ground = new THREE.Mesh(new THREE.CircleGeometry(38,64),mats.grass);
ground.rotation.x=-Math.PI/2;ground.position.y=0.2;ground.scale.set(1.12,0.82,1);ground.receiveShadow=true;scene.add(ground);
const beach = new THREE.Mesh(new THREE.RingGeometry(32,39,64),mats.sand);
beach.rotation.x=-Math.PI/2;beach.position.y=0.23;beach.scale.set(1.1,.83,1);scene.add(beach);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(500,500,80,80),mats.water);
sea.rotation.x=-Math.PI/2;sea.position.y=-2.7;scene.add(sea);
const seaPositions=sea.geometry.attributes.position;
const seaBase=Float32Array.from(seaPositions.array);

// Rocky shore boulders.
for(let i=0;i<95;i++){
  const a=i/95*Math.PI*2, r=34+Math.random()*6;
  const rock= new THREE.Mesh(new THREE.DodecahedronGeometry(1+Math.random()*2,0),i%3?mats.stone:mats.stone2);
  rock.position.set(Math.cos(a)*r,-1.2+Math.random()*1.5,Math.sin(a)*r*.82);
  rock.scale.set(1.1+Math.random(),.65+Math.random(),.9+Math.random());
  rock.rotation.set(Math.random(),Math.random(),Math.random());rock.castShadow=true;scene.add(rock);
}

// Gothic keeper's house: attached wings, steep roofs, mullioned glowing windows and a timber entrance.
const mansion = new THREE.Group(); mansion.position.set(0,0,-24); scene.add(mansion);
box(mansion,0,3,0,19,6.2,11,mats.stone);
box(mansion,-7,3,5.4,7,6,5,mats.stone2);
box(mansion,7,2.7,5.2,7,5.4,5,mats.stone);
box(mansion,0,1.2,5.65,3.1,2.5,.25,mats.wood);
box(mansion,0,1.2,5.49,2.6,2.1,.12,mats.roof);
function gable(parent,x,z,w,h,material){
  const g=new THREE.Mesh(new THREE.BufferGeometry(),material);
  const v=new Float32Array([-w/2,0,0,w/2,0,0,0,h,0,-w/2,0,-5,w/2,0,-5,0,h,-5]);
  g.geometry.setAttribute("position",new THREE.BufferAttribute(v,3));
  g.geometry.setIndex([0,1,2,3,5,4,0,2,3,0,3,4,1,4,5,1,5,2]);
  g.geometry.computeVertexNormals();g.position.set(x,6,z);g.castShadow=true;parent.add(g);
}
gable(mansion,-7,0,7,4,mats.roof);gable(mansion,0,0,8,4.5,mats.roof);gable(mansion,7,0,7,4,mats.roof);
for(const x of [-7,0,7]){
  for(const z of [-5.5,5.7]){
    for(const y of [2.8,5.1]){
      if(x===0&&z===5.7&&y===2.8)continue;
      box(mansion,x,y,z,.85,1.35,.16,mats.window,false);
      box(mansion,x,y,z+.1,.12,1.5,.12,mats.metal,false);
      box(mansion,x,y,z+.1,.95,.12,.12,mats.metal,false);
    }
  }
}
for(let i=0;i<16;i++){
  const x=-9.4+(i%8)*2.68,z=i<8?-5.7:5.7;
  box(mansion,x,3,z,.38,6.4,.42,mats.stone2);
}
for(let i=0;i<9;i++)box(mansion,-9.8+i*2.45,6.2,-5.9,.32,.35,.5,mats.metal);

// Tower and lantern room. Distinct stone courses, gallery rails and a lit glass crown.
const tower=new THREE.Group();tower.position.set(0,0,-34);scene.add(tower);
cylinder(tower,0,8,0,3.25,4.2,16,mats.stone,16);
for(let y=1;y<17;y+=2.4)cylinder(tower,0,y,0,3.3-(y/16)*.75,4.25-(y/16)*.75,.22,mats.stone2,16);
cylinder(tower,0,17,0,3.1,3.1,.7,mats.metal,20);
cylinder(tower,0,19.1,0,2.45,2.65,3.5,mats.window,16);
cylinder(tower,0,21,0,2.9,2.9,.35,mats.metal,20);
cone(tower,0,21.8,0,2.9,1.7,mats.roof,16);
cylinder(tower,0,17.8,0,3.7,3.7,.22,mats.metal,24);
for(let i=0;i<24;i++){
 const a=i/24*Math.PI*2;
 box(tower,Math.cos(a)*3.55,18.4,Math.sin(a)*3.55,.12,1.2,.12,mats.metal);
}
for(const y of [5,10,14]){
 box(tower,0,y,3.15,.65,1.1,.12,mats.window,false);
}
const beacon=new THREE.PointLight(0xffd28a,5,32,2);beacon.position.set(0,19.2,0);tower.add(beacon);

// Island landmarks: a ruined bridge, cave mouth, beach wreckage, trees, paths and rocks.
for(let i=0;i<16;i++){
 const x=-29+i*3.8;
 box(scene,x,.55,-2,3.5,.8,1.8,mats.wood);
}
for(let i=0;i<42;i++){
 const x=-30+Math.random()*60,z=-12+Math.random()*30;
 if(Math.abs(z+24)<12&&Math.abs(x)<12)continue;
 const trunk=cylinder(scene,x,1.7,z,.22,.38,3.4,mats.wood,7);
 const crown=cone(scene,x,4.2,z,1.8,4.5,mats.leaf,7);
 crown.rotation.y=Math.random()*Math.PI;
}
const cave= new THREE.Group();cave.position.set(-27,0,7);scene.add(cave);
box(cave,0,2,0,10,4,5,mats.stone);
const caveHole=new THREE.Mesh(new THREE.CircleGeometry(2.0,24),new THREE.MeshBasicMaterial({color:0x030708}));
caveHole.position.set(0,2.1,2.56);cave.add(caveHole);
for(let i=0;i<10;i++){
 const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1.2,0),mats.stone2);
 rock.position.set(-32+Math.random()*10,.4,-8+Math.random()*20);rock.scale.y=.7;rock.castShadow=true;scene.add(rock);
}
const wreck=new THREE.Group();wreck.position.set(25,0,17);wreck.rotation.y=-.45;scene.add(wreck);
box(wreck,0,.5,0,8,1,2.8,mats.wood);
for(let i=0;i<6;i++)box(wreck,-3.2+i*1.25,1.2,0,.18,1.4,2.7,mats.wood);

// Footpaths and story objects are deliberately visible, non-combat interactions.
const interactables=[];
function marker(id,label,x,z,color=0xd9b16b){
 const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.0,.07,8,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9}));
 ring.rotation.x=Math.PI/2;ring.position.y=.12;g.add(ring);
 const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,1),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.6}));
 orb.position.y=1.35;g.add(orb);
 interactables.push({id,label,x,z,group:g,active:true,orb,ring});
 return g;
}
marker("rope","Collect the rope", -19,5,0xd5b16c);
marker("lantern","Find the lantern in the cave", -27,7,0xffc66f);
marker("bridge","Repair the old bridge", -12,-3,0x7fc8c0);
marker("beacon","Restore the lighthouse beacon", 0,-32,0xffd18a);

// Survivor model: intentionally original, simple layered human silhouette, not a copied game character.
const player=new THREE.Group();scene.add(player);
const bodyMat=new THREE.MeshStandardMaterial({color:0x34484a,roughness:.8});
const skinMat=new THREE.MeshStandardMaterial({color:0x987b65,roughness:.9});
const darkMat=new THREE.MeshStandardMaterial({color:0x1a2426,roughness:.95});
const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.9,5,8),bodyMat);torso.position.y=1.55;torso.castShadow=true;player.add(torso);
const head=new THREE.Mesh(new THREE.SphereGeometry(.32,12,10),skinMat);head.position.y=2.45;head.castShadow=true;player.add(head);
const pack=box(player,0,1.55,-.48,.65,.85,.35,darkMat);
const legs=[];
for(const x of [-.23,.23]){
 const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.17,.72,4,7),darkMat);leg.position.set(x,.62,0);leg.castShadow=true;player.add(leg);legs.push(leg);
}
const arms=[];
for(const x of [-.62,.62]){
 const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.72,4,7),bodyMat);arm.position.set(x,1.55,0);arm.castShadow=true;player.add(arm);arms.push(arm);
}
player.position.set(22,0,18);

const state={rope:false,lantern:false,bridge:false,beacon:false,energy:5,stamina:100};
const keys=new Set();let yaw=0,pitch=.24,velocityY=0,onGround=true,moveSpeed=0,elapsed=0,toastTimer=0,gameStarted=false;
const clock=new THREE.Clock();
function toast(message){$("toast").textContent=message;$("toast").classList.add("show");toastTimer=3.2;}
function updateHud(){
 $("energy").textContent="♥ ".repeat(state.energy);
 $("stamina-fill").style.width=state.stamina+"%";
 $("inventory").textContent=[state.rope?"ROPE":"",state.lantern?"LANTERN":""].filter(Boolean).join("  ·  ")||"EMPTY";
 $("objective").textContent=state.beacon?"Rescue signal active — reach the shore":!state.rope?"Find rope in the jungle":!state.lantern?"Search the cave for a lantern":!state.bridge?"Repair the broken bridge":"Restore the lighthouse beacon";
}
function startGame(){
 gameStarted=true;$("intro").classList.add("hidden");$("hud").classList.remove("hidden");
 toast("The storm has stranded you. Find a way to restore the lighthouse.");
 updateHud();renderer.domElement.requestPointerLock?.();
}
$("start").addEventListener("click",startGame);
$("help").addEventListener("click",()=>toast("WASD move · mouse look · Shift sprint · Space jump · E interact · Esc release mouse"));
function interact(){
 let nearest=null,dist=4.4;
 for(const o of interactables){if(!o.active)continue;const d=Math.hypot(player.position.x-o.x,player.position.z-o.z);if(d<dist){nearest=o;dist=d;}}
 if(!nearest){toast("Nothing to interact with here.");return;}
 if(nearest.id==="rope"){state.rope=true;nearest.active=false;nearest.group.visible=false;toast("Rope collected. It may help repair the bridge.");}
 if(nearest.id==="lantern"){state.lantern=true;nearest.active=false;nearest.group.visible=false;toast("You found the keeper's lantern.");}
 if(nearest.id==="bridge"){
   if(!state.rope){toast("The bridge needs a length of rope.");return;}
   state.bridge=true;nearest.active=false;nearest.group.visible=false;toast("Bridge repaired. The lighthouse path is open.");
 }
 if(nearest.id==="beacon"){
   if(!state.lantern||!state.bridge){toast("The beacon mechanism is beyond the bridge. Find the lantern and repair the bridge first.");return;}
   state.beacon=true;beacon.intensity=7;toast("The lighthouse beacon is shining through the storm!");
 }
 updateHud();
}
function keyDown(e){
 if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
 keys.add(e.code);
 if(e.code==="KeyE"&&!e.repeat&&gameStarted)interact();
 if(e.code==="Escape"&&document.pointerLockElement)document.exitPointerLock();
}
function keyUp(e){keys.delete(e.code);}
addEventListener("keydown",keyDown);addEventListener("keyup",keyUp);
document.addEventListener("mousemove",e=>{if(document.pointerLockElement===renderer.domElement){yaw-=e.movementX*.0022;pitch=Math.max(-.05,Math.min(.85,pitch+e.movementY*.0017));}});
let touchLook=null;
renderer.domElement.addEventListener("touchstart",e=>{if(e.touches.length){touchLook={x:e.touches[0].clientX,y:e.touches[0].clientY};}},{passive:true});
renderer.domElement.addEventListener("touchmove",e=>{if(!touchLook||!e.touches.length)return;const t=e.touches[0];yaw-=(t.clientX-touchLook.x)*.004;pitch=Math.max(-.05,Math.min(.85,pitch+(t.clientY-touchLook.y)*.002));touchLook={x:t.clientX,y:t.clientY};},{passive:true});
renderer.domElement.addEventListener("touchend",()=>touchLook=null);
const touch={forward:false,back:false,left:false,right:false,jump:false,sprint:false};
document.querySelectorAll("[data-hold]").forEach(b=>{
 const k=b.dataset.hold;
 b.addEventListener("pointerdown",e=>{e.preventDefault();touch[k]=true;b.setPointerCapture(e.pointerId);});
 ["pointerup","pointercancel","lostpointercapture"].forEach(ev=>b.addEventListener(ev,()=>touch[k]=false));
});
$("mobile-use").addEventListener("click",interact);
$("mobile-jump").addEventListener("pointerdown",()=>{touch.jump=true;});
$("mobile-jump").addEventListener("pointerup",()=>{touch.jump=false;});
$("mobile-jump").addEventListener("pointercancel",()=>{touch.jump=false;});

const cameraOffset=new THREE.Vector3();
function animate(){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.04);elapsed+=dt;
 // Rolling ocean swell, wind-driven rain and intermittent lightning keep the island alive.
 for(let i=0;i<seaPositions.count;i++){const x=seaBase[i*3],z=seaBase[i*3+2];seaPositions.array[i*3+1]=seaBase[i*3+1]+Math.sin(x*.12+elapsed*1.1)*.22+Math.cos(z*.17+elapsed*.8)*.15;}
 seaPositions.needsUpdate=true;sea.geometry.computeVertexNormals();
 if(Math.random()<dt*.035){moon.intensity=3.5;setTimeout(()=>moon.intensity=2.2,90);}
 for(const o of interactables){if(!o.active)continue;o.orb.position.y=1.3+Math.sin(elapsed*2.2+o.x)*.18;o.ring.rotation.z=elapsed*.45;}
 if(gameStarted){
  const forward=(keys.has("KeyW")||keys.has("ArrowUp")||touch.forward?1:0)-(keys.has("KeyS")||keys.has("ArrowDown")||touch.back?1:0);
  const side=(keys.has("KeyD")||keys.has("ArrowRight")||touch.right?1:0)-(keys.has("KeyA")||keys.has("ArrowLeft")||touch.left?1:0);
  const sprint=(keys.has("ShiftLeft")||keys.has("ShiftRight")||touch.sprint)&&state.stamina>1;
  const speed=sprint?10.5:6.2;const len=Math.hypot(forward,side)||1;
  const dx=(Math.sin(yaw)*forward+Math.cos(yaw)*side)/len;
  const dz=(-Math.cos(yaw)*forward+Math.sin(yaw)*side)/len;
  player.position.x+=dx*speed*dt;player.position.z+=dz*speed*dt;
  player.position.x=THREE.MathUtils.clamp(player.position.x,-36,36);
  player.position.z=THREE.MathUtils.clamp(player.position.z,-31,28);
  if(Math.hypot(forward,side)>.1){
    player.rotation.y=Math.atan2(dx,dz);
    moveSpeed=THREE.MathUtils.damp(moveSpeed,speed,9,dt);
    torso.position.y=1.55+Math.abs(Math.sin(elapsed*(sprint?13:9)))*.07;
    legs[0].rotation.x=Math.sin(elapsed*(sprint?13:9))*.55;legs[1].rotation.x=-legs[0].rotation.x;
    arms[0].rotation.x=-legs[0].rotation.x*.65;arms[1].rotation.x=-legs[1].rotation.x*.65;
  }else{moveSpeed=THREE.MathUtils.damp(moveSpeed,0,8,dt);legs.forEach(l=>l.rotation.x=THREE.MathUtils.damp(l.rotation.x,0,9,dt));arms.forEach(a=>a.rotation.x=THREE.MathUtils.damp(a.rotation.x,0,9,dt));torso.position.y=THREE.MathUtils.damp(torso.position.y,1.55,8,dt);}
  if(sprint&&Math.hypot(forward,side)>.1)state.stamina=Math.max(0,state.stamina-23*dt);else state.stamina=Math.min(100,state.stamina+15*dt);
  if((keys.has("Space")||touch.jump)&&onGround){velocityY=8.2;onGround=false;touch.jump=false;keys.delete("Space");}
  velocityY-=20*dt;player.position.y+=velocityY*dt;
  if(player.position.y<0){player.position.y=0;velocityY=0;onGround=true;}
  if(player.position.y>0){onGround=false;}
  const target=new THREE.Vector3(player.position.x+Math.sin(yaw)*.8,player.position.y+1.5,player.position.z+Math.cos(yaw)*.8);
  cameraOffset.set(Math.sin(yaw)*-7,3.1+pitch*4,Math.cos(yaw)*-7);
  camera.position.lerp(new THREE.Vector3(target.x+cameraOffset.x,target.y+cameraOffset.y,target.z+cameraOffset.z),1-Math.exp(-7*dt));
  camera.lookAt(target);
  let nearest=4.4;for(const o of interactables){if(o.active)nearest=Math.min(nearest,Math.hypot(player.position.x-o.x,player.position.z-o.z));}
  $("interaction-hint").classList.toggle("visible",nearest<4.4);
  $("interaction-hint").textContent=nearest<4.4?"E  INTERACT":"";
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$("toast").classList.remove("show");}
  $("stamina-fill").style.width=state.stamina+"%";
 }
 renderer.render(scene,camera);
}
camera.position.set(22,5,27);camera.lookAt(0,0,-15);animate();
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));});
updateHud();
