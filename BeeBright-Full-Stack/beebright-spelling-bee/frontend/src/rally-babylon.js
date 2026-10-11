import {Engine} from '@babylonjs/core/Engines/engine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera.js';
import {Vector3,Quaternion} from '@babylonjs/core/Maths/math.vector.js';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color.js';
import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {PBRMaterial} from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight.js';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight.js';
import {ShadowGenerator} from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import {DefaultRenderingPipeline} from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.js';
import {RawTexture} from '@babylonjs/core/Materials/Textures/rawTexture.js';
import {RawCubeTexture} from '@babylonjs/core/Materials/Textures/rawCubeTexture.js';
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import {Texture} from '@babylonjs/core/Materials/Textures/texture.js';
import {Constants} from '@babylonjs/core/Engines/constants.js';
import {ImageProcessingConfiguration} from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import {Material} from '@babylonjs/core/Materials/material.js';
import {createGameRenderer} from './game-renderer.js';

// High racing uses Babylon's PBR/render pipeline. The shared scene authoring and
// physics stay engine-independent; Light mode retains the low-cost renderer.
export async function createRallyRenderer(canvas,onGraphics){
 const probe=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 if(!probe)return createGameRenderer(canvas,'light',onGraphics);
 let engine;
 try{engine=new Engine(canvas,true,{alpha:false,preserveDrawingBuffer:true,stencil:true,powerPreference:'high-performance'});}catch(error){onGraphics?.(`High graphics unavailable: ${error.message}`);throw error;}
 const ratio=Math.min(2,globalThis.devicePixelRatio||1);engine.setHardwareScalingLevel(1/ratio);engine.setSize(Math.round(800*ratio),Math.round(500*ratio));
 const scene=new Scene(engine);scene.useRightHandedSystem=true;scene.skipPointerMovePicking=true;
 const camera=new FreeCamera('racing-camera',new Vector3(0,3,10),scene);camera.inputs.clear();camera.minZ=.025;camera.maxZ=650;
 const sky=new HemisphericLight('sky-fill',new Vector3(0,1,0),scene);sky.intensity=.85;sky.groundColor=new Color3(.14,.17,.15);
 const sun=new DirectionalLight('sun',new Vector3(-.45,-1,-.35),scene);sun.intensity=2.8;sun.shadowMinZ=1;sun.shadowMaxZ=160;sun.autoUpdateExtends=false;sun.orthoLeft=-34;sun.orthoRight=34;sun.orthoBottom=-34;sun.orthoTop=34;
 const shadows=new ShadowGenerator(2048,sun);shadows.useBlurExponentialShadowMap=true;shadows.blurKernel=24;shadows.bias=.00035;shadows.normalBias=.03;
 const pipeline=new DefaultRenderingPipeline('racing-hdr',true,scene,[camera]);pipeline.samples=4;pipeline.fxaaEnabled=true;pipeline.bloomEnabled=true;pipeline.bloomThreshold=1.5;pipeline.bloomWeight=.12;pipeline.bloomKernel=48;
 scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;scene.imageProcessingConfiguration.exposure=1.1;scene.imageProcessingConfiguration.contrast=1.12;
 // Original offline reflection cube. No CDN requests or downloaded artwork.
 const side=32,faces=[];
 for(let face=0;face<6;face++){const data=new Uint8Array(side*side*4);for(let y=0;y<side;y++)for(let x=0;x<side;x++){const h=face===2?1:face===3?0:1-y/(side-1),i=(y*side+x)*4;data[i]=50+100*h;data[i+1]=65+125*h;data[i+2]=65+175*h;data[i+3]=255;}faces.push(data);}
 const environment=new RawCubeTexture(scene,faces,side,Constants.TEXTUREFORMAT_RGBA,Constants.TEXTURETYPE_UNSIGNED_BYTE,true,false,Texture.TRILINEAR_SAMPLINGMODE);environment.coordinatesMode=Texture.CUBIC_MODE;scene.environmentTexture=environment;
 const objects=new Map(),materials=new Map(),textures=new Map(),dynamic=[];
 const color=c=>new Color3(c?.r??1,c?.g??1,c?.b??1);
 function texture(source){if(!source)return null;if(textures.has(source))return textures.get(source);const image=source.image;let result;
  if(image?.data){result=new RawTexture(image.data,image.width,image.height,Constants.TEXTUREFORMAT_RGBA,scene,true,false,Texture.TRILINEAR_SAMPLINGMODE);}
  else if(image?.getContext){result=new DynamicTexture('instrument-screen',image,scene,true);dynamic.push(result);result.update(true);}
  if(result){result.wrapU=source.wrapS===1000?Texture.WRAP_ADDRESSMODE:Texture.CLAMP_ADDRESSMODE;result.wrapV=source.wrapT===1000?Texture.WRAP_ADDRESSMODE:Texture.CLAMP_ADDRESSMODE;result.uScale=source.repeat?.x??1;result.vScale=source.repeat?.y??1;textures.set(source,result);}return result;
 }
 function material(source){if(materials.has(source))return materials.get(source);const m=new PBRMaterial('gt-material',scene);m.albedoColor=color(source.color);m.metallic=source.metalness??0;m.roughness=source.roughness??.7;m.emissiveColor=color(source.emissive).scale(source.emissiveIntensity??0);m.alpha=source.opacity??1;m.backFaceCulling=source.side!==2;m.sideOrientation=Material.CounterClockWiseSideOrientation;m.useVertexColors=Boolean(source.vertexColors);m.albedoTexture=texture(source.map);m.emissiveTexture=texture(source.emissiveMap);m.bumpTexture=texture(source.bumpMap);if(m.bumpTexture)m.bumpTexture.level=source.bumpScale??.02;
  if(source.clearcoat){m.clearCoat.isEnabled=true;m.clearCoat.intensity=source.clearcoat;m.clearCoat.roughness=source.clearcoatRoughness??.12;}if(source.transparent){m.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHABLEND;m.separateCullingPass=true;}materials.set(source,m);return m;
 }
 function convert(source,parent=null){let target;
  if(source.isMesh){target=new Mesh(source.name||'gt-mesh',scene);const g=source.geometry,data=new VertexData();data.positions=Array.from(g.attributes.position.array);if(g.attributes.normal)data.normals=Array.from(g.attributes.normal.array);if(g.attributes.uv)data.uvs=Array.from(g.attributes.uv.array);if(g.attributes.color){data.colors=[];const a=g.attributes.color;for(let i=0;i<a.count;i++)data.colors.push(a.getX(i),a.getY(i),a.getZ(i),1);}data.indices=g.index?Array.from(g.index.array):Array.from({length:g.attributes.position.count},(_,i)=>i);data.applyToMesh(target);target.material=material(source.material);target.receiveShadows=true;if(source.castShadow)shadows.addShadowCaster(target);}
  else if(source.isLight||source.isCamera)return;
  else target=new TransformNode(source.name||'gt-group',scene);
  target.parent=parent;objects.set(source,target);for(const child of source.children)convert(child,target);
 }
 let initialized=false,disposed=false;
 onGraphics?.('High quality · Babylon.js · PBR lighting · HDR · soft shadows');
 return {software:false,babylon:true,ready(){return scene.whenReadyAsync(true);},render(source,view){if(disposed)return;
  if(!initialized){convert(source);initialized=true;}
  for(const [object,target] of objects){target.position.set(object.position.x,object.position.y,object.position.z);target.scaling.set(object.scale.x,object.scale.y,object.scale.z);target.rotationQuaternion??=new Quaternion();target.rotationQuaternion.copyFromFloats(object.quaternion.x,object.quaternion.y,object.quaternion.z,object.quaternion.w);target.setEnabled(object.visible);}
  for(const [source,m] of materials){const e=source.emissive,k=source.emissiveIntensity??0;m.emissiveColor.copyFromFloats((e?.r??0)*k,(e?.g??0)*k,(e?.b??0)*k);}
  for(const texture of dynamic)texture.update(true);
  camera.position.set(view.position.x,view.position.y,view.position.z);camera.rotationQuaternion??=new Quaternion();camera.rotationQuaternion.copyFromFloats(view.quaternion.x,view.quaternion.y,view.quaternion.z,view.quaternion.w);camera.fov=view.fov*Math.PI/180;camera.minZ=view.near;
  const directional=source.children.find(child=>child.isDirectionalLight);if(directional){sun.position.set(directional.position.x,directional.position.y,directional.position.z);const t=directional.target.position;sun.direction=new Vector3(t.x-sun.position.x,t.y-sun.position.y,t.z-sun.position.z).normalize();sun.diffuse=color(directional.color);sun.intensity=directional.intensity*.85;}
  const bg=source.fog?.color;scene.clearColor=new Color4(bg?.r??.4,bg?.g??.6,bg?.b??.8,1);scene.fogMode=Scene.FOGMODE_LINEAR;scene.fogColor=color(bg);scene.fogStart=source.fog?.near??180;scene.fogEnd=source.fog?.far??540;
  scene.render();
 },dispose(){disposed=true;scene.dispose();engine.dispose();}};
}
