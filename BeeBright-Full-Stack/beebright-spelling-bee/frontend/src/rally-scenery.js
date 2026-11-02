import * as THREE from 'three';

// Bundled colors and original procedural scenery: no image downloads or network access.
export const RALLY_ENVIRONMENTS={
 coast:{sky:'#559cbd',horizon:'#ffe4b2',ground:'#dfc28b',verge:'#e4ce9f',road:'#4b5159',accent:'#36c5b6',props:'palms'},
 mesa:{sky:'#c58262',horizon:'#ffd19b',ground:'#a95537',verge:'#d38c57',road:'#493d37',accent:'#ffd06d',props:'cacti'},
 ridge:{sky:'#7a9ca2',horizon:'#edd1a5',ground:'#717e42',verge:'#a39355',road:'#3b4340',accent:'#f4ab4c',props:'autumn',terrain:['#718044','#80765a','#eee0bf']},
 town:{sky:'#72649b',horizon:'#f7b7a2',ground:'#987c79',verge:'#c9b4a2',road:'#574d62',accent:'#ef96c4',props:'houses'},
 summit:{sky:'#42759c',horizon:'#d9f1ff',ground:'#e1edf0',verge:'#b9d5df',road:'#445466',accent:'#61d7f0',props:'snow',terrain:['#93b8c5','#c0d2dc','#f3fbff']},
 docks:{sky:'#874b64',horizon:'#ffb274',ground:'#325f73',verge:'#9c826d',road:'#4a4249',accent:'#ffb869',props:'cargo'},
 aurora:{sky:'#071c32',horizon:'#173b4f',ground:'#adcdd9',verge:'#d4edf0',road:'#364c60',accent:'#63ffd3',props:'frozen',night:true,aurora:true,terrain:['#87b2c2','#bdd9e1','#ecffff']},
 polar:{sky:'#151530',horizon:'#30345c',ground:'#c1bbdf',verge:'#e5def7',road:'#464960',accent:'#ce9cff',props:'crystals',night:true,aurora:true,terrain:['#909ac0','#c5c4df','#f0ecff']},
};
export const rallyEnvironment=course=>RALLY_ENVIRONMENTS[course.scenery]||null;

export function auroraCurtain(radius,phase,segments=80){
 const positions=[],colors=[],indices=[];
 for(let i=0;i<=segments;i++){
  const a=i/segments*Math.PI*2,x=Math.cos(a)*radius,z=Math.sin(a)*radius;
  const base=50+12*Math.sin(a*3+phase)+7*Math.cos(a*7-phase);
  const tint=new THREE.Color().setHSL(.39+.2*(.5+.5*Math.sin(a*2+phase)),.9,.58);
  for(const height of [base,base+28+12*Math.sin(a*5+phase)]){
   positions.push(x,height,z);colors.push(tint.r,tint.g,tint.b);
  }
  if(i<segments){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function addRallyScenery({course,road,high,scene,mesh,mat,sample,groundHeight}){
 const style=rallyEnvironment(course),curtains=[];if(!style)return ()=>{};
 const leaf=mat(style.props==='autumn'?'#d88336':'#35866d'),trunk=mat('#79604e'),stone=mat(style.ground),ice=mat('#a2e4f0'),wood=mat('#997258');
 const count=high?54:26,makeMesh=mesh;
 for(let i=0;i<count;i++){
  const f=sample(road,i/count*road.length,(i%2?1:-1)*(road.width/2+17+i%3*7)),x=f.x,y=f.y-.6,z=f.z;
  const group=new THREE.Group();group.name='trackside-scenery-'+i;scene.add(group);
  const mesh=(g,m,x=0,y=0,z=0)=>makeMesh(g,m,x,y,z,group);
  if(style.props==='palms'){
   const stem=mesh(new THREE.CylinderGeometry(.25,.48,8,6),trunk,x,y+4,z);stem.rotation.z=.12;
   for(let j=0;j<5;j++){const a=j*Math.PI*2/5,frond=mesh(new THREE.ConeGeometry(1.1,6,4),leaf,x+Math.cos(a)*2,y+8,z+Math.sin(a)*2);frond.rotation.set(Math.cos(a)*1.1,0,Math.sin(a)*1.1);}
  }else if(style.props==='cacti'){
   mesh(new THREE.CylinderGeometry(.65,.8,6,7),leaf,x,y+3,z);
   mesh(new THREE.BoxGeometry(4,.7,.8),leaf,x,y+3.5,z);
   for(const side of [-1,1])mesh(new THREE.CylinderGeometry(.4,.4,2.4,6),leaf,x+side*1.6,y+4.4,z);
   if(i%4===0)mesh(new THREE.CylinderGeometry(7,10,11,6),stone,x+12,y+5.5,z+14);
  }else if(['autumn','snow','frozen'].includes(style.props)){
   mesh(new THREE.CylinderGeometry(.35,.5,7,6),trunk,x,y+3.5,z);
   if(style.props==='autumn'){
    const crown=mat(i%2?'#c87432':'#dbb54a');mesh(new THREE.IcosahedronGeometry(3.8,high?1:0),crown,x,y+7,z);
   }else{
    mesh(new THREE.ConeGeometry(3,8,7),leaf,x,y+6,z);
    mesh(new THREE.ConeGeometry(2.6,6,7),ice,x,y+7.3,z);
   }
  }else if(style.props==='houses'){
   const paint=mat(['#e7b38b','#b5bb9b','#b7a4c7','#d5958f'][i%4]);
   const height=5+i%3;mesh(new THREE.BoxGeometry(9,height,8),paint,x,y+height/2,z);
   const roof=mesh(new THREE.ConeGeometry(7,3,4),wood,x,y+height+1.5,z);roof.rotation.y=Math.PI/4;
  }else if(style.props==='cargo'){
   const paint=mat(['#ba6557','#4a9b9c','#d5a34e'][i%3]);
   mesh(new THREE.BoxGeometry(12,3.5,5),paint,x,y+1.75,z);
   if(i%3===0){mesh(new THREE.BoxGeometry(.6,16,.6),wood,x,y+8,z+5);mesh(new THREE.BoxGeometry(14,.6,.6),wood,x+5,y+15.7,z+5);mesh(new THREE.CylinderGeometry(.06,.06,9,4),wood,x+11,y+11,z+5);}
  }else{
   const crystal=mesh(new THREE.ConeGeometry(2.5,9+i%4,5),ice,x,y+3,z);crystal.rotation.z=(i%3-1)*.18;
  }
  // Settle the whole prop after its geometry and rotations are known, including
  // the taller houses and tilted crystals. Bury the base slightly into the soil.
  const bounds=new THREE.Box3().setFromObject(group),ground=groundHeight(x,z);
  group.position.y+=ground-bounds.min.y-.4;
  group.userData.groundAnchor={x,z,height:ground};
 }
 if(style.aurora){
  const sky=new THREE.Group();scene.add(sky);
  for(let layer=0;layer<3;layer++){
   const glow=mat(layer===1?'#b18aff':'#55f6bb');glow.side=THREE.DoubleSide;glow.vertexColors=true;glow.emissive.set(layer===1?'#9365dc':'#42d99a');glow.emissiveIntensity=.9;glow.roughness=1;glow.fog=false;glow.transparent=true;glow.opacity=.62;glow.depthWrite=false;
   const curtain=mesh(auroraCurtain(320+layer*35,layer*1.7,high?112:48),glow,0,layer*15,0,sky);curtain.name='northern-lights-'+layer;curtain.castShadow=false;curtain.receiveShadow=false;curtains.push(curtain);
  }
  const stars=mat('#e4f9ff');stars.emissive.set('#bddcff');stars.emissiveIntensity=1.2;stars.fog=false;
  for(let i=0;i<(high?70:30);i++){const a=i*2.39996,r=390,alt=60+(i*43%220),star=mesh(new THREE.OctahedronGeometry(.5+i%3*.2),stars,Math.cos(a)*r,alt,Math.sin(a)*r,sky);star.castShadow=false;star.receiveShadow=false;}
  return (time,camera)=>{sky.position.set(camera.position.x,0,camera.position.z);curtains.forEach((curtain,i)=>{curtain.rotation.y=Math.sin(time*.06+i)*.035;curtain.material.emissiveIntensity=.8+.18*Math.sin(time*.3+i);});};
 }
 return ()=>{};
}
