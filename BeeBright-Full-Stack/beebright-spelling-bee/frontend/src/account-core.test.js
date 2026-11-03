import test from 'node:test';import assert from 'node:assert/strict';import {mergeAccountStudio,restoreAccountBackup} from './account-core.js';
test('offline imports and retries deduplicate IDs, preserve high scores and merge favorites',()=>{const a={events:[{id:'a',at:1}],games:{rally:10},favorites:['bee']};const b={events:[{id:'a',at:1},{id:'b',at:2}],games:{rally:2},favorites:['sky']};const result=mergeAccountStudio(a,b);assert.equal(result.events.length,2);assert.equal(result.games.rally,10);assert.deepEqual(result.favorites,['bee','sky']);assert.deepEqual(mergeAccountStudio(result,b),result);});

const backup={app:'BeeBright browser backup',format:1,studio:{favorites:['bee']},session:{words:[{word:'bee'}],index:0}};
function restoreFixture(){
 const calls=[],saved=new Map();
 const options={userId:'student',getToken:async()=> 'token',saveProgress:async()=>{calls.push('session');},deleteSavedProgress:async()=>{calls.push('delete');},studio:{ready:true,change:()=>calls.push('studio'),flush:async()=>true},storage:{setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)}};
 return {calls,saved,options};
}
test('backup restoration waits for cloud tools before allowing a reload',async()=>{
 const {calls,saved,options}=restoreFixture();let release,reloaded=false;
 options.studio.flush=()=>new Promise(resolve=>{calls.push('flush');release=resolve;});
 const restoring=restoreAccountBackup(backup,options).then(()=>{reloaded=true;});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls,['session','studio','flush']);assert.equal(reloaded,false);assert.equal(saved.size,0);
 release(true);await restoring;
 assert.equal(reloaded,true);assert.deepEqual(JSON.parse(saved.get('beebright-session-v2:student')),backup.session);
});
test('failed cloud restoration keeps the page open and allows a retry',async()=>{
 const {saved,options}=restoreFixture();options.studio.flush=async()=>false;
 await assert.rejects(restoreAccountBackup(backup,options),/Cloud restore is pending/);
 assert.equal(saved.size,0);
 options.studio.flush=async()=>true;await restoreAccountBackup(backup,options);
 assert.equal(saved.size,1);
});
test('restoring a backup without a session clears the old session after saving tools',async()=>{
 const {calls,saved,options}=restoreFixture();saved.set('beebright-session-v2:student','old');
 await restoreAccountBackup({...backup,session:null},options);
 assert.deepEqual(calls,['delete','studio']);assert.equal(saved.size,0);
});
test('invalid, signed-out or not-yet-loaded restores cannot alter account data',async()=>{
 for(const kind of ['invalid','invalidStudio','arrayStudio','signedOut','loading']){
  const {calls,options}=restoreFixture();let value=backup;
  if(kind==='invalid')value={...backup,session:{...backup.session,index:-1}};
  if(kind==='invalidStudio')value={...backup,studio:'damaged data'};
  if(kind==='arrayStudio')value={...backup,studio:[]};
  if(kind==='signedOut')options.getToken=async()=>null;
  if(kind==='loading')options.studio.ready=false;
  await assert.rejects(restoreAccountBackup(value,options));assert.deepEqual(calls,[]);
 }
});
