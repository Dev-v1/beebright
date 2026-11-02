import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGameRenderer} from './game-renderer.js';
import {mount3D} from './games-3d.js';
import {RALLY_COURSES} from './game-mechanics.js';
import {rallyRoad,rallySample} from './racing-mechanics.js';

test('software culling preserves visible and near-plane-crossing faces',()=>{
 const paths=[],ctx={fillRect(){},beginPath(){paths.push([]);},moveTo(x,y){paths.at(-1).push([x,y]);},lineTo(x,y){paths.at(-1).push([x,y]);},closePath(){},fill(){}};
 const canvas={getContext(type){return type==='2d'?ctx:null;}},renderer=createGameRenderer(canvas,'high');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,100);
 const triangle=(x,z)=>{const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([x-1,-1,-3,x+1,-1,-3,x,1,z],3));return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'red'}));};
 scene.add(triangle(0,-3),triangle(100,-3));renderer.render(scene,camera);
 assert.equal(paths.length,1);assert.equal(paths[0].length,3);
 paths.length=0;scene.clear();scene.add(triangle(0,.1));renderer.render(scene,camera);
 assert.equal(paths.length,1);assert.equal(paths[0].length,4);
 assert.ok(paths[0].flat().every(Number.isFinite));
});

test('network chase camera stays near the car when display frames arrive slowly',()=>{
 const originalLook=THREE.Object3D.prototype.lookAt,originalRAF=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame;
 let frame,cameraPosition,game;
 THREE.Object3D.prototype.lookAt=function(...args){if(this.isPerspectiveCamera)cameraPosition=this.position.clone();return originalLook.apply(this,args);};
 globalThis.requestAnimationFrame=fn=>(frame=fn,1);globalThis.cancelAnimationFrame=()=>{};
 try{
  const road=rallyRoad(RALLY_COURSES[0],1),network={slot:0,current:{time:0,cars:[]}};
  const update=distance=>{network.current.cars=Array.from({length:5},(_,slot)=>({...rallySample(road,distance+slot*8,0),slot,distance:distance+slot*8,speed:40,gates:0,finished:false}));};
  update(0);
  const ctx=new Proxy({},{get:()=>()=>{}}),canvas={getContext:type=>type==='2d'?ctx:null,addEventListener(){},removeEventListener(){}};
  game=mount3D(canvas,{id:'rally',network,input:{},quality:'light',onFinish(){},onStatus(){}});
  frame(1000);
  for(let i=1;i<=8;i++){update(i*20);frame(1000+i*500);}
  const car=network.current.cars[0];
  assert.ok(Math.hypot(cameraPosition.x-car.x,cameraPosition.z-car.z)<16,'Camera fell behind the real-time race');
 }finally{game?.dispose();THREE.Object3D.prototype.lookAt=originalLook;globalThis.requestAnimationFrame=originalRAF;globalThis.cancelAnimationFrame=originalCancel;}
});
