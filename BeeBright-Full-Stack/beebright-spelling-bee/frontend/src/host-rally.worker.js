import {HostRace} from './host-rally.js';
let race=null,active=false,previous=0,accumulator=0,sent=0;
const controls={};
self.onmessage=({data})=>{
 if(data.type==='init'){race=new HostRace(data.state);active=true;previous=performance.now();accumulator=0;}
 if(data.type==='members'&&race)race.membership(data.cars);
 if(data.type==='input')controls[data.slot]={keys:data.keys,at:performance.now()};
 if(data.type==='stop')active=false;
};
setInterval(()=>{
 if(!active||!race)return;
 const now=performance.now();accumulator+=Math.min(.1,(now-previous)/1000);previous=now;
 const input=Object.fromEntries(Object.entries(controls).map(([slot,v])=>[slot,now-v.at<1000?v.keys:{}]));
 while(accumulator>=1/60){race.step(1/60,input);accumulator-=1/60;}
 const finished=race.cars.every(c=>c.finished);
 if(now-sent>=16||finished){sent=now;self.postMessage(race.snapshot());}
 if(finished)active=false;
},8);
