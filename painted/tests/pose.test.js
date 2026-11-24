/* Pose tests for the new moves. Run: node web/tests/pose.test.js */
const fs=require("fs"),path=require("path"); global.window=global;
eval(fs.readFileSync(path.join(__dirname,"../world.js"),"utf8")+"\nglobalThis.Game=Game;globalThis.GROUND_Y=GROUND_Y;globalThis.CLIMB_TIME=CLIMB_TIME;globalThis.VAULT_TIME=VAULT_TIME;globalThis.ROLL_TIME=ROLL_TIME;globalThis.PLATFORMS=PLATFORMS;");
eval(fs.readFileSync(path.join(__dirname,"../pose.js"),"utf8"));
let pass=0,fail=0; const ok=(n,c,i="")=>{c?pass++:fail++; console.log((c?"PASS ":"FAIL ")+n+(i!==""?"  ["+i+"]":""))};
const DT=1/60;
function mk(x=3400,y=GROUND_Y){const g=new Game("castaway","T"); g.x=x; g.y=y; for(let i=0;i<30;i++)g.update(1/120,{}); return g;}
function step(g,pb,inp){ for(let s=0;s<2;s++) g.update(1/120,{...inp,jump:inp.jump&&s===0}); const ev=g.events.splice(0); if(ev.includes("doublejump")) pb.kick("doublejump"); return {p:pb.update(DT,g),ev}; }
// roll rotates a full turn and ends upright
{ const g=mk(); g.y=GROUND_Y-520; g.onGround=false; g.vy=0; const pb=new PoseBlender(); let maxTilt=0,rolled=false;
  for(let i=0;i<260;i++){ const r=step(g,pb,{dir:1}); if(r.ev.includes("roll")) rolled=true; maxTilt=Math.max(maxTilt,Math.abs(r.p.tilt)); }
  ok("roll state is entered",rolled); ok("roll spins the figure most of a full turn (tilt > 5 rad)",maxTilt>5,maxTilt.toFixed(2)+" rad");
  for(let i=0;i<120;i++) step(g,pb,{}); ok("tilt returns to upright after the roll (tilt mod 2pi near 0)",Math.min(Math.abs(pb.p.tilt%(2*Math.PI)),2*Math.PI-Math.abs(pb.p.tilt%(2*Math.PI)))<0.15||Math.abs(pb.p.tilt)<0.15,pb.p.tilt.toFixed(3)); }
// double jump flips
{ const g=mk(); const pb=new PoseBlender(); step(g,pb,{jump:true,jumpHeld:true}); for(let i=0;i<14;i++) step(g,pb,{jumpHeld:true}); let flipped=false,maxT=0; step(g,pb,{jump:true,jumpHeld:true}); for(let i=0;i<40;i++){ step(g,pb,{jumpHeld:true}); if(pb.state==="flip") flipped=true; maxT=Math.max(maxT,Math.abs(pb.p.tilt)); }
  ok("double jump enters the flip pose",flipped); ok("the flip rotates the figure (tilt > 3 rad)",maxT>3,maxT.toFixed(2)); }
// hang and climb
{ const c2=PLATFORMS.find(p=>p.id==="crate2"); const g=mk(c2.x-60,GROUND_Y-140); g.onGround=false; g.vy=-100; const pb=new PoseBlender(); let st=new Set();
  for(let i=0;i<120;i++){ step(g,pb,{dir:1,jumpHeld:true}); st.add(pb.state); if(g.hang) break; }
  for(let i=0;i<30;i++){ step(g,pb,{}); st.add(pb.state); } ok("hang pose while hanging",pb.state==="hang",pb.state); ok("hang pose is stretched taller and narrower",pb.p.sy>1.08&&pb.p.sx<0.95,"sy "+pb.p.sy.toFixed(2)+" sx "+pb.p.sx.toFixed(2));
  step(g,pb,{jump:true}); for(let i=0;i<40;i++){ step(g,pb,{}); st.add(pb.state);} ok("climb-up pose is used during the pull-up",st.has("climbup")); for(let i=0;i<60;i++) step(g,pb,{}); ok("back to idle on top of the block",pb.state==="idle",pb.state); }
// vault
{ const low={id:"tl",x:1000,w:90,y:GROUND_Y-55}; PLATFORMS.push(low); const g=mk(700); const pb=new PoseBlender(); let v=false; for(let i=0;i<200;i++){ step(g,pb,{dir:1,sprint:true}); if(pb.state==="vault") v=true; } PLATFORMS.splice(PLATFORMS.indexOf(low),1); ok("vault pose is used when vaulting",v); }
// no snapping across the whole new move set
{ const c2=PLATFORMS.find(p=>p.id==="crate2"); const g=mk(); const pb=new PoseBlender(); const seq=[]; let prev=null,worst={};
  const frames=(n,inp)=>{ for(let i=0;i<n;i++){ const r=step(g,pb,inp); if(prev) for(const c of ["lean","sx","sy","bob","drop","lift"]) worst[c]=Math.max(worst[c]||0,Math.abs(r.p[c]-prev[c])); prev={...r.p}; } };
  frames(60,{}); frames(40,{dir:1,sprint:true}); frames(1,{dir:1,jump:true,jumpHeld:true}); frames(14,{dir:1,jumpHeld:true}); frames(1,{dir:1,jump:true,jumpHeld:true}); frames(120,{dir:1}); g.y=GROUND_Y-520; g.onGround=false; g.vy=0; frames(200,{dir:1}); frames(60,{});
  ok("no pose snaps through jump, double jump and roll (lean<0.1, sx/sy<0.12 per frame)",worst.lean<0.1&&worst.sx<0.12&&worst.sy<0.12,JSON.stringify(Object.fromEntries(Object.entries(worst).map(([k,v])=>[k,+v.toFixed(3)])))); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
