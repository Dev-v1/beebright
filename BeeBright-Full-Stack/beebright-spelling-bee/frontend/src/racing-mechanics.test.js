import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {RALLY_COURSES,marbleSurfaces,marblePath} from './game-mechanics.js';
import {rallyLapCount,rallyRoad,rallySample,rallyProject,rallyProgress,newRallyRace,rallyStep,rallyCornerPlan,newRallyView,rallyViewStep,rallyTransmission} from './racing-mechanics.js';
import {rallyRibbon,buildRallyCar} from './games-rally.js';
import {rallyTerrain,mountainHeight} from './rally-terrain.js';
import {marbleBoardGeometry} from './track-geometry.js';
import {rallyNavigation} from './rally-car.js';
test('navigation follows every car and reports the nearest opponent behind across lap progress',()=>{
 const road=rallyRoad(RALLY_COURSES[0]),race=newRallyRace(road);race.player.travel=road.length+10;race.opponents[0].travel=road.length+2;
 const before=rallyNavigation(road,race);assert.equal(before.markers.length,5);assert.equal(before.markers[1].gap,-8);assert.ok(before.path.every(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));
 Object.assign(race.opponents[0],rallySample(road,180),{travel:road.length+180});const after=rallyNavigation(road,race);assert.notDeepEqual(after.markers[1],before.markers[1]);assert.equal(after.markers[1].gap,170);assert.equal(after.markers[0].player,true);
});
test('racing roads are wider, genuinely inclined, and retain consistent projection',()=>{
 for(const course of RALLY_COURSES){const road=rallyRoad(course);assert.ok(course.width>=18);assert.ok(road.length>680);assert.equal(course.heights.length,course.points.length);assert.ok(Math.max(...course.heights)-Math.min(...course.heights)>=3);
  for(let d=0;d<road.length;d+=2){const f=rallySample(road,d),hit=rallyProject(road,f.x,f.z);assert.ok(hit.distance<1e-7);assert.ok(Math.abs(hit.y-f.y)<1e-7);assert.ok(Math.abs(hit.progress-f.progress)<1e-7);}
  const geo=rallyRibbon(road,-course.width/2,course.width/2),pos=geo.attributes.position;for(let i=0;i<pos.count;i++)assert.ok(Number.isFinite(pos.getY(i)));geo.dispose();
 }
});
test('passing lanes stay committed and steering changes continuously instead of hunting',()=>{
 const road=rallyRoad(RALLY_COURSES[0]),race=newRallyRace(road),car=race.opponents[0];Object.assign(car,rallySample(road,20,0),{travel:20,lane:0,speed:28,laneVelocity:0});Object.assign(race.player,rallySample(road,35,0),{travel:35,previous:35,speed:6});let pass=null,age=0,maxAcceleration=0;
 for(let i=0;i<180;i++){const prior=car.laneVelocity;rallyStep(race,road,{},1/90);maxAcceleration=Math.max(maxAcceleration,Math.abs(car.laneVelocity-prior)*90);if(car.pass&&!pass){pass=car.pass;age=car.pass.age;}if(pass&&car.pass&&car.pass.age<2.5){assert.equal(car.pass.lane,pass.lane);assert.ok(car.pass.age>=age);age=car.pass.age;}}
 assert.ok(pass,'a passing maneuver was started');assert.ok(maxAcceleration<=4.001);assert.ok(car.cruise>=42);
});
test('transmission shifts with hysteresis, reports reverse and drives cockpit animation',()=>{
 const p={speed:12,gear:1};rallyTransmission(p,1/60);assert.equal(p.gear,2);assert.equal(p.shift,.32);p.speed=10;rallyTransmission(p,.1);assert.equal(p.gear,2);assert.ok(p.shift<.32);p.speed=5;rallyTransmission(p,.1);assert.equal(p.gear,1);p.speed=-2;rallyTransmission(p,.1);assert.equal(p.gear,-1);assert.ok(p.rpm>=900&&p.rpm<=7400);
});
test('rally progress unwraps forward and reverse at the line and rejects teleports',()=>{
 assert.equal(rallyProgress(299,1,300,3),2);assert.equal(rallyProgress(1,299,300,3),-2);assert.equal(rallyProgress(10,170,300,3),0);
});
test('four opponents drive every circuit uphill and through corners without leaving its road',()=>{
 for(const course of RALLY_COURSES){const road=rallyRoad(course),race=newRallyRace(road);assert.equal(race.opponents.length,4);
  for(let i=0;i<20000&&!race.opponents.every(c=>c.finished);i++)rallyStep(race,road,{},1/60);
  assert.ok(race.opponents.every(c=>c.finished));assert.ok(race.opponents.every(c=>c.finishTime>=road.length*course.laps/(c.cruise*1.12)-1/60),'finishing time respects each rival\'s maximum cruise speed');assert.equal(race.finished,false,'AI finishing does not stop the player');
  for(const car of race.opponents){const hit=rallyProject(road,car.x,car.z);assert.ok(hit.distance<course.width/2);assert.ok(Math.abs(hit.y-car.y)<.2);}
 }
});
test('reverse does not award checkpoints, opponents collide, and missed gates block finishing',()=>{
 const road=rallyRoad(RALLY_COURSES[0]),race=newRallyRace(road);for(let i=0;i<120;i++)rallyStep(race,road,{down:true},1/60);assert.ok(race.player.speed<0);assert.equal(race.player.gates,0);assert.equal(race.finished,false);
 const testRace=newRallyRace(road),car=testRace.opponents[0];Object.assign(car,rallySample(road,1,0),{travel:1,lane:0,speed:0});testRace.player.speed=15;rallyStep(testRace,road,{up:true},1/60);assert.ok(testRace.player.speed<15,'rear impact reduces closing speed');
 testRace.player.travel=road.length*road.laps+1;testRace.player.gates=0;rallyStep(testRace,road,{},1/60);assert.equal(testRace.finished,false);
});
test('all High quality cars have curved bodies, reflective glass, and independently steering wheels',()=>{
 const group=new THREE.Group(),geometries=[],materials=[];const mat=color=>{const m=new THREE.MeshStandardMaterial({color});materials.push(m);return m;};const mesh=(g,m,x=0,y=0,z=0,parent=group)=>{geometries.push(g);const node=new THREE.Mesh(g,m);node.position.set(x,y,z);parent.add(node);return node;};
 const paint=new THREE.MeshPhysicalMaterial({color:'#d84e71',clearcoat:1}),car=buildRallyCar({high:true,paint,mesh,mat,parent:group});assert.equal(car.wheels.length,4);assert.equal(car.wheels.filter(w=>w.front).length,2);car.body.computeBoundingBox();assert.ok(car.body.boundingBox.max.x-car.body.boundingBox.min.x>4.4);assert.ok(car.body.attributes.position.count>200);assert.ok(car.canopy.children.length>=8);assert.ok(car.interior.children.length>=6);assert.equal(car.body.index.count%3,0);assert.ok(geometries.some(g=>g.type==='SphereGeometry'));assert.ok(materials.some(m=>m.roughness<.15));
 car.setCockpit(true);assert.equal(car.roof.visible,true);assert.equal(car.canopy.visible,false);assert.equal(car.roof.parent,group);assert.ok(car.glassPanes.every(p=>!p.visible));assert.equal(car.interior.visible,true);assert.ok(car.roof.position.y>1.4);
 car.setCockpit(false);assert.equal(car.roof.visible,true);assert.ok(car.glassPanes.every(p=>p.visible));assert.equal(car.interior.visible,false);
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();paint.dispose();
});
test('marble board geometry has positive top normals and no duplicated triangle faces',()=>{
 for(let level=0;level<3;level++){const surfaces=marbleSurfaces(marblePath(level)),geo=marbleBoardGeometry(surfaces),pos=geo.attributes.position,norm=geo.attributes.normal,seen=new Set();
  for(let i=0;i<pos.count;i+=3){const face=[0,1,2].map(j=>[pos.getX(i+j),pos.getY(i+j),pos.getZ(i+j)].join(',')).sort().join('|');assert.equal(seen.has(face),false);seen.add(face);if(i<surfaces.length*6&&i%6===0)assert.ok(norm.getY(i)>.9);}
  geo.dispose();
 }
});
test('every race can be finished through every checkpoint with ordinary driving inputs',()=>{
 for(const course of RALLY_COURSES){const road=rallyRoad(course),race=newRallyRace(road);let frames=0;
  while(!race.finished&&frames++<20000){const p=race.player,look=rallySample(road,p.travel+Math.max(8,p.speed*.4)),heading=Math.atan2(look.z-p.z,look.x-p.x),error=Math.atan2(Math.sin(heading-p.heading),Math.cos(heading-p.heading)),target=rallyCornerPlan(road,p.travel,38).speed;
   rallyStep(race,road,{up:p.speed<target,down:p.speed>target+1,right:error>.025,left:error<-.025},1/60);
  }assert.equal(race.finished,true,course.name);assert.equal(race.player.gates,course.laps*12);assert.ok(race.time>20);assert.ok(race.place>=1&&race.place<=5);
 }
});

test('camera switches once per press and holding R does not oscillate',()=>{
 const view=newRallyView();assert.equal(rallyViewStep(view,false),false);assert.equal(rallyViewStep(view,true),true);
 for(let i=0;i<120;i++)assert.equal(rallyViewStep(view,true),true);
 assert.equal(rallyViewStep(view,false),true);assert.equal(rallyViewStep(view,true),false);
});
test('opponents anticipate hairpins, exceed the old top speed and change lanes to pass slower traffic',()=>{
 const road=rallyRoad(RALLY_COURSES[0]),race=newRallyRace(road);let fastest=0,passing=false,laneTravel=0;
 const car=race.opponents[3],f=rallySample(road,20,0);Object.assign(car,f,{travel:20,lane:0,speed:26});Object.assign(race.player,rallySample(road,33,0),{travel:33,previous:33,speed:5});
 for(let i=0;i<600;i++){rallyStep(race,road,{},1/60);fastest=Math.max(fastest,...race.opponents.map(c=>c.speed));passing ||= race.opponents.some(c=>c.overtaking);laneTravel=Math.max(laneTravel,Math.abs(car.lane));}
 assert.ok(passing);assert.ok(fastest>25);assert.ok(laneTravel>1);
 const alpine=rallyRoad(RALLY_COURSES[2]);const speeds=Array.from({length:100},(_,i)=>rallyCornerPlan(alpine,i/100*alpine.length,38).speed);assert.ok(Math.min(...speeds)<18);assert.ok(Math.max(...speeds)>30);
});
test('Alpine terrain has mountains and a continuous road cutting below the asphalt',()=>{
 const course=RALLY_COURSES[2],road=rallyRoad(course),geo=rallyTerrain(course,road,true),pos=geo.attributes.position;let maximum=-Infinity;
 for(let i=0;i<pos.count;i++){maximum=Math.max(maximum,pos.getY(i));const f=rallyProject(road,pos.getX(i),pos.getZ(i));if(f.distance<course.width/2+8)assert.ok(pos.getY(i)<f.y-.7);}
 assert.ok(maximum>110);assert.ok(mountainHeight(course,155,115)>120);assert.ok(Math.max(...road.points.map(p=>p.y))>64);geo.dispose();
});

test('selected laps control checkpoint completion and invalid lap counts use the track default',()=>{
 for(const value of [1,3,10]){const road=rallyRoad(RALLY_COURSES[0],value),race=newRallyRace(road);assert.equal(road.laps,value);
  Object.assign(race.player,rallySample(road,0),{travel:road.length*value+1,previous:0,gates:value*12-2});rallyStep(race,road,{},1/90);assert.equal(race.finished,false);
  race.player.gates=value*12;rallyStep(race,road,{},1/90);assert.equal(race.finished,true);
 }
 for(const invalid of [0,11,-1,NaN,1.5,undefined,'3'])assert.equal(rallyLapCount(invalid),2);
});
test('grades blend continuously through every segment and the closed start-line seam',()=>{
 for(const course of RALLY_COURSES){const road=rallyRoad(course);
  for(const d of road.lengths){const a=rallySample(road,d-.00001),b=rallySample(road,d+.00001);assert.ok(Math.abs(a.grade-b.grade)<.00001);}
  for(let d=0;d<road.length;d+=1){const a=rallySample(road,d),b=rallySample(road,d+1);assert.ok(Math.abs(a.grade-b.grade)<.035,'no sudden incline steps');}
 }
});

test('new circuits have room between road sections and terrain under their full perimeter',()=>{
 for(const course of RALLY_COURSES.slice(4)){
  const road=rallyRoad(course),terrain=rallyTerrain(course,road,false);terrain.computeBoundingBox();
  const box=terrain.boundingBox;
  for(let i=0;i<road.points.length;i++){
   const p=road.points[i],margin=course.width/2+30;
   assert.ok(p.x-margin>box.min.x&&p.x+margin<box.max.x&&p.z-margin>box.min.z&&p.z+margin<box.max.z,course.name+' has ground beyond its shoulders');
   for(let j=i+1;j<road.points.length;j++){
    const along=Math.min(road.lengths[j]-road.lengths[i],road.length-road.lengths[j]+road.lengths[i]);
    if(along>course.width*3)assert.ok(Math.hypot(p.x-road.points[j].x,p.z-road.points[j].z)>course.width+8,course.name+' has no overlapping road sections');
   }
  }
  terrain.dispose();
 }
});
test('rivals accelerate past 40 metres per second while retaining corner braking',()=>{
 const road=rallyRoad(RALLY_COURSES[0]),race=newRallyRace(road);let fastest=0;
 assert.ok(race.opponents.every(c=>c.cruise>=52));
 for(let i=0;i<1800;i++){rallyStep(race,road,{},1/60);fastest=Math.max(fastest,...race.opponents.map(c=>c.speed));}
 assert.ok(fastest>40);assert.ok(rallyCornerPlan(road,0,60,11.5).speed<60);
});

