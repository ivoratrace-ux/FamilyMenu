import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server/app.mjs';
import {createSupabaseAuth,AuthError} from '../server/auth.mjs';
const user={id:'9d1c6cdc-9976-4630-b1f2-732000d6f002',email:'user@example.com'};
const session={user,access_token:'access-token',refresh_token:'refresh-token',expires_in:3600};
async function server(t,options={}) {const app=createApp(options);app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.closeAllConnections();app.close();});return `http://127.0.0.1:${app.address().port}`;}
const post=(base,path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('Telegram identity creates a server-only session and exposes login/application instead of email',async()=>{
 const paths=[];
 const raw={id:user.id,email:'telegram-internal@auth.familymenu.invalid',app_metadata:{login_application:'telegram',provider_user_id:'123',login:'@alice',display_name:'Alice'}};
 const auth=createSupabaseAuth({url:'https://project.supabase.co',apiKey:'server-key',fetchImpl:async(url,opts)=>{
  assert.equal(opts.headers.apikey,'server-key');paths.push(url);
  const body=opts.body && JSON.parse(opts.body);
  if(url.includes('/rest/v1/profiles?'))return Response.json([]);
  if(url.endsWith('/admin/generate_link')) {assert.equal(body.type,'magiclink');assert.match(body.email,/^telegram-[a-f0-9]{48}@auth\.familymenu\.invalid$/);return Response.json({...raw,hashed_token:'private-token-hash',verification_type:'signup'});}
  if(url.includes('/admin/users/')) {assert.deepEqual(body.app_metadata,raw.app_metadata);return Response.json(raw);}
  if(url.endsWith('/verify'))assert.deepEqual(body,{token_hash:'private-token-hash',type:'signup'});
  if(url.endsWith('/user'))return Response.json(raw);
  if(url.includes('/logout'))return new Response(null,{status:204});
  return Response.json({...session,user:raw});
 }});
 const signed=await auth.signInWithTelegram({id:'123',username:'alice',name:'Alice'});
 assert.deepEqual(signed.user,{id:user.id,application:'telegram',providerUserId:'123',login:'@alice',displayName:'Alice'});
 assert.ok(!JSON.stringify(signed).includes('@auth.familymenu.invalid'));
 assert.ok(!JSON.stringify(signed).includes('private-token-hash'));
 assert.equal((await auth.refreshSession('refresh-token')).user.login,'@alice');
 assert.equal((await auth.getUser('access-token')).application,'telegram');
 await auth.signOut('access-token');
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
test('email login, registration and test entry points are removed; Telegram input is checked',async t=>{
 const base=await server(t,{telegram:{start:()=>assert.fail('invalid input'),webhook:()=>assert.fail('invalid input')}});
 for(const path of ['/api/auth/login','/api/auth/register','/api/auth/otp','/api/auth/max/start']) assert.equal((await post(base,path,{})).status,404);
 assert.equal((await post(base,'/api/auth/telegram/start',{userId:'victim'})).status,400);
 assert.equal((await post(base,'/api/auth/telegram/poll',{userId:'victim'})).status,400);
});
test('validated user token is propagated to per-user data repositories, never a client-supplied user ID',async t=>{
 const seen=[];
 const base=await server(t,{auth:{getUser:async token=>({id:token,email:token+'@example.com'})},inventory:{load:async token=>{seen.push(token);return {userLogin:token+'@example.com',revision:0,items:[]};}}});
 const [a,b]=await Promise.all(['user-a','user-b'].map(token=>fetch(base+'/api/inventory',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json())));
 assert.notEqual(a.userLogin,b.userLogin);assert.deepEqual(seen.sort(),['user-a','user-b']);
});
