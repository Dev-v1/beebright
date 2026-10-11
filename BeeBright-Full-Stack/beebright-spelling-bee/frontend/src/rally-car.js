import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
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
 const canopy=new THREE.Group();parent.add(canopy);
 const glassSections=[[-1.55,.70,.78],[-.78,.66,1.22],[-.12,.64,1.25],[.68,.73,.82]];
 for(let i=0;i<glassSections.length-1;i++){const [x0,w0,h0]=glassSections[i],[x1,w1,h1]=glassSections[i+1],v=[];
  for(const [x,w,h] of [[x0,w0,h0],[x1,w1,h1]])v.push(x,h,-w,x,h,w,x,.79,-w,x,.79,w);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex([0,1,4,1,5,4,0,4,2,2,4,6,1,3,5,3,7,5]);g.computeVertexNormals();const pane=mesh(g,glass,0,0,0,canopy);pane.material.side=THREE.DoubleSide;
 }
 mesh(round(.76,.055,1.28,.025),paint,-.43,1.26,0,canopy);
 for(const z of [-1,1]){rod([.66,.8,z*.74],[-.12,1.25,z*.65],.027,paint,canopy);rod([-.8,1.22,z*.66],[-1.57,.79,z*.7],.032,paint,canopy);rod([-.78,.8,z*.77],[-.78,1.23,z*.66],.018,trim,canopy);mesh(round(.27,.12,.18,.05),paint,.38,.96,z*.98,parent);}
 mesh(round(.12,.27,1.42,.06),trim,2.24,.46,0,parent);
 mesh(round(.09,.19,1.12,.035),rubber,2.32,.52,0,parent);
 if(high)for(let j=0;j<13;j++)mesh(round(.025,.15,.023,.008),alloy,2.375,.53,(j-6)*.075,parent);
 mesh(round(.14,.085,1.68,.025),trim,2.20,.28,0,parent);
 mesh(round(.12,.20,1.66,.03),trim,-2.22,.36,0,parent);
 mesh(round(.19,.045,1.66,.02),paint,-1.95,.84,0,parent);
 for(const z of [-.69,.69]){const front=mesh(round(.1,.09,.38,.03),lamp,2.13,.65,z,parent);front.rotation.x=Math.sign(z)*.12;mesh(round(.065,.075,.53,.028),tail,-2.22,.66,z,parent);mesh(new THREE.CylinderGeometry(.085,.085,.21,12),alloy,-2.30,.31,z*.78,parent).rotation.z=Math.PI/2;}
 const interior=new THREE.Group();parent.add(interior);
 mesh(round(.42,.19,1.40,.05),leather,.27,.79,0,interior);mesh(round(.055,.1,.26,.025),trim,.035,.94,.37,interior);
 const screen=mat('#72bcc1');screen.emissive.set('#6dbabd');screen.emissiveIntensity=.45;mesh(new THREE.BoxGeometry(.012,.064,.19),screen,.004,.943,.37,interior);
 mesh(round(.6,.1,.24,.04),trim,-.4,.58,0,interior);
 for(const z of [-.37,.37]){mesh(round(.55,.13,.48,.06),leather,-.73,.46,z,interior);const seat=mesh(round(.14,.55,.48,.065),leather,-1.0,.72,z,interior);seat.rotation.z=.16;}
 const steering=new THREE.Group();steering.position.set(.0,.88,.37);steering.rotation.y=Math.PI/2;interior.add(steering);mesh(new THREE.TorusGeometry(.16,.022,6,high?24:12),leather,0,0,0,steering);mesh(round(.18,.035,.035,.01),alloy,0,-.025,0,steering);
 const wheels=[];for(const x of [-1.28,1.32])for(const z of [-.96,.96]){const axle=new THREE.Group();axle.position.set(x,.37,z);parent.add(axle);const spin=new THREE.Group();axle.add(spin);
  const tire=mesh(new THREE.TorusGeometry(.27,.105,high?12:6,high?32:12),rubber,0,0,0,spin);tire.scale.z=1.30;
  const rim=mesh(new THREE.CylinderGeometry(.225,.225,.20,high?32:10),alloy,0,0,0,spin);rim.rotation.x=Math.PI/2;
  if(high){const brake=mat('#454b50');brake.metalness=.8;mesh(new THREE.CylinderGeometry(.18,.18,.21,24),brake,0,0,0,spin).rotation.x=Math.PI/2;
   for(let j=0;j<10;j++){const spoke=mesh(round(.36,.022,.028,.008),alloy,0,0,Math.sign(z)*.12,spin);spoke.rotation.z=j*Math.PI/10;}
   mesh(round(.075,.16,.045,.015),tail,.12,.04,-Math.sign(z)*.09,axle);
  }wheels.push({steering:axle,spin,front:x>0});
 }
 return {parent,wheels,tail,canopy,interior,steering,body};
}
