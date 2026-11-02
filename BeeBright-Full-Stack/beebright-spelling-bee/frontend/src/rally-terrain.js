import * as THREE from 'three';
import {clamp} from './game-mechanics.js';
import {rallyEnvironment} from './rally-scenery.js';
export function mountainHeight(course,x,z){let h=-2;for(const [mx,mz,peak,radius] of course.mountains||[])h+=peak*Math.exp(-((x-mx)**2+(z-mz)**2)/(radius*radius));return h+Math.sin(x*.07)*Math.cos(z*.055)*3;}
export function rallyTerrain(course,road,high){const alpine=course.theme==='alpine'||Boolean(course.mountains),style=rallyEnvironment(course),extent=Math.max(...road.points.flatMap(p=>[Math.abs(p.x),Math.abs(p.z)])),size=Math.max(alpine?650:360,2*(extent+course.width/2+90)),geo=new THREE.PlaneGeometry(size,size,high?128:64,high?128:64);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position,colors=[],grass=new THREE.Color(style?.terrain?.[0]||style?.ground||'#657755'),rock=new THREE.Color(style?.terrain?.[1]||'#858885'),snow=new THREE.Color(style?.terrain?.[2]||'#e4e9e8');
 for(let k=0;k<pos.count;k++){const x=pos.getX(k),z=pos.getZ(k);let height=-1.2;
  {let nearest=Infinity,roadY=0;for(let i=0;i<road.points.length;i++){const a=road.points[i],b=road.points[(i+1)%road.points.length],dx=b.x-a.x,dz=b.z-a.z,u=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),d=(x-a.x-dx*u)**2+(z-a.z-dz*u)**2;if(d<nearest){nearest=d;roadY=a.y+(b.y-a.y)*u;}}
   // A road cutting through the mountains; keep the shoulder below the asphalt.
   const weight=clamp((Math.sqrt(nearest)-road.width/2-9)/24,0,1);height=THREE.MathUtils.lerp(roadY-.8,alpine?mountainHeight(course,x,z):-1.2,weight*weight*(3-2*weight));
  }pos.setY(k,height);const color=grass.clone().lerp(rock,clamp((height-38)/45,0,1)).lerp(snow,clamp((height-95)/32,0,1));const grain=.94+.06*Math.sin(x*.3+z*.5);colors.push(color.r*grain,color.g*grain,color.b*grain);
 }geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
}

// Sample the actual rendered triangle, rather than the road's elevation. This
// keeps scenery bases on the same surface in both graphics modes.
export function rallyGroundHeight(geometry,x,z){
 const {width,height,widthSegments:n,heightSegments:m}=geometry.parameters;
 const u=clamp((x/width+.5)*n,0,n),v=clamp((z/height+.5)*m,0,m),i=Math.min(n-1,Math.floor(u)),j=Math.min(m-1,Math.floor(v)),a=j*(n+1)+i,p=geometry.attributes.position;
 const dx=u-i,dz=v-j,A=p.getY(a),B=p.getY(a+n+1),C=p.getY(a+n+2),D=p.getY(a+1);
 return dx+dz<=1?A+(D-A)*dx+(B-A)*dz:C+(B-C)*(1-dx)+(D-C)*(1-dz);
}

