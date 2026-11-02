import {RALLY_COURSES} from './game-mechanics.js';
import {rallyRoad,rallySample,rallyProject,rallyStep,rallySurfacePose,newRallyRace} from './racing-mechanics.js';
import {rallyTerrain,rallyGroundHeight} from './rally-terrain.js';

// Oriented rectangles cover the complete body, rather than a point at its centre.
// Positive penetration means contact; height separates bridges from roads below.
export function carContact(a,b){
 if(Math.abs(a.y-b.y)>2.2||Math.hypot(a.x-b.x,a.z-b.z)>5.4)return null;
 const axes=[a.heading,a.heading+Math.PI/2,b.heading,b.heading+Math.PI/2];
 let depth=Infinity,normal;
 for(const angle of axes){const nx=Math.cos(angle),nz=Math.sin(angle);
  const extent=c=>2.45*Math.abs(Math.cos(c.heading-angle))+1.05*Math.abs(Math.sin(c.heading-angle));
  const signed=(b.x-a.x)*nx+(b.z-a.z)*nz,overlap=extent(a)+extent(b)-Math.abs(signed);
  if(overlap<=0)return null;
  if(overlap<depth){depth=overlap;const sign=signed<0?-1:1;normal={x:nx*sign,z:nz*sign};}
 }return {depth,...normal};
}
export function separateCars(cars){
 let contacts=0;
 for(let pass=0;pass<12;pass++){
  let touched=false;
  for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
   const a=cars[i],b=cars[j],hit=carContact(a,b);if(!hit)continue;
   const ma=a.wasFinished?0:1,mb=b.wasFinished?0:1,total=ma+mb;if(!total)continue;
   touched=true;contacts++;
   const move=hit.depth+.001;
   a.x-=hit.x*move*ma/total;a.z-=hit.z*move*ma/total;
   b.x+=hit.x*move*mb/total;b.z+=hit.z*move*mb/total;
   const vx=(Math.cos(b.heading)*b.speed-Math.cos(a.heading)*a.speed)*hit.x;
   const vz=(Math.sin(b.heading)*b.speed-Math.sin(a.heading)*a.speed)*hit.z;
   const closing=vx+vz;
   if(closing<0){const impulse=-closing*1.05/total;
    a.speed-=impulse*ma*(Math.cos(a.heading)*hit.x+Math.sin(a.heading)*hit.z);
    b.speed+=impulse*mb*(Math.cos(b.heading)*hit.x+Math.sin(b.heading)*hit.z);
   }
  }if(!touched)break;
 }return contacts;
}

export class HostRace {
 constructor(snapshot){
  this.road=rallyRoad(RALLY_COURSES[snapshot.track],snapshot.laps);
  const terrain=rallyTerrain(RALLY_COURSES[snapshot.track],this.road,true);
  this.road.groundHeight=(x,z)=>rallyGroundHeight(terrain,x,z);
  this.time=snapshot.time||0;
  const templates=newRallyRace(this.road).opponents;
  this.cars=snapshot.cars.map((meta,i)=>{
   const start=rallySample(this.road,meta.distance||0,meta.lane||0);
   const car={...templates[i%4],...start,slot:i,speed:0,steer:0,gates:0,travel:meta.distance||0,
    previous:start.progress,pass:null,laneVelocity:0,passCooldown:0,...meta,human:!meta.bot};
   car.travel=meta.distance||0;
   if(!Number.isFinite(meta.x))Object.assign(car,start);
   car.previous=rallyProject(this.road,car.x,car.z).progress;
   return car;
  });
  this.shadow={...this.cars[0]};
 }
 membership(cars){let changed=false;for(const meta of cars){const car=this.cars[meta.slot];changed ||= car.bot!==meta.bot;car.human=!meta.bot;car.bot=meta.bot;}if(changed)for(const c of this.cars)c.pass=null;}
 step(dt,inputs={}){
  // 120 Hz contacts prevent a fast car crossing another body between frames.
  const count=Math.max(1,Math.ceil(dt*120)),h=dt/count;
  for(let step=0;step<count;step++){
   for(const c of this.cars)c.wasFinished=Boolean(c.finished);
   for(const car of this.cars.filter(c=>c.human&&!c.finished)){
    const driver={player:car,opponents:[],time:this.time,place:1,finished:false};
    rallyStep(driver,this.road,inputs[car.slot]||{},h);
    car.lane=rallyProject(this.road,car.x,car.z).lateral;
    if(driver.finished){car.finished=true;car.finishTime=this.time+h;car.speed=0;}
   }
   const lead=this.cars.find(c=>c.human)||this.cars[0];
   const shadow=Object.assign(this.shadow,lead,{index:undefined});
   const bots={player:shadow,opponents:this.cars.filter(c=>c!==lead),time:this.time,place:1,finished:false,skipCollisions:true,solidFinish:true};
   rallyStep(bots,this.road,{},h);
   for(const car of this.cars)if(car.finished)car.speed=0;
   const before=this.cars.map(c=>rallyProject(this.road,c.x,c.z).progress);
   separateCars(this.cars);
   for(const car of this.cars){
    const point=rallyProject(this.road,car.x,car.z);
    let delta=point.progress-before[car.slot];delta-=Math.round(delta/this.road.length)*this.road.length;
    car.travel+=Math.max(-5,Math.min(5,delta));car.lane=point.lateral;car.previous=point.progress;
    rallySurfacePose(this.road,car);
   }
   this.time+=h;
  }
 }
 snapshot(){
  const fields=['x','y','z','heading','speed','steer','travel','lane','gates','previous','grade','crossGrade','gear','rpm','shift','finishTime'];
  return {time:this.time,cars:this.cars.map(c=>{const value={slot:c.slot,finished:Boolean(c.finished),distance:c.travel};for(const f of fields)if(Number.isFinite(c[f]))value[f]=c[f];return value;})};
 }
}

// Smooth 20 Hz network snapshots at the display's refresh rate. Heading takes
// the short way around the angle seam; each wheel uses this interpolated pose.
export function interpolatedCars(network,now){
 const latest=network.current;if(!latest)return [];
 const older=network.previous;
 if(!older||!network.received||!network.previousReceived)return latest.cars;
 const span=Math.max(16,Math.min(150,network.received-network.previousReceived));
 const u=Math.max(0,Math.min(1,(now-network.received)/span));
 return latest.cars.map((c,i)=>{const a=older.cars[i];if(!a||!Number.isFinite(c.x)||!Number.isFinite(a.x))return c;
  const value={...c};for(const k of ['x','y','z','speed','steer','grade','crossGrade'])value[k]=a[k]+((c[k]??0)-a[k])*u;
  value.heading=a.heading+Math.atan2(Math.sin(c.heading-a.heading),Math.cos(c.heading-a.heading))*u;
  return value;
 });
}
