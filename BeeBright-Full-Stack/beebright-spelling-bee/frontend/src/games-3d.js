import * as THREE from 'three';
import {createGameRenderer} from './game-renderer.js';
import {clamp,driveStep,MARBLE_COURSES,marblePath,marbleSupport} from './game-mechanics.js';
export function mount3D(canvas,{id,level=0,input,onFinish,onStatus,onGraphics,quality='light'}) {
 const high=quality==='high',renderer=createGameRenderer(canvas,quality,onGraphics);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#10182d');scene.fog=new THREE.Fog('#10182d',45,160);
 const camera=new THREE.PerspectiveCamera(58,1.6,.1,180);scene.add(new THREE.HemisphereLight(0xe0f5ff,0x253955,2.1));
 const light=new THREE.DirectionalLight(0xffffff,2.2);light.position.set(8,18,10);light.castShadow=high;light.shadow.mapSize.set(1024,1024);scene.add(light);
 const materials=[],geometries=[];const mat=color=>{const m=new THREE.MeshStandardMaterial({color,roughness:high?.35:.75,metalness:high?.3:.1});materials.push(m);return m;};
 const teal=mat('#8de9df'),purple=mat('#b4a2ef'),stone=mat('#7b93bd'),green=mat('#abec9e'),pink=mat('#f691ba'),white=mat('#e6efff');
 function mesh(geometry,material,x=0,y=0,z=0,parent=scene){geometries.push(geometry);const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=high;m.receiveShadow=high;parent.add(m);return m;}
 function box(x,y,z,w,h,d,material=stone){return mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z);}
 let animation,last=0,t=0,paused=false,done=false,score=0,status='',redraw=true;
 const p={x:0,y:.56,z:3,vx:0,vz:0,vy:0,speed:0,heading:Math.PI/2};
 const player=new THREE.Group();scene.add(player);let ball,course,segments,crystals=[],taken=0,checkpoint={x:0,z:3,y:.56},falls=0,grounded=true;
 let laps=0,gate=1,gates=[],track=[],raceTime=0;
 let enemies=[],shots=[],enemyShots=[],particles=[],pickups=[],wave=0,kills=0,shield=5,immune=0,fire=0,spawnTimer=0,completedWaves=0;
 function finish(won,text){if(done)return;done=true;onFinish({won,text,score:Math.round(Math.max(0,score))});}
 function notify(s){if(s!==status){status=s;onStatus(s);}}
 function remove(object){object.removeFromParent();if(object.geometry){object.geometry.dispose();const i=geometries.indexOf(object.geometry);if(i>=0)geometries.splice(i,1);}}
 function ship(material,size=1,parent=scene){const group=new THREE.Group();parent.add(group);mesh(new THREE.ConeGeometry(.5*size,1.7*size,4),material,0,0,0,group).rotation.x=-Math.PI/2;mesh(new THREE.BoxGeometry(1.7*size,.13*size,.65*size),material,0,0,.35*size,group);mesh(new THREE.SphereGeometry(.23*size,8,6),white,0,.18*size,.1*size,group);return group;}
 function destroyShip(group){for(const child of [...group.children])remove(child);group.removeFromParent();}
 if(id==='marble'){
  course=MARBLE_COURSES[level]||MARBLE_COURSES[0];segments=marblePath(level);ball=mesh(new THREE.SphereGeometry(.55,high?24:12,high?16:8),teal,0,0,0,player);
  for(const s of segments){
   for(const [start,end] of s.gap?[[0,.43],[.57,1]]:[[0,1]]){
    const a=new THREE.Vector3(s.a[0],s.a[2]-.18,s.a[1]),b=new THREE.Vector3(s.b[0],s.b[2]-.18,s.b[1]);const pa=a.clone().lerp(b,start),pb=a.clone().lerp(b,end),d=pb.clone().sub(pa);const platform=box((pa.x+pb.x)/2,(pa.y+pb.y)/2,(pa.z+pb.z)/2,s.width,.35,d.length(),s.index%2?purple:stone);platform.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d.clone().normalize());
    if(level===0){const normal=new THREE.Vector3(-d.z,0,d.x).normalize();for(const side of [-1,1]){const center=pa.clone().lerp(pb,.5).addScaledVector(normal,side*s.width/2);const rail=box(center.x,center.y+.35,center.z,.14,.5,d.length(),teal);rail.quaternion.copy(platform.quaternion);}}
   }
   const b=s.b;crystals.push({mesh:mesh(new THREE.OctahedronGeometry(.35),green,b[0],b[2]+1,b[1]+2),taken:false});
   if(s.index%2===1)box(b[0],b[2]-.08,b[1],s.width+.5,.16,3,teal);
  }
  const end=course.points.at(-1);mesh(new THREE.TorusGeometry(1.2,.15,6,16),pink,end[0],end[2]+1.4,end[1]);
  camera.position.set(0,8,14);camera.lookAt(0,0,-3);
 }else if(id==='rally'){
  p.x=27;p.y=.4;p.z=0;
  box(0,-.25,0,100,.3,85,mat('#20384a'));const count=64;
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2,b=(i+1)/count*Math.PI*2,x=27*Math.cos(a),z=18*Math.sin(a),x2=27*Math.cos(b),z2=18*Math.sin(b),d=new THREE.Vector3(x2-x,0,z2-z);const m=box((x+x2)/2,0,(z+z2)/2,7,.15,d.length()+.15,i%8===0?purple:stone);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d.normalize());track.push(m);if(i%8===0)gates.push({x,z});if(high||i%4===0){mesh(new THREE.SphereGeometry(.18,6,4),pink,x*1.15,.5,z*1.15);}}
  box(0,0,0,30,.5,18,purple);box(0,2,0,12,4,7,stone);
  mesh(new THREE.BoxGeometry(2.8,.7,1.5),pink,0,.3,0,player);mesh(new THREE.BoxGeometry(1.15,.5,1.3),teal,-.1,.9,0,player);
  for(const x of [-.9,.9])for(const z of [-.85,.85]){const wheel=mesh(new THREE.CylinderGeometry(.34,.34,.24,10),stone,x,.15,z,player);wheel.rotation.x=Math.PI/2;}
  camera.position.set(40,24,25);camera.lookAt(p.x,0,p.z);
 }else{
  ship(teal,1,player);p.y=0;p.z=7;camera.position.set(0,5,24);camera.lookAt(0,0,-16);
  const n=high?500:160,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*100;pos[i*3+1]=(Math.random()-.5)*80;pos[i*3+2]=-Math.random()*120;}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geometries.push(geo);const m=new THREE.PointsMaterial({color:0xbecff6,size:.13});materials.push(m);scene.add(new THREE.Points(geo,m));
  // Visible nebula lanterns also appear in software projection.
  for(let i=0;i<14;i++)mesh(new THREE.OctahedronGeometry(.12),white,(i*13%42)-21,(i*7%23)-11,-20-i*6);
 }
 function nextWave(){wave++;for(let row=0;row<3;row++)for(let col=0;col<5;col++){const e=ship(row===0?pink:purple,.65);e.rotation.y=Math.PI;enemies.push({mesh:e,baseX:(col-2)*3,baseY:(row-1)*2.2,phase:col*.8+row,diving:false,dive:0,shot:1+Math.random()*3,hp:wave>3?2:1});}notify(`Wave ${wave} · Shields ${shield}/5`);}
 function explosion(x,y,z){for(let i=0;i<(high?12:6);i++){particles.push({mesh:mesh(new THREE.OctahedronGeometry(.12),pink,x,y,z),vx:(Math.random()-.5)*7,vy:(Math.random()-.5)*7,vz:(Math.random()-.5)*7,life:.65});}}
 function laser(x,y,z,enemy=false){return {mesh:mesh(new THREE.BoxGeometry(enemy?.16:.12,.12,1.2),enemy?pink:green,x,y,z)};}
 function update(dt){t+=dt;const action=input.action&&!input.previousAction;input.previousAction=Boolean(input.action);
  if(id==='marble'){
   const oldY=p.y;p.vx+=(Number(Boolean(input.right))-Number(Boolean(input.left)))*16*dt;p.vz+=(Number(Boolean(input.down))-Number(Boolean(input.up)))*16*dt;p.vx=clamp(p.vx*Math.exp(-1.45*dt),-7.2,7.2);p.vz=clamp(p.vz*Math.exp(-1.45*dt),-9,9);
   if(action&&grounded){p.vy=7.5;grounded=false;}p.vy-=19*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
   const support=marbleSupport(segments,p.x,p.z);if(support&&p.vy<=0&&oldY>=support.height+.35&&p.y<=support.height+.55){p.y=support.height+.55;p.vy=0;grounded=true;}else if(!support||p.y>(support?.height||0)+.6)grounded=false;
   if(level===0&&support){const s=segments[support.index],dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],u=clamp(((p.x-s.a[0])*dx+(p.z-s.a[1])*dz)/(s.length*s.length),0,1),cx=s.a[0]+dx*u,cz=s.a[1]+dz*u,d=Math.hypot(p.x-cx,p.z-cz);if(d>s.width/2-.5){const scale=(s.width/2-.5)/d;p.x=cx+(p.x-cx)*scale;p.z=cz+(p.z-cz)*scale;p.vx*=.5;}}
   player.position.set(p.x,p.y,p.z);ball.rotation.x+=p.vz*dt/.55;ball.rotation.z-=p.vx*dt/.55;
   for(const c of crystals){c.mesh.rotation.y+=dt;if(!c.taken&&c.mesh.position.distanceTo(player.position)<1.2){c.taken=true;c.mesh.visible=false;taken++;checkpoint={x:p.x,y:p.y,z:p.z};}}
   if(p.y<-7){falls++;if(falls>=5){finish(false,'Five falls. Try again; ease off the throttle before each bend.');}else{Object.assign(p,checkpoint,{vx:0,vz:0,vy:0});grounded=true;}}
   const end=course.points.at(-1);if(Math.hypot(p.x-end[0],p.z-end[1])<2&&grounded){score=1200+taken*150+Math.max(0,500-Math.floor(t*3))-falls*50;finish(true,`${course.name} complete · ${taken}/${crystals.length} crystals.`);}
   score=Math.max(score,Math.max(0,Math.floor(-p.z*8))+taken*150);camera.position.lerp(new THREE.Vector3(p.x*.7,p.y+8,p.z+13),Math.min(1,dt*5));camera.lookAt(p.x,p.y-.4,p.z-5);notify(`${course.name} · ${taken}/${crystals.length} · ${5-falls} lives`);
  }else if(id==='rally'){
   raceTime+=dt;const road=Math.abs(Math.hypot(p.x/27,p.z/18)-1)<.18;driveStep(p,input,dt,road);p.x=clamp(p.x,-45,45);p.z=clamp(p.z,-34,34);
   player.position.set(p.x,.3,p.z);player.rotation.y=-p.heading;player.rotation.z=clamp((Number(Boolean(input.right))-Number(Boolean(input.left)))*p.speed*.009,-.15,.15);
   const target=gates[gate];if(road&&Math.hypot(p.x-target.x,p.z-target.z)<3.6){gate=(gate+1)%8;if(gate===1){laps++;if(laps===3){score=Math.round(600000/raceTime);finish(true,`Three laps in ${raceTime.toFixed(1)} seconds.`);}}}
   for(let i=0;i<gates.length;i++){if(!gates[i].marker)gates[i].marker=mesh(new THREE.TorusGeometry(.7,.12,6,12),green,gates[i].x,1.2,gates[i].z);gates[i].marker.visible=i===gate;}
   const behind=new THREE.Vector3(p.x-Math.cos(p.heading)*10,6,p.z-Math.sin(p.heading)*10);camera.position.lerp(behind,Math.min(1,dt*4));camera.lookAt(p.x+Math.cos(p.heading)*4,0,p.z+Math.sin(p.heading)*4);notify(`Lap ${Math.min(3,laps+1)}/3 · ${p.speed<-.2?'REVERSE':Math.round(Math.abs(p.speed)*6)+' km/h'} · ${raceTime.toFixed(1)}s`);
  }else{
   p.vx+=(Number(Boolean(input.right))-Number(Boolean(input.left)))*35*dt;p.vy+=(Number(Boolean(input.up))-Number(Boolean(input.down)))*30*dt;p.vx=clamp(p.vx*Math.exp(-4*dt),-11,11);p.vy=clamp(p.vy*Math.exp(-4*dt),-8,8);p.x=clamp(p.x+p.vx*dt,-9,9);p.y=clamp(p.y+p.vy*dt,-5,5);
   player.position.set(p.x,p.y,7);player.rotation.z=THREE.MathUtils.lerp(player.rotation.z,-p.vx*.065,dt*8);player.rotation.x=THREE.MathUtils.lerp(player.rotation.x,p.vy*.04,dt*8);player.visible=immune<=0||Math.floor(t*12)%2===0;immune=Math.max(0,immune-dt);fire-=dt;
   if(input.action&&fire<=0){fire=.16;shots.push(laser(p.x-.35,p.y,5),laser(p.x+.35,p.y,5));}
   if(!enemies.length){spawnTimer-=dt;if(spawnTimer<=0){if(wave>=5){score+=1500;finish(true,'All five invasion waves defeated!');return;}nextWave();}}
   for(const e of enemies){e.shot-=dt;if(!e.diving&&t>4&&Math.sin(t*.8+e.phase)>.995)e.diving=true;
    if(e.diving){e.dive+=dt;const q=e.dive;e.mesh.position.set(e.baseX+Math.sin(q*3)*3,e.baseY-Math.sin(q*2)*2,-23+q*15);e.mesh.rotation.z=Math.sin(q*3)*.65;if(q>2.7){e.dive=0;e.diving=false;}}
    else {e.mesh.position.set(e.baseX+Math.sin(t*.8)*2,e.baseY+Math.sin(t+e.phase)*.5,-23-Math.floor(e.phase/4)*3);e.mesh.rotation.z=Math.cos(t+e.phase)*.15;}
    if(e.shot<=0){e.shot=Math.max(.9,3.5-wave*.4)+Math.random()*2;enemyShots.push(laser(e.mesh.position.x,e.mesh.position.y,e.mesh.position.z+1,true));}
    if(e.mesh.position.z>5&&Math.hypot(e.mesh.position.x-p.x,e.mesh.position.y-p.y)<1.3&&!immune){shield--;immune=1.6;e.hp=0;}
    for(const b of shots)if(Math.abs(b.mesh.position.z-e.mesh.position.z)<1.4&&Math.hypot(b.mesh.position.x-e.mesh.position.x,b.mesh.position.y-e.mesh.position.y)<1.2){e.hp--;b.mesh.position.z=-160;if(e.hp<=0){kills++;score+=100;explosion(e.mesh.position.x,e.mesh.position.y,e.mesh.position.z);if(kills%7===0)pickups.push({mesh:mesh(new THREE.OctahedronGeometry(.45),green,e.mesh.position.x,e.mesh.position.y,e.mesh.position.z)});}break;}
   }
   const before=enemies.length;enemies=enemies.filter(e=>{if(e.hp<=0){destroyShip(e.mesh);return false;}return true;});if(before&&!enemies.length){completedWaves++;score+=300;spawnTimer=1.5;}
   shots=shots.filter(b=>{b.mesh.position.z-=60*dt;if(b.mesh.position.z< -100){remove(b.mesh);return false;}return true;});
   enemyShots=enemyShots.filter(b=>{b.mesh.position.z+=(13+wave*2)*dt;if(Math.abs(b.mesh.position.z-7)<1&&Math.hypot(b.mesh.position.x-p.x,b.mesh.position.y-p.y)<.75&&!immune){shield--;immune=1.5;remove(b.mesh);return false;}if(b.mesh.position.z>23){remove(b.mesh);return false;}return true;});
   pickups=pickups.filter(a=>{a.mesh.position.z+=9*dt;a.mesh.rotation.y+=dt;if(Math.abs(a.mesh.position.z-7)<1.3&&Math.hypot(a.mesh.position.x-p.x,a.mesh.position.y-p.y)<1.3){shield=Math.min(5,shield+1);score+=75;remove(a.mesh);return false;}if(a.mesh.position.z>23){remove(a.mesh);return false;}return true;});
   particles=particles.filter(a=>{a.life-=dt;a.mesh.position.x+=a.vx*dt;a.mesh.position.y+=a.vy*dt;a.mesh.position.z+=a.vz*dt;if(a.life<=0){remove(a.mesh);return false;}return true;});
   if(shield<=0)finish(false,`${kills} ships defeated across ${completedWaves} waves. Keep moving and watch for shield crystals.`);notify(`Wave ${wave}/5 · Shields ${Math.max(0,shield)}/5 · ${kills} ships · ${score} points`);
  }
 }
 function loop(now){const dt=last?Math.min(.034,(now-last)/1000):0;last=now;if(!paused&&!done){update(dt);redraw=true;}if(redraw){renderer.render(scene,camera);redraw=false;}animation=requestAnimationFrame(loop);}
 const contextLost=e=>{e.preventDefault();finish(false,'The graphics context was interrupted. Retry, or open local practice in your browser.');};canvas.addEventListener('webglcontextlost',contextLost);renderer.render(scene,camera);animation=requestAnimationFrame(loop);
 return {pause(value){paused=value;redraw=true;input.previousAction=Boolean(input.action);},setMuted(){},dispose(){cancelAnimationFrame(animation);canvas.removeEventListener('webglcontextlost',contextLost);for(const g of new Set(geometries))g.dispose();for(const m of materials)m.dispose();renderer.dispose();}};
}
