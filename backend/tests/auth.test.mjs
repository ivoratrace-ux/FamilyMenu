import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/app.mjs';
import { createSupabaseAuth, AuthError } from '../server/auth.mjs';
import { createAuthRouter } from '../server/auth-routes.mjs';
import { makePlan } from './fixtures.mjs';

const user={id:'9d1c6cdc-9976-4630-b1f2-732000d6f002',email:'tester@example.com'};
const session={access_token:'user-access-token',refresh_token:'user-refresh-token',expires_in:3600,token_type:'bearer',user:{...user,app_metadata:{role:'do-not-expose'}}};
const response=data=>({ok:true,status:200,json:async()=>data});
const config={url:'https://project.supabase.co',apiKey:'sb_secret_server-key'};
async function start(t,auth,routerOptions={}) {
  const app=createApp({apiKey:'model-key',generate:async({settings})=>makePlan(settings),authRouter:createAuthRouter({auth,...routerOptions})});
  app.listen(0,'127.0.0.1'); await once(app,'listening');
  t.after(()=>new Promise(resolve=>{app.close(resolve);app.closeAllConnections();}));
  return `http://127.0.0.1:${app.address().port}`;
}
function post(base,path,body,headers={}) {
  return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
}

test('complete backend OTP/session flow uses Supabase and never exposes the project key',async t=>{
  const requests=[];
  const auth=createSupabaseAuth({...config,fetchImpl:async(url,options)=>{
    const path=url.replace(config.url+'/auth/v1',''); requests.push(path);
    assert.equal(options.headers.apikey,config.apiKey);
    assert.equal(options.redirect,'error');
    const body=options.body?JSON.parse(options.body):undefined;
    if(path==='/otp') {assert.deepEqual(body,{email:user.email,create_user:true});return response({});}
    if(path==='/verify') {assert.deepEqual(body,{email:user.email,token:'01234567',type:'email'});return response(session);}
    if(path==='/user') {assert.equal(options.headers.Authorization,'Bearer user-access-token');return response(session.user);}
    if(path==='/token?grant_type=refresh_token') {assert.deepEqual(body,{refresh_token:'user-refresh-token'});return response({...session,access_token:'new-access',refresh_token:'new-refresh'});}
    if(path==='/logout?scope=local') {assert.equal(options.headers.Authorization,'Bearer new-access');return {ok:true,status:204};}
    assert.fail('unexpected auth endpoint');
  }});
  const base=await start(t,auth);
  const sent=await post(base,'/api/auth/otp',{email:' Tester@Example.com '});assert.equal(sent.status,200);
  assert.ok(!JSON.stringify(await sent.json()).includes('server-key'));
  const verified=await post(base,'/api/auth/verify',{email:user.email,code:'01234567'});assert.equal(verified.status,200);
  const data=await verified.json();assert.deepEqual(data.user,user);assert.equal(data.session.accessToken,'user-access-token');
  assert.equal(data.session.refreshToken,'user-refresh-token');assert.ok(data.session.expiresAt>Date.now()/1000);
  assert.ok(!JSON.stringify(data).includes('do-not-expose'));assert.ok(!JSON.stringify(data).includes(config.apiKey));
  const me=await fetch(base+'/api/auth/me',{headers:{Authorization:'Bearer user-access-token'}});assert.equal(me.status,200);assert.deepEqual(await me.json(),{user});
  const refreshed=await post(base,'/api/auth/refresh',{refreshToken:'user-refresh-token'});assert.equal(refreshed.status,200);assert.equal((await refreshed.json()).session.refreshToken,'new-refresh');
  const logout=await fetch(base+'/api/auth/logout',{method:'POST',headers:{Authorization:'Bearer new-access'}});assert.equal(logout.status,204);assert.equal(await logout.text(),'');
  assert.deepEqual(requests,['/otp','/verify','/user','/token?grant_type=refresh_token','/logout?scope=local']);
});
test('different users never share mutable auth sessions',async()=>{
  const seen=[];
  const auth=createSupabaseAuth({...config,fetchImpl:async(url,options)=>{
    seen.push(options.headers.Authorization);
    return response({id:options.headers.Authorization,email:'user@example.com'});
  }});
  const users=await Promise.all([auth.getUser('token-a'),auth.getUser('token-b')]);
  assert.deepEqual(seen,['Bearer token-a','Bearer token-b']);
  assert.equal(users[0].id,'Bearer token-a');assert.equal(users[1].id,'Bearer token-b');
});
test('missing/malformed bearer tokens are rejected locally; forged tokens are verified upstream',async t=>{
  let calls=0;
  const auth=createSupabaseAuth({...config,fetchImpl:async()=>{calls++;return {ok:false,status:401,json:async()=>({msg:'private provider text'})};}});
  const base=await start(t,auth);
  for(const value of ['', 'Basic abc','Bearer a b','Bearer a, Bearer b']) {
    const r=await fetch(base+'/api/auth/me',{headers:value?{Authorization:value}:{}});assert.equal(r.status,401);
  }
  assert.equal(calls,0);
  const r=await fetch(base+'/api/auth/me',{headers:{Authorization:'Bearer forged.jwt.token'}});
  assert.equal(r.status,401);assert.equal((await r.json()).code,'INVALID_SESSION');assert.equal(calls,1);
});
test('validates email/code/body/refresh token before contacting Supabase',async t=>{
  const auth={sendCode:()=>assert.fail('must not send'),verifyCode:()=>assert.fail('must not verify'),refreshSession:()=>assert.fail('must not refresh')};
  const base=await start(t,auth);
  for(const body of [{},{email:'bad'},{email:'user@example.com',role:'admin'},null,[]]) assert.equal((await post(base,'/api/auth/otp',body)).status,400);
  for(const code of ['123',123456,'abcdef','12345678901']) assert.equal((await post(base,'/api/auth/verify',{email:user.email,code})).status,400);
  assert.equal((await post(base,'/api/auth/refresh',{refreshToken:''})).status,400);
  assert.equal((await post(base,'/api/auth/refresh',{refreshToken:'a'.repeat(8193)})).status,400);
  assert.equal((await fetch(base+'/api/auth/otp',{method:'POST',body:'{}'})).status,415);
  assert.equal((await fetch(base+'/api/auth/otp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
  assert.equal((await post(base,'/api/auth/otp',{email:'x'.repeat(20000)})).status,413);
});
test('limits email resend and global email attempts before spending provider quota',async t=>{
  let sent=0,now=0;
  const base=await start(t,{sendCode:async()=>{sent++;}},{now:()=>now});
  assert.equal((await post(base,'/api/auth/otp',{email:user.email})).status,200);
  const repeated=await post(base,'/api/auth/otp',{email:user.email});assert.equal(repeated.status,429);assert.equal(repeated.headers.get('Retry-After'),'60');
  assert.equal((await post(base,'/api/auth/otp',{email:'second@example.com'})).status,200);
  assert.equal((await post(base,'/api/auth/otp',{email:'third@example.com'})).status,429);assert.equal(sent,2);
  now=3600000;
  assert.equal((await post(base,'/api/auth/otp',{email:user.email})).status,200);assert.equal(sent,3);
});
test('limits code guesses independently of email sends',async t=>{
  let attempts=0;
  const base=await start(t,{verifyCode:async()=>{attempts++;throw new AuthError(401,'INVALID_CODE','Неверный код.');}});
  for(let i=0;i<5;i++) assert.equal((await post(base,'/api/auth/verify',{email:user.email,code:'000000'})).status,401);
  assert.equal((await post(base,'/api/auth/verify',{email:user.email,code:'000000'})).status,429);assert.equal(attempts,5);
});
test('provider errors and credentials are sanitized; bad code is not a valid session',async()=>{
  for(const [status,code,expected] of [[429,'over_email_send_rate_limit','AUTH_RATE_LIMITED'],[403,'email_address_not_authorized','EMAIL_NOT_AUTHORIZED'],[400,'signup_disabled','EMAIL_AUTH_DISABLED'],[500,'unknown','AUTH_UNAVAILABLE']]) {
    const auth=createSupabaseAuth({...config,fetchImpl:async()=>({ok:false,status,json:async()=>({code,msg:'sb_secret_server-key and private details'})})});
    await assert.rejects(auth.sendCode(user.email),error=>error instanceof AuthError && error.code===expected && !error.message.includes('server-key'));
  }
  const invalid=createSupabaseAuth({...config,fetchImpl:async()=>({ok:false,status:403,json:async()=>({code:'otp_expired'})})});
  await assert.rejects(invalid.verifyCode(user.email,'123456'),error=>error.code==='INVALID_CODE');
  await assert.rejects(invalid.refreshSession('stale-refresh'),error=>error.code==='INVALID_SESSION');
  const broken=createSupabaseAuth({...config,fetchImpl:async()=>response({access_token:'partial'})});
  await assert.rejects(broken.verifyCode(user.email,'123456'),error=>error.code==='AUTH_UNAVAILABLE');
});
test('network errors and timeout become safe unavailability responses',async()=>{
  const auth=createSupabaseAuth({...config,fetchImpl:async()=>{throw Error('secret in raw exception');}});
  await assert.rejects(auth.sendCode(user.email),error=>error.code==='AUTH_UNAVAILABLE'&&!error.message.includes('secret'));
  const timed=createSupabaseAuth({...config,timeoutMs:5,fetchImpl:(url,{signal})=>new Promise((resolve,reject)=>{
    const alive=setTimeout(resolve,100);
    signal.addEventListener('abort',()=>{clearTimeout(alive);reject(Error('timeout'));});
  })});
  await assert.rejects(timed.sendCode(user.email),error=>error.status===503);
});
test('auth health checks provider configuration without sending email, caches results and keeps web/meals public',async t=>{
  let calls=0;
  const auth=createSupabaseAuth({...config,fetchImpl:async(url)=>{
    calls++;assert.equal(url,config.url+'/auth/v1/settings');
    return response({external:{email:true},disable_signup:false,mailer_autoconfirm:false});
  }});
  const base=await start(t,auth);
  const [a,b]=await Promise.all([fetch(base+'/health/auth'),fetch(base+'/health/auth')]);
  assert.equal(a.status,200);assert.equal(b.status,200);
  assert.deepEqual(await a.json(),{status:'ok',emailEnabled:true,registrationEnabled:true,emailConfirmationRequired:true});assert.equal(calls,1);
  assert.equal((await fetch(base+'/')).status,200);
  assert.equal((await post(base,'/api/meals',{})).status,200);
  const preflight=await fetch(base+'/api/auth/me',{method:'OPTIONS',headers:{Origin:'https://ivoratrace-ux.github.io'}});
  assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/Authorization/);
  assert.equal((await fetch(base+'/api/auth/me',{headers:{Origin:'https://example.org'}})).status,403);
  assert.equal((await fetch(base+'/api/auth/unknown')).status,404);
  assert.equal((await fetch(base+'/api/auth/otp')).status,405);
});
test('missing/invalid Supabase configuration does not contact a remote service',async()=>{
  for(const config of [{url:'http://unsafe.example',apiKey:'test'},{url:'https://project.supabase.co',apiKey:''}]) {
    const auth=createSupabaseAuth({...config,fetchImpl:()=>assert.fail('no call')});
    await assert.rejects(auth.checkConfiguration(),error=>error.code==='AUTH_NOT_CONFIGURED');
  }
});
