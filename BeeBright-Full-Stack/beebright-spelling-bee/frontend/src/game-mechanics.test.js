import test from 'node:test';
import assert from 'node:assert/strict';
import {collideDiscs,bowlingPins,bowlingStep,driveStep,marblePath,marbleSupport} from './game-mechanics.js';
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
