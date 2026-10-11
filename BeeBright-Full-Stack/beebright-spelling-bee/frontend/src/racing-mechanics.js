import * as THREE from 'three';
import {clamp} from './game-mechanics.js';
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function rallyRoad(course){
 const scale=course.scale??1.35,curve=new THREE.CatmullRomCurve3(course.points.map(([x,z],i)=>new THREE.Vector3(x*scale,course.heights[i],z*scale)),true,'centripetal');
 const points=curve.getSpacedPoints(384).slice(0,-1),lengths=[0];
 for(let i=0;i<points.length;i++)lengths.push(lengths.at(-1)+points[i].distanceTo(points[(i+1)%points.length]));
 return {points,lengths,length:lengths.at(-1),width:course.width,laps:course.laps};
}
function frame(road,i,u,lateral=0){const a=road.points[i],b=road.points[(i+1)%road.points.length],dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz),tx=dx/n,tz=dz/n;
 return {x:a.x+dx*u-tz*lateral,y:a.y+(b.y-a.y)*u,z:a.z+dz*u+tx*lateral,tx,tz,heading:Math.atan2(tz,tx),grade:(b.y-a.y)/n,progress:road.lengths[i]+(road.lengths[i+1]-road.lengths[i])*u,lateral};
}
export function rallySample(road,distance,lateral=0){const d=((distance%road.length)+road.length)%road.length;let lo=0,hi=road.points.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(road.lengths[mid+1]<d)lo=mid+1;else hi=mid;}
 return frame(road,lo,(d-road.lengths[lo])/(road.lengths[lo+1]-road.lengths[lo]),lateral);
}
export function rallyProject(road,x,z){let closest=null,distance=Infinity;
 for(let i=0;i<road.points.length;i++){const a=road.points[i],b=road.points[(i+1)%road.points.length],dx=b.x-a.x,dz=b.z-a.z,u=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),f=frame(road,i,u),d=Math.hypot(x-f.x,z-f.z);
  if(d<distance){distance=d;closest={...f,lateral:(x-f.x)*-f.tz+(z-f.z)*f.tx,distance:d};}
 }return closest;
}
export function rallyProgress(previous,next,length,maxTravel){let delta=next-previous;delta-=Math.round(delta/length)*length;return Math.abs(delta)<=maxTravel?delta:0;}
// Curvature ahead limits speed by lateral grip and available braking distance.
export function rallyCornerPlan(road,travel,cruise){let target=cruise,turn=0;const now=rallySample(road,travel),bend=rallySample(road,travel+14);turn=angle(bend.heading-now.heading);
 for(let d=0;d<=72;d+=8){const a=rallySample(road,travel+d),b=rallySample(road,travel+d+8),curvature=Math.abs(angle(b.heading-a.heading))/8;
  const corner=Math.min(cruise,Math.sqrt(8.5/Math.max(.0001,curvature)));target=Math.min(target,Math.sqrt(corner*corner+2*10*d));}
 return {speed:Math.max(9,target),lane:clamp(turn*5,-2.5,2.5),turn};
}
export function newRallyRace(road){const start=rallySample(road,0,0),player={...start,speed:0,steer:0,travel:0,previous:0,gates:0};
 const opponents=Array.from({length:4},(_,i)=>({travel:-7-i*6,lane:(i%2?1:-1)*2.8,speed:0,cruise:32+i*1.6,index:i,finished:false,steer:0,overtaking:false}));
 for(const car of opponents)Object.assign(car,rallySample(road,car.travel,car.lane));
 return {player,opponents,time:0,place:1,finished:false};
}
function drive(p,input,h,onRoad,grade){const throttle=Number(Boolean(input.up)),brake=Number(Boolean(input.down));
 p.speed-=grade*9.81*h;
 if(throttle)p.speed+=9.5*h;
 if(brake)p.speed-=p.speed>0?15*h:5*h;
 if(!throttle&&!brake)p.speed*=Math.exp(-.32*h);
 p.speed=clamp(p.speed,-8,onRoad?42:11);if(!onRoad)p.speed*=Math.exp(-1.7*h);
 const steering=Number(Boolean(input.right))-Number(Boolean(input.left));p.steer+=(steering-p.steer)*Math.min(1,h*10);
 p.heading+=p.steer*h*2*clamp(p.speed/9,-1,1)/(1+Math.abs(p.speed)*.022);
 p.x+=Math.cos(p.heading)*p.speed*h;p.z+=Math.sin(p.heading)*p.speed*h;
}
export function rallyStep(race,road,input,dt){
 const steps=Math.max(1,Math.ceil(dt*90)),h=dt/steps,p=race.player,finish=road.length*road.laps;
 for(let n=0;n<steps;n++){
  race.time+=h;let f=rallyProject(road,p.x,p.z),onRoad=f.distance<road.width/2;
  drive(p,input,h,onRoad,f.grade*Math.cos(p.heading-f.heading));f=rallyProject(road,p.x,p.z);p.y=f.y;
  const delta=rallyProgress(p.previous,f.progress,road.length,Math.abs(p.speed)*h+1);
  if(f.distance<road.width/2){p.travel+=delta;const next=(p.gates+1)*road.length/12;if(p.travel>=next&&p.travel-next<road.length/12*.5)p.gates++;}
  p.previous=f.progress;p.grade=f.grade*Math.cos(p.heading-f.heading);
  for(const car of race.opponents){if(car.finished)continue;
   const now=rallySample(road,car.travel),plan=rallyCornerPlan(road,car.travel,car.cruise),traffic=[{...p,lane:f.lateral},...race.opponents.filter(other=>other!==car)];
   let target=plan.speed,lane=plan.lane;car.overtaking=false;
   const blocker=traffic.find(other=>other.travel-car.travel>0&&other.travel-car.travel<Math.max(12,car.speed*.8)&&Math.abs(other.lane-car.lane)<2.3);
   if(blocker){const choices=[-3,3].sort((a,b)=>Math.abs(a-car.lane)-Math.abs(b-car.lane));
    const clear=choices.find(candidate=>traffic.every(other=>Math.abs(other.travel-car.travel)>12||Math.abs(other.lane-candidate)>2.35));
    if(clear!==undefined){lane=clear;car.overtaking=true;}else target=Math.min(target,Math.max(0,blocker.speed-1));
   }
   // Blend passing and apex lines instead of teleporting laterally.
   const priorLane=car.lane;car.lane+=clamp(lane-car.lane,-2.8*h,2.8*h);car.lane=clamp(car.lane,-road.width/2+1.5,road.width/2-1.5);
   for(const other of traffic){const gap=other.travel-car.travel;if(gap>0&&gap<5&&Math.abs(other.lane-car.lane)<2.2)target=Math.min(target,Math.max(0,other.speed-2));}
   car.speed+=clamp(target-car.speed,-12*h,(9.3-Math.max(0,now.grade)*9.81)*h);car.speed=Math.max(0,car.speed);car.travel+=car.speed*h;
   Object.assign(car,rallySample(road,car.travel,car.lane));car.heading+=Math.atan2((car.lane-priorLane)/h,Math.max(1,car.speed));car.steer=clamp(plan.turn,-.45,.45);
   if(car.travel>=finish){car.finished=true;car.finishTime=race.time;}
  }
  for(const car of race.opponents){const dx=p.x-car.x,dz=p.z-car.z,d=Math.hypot(dx,dz),radius=2.5;if(d<radius&&d>1e-6){const overlap=radius-d;p.x+=dx/d*overlap*.65;p.z+=dz/d*overlap*.65;car.lane=clamp(car.lane-(dx/d*-f.tz+dz/d*f.tx)*overlap*.35,-road.width/2+1.5,road.width/2-1.5);
    const closing=p.speed*Math.cos(p.heading-car.heading)-car.speed;if(closing>0){p.speed-=closing*.45;car.speed+=closing*.2;}}
  }
  race.place=1+race.opponents.filter(car=>car.finished||car.travel>p.travel).length;
  if(p.travel>=finish&&p.gates>=road.laps*12){race.finished=true;break;}
 }
 return race;
}
export function newRallyView(){return {cockpit:false,previous:false,changed:false};}
export function rallyViewStep(view,held){const pressed=Boolean(held);view.changed=pressed&&!view.previous;if(view.changed)view.cockpit=!view.cockpit;view.previous=pressed;return view.cockpit;}
