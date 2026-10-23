import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server/app.mjs';
import {createUserStateRepository,validateUserState,UserStateError} from '../server/user-state.mjs';
const preferences={profile:{members:[{name:'Я'}]}};
const menu={days:Array.from({length:7},(_,i)=>({date:`2026-10-${22+i}`,slots:[]}))};
test('current menu and preferences are saved atomically with a user bearer token and version',async()=>{
 const repo=createUserStateRepository({apiKey:'project-key',fetchImpl:async(url,options)=>{
  assert.equal(url,'https://ssahtncunusgptkrkxkj.supabase.co/rest/v1/rpc/save_user_state');
  assert.equal(options.headers.Authorization,'Bearer user-jwt');assert.equal(options.headers.apikey,'project-key');
  assert.deepEqual(JSON.parse(options.body),{p_preferences:preferences,p_menu:menu,p_revision:3});
  return new Response(JSON.stringify({revision:4,preferences,menu}));
 }});
 assert.equal((await repo.save(preferences,menu,3,'user-jwt')).revision,4);
 assert.throws(()=>validateUserState({},menu));assert.throws(()=>validateUserState(preferences,{days:[]}));
});
test('user-state endpoints reject arbitrary owner fields and preserve independent documents',async t=>{
 const store=new Map();
 const repo={load:async token=>store.get(token) || {revision:0,preferences:null,menu:null},save:async(p,m,revision,token)=>{
  const old=await repo.load(token);if(old.revision!==revision) throw new UserStateError(409,'Conflict');validateUserState(p,m);const data={revision:revision+1,preferences:p,menu:m};store.set(token,data);return data;
 }};
 const app=createApp({auth:{getUser:async token=>({id:token,email:token+'@example.com'})},userState:repo});app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.closeAllConnections();app.close();});
 const base=`http://127.0.0.1:${app.address().port}`;
 const call=(token,path='/api/user-state',method='GET',body)=>fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await call('a','/api/user-state','PUT',{revision:0,preferences,menu})).status,200);
 assert.deepEqual(await (await call('b')).json(),{revision:0,preferences:null,menu:null});
 assert.equal((await call('a','/api/user-state','PUT',{revision:1,preferences,menu,userId:'b'})).status,400);
 assert.equal((await call('a','/api/menu','PUT',{revision:0,menu})).status,409);
 const p=await (await call('a','/api/preferences')).json();assert.deepEqual(p.preferences,preferences);
 assert.deepEqual((await (await call('a','/api/menu')).json()).menu,menu);
});

test('fractional family servings persist; invalid quantities remain rejected',()=>{
 const withServings=n=>({...menu,days:menu.days.map((d,i)=>i?d:{...d,slots:[{meal:'d_pair',recipeId:'m1',servings:n}]})});
 for(const n of [.35,1.8182,2.4545,100])assert.doesNotThrow(()=>validateUserState(preferences,withServings(n)));
 for(const n of [0,-1,NaN,Infinity,'2',100.1])assert.throws(()=>validateUserState(preferences,withServings(n)),UserStateError);
});
