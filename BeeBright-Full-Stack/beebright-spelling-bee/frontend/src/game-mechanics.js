export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

// Impulse collisions in lane coordinates. No automatic neighbouring-pin removal.
export function collideDiscs(a,b,restitution=.65) {
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),r=a.r+b.r;
 if(d>=r||d<1e-8)return false;
 const nx=dx/d,ny=dy/d,ia=1/a.mass,ib=1/b.mass;
 const overlap=r-d; a.x-=nx*overlap*ia/(ia+ib);a.y-=ny*overlap*ia/(ia+ib);
 b.x+=nx*overlap*ib/(ia+ib);b.y+=ny*overlap*ib/(ia+ib);
 const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
 if(closing>=0)return false;
 const impulse=-(1+restitution)*closing/(ia+ib);
 a.vx-=impulse*nx*ia;a.vy-=impulse*ny*ia;b.vx+=impulse*nx*ib;b.vy+=impulse*ny*ib;
 return true;
}
export function bowlingPins(){const pins=[];for(let row=0;row<4;row++)for(let j=0;j<=row;j++)pins.push({x:400+(j-row/2)*30,y:180-row*29,r:11,mass:1.5,vx:0,vy:0,down:false,fall:0});return pins;}
export function bowlingStep(ball,pins,dt) {
 const steps=Math.ceil(dt/(1/120)),h=dt/steps;
 for(let k=0;k<steps;k++){
  ball.vx*=Math.exp(-.12*h);ball.vy*=Math.exp(-.12*h);ball.x+=ball.vx*h;ball.y+=ball.vy*h;
  if(ball.x<282||ball.x>518)ball.gutter=true;
  for(const p of pins){
   if(!ball.gutter&&collideDiscs(ball,p,.68)&&Math.hypot(p.vx,p.vy)>24)p.down=true;
   p.x+=p.vx*h;p.y+=p.vy*h;p.vx*=Math.exp(-2.8*h);p.vy*=Math.exp(-2.8*h);
   if(p.down)p.fall=Math.min(1,p.fall+h*5);
   for(const q of pins)if(q!==p&&collideDiscs(p,q,.45)&&Math.hypot(q.vx,q.vy)>24)q.down=true;
  }
 }
}
export function driveStep(p,input,dt,onRoad=true){
 const direction=Number(Boolean(input.up))-Number(Boolean(input.down));
 p.speed=clamp(p.speed+direction*14*dt,-7,onRoad?21:8);
 if(!direction)p.speed*=Math.exp(-1.25*dt);
 if(!onRoad)p.speed*=Math.exp(-1.5*dt);
 const turn=Number(Boolean(input.right))-Number(Boolean(input.left));
 p.heading+=turn*dt*1.7*clamp(p.speed/7,-1,1);
 p.x+=Math.cos(p.heading)*p.speed*dt;p.z+=Math.sin(p.heading)*p.speed*dt;
}
// Continuous paths, ramps, bridges, banked bends and landing pads. Original layouts.
export const MARBLE_COURSES=[
 {name:'Harbor Steps',width:5.2,points:[[0,3,0],[0,-12,0],[6,-23,1.6],[6,-39,1.6],[-5,-50,0],[-5,-67,0],[2,-79,2],[2,-94,2]],gaps:[]},
 {name:'Sky Switchback',width:4.4,points:[[0,3,0],[0,-13,0],[-8,-25,2],[-8,-41,2],[7,-53,4],[7,-69,4],[-4,-82,2],[-4,-99,2]],gaps:[4]},
 {name:'Ribbon Run',width:3.7,points:[[0,3,0],[0,-15,1],[9,-28,3],[9,-45,3],[-8,-59,5],[-8,-76,5],[5,-91,2],[5,-108,2],[0,-122,4]],gaps:[3,6]},
];
export function marblePath(level){const c=MARBLE_COURSES[level]||MARBLE_COURSES[0];return c.points.slice(1).map((b,i)=>{const a=c.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);return {a,b,length,width:c.width,gap:c.gaps.includes(i),index:i};});}
export function marbleSupport(segments,x,z){
 let best=null;
 for(const s of segments){const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],u=((x-s.a[0])*dx+(z-s.a[1])*dz)/(s.length*s.length);
  if(u<0||u>1||(s.gap&&u>.43&&u<.57))continue;
  const distance=Math.hypot(x-s.a[0]-dx*u,z-s.a[1]-dz*u);
  if(distance<=s.width/2&&(!best||distance<best.distance))best={height:s.a[2]+(s.b[2]-s.a[2])*u,distance,index:s.index};
 }return best;
}
