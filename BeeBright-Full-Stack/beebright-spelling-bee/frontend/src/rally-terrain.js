import * as THREE from 'three';
import {clamp} from './game-mechanics.js';
export function mountainHeight(course,x,z){let h=-2;for(const [mx,mz,peak,radius] of course.mountains||[])h+=peak*Math.exp(-((x-mx)**2+(z-mz)**2)/(radius*radius));return h+Math.sin(x*.07)*Math.cos(z*.055)*3;}
export function rallyTerrain(course,road,high){const alpine=course.theme==='alpine',size=alpine?650:360,geo=new THREE.PlaneGeometry(size,size,alpine?(high?128:64):1,alpine?(high?128:64):1);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position,colors=[],grass=new THREE.Color('#657755'),rock=new THREE.Color('#858885'),snow=new THREE.Color('#e4e9e8');
 for(let k=0;k<pos.count;k++){const x=pos.getX(k),z=pos.getZ(k);let height=-1.2;
  if(alpine){let nearest=Infinity,roadY=0;for(let i=0;i<road.points.length;i++){const a=road.points[i],b=road.points[(i+1)%road.points.length],dx=b.x-a.x,dz=b.z-a.z,u=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),d=(x-a.x-dx*u)**2+(z-a.z-dz*u)**2;if(d<nearest){nearest=d;roadY=a.y+(b.y-a.y)*u;}}
   // A road cutting through the mountains; keep the shoulder below the asphalt.
   const weight=clamp((Math.sqrt(nearest)-road.width/2-9)/24,0,1);height=THREE.MathUtils.lerp(roadY-.8,mountainHeight(course,x,z),weight*weight*(3-2*weight));
  }pos.setY(k,height);const color=grass.clone().lerp(rock,clamp((height-38)/45,0,1)).lerp(snow,clamp((height-95)/32,0,1));const grain=.94+.06*Math.sin(x*.3+z*.5);colors.push(color.r*grain,color.g*grain,color.b*grain);
 }geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
}
