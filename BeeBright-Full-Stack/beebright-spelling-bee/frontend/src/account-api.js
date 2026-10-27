import {API_BASE_URL} from './api.js';
export async function accountRequest(getToken,path,method='GET',data) {
 const token=await getToken();
 if(!token)throw new Error('Sign in to use your cloud account.');
 const r=await fetch(API_BASE_URL+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(15000)});
 if(!r.ok){let body;try{body=await r.json()}catch{}throw new Error(typeof body?.detail==='string'?body.detail:'Cloud request failed ('+r.status+').');}
 return r.status===204?null:r.json();
}
