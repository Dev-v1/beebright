import * as THREE from 'three';
import {clamp,driveStep} from './game-mechanics.js';
export function rallyRoad(course){
 const curve=new THREE.CatmullRomCurve3(course.points.map(([x,z],i)=>new THREE.Vector3(x*1.35,course.heights[i],z*1.35)),true,'centripetal');
 const points=curve.getSpacedPoints(192).slice(0,-1),lengths=[0];
 for(let i=0;i<points.length;i++)lengths.push(lengths.at(-1)+points[i].distanceTo(points[(i+1)%points.length]));
 return {points,lengths,length:lengths.at(-1),width:course.width,laps:course.laps};
}
function frame(road,i,u,lateral=0){const a=road.points[i],b=road.points[(i+1)%road.points.length],dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz),tx=dx/n,tz=dz/n;
 return {x:a.x+dx*u-tz*lateral,y:a.y+(b.y-a.y)*u,z:a.z+dz*u+tx*lateral,tx,tz,heading:Math.atan2(tz,tx),grade:(b.y-a.y)/n,progress:road.lengths[i]+(road.lengths[i+1]-road.lengths[i])*u,lateral};
}
export function rallySample(road,distance,lateral=0){const d=((distance%road.length)+road.length)%road.length;let i=0;while(road.lengths[i+1]<d)i++;
 return frame(road,i,(d-road.lengths[i])/(road.lengths[i+1]-road.lengths[i]),lateral);
}
export function rallyProject(road,x,z){let closest=null,distance=Infinity;
 for(let i=0;i<road.points.length;i++){const a=road.points[i],b=road.points[(i+1)%road.points.length],dx=b.x-a.x,dz=b.z-a.z,u=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),f=frame(road,i,u),d=Math.hypot(x-f.x,z-f.z);
  if(d<distance){distance=d;closest={...f,lateral:(x-f.x)*-f.tz+(z-f.z)*f.tx,distance:d};}
 }return closest;
}
export function rallyProgress(previous,next,length,maxTravel){let delta=next-previous;delta-=Math.round(delta/length)*length;return Math.abs(delta)<=maxTravel?delta:0;}
export function newRallyRace(road){const start=rallySample(road,0,0),player={...start,speed:0,travel:0,previous:0,gates:0};
 const opponents=Array.from({length:4},(_,i)=>({travel:-5-i*5,lane:(i%2?1:-1)*(2.7+(i>1?.8:0)),speed:0,cruise:15.2+i*.45,index:i,finished:false}));
 for(const car of opponents)Object.assign(car,rallySample(road,car.travel,car.lane));
 return {player,opponents,time:0,place:1,finished:false};
}
export function rallyStep(race,road,input,dt){
 // Fixed substeps keep collisions and AI spacing stable after a slow frame.
 const steps=Math.max(1,Math.ceil(dt*90)),h=dt/steps,p=race.player,finish=road.length*road.laps;
 for(let n=0;n<steps;n++){
  race.time+=h;let f=rallyProject(road,p.x,p.z),onRoad=f.distance<road.width/2;
  p.speed-=f.grade*Math.cos(p.heading-f.heading)*9.81*h;driveStep(p,input,h,onRoad);
  f=rallyProject(road,p.x,p.z);p.y=f.y;
  const delta=rallyProgress(p.previous,f.progress,road.length,Math.abs(p.speed)*h+1);
  if(f.distance<road.width/2){p.travel+=delta;
   // Sequential checkpoint crossings prevent cutting hairpins to finish a lap.
   const next=(p.gates+1)*road.length/12;
   if(p.travel>=next&&p.travel-next<road.length/12*.5)p.gates++;
  }p.previous=f.progress;p.grade=f.grade*Math.cos(p.heading-f.heading);
  for(const car of race.opponents){if(car.finished)continue;
   const now=rallySample(road,car.travel,car.lane),look=rallySample(road,car.travel+12,car.lane),turn=Math.abs(Math.atan2(Math.sin(look.heading-now.heading),Math.cos(look.heading-now.heading)));
   let target=car.cruise*(1-Math.min(.48,turn*.55))-Math.max(0,now.grade)*8;
   const traffic=[p,...race.opponents.filter(other=>other!==car)];
   for(const other of traffic){const ahead=other.travel-car.travel;if(ahead>0&&ahead<7&&Math.hypot(other.x-now.x,other.z-now.z)<7&&Math.abs((other.lane??f.lateral)-car.lane)<2.1)target=Math.min(target,Math.max(2,(other.speed||0)-2));}
   car.speed+=clamp(target-car.speed,-11*h,7*h);car.travel+=car.speed*h;
   Object.assign(car,rallySample(road,car.travel,car.lane));
   if(car.travel>=finish){car.finished=true;car.finishTime=race.time;}
  }
  // Resolve actual car contact. Racing opponents cannot simply ghost through you.
  for(const car of race.opponents){const dx=p.x-car.x,dz=p.z-car.z,d=Math.hypot(dx,dz),radius=2.05;if(d<radius&&d>1e-6){const overlap=radius-d;p.x+=dx/d*overlap*.65;p.z+=dz/d*overlap*.65;car.lane=clamp(car.lane-(dx/d*-f.tz+dz/d*f.tx)*overlap*.35,-road.width/2+1.2,road.width/2-1.2);
    const closing=p.speed*Math.cos(p.heading-car.heading)-car.speed;if(closing>0){p.speed-=closing*.45;car.speed+=closing*.2;}}
  }
  race.place=1+race.opponents.filter(car=>car.finished||car.travel>p.travel).length;
  if(p.travel>=finish&&p.gates>=road.laps*12){race.finished=true;break;}
 }
 return race;
}
