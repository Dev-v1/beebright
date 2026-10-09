import * as THREE from 'three';

// WebView/GPU capability is distinct from the installed GPU model. Never hide
// startup exceptions or require a particular adapter to play the games.
export function createGameRenderer(canvas,quality,onGraphics=()=>{}) {
 const high=quality==='high';let context;
 try {context=canvas.getContext('webgl2',{alpha:false,antialias:high,powerPreference:'high-performance'});}catch{}
 if(!context){try{context=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'default'});}catch{}}
 if(context){
  let renderer;
  try {renderer=new THREE.WebGLRenderer({canvas,context,antialias:high});}
  catch(error){throw new Error(`3D startup failed: ${error.message}. Try opening local practice in your browser.`);}
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,high?2:1));renderer.setSize(800,500,false);
  renderer.shadowMap.enabled=high;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  const ext=context.getExtension('WEBGL_debug_renderer_info');
  const adapter=ext?context.getParameter(ext.UNMASKED_RENDERER_WEBGL):'WebGL 2';
  onGraphics(`${high?'High':'Lightweight'} quality · ${adapter}`);
  return {render:(s,c)=>renderer.render(s,c),dispose:()=>{renderer.dispose();renderer.forceContextLoss();}};
 }
 // Original triangle projection fallback, using the exact same 3D scenes and
 // gameplay. It stays playable when embedded WebView hardware access is denied.
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Neither WebGL 2 nor Canvas is available. Open local practice in a current browser.');
 canvas.width=800;canvas.height=500;
 onGraphics('Software 3D · WebView did not provide WebGL 2. Open in browser for GPU graphics.');
 return {render(scene,camera){
  scene.updateMatrixWorld();camera.updateMatrixWorld();
  ctx.fillStyle='#10182d';ctx.fillRect(0,0,800,500);const triangles=[];
  scene.traverse(object=>{
   if(!object.isMesh||!object.visible||object.userData.softwareHidden||!object.geometry?.attributes.position)return;
   for(let parent=object.parent;parent;parent=parent.parent)if(!parent.visible)return;
   const pos=object.geometry.attributes.position,index=object.geometry.index;
   const color=(Array.isArray(object.material)?object.material[0]:object.material).color.clone().convertLinearToSRGB();
   const count=index?index.count:pos.count;
   for(let i=0;i<count;i+=3){const vertices=[];
    for(let j=0;j<3;j++){const n=index?index.getX(i+j):i+j;vertices.push(new THREE.Vector3().fromBufferAttribute(pos,n).applyMatrix4(object.matrixWorld).project(camera));}
    if(vertices.some(v=>!Number.isFinite(v.x)||v.z< -1||v.z>1))continue;
    const shade=.65+.25*Math.abs(Math.sin(i*.19));
    triangles.push({v:vertices,z:vertices.reduce((s,v)=>s+v.z,0)/3,color:`rgb(${Math.round(color.r*255*shade)} ${Math.round(color.g*255*shade)} ${Math.round(color.b*255*shade)})`});
   }
  });
  triangles.sort((a,b)=>b.z-a.z);
  for(const triangle of triangles){ctx.fillStyle=triangle.color;ctx.beginPath();triangle.v.forEach((v,i)=>ctx[i?'lineTo':'moveTo']((v.x+1)*400,(1-v.y)*250));ctx.closePath();ctx.fill();}
 },dispose(){}};
}
