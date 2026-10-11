import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const navigationRoutes=new WeakMap();
export function rallyNavigation(road,race){
 let route=navigationRoutes.get(road);
 if(!route){const xs=road.points.map(p=>p.x),zs=road.points.map(p=>p.z),minX=Math.min(...xs),minZ=Math.min(...zs),span=Math.max(Math.max(...xs)-minX,Math.max(...zs)-minZ,1),centerX=(Math.max(...xs)+minX)/2,centerZ=(Math.max(...zs)+minZ)/2;
  const project=p=>({x:.5+(p.x-centerX)/span,y:.5+(p.z-centerZ)/span});route={project,path:road.points.map(project)};navigationRoutes.set(road,route);
 }
 return {path:route.path,markers:[race.player,...race.opponents].map((p,i)=>({...route.project(p),number:i+1,player:i===0,gap:p.travel-race.player.travel,finished:Boolean(p.finished)}))};
}
// Original, unbranded long-hood GT silhouette. X is forward; dimensions are metres.
export function buildRallyCar({high,paint,mesh,mat,parent}){
 const rubber=mat('#101419');rubber.roughness=.96;rubber.metalness=0;
 const trim=mat('#151b21'),alloy=mat('#bac1c8');alloy.metalness=.92;alloy.roughness=.2;
 const glass=mat('#7997a6');glass.metalness=.25;glass.roughness=.08;glass.transparent=true;glass.opacity=.36;glass.depthWrite=false;
 const leather=mat('#262b30');leather.roughness=.86;leather.metalness=0;
 const lamp=mat('#e7f5ff');lamp.emissive.set('#e7f5ff');lamp.emissiveIntensity=1.8;
 const tail=mat('#e72530');tail.emissive.set('#e72530');tail.emissiveIntensity=.5;
 const round=(w,h,d,r=.06)=>new RoundedBoxGeometry(w,h,d,high?3:1,r);
 function rod(a,b,r,material,group=parent){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),node=mesh(new THREE.CylinderGeometry(r,r,start.distanceTo(end),high?8:5),material,0,0,0,group);node.position.copy(start.add(end).multiplyScalar(.5));node.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize());return node;}
 // A curved cross section loft avoids the flat cuboid silhouette of the old cars.
 const sections=[[-2.22,.78,.53,.23],[-1.85,.96,.56,.27],[-1.28,1.0,.59,.27],[-.6,.86,.58,.26],[.25,.86,.58,.26],[1.32,.99,.56,.25],[1.85,.91,.54,.23],[2.22,.76,.49,.22]],segments=high?32:12,pos=[],indices=[];
 for(const [x,w,y,h] of sections)for(let j=0;j<segments;j++){const a=j/segments*Math.PI*2;pos.push(x,y+Math.sin(a)*h,Math.cos(a)*w);}
 for(let i=0;i<sections.length-1;i++)for(let j=0;j<segments;j++){const a=i*segments+j,b=i*segments+(j+1)%segments,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);}
 // End caps face outwards, with no seams through the visible hood.
 for(const [row,reverse] of [[0,false],[sections.length-1,true]]){const center=pos.length/3,[x,,y]=sections[row];pos.push(x,y,0);for(let j=0;j<segments;j++){const a=row*segments+j,b=row*segments+(j+1)%segments;indices.push(center,reverse?b:a,reverse?a:b);}}
 const body=new THREE.BufferGeometry();body.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));body.setIndex(indices);body.computeVertexNormals();mesh(body,paint,0,0,0,parent);
 // Muscular wheel haunches and a short fastback rear are present in both quality modes.
 for(const x of [-1.28,1.32])for(const z of [-.82,.82]){const f=mesh(new THREE.SphereGeometry(.6,high?24:10,high?14:6),paint,x,.59,z,parent);f.scale.set(1,.54,.36);}
 const canopy=new THREE.Group();parent.add(canopy);const glassPanes=[];
 const glassSections=[[-1.55,.76,.78],[-1.02,.73,1.55],[-.21,.73,1.58],[.78,.79,.80]];
 for(let i=0;i<glassSections.length-1;i++){const [x0,w0,h0]=glassSections[i],[x1,w1,h1]=glassSections[i+1],v=[];
  for(const [x,w,h] of [[x0,w0,h0],[x1,w1,h1]])v.push(x,h,-w,x,h,w,x,.79,-w,x,.79,w);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex([0,1,4,1,5,4,0,4,2,2,4,6,1,3,5,3,7,5]);g.computeVertexNormals();const pane=mesh(g,glass,0,0,0,canopy);pane.material.side=THREE.DoubleSide;glassPanes.push(pane);
 }
 const roof=mesh(round(.88,.065,1.49,.035),paint,-.62,1.585,0,canopy);roof.name='solid-gt-roof';
 for(const z of [-1,1]){rod([.78,.8,z*.79],[-.21,1.58,z*.73],.026,paint,canopy);rod([-1.02,1.55,z*.73],[-1.57,.79,z*.76],.032,paint,canopy);rod([-1.02,.8,z*.79],[-1.02,1.55,z*.73],.018,trim,canopy);mesh(round(.27,.12,.18,.05),paint,.38,.96,z*.98,parent);}
 mesh(round(.12,.27,1.42,.06),trim,2.24,.46,0,parent);
 mesh(round(.09,.19,1.12,.035),rubber,2.32,.52,0,parent);
 if(high)for(let j=0;j<13;j++)mesh(round(.025,.15,.023,.008),alloy,2.375,.53,(j-6)*.075,parent);
 mesh(round(.14,.085,1.68,.025),trim,2.20,.28,0,parent);
 mesh(round(.12,.20,1.66,.03),trim,-2.22,.36,0,parent);
 mesh(round(.19,.045,1.66,.02),paint,-1.95,.84,0,parent);
 for(const z of [-.69,.69]){const front=mesh(round(.1,.09,.38,.03),lamp,2.13,.65,z,parent);front.rotation.x=Math.sign(z)*.12;mesh(round(.065,.075,.53,.028),tail,-2.22,.66,z,parent);mesh(new THREE.CylinderGeometry(.085,.085,.21,12),alloy,-2.30,.31,z*.78,parent).rotation.z=Math.PI/2;}
 const interior=new THREE.Group();parent.add(interior);
 const stitch=mat('#8b949a'),display=mat('#080e14');display.roughness=.35;
 const screen=mat('#81bcc2');screen.emissive.set('#84d8db');screen.emissiveIntensity=.8;
 // Full dark cabin lining prevents exterior body paint showing through the footwell.
 mesh(round(1.8,.045,1.65,.025),rubber,-.43,.845,0,interior);
 mesh(round(.53,.32,1.47,.10),leather,.27,.86,0,interior);
 mesh(round(.08,.055,1.41,.02),alloy,-.02,.85,0,interior);
 mesh(round(.12,.24,.38,.065),leather,.055,.98,.37,interior);
 mesh(round(.022,.195,.32,.04),display,-.018,.975,.37,interior);
 const needles=[];
 for(const z of [.285,.455]){
  const face=mesh(new THREE.CircleGeometry(.073,high?40:16),display,-.033,.98,z,interior);face.rotation.y=-Math.PI/2;
  const ring=mesh(new THREE.TorusGeometry(.076,.004,5,high?40:16),alloy,-.035,.98,z,interior);ring.rotation.y=Math.PI/2;
  for(let i=0;i<11;i++){const a=-2.35+i*.47,tick=mesh(new THREE.BoxGeometry(.004,.003,.009),screen,-.038,.98+Math.cos(a)*.063,z+Math.sin(a)*.063,interior);tick.rotation.x=-a;}
  const needle=new THREE.Group();needle.position.set(-.040,.98,z);interior.add(needle);mesh(round(.003,.052,.003,.001),tail,0,.024,0,needle);needles.push(needle);
 }
 const centerDisplay=mesh(round(.018,.16,.28,.018),display,-.011,.98,-.17,interior);
 let dashboardTexture=null,dashboardCanvas=null;
 if(typeof document!=='undefined'){
  dashboardCanvas=document.createElement('canvas');dashboardCanvas.width=512;dashboardCanvas.height=384;dashboardTexture=new THREE.CanvasTexture(dashboardCanvas);dashboardTexture.colorSpace=THREE.SRGBColorSpace;const m=screen.clone();m.color.set('#ffffff');m.emissive.set('#ffffff');m.map=dashboardTexture;m.emissiveMap=dashboardTexture;centerDisplay.material=m;
  // Face the driver (-X); a real screen shows speed, gear, RPM and shift indication.
  centerDisplay.geometry.dispose();centerDisplay.geometry=new THREE.PlaneGeometry(.34,.255);centerDisplay.rotation.y=-Math.PI/2;centerDisplay.position.set(-.024,.98,-.17);
 }
 for(const z of [-.61,-.39,.64]){
  const vent=mesh(new THREE.TorusGeometry(.05,.008,6,high?32:12),alloy,-.022,.88,z,interior);vent.rotation.y=Math.PI/2;
  for(let j=-2;j<=2;j++)mesh(new THREE.BoxGeometry(.005,.005,.083),trim,-.034,.88+j*.014,z,interior);
 }
 mesh(round(.94,.12,.31,.045),leather,-.55,.87,0,interior);
 const shifter=new THREE.Group();shifter.position.set(-.20,.86,0);interior.add(shifter);mesh(round(.105,.018,.105,.02),alloy,0,0,0,shifter);rod([0,0,0],[0,.09,0],.012,alloy,shifter);mesh(new THREE.SphereGeometry(.035,12,8),leather,0,.105,0,shifter);
 for(const z of [-.76,.76]){
  mesh(round(1.35,.28,.045,.025),leather,-.59,.95,z,interior);
  mesh(round(.46,.04,.085,.02),alloy,-.60,.97,z*.94,interior);
  mesh(round(.11,.025,.045,.01),alloy,-.16,1.05,z*.95,interior);
  mesh(round(1.15,.007,.007,.003),stitch,-.64,1.07,z*.985,interior);
 }
 for(const z of [-.37,.37]){mesh(round(.55,.13,.48,.06),leather,-.73,.46,z,interior);const seat=mesh(round(.14,.55,.48,.065),leather,-1.0,.72,z,interior);seat.rotation.z=.16;}
 const steering=new THREE.Group();steering.position.set(-.16,.99,.37);steering.rotation.y=Math.PI/2;interior.add(steering);mesh(new THREE.TorusGeometry(.16,.021,high?10:6,high?48:12),leather,0,0,0,steering);
 mesh(round(.13,.067,.035,.02),leather,0,-.01,0,steering);
 for(const sign of [-1,1]){const spoke=mesh(round(.10,.018,.023,.006),alloy,sign*.09,-.025,0,steering);spoke.rotation.z=sign*-.20;mesh(round(.045,.07,.015,.007),alloy,sign*.11,.025,-.032,steering);}
 mesh(round(.023,.10,.025,.006),alloy,0,-.09,0,steering);
 const glove=mat('#343b46'),suit=mat('#242e3e'),leftHand=new THREE.Group(),rightHand=new THREE.Group();interior.add(leftHand,rightHand);
 function hand(group){const palm=mesh(new THREE.SphereGeometry(.038,12,8),glove,0,0,0,group);palm.scale.set(.9,1.2,.65);for(let i=0;i<4;i++)mesh(round(.013,.041,.016,.006),glove,.021-i*.015,.025,-.015,group);mesh(round(.075,.045,.048,.018),suit,-.075,-.01,0,group);}
 hand(leftHand);hand(rightHand);
 const cockpitFrame=new THREE.Group();interior.add(cockpitFrame);
 for(const z of [-1,1]){rod([.78,.86,z*.79],[-.21,1.56,z*.73],.020,leather,cockpitFrame);mesh(round(.86,.035,.045,.01),leather,-.62,1.545,z*.71,cockpitFrame);}
 // Interior rear-view mirror, roof liner and sun visors, without hiding the road.
 mesh(round(.88,.025,1.45,.015),leather,-.62,1.545,0,cockpitFrame);mesh(round(.07,.055,.19,.012),alloy,.13,1.45,0,cockpitFrame);
 for(const z of [-.40,.40])mesh(round(.15,.016,.25,.006),leather,-.25,1.52,z,cockpitFrame);
 function setCockpit(active){canopy.visible=true;roof.visible=true;interior.visible=active;for(const pane of glassPanes)pane.visible=!active;}
 function animate(state,dt,navigation){
  steering.rotation.z=-(state.steer||0)*.85;
  needles[0].rotation.x=2.35-Math.min(1,(state.rpm??900)/7500)*4.7;needles[1].rotation.x=2.35-Math.min(1,Math.abs(state.speed)/60)*4.7;
  const phase=state.shift>0?Math.sin(Math.PI*(1-state.shift/.32)):0;shifter.rotation.z=phase*.22;
  leftHand.position.set(-.21,1.025,.515);rightHand.position.set(-.21+phase*.01,1.025-phase*.055,.225-phase*.21);
  leftHand.rotation.x=-(state.steer||0)*.5;rightHand.rotation.x=-(state.steer||0)*.5*(1-phase);
  if(dashboardCanvas){const c=dashboardCanvas.getContext('2d');c.fillStyle='#07131d';c.fillRect(0,0,512,384);c.fillStyle='#b2eef1';c.font='bold 23px sans-serif';c.fillText('LIVE TRACK · YOU 1',18,28);
   if(navigation){const size=202,ox=144,oy=40;c.strokeStyle='#64778b';c.lineWidth=9;c.lineJoin='round';c.beginPath();navigation.path.forEach((p,i)=>c[i?'lineTo':'moveTo'](ox+p.x*size,oy+p.y*size));c.closePath();c.stroke();
    for(const p of navigation.markers){c.beginPath();c.fillStyle=p.player?'#ffffff':['','#ffffff','#3da5bd','#f3bd47','#536ed0','#78a755'][p.number];c.arc(ox+p.x*size,oy+p.y*size,p.player?9:7,0,Math.PI*2);c.fill();c.font='bold 16px sans-serif';c.fillText(String(p.number),ox+p.x*size+10,oy+p.y*size-6);}
    const behind=navigation.markers.filter(p=>!p.player&&p.gap<0&&!p.finished).sort((a,b)=>b.gap-a.gap)[0];c.fillStyle='#b2eef1';c.font='20px sans-serif';c.fillText(behind?`BEHIND: ${behind.number} · ${Math.round(-behind.gap)} m`:'BEHIND: clear',18,274);
   }c.fillStyle='#b2eef1';c.font='bold 46px sans-serif';c.fillText(state.gear===-1?'R':String(state.gear??1),20,328);c.font='bold 32px sans-serif';c.fillText(`${Math.round(Math.abs(state.speed)*3.6)} km/h`,94,320);c.font='18px sans-serif';c.fillText(`${Math.round(state.rpm??900)} RPM`,326,320);c.fillStyle=phase>0?'#ffb955':'#66c9c9';c.fillRect(18,355,Math.min(476,(state.rpm??900)/7500*476),8);dashboardTexture.needsUpdate=true;}
 }
 const wheels=[];for(const x of [-1.28,1.32])for(const z of [-.96,.96]){const axle=new THREE.Group();axle.position.set(x,.37,z);parent.add(axle);const spin=new THREE.Group();axle.add(spin);
  const tire=mesh(new THREE.TorusGeometry(.27,.105,high?12:6,high?32:12),rubber,0,0,0,spin);tire.scale.z=1.30;
  const rim=mesh(new THREE.CylinderGeometry(.225,.225,.20,high?32:10),alloy,0,0,0,spin);rim.rotation.x=Math.PI/2;
  if(high){const brake=mat('#454b50');brake.metalness=.8;mesh(new THREE.CylinderGeometry(.18,.18,.21,24),brake,0,0,0,spin).rotation.x=Math.PI/2;
   for(let j=0;j<10;j++){const spoke=mesh(round(.36,.022,.028,.008),alloy,0,0,Math.sign(z)*.12,spin);spoke.rotation.z=j*Math.PI/10;}
   mesh(round(.075,.16,.045,.015),tail,.12,.04,-Math.sign(z)*.09,axle);
  }wheels.push({steering:axle,spin,front:x>0});
 }
 return {parent,wheels,tail,canopy,roof,glassPanes,interior,steering,body,shifter,needles,animate,setCockpit,dashboardTexture};
}
