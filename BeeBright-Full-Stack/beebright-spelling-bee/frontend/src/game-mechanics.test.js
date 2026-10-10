import test from 'node:test';
import assert from 'node:assert/strict';
import {collideDiscs,bowlingPins,bowlingStep,driveStep,marblePath,marbleSupport,RALLY_COURSES,roadDistance,bridgeLanding,newBridgeRun,bridgeStep,newDashRun,dashStep,dashCorridor,keepInFrame} from './game-mechanics.js';
import {DASH_LEVELS} from './arcade-core.js';
import {createGameRenderer} from './game-renderer.js';
import {mount3D} from './games-3d.js';
import * as THREE from 'three';
test('bowling transfers momentum only on actual contact and gutters do not bounce',()=>{
 const a={x:0,y:0,r:1,mass:7,vx:10,vy:0},b={x:1.9,y:0,r:1,mass:1.5,vx:0,vy:0};
 const momentum=a.vx*a.mass+b.vx*b.mass;assert.equal(collideDiscs(a,b),true);assert.ok(b.vx>0);assert.ok(a.vx<10);assert.ok(Math.abs(a.vx*a.mass+b.vx*b.mass-momentum)<1e-8);
 const ball={x:400,y:245,r:14,mass:7,vx:0,vy:-600},pins=bowlingPins();
 bowlingStep(ball,pins,.034);assert.equal(pins.some(p=>p.down),false);
 for(let i=0;i<30;i++)bowlingStep(ball,pins,1/120);assert.ok(pins.some(p=>p.down));
 const gutter={x:275,y:400,r:14,mass:7,vx:-50,vy:-500};bowlingStep(gutter,[],.03);assert.equal(gutter.gutter,true);assert.ok(gutter.vx<0);
});
test('rally has reverse and reverses steering direction while backing up',()=>{
 const p={x:0,z:0,speed:0,heading:0};for(let i=0;i<60;i++)driveStep(p,{down:true},1/60);assert.ok(p.speed<0&&p.x<0);
 driveStep(p,{down:true,right:true},.1);assert.ok(p.heading<0);
});
test('introductory Dash is slower and friendly platforms do not overlap spikes',()=>{
 assert.ok(DASH_LEVELS[0].speed<180);for(const c of DASH_LEVELS)for(const b of c.blocks)assert.equal(c.spikes.some(x=>x>=b.x-40&&x<=b.x+b.w+40),false);
});
test('marble paths supply continuous ramp support and real jump gaps',()=>{
 for(let level=0;level<3;level++){const path=marblePath(level);for(const s of path){const x=(s.a[0]+s.b[0])/2,z=(s.a[1]+s.b[1])/2,support=marbleSupport(path,x,z);if(s.gap)assert.equal(support,null);else assert.ok(Math.abs(support.height-(s.a[2]+s.b[2])/2)<1e-8);}}
});
test('bowling rewards a pocket hit without giving every roll a strike',()=>{
 function roll(angle,speed){const pins=bowlingPins(),ball={x:400,y:445,r:13,mass:7,vx:Math.sin(angle)*speed,vy:-Math.cos(angle)*speed};for(let i=0;i<320;i++)bowlingStep(ball,pins,1/120);return pins.filter(p=>p.down).length;}
 assert.equal(roll(.03,690),10);assert.ok(roll(0,450)<10);assert.ok(roll(.12,690)<5);assert.equal(roll(.35,690),0);
 const pins=bowlingPins();pins[0].vx=25;const gutter={x:275,y:450,r:13,mass:7,vx:0,vy:0,gutter:true};for(let i=0;i<120;i++)bowlingStep(gutter,pins,1/120);assert.equal(pins[0].down,false);
});
test('bridges grow upward while held, lower on release, and require a real landing',()=>{
 const run=newBridgeRun();bridgeStep(run,true,.5);assert.equal(run.phase,'growing');assert.equal(run.angle,0);assert.equal(run.length,85);bridgeStep(run,false,.01);assert.equal(run.phase,'lowering');
 assert.equal(bridgeLanding(200,{x:300,w:100},99),false);assert.equal(bridgeLanding(200,{x:300,w:100},150),true);assert.equal(bridgeLanding(200,{x:300,w:100},201),false);
 const good=newBridgeRun();for(let crossing=0;crossing<8;crossing++){const a=good.platforms[good.index],b=good.platforms[good.index+1],length=b.x+b.w/2-a.x-a.w;bridgeStep(good,true,length/170);bridgeStep(good,false,1/60);for(let i=0;i<600&&good.phase!=='ready'&&good.phase!=='won';i++)bridgeStep(good,false,1/60);}assert.equal(good.phase,'won');assert.equal(good.index,8);
 for(const length of [40,500]){const bad=newBridgeRun();bridgeStep(bad,true,length/170);bridgeStep(bad,false,.01);for(let i=0;i<600;i++)bridgeStep(bad,false,1/60);assert.equal(bad.phase,'lost');}
});
test('long Dash levels switch four modes, respond to flight controls and respawn at portals',()=>{
 for(const course of DASH_LEVELS){assert.ok(course.length/course.speed>50);assert.deepEqual(course.segments.map(s=>s.mode),['cube','ship','ball','wave']);
  const s=newDashRun();s.distance=course.segments[1].start-1;dashStep(s,{action:true},.01,course);assert.equal(s.mode,'ship');assert.ok(s.vy<0);const checkpoint=s.checkpoint;s.y=-100;dashStep(s,{},.01,course);assert.equal(s.lives,2);assert.ok(s.distance>=checkpoint&&s.distance<checkpoint+50);
  s.distance=course.segments[2].start-1;dashStep(s,{},.01,course);assert.equal(s.mode,'ball');dashStep(s,{action:true},.01,course);assert.equal(s.gravity,-1);
  s.distance=course.segments[3].start-1;dashStep(s,{},.01,course);assert.equal(s.mode,'wave');assert.ok(s.vy>0);dashStep(s,{action:true},.01,course);assert.ok(s.vy<0);
 }
});
test('all flight corridors can be traversed with a simple hold/release pilot',()=>{
 for(const course of DASH_LEVELS)for(const index of [1,3]){const s=newDashRun();s.distance=course.segments[index].start;const end=course.segments[index].end;let n=0;while(s.distance<end-5&&n++<2000){const band=dashCorridor(s.distance,course.segments[index].mode),center=(band.top+band.bottom)/2-15;dashStep(s,{action:s.y+s.vy*.18>center},1/60,course);}assert.equal(s.lives,3,course.name+': '+course.segments[index].mode);}
});
test('Rally tracks differ and road proximity follows their curves, not an ellipse',()=>{
 assert.equal(RALLY_COURSES.length,4);assert.equal(new Set(RALLY_COURSES.map(c=>c.theme)).size,4);
 for(const c of RALLY_COURSES){const curve=new THREE.CatmullRomCurve3(c.points.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal'),p=curve.getSpacedPoints(128).slice(0,-1);assert.ok(roadDistance(p,p[20].x,p[20].z)<.01);assert.ok(roadDistance(p,100,100)>c.width);assert.ok(curve.getLength()>150);}
 for(let i=0;i<3;i++){const path=marblePath(i);assert.ok(path.length>=11);assert.ok(path.filter(s=>s.gap).length>=2);}
});
test('banked space ship corners stay visible under sustained movement toward every edge',()=>{
 const camera=new THREE.PerspectiveCamera(50,1.6,.1,180);camera.position.set(0,3,24);camera.lookAt(0,0,7);camera.updateMatrixWorld();
 for(const dx of [-1,1])for(const dy of [-1,1]){const p={x:0,y:0,vx:0,vy:0};for(let i=0;i<600;i++){p.x+=dx*.18;p.y+=dy*.14;keepInFrame(p,camera,7,1.5,1.05);}
  for(const x of [-1.3,1.3])for(const y of [-.85,.85])for(const z of [-1,1]){const v=new THREE.Vector3(p.x+x,p.y+y,7+z).project(camera);assert.ok(Math.abs(v.x)<1&&Math.abs(v.y)<1,JSON.stringify(v));}
 }
});
test('software 3D draws the same scene when WebView denies WebGL',()=>{
 let fills=0,details='';const ctx=new Proxy({fill:()=>fills++},{get:(o,k)=>o[k]||(()=>{})});
 const canvas={getContext:type=>type==='webgl2'?null:ctx};
 const renderer=createGameRenderer(canvas,'light',s=>details=s);const scene=new THREE.Scene();scene.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:'#8de9df'})));const camera=new THREE.PerspectiveCamera(55,1.6,.1,100);camera.position.z=5;camera.lookAt(0,0,0);renderer.render(scene,camera);assert.ok(fills>0);assert.match(details,/Software 3D/);renderer.dispose();
});

test('all three games simulate and draw in software 3D, including reverse',()=>{
 for(const id of ['rally','marble','space']){
  let callback,status='',frames=0;global.requestAnimationFrame=fn=>(callback=fn,1);global.cancelAnimationFrame=()=>{};
  const ctx=new Proxy({fill:()=>frames++},{get:(o,k)=>o[k]||(()=>{})});const canvas={getContext:type=>type==='webgl2'?null:ctx,addEventListener(){},removeEventListener(){}};
  const input=id==='rally'?{down:true}:id==='space'?{action:true}:{};
  const game=mount3D(canvas,{id,input,onFinish:()=>{},onStatus:s=>status=s,quality:'light'});
  for(let i=1;i<=90;i++)callback(i*1000/60);
  assert.ok(frames>0);assert.ok(status.length>3&&!status.includes('NaN'));if(id==='rally')assert.match(status,/REVERSE/);
  game.pause(true);callback(91*1000/60);const draws=frames;for(let i=92;i<100;i++)callback(i*1000/60);assert.equal(frames,draws);game.dispose();
 }
});
