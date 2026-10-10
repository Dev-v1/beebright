import * as THREE from 'three';
import {createGameRenderer} from './game-renderer.js';
import {clamp,driveStep,MARBLE_COURSES,marblePath,marbleSupport,RALLY_COURSES,roadDistance,keepInFrame} from './game-mechanics.js';
export function mount3D(canvas,{id,level=0,input,onFinish,onStatus,onGraphics,quality='light'}) {
 const renderer=createGameRenderer(canvas,quality,onGraphics),high=quality==='high'&&!renderer.software;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#10182d');scene.fog=new THREE.Fog('#10182d',45,160);
 const camera=new THREE.PerspectiveCamera(58,1.6,.1,180);scene.add(new THREE.HemisphereLight(0xe0f5ff,0x253955,2.1));
 const light=new THREE.DirectionalLight(0xffffff,2.2);light.position.set(8,18,10);light.castShadow=high;light.shadow.mapSize.set(high?2048:1024,high?2048:1024);Object.assign(light.shadow.camera,{left:-24,right:24,top:24,bottom:-24,far:100});scene.add(light);
 const materials=[],geometries=[],textures=[];const mat=color=>{const m=new THREE.MeshStandardMaterial({color,roughness:high?.35:.75,metalness:high?.3:.1});materials.push(m);return m;};
 const teal=mat('#8de9df'),purple=mat('#b4a2ef'),stone=mat('#7b93bd'),green=mat('#abec9e'),pink=mat('#f691ba'),white=mat('#e6efff');
 function mesh(geometry,material,x=0,y=0,z=0,parent=scene){geometries.push(geometry);const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=high;m.receiveShadow=high;parent.add(m);return m;}
 function box(x,y,z,w,h,d,material=stone){return mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z);}
 let animation,last=0,t=0,paused=false,done=false,score=0,status='',redraw=true;
 const p={x:0,y:.56,z:3,vx:0,vz:0,vy:0,speed:0,heading:Math.PI/2};
 const player=new THREE.Group();scene.add(player);let ball,course,segments,crystals=[],taken=0,checkpoint={x:0,z:3,y:.56},falls=0,grounded=true;
 let laps=0,gate=1,gates=[],track=[],raceTime=0,raceCourse,roadPoints=[],wheels=[],hazards=[],boostUntil=0,boostCooldown=0,hazardCooldown=0;
 const raceGeometry=high?160:96;
 let enemies=[],shots=[],enemyShots=[],particles=[],pickups=[],wave=0,kills=0,shield=5,immune=0,fire=0,spawnTimer=0,completedWaves=0;
 function finish(won,text){if(done)return;done=true;onFinish({won,text,score:Math.round(Math.max(0,score))});}
 function notify(s){if(s!==status){status=s;onStatus(s);}}
 function remove(object){object.removeFromParent();if(object.geometry){object.geometry.dispose();const i=geometries.indexOf(object.geometry);if(i>=0)geometries.splice(i,1);}}
 function ship(material,size=1,parent=scene){const group=new THREE.Group();parent.add(group);mesh(new THREE.ConeGeometry(.5*size,1.7*size,4),material,0,0,0,group).rotation.x=-Math.PI/2;mesh(new THREE.BoxGeometry(1.7*size,.13*size,.65*size),material,0,0,.35*size,group);mesh(new THREE.SphereGeometry(.23*size,8,6),white,0,.18*size,.1*size,group);return group;}
 function destroyShip(group){for(const child of [...group.children])remove(child);group.removeFromParent();}
 if(id==='marble'){
  course=MARBLE_COURSES[level]||MARBLE_COURSES[0];segments=marblePath(level);ball=mesh(new THREE.SphereGeometry(.55,high?32:12,high?24:8),teal,0,0,0,player);
  for(const s of segments){
   for(const [start,end] of s.gap?[[0,.43],[.57,1]]:[[0,1]]){
    const a=new THREE.Vector3(s.a[0],s.a[2]-.18,s.a[1]),b=new THREE.Vector3(s.b[0],s.b[2]-.18,s.b[1]),pa=a.clone().lerp(b,start),pb=a.clone().lerp(b,end),d=pb.clone().sub(pa);
    const platform=box((pa.x+pb.x)/2,(pa.y+pb.y)/2,(pa.z+pb.z)/2,s.width,.35,d.length(),s.index%2?purple:stone);platform.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d.clone().normalize());
    if(course.rails.includes(s.index)){const normal=new THREE.Vector3(-d.z,0,d.x).normalize();for(const side of [-1,1]){const center=pa.clone().lerp(pb,.5).addScaledVector(normal,side*s.width/2),rail=box(center.x,center.y+.35,center.z,.14,.5,d.length(),teal);rail.quaternion.copy(platform.quaternion);}}
    if(high){for(const side of [-1,1]){const trim=box(platform.position.x,platform.position.y-.05,platform.position.z,.06,.07,d.length(),teal);trim.quaternion.copy(platform.quaternion);trim.translateX(side*s.width/2);}}
   }
   for(const u of [.2,.75]){const x=s.a[0]+(s.b[0]-s.a[0])*u,z=s.a[1]+(s.b[1]-s.a[1])*u,y=s.a[2]+(s.b[2]-s.a[2])*u;crystals.push({mesh:mesh(new THREE.OctahedronGeometry(.3),green,x,y+.85,z),taken:false,checkpoint:false});}
   if(s.index%3===2){const b=s.b;box(b[0],b[2]-.1,b[1],s.width+.8,.18,2.5,teal);crystals.push({mesh:mesh(new THREE.TorusGeometry(.8,.09,6,16),green,b[0],b[2]+1,b[1]),taken:false,checkpoint:true});}
   if(course.hazards.includes(s.index)){const u=.55,group=new THREE.Group();group.position.set(s.a[0]+(s.b[0]-s.a[0])*u,s.a[2]+(s.b[2]-s.a[2])*u+.65,s.a[1]+(s.b[1]-s.a[1])*u);scene.add(group);mesh(new THREE.BoxGeometry(s.width*.85,.22,.35),pink,0,0,0,group);mesh(new THREE.CylinderGeometry(.22,.22,1.3,8),stone,0,-.15,0,group);hazards.push({group,r:s.width*.43,phase:s.index});}
   if(course.boosts.includes(s.index)){const u=.3,x=s.a[0]+(s.b[0]-s.a[0])*u,z=s.a[1]+(s.b[1]-s.a[1])*u,y=s.a[2]+(s.b[2]-s.a[2])*u;box(x,y+.025,z,s.width*.8,.05,1.7,green);}
  }
  const end=course.points.at(-1);mesh(new THREE.TorusGeometry(1.4,.18,8,24),pink,end[0],end[2]+1.4,end[1]);
  for(let i=0;i<(high?40:12);i++){const x=(i%2?1:-1)*(20+i%6*4),z=-i*7,y=-8-i%4;mesh(new THREE.IcosahedronGeometry(2+i%3,0),purple,x,y,z);}
  camera.position.set(0,7,13);camera.lookAt(0,0,-4);
 }else if(id==='rally'){
  raceCourse=RALLY_COURSES[level]||RALLY_COURSES[0];scene.background=new THREE.Color(({harbor:'#1a3d59',canyon:'#55364c',alpine:'#3a556c',city:'#0c142c'})[raceCourse.theme]);scene.fog=new THREE.Fog(scene.background,high?95:65,180);
  const curve=new THREE.CatmullRomCurve3(raceCourse.points.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');roadPoints=curve.getSpacedPoints(raceGeometry).slice(0,-1);const tangent=curve.getTangentAt(0);p.x=roadPoints[0].x;p.z=roadPoints[0].z;p.heading=Math.atan2(tangent.z,tangent.x);
  const asphalt=mat('#414f67');asphalt.roughness=.95;
  if(high){const data=new Uint8Array(32*32*4);for(let i=0;i<1024;i++){const v=145+((i*31+i%19*7)%65);data[i*4]=data[i*4+1]=data[i*4+2]=v;data[i*4+3]=255;}const texture=new THREE.DataTexture(data,32,32);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(3,3);texture.needsUpdate=true;asphalt.map=texture;textures.push(texture);}
  box(0,-.35,0,130,.5,130,mat(raceCourse.theme==='canyon'?'#9b6756':raceCourse.theme==='alpine'?'#79909b':'#20384a')).userData.softwareHidden=true;
  const curbA=mat('#ef8eac'),curbB=mat('#89ddde');for(const m of [curbA,curbB]){m.emissive.copy(m.color);m.emissiveIntensity=high?.35:.1;}
  for(let i=0;i<roadPoints.length;i++){
   const a=roadPoints[i],b=roadPoints[(i+1)%roadPoints.length],d=b.clone().sub(a),center=a.clone().lerp(b,.5),road=box(center.x,0,center.z,raceCourse.width,.16,d.length()+.1,asphalt);road.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d.clone().normalize());track.push(road);
   const normal=new THREE.Vector3(-d.z,0,d.x).normalize();
   if(high||i%2===0)for(const side of [-1,1]){const edge=center.clone().addScaledVector(normal,side*(raceCourse.width/2+.25)),curb=box(edge.x,.07,edge.z,.55,.2,d.length()+.12,i%2?curbA:curbB);curb.quaternion.copy(road.quaternion);}
   if(high&&i%3===0){const stripe=box(center.x,.095,center.z,.12,.025,d.length()*.5,white);stripe.quaternion.copy(road.quaternion);}
   if(i%8===0){const edge=center.clone().addScaledVector(normal,raceCourse.width/2+1.5);box(edge.x,2,edge.z,.12,4,.12,stone);mesh(new THREE.SphereGeometry(.24,high?12:6,6),curbB,edge.x,4.1,edge.z);}
  }
  for(let i=0;i<12;i++){const point=curve.getPointAt(i/12);gates.push({x:point.x,z:point.z});}
  // Track-specific scenery stays outside the racing surface.
  const sceneryCount=high?64:20;for(let i=0;i<sceneryCount;i++){const a=i/sceneryCount*Math.PI*2,x=Math.cos(a)*(53+i%3*4),z=Math.sin(a)*(53+i%4*4);
   if(raceCourse.theme==='city'||raceCourse.theme==='harbor'){const h=4+i*7%18;box(x,h/2,z,3+i%3,h,4,mat(i%2?'#35476d':'#506382'));if(high)for(let j=1;j<h;j+=2)box(x,j,z+2.03,2,.35,.05,i%3?curbB:curbA);}
   else if(raceCourse.theme==='alpine'){mesh(new THREE.ConeGeometry(2.3,7,high?10:5),green,x,3.2,z);mesh(new THREE.ConeGeometry(2,3,8),white,x,5.5,z);}
   else mesh(new THREE.ConeGeometry(3+i%4,6+i%5,high?12:5),mat(i%2?'#b58670':'#785a71'),x,2,z);
  }
  if(raceCourse.theme==='harbor')box(0,-.16,0,20,.1,14,mat('#398aab'));
  if(high){mesh(new THREE.SphereGeometry(6,24,16),mat('#ffcda9'),-60,35,-70);const paint=new THREE.MeshPhysicalMaterial({color:'#eb729e',metalness:.65,roughness:.23,clearcoat:1,clearcoatRoughness:.12});materials.push(paint);
   mesh(new THREE.BoxGeometry(2.9,.48,1.55),paint,0,.4,0,player);const hood=mesh(new THREE.BoxGeometry(.9,.16,1.35),paint,.8,.73,0,player);hood.rotation.z=-.08;mesh(new THREE.BoxGeometry(1.25,.46,1.28),mat('#366888'),-.15,.86,0,player);mesh(new THREE.BoxGeometry(.15,.1,1.75),stone,-1.15,1,0,player);
   for(const z of [-.56,.56])mesh(new THREE.BoxGeometry(.05,.13,.32),white,1.48,.52,z,player);
   const headlight=new THREE.SpotLight(0xd7f6ff,high?9:0,20,.5,.4,1);headlight.position.set(1.4,.6,0);const target=new THREE.Object3D();target.position.set(9,.2,0);player.add(target,headlight);headlight.target=target;
  }else{mesh(new THREE.BoxGeometry(2.8,.7,1.5),pink,0,.4,0,player);mesh(new THREE.BoxGeometry(1.15,.5,1.3),teal,-.1,.9,0,player);}
  const rubber=mat('#161e2a');for(const x of [-.9,.9])for(const z of [-.88,.88]){const wheel=mesh(new THREE.CylinderGeometry(.35,.35,.27,high?20:10),rubber,x,.3,z,player);wheel.rotation.x=Math.PI/2;wheels.push(wheel);if(high){const rim=mesh(new THREE.CylinderGeometry(.22,.22,.29,12),white,x,.3,z,player);rim.rotation.x=Math.PI/2;wheels.push(rim);}}
  p.y=.2;player.position.set(p.x,p.y,p.z);camera.position.set(p.x-Math.cos(p.heading)*10,6,p.z-Math.sin(p.heading)*10);camera.lookAt(p.x,0,p.z);
 }else{
  ship(teal,1,player);p.y=0;p.z=7;camera.fov=50;camera.updateProjectionMatrix();camera.position.set(0,3,24);camera.lookAt(0,0,7);
  const n=high?500:160,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*100;pos[i*3+1]=(Math.random()-.5)*80;pos[i*3+2]=-Math.random()*120;}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geometries.push(geo);const m=new THREE.PointsMaterial({color:0xbecff6,size:.13});materials.push(m);scene.add(new THREE.Points(geo,m));
  // Visible nebula lanterns also appear in software projection.
  for(let i=0;i<14;i++)mesh(new THREE.OctahedronGeometry(.12),white,(i*13%42)-21,(i*7%23)-11,-20-i*6);
 }
 function nextWave(){wave++;for(let row=0;row<3;row++)for(let col=0;col<5;col++){const e=ship(row===0?pink:purple,.95);e.rotation.y=Math.PI;enemies.push({mesh:e,baseX:(col-2)*3.3,baseY:(row-1)*2.2,phase:col*.8+row,diving:false,dive:0,shot:1+Math.random()*3,hp:wave>3?2:1});}notify(`Wave ${wave} · Shields ${shield}/5`);}
 function explosion(x,y,z){for(let i=0;i<(high?12:6);i++){particles.push({mesh:mesh(new THREE.OctahedronGeometry(.12),pink,x,y,z),vx:(Math.random()-.5)*7,vy:(Math.random()-.5)*7,vz:(Math.random()-.5)*7,life:.65});}}
 function laser(x,y,z,enemy=false){return {mesh:mesh(new THREE.BoxGeometry(enemy?.16:.12,.12,1.2),enemy?pink:green,x,y,z)};}
 function update(dt){t+=dt;const action=input.action&&!input.previousAction;input.previousAction=Boolean(input.action);
  if(id==='marble'){
   const oldY=p.y,oldSupport=marbleSupport(segments,p.x,p.z),braking=Boolean(input.spinLeft);boostCooldown=Math.max(0,boostCooldown-dt);hazardCooldown=Math.max(0,hazardCooldown-dt);
   p.vx+=(Number(Boolean(input.right))-Number(Boolean(input.left)))*22*dt;p.vz+=(Number(Boolean(input.down))-Number(Boolean(input.up)))*22*dt;
   if(grounded&&oldSupport){p.vx-=oldSupport.slopeX*14*dt;p.vz-=oldSupport.slopeZ*14*dt;}
   const boost=t<boostUntil,maxSpeed=boost?13:9.8,friction=braking?8:1.65;p.vx=clamp(p.vx*Math.exp(-friction*dt),-maxSpeed,maxSpeed);p.vz=clamp(p.vz*Math.exp(-friction*dt),-maxSpeed,maxSpeed);
   if(action&&grounded){p.vy=8;grounded=false;}p.vy-=19*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
   const support=marbleSupport(segments,p.x,p.z);if(support&&p.vy<=0&&(grounded||oldY>=support.height+.35)&&p.y<=support.height+.55){p.y=support.height+.55;p.vy=0;grounded=true;}else if(!support||p.y>(support?.height||0)+.6)grounded=false;
   if(support&&course.rails.includes(support.index)){const s=segments[support.index],dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],u=clamp(((p.x-s.a[0])*dx+(p.z-s.a[1])*dz)/(s.length*s.length),0,1),cx=s.a[0]+dx*u,cz=s.a[1]+dz*u,d=Math.hypot(p.x-cx,p.z-cz);if(d>s.width/2-.5){const scale=(s.width/2-.5)/d;p.x=cx+(p.x-cx)*scale;p.z=cz+(p.z-cz)*scale;p.vx*=.5;}}
   if(support&&course.boosts.includes(support.index)&&support.u>.24&&support.u<.38&&grounded&&boostCooldown===0){const s=segments[support.index];p.vx=(s.b[0]-s.a[0])/s.length*13;p.vz=(s.b[1]-s.a[1])/s.length*13;boostUntil=t+1.5;boostCooldown=3;}
   for(const h of hazards){h.group.rotation.y=t*(1.1+level*.25)+h.phase;const dx=p.x-h.group.position.x,dz=p.z-h.group.position.z,along=dx*Math.cos(h.group.rotation.y)-dz*Math.sin(h.group.rotation.y),across=dx*Math.sin(h.group.rotation.y)+dz*Math.cos(h.group.rotation.y);if(hazardCooldown===0&&Math.abs(along)<h.r+.4&&Math.abs(across)<.48&&Math.abs(p.y-h.group.position.y)<.65){p.vx+=Math.sin(h.group.rotation.y)*5;p.vz+=Math.cos(h.group.rotation.y)*5;hazardCooldown=.65;}}
   player.position.set(p.x,p.y,p.z);ball.rotation.x+=p.vz*dt/.55;ball.rotation.z-=p.vx*dt/.55;
   for(const c of crystals){c.mesh.rotation.y+=dt;if(!c.taken&&c.mesh.position.distanceTo(player.position)<1.2){c.taken=true;c.mesh.visible=false;if(c.checkpoint)checkpoint={x:p.x,y:p.y,z:p.z};else taken++;}}
   if(p.y<-8){falls++;if(falls>=5)finish(false,'Five falls. Brake before bends and jump across the marked gaps.');else{Object.assign(p,checkpoint,{vx:0,vz:0,vy:0});grounded=true;boostUntil=0;}}
   if(t>=course.time)finish(false,'Time is up. Use green boost pads and collect checkpoint rings.');
   const end=course.points.at(-1);if(Math.hypot(p.x-end[0],p.z-end[1])<1.7&&grounded){score=1200+taken*100+Math.max(0,Math.floor((course.time-t)*8))-falls*100;finish(true,`${course.name} complete · ${taken} crystals · ${Math.ceil(course.time-t)} seconds left.`);}
   score=Math.max(score,Math.max(0,Math.floor(-p.z*5))+taken*100);camera.position.lerp(new THREE.Vector3(p.x,p.y+7,p.z+11),Math.min(1,dt*7));camera.lookAt(p.x,p.y-.4,p.z-5);notify(`${course.name} · ${Math.ceil(course.time-t)}s · ${taken} crystals · ${5-falls} lives${boost?' · BOOST':''}`);
  }else if(id==='rally'){
   raceTime+=dt;const road=roadDistance(roadPoints,p.x,p.z)<raceCourse.width/2;driveStep(p,input,dt,road);p.x=clamp(p.x,-65,65);p.z=clamp(p.z,-65,65);
   player.position.set(p.x,.2,p.z);player.rotation.y=-p.heading;player.rotation.z=clamp((Number(Boolean(input.right))-Number(Boolean(input.left)))*p.speed*.007,-.12,.12);for(const wheel of wheels)wheel.rotation.y-=p.speed*dt/.35;
   const target=gates[gate];if(road&&Math.hypot(p.x-target.x,p.z-target.z)<raceCourse.width*.55){gate=(gate+1)%gates.length;if(gate===1){laps++;if(laps===raceCourse.laps){score=Math.round(600000/raceTime);finish(true,`${raceCourse.name}: ${raceCourse.laps} laps in ${raceTime.toFixed(1)} seconds.`);}}}
   for(let i=0;i<gates.length;i++){if(!gates[i].marker)gates[i].marker=mesh(new THREE.TorusGeometry(.8,.1,6,16),green,gates[i].x,1.2,gates[i].z);gates[i].marker.visible=i===gate;}
   const behind=new THREE.Vector3(p.x-Math.cos(p.heading)*10,5.5,p.z-Math.sin(p.heading)*10);camera.position.lerp(behind,Math.min(1,dt*5));camera.lookAt(p.x+Math.cos(p.heading)*4,.4,p.z+Math.sin(p.heading)*4);notify(`${raceCourse.name} · Lap ${Math.min(raceCourse.laps,laps+1)}/${raceCourse.laps} · ${p.speed<-.2?'REVERSE':Math.round(Math.abs(p.speed)*6)+' km/h'} · ${raceTime.toFixed(1)}s`);
  }else{
   p.vx+=(Number(Boolean(input.right))-Number(Boolean(input.left)))*35*dt;p.vy+=(Number(Boolean(input.up))-Number(Boolean(input.down)))*30*dt;p.vx=clamp(p.vx*Math.exp(-4*dt),-11,11);p.vy=clamp(p.vy*Math.exp(-4*dt),-8,8);p.x+=p.vx*dt;p.y+=p.vy*dt;camera.updateMatrixWorld();keepInFrame(p,camera,7,1.5,1.05);
   player.position.set(p.x,p.y,7);player.rotation.z=THREE.MathUtils.lerp(player.rotation.z,-p.vx*.065,dt*8);player.rotation.x=THREE.MathUtils.lerp(player.rotation.x,p.vy*.04,dt*8);player.visible=immune<=0||Math.floor(t*12)%2===0;immune=Math.max(0,immune-dt);fire-=dt;
   if(input.action&&fire<=0){fire=.16;shots.push(laser(p.x-.35,p.y,5),laser(p.x+.35,p.y,5));}
   if(!enemies.length){spawnTimer-=dt;if(spawnTimer<=0){if(wave>=5){score+=1500;finish(true,'All five invasion waves defeated!');return;}nextWave();}}
   for(const e of enemies){e.shot-=dt;if(!e.diving&&t>4&&Math.sin(t*.8+e.phase)>.995)e.diving=true;
    if(e.diving){e.dive+=dt;const q=e.dive;e.mesh.position.set(e.baseX+Math.sin(q*3)*3,e.baseY-Math.sin(q*2)*2,-17+q*15);e.mesh.rotation.z=Math.sin(q*3)*.65;if(q>2.7){e.dive=0;e.diving=false;}}
    else {e.mesh.position.set(e.baseX+Math.sin(t*.8)*2,e.baseY+Math.sin(t+e.phase)*.5,-17-Math.floor(e.phase/4)*3);e.mesh.rotation.z=Math.cos(t+e.phase)*.15;}
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
  if(high){light.position.copy(player.position).add(new THREE.Vector3(8,18,10));light.target=player;}
 }
 function loop(now){const dt=last?Math.min(.034,(now-last)/1000):0;last=now;if(!paused&&!done){update(dt);redraw=true;}if(redraw){renderer.render(scene,camera);redraw=false;}animation=requestAnimationFrame(loop);}
 const contextLost=e=>{e.preventDefault();finish(false,'The graphics context was interrupted. Retry, or open local practice in your browser.');};canvas.addEventListener('webglcontextlost',contextLost);player.position.set(p.x,p.y,p.z);renderer.render(scene,camera);animation=requestAnimationFrame(loop);
 return {pause(value){paused=value;redraw=true;input.previousAction=Boolean(input.action);},setMuted(){},dispose(){cancelAnimationFrame(animation);canvas.removeEventListener('webglcontextlost',contextLost);for(const g of new Set(geometries))g.dispose();for(const m of materials)m.dispose();for(const texture of textures)texture.dispose();renderer.dispose();}};
}
