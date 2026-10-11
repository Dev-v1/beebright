import * as THREE from 'three';
import {setupRally} from './games-rally.js';
import {marbleBoardGeometry} from './track-geometry.js';
import {createGameRenderer} from './game-renderer.js';
import {clamp,MARBLE_COURSES,marblePath,marbleSurfaces,marbleStep,marbleStart,keepInFrame} from './game-mechanics.js';
export function mount3D(canvas,{id,level=0,input,onFinish,onStatus,onGraphics,quality='light'}) {
 const renderer=createGameRenderer(canvas,quality,onGraphics),high=quality==='high'&&!renderer.software;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#10182d');scene.fog=new THREE.Fog('#10182d',45,160);
 const camera=new THREE.PerspectiveCamera(58,1.6,.1,180);scene.add(new THREE.HemisphereLight(0xe0f5ff,0x253955,2.1));
 const light=new THREE.DirectionalLight(0xffffff,2.2);light.position.set(8,18,10);light.castShadow=high;light.shadow.mapSize.set(high?2048:1024,high?2048:1024);Object.assign(light.shadow.camera,{left:-24,right:24,top:24,bottom:-24,far:140});light.shadow.bias=-.00012;light.shadow.normalBias=.025;scene.add(light);
 const materials=[],geometries=[],textures=[];const mat=color=>{const m=new THREE.MeshStandardMaterial({color,roughness:high?.35:.75,metalness:high?.3:.1});materials.push(m);return m;};
 const teal=mat('#8de9df'),purple=mat('#b4a2ef'),stone=mat('#7b93bd'),green=mat('#abec9e'),pink=mat('#f691ba'),white=mat('#e6efff');
 function mesh(geometry,material,x=0,y=0,z=0,parent=scene){geometries.push(geometry);const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=high;m.receiveShadow=high;parent.add(m);return m;}
 function box(x,y,z,w,h,d,material=stone){return mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z);}
 let animation,last=0,t=0,paused=false,done=false,score=0,status='',redraw=true;
 const p={x:0,y:.56,z:3,vx:0,vz:0,vy:0,speed:0,heading:Math.PI/2};
 const player=new THREE.Group();scene.add(player);let ball,course,segments,surfaces,crystals=[],taken=0,checkpoint={x:0,z:3,y:.56},falls=0,grounded=true;
 let rally,hazards=[],boostUntil=0,boostCooldown=0,hazardCooldown=0;
 let enemies=[],shots=[],enemyShots=[],particles=[],pickups=[],wave=0,kills=0,shield=5,immune=0,fire=0,spawnTimer=0,completedWaves=0;
 function finish(won,text){if(done)return;done=true;onFinish({won,text,score:Math.round(Math.max(0,score))});}
 function notify(s){if(s!==status){status=s;onStatus(s);}}
 function remove(object){object.removeFromParent();if(object.geometry){object.geometry.dispose();const i=geometries.indexOf(object.geometry);if(i>=0)geometries.splice(i,1);}}
 function ship(material,size=1,parent=scene){const group=new THREE.Group();parent.add(group);mesh(new THREE.ConeGeometry(.5*size,1.7*size,4),material,0,0,0,group).rotation.x=-Math.PI/2;mesh(new THREE.BoxGeometry(1.7*size,.13*size,.65*size),material,0,0,.35*size,group);mesh(new THREE.SphereGeometry(.23*size,8,6),white,0,.18*size,.1*size,group);return group;}
 function destroyShip(group){for(const child of [...group.children])remove(child);group.removeFromParent();}
 if(id==='marble'){
  course=MARBLE_COURSES[level]||MARBLE_COURSES[0];segments=marblePath(level);
  let marbleMaterial=teal;
  if(high){
   const sky=new Uint8Array(256*128*4);for(let y=0;y<128;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,h=y/127,sun=Math.exp(-((x-177)**2+(y-34)**2)/32);sky[i]=Math.min(255,90+140*h+150*sun);sky[i+1]=Math.min(255,150+85*h+100*sun);sky[i+2]=Math.min(255,220+20*h+45*sun);sky[i+3]=255;}
   const environment=new THREE.DataTexture(sky,256,128);environment.mapping=THREE.EquirectangularReflectionMapping;environment.colorSpace=THREE.SRGBColorSpace;environment.needsUpdate=true;textures.push(environment);scene.environment=environment;scene.background=environment;scene.fog=new THREE.Fog('#c2d4e5',55,155);
   const grain=new Uint8Array(64*64*4);for(let i=0;i<4096;i++){const n=160+(i*29+i%31*13)%70;grain[i*4]=grain[i*4+1]=grain[i*4+2]=n;grain[i*4+3]=255;}
   const texture=new THREE.DataTexture(grain,64,64);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.needsUpdate=true;textures.push(texture);for(const m of [stone,purple]){m.map=texture;m.bumpMap=texture;m.bumpScale=.035;m.roughness=.7;m.metalness=.15;}teal.metalness=.65;teal.roughness=.27;
   marbleMaterial=new THREE.MeshPhysicalMaterial({color:'#b2e3dd',roughness:.13,metalness:.35,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.2});materials.push(marbleMaterial);light.intensity=3;light.color.set('#fff4de');
  }
  ball=mesh(new THREE.SphereGeometry(.55,high?48:16,high?32:12),marbleMaterial,0,0,0,player);
  const stripe=mat(high?'#294454':'#334d68');stripe.metalness=high?.8:.1;stripe.roughness=.2;for(const angle of [0,Math.PI/2])mesh(new THREE.TorusGeometry(.552,.017,high?8:4,high?64:24),stripe,0,0,0,ball).rotation.x=angle;

  surfaces=marbleSurfaces(segments);
  Object.assign(p,marbleStart(surfaces));checkpoint={x:p.x,y:p.y,z:p.z};

  mesh(marbleBoardGeometry(surfaces),stone);
  for(const s of segments){
   for(const u of [.2,.75]){const x=s.a[0]+(s.b[0]-s.a[0])*u,z=s.a[1]+(s.b[1]-s.a[1])*u,y=s.a[2]+(s.b[2]-s.a[2])*u;crystals.push({mesh:mesh(new THREE.OctahedronGeometry(.3),green,x,y+.85,z),taken:false,checkpoint:false});}
   if(s.index%3===2){const b=s.b;crystals.push({mesh:mesh(new THREE.TorusGeometry(.8,.09,6,16),green,b[0],b[2]+1,b[1]),taken:false,checkpoint:true});}
   if(course.hazards.includes(s.index)){const u=.55,group=new THREE.Group();group.position.set(s.a[0]+(s.b[0]-s.a[0])*u,s.a[2]+(s.b[2]-s.a[2])*u+.65,s.a[1]+(s.b[1]-s.a[1])*u);scene.add(group);mesh(new THREE.BoxGeometry(s.width*.85,.22,.35),pink,0,0,0,group);mesh(new THREE.CylinderGeometry(.22,.22,1.3,8),stone,0,-.15,0,group);hazards.push({group,r:s.width*.43,phase:s.index});}
   if(course.boosts.includes(s.index)){const u=.3,x=s.a[0]+(s.b[0]-s.a[0])*u,z=s.a[1]+(s.b[1]-s.a[1])*u,y=s.a[2]+(s.b[2]-s.a[2])*u;const tile=box(x,y+.04,z,s.width*.8,.05,1.7,green),direction=new THREE.Vector3(s.b[0]-s.a[0],s.b[2]-s.a[2],s.b[1]-s.a[1]).normalize(),normal=new THREE.Vector3(-direction.x*direction.y,1-direction.y*direction.y,-direction.z*direction.y).normalize(),side=new THREE.Vector3().crossVectors(normal,direction).normalize();tile.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,normal,direction));}
  }
  const end=course.points.at(-1);mesh(new THREE.TorusGeometry(1.4,.18,8,24),pink,end[0],end[2]+1.4,end[1]);
  for(let i=0;i<(high?40:12);i++){const x=(i%2?1:-1)*(20+i%6*4),z=-i*7,y=-8-i%4;mesh(high?new THREE.SphereGeometry(2+i%3,20,12):new THREE.IcosahedronGeometry(2+i%3,0),stone,x,y,z);}
  camera.position.set(p.x,p.y+5.7,p.z+9.5);camera.lookAt(p.x,p.y-.15,p.z-2.8);
 }else if(id==='rally'){
  rally=setupRally({scene,camera,light,high,level,player,mesh,mat,textures,materials,notify,finish:(won,text,points)=>{score=points;finish(won,text);}});Object.assign(p,rally.player);
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
   boostCooldown=Math.max(0,boostCooldown-dt);hazardCooldown=Math.max(0,hazardCooldown-dt);
   const boost=t<boostUntil,support=marbleStep(p,input,dt,surfaces,{jump:action,boost});grounded=p.grounded;
   if(support&&course.boosts.includes(support.index)&&support.u>.24&&support.u<.38&&grounded&&boostCooldown===0){const s=segments[support.index];p.vx=(s.b[0]-s.a[0])/s.length*13;p.vz=(s.b[1]-s.a[1])/s.length*13;boostUntil=t+1.5;boostCooldown=3;}
   for(const h of hazards){h.group.rotation.y=t*(1.1+level*.25)+h.phase;const dx=p.x-h.group.position.x,dz=p.z-h.group.position.z,along=dx*Math.cos(h.group.rotation.y)-dz*Math.sin(h.group.rotation.y),across=dx*Math.sin(h.group.rotation.y)+dz*Math.cos(h.group.rotation.y);if(hazardCooldown===0&&Math.abs(along)<h.r+.4&&Math.abs(across)<.48&&Math.abs(p.y-h.group.position.y)<.65){p.vx+=Math.sin(h.group.rotation.y)*5;p.vz+=Math.cos(h.group.rotation.y)*5;hazardCooldown=.65;}}
   player.position.set(p.x,p.y,p.z);const rollAxis=new THREE.Vector3(p.vz,0,-p.vx),rollSpeed=rollAxis.length();if(grounded&&rollSpeed>.001)ball.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(rollAxis.normalize(),rollSpeed*dt/.55));
   for(const c of crystals){c.mesh.rotation.y+=dt;if(!c.taken&&c.mesh.position.distanceTo(player.position)<1.2){c.taken=true;c.mesh.visible=false;if(c.checkpoint)checkpoint={x:p.x,y:p.y,z:p.z};else taken++;}}
   if(p.y<-8){falls++;if(falls>=5)finish(false,'Five falls. Brake before bends and jump across the marked gaps.');else{Object.assign(p,checkpoint,{vx:0,vz:0,vy:0});grounded=true;p.grounded=true;boostUntil=0;}}
   if(t>=course.time)finish(false,'Time is up. Use green boost pads and collect checkpoint rings.');
   const end=course.points.at(-1);if(Math.hypot(p.x-end[0],p.z-end[1])<1.7&&grounded){score=1200+taken*100+Math.max(0,Math.floor((course.time-t)*8))-falls*100;finish(true,`${course.name} complete · ${taken} crystals · ${Math.ceil(course.time-t)} seconds left.`);}
   score=Math.max(score,Math.max(0,Math.floor(-p.z*5))+taken*100);camera.position.lerp(new THREE.Vector3(p.x-p.vx*.12,p.y+5.7,p.z+9.5),1-Math.exp(-dt*9));camera.lookAt(p.x+p.vx*.13,p.y-.15,p.z-2.8+p.vz*.1);notify(`${course.name} · ${Math.ceil(course.time-t)}s · ${taken} crystals · ${5-falls} lives${boost?' · BOOST':''}`);
  }else if(id==='rally'){
   rally.update(input,dt);
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
  if(high){
   // Snap the sun's shadow camera to its texel grid; no shimmer while following.
   const center=player.position.clone(),texel=64/2048;center.x=Math.round(center.x/texel)*texel;center.z=Math.round(center.z/texel)*texel;
   if(!light.userData.followTarget){light.userData.followTarget=new THREE.Object3D();scene.add(light.userData.followTarget);light.target=light.userData.followTarget;}
   light.userData.followTarget.position.copy(center);light.position.copy(center).add(new THREE.Vector3(16,28,12));
  }
 }
 function loop(now){const dt=last?Math.min(.034,(now-last)/1000):0;last=now;if(!paused&&!done){update(dt);redraw=true;}if(redraw){renderer.render(scene,camera);redraw=false;}animation=requestAnimationFrame(loop);}
 const contextLost=e=>{e.preventDefault();finish(false,'The graphics context was interrupted. Retry, or open local practice in your browser.');};canvas.addEventListener('webglcontextlost',contextLost);player.position.set(p.x,p.y,p.z);renderer.render(scene,camera);animation=requestAnimationFrame(loop);
 return {pause(value){paused=value;redraw=true;input.previousAction=Boolean(input.action);},setMuted(){},dispose(){cancelAnimationFrame(animation);canvas.removeEventListener('webglcontextlost',contextLost);for(const g of new Set(geometries))g.dispose();for(const m of materials)m.dispose();for(const texture of textures)texture.dispose();renderer.dispose();}};
}
