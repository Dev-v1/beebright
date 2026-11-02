import test from 'node:test';
import assert from 'node:assert/strict';
import {carContact,separateCars,HostRace,interpolatedCars} from './host-rally.js';
import {RALLY_COURSES} from './game-mechanics.js';
import {rallyRoad,rallyProject} from './racing-mechanics.js';

const car=(slot,x,z,heading=0,speed=0)=>({slot,x,z,y:0,heading,speed,travel:450,gates:7,finished:false});
test('front, rear, side and angled impacts separate bodies and preserve progress',()=>{
 for(const pair of [[car(0,0,0,0,40),car(1,4,0,Math.PI,35)],
  [car(0,0,0,0,40),car(1,4,0,0,10)],
  [car(0,0,0),car(1,0,1.3)],
  [car(0,0,0,Math.PI/4,20),car(1,1,1,-Math.PI/4,25)]]){
  assert.ok(carContact(...pair));separateCars(pair);
  assert.ok(!carContact(...pair)||carContact(...pair).depth<.002);
  for(const c of pair){assert.equal(c.travel,450);assert.equal(c.gates,7);assert.equal(c.finished,false);assert.ok(Number.isFinite(c.speed));}
 }
});
test('fast head-on cars cannot exchange sides and a crash does not reset them',()=>{
 const a=car(0,-8,0,0,70),b=car(1,8,0,Math.PI,70);
 for(let i=0;i<150;i++){a.x+=Math.cos(a.heading)*a.speed/120;b.x+=Math.cos(b.heading)*b.speed/120;separateCars([a,b]);assert.ok(a.x<b.x);}
 assert.equal(a.gates,7);assert.equal(b.travel,450);
});
test('coincident cars, pile-ups, finished cars and vertically separate roads',()=>{
 const pile=Array.from({length:5},(_,i)=>car(i,0,0));separateCars(pile);
 for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)assert.ok(!carContact(pile[i],pile[j])||carContact(pile[i],pile[j]).depth<.05);
 const stopped={...car(0,0,0),wasFinished:true},moving=car(1,3,0,Math.PI,30);
 separateCars([stopped,moving]);assert.equal(stopped.x,0);assert.ok(!carContact(stopped,moving));
 assert.equal(carContact(car(0,0,0),{...car(1,0,0),y:20}),null);
});
test('spatial road queries match exhaustive projection on every circuit',()=>{
 for(const course of RALLY_COURSES){const road=rallyRoad(course,1);for(let i=0;i<100;i++){
  const p=road.points[i*5%road.points.length],x=p.x+Math.sin(i)*40,z=p.z+Math.cos(i*2)*40;
  const fast=rallyProject(road,x,z),exact=rallyProject(road,x,z,true);
  for(const k of ['distance','progress','lateral','y'])assert.ok(Math.abs(fast[k]-exact[k])<1e-8);
 }}
});
test('host simulation uses local controls, preserves handoff positions and fills bot slots',()=>{
 const state={track:0,laps:1,time:0,cars:Array.from({length:5},(_,slot)=>({slot,distance:0,lane:(slot-2)*2.8,bot:slot>1,finished:false}))};
 const race=new HostRace(state);
 for(let i=0;i<60;i++)race.step(1/60,{0:{up:true}});
 const saved=race.snapshot();assert.ok(saved.cars[0].distance>1);
 assert.ok(saved.cars.slice(2).some(c=>c.distance>1));
 const transferred=new HostRace({...state,...saved});
 for(let i=0;i<5;i++){assert.equal(transferred.cars[i].x,saved.cars[i].x);assert.equal(transferred.cars[i].gates,saved.cars[i].gates);}
 race.membership(state.cars.map(c=>({...c,bot:c.slot!==0})));
 assert.equal(race.cars[1].human,false);
});
test('network interpolation follows the short heading arc without invalid coordinates',()=>{
 const a=car(0,0,0,Math.PI-.05),b=car(0,10,0,-Math.PI+.05);
 const output=interpolatedCars({current:{cars:[b]},previous:{cars:[a]},received:100,previousReceived:50},125)[0];
 assert.equal(output.x,5);assert.ok(Math.abs(Math.abs(output.heading)-Math.PI)<.01);
});
test('bots can overtake a solid finished car instead of getting stuck at the line',()=>{
 const length=rallyRoad(RALLY_COURSES[0],1).length;
 const state={track:0,laps:1,time:20,cars:Array.from({length:5},(_,slot)=>({slot,distance:slot?length-100:length,lane:slot?(slot-2)*2.8:0,speed:slot?25:0,bot:slot!==0,finished:slot===0,finishTime:slot===0?20:null,gates:slot===0?12:0}))};
 const race=new HostRace(state);
 for(let i=0;i<3600&&!race.cars.every(c=>c.finished);i++)race.step(1/60,{});
 assert.ok(race.cars.every(c=>c.finished));
});
