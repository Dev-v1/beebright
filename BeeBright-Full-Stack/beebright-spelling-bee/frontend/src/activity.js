import {useEffect} from 'react';
import {accountRequest} from './account-api.js';
export function useActivity({enabled,getToken,screen,mode,level,answered,correct,source,inactive}) {
 useEffect(()=>{
  if(!enabled||inactive)return;
  let stopped=false;
  const report=()=>{if(stopped||document.hidden)return;accountRequest(getToken,'/api/activity','PUT',{screen,mode,level,answered,correct,source}).catch(()=>{});};
  report();const timer=setInterval(report,15000);
  document.addEventListener('visibilitychange',report);
  return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',report);};
 },[enabled,getToken,screen,mode,level,answered,correct,source,inactive]);
}
