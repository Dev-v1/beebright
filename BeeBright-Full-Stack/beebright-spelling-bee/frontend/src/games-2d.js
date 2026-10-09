import {DASH_LEVELS} from './arcade-core.js';
import {bowlingPins,bowlingStep} from './game-mechanics.js';
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
 let rescued=0,balls=0,round=1,pins=[],rolling=false,angle=0,rollAge=0,power=.75,spin=0,frameScore=0,dashGrounded=true;
 const sheep=[{x:105,y:95},{x:80,y:190},{x:120,y:320},{x:65,y:410}].map(s=>({...s,following:false,safe:false}));
 const walls=[{x:275,y:0,w:30,h:180},{x:275,y:290,w:30,h:210},{x:490,y:110,w:30,h:290}];
 function resetPins(){pins=bowlingPins();}
 if(id==='bowling'){p.x=400;p.y=445;p.r=14;p.mass=7;resetPins();}
 if(id==='sheep'){p.x=165;p.y=250;}
 if(id==='dash'){p.y=392;p.w=30;p.h=30;}
 function finish(won,text){if(done)return;done=true;onFinish({score:Math.max(0,Math.round(score)),won,text});}
 function tone(){if(muted||id!=='dash')return;try{audio ||=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const b=Math.floor(t*3);if(b===beat)return;beat=b;const notes=[130.81,164.81,196,261.63,196,164.81,146.83,196];const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type=b%4===0?'triangle':'sine';oscillator.frequency.value=notes[(b+level*2)%notes.length];gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.19);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.2);}catch{/* Sound is optional. */}}
 function rect(x,y,w,h,color,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
 function circle(x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
 function text(s,x,y,size=18,color='#fff',align='left'){c.fillStyle=color;c.font=`600 ${size}px system-ui`;c.textAlign=align;c.fillText(s,x,y);}
 function stars(){for(let i=0;i<35;i++)circle((i*137)%W,(i*83)%H,1.2,'#ffffff35');}
 function motion(dt,speed){const dx=Number(Boolean(input.right))-Number(Boolean(input.left)),dy=Number(Boolean(input.down))-Number(Boolean(input.up)),len=Math.hypot(dx,dy)||1;return {x:dx/len*speed*dt,y:dy/len*speed*dt};}
 function pastureMove(o,dx,dy){const size=20;let a={x:o.x+dx-size/2,y:o.y-size/2,w:size,h:size};if(!walls.some(w=>hit(a,w)))o.x=clamp(o.x+dx,12,W-12);a={x:o.x-size/2,y:o.y+dy-size/2,w:size,h:size};if(!walls.some(w=>hit(a,w)))o.y=clamp(o.y+dy,12,H-12);}
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
   const m=motion(dt,170);pastureMove(p,m.x,m.y);
   for(const s of sheep){if(s.safe)continue;if(dist(s,p)<85)s.following=true;if(s.following&&dist(s,p)>32){const d=dist(s,p);pastureMove(s,(p.x-s.x)/d*125*dt,(p.y-s.y)/d*125*dt);}if(s.x>690&&s.y>160&&s.y<340){s.safe=true;rescued++;score=rescued*250;}}
   for(let i=0;i<2;i++){const wolf={x:380+i*230+Math.sin(t*.9+i)*60,y:250+Math.sin(t*1.1+i*2)*170};if(dist(wolf,p)<22||sheep.some(s=>!s.safe&&dist(wolf,s)<20))finish(false,`${rescued} sheep made it home. Watch the wolves' patrols.`);}if(rescued===4)finish(true,'All four sheep are safely home!');
  }else if(id==='bowling'){
   if(!rolling){angle=clamp(angle+(Number(Boolean(input.right))-Number(Boolean(input.left)))*dt*.65,-.42,.42);power=clamp(power+(Number(Boolean(input.up))-Number(Boolean(input.down)))*dt*.4,.35,1);spin=clamp(spin+(Number(Boolean(input.spinRight))-Number(Boolean(input.spinLeft)))*dt,-1,1);if(action){rolling=true;balls++;rollAge=0;p.gutter=false;p.vx=Math.sin(angle)*(450+power*240);p.vy=-Math.cos(angle)*(450+power*240);}}
   else{rollAge+=dt;if(!p.gutter)p.vx+=spin*45*dt;bowlingStep(p,pins,dt);
    if(p.y<25||rollAge>2.6||(p.gutter&&rollAge>1.5)){rolling=false;const fallen=pins.filter(pin=>pin.down).length;score+=fallen;frameScore+=fallen;p.x=400;p.y=445;p.vx=0;p.vy=0;
     if(balls===2||frameScore===10){if(round===5){finish(true,`${score} pins across five frames. Nice bowling!`);return;}round++;balls=0;frameScore=0;resetPins();}
     else pins=pins.filter(pin=>!pin.down);
    }}
  }else if(id==='dash'){
   if(input.action&&dashGrounded){p.vy=-510;dashGrounded=false;}p.vy+=1400*dt;p.y=Math.min(392,p.y+p.vy*dt);dashGrounded=p.y>=392;if(dashGrounded)p.vy=0;
   const distance=t*course.speed;
   for(const b of course.blocks){const o={x:b.x-distance+p.x,y:422-b.h,w:b.w,h:b.h};if(hit(p,o)){p.y=o.y-p.h;p.vy=Math.min(0,p.vy);dashGrounded=true;}}
   for(const x of course.spikes){const o={x:x-distance+p.x+5,y:402,w:20,h:20};if(hit({x:p.x+6,y:p.y+5,w:p.w-12,h:p.h-10},o))finish(false,`${course.name} · ${Math.min(100,Math.floor(distance/course.length*100))}% reached. Blue platforms are safe; jump over pink spikes.`);}
   score=Math.min(1000,Math.floor(distance/course.length*1000));if(distance>=course.length)finish(true,`${course.name} cleared! Choose another course to keep going.`);

  }
  onStatus(id==='bowling'?`Frame ${round}/5 · Roll ${Math.min(2,balls+Number(!rolling))}/2 · ${score} pins`:id==='sheep'?`${rescued}/4 rescued`:id==='dash'?`${course.name} · ${Math.floor(score/10)}%`:`Score ${score}`);
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
   for(let i=0;i<60;i++)rect((i*127)%W,(i*71)%H,2,10,'#b9ed9c25');rect(690,160,105,180,'#b7d9ac55',15);text('HOME',742,185,17,'#eaffdf','center');for(const w of walls)rect(w.x,w.y,w.w,w.h,'#99b99c',5);
   for(const s of sheep){circle(s.x,s.y,13,s.safe?'#bdddad':'#f6f0df');circle(s.x+11,s.y,7,'#303e46');}for(let i=0;i<2;i++){const x=380+i*230+Math.sin(t*.9+i)*60,y=250+Math.sin(t*1.1+i*2)*170;circle(x,y,17,'#bcc4d3');circle(x+15,y,10,'#657689');text('!',x,y+6,17,'#273640','center');}circle(p.x,p.y,13,'#facb80');circle(p.x,p.y-9,10,'#4278b1');
  }else if(id==='bowling'){
   rect(260,20,280,460,'#be9169',12);for(let i=0;i<7;i++)rect(270+i*40,20,2,460,'#ffffff20');rect(260,320,280,3,'#fff6');for(const pin of pins){c.save();c.translate(pin.x,pin.y);c.rotate(pin.fall*(pin.vx<0?-1:1)*1.3);rect(-7,-16,14,30,pin.down?'#e4dac7':'#fbf7ed',6);rect(-5,-9,10,4,'#ed7285',2);c.restore();}text(`Power ${Math.round(power*100)}% · Spin ${Math.round(spin*100)}`,400,485,14,'#eff','center');c.strokeStyle='#cff7fa';c.setLineDash([8,9]);c.beginPath();c.moveTo(p.x,p.y);if(!rolling)c.lineTo(p.x+Math.sin(angle)*280,p.y-Math.cos(angle)*280);c.stroke();c.setLineDash([]);circle(p.x,p.y,14,'#292e61');circle(p.x-4,p.y-5,2,'#bdc0ed');
  }else if(id==='dash'){
   stars();const d=t*course.speed;for(let i=0;i<10;i++)rect(i*130-(d*.3%130),350-(i%4)*40,90,100,'#49468d50',10);rect(0,422,W,78,'#353765');rect(0,422,W,3,'#adbfff');for(const x of course.spikes){c.fillStyle='#f59cc1';c.beginPath();c.moveTo(x-d+p.x,422);c.lineTo(x-d+p.x+16,390);c.lineTo(x-d+p.x+32,422);c.fill();}for(const b of course.blocks){rect(b.x-d+p.x,422-b.h,b.w,b.h,'#728edb',4);rect(b.x-d+p.x,422-b.h,b.w,4,'#b4e7ff',2);}c.save();c.translate(p.x+15,p.y+15);c.rotate(p.y<392?t*6:0);rect(-15,-15,30,30,'#d6faff',5);rect(-8,-8,16,16,'#6386bd',3);c.restore();rect(20,20,760,5,'#ffffff20',3);rect(20,20,760*Math.min(1,d/course.length),5,'#bdcaff',3);
  }
 }
 function loop(now){const dt=last?Math.min((now-last)/1000,.034):0;last=now;if(!paused&&!done){const action=Boolean(input.action&&!input.previousAction);input.previousAction=Boolean(input.action);update(dt,action);redraw=true;}if(redraw){draw();redraw=false;}frame=requestAnimationFrame(loop);}
 frame=requestAnimationFrame(loop);
 return {pause(value){paused=value;redraw=true;input.previousAction=Boolean(input.action);if(audio) value?audio.suspend():audio.resume();},setMuted(value){muted=value;if(value&&audio)audio.suspend();},dispose(){cancelAnimationFrame(frame);if(audio)audio.close().catch(()=>{});}};
}
