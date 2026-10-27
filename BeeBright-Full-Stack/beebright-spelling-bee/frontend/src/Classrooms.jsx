import {useEffect,useState} from 'react';

export default function Classrooms({call,userId,onBack,isDesktop=false}) {
  const [classes,setClasses]=useState([]),[selected,setSelected]=useState(null),[students,setStudents]=useState([]);
  const [name,setName]=useState(''),[code,setCode]=useState(''),[displayName,setDisplayName]=useState('');
  const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [deviceCode,setDeviceCode]=useState(()=>sessionStorage.getItem('beebright-connect-code')||'');
  const load=async()=>setClasses(await call('/api/classrooms'));
  useEffect(()=>{let stopped=false;call('/api/classrooms').then(v=>!stopped&&setClasses(v)).catch(e=>!stopped&&setNotice(e.message));return()=>{stopped=true};},[call]);
  useEffect(()=>{
    if(!selected)return;
    let stopped=false;
    const refresh=()=>{if(document.hidden)return;call('/api/classrooms/'+selected+'/students').then(v=>!stopped&&setStudents(v)).catch(e=>!stopped&&setNotice(e.message));};
    refresh();const timer=setInterval(refresh,15000);
    return()=>{stopped=true;clearInterval(timer);};
  },[call,selected]);
  async function action(fn){if(busy)return;setBusy(true);setNotice('');try{await fn();await load();}catch(e){setNotice(e.message)}finally{setBusy(false)}}
  return <main className="settings-page"><header className="topbar"><h1>Classrooms</h1><button className="outline" onClick={onBack}>Back to practice</button></header>
  <section className="settings-content" style={{display:'block',maxWidth:1000,margin:'auto',padding:24}}>
    <p>Anyone with an account can create a classroom. Joining shares your BeeBright screen, practice mode, level, session answer count and score with that classroom's teacher while cloud mode is active. Display names are chosen by students. Local-only activity is not shared.</p>
    {notice&&<p role="status">{notice}</p>}
    {!isDesktop&&<article className="settings-card"><h2>Connect the local app</h2><p>Only approve a code shown by your own BeeBright app. It gives that computer access to your account for 30 days.</p>
    <label>Device code<input value={deviceCode} maxLength={8} onChange={e=>setDeviceCode(e.target.value.toUpperCase())}/></label>
    <button disabled={busy||deviceCode.length!==8} onClick={()=>action(async()=>{await call('/api/devices/approve','POST',{code:deviceCode});sessionStorage.removeItem('beebright-connect-code');setDeviceCode('');setNotice('Computer connected. Return to the local app.');})}>Approve my computer</button></article>}
    <div className="settings-grid">
      <form className="settings-card" onSubmit={e=>{e.preventDefault();action(async()=>{await call('/api/classrooms','POST',{name});setName('')})}}>
      <h2>Create a classroom</h2><label>Classroom name<input value={name} required maxLength={80} onChange={e=>setName(e.target.value)}/></label><button disabled={busy}>Create classroom</button></form>
      <form className="settings-card" onSubmit={e=>{e.preventDefault();action(async()=>{await call('/api/classrooms/join','POST',{code:code.trim().toUpperCase(),display_name:displayName});setCode('');setNotice('You joined the classroom. Your teacher can now see cloud-mode activity.');})}}>
      <h2>Join a classroom</h2><label>Classroom code<input required minLength={8} maxLength={8} value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/></label><label>Your classroom name<input required maxLength={60} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label><button disabled={busy}>Join and share activity</button></form>
    </div>
    <h2>Your classrooms</h2>{classes.length===0&&<p>No classrooms yet.</p>}
    {classes.map(c=><article className="settings-card" key={c.id}><h3>{c.name}</h3>{c.teacher?<><p>Teacher · Join code: <strong>{c.code}</strong></p><button onClick={()=>{setStudents([]);setSelected(c.id)}}>View students</button><button disabled={busy} onClick={()=>action(()=>call('/api/classrooms/'+c.id+'/rotate-code','POST'))}>New join code</button><button disabled={busy} onClick={()=>{if(confirm('Delete this classroom? Saved student progress will remain.'))action(async()=>{await call('/api/classrooms/'+c.id,'DELETE');setSelected(null);})}}>Delete classroom</button></>:<><p>Student · Activity sharing is on in cloud mode.</p><button disabled={busy} onClick={()=>action(()=>call('/api/classrooms/'+c.id+'/members/'+encodeURIComponent(userId),'DELETE'))}>Leave classroom</button></>}</article>)}
    {selected&&<section><h2>Student activity</h2><p>Refreshes every 15 seconds. Last seen is the last report received; an old report does not mean a student is still active.</p><div style={{overflowX:'auto'}}><table><thead><tr><th>Student</th><th>Activity</th><th>Mode / Level</th><th>Answers / Correct</th><th>Source</th><th>Last seen</th><th/></tr></thead><tbody>{students.map(s=><tr key={s.user_id}><td>{s.name}</td><td>{s.activity?.screen||'No activity received'}</td><td>{s.activity?.mode} {s.activity?.level}</td><td>{s.activity? s.activity.answered+' / '+s.activity.correct:'—'}</td><td>{s.activity?.source}</td><td>{s.last_seen?new Date(s.last_seen).toLocaleString():'—'}</td><td><button disabled={busy} onClick={()=>action(async()=>{await call('/api/classrooms/'+selected+'/members/'+encodeURIComponent(s.user_id),'DELETE');setStudents(await call('/api/classrooms/'+selected+'/students'));})}>Remove</button></td></tr>)}</tbody></table></div>{students.length===0&&<p>No students have joined.</p>}</section>}
  </section></main>;
}
