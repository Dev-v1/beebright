import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RALLY_COURSES,clamp} from './game-mechanics.js';
import {rallyRoad,rallySample,newRallyRace,rallyStep,newRallyView,rallyViewStep} from './racing-mechanics.js';
import {buildRallyCar,rallyNavigation} from './rally-car.js';
export {buildRallyCar} from './rally-car.js';
import {rallyTerrain} from './rally-terrain.js';
// Continuous ribbons share section vertices; inclines have no stacked road boxes.
export function rallyRibbon(road,inner,outer,lift=0){
 const pos=[],uv=[],indices=[],n=road.points.length;
 for(let i=0;i<=n;i++){const j=i%n,prev=road.points[(j+n-1)%n],next=road.points[(j+1)%n],dx=next.x-prev.x,dz=next.z-prev.z,l=Math.hypot(dx,dz),point=road.points[j];
  for(const side of [inner,outer]){pos.push(point.x-dz/l*side,point.y+lift,point.z+dx/l*side);uv.push(side*.2,road.lengths[i]*.15);}
 }
 for(let i=0;i<n;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
export function setupRally({scene,camera,light,high,level,player,mesh,mat,textures,materials,finish,notify}){
 const course=RALLY_COURSES[level]||RALLY_COURSES[0],road=rallyRoad(course),race=newRallyRace(road),view=newRallyView(),night=course.theme==='city';
 scene.background=new THREE.Color(night?'#14243a':course.theme==='canyon'?'#cda385':'#a7c9dd');scene.fog=new THREE.Fog(scene.background,180,540);camera.far=650;camera.updateProjectionMatrix();
 light.color.set(night?'#a7cfff':'#ffe5c5');light.intensity=night?2.1:3.4;
 light.shadow.bias=-.00012;light.shadow.normalBias=.025;
 Object.assign(light.shadow.camera,{left:-32,right:32,top:32,bottom:-32,far:140});
 if(high){const sky=new Uint8Array(256*128*4);for(let y=0;y<128;y++)for(let x=0;x<256;x++){const h=y/127,sun=Math.exp(-((x-172)**2+(y-40)**2)/35),i=(y*256+x)*4;sky[i]=night?18+35*h:80+150*h+sun*25;sky[i+1]=night?28+50*h:145+100*h;sky[i+2]=night?50+65*h:200+35*h;sky[i+3]=255;}
  const env=new THREE.DataTexture(sky,256,128);env.mapping=THREE.EquirectangularReflectionMapping;env.colorSpace=THREE.SRGBColorSpace;env.needsUpdate=true;scene.environment=env;scene.background=env;textures.push(env);
 }
 const asphalt=mat('#3b4147');asphalt.roughness=.92;asphalt.metalness=0;
 if(high){const data=new Uint8Array(64*64*4);for(let i=0;i<4096;i++){const v=145+(i*31+i%19*7)%65;data[i*4]=data[i*4+1]=data[i*4+2]=v;data[i*4+3]=255;}const grain=new THREE.DataTexture(data,64,64);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.needsUpdate=true;asphalt.map=grain;asphalt.bumpMap=grain;asphalt.bumpScale=.025;textures.push(grain);}
 mesh(rallyRibbon(road,-course.width/2,course.width/2),asphalt);
 const verge=mat(course.theme==='canyon'?'#a87856':course.theme==='alpine'?'#739371':'#7c947c');verge.metalness=0;verge.roughness=1;
 for(const side of [-1,1]){const lo=side<0?-course.width/2-3:course.width/2,hi=lo+3;mesh(rallyRibbon(road,lo,hi,-.08),verge);}
 const red=mat('#bb4b43'),white=mat('#e6dfce');red.metalness=white.metalness=0;
 for(const side of [-1,1]){const lo=side<0?-course.width/2-.5:course.width/2;mesh(rallyRibbon(road,lo,lo+.5,.045),red);}
 const stripe=mat('#fff5cc');stripe.polygonOffset=true;stripe.polygonOffsetFactor=-1;stripe.polygonOffsetUnits=-1;mesh(rallyRibbon(road,-.05,.05,.014),stripe);
 // Elevated roads are supported by piers; terrain does not clip through the road.
 const terrainMat=mat(course.theme==='alpine'?'#ffffff':course.theme==='canyon'?'#b18a65':'#719077');terrainMat.vertexColors=course.theme==='alpine';terrainMat.metalness=0;terrainMat.roughness=.96;const terrain=mesh(rallyTerrain(course,road,high),terrainMat);terrain.userData.softwareHidden=true;
 for(let i=0;i<road.points.length;i+=12){const point=road.points[i];if(point.y>1)mesh(new THREE.CylinderGeometry(.75,1.1,point.y+1.1,8),mat('#949996'),point.x,(point.y-1.1)/2,point.z);}
 const start=rallySample(road,0),banner=new THREE.Group();scene.add(banner);banner.position.set(start.x,start.y,start.z);banner.rotation.y=-start.heading;
 mesh(new THREE.BoxGeometry(.15,5,.15),white,0,2.5,-course.width/2-1,banner);mesh(new THREE.BoxGeometry(.15,5,.15),white,0,2.5,course.width/2+1,banner);mesh(new THREE.BoxGeometry(.25,.6,course.width+2.2),red,0,5,0,banner);
 for(let i=0;i<14;i++)mesh(new THREE.BoxGeometry(.8,.016,course.width/14),i%2?white:asphalt,0,.018,-course.width/2+(i+.5)*course.width/14,banner);
 // Trackside details are distributed along the longer routes, away from the road.
 const treeMat=mat('#345342'),bark=mat('#62574d'),rockMat=mat('#93968a'),buildingMat=mat(night?'#354352':'#7c898b');
 const count=high?90:28;
 for(let i=0;i<count;i++){const f=rallySample(road,i/count*road.length,(i%2?1:-1)*(course.width/2+12+i%4*5)),x=f.x,z=f.z,y=f.y-1;
  if(night||course.theme==='harbor'){const h=8+i*7%24;mesh(new RoundedBoxGeometry(6,h,7,1,.25),buildingMat,x,y+h/2,z);if(high){const window=mat('#ffd398');window.emissive.set('#ffbd6a');window.emissiveIntensity=night?1.2:.15;for(let j=2;j<h;j+=3)mesh(new THREE.BoxGeometry(4.8,.7,.04),window,x,y+j,z+3.52);}}
  else if(course.theme==='alpine'){mesh(new THREE.CylinderGeometry(.24,.32,5,6),bark,x,y+2.5,z);mesh(new THREE.ConeGeometry(2.5,8,high?12:5),treeMat,x,y+5,z);if(high)mesh(new THREE.ConeGeometry(1.8,5,10),treeMat,x,y+8,z);}
  else{const rock=mesh(new THREE.IcosahedronGeometry(4+i%4,high?1:0),rockMat,x,y+1,z);rock.scale.set(1,1.5,.8);}
 }
 // Guardrails visually mark the exposed Alpine edge; braking boards reveal tight bends.
 const rail=mat('#b1b9bc');rail.metalness=.8;rail.roughness=.4;
 for(let d=0;d<road.length;d+=high?12:30){const f=rallySample(road,d),after=rallySample(road,d+18),bend=Math.atan2(Math.sin(after.heading-f.heading),Math.cos(after.heading-f.heading));
  if(course.theme==='alpine'&&f.y>20){const side=bend>0?-1:1,g=rallySample(road,d,side*(course.width/2+1));const beam=mesh(new THREE.BoxGeometry(high?12:28,.28,.12),rail,g.x,g.y+.8,g.z);beam.rotation.y=-g.heading;beam.rotation.z=Math.atan(g.grade);mesh(new THREE.CylinderGeometry(.055,.055,1.15,6),rail,g.x,g.y+.42,g.z);}
  if(Math.abs(bend)>.65&&Math.floor(d/12)%3===0){const g=rallySample(road,d,course.width/2+2),sign=mesh(new THREE.BoxGeometry(.08,.9,1.1),white,g.x,g.y+1.8,g.z);sign.rotation.y=-g.heading;mesh(new THREE.CylinderGeometry(.055,.055,1.5,6),rail,g.x,g.y+.75,g.z);}
 }
 const paints=['#d84e71','#3da5bd','#f3bd47','#536ed0','#78a755'],cars=[];
 for(let i=0;i<5;i++){const group=i===0?player:new THREE.Group();if(i)scene.add(group);let paint=mat(paints[i]);if(high){paint.dispose();materials.splice(materials.indexOf(paint),1);paint=new THREE.MeshPhysicalMaterial({color:paints[i],metalness:.6,roughness:.2,clearcoat:1,clearcoatRoughness:.09,envMapIntensity:1.55});materials.push(paint);}cars.push(buildRallyCar({high,paint,mesh,mat,parent:group}));}
 if(high&&night){const headlight=new THREE.SpotLight('#dff2ff',25,35,.48,.45,1.5),target=new THREE.Object3D();headlight.position.set(1.5,.6,0);target.position.set(12,-.1,0);player.add(headlight,target);headlight.target=target;}
 const gateMarker=mesh(new THREE.TorusGeometry(.8,.08,6,16),mat('#a7e0a2'));
 function pose(car,state,dt){car.parent.visible=!state.finished||(state.finishAge??0)<5;car.parent.position.set(state.x,state.y+.02,state.z);car.parent.rotation.order='YXZ';car.parent.rotation.set(clamp((state.lane??0)*state.speed*.0005,-.035,.035),-state.heading,Math.atan(state.grade||0));
  for(const wheel of car.wheels){wheel.spin.rotation.z-=state.speed*dt/.375;if(wheel.front)wheel.steering.rotation.y=-(state.steer||0)*.32;}car.animate(state,dt,state===race.player?rallyNavigation(road,race):null);
  car.tail.emissiveIntensity=state===race.player&&race.input?.down?2.5:.4;
 }
 function render(dt){pose(cars[0],race.player,dt);race.opponents.forEach((p,i)=>pose(cars[i+1],p,dt));const p=race.player,next=rallySample(road,(p.gates+1)*road.length/12);gateMarker.position.set(next.x,next.y+1.2,next.z);gateMarker.rotation.y=-next.heading;
  cars[0].setCockpit(view.cockpit);
  if(view.changed){camera.fov=view.cockpit?84:58;camera.near=view.cockpit?.025:.1;camera.updateProjectionMatrix();}
  if(view.cockpit){player.updateMatrixWorld(true);const eye=player.localToWorld(new THREE.Vector3(-.72,1.20,.37)),target=player.localToWorld(new THREE.Vector3(24,1.13,.37));camera.position.copy(eye);camera.up.set(0,1,0);camera.lookAt(target);}
  else{const behind=new THREE.Vector3(p.x-Math.cos(p.heading)*10,p.y+4.2,p.z-Math.sin(p.heading)*10);if(view.changed)camera.position.copy(behind);else camera.position.lerp(behind,1-Math.exp(-dt*7));const look=rallySample(road,p.travel+8);camera.lookAt(p.x+Math.cos(p.heading)*6,(p.y+look.y)/2+.85,p.z+Math.sin(p.heading)*6);}
 }
 const p=race.player;camera.position.set(p.x-Math.cos(p.heading)*10,p.y+5.3,p.z-Math.sin(p.heading)*10);render(0);
 return {player:p,road,race,view,pause(input){view.previous=Boolean(input.camera);},update(input,dt){rallyViewStep(view,input.camera);race.input=input;rallyStep(race,road,input,dt);render(dt);
   const lap=Math.min(course.laps,Math.floor(Math.max(0,p.travel)/road.length)+1),speed=p.speed<-.2?'REVERSE':Math.round(Math.abs(p.speed)*3.6)+' km/h';
   notify(`${course.name} · ${view.cockpit?'Cockpit':'Chase'} · Place ${race.place}/5 · Lap ${lap}/${course.laps} · ${speed} · Gear ${p.gear===-1?'R':p.gear??1} · ${race.time.toFixed(1)}s · Hill ${Math.round(p.y)}m`);
   if(race.finished){const score=Math.round(600000/race.time)+(6-race.place)*500;finish(race.place===1,`${course.name}: finished ${race.place} of 5 · ${course.laps} laps in ${race.time.toFixed(1)} seconds.`,score);}
 }};
}
