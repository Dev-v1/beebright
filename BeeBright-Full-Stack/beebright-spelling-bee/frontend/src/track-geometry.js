import * as THREE from 'three';
// A watertight track: top triangles plus only exposed boundary walls.
// Shared joins have neither overlapping tops nor internal side walls.
export function marbleBoardGeometry(surfaces){
 const top=[],keys=new Map(),triangles=[],edges=new Map();
 const vertex=v=>{const key=v.map(n=>n.toFixed(8)).join(',');if(!keys.has(key)){keys.set(key,top.length);top.push(v);}return keys.get(key);};
 for(const s of surfaces){let ids=s.vertices.map(vertex);const [a,b,c]=s.vertices;
  if((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])<0)ids=[ids[0],ids[2],ids[1]];
  triangles.push(ids);for(let i=0;i<3;i++){const a=ids[i],b=ids[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});}
 }
 const positions=[...top,...top.map(([x,y,z])=>[x,y-.35,z])],n=top.length,indices=[];
 for(const [a,b,c] of triangles)indices.push(a,b,c,a+n,c+n,b+n);
 for(const {a,b,count} of edges.values())if(count===1)indices.push(b,a,a+n,b,a+n,b+n);
 const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(positions.flat(),3));indexed.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap(([x,,z])=>[x*.25,z*.25]),2));indexed.setIndex(indices);
 const geometry=indexed.toNonIndexed();indexed.dispose();geometry.computeVertexNormals();return geometry;
}
