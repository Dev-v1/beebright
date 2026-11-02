import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGameRenderer} from './game-renderer.js';

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
