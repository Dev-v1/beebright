import {lazy,Suspense,useEffect,useRef,useState} from 'react';
const Arcade=lazy(()=>import('./arcade.jsx'));
import {API_BASE_URL} from './api.js';
import {RALLY_COURSES} from './game-mechanics.js';
import './public-pages.css';

export function PublicNav({signedIn,onNavigate}) {
  return <header className="public-nav"><button className="brand" onClick={()=>onNavigate('/')}><span>bee</span>bright</button><nav><button onClick={()=>onNavigate('/games')}>Arcade</button>{signedIn?<button className="primary" onClick={()=>onNavigate('/practice')}>Practice</button>:<><button onClick={()=>onNavigate('/sign-in')}>Sign in</button><button className="primary" onClick={()=>onNavigate('/sign-up')}>Sign up</button></>}</nav></header>;
}
export function HomePage({signedIn,onNavigate}) {
  return <div className="public-page"><PublicNav signedIn={signedIn} onNavigate={onNavigate}/><main className="public-home"><section className="public-hero"><p className="eyebrow">YOUR PERSONAL SPELLING STUDIO</p><h1>Find your rhythm.<br/>Build your spelling confidence.</h1><p>Hear the word, explore its meaning, and practice at your pace. BeeBright makes room for everyday progress—and a little play along the way.</p><div className="public-actions"><button className="primary" onClick={()=>onNavigate(signedIn?'/practice':'/sign-up')}>{signedIn?'Continue practicing':'Start practicing'}</button><button className="outline" onClick={()=>onNavigate('/games')}>Explore the arcade</button></div><p className="public-caption">The arcade is open to everyone. No account needed.</p></section><section className="public-feature-grid">{[['Listen & learn','Audio-led practice, helpful definitions and word origins.'],['Make it your own','Flash cards, spelling choices and typing practice across three levels.'],['Pick up where you left off','Sign in to save your place and practice across devices.'],['Learn together, play together','Classrooms for shared progress. Join-code racing for friendly competition.']].map(([title,text])=><article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section><footer><a href="/download.html">Download BeeBright Local</a><span>Practice online or choose the local edition.</span></footer></main></div>;
}

const keys={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',r:'camera'};
function RoomRace({network,input,onReady}) {
  const canvas=useRef(null),[error,setError]=useState(''),[status,setStatus]=useState('Preparing graphics…');
  useEffect(()=>{
    let stopped=false,engine;
    import('./games-3d.js').then(({mount3D})=>mount3D(canvas.current,{id:'rally',level:network.current.track,laps:network.current.laps,quality:'high',network,input:input.current,onFinish:()=>{},onStatus:setStatus,onGraphics:()=>{}})).then(value=>{if(stopped)value.dispose();else{engine=value;engine.pause(false);onReady();}}).catch(e=>!stopped&&setError(e.message));
    return()=>{stopped=true;engine?.dispose();};
  },[network,input]);
  return <><div className="room-canvas"><canvas ref={canvas} aria-label="Multiplayer Neon Rally race"/></div><p role="status">{error||status}</p><p>Up / W: accelerate · Down / S: brake · Left / Right: steer · R: camera. Steer through the corners and change your racing line to overtake.</p><div className="public-actions">{[['left','Left'],['up','Accelerate'],['down','Brake'],['right','Right']].map(([key,label])=><button key={key} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);input.current[key]=true;}} onPointerUp={()=>{input.current[key]=false;}} onPointerCancel={()=>{input.current[key]=false;}} onLostPointerCapture={()=>{input.current[key]=false;}}>{label}</button>)}</div></>;
}
export function RallyRooms(){
  const [name,setName]=useState(''),[code,setCode]=useState(''),[track,setTrack]=useState(0),[laps,setLaps]=useState(2),[state,setState]=useState(null),[slot,setSlot]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const socket=useRef(null),input=useRef({}),network=useRef({current:null,slot:null}),host=useRef(false),phase=useRef(''),allReady=useRef(false),authority=useRef(null);
  host.current=state?.host===slot;phase.current=state?.phase;allReady.current=Boolean(state?.cars.every(c=>c.bot||c.ready));
  const send=data=>{if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify(data));};
  function leave(){socket.current?.close();socket.current=null;setState(null);setSlot(null);setBusy(false);input.current={};}
  function connect(type){
    if(busy||socket.current)return;setBusy(true);setError('');
    const url=new URL(API_BASE_URL);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname=url.pathname.replace(/\/$/,'')+'/api/rally/ws';url.search='';
    const ws=new WebSocket(url);socket.current=ws;
    const timeout=setTimeout(()=>{if(socket.current===ws&&ws.readyState!==WebSocket.OPEN){setError('The game server is taking longer to wake up. Please try again.');ws.close();}},20000);
    ws.onopen=()=>ws.send(JSON.stringify({type,protocol:2,name:name.trim()||'Guest',code:code.trim().toUpperCase(),track,laps}));
    ws.onmessage=e=>{if(socket.current!==ws)return;const value=JSON.parse(e.data);if(value.type==='welcome'){network.current.slot=value.slot;setSlot(value.slot);}if(value.type==='state'){network.current.previous=network.current.current;network.current.previousReceived=network.current.received;network.current.received=performance.now();network.current.current=value;authority.current?.postMessage({type:'members',cars:value.cars});setState(value);setBusy(false);}if(value.type==='controls')authority.current?.postMessage({type:'input',slot:value.slot,keys:value.keys});if(value.type==='error')setError(value.message);};
    ws.onerror=()=>{if(socket.current===ws)setError('Could not connect to the game server. Please try again.');};
    ws.onclose=()=>{clearTimeout(timeout);if(socket.current!==ws)return;socket.current=null;setState(null);setBusy(false);setError(v=>v||'Room connection ended. Create or join a room again.');};
  }
  useEffect(()=>{
    if(!state||state.host!==slot||state.phase!=='racing')return;
    const worker=new Worker(new URL('./host-rally.worker.js',import.meta.url),{type:'module'});
    authority.current=worker;
    let lastSent=0;
    worker.onmessage=({data})=>{
      if(socket.current?.readyState!==WebSocket.OPEN||network.current.current?.host!==slot)return;
      network.current.localVisual=data;
      const now=performance.now();
      if(now-lastSent>=50||data.cars.every(c=>c.finished)){lastSent=now;send({type:'host_snapshot',...data});}
    };
    worker.onerror=()=>{setError('The host simulation stopped. Rejoin the room to continue.');socket.current?.close();};
    const snapshot=network.current.current;
    worker.postMessage({type:'init',state:snapshot});
    for(const [id,keys] of Object.entries(snapshot.inputs||{}))worker.postMessage({type:'input',slot:Number(id),keys});
    let mask='',lastInput=0;
    const inputTimer=setInterval(()=>{
      const keys={up:!!input.current.up,down:!!input.current.down,left:!!input.current.left,right:!!input.current.right},next=JSON.stringify(keys),now=performance.now();
      if(next!==mask||now-lastInput>=250){mask=next;lastInput=now;worker.postMessage({type:'input',slot,keys});}
    },16);
    return()=>{clearInterval(inputTimer);worker.terminate();if(authority.current===worker)authority.current=null;network.current.localVisual=null;};
  },[slot,state?.host,state?.phase]);
  useEffect(()=>{
    const handle=(e,held)=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key.toLowerCase()==='u'&&held&&host.current&&allReady.current&&phase.current==='lobby'){send({type:'start'});return;}const k=keys[e.key]||keys[e.key.toLowerCase()];if(k&&phase.current&&phase.current!=='lobby'){e.preventDefault();input.current[k]=held;}};
    const down=e=>handle(e,true),up=e=>handle(e,false),clear=()=>{for(const k of Object.keys(input.current))input.current[k]=false;};
    const timer=setInterval(()=>{if(phase.current==='racing')send({type:'input',up:!!input.current.up,down:!!input.current.down,left:!!input.current.left,right:!!input.current.right});},100);
    const heartbeat=setInterval(()=>send({type:'ping'}),10000);
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
    return()=>{clearInterval(timer);clearInterval(heartbeat);socket.current?.close();socket.current=null;window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);};
  },[]);
  return <section className="rally-rooms" aria-labelledby="room-heading"><p className="eyebrow">RACE TOGETHER</p><h2 id="room-heading">Neon Rally rooms</h2><p>Five racers. Bring friends with a join code, or race solo. Empty spots become bots. The host’s device runs the race using the local driving engine. Every player renders High quality graphics on their own device. Guest names are chosen by players.</p>{error&&<p role="alert">{error}</p>}{!state?<><label>Your racing name<input maxLength={24} value={name} placeholder="Guest" onChange={e=>setName(e.target.value)}/></label><div className="room-forms"><form onSubmit={e=>{e.preventDefault();connect('create');}}><h3>Create a race</h3><label>Track<select aria-label="Room race track" value={track} onChange={e=>setTrack(Number(e.target.value))}>{RALLY_COURSES.map((c,i)=><option key={c.name} value={i}>{c.name}</option>)}</select></label><label>Laps<select aria-label="Room race laps" value={laps} onChange={e=>setLaps(Number(e.target.value))}>{Array.from({length:10},(_,i)=>i+1).map(n=><option key={n}>{n}</option>)}</select></label><button className="primary" disabled={busy}>Create room</button></form><form onSubmit={e=>{e.preventDefault();connect('join');}}><h3>Join your friends</h3><label>Join code<input required minLength={8} maxLength={8} autoCapitalize="characters" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/></label><button className="outline" disabled={busy}>Join room</button></form></div>{busy&&<p role="status">Connecting to the race server…</p>}</>:<><div className="public-actions"><strong>Join code: {state.code}</strong><button onClick={leave}>Leave room</button></div><p>{RALLY_COURSES[state.track].name} · {state.laps} laps · {state.phase==='lobby'?'Waiting for the host':state.phase==='countdown'?'Starting in '+state.countdown:state.phase==='finished'?'Race complete':'Race in progress'}</p><ol className="room-roster">{state.cars.map(c=><li key={c.slot} style={{borderLeft:'5px solid '+['#d84e71','#3da5bd','#f3bd47','#536ed0','#78a755'][c.slot]}}><span>{c.name}{c.slot===slot?' (you)':''}{c.slot===state.host?' · Host':''}</span><small>{c.bot?'Bot':c.ready?'Player':'Player · loading graphics'}{c.finished?' · '+c.finishTime+'s':''}</small></li>)}</ol>{state.phase==='lobby'?(state.host===slot?<button className="primary" disabled={!allReady.current} onClick={()=>send({type:'start'})}>Start race (U)</button>:<p>Waiting for the host to press U or Start race.</p>):null}<RoomRace network={network.current} input={input} onReady={()=>send({type:'ready'})}/> {state.phase==='finished'&&<><h3>Results</h3><ol>{[...state.cars].sort((a,b)=>(a.finishTime??Infinity)-(b.finishTime??Infinity)||b.distance-a.distance).map(c=><li key={c.slot}>{c.name} — {c.finished?c.finishTime+'s':'Did not finish'}</li>)}</ol><button onClick={leave}>Back to rooms</button></>}</>}</section>;
}
export function GamesPage({signedIn,onNavigate}){
  const [scores,setScores]=useState({});
  return <div className="public-page"><PublicNav signedIn={signedIn} onNavigate={onNavigate}/><main><div className="public-games-heading"><p className="eyebrow">EVERYONE’S INVITED</p><h1>The BeeBright arcade</h1><p>Play solo games below, or create a Neon Rally room and invite your friends. No login required.</p></div><RallyRooms/><Suspense fallback={<p>Loading arcade…</p>}><Arcade preview localMode={false} scores={scores} onScore={(id,score)=>setScores(s=>({...s,[id]:Math.max(s[id]||0,score)}))}/></Suspense></main></div>;
}
