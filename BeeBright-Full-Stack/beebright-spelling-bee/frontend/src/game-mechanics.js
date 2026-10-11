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
export function bowlingPins(){const pins=[];for(let row=0;row<4;row++)for(let j=0;j<=row;j++)pins.push({x:400+(j-row/2)*30,y:180-row*29,r:8,mass:1.6,vx:0,vy:0,down:false,fall:0,tilt:0});return pins;}
export function bowlingStep(ball,pins,dt) {
 const steps=Math.ceil(dt/(1/120)),h=dt/steps;
 for(let k=0;k<steps;k++){
  ball.vx*=Math.exp(-.12*h);ball.vy*=Math.exp(-.12*h);ball.x+=ball.vx*h;ball.y+=ball.vy*h;
  if(ball.x<282||ball.x>518)ball.gutter=true;
  for(const p of pins)if(!ball.gutter&&collideDiscs(ball,p,.36))p.tilt+=Math.hypot(p.vx,p.vy)*.0015;
  for(let i=0;i<pins.length;i++)for(let j=i+1;j<pins.length;j++){
   const a=pins[i],b=pins[j];if(collideDiscs(a,b,.28)){a.tilt+=Math.hypot(a.vx,a.vy)*.0018;b.tilt+=Math.hypot(b.vx,b.vy)*.0018;}
  }
  for(const p of pins){
   p.x+=p.vx*h;p.y+=p.vy*h;const speed=Math.hypot(p.vx,p.vy);
   // An upright pin can slide and recover. Only enough tipping energy knocks it down.
   if(!p.down){p.tilt+=speed*speed*.000035*h;p.tilt*=Math.exp(-2.3*h);if(p.tilt>.32)p.down=true;}
   p.vx*=Math.exp(-(p.down?1.5:4.2)*h);p.vy*=Math.exp(-(p.down?1.5:4.2)*h);
   if(p.down){p.fall=Math.min(1,p.fall+h*5);p.r=8+p.fall*6;}
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
 {name:'Skyline Sprint',width:4.5,time:65,points:[[0,3,0],[0,-15,0],[7,-29,2],[7,-46,2],[-6,-59,3],[-6,-76,3],[5,-91,1],[5,-109,1],[0,-123,3],[0,-141,3],[-7,-155,2],[-7,-172,2]],gaps:[3,7],hazards:[2,5,9],boosts:[0,6]},
 {name:'Switchback Foundry',width:3.8,time:80,points:[[0,3,0],[0,-16,1],[-9,-30,3],[-9,-49,3],[8,-65,5],[8,-84,5],[-7,-100,3],[-7,-119,3],[6,-136,6],[6,-155,6],[-5,-171,2],[-5,-190,2],[0,-207,4]],gaps:[2,5,9],hazards:[1,4,7,10],boosts:[0,6]},
 {name:'Cloudbreak Gauntlet',width:3.2,time:90,points:[[0,3,0],[0,-17,2],[10,-34,4],[10,-53,4],[-9,-70,7],[-9,-89,7],[8,-105,4],[8,-125,4],[-8,-142,8],[-8,-163,8],[7,-181,5],[7,-201,5],[0,-220,3],[0,-240,6]],gaps:[2,5,8,11],hazards:[1,4,7,10,12],boosts:[0,6]},
];
export function marblePath(level){const c=MARBLE_COURSES[level]||MARBLE_COURSES[0];return c.points.slice(1).map((b,i)=>{const a=c.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);return {a,b,length,width:c.width,gap:c.gaps.includes(i),index:i};});}
// One mitered ribbon: neighbouring boards share their edge, never overlap.
// Collision and rendering use the same top triangles, including jump openings.
export function marbleSurfaces(segments){
 const frames=segments.map(s=>({dx:(s.b[0]-s.a[0])/s.length,dz:(s.b[1]-s.a[1])/s.length}));
 const sections=segments.map((s,i)=>{
  const prev=frames[Math.max(0,i-1)],next=frames[i];let nx=-prev.dz-next.dz,nz=prev.dx+next.dx,n=Math.hypot(nx,nz);nx/=n;nz/=n;
  const miter=Math.min(2,1/Math.max(.5,nx*-next.dz+nz*next.dx)),w=s.width/2*miter;
  return [[s.a[0]+nx*w,s.a[2],s.a[1]+nz*w],[s.a[0]-nx*w,s.a[2],s.a[1]-nz*w]];
 });
 const last=segments.at(-1),f=frames.at(-1);sections.push([[last.b[0]-f.dz*last.width/2,last.b[2],last.b[1]+f.dx*last.width/2],[last.b[0]+f.dz*last.width/2,last.b[2],last.b[1]-f.dx*last.width/2]]);
 const surfaces=[];
 for(let i=0;i<segments.length;i++){const s=segments[i],{dx,dz}=frames[i];
  const section=u=>sections[i].map((v,j)=>v.map((c,k)=>c+(sections[i+1][j][k]-c)*u));
  for(const [start,end] of s.gap?[[0,.43],[.57,1]]:[[0,1]]){
   const [a,b]=section(start),[c,d]=section(end),m=a.map((v,k)=>(v+b[k])/2),n=c.map((v,k)=>(v+d[k])/2);
   for(const vertices of [[a,m,n],[a,n,c],[m,b,d],[m,d,n]]){
    const [v,w,q]=vertices,ax=w[0]-v[0],az=w[2]-v[2],ay=w[1]-v[1],bx=q[0]-v[0],bz=q[2]-v[2],by=q[1]-v[1],det=ax*bz-az*bx;
    surfaces.push({vertices,x:v[0],y:v[1],z:v[2],slopeX:(ay*bz-az*by)/det,slopeZ:(ax*by-ay*bx)/det,dx,dz,length:s.length,width:s.width,index:s.index,start,end,origin:s.a});
   }
  }
 }return surfaces;
}
function surfaceAt(s,x,z){
 if(s.vertices){const [a,b,c]=s.vertices,dx=x-a[0],dz=z-a[2],bx=b[0]-a[0],bz=b[2]-a[2],cx=c[0]-a[0],cz=c[2]-a[2],det=bx*cz-bz*cx,u=(dx*cz-dz*cx)/det,v=(bx*dz-bz*dx)/det;
  if(u< -1e-8||v< -1e-8||u+v>1+1e-8)return null;
  const along=(x-s.origin[0])*s.dx+(z-s.origin[1])*s.dz;
  return {...s,height:s.y+s.slopeX*(x-s.x)+s.slopeZ*(z-s.z),u:along/s.length};
 }
 return null;
}
export function marbleSupport(segments,x,z){let best=null;for(const s of marbleSurfaces(segments)){const hit=surfaceAt(s,x,z);if(hit&&(!best||hit.height>best.height))best=hit;}return best;}
export const MARBLE_RADIUS=.55;
export function marbleStart(surfaces){const s=surfaces[0],x=s.origin[0]+s.dx*.8,z=s.origin[1]+s.dz*.8,hit=surfaces.find(t=>surfaceAt(t,x,z)),n=Math.hypot(hit.slopeX,1,hit.slopeZ);
 return {x:x-hit.slopeX/n*MARBLE_RADIUS,z:z-hit.slopeZ/n*MARBLE_RADIUS,y:hit.y+hit.slopeX*(x-hit.x)+hit.slopeZ*(z-hit.z)+MARBLE_RADIUS/n};
}
function planeContact(s,p){
 const length=Math.hypot(s.slopeX,1,s.slopeZ),nx=-s.slopeX/length,ny=1/length,nz=-s.slopeZ/length;
 const distance=(p.y-s.y-s.slopeX*(p.x-s.x)-s.slopeZ*(p.z-s.z))/length;
 const hit=surfaceAt(s,p.x-nx*distance,p.z-nz*distance);
 return hit?{...hit,nx,ny,nz,distance:distance-MARBLE_RADIUS}:null;
}
function projectVelocity(p,c){const v=p.vx*c.nx+p.vy*c.ny+p.vz*c.nz;p.vx-=v*c.nx;p.vy-=v*c.ny;p.vz-=v*c.nz;return v;}
// Fixed substeps and signed sphere/plane crossings prevent tunnelling on ramps.
// Ground acceleration uses the solid-sphere rolling factor 1/(1+2/5).
export function marbleStep(p,input,dt,surfaces,{jump=false,boost=false}={}){
 const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;let contact=null;
 for(let i=0;i<steps;i++){
  contact=null;for(const s of surfaces){const c=planeContact(s,p);if(c&&Math.abs(c.distance)<.025&&(!contact||c.height>contact.height))contact=c;}
  if(contact){p.x-=contact.nx*contact.distance;p.y-=contact.ny*contact.distance;p.z-=contact.nz*contact.distance;projectVelocity(p,contact);p.grounded=true;}else p.grounded=false;
  if(jump&&i===0&&contact){p.vx+=contact.nx*8;p.vy+=contact.ny*8;p.vz+=contact.nz*8;contact=null;p.grounded=false;}
  let ax=Number(Boolean(input.right))-Number(Boolean(input.left)),az=Number(Boolean(input.down))-Number(Boolean(input.up));const inputLength=Math.hypot(ax,az)||1;ax/=inputLength;az/=inputLength;
  const before={...p},acceleration=contact?24*5/7:3.5;
  let fx=ax*acceleration,fy=-19,fz=az*acceleration;
  if(contact){const dot=fx*contact.nx+fy*contact.ny+fz*contact.nz;fx-=dot*contact.nx;fy-=dot*contact.ny;fz-=dot*contact.nz;
   // Gravity contributes rolling acceleration rather than free-fall acceleration.
   fx+=19*contact.ny*contact.nx*(5/7-1);fy+=(-19+19*contact.ny*contact.ny)*(5/7-1);fz+=19*contact.ny*contact.nz*(5/7-1);
  }
  p.vx+=fx*h;p.vy+=fy*h;p.vz+=fz*h;
  if(contact){const decay=Math.exp(-(input.spinLeft?8:1.2)*h);p.vx*=decay;p.vy*=decay;p.vz*=decay;const speed=Math.hypot(p.vx,p.vy,p.vz),limit=boost?13:9.8;if(speed>limit){p.vx*=limit/speed;p.vy*=limit/speed;p.vz*=limit/speed;}}
  p.x+=p.vx*h;p.y+=p.vy*h;p.z+=p.vz*h;p.grounded=false;
  // Resolve only contact approached from above, never rescue a ball below the track.
  for(let pass=0;pass<2;pass++)for(const s of surfaces){const c=planeContact(s,p);if(!c||c.distance>.002)continue;
   const oldDistance=(before.y-s.y-s.slopeX*(before.x-s.x)-s.slopeZ*(before.z-s.z))/Math.hypot(s.slopeX,1,s.slopeZ)-MARBLE_RADIUS;
   const vn=p.vx*c.nx+p.vy*c.ny+p.vz*c.nz;if(oldDistance<-.025||vn>.1)continue;
   const correction=-c.distance;p.x+=c.nx*correction;p.y+=c.ny*correction;p.z+=c.nz*correction;
   if(vn<0)projectVelocity(p,c);p.grounded=true;contact=c;
  }
 }return p.grounded?contact:null;
}

export const RALLY_COURSES=[
 {name:'Harbor Circuit',width:14,scale:2.8,heights:[0,2,6,9,5,2,0,1,3,1],laps:2,theme:'harbor',points:[[28,0],[25,25],[0,34],[-27,23],[-38,-5],[-26,-30],[-6,-36],[7,-18],[23,-30],[37,-16]]},
 {name:'Canyon Switchback',width:13,scale:2.8,heights:[0,8,18,12,4,0,7,20,13,5,2,10,5],laps:2,theme:'canyon',points:[[30,0],[32,24],[9,29],[4,10],[-13,9],[-14,32],[-36,23],[-34,-20],[-14,-30],[-2,-10],[13,-15],[17,-33],[34,-25]]},
 {name:'Alpine Hairpins',width:13,scale:1,heights:[0,8,20,36,46,60,65,58,53,47,40,36,28,18,8,4,2,0,0],laps:2,theme:'alpine',mountains:[[-35,155,110,90],[155,115,145,80],[-170,95,135,85],[0,-180,90,80]],points:[[145,-100],[170,-35],[140,35],[80,60],[70,120],[0,150],[-65,110],[-35,70],[25,80],[30,40],[-40,25],[-115,55],[-150,0],[-135,-65],[-75,-90],[-45,-40],[15,-55],[55,-100],[80,-145]]},
 {name:'Midnight Metro',width:14,scale:2.8,heights:[0,2,6,4,0,0,10,15,8,2,0,0,3,0,5],laps:2,theme:'city',points:[[35,0],[34,28],[10,29],[8,12],[-10,12],[-12,32],[-34,28],[-36,4],[-20,2],[-20,-18],[-35,-20],[-25,-36],[3,-34],[7,-17],[32,-24]]},
];
export function roadDistance(points,x,z){let best=Infinity;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,u=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);best=Math.min(best,Math.hypot(x-a.x-dx*u,z-a.z-dz*u));}return best;}
export function bridgeLanding(start,next,length){const tip=start+length;return tip>=next.x&&tip<=next.x+next.w;}
export function bridgePlatforms(count=9){const p=[{x:65,w:135}];for(let i=1;i<count;i++){const previous=p.at(-1);p.push({x:previous.x+previous.w+100+(i*83%160),w:75+(i*47%85)});}return p;}
export function newBridgeRun(){return {platforms:bridgePlatforms(),index:0,phase:'ready',length:0,angle:0,x:175,y:365,score:0,previous:false,camera:0};}
export function bridgeStep(s,held,dt){
 const current=s.platforms[s.index],next=s.platforms[s.index+1],start=current.x+current.w;
 if(s.phase==='ready'&&held){s.phase='growing';s.length=0;s.angle=0;}
 if(s.phase==='growing'){if(held)s.length=Math.min(520,s.length+170*dt);else{s.phase='lowering';s.angle=0;}}
 else if(s.phase==='lowering'){s.angle=Math.min(Math.PI/2,s.angle+dt*2.8);if(s.angle===Math.PI/2)s.phase='crossing';}
 else if(s.phase==='crossing'){
  s.x+=155*dt;
  if(s.x>start+s.length&&!bridgeLanding(start,next,s.length))s.phase='falling';
  else if(bridgeLanding(start,next,s.length)&&s.x>=next.x+next.w-22){s.index++;s.score+=100+(Math.abs(start+s.length-next.x-next.w/2)<12?100:0);s.length=0;s.angle=0;s.phase=s.index===s.platforms.length-1?'won':'ready';}
 }else if(s.phase==='falling'){s.y+=310*dt;if(s.y>550)s.phase='lost';}
 s.camera+=(Math.max(0,current.x-65)-s.camera)*Math.min(1,dt*5);s.previous=held;return s.phase;
}
export function newDashRun(){return {distance:0,y:392,vy:0,grounded:true,gravity:1,mode:'cube',previous:false,lives:3,checkpoint:0,flash:0};}
export function dashCorridor(distance,mode){const center=245+Math.sin(distance/430)*55;return {top:center-(mode==='wave'?110:125),bottom:center+(mode==='wave'?110:125)};}
export function dashStep(s,input,dt,course){
 const held=Boolean(input.action),action=held&&!s.previous;s.previous=held;s.distance+=course.speed*dt;s.flash=Math.max(0,s.flash-dt);
 const segment=course.segments.find(a=>s.distance<a.end)||course.segments.at(-1);
 if(segment.mode!==s.mode){s.mode=segment.mode;s.checkpoint=segment.start;s.y=s.mode==='cube'?392:235;s.vy=0;s.gravity=1;s.grounded=true;s.flash=.45;}
 let hit=false;
 if(s.mode==='cube'){
  if(held&&s.grounded){s.vy=-510;s.grounded=false;}s.vy+=1400*dt;s.y=Math.min(392,s.y+s.vy*dt);s.grounded=s.y>=392;if(s.grounded)s.vy=0;
  for(const b of course.blocks)if(s.distance+30>b.x&&s.distance<b.x+b.w&&s.y+30>422-b.h){s.y=422-b.h-30;s.vy=Math.min(0,s.vy);s.grounded=true;}
  hit=course.spikes.some(x=>Math.abs(s.distance-x-16)<22&&s.y+25>400);
 }else if(s.mode==='ball'){
  if(action){s.gravity*=-1;s.vy=s.gravity*140;}s.vy=clamp(s.vy+s.gravity*900*dt,-400,400);s.y=clamp(s.y+s.vy*dt,90,392);if(s.y===90||s.y===392)s.vy=0;
  hit=course.spikes.filter(x=>x>=segment.start&&x<segment.end).some((x,i)=>Math.abs(s.distance-x)<34&&(i%2===0?s.y>330:s.y<140));
 }else{
  if(s.mode==='ship')s.vy=clamp(s.vy+(held?-850:700)*dt,-245,245);else s.vy=held?-210:210;
  s.y+=s.vy*dt;const corridor=dashCorridor(s.distance,s.mode);hit=s.y<corridor.top+12||s.y+30>corridor.bottom-12;
 }
 if(hit){s.lives--;if(!s.lives)return 'lost';s.distance=s.checkpoint+40;s.y=s.mode==='cube'?392:235;s.vy=0;s.gravity=1;s.grounded=true;s.flash=.7;}
 return s.distance>=course.length?'won':'playing';
}
// Clamp the whole ship, including banked wings, inside the projected camera frame.
export function keepInFrame(p,camera,z=7,marginX=1.25,marginY=.75){
 const V=camera.position.constructor,point=new V(p.x,p.y,z),depth=new V(0,0,z).sub(camera.position).length(),halfH=Math.tan(camera.fov*Math.PI/360)*depth;
 const maxX=Math.min(.82,1-marginX/(halfH*camera.aspect)),maxY=Math.min(.78,1-marginY/halfH);
 const projected=point.project(camera),x=clamp(projected.x,-maxX,maxX),y=clamp(projected.y,-maxY,maxY);
 const ray=new V(x,y,.5).unproject(camera).sub(camera.position),factor=(z-camera.position.z)/ray.z;
 const bounded=camera.position.clone().addScaledVector(ray,factor);if(Math.abs(p.x-bounded.x)>.001)p.vx=0;if(Math.abs(p.y-bounded.y)>.001)p.vy=0;p.x=bounded.x;p.y=bounded.y;
}
