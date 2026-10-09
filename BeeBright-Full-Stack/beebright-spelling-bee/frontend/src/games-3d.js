import * as THREE from 'three';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function mount3D(canvas,{id,level=0,input,onFinish,onStatus}) {
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setSize(800,500,false);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#111a30');scene.fog=new THREE.Fog('#111a30',25,105);
 const camera=new THREE.PerspectiveCamera(55,1.6,.1,150);scene.add(new THREE.HemisphereLight(0xe0f5ff,0x253955,2.1));
 const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(8,15,10);scene.add(light);
 const materials=[],geometries=[];function material(color){const m=new THREE.MeshStandardMaterial({color,roughness:.72,metalness:.1});materials.push(m);return m;}
 const teal=material('#88ded6'),purple=material('#b5a0fa'),stone=material('#8a93ae'),green=material('#abec9e'),pink=material('#f6a4bf');
 function mesh(geometry,mat,x,y,z){geometries.push(geometry);const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);scene.add(m);return m;}
 let animation,last=0,t=0,paused=false,done=false,score=0,status='',spawn=0,shield=3,immune=0,cooldown=0;
 let items=[],platforms=[],crystals=[],bullets=[],p={x:0,y:.65,z:3,vx:0,vz:0,vy:0},grounded=true,collected=0;
 const marble=id==='marble';
 const player=marble?mesh(new THREE.SphereGeometry(.55,16,10),teal,0,.55,3):mesh(new THREE.ConeGeometry(.6,2,4),teal,0,0,5);
 if(!marble)player.rotation.x=-Math.PI/2;
 const end=-(66+level*12);
 if(marble){
  camera.position.set(0,10,16);camera.lookAt(0,0,0);
  const segments=Math.ceil(-end/9);for(let i=0;i<segments;i++){const z=2-i*9,x=i===0?0:Math.sin(i*1.2+level)*1.8,length=i===0?9:7.5;platforms.push({x,z,w:6.5,length});mesh(new THREE.BoxGeometry(6.5,.5,length),i%2?purple:stone,x,-.25,z);if(i>0){crystals.push({mesh:mesh(new THREE.OctahedronGeometry(.4),green,x,1,z),taken:false});}}
  const finishPlatform=platforms.at(-1);mesh(new THREE.TorusGeometry(1.2,.16,6,20),pink,finishPlatform.x,1.4,finishPlatform.z-2);
 }else{
  const starPositions=new Float32Array(300*3);for(let i=0;i<300;i++){starPositions[i*3]=(Math.random()-.5)*100;starPositions[i*3+1]=(Math.random()-.5)*80;starPositions[i*3+2]=-Math.random()*100;}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(starPositions,3));geometries.push(geo);const mat=new THREE.PointsMaterial({color:0xbecff6,size:.15});materials.push(mat);scene.add(new THREE.Points(geo,mat));camera.position.set(0,3,18);camera.lookAt(0,0,-20);
 }
 function finish(won,text){if(done)return;done=true;onFinish({won,text,score:Math.round(score)});}
 function notify(s){if(s!==status){status=s;onStatus(s);}}
 function update(dt){
  t+=dt;const action=input.action&&!input.previousAction;input.previousAction=Boolean(input.action);
  if(marble){
   const speed=6.7;p.vx+=(Number(Boolean(input.right))-Number(Boolean(input.left)))*20*dt;p.vz+=(Number(Boolean(input.down))-Number(Boolean(input.up)))*20*dt;p.vx=clamp(p.vx*Math.pow(.18,dt),-speed,speed);p.vz=clamp(p.vz*Math.pow(.18,dt),-speed,speed);
   if(action&&grounded){p.vy=8;grounded=false;}const oldY=p.y;p.vy-=19*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
   const support=platforms.find(a=>Math.abs(p.x-a.x)<a.w/2+.15&&Math.abs(p.z-a.z)<a.length/2+.15);
   if(support&&p.vy<=0&&oldY>=.55&&p.y<=.55){p.y=.55;p.vy=0;grounded=true;}else if(!support||p.y>.6)grounded=false;
   player.position.set(p.x,p.y,p.z);player.rotation.x+=p.vz*dt;player.rotation.z-=p.vx*dt;
   for(const crystal of crystals){crystal.mesh.rotation.y+=dt;crystal.mesh.position.y=1+Math.sin(t*2)*.15;if(!crystal.taken&&crystal.mesh.position.distanceTo(player.position)<1.1){crystal.taken=true;crystal.mesh.visible=false;collected++;}}
   score=Math.max(0,Math.floor(-p.z*10))+collected*100;
   camera.position.lerp(new THREE.Vector3(p.x*.4,10,p.z+13),Math.min(1,dt*5));camera.lookAt(p.x*.5,0,p.z-4);
   if(p.y<-8)finish(false,'The marble fell. Try a slower approach before each gap.');
   const a=platforms.at(-1);if(p.z<a.z-1.5&&support===a&&grounded){score=1000+collected*100+Math.max(0,Math.round(300-t));finish(true,`Course ${level+1} complete · ${collected}/${crystals.length} crystals.`);}
   notify(`Course ${level+1}/3 · ${collected}/${crystals.length} crystals`);
  }else{
   p.x=clamp(p.x+(Number(Boolean(input.right))-Number(Boolean(input.left)))*dt*10,-8,8);p.y=clamp(p.y+(Number(Boolean(input.up))-Number(Boolean(input.down)))*dt*8,-4.5,4.5);player.position.set(p.x,p.y,5);player.rotation.z=(Number(Boolean(input.right))-Number(Boolean(input.left)))*.35;player.visible=immune<=0||Math.floor(t*10)%2===0;
   score+=dt*5;immune=Math.max(0,immune-dt);cooldown-=dt;if(input.action&&cooldown<=0){cooldown=.2;bullets.push(mesh(new THREE.BoxGeometry(.12,.12,1.2),pink,p.x,p.y,3));}
   spawn-=dt;if(spawn<=0){spawn=Math.max(.28,.8-t*.005);const pickup=Math.random()<.15;items.push({mesh:mesh(pickup?new THREE.OctahedronGeometry(.55):new THREE.IcosahedronGeometry(.8+Math.random()*.6,0),pickup?green:stone,(Math.random()-.5)*16,(Math.random()-.5)*9,-95),pickup,r:pickup?.8:1.5});}
   for(const item of items){const m=item.mesh;m.position.z+=(24+t*.12)*dt;m.rotation.x+=dt;m.rotation.y+=dt*.8;
    if(Math.abs(m.position.z-5)<1.6&&Math.hypot(m.position.x-p.x,m.position.y-p.y)<item.r){if(item.pickup){shield=Math.min(3,shield+1);score+=100;m.position.z=25;}else if(!immune){shield--;immune=1.8;m.position.z=25;if(shield<=0)finish(false,'Shields depleted. Keep moving through clear lanes.');}}
    if(!item.pickup)for(const b of bullets)if(b.position.distanceTo(m.position)<item.r+1){m.position.z=25;b.position.z=-130;score+=50;break;}}
   for(const b of bullets)b.position.z-=65*dt;
   items=items.filter(i=>{if(i.mesh.position.z>20){scene.remove(i.mesh);i.mesh.geometry.dispose();return false;}return true;});bullets=bullets.filter(b=>{if(b.position.z< -110){scene.remove(b);b.geometry.dispose();return false;}return true;});
   if(t>=90){score+=1000;finish(true,'You survived the full 90-second asteroid run!');}notify(`Shields ${'●'.repeat(shield)}${'○'.repeat(3-shield)} · ${Math.ceil(90-t)}s · ${Math.floor(score)} points`);
  }
 }
 function loop(now){const dt=last?Math.min(.034,(now-last)/1000):0;last=now;if(!paused&&!done)update(dt);renderer.render(scene,camera);animation=requestAnimationFrame(loop);}
 const contextLost=e=>{e.preventDefault();finish(false,'3D graphics were interrupted. Restart the game or choose a 2D game.');};canvas.addEventListener('webglcontextlost',contextLost);
 animation=requestAnimationFrame(loop);
 return {pause(value){paused=value;input.previousAction=Boolean(input.action);},setMuted(){},dispose(){cancelAnimationFrame(animation);canvas.removeEventListener('webglcontextlost',contextLost);for(const g of new Set(geometries))g.dispose();for(const m of materials)m.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
