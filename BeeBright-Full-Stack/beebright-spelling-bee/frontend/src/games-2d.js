import {DASH_LEVELS} from './arcade-core.js';
import {bowlingPins,bowlingStep,newBridgeRun,bridgeStep,newDashRun,dashStep,dashCorridor} from './game-mechanics.js';
const W=800,H=500;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function mount2D(canvas,{id,level=0,input,onFinish,onStatus,muted=false,quality='light'}) {
 const c=canvas.getContext('2d'); if(!c)throw Error('Canvas graphics are unavailable.');
 const resolution=quality==='high'?Math.min(Math.max(globalThis.devicePixelRatio||1,1.5),2):1;canvas.width=W*resolution;canvas.height=H*resolution;c.setTransform(resolution,0,0,resolution,0,0);
 let redraw=true;
 let frame,paused=false,done=false,t=0,last=0,score=0,objects=[],spawn=0,audio=null,beat=-1;
 const rng=()=>Math.random();
 const course=DASH_LEVELS[level]||DASH_LEVELS[0];
 let p={x:140,y:250,w:28,h:28,vy:0,vx:0,angle:-Math.PI/2},gravity=1;
 let balls=0,round=1,pins=[],rolling=false,angle=0,rollAge=0,power=.75,spin=0,frameScore=0;
 const bridge=newBridgeRun(),dash=newDashRun();let trail=[];
 function resetPins(){pins=bowlingPins();}
 if(id==='bowling'){p.x=400;p.y=445;p.r=13;p.mass=7;resetPins();}
 if(id==='sheep'){p.x=165;p.y=250;}
 if(id==='dash'){p.y=392;p.w=30;p.h=30;}
 function finish(won,text){if(done)return;done=true;onFinish({score:Math.max(0,Math.round(score)),won,text});}
 function tone(){if(muted||id!=='dash')return;try{audio ||=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const b=Math.floor(t*3);if(b===beat)return;beat=b;const notes=[130.81,164.81,196,261.63,196,164.81,146.83,196];const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type=b%4===0?'triangle':'sine';oscillator.frequency.value=notes[(b+level*2)%notes.length];gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.19);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.2);}catch{/* Sound is optional. */}}
 function rect(x,y,w,h,color,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
 function circle(x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
 function text(s,x,y,size=18,color='#fff',align='left'){c.fillStyle=color;c.font=`600 ${size}px system-ui`;c.textAlign=align;c.fillText(s,x,y);}
 function stars(){for(let i=0;i<35;i++)circle((i*137)%W,(i*83)%H,1.2,'#ffffff35');}
 function update(dt,action){
  t+=dt;tone();
  if(id==='sky'){
   if(action)p.vy=-335;p.vy+=900*dt;p.y+=p.vy*dt;
   spawn-=dt;if(spawn<=0){spawn=1.7;objects.push({x:W+30,y:125+rng()*235,w:70,gap:172,passed:false});}
   for(const o of objects){o.x-=190*dt;if(!o.passed&&o.x+o.w<p.x){o.passed=true;score++;}if(p.x+12>o.x&&p.x-12<o.x+o.w&&(p.y-12<o.y-o.gap/2||p.y+12>o.y+o.gap/2))finish(false,'The skyline caught you. Try another flight!');}
   objects=objects.filter(o=>o.x>-90);if(p.y<15||p.y>H-35)finish(false,'Time for a fresh takeoff.');
  }else if(id==='gravity'){
   if(action){gravity*=-1;p.vy=gravity*180;}p.vy+=gravity*1050*dt;p.y=clamp(p.y+p.vy*dt,66,406);if(p.y===66||p.y===406)p.vy=0;
   spawn-=dt;if(spawn<=0){spawn=Math.max(.95,1.35-t*.004);const ceiling=objects.length? !objects.at(-1).ceiling: false;objects.push({x:W,y:ceiling?50:270,w:60,h:180,ceiling});}
   for(const o of objects){o.x-=(280+Math.min(t*2,160))*dt;if(hit(p,o))finish(false,'Barrier hit. Flip a little earlier next time.');}objects=objects.filter(o=>o.x>-80);score=Math.floor(t*10);
  }else if(id==='sheep'){
   const state=bridgeStep(bridge,Boolean(input.action),dt);score=bridge.score;if(state==='won')finish(true,'Your flock crossed all eight bridges!');if(state==='lost')finish(false,'The bridge tip must land on the next island. Hold a little longer, or release sooner.');
  }else if(id==='bowling'){
   if(!rolling){angle=clamp(angle+(Number(Boolean(input.right))-Number(Boolean(input.left)))*dt*.65,-.42,.42);power=clamp(power+(Number(Boolean(input.up))-Number(Boolean(input.down)))*dt*.4,.35,1);spin=clamp(spin+(Number(Boolean(input.spinRight))-Number(Boolean(input.spinLeft)))*dt,-1,1);if(action){rolling=true;balls++;rollAge=0;p.gutter=false;p.vx=Math.sin(angle)*(450+power*240);p.vy=-Math.cos(angle)*(450+power*240);}}
   else{rollAge+=dt;if(!p.gutter)p.vx+=spin*45*dt;bowlingStep(p,pins,dt);
    if(p.y<25||rollAge>2.6||(p.gutter&&rollAge>1.5)){rolling=false;const fallen=pins.filter(pin=>pin.down).length;score+=fallen;frameScore+=fallen;p.x=400;p.y=445;p.vx=0;p.vy=0;
     if(balls===2||frameScore===10){if(round===5){finish(true,`${score} pins across five frames. Nice bowling!`);return;}round++;balls=0;frameScore=0;resetPins();}
     else pins=pins.filter(pin=>!pin.down);
    }}
  }else if(id==='dash'){
   const oldMode=dash.mode,state=dashStep(dash,input,dt,course);p.y=dash.y;if(oldMode!==dash.mode)trail=[];trail.push({d:dash.distance,y:p.y+15});if(trail.length>55)trail.shift();score=Math.floor(dash.distance/course.length*1000);if(state==='lost')finish(false,`${course.name} · ${Math.floor(score/10)}% reached. Try a gentler tap in flight modes.`);if(state==='won')finish(true,`${course.name} cleared through all four portals!`);

  }
  onStatus(id==='bowling'?`Frame ${round}/5 · Roll ${Math.min(2,balls+Number(!rolling))}/2 · ${score} pins`:id==='sheep'?`Bridge ${Math.min(8,bridge.index+1)}/8 · ${bridge.phase==='growing'?'Hold…':bridge.phase==='ready'?'Hold to build':bridge.phase==='lowering'?'Lowering…':'Crossing'} · ${score}`:id==='dash'?`${course.name} · ${dash.mode.toUpperCase()} · ${Math.floor(score/10)}% · ${dash.lives} tries`:`Score ${score}`);
 }
 function draw(){
  const bg=c.createLinearGradient(0,0,0,H);bg.addColorStop(0,id==='sky'?'#273853':id==='sheep'?'#183c37':'#11182c');bg.addColorStop(1,id==='sky'?'#ca7770':id==='sheep'?'#256d58':'#242445');c.fillStyle=bg;c.fillRect(0,0,W,H);
  if(id==='sky'){
   circle(650,95,47,'#ffd3a0');for(let i=0;i<12;i++)rect(i*80-((t*20)%80),H-110-(i%3)*25,65,140,'#26314c');
   for(const o of objects){rect(o.x,0,o.w,o.y-o.gap/2,'#214554',8);rect(o.x,o.y+o.gap/2,o.w,H,'#214554',8);rect(o.x-4,o.y-o.gap/2-15,o.w+8,15,'#77bfb4',3);rect(o.x-4,o.y+o.gap/2,o.w+8,15,'#77bfb4',3);}rect(0,H-25,W,25,'#1a293b');
   c.save();c.translate(p.x,p.y);c.rotate(clamp(p.vy/800,-.35,.6));c.fillStyle='#ffe7b2';c.beginPath();c.moveTo(20,0);c.lineTo(-17,-12);c.lineTo(-6,0);c.lineTo(-17,12);c.closePath();c.fill();c.restore();
  }else if(id==='gravity'){
   stars();rect(0,40,W,10,'#d3a3ff');rect(0,450,W,10,'#7adde0');for(const o of objects){rect(o.x,o.y,o.w,o.h,'#e3819c',6);rect(o.x+8,o.y+10,o.w-16,o.h-20,'#843e72',3);}rect(p.x,p.y,p.w,p.h,'#d7fcf0',6);text(gravity===1?'↓':'↑',p.x+14,p.y+21,20,'#20565b','center');
  }else if(id==='sheep'){
   circle(650,90,42,'#e7e4ae');for(let i=0;i<7;i++){const x=i*160-(bridge.camera*.15%160);c.fillStyle='#4b8d75';c.beginPath();c.moveTo(x-100,385);c.lineTo(x+40,130+i%2*35);c.lineTo(x+170,385);c.fill();}
   rect(0,430,W,70,'#135b76');for(let i=0;i<30;i++)rect((i*53-t*18)%W,445+i%3*15,25,2,'#81c8d950');
   const start=bridge.platforms[bridge.index].x+bridge.platforms[bridge.index].w;
   for(const a of bridge.platforms){const x=a.x-bridge.camera;rect(x,385,a.w,115,'#674b43',6);rect(x-3,377,a.w+6,12,'#a1d58e',4);rect(x+a.w/2-10,373,20,4,'#ffce78',2);}
   c.save();c.translate(start-bridge.camera,380);c.rotate(bridge.angle);rect(-3,-bridge.length,6,bridge.length,'#f2d4a0',2);c.restore();
   for(let i=2;i>=0;i--){const x=bridge.x-bridge.camera-i*19,y=bridge.y+Math.sin(t*12+i)*2;circle(x,y,12,'#fcf3df');circle(x+11,y+1,7,'#3a3a48');rect(x-7,y+10,3,9,'#303543');rect(x+5,y+10,3,9,'#303543');circle(x+13,y-1,1.5,'#fff');}
   text('Hold to grow ↑ · Release to lower →',400,45,20,'#fff','center');text('Land the tip inside the next island',400,74,14,'#c5eadb','center');
  }else if(id==='bowling'){
   rect(260,20,280,460,'#be9169',12);for(let i=0;i<7;i++)rect(270+i*40,20,2,460,'#ffffff20');rect(260,320,280,3,'#fff6');for(const pin of pins){c.save();c.translate(pin.x,pin.y);c.rotate((pin.down?pin.fall*1.3:pin.tilt*.4)*(pin.vx<0?-1:1));rect(-7,-16,14,30,pin.down?'#e4dac7':'#fbf7ed',6);rect(-5,-9,10,4,'#ed7285',2);c.restore();}text(`Power ${Math.round(power*100)}% · Spin ${Math.round(spin*100)}`,400,485,14,'#eff','center');c.strokeStyle='#cff7fa';c.setLineDash([8,9]);c.beginPath();c.moveTo(p.x,p.y);if(!rolling)c.lineTo(p.x+Math.sin(angle)*280,p.y-Math.cos(angle)*280);c.stroke();c.setLineDash([]);circle(p.x,p.y,14,'#292e61');circle(p.x-4,p.y-5,2,'#bdc0ed');
  }else if(id==='dash'){
   stars();const d=dash.distance;for(let i=0;i<10;i++)rect(i*130-(d*.3%130),350-(i%4)*40,90,100,'#49468d50',10);
   rect(0,422,W,78,'#353765');rect(0,422,W,3,'#adbfff');
   if(dash.mode==='cube'||dash.mode==='ball'){
    if(dash.mode==='ball'){rect(0,70,W,20,'#595187');rect(0,87,W,3,'#e2baff');}
    for(const [i,x] of (dash.mode==='ball'?course.spikes.filter(x=>x>=course.segments[2].start):course.spikes).entries()){const sx=x-d+p.x;if(sx< -40||sx>840)continue;const top=dash.mode==='ball'&&i%2===1;c.fillStyle='#f59cc1';c.beginPath();c.moveTo(sx,top?90:422);c.lineTo(sx+16,top?146:386);c.lineTo(sx+32,top?90:422);c.fill();}
    for(const b of course.blocks){rect(b.x-d+p.x,422-b.h,b.w,b.h,'#728edb',4);rect(b.x-d+p.x,422-b.h,b.w,4,'#b4e7ff',2);}
   }else{
    for(let x=0;x<W;x+=20){const band=dashCorridor(d+x-p.x,dash.mode);rect(x,0,21,band.top,'#454276');rect(x,band.bottom,21,H-band.bottom,'#454276');rect(x,band.top-4,21,4,'#f3a3cf');rect(x,band.bottom,21,4,'#87e8ef');}
   }
   for(const segment of course.segments.slice(1)){const x=segment.start-d+p.x;if(x> -80&&x<W+80){c.strokeStyle='#cbaaff';c.lineWidth=7;c.beginPath();c.ellipse(x,245,24,140,0,0,Math.PI*2);c.stroke();text(segment.mode.toUpperCase(),x,80,14,'#e5c9ff','center');}}
   if(dash.mode==='wave'||dash.mode==='ship'){c.strokeStyle=dash.mode==='wave'?'#8aecd9':'#ffb47a';c.lineWidth=dash.mode==='wave'?4:2;c.beginPath();trail.forEach((a,i)=>c[i?'lineTo':'moveTo'](p.x+15-(d-a.d),a.y));c.stroke();}
   c.save();c.translate(p.x+15,p.y+15);if(dash.mode==='cube'){c.rotate(dash.grounded?0:t*6);rect(-15,-15,30,30,'#d6faff',5);rect(-8,-8,16,16,'#6386bd',3);}
   else if(dash.mode==='ball'){circle(0,0,15,'#a4f5e2');c.rotate(t*5);rect(-12,-3,24,6,'#4e88a4',2);}
   else{c.rotate(Math.atan2(dash.vy,course.speed)*.35);c.fillStyle=dash.mode==='ship'?'#ffe4a8':'#a4f5e2';c.beginPath();c.moveTo(20,0);c.lineTo(-15,-12);c.lineTo(-6,0);c.lineTo(-15,12);c.closePath();c.fill();if(dash.mode==='ship')rect(-25,-4,12,8,'#ff957a',3);}c.restore();
   if(dash.flash>0){c.fillStyle=`rgba(187,180,255,${dash.flash*.2})`;c.fillRect(0,0,W,H);}rect(20,20,760,5,'#ffffff20',3);rect(20,20,760*Math.min(1,d/course.length),5,'#bdcaff',3);text(dash.mode.toUpperCase()+' · '+(dash.mode==='cube'?'hold to jump':dash.mode==='ball'?'tap to flip':'hold to rise, release to dive'),25,55,15,'#e3eeff');

  }
 }
 function loop(now){const dt=last?Math.min((now-last)/1000,.034):0;last=now;if(!paused&&!done){const action=Boolean(input.action&&!input.previousAction);input.previousAction=Boolean(input.action);update(dt,action);redraw=true;}if(redraw){draw();redraw=false;}frame=requestAnimationFrame(loop);}
 frame=requestAnimationFrame(loop);
 return {pause(value){paused=value;redraw=true;input.previousAction=Boolean(input.action);if(audio) value?audio.suspend():audio.resume();},setMuted(value){muted=value;if(value&&audio)audio.suspend();},dispose(){cancelAnimationFrame(frame);if(audio)audio.close().catch(()=>{});}};
}
