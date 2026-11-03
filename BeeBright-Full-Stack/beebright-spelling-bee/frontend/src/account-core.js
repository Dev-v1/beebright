export function mergeAccountStudio(old={},incoming={}) {
  const events=new Map();
  for(const e of [...(old.events||[]),...(incoming.events||[])])if(e?.id)events.set(e.id,e);
  const games={...old.games};
  for(const [key,value]of Object.entries(incoming.games||{}))games[key]=Math.max(Number(games[key])||0,Number(value)||0);
  return {...old,...incoming,events:[...events.values()].sort((a,b)=>(a.at||0)-(b.at||0)).slice(-5000),favorites:[...new Set([...(old.favorites||[]),...(incoming.favorites||[])])],games};
}

export async function restoreAccountBackup(backup,{getToken,saveProgress,deleteSavedProgress,studio,storage,userId}) {
  if(!studio.ready)throw new Error('Practice tools are still loading. Try restoring again in a moment.');
  if(backup?.app!=='BeeBright browser backup'||backup.format!==1||!backup.studio||typeof backup.studio!=='object'||Array.isArray(backup.studio))throw new Error('Choose a BeeBright browser backup.');
  const session=backup.session;
  if(session&&(!Array.isArray(session.words)||!session.words.length||session.words.length>150||!session.words.every(w=>typeof w?.word==='string'&&w.word.length<=80)||!Number.isInteger(session.index)||session.index<0||session.index>=session.words.length))throw new Error('Invalid saved practice session.');
  const token=await getToken();
  if(!token)throw new Error('Sign in again to restore your saved practice session.');
  if(session)await saveProgress(token,session);else await deleteSavedProgress(token);
  studio.change(backup.studio);
  if(await studio.flush()===false)throw new Error('Cloud restore is pending. Keep this page open and reconnect before trying again.');
  const key='beebright-session-v2:'+userId;
  if(session)storage.setItem(key,JSON.stringify(session));else storage.removeItem(key);
}
