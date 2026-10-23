import {DEFAULT_SUPABASE_URL} from './supabase.mjs';
export class UserStateError extends Error {constructor(status,message){super(message);this.status=status;}}
export function validateUserState(preferences,menu) {
 if(!preferences || Array.isArray(preferences) || typeof preferences!=='object' || !preferences.profile || !Array.isArray(preferences.profile.members) || preferences.profile.members.length<1 || preferences.profile.members.length>20) throw new UserStateError(400,'Проверьте настройки семьи.');
 const object=x=>x!==null && typeof x==='object' && !Array.isArray(x);
 const fail=()=>{throw new UserStateError(400,'Некорректные предпочтения или меню.');};
 const strings=x=>Array.isArray(x) && x.length<=1000 && x.every(v=>typeof v==='string' && v.length<=300);
 const p=preferences.profile;
 for(const member of p.members) {
  if(!object(member)) fail();
  for(const key of ['age','weight','height','customCalories']) if(key in member && (!Number.isInteger(member[key]) || member[key]<0 || member[key]>10000)) fail();
  for(const key of ['name','sex','activity','goal']) if(key in member && (typeof member[key]!=='string' || member[key].length>120)) fail();
  if('child' in member && typeof member.child!=='boolean') fail();
 }
 for(const key of ['allergies','likes','dislikes','goals','meals']) if(key in p && !strings(p[key])) fail();
 for(const key of ['diet','city','reminderTime']) if(key in p && typeof p[key]!=='string') fail();
 for(const key of ['budget','maxTime']) if(key in p && (!Number.isInteger(p[key]) || p[key]<0 || p[key]>10000000)) fail();
 for(const key of ['soupBatch','reminder']) if(key in p && typeof p[key]!=='boolean') fail();
 for(const key of ['bought','eaten','liked','disliked','blocked']) if(key in preferences && !strings(preferences[key])) fail();
 for(const key of ['store','theme','stage','reminderShown']) if(key in preferences && typeof preferences[key]!=='string') fail();
 if(preferences.plan!=null) fail();
 if('extra' in preferences && (!object(preferences.extra) || Object.values(preferences.extra).some(list=>!Array.isArray(list) || list.some(x=>!object(x) || typeof x.label!=='string' || !Number.isInteger(x.calories))))) fail();
 if(menu!==null && (!menu || !Array.isArray(menu.days) || menu.days.length!==7 || menu.days.some(d=>!d || typeof d.date!=='string' || !Array.isArray(d.slots) || d.slots.length>20))) throw new UserStateError(400,'Некорректное меню.');
 if(menu!==null && menu.days.some(d=>d.slots.some(s=>!object(s) || typeof s.meal!=='string' || (s.recipeId!=null && typeof s.recipeId!=='string') || ('servings' in s && (typeof s.servings!=='number' || !Number.isFinite(s.servings) || s.servings<=0 || s.servings>100)) || ['leftover','cooked'].some(k=>k in s && typeof s[k]!=='boolean')))) fail();
 if(JSON.stringify({preferences,menu}).length>250000) throw new UserStateError(413,'Слишком большой документ.');
}
export function createUserStateRepository({url=process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL,apiKey=process.env.SUPABASE_API_KEY,fetchImpl=fetch}={}) {
 async function rpc(name,body,token) {
  if(!token) throw new UserStateError(401,'Войдите в аккаунт.');
  if(!apiKey) throw new UserStateError(503,'Личные данные временно недоступны.');
  const base=new URL(url);if(base.protocol!=='https:' || base.username || base.password || base.search || base.hash || !['','/'].includes(base.pathname)) throw Error('Invalid database configuration');
  const r=await fetchImpl(`${base.origin}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:apiKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!r.ok) throw new UserStateError(r.status===401?401:r.status===409?409:503,r.status===409?'Данные изменились на другом устройстве. Загрузите актуальную версию.':'Не удалось загрузить или сохранить личные данные.');
  const data=await r.json();if(!Number.isSafeInteger(data?.revision) || !('preferences' in data) || !('menu' in data)) throw Error('Invalid user state');return data;
 }
 return {load:token=>rpc('get_user_state',{},token),save:(preferences,menu,revision,token)=>{validateUserState(preferences,menu);return rpc('save_user_state',{p_preferences:preferences,p_menu:menu,p_revision:revision},token);}};
}
export function createUserStateRouter(repository) {
 return async(req,path,send,res)=>{
  try {
   const current=()=>repository.load(req.accessToken);
   if(req.method==='GET') {const data=await current();return send(200,path==='/api/preferences'?{revision:data.revision,preferences:data.preferences}:path==='/api/menu'?{revision:data.revision,menu:data.menu}:data);}
   if(req.method!=='PUT') {res.setHeader('Allow','GET, PUT, OPTIONS');return send(405,{error:'Метод не поддерживается.'});}
   if(req.headers['content-type']?.split(';')[0].trim()!=='application/json') return send(415,{error:'Нужен JSON.'});
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>262144){req.resume();return send(413,{error:'Слишком большой документ.'});}chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Некорректный JSON.'});}
   const keys=path==='/api/preferences'?['preferences','revision']:path==='/api/menu'?['menu','revision']:['preferences','menu','revision'];
   if(!body || !Number.isSafeInteger(body.revision) || body.revision<0 || Object.keys(body).some(k=>!keys.includes(k))) return send(400,{error:'Неверные поля или версия документа.'});
   const old=path==='/api/user-state'?null:await current();
   return send(200,await repository.save(path==='/api/menu'?old.preferences:body.preferences,path==='/api/preferences'?old.menu:body.menu,body.revision,req.accessToken));
  }catch(e){return send(e instanceof UserStateError?e.status:503,{error:e instanceof UserStateError?e.message:'Личные данные временно недоступны.'});}
 };
}
