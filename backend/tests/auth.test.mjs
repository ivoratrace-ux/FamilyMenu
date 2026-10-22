import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server/app.mjs';
import {createSupabaseAuth,AuthError} from '../server/auth.mjs';
const user={id:'9d1c6cdc-9976-4630-b1f2-732000d6f002',email:'user@example.com'};
const session={user,access_token:'access-token',refresh_token:'refresh-token',expires_in:3600};
async function server(t,options={}) {const app=createApp(options);app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.closeAllConnections();app.close();});return `http://127.0.0.1:${app.address().port}`;}
const post=(base,path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('password registration/login and session lifecycle use Supabase without disclosing project keys',async t=>{
 const paths=[];
 const auth=createSupabaseAuth({url:'https://project.supabase.co',apiKey:'server-key',fetchImpl:async(url,opts)=>{
  assert.equal(opts.headers.apikey,'server-key');paths.push(url);
  if(url.endsWith('/user')) return new Response(JSON.stringify(user));
  if(url.includes('/logout')) return new Response(null,{status:204});
  const body=JSON.parse(opts.body);
  if(!url.includes('refresh_token')) assert.deepEqual(body,{email:user.email,password:'StrongPass123!'});
  return new Response(JSON.stringify(session));
 }});
 const base=await server(t,{auth});
 for(const path of ['/api/auth/register','/api/auth/login']) {
  const r=await post(base,path,{email:' USER@example.com ',password:'StrongPass123!'});assert.equal(r.status,200);const data=await r.json();assert.deepEqual(data.user,user);assert.equal(data.session.accessToken,'access-token');assert.ok(!JSON.stringify(data).includes('server-key'));
 }
 assert.ok(paths[0].endsWith('/signup'));assert.ok(paths[1].endsWith('/token?grant_type=password'));
 assert.equal((await post(base,'/api/auth/refresh',{refreshToken:'refresh-token'})).status,200);
 assert.equal((await fetch(base+'/api/auth/me',{headers:{Authorization:'Bearer access-token'}})).status,200);
 assert.equal((await post(base,'/api/auth/logout',{}, {Authorization:'Bearer access-token'})).status,204);
 assert.equal((await post(base,'/api/auth/otp',{email:user.email})).status,404);
});
test('all private routes reject anonymous and forged sessions before touching data or paid providers',async t=>{
 let calls=0;
 const base=await server(t,{auth:{getUser:async()=>{calls++;throw new AuthError(401,'INVALID_SESSION','Войдите ещё раз.');}},inventory:{load:()=>assert.fail('private read')},analyze:()=>assert.fail('paid scan'),userState:{load:()=>assert.fail('private data')}});
 for(const path of ['/api/inventory','/api/inventory/item','/api/user-state','/api/preferences','/api/menu','/api/fridge/scan','/api/meals','/api/ingredients']) {
  assert.equal((await fetch(base+path)).status,401,path);
  assert.equal((await fetch(base+path,{headers:{Authorization:'Bearer forged.jwt.token'}})).status,401,path);
 }
 assert.equal(calls,8);
 assert.equal((await fetch(base+'/')).status,200);
});
test('invalid credentials, invalid JSON, weak passwords and excess attempts are handled without provider leakage',async t=>{
 let calls=0;
 const auth={signIn:async()=>{calls++;throw new AuthError(400,'INVALID_CREDENTIALS','Неверный email или пароль.');}};
 const base=await server(t,{auth});
 for(const body of [{email:'bad',password:'StrongPass123!'},{email:user.email,password:'short'},{email:user.email,password:'StrongPass123!',userId:'victim'}]) assert.equal((await post(base,'/api/auth/login',body)).status,400);
 assert.equal(calls,0);
 for(let i=0;i<5;i++) assert.equal((await post(base,'/api/auth/login',{email:user.email,password:'StrongPass123!'})).status,400);
 assert.equal((await post(base,'/api/auth/login',{email:user.email,password:'StrongPass123!'})).status,429);
});
test('validated user token is propagated to per-user data repositories, never a client-supplied user ID',async t=>{
 const seen=[];
 const base=await server(t,{auth:{getUser:async token=>({id:token,email:token+'@example.com'})},inventory:{load:async token=>{seen.push(token);return {userEmail:token+'@example.com',revision:0,items:[]};}}});
 const [a,b]=await Promise.all(['user-a','user-b'].map(token=>fetch(base+'/api/inventory',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json())));
 assert.notEqual(a.userEmail,b.userEmail);assert.deepEqual(seen.sort(),['user-a','user-b']);
});
