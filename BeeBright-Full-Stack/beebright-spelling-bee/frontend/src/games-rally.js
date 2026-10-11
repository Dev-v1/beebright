import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RALLY_COURSES,clamp} from './game-mechanics.js';
import {rallyRoad,rallySample,newRallyRace,rallyStep} from './racing-mechanics.js';
// Continuous ribbons share section vertices; inclines have no stacked road boxes.
export function rallyRibbon(road,inner,outer,lift=0){
 const pos=[],uv=[],indices=[],n=road.points.length;
 for(let i=0;i<=n;i++){const j=i%n,prev=road.points[(j+n-1)%n],next=road.points[(j+1)%n],dx=next.x-prev.x,dz=next.z-prev.z,l=Math.hypot(dx,dz),point=road.points[j];
  for(const side of [inner,outer]){pos.push(point.x-dz/l*side,point.y+lift,point.z+dx/l*side);uv.push(side*.2,road.lengths[i]*.15);}
 }
 for(let i=0;i<n;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
export function buildRallyCar({high,paint,mesh,mat,parent}){
 const rubber=mat('#12161b');rubber.roughness=.94;rubber.metalness=0;
 const trim=mat('#17212a'),alloy=mat('#adb4bd');alloy.metalness=.9;alloy.roughness=.25;
 const glass=mat('#183b4d');glass.metalness=.48;glass.roughness=.12;
 const lamp=mat('#dff8ff');lamp.emissive.set('#dff8ff');lamp.emissiveIntensity=1.6;
 const tail=mat('#ed273b');tail.emissive.set('#ed273b');tail.emissiveIntensity=.4;
 const rounded=(w,h,d,r=.12)=>high?new RoundedBoxGeometry(w,h,d,3,r):new THREE.BoxGeometry(w,h,d);
 function profile(points,depth,material,z=0){const shape=new THREE.Shape();shape.moveTo(...points[0]);for(let i=1;i<points.length;i++)shape.bezierCurveTo(...points[i]);shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:.07,bevelThickness:.07,bevelSegments:3,curveSegments:high?16:5});geo.translate(0,0,-depth/2);return mesh(geo,material,0,0,z,parent);}
 if(high){
  profile([[-1.55,.34],[-1.65,.55,-1.48,.71,-1.05,.72],[-.6,.8,.58,.75,1.28,.59],[1.58,.54,1.7,.4,1.5,.32],[.7,.22,-.7,.22,-1.55,.34]],1.43,paint);
  profile([[-.94,.72],[-.72,1.12,-.54,1.26,-.25,1.27],[.12,1.28,.34,1.15,.65,.72],[.2,.69,-.65,.69,-.94,.72]],1.1,glass);
  mesh(rounded(.88,.055,1.05,.025),paint,-.25,1.29,0,parent);
  for(const x of [-1,1])for(const z of [-.65,.65]){const fender=mesh(new THREE.SphereGeometry(.48,20,12),paint,x,.51,z,parent);fender.scale.set(1.04,.64,.4);}
  for(const z of [-.86,.86])mesh(rounded(.28,.13,.16,.055),paint,.36,.94,z,parent);
  mesh(rounded(.08,.18,.76,.03),trim,1.64,.42,0,parent);
  mesh(rounded(.1,.11,1.15,.04),trim,-1.62,.33,0,parent);
  mesh(rounded(.16,.06,1.63,.025),paint,-1.23,.83,0,parent);
 }else{mesh(rounded(3,.5,1.55),paint,0,.5,0,parent);mesh(rounded(1.28,.48,1.22),glass,-.17,.93,0,parent);}
 for(const z of [-.56,.56]){mesh(rounded(.09,.1,.34,.035),lamp,1.56,.58,z,parent);mesh(rounded(.07,.1,.39,.035),tail,-1.57,.57,z,parent);}
 const wheels=[];for(const x of [-1,1])for(const z of [-.84,.84]){const steering=new THREE.Group();steering.position.set(x,.34,z);parent.add(steering);const spin=new THREE.Group();steering.add(spin);
  const tire=mesh(new THREE.TorusGeometry(.26,.10,high?10:5,high?28:12),rubber,0,0,0,spin);tire.scale.z=1.2;
  const rim=mesh(new THREE.CylinderGeometry(.21,.21,.19,high?24:8),alloy,0,0,0,spin);rim.rotation.x=Math.PI/2;
  if(high)for(let j=0;j<5;j++){const spoke=mesh(rounded(.3,.035,.035,.01),alloy,0,0,Math.sign(z)*.105,spin);spoke.rotation.z=j*Math.PI/5;}
  wheels.push({steering,spin,front:x>0});
 }
 return {parent,wheels,tail};
}
export function setupRally({scene,camera,light,high,level,player,mesh,mat,textures,materials,finish,notify}){
 const course=RALLY_COURSES[level]||RALLY_COURSES[0],road=rallyRoad(course),race=newRallyRace(road),night=course.theme==='city';
 scene.background=new THREE.Color(night?'#14243a':course.theme==='canyon'?'#cda385':'#a7c9dd');scene.fog=new THREE.Fog(scene.background,100,230);camera.far=260;camera.updateProjectionMatrix();
 light.color.set(night?'#a7cfff':'#ffe5c5');light.intensity=night?2.1:3.1;
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
 const terrain=mesh(new THREE.PlaneGeometry(220,220),verge,0,-1.2,0);terrain.rotation.x=-Math.PI/2;terrain.userData.softwareHidden=true;
 for(let i=0;i<road.points.length;i+=12){const point=road.points[i];if(point.y>1)mesh(new THREE.CylinderGeometry(.75,1.1,point.y+1.1,8),mat('#949996'),point.x,(point.y-1.1)/2,point.z);}
 const start=rallySample(road,0),banner=new THREE.Group();scene.add(banner);banner.position.set(start.x,start.y,start.z);banner.rotation.y=-start.heading;
 mesh(new THREE.BoxGeometry(.15,5,.15),white,0,2.5,-course.width/2-1,banner);mesh(new THREE.BoxGeometry(.15,5,.15),white,0,2.5,course.width/2+1,banner);mesh(new THREE.BoxGeometry(.25,.6,course.width+2.2),red,0,5,0,banner);
 for(let i=0;i<14;i++)mesh(new THREE.BoxGeometry(.8,.016,course.width/14),i%2?white:asphalt,0,.018,-course.width/2+(i+.5)*course.width/14,banner);
 const count=high?56:18;for(let i=0;i<count;i++){const a=i/count*Math.PI*2,x=Math.cos(a)*(81+i%3*5),z=Math.sin(a)*(81+i%4*5);
  if(night||course.theme==='harbor'){const h=6+i*7%20;mesh(new RoundedBoxGeometry(4,h,5,1,.2),mat(i%2?'#697985':'#526571'),x,h/2-1.2,z);if(high)for(let j=1;j<h;j+=2){const window=mat('#ffda89');window.emissive.set('#ffbd6a');window.emissiveIntensity=night?1.8:.2;mesh(new THREE.BoxGeometry(2.8,.6,.02),window,x,j,z+2.51);}}
  else if(course.theme==='alpine'){mesh(new THREE.ConeGeometry(2.6,8,high?12:5),mat('#375840'),x,2.7,z);mesh(new THREE.ConeGeometry(2.1,3.1,10),white,x,5.2,z);}
  else{const rock=mesh(new THREE.IcosahedronGeometry(4+i%5,high?1:0),mat('#94735b'),x,1.7,z);rock.scale.y=1.6;}
 }
 const paints=['#d84e71','#3da5bd','#f3bd47','#536ed0','#78a755'],cars=[];
 for(let i=0;i<5;i++){const group=i===0?player:new THREE.Group();if(i)scene.add(group);let paint=mat(paints[i]);if(high){paint.dispose();materials.splice(materials.indexOf(paint),1);paint=new THREE.MeshPhysicalMaterial({color:paints[i],metalness:.6,roughness:.25,clearcoat:1,clearcoatRoughness:.14,envMapIntensity:1.25});materials.push(paint);}cars.push(buildRallyCar({high,paint,mesh,mat,parent:group}));}
 if(high&&night){const headlight=new THREE.SpotLight('#dff2ff',25,35,.48,.45,1.5),target=new THREE.Object3D();headlight.position.set(1.5,.6,0);target.position.set(12,-.1,0);player.add(headlight,target);headlight.target=target;}
 const gateMarker=mesh(new THREE.TorusGeometry(.8,.08,6,16),mat('#a7e0a2'));
 function pose(car,state,dt){car.parent.position.set(state.x,state.y+.02,state.z);car.parent.rotation.order='YXZ';car.parent.rotation.set(clamp((state.lane??0)*state.speed*.0005,-.035,.035),-state.heading,Math.atan(state.grade||0));
  for(const wheel of car.wheels){wheel.spin.rotation.z-=state.speed*dt/.35;if(wheel.front)wheel.steering.rotation.y=state===race.player?-(Number(Boolean(race.input?.right))-Number(Boolean(race.input?.left)))*.25:0;}
  car.tail.emissiveIntensity=state===race.player&&race.input?.down?2.5:.4;
 }
 function render(dt){pose(cars[0],race.player,dt);race.opponents.forEach((p,i)=>pose(cars[i+1],p,dt));const p=race.player,next=rallySample(road,(p.gates+1)*road.length/12);gateMarker.position.set(next.x,next.y+1.2,next.z);gateMarker.rotation.y=-next.heading;
  const behind=new THREE.Vector3(p.x-Math.cos(p.heading)*10,p.y+5.3,p.z-Math.sin(p.heading)*10);camera.position.lerp(behind,1-Math.exp(-dt*5));const look=rallySample(road,p.travel+8);camera.lookAt(p.x+Math.cos(p.heading)*4,(p.y+look.y)/2+.7,p.z+Math.sin(p.heading)*4);
 }
 const p=race.player;camera.position.set(p.x-Math.cos(p.heading)*10,p.y+5.3,p.z-Math.sin(p.heading)*10);render(0);
 return {player:p,road,race,update(input,dt){race.input=input;rallyStep(race,road,input,dt);render(dt);
   const lap=Math.min(course.laps,Math.floor(Math.max(0,p.travel)/road.length)+1),speed=p.speed<-.2?'REVERSE':Math.round(Math.abs(p.speed)*6)+' km/h';
   notify(`${course.name} · Place ${race.place}/5 · Lap ${lap}/${course.laps} · ${speed} · ${race.time.toFixed(1)}s · Hill ${Math.round(p.y)}m`);
   if(race.finished){const score=Math.round(600000/race.time)+(6-race.place)*500;finish(race.place===1,`${course.name}: finished ${race.place} of 5 · ${course.laps} laps in ${race.time.toFixed(1)} seconds.`,score);}
 }};
}
