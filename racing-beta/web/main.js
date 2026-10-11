import {RALLY_COURSES} from './src/game-mechanics.js';
import {mount3D} from './src/games-3d.js';
const $=id=>document.getElementById(id),track=$('track'),quality=$('quality'),status=$('status'),graphics=$('graphics'),result=$('result');
for(const [i,c] of RALLY_COURSES.entries())track.add(new Option(c.name,String(i)));
let game=null,input={},paused=false,generation=0;
function setPause(value){paused=value;game?.pause(value);input.up=input.down=input.left=input.right=input.camera=false;$('pause').textContent=paused?'Resume · Esc':'Pause · Esc';}
async function start(){const token=++generation;game?.dispose();game=null;input={};paused=false;result.hidden=true;status.textContent='';graphics.textContent='Preparing the racing engine…';
 // New canvas owns its graphics context, allowing quality changes without reuse conflicts.
 const old=document.querySelector('canvas'),canvas=old.cloneNode();old.replaceWith(canvas);canvas.focus();
 try{const mounted=await mount3D(canvas,{id:'rally',level:Number(track.value),quality:quality.value,input,onStatus:s=>{status.textContent=s;},onGraphics:s=>{graphics.textContent=s;},onFinish:r=>{result.hidden=false;result.textContent=r.text+' Select Start race to drive again.';}});if(token!==generation)mounted.dispose();else{game=mounted;setPause(false);}}
 catch(error){graphics.textContent='Unable to start: '+error.message+'. Select Lightweight graphics and retry.';}
}
$('start').addEventListener('click',start);$('pause').addEventListener('click',()=>setPause(!paused));$('camera').addEventListener('click',()=>{input.camera=true;setTimeout(()=>{input.camera=false;},100);});
const keys={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right',r:'camera'};
window.addEventListener('keydown',e=>{if(['SELECT','BUTTON'].includes(e.target.tagName)&&!keys[e.key.toLowerCase()])return;if(e.key==='Escape'){if(!e.repeat)setPause(!paused);e.preventDefault();return;}const action=keys[e.key.toLowerCase()];if(action&&game&&!paused){e.preventDefault();input[action]=true;}});
window.addEventListener('keyup',e=>{const action=keys[e.key.toLowerCase()];if(action)input[action]=false;});window.addEventListener('blur',()=>setPause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true);});
window.addEventListener('beforeunload',()=>game?.dispose());
