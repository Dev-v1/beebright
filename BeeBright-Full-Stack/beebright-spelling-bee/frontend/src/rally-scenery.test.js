import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RALLY_COURSES} from './game-mechanics.js';
import {rallyRoad,rallySample} from './racing-mechanics.js';
import {rallyEnvironment,addRallyScenery,auroraCurtain} from './rally-scenery.js';

test('original tracks retain their scenery while all eight additions have different environments',()=>{
 assert.deepEqual(RALLY_COURSES.slice(0,4).map(c=>[c.name,c.width,c.scenery]),[['Harbor Circuit',20,undefined],['Canyon Switchback',18,undefined],['Alpine Hairpins',18,undefined],['Midnight Metro',20,undefined]]);
 const added=RALLY_COURSES.slice(4);
 assert.equal(added.length,8);assert.equal(new Set(added.map(c=>c.scenery)).size,8);
 assert.equal(new Set(added.map(c=>rallyEnvironment(c).sky)).size,8);
 for(const course of added){assert.ok(course.width>=18&&course.width<=20);assert.ok(rallyEnvironment(course).props);}
 assert.equal(added.filter(c=>rallyEnvironment(c).aurora).length,2);
});

test('aurora curtains form closed finite ribbons with visible color variation',()=>{
 for(const segments of [48,112]){
  const geometry=auroraCurtain(320,1.7,segments),positions=geometry.attributes.position,colors=geometry.attributes.color;
  assert.equal(positions.count,(segments+1)*2);assert.equal(geometry.index.count,segments*6);
  assert.ok(new Set(Array.from(colors.array).map(v=>v.toFixed(3))).size>20);
  for(const value of positions.array)assert.ok(Number.isFinite(value));
  for(const value of colors.array)assert.ok(value>=0&&value<=1);
  for(let j=0;j<2;j++)assert.ok(new THREE.Vector3().fromBufferAttribute(positions,j).distanceTo(new THREE.Vector3().fromBufferAttribute(positions,segments*2+j))<.001);
  geometry.dispose();
 }
});

test('all new scenery builds in both qualities and northern lights animate without casting shadows',()=>{
 for(const high of [false,true])for(const course of RALLY_COURSES.slice(4)){
  const scene=new THREE.Scene(),geometries=[],materials=[],road=rallyRoad(course);
  const mat=color=>{const m=new THREE.MeshStandardMaterial({color});materials.push(m);return m;};
  const mesh=(g,m,x=0,y=0,z=0,parent=scene)=>{geometries.push(g);const node=new THREE.Mesh(g,m);node.position.set(x,y,z);parent.add(node);return node;};
  const animate=addRallyScenery({course,road,high,scene,mesh,mat,sample:rallySample}),camera=new THREE.PerspectiveCamera();camera.position.set(30,4,-20);animate(2,camera);
  assert.ok(geometries.length>20,course.name);
  if(rallyEnvironment(course).aurora){const curtain=scene.getObjectByName('northern-lights-0'),before=curtain.rotation.y;assert.ok(curtain);assert.equal(curtain.castShadow,false);assert.equal(curtain.material.fog,false);assert.equal(curtain.parent.position.x,30);animate(8,camera);assert.notEqual(curtain.rotation.y,before);}
  for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
 }
});
