/* Server API only. Bot/OpenAI/Supabase server keys never enter the browser. */
(() => {
  const base='https://vibe-coding-sc04.onrender.com';
  const key='family-menu-auth-v1';
  let session=null,refreshing=null,epoch=0;
  class ApiError extends Error {constructor(status,message){super(message);this.status=status;}}
  function install(value) {
    session=value;epoch++;
    try {value?localStorage.setItem(key,JSON.stringify(value)):localStorage.removeItem(key);}catch{}
  }
  async function send(path,{method='GET',body,token}={}) {
    let response;
    try {response=await fetch(base+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000),cache:'no-store'});}
    catch {throw new ApiError(0,'Нет связи с сервером. Проверьте интернет.');}
    if(response.status===204)return null;
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new ApiError(response.status,data.error || 'Сервис временно недоступен.');
    return data;
  }
  async function token(force=false) {
    if(!session)throw new ApiError(401,'Войдите через Telegram.');
    if(!force && session.session.expiresAt>Date.now()/1000+60)return session.session.accessToken;
    if(!refreshing) {
      const before=session,version=epoch;
      refreshing=send('/api/auth/refresh',{method:'POST',body:{refreshToken:before.session.refreshToken}})
        .then(value=>{if(epoch!==version)throw new ApiError(401,'Аккаунт изменился.');install(value);return value.session.accessToken;})
        .catch(error=>{if([400,401,403].includes(error.status) && epoch===version)install(null);throw error;})
        .finally(()=>{refreshing=null;});
    }
    return refreshing;
  }
  async function request(path,options={}) {
    const owner=session?.user?.id;
    const first=await token();
    if(session?.user?.id!==owner)throw new ApiError(401,'Аккаунт изменился.');
    try {return await send(path,{...options,token:first});}
    catch(error) {
      if(error.status!==401)throw error;
      if(session?.user?.id!==owner)throw new ApiError(401,'Аккаунт изменился.');
      const next=session?.session.accessToken!==first?await token():await token(true);
      try {return await send(path,{...options,token:next});}
      catch(second){if(second.status===401 && session?.session.accessToken===next)install(null);throw second;}
    }
  }
  window.FamilyMenuApi={
    ApiError,get session(){return session;},get epoch(){return epoch;},
    async restore(){
      try {session=JSON.parse(localStorage.getItem(key));}catch{}
      if(session?.user?.application!=='telegram' || typeof session.user.id!=='string' || typeof session.session?.accessToken!=='string' || typeof session.session?.refreshToken!=='string' || !Number.isFinite(session.session?.expiresAt)){install(null);return null;}
      const owner=session.user.id;
      try {const result=await request('/api/auth/me');if(session?.user?.id!==owner || result.user.id!==owner)throw new ApiError(401,'Аккаунт изменился.');session.user=result.user;return session;}
      catch(error){if(error.status===401){if(session?.user?.id===owner)install(null);return null;}throw error;}
    },
    catalog:()=>send('/api/catalog'),request,
    start:()=>send('/api/auth/telegram/start',{method:'POST',body:{}}),
    async poll(challenge){return send('/api/auth/telegram/poll',{method:'POST',body:{challengeId:challenge.challengeId,pollToken:challenge.pollToken}});},
    accept(result){install({user:result.user,session:result.session});},
    async logout(){const old=session;install(null);if(old)await send('/api/auth/logout',{method:'POST',token:old.session.accessToken}).catch(()=>{});}
  };
})();
