import test from 'node:test';
import assert from 'node:assert/strict';
import {createTelegramAuth} from '../server/telegram-auth.mjs';
import {createApp} from '../server/app.mjs';
import {once} from 'node:events';

function fixture(options={}) {
 const calls=[],identities=[];let time=1000;
 const telegram=createTelegramAuth({token:'test-bot-token',now:()=>time,
  auth:{signInWithTelegram:async identity=>{identities.push(identity);return {user:{id:'user-'+identity.id,login:identity.username?'@'+identity.username:identity.name,application:'telegram'},session:{accessToken:'jwt',refreshToken:'refresh'}};}},
  fetchImpl:async(url,request)=>{const method=url.split('/').pop(),body=JSON.parse(request.body);calls.push({method,body});return Response.json({ok:true,result:method==='getMe'?{is_bot:true,username:'familymenu_test_bot'}:true});},...options});
 return {telegram,calls,identities,advance:ms=>{time+=ms;}};
}
async function approve(f,c,id=123,username='alice') {
 await f.telegram.configureWebhook('https://api.example.test');
 const secret=f.calls.find(c=>c.method==='setWebhook').body.secret_token;
 const from={id,first_name:'Alice',username};
 await f.telegram.webhook({message:{text:'/start login_'+c.challengeId,chat:{id,type:'private'},from}},secret);
 await f.telegram.webhook({callback_query:{id:'callback-1',data:'login:'+c.challengeId,from,message:{chat:{id,type:'private'}}}},secret);
 return secret;
}
test('only an authenticated Telegram confirmation completes the device holding the secret',async()=>{
 const f=fixture(),c=await f.telegram.start();
 assert.match(c.botUrl,/^https:\/\/t.me\/familymenu_test_bot\?start=login_[A-Za-z0-9_-]{24}$/);
 assert.match(c.code,/^\d{4}$/);
 assert.equal((await f.telegram.poll(c)).status,'pending');
 await assert.rejects(f.telegram.webhook({},'forged'),e=>e.status===401);
 await assert.rejects(f.telegram.poll({...c,pollToken:'forged'}),e=>e.status===401);
 await approve(f,c);
 const message=f.calls.find(c=>c.method==='sendMessage').body;
 assert.ok(message.text.includes(c.code));
 assert.ok(!JSON.stringify(message).includes(c.pollToken));
 const session=await f.telegram.poll(c);
 assert.equal(session.user.id,'user-123');assert.equal(session.user.login,'@alice');
 assert.equal(f.identities.length,1);
 await assert.rejects(f.telegram.poll(c),e=>e.status===401);
});
test('no username falls back to a name; same Telegram ID continues the same account',async()=>{
 const f=fixture(),a=await f.telegram.start();await approve(f,a,321,null);
 const first=await f.telegram.poll(a);
 const b=await f.telegram.start();await approve(f,b,321,'new_name');
 const second=await f.telegram.poll(b);
 assert.equal(first.user.id,second.user.id);assert.equal(first.user.login,'Alice');assert.equal(second.user.login,'@new_name');
});
test('expired challenges and group/forged identities cannot mint sessions',async()=>{
 const f=fixture(),c=await f.telegram.start();await f.telegram.configureWebhook('https://api.example.test');
 const secret=f.calls.find(c=>c.method==='setWebhook').body.secret_token;
 await f.telegram.webhook({callback_query:{id:'x',data:'login:'+c.challengeId,from:{id:1,first_name:'A'},message:{chat:{id:2,type:'private'}}}},secret);
 assert.equal((await f.telegram.poll(c)).status,'pending');assert.equal(f.identities.length,0);
 f.advance(300001);await assert.rejects(f.telegram.poll(c),e=>e.status===401);
});
test('concurrent polling consumes a confirmation once',async()=>{
 let calls=0,resolve;
 const f=fixture({auth:{signInWithTelegram:async()=>{calls++;return new Promise(r=>resolve=r);}}});
 const c=await f.telegram.start();await approve(f,c);
 const first=f.telegram.poll(c);await new Promise(r=>setImmediate(r));
 assert.equal((await f.telegram.poll(c)).status,'pending');assert.equal(calls,1);
 resolve({user:{id:'a'},session:{accessToken:'jwt'}});assert.equal((await first).status,'authenticated');
});
test('missing/failed bot configuration exposes no token or Telegram response',async()=>{
 const f=fixture({token:''});await assert.rejects(f.telegram.start(),e=>e.status===503);
 const broken=fixture({fetchImpl:async()=>{throw Error('provider secret');}});
 await assert.rejects(broken.telegram.start(),e=>e.status===503 && !e.message.includes('secret'));
});
test('HTTP flow rejects forged webhooks and identity injection, then issues a session after confirmation',async t=>{
 const f=fixture();await f.telegram.configureWebhook('https://api.example.test');
 const secret=f.calls.find(c=>c.method==='setWebhook').body.secret_token;
 const server=createApp({telegram:f.telegram});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.closeAllConnections();server.close();});
 const post=(path,body,headers={})=>fetch(`http://127.0.0.1:${server.address().port}/api/auth/telegram/`+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await post('start',{userId:123})).status,400);
 const c=await (await post('start',{})).json();
 assert.equal((await post('webhook',{})).status,401);
 assert.equal((await post('poll',{challengeId:c.challengeId,pollToken:c.pollToken})).status,200);
 const update={callback_query:{id:'callback-2',data:'login:'+c.challengeId,from:{id:123,first_name:'Alice'},message:{chat:{id:123,type:'private'}}}};
 assert.equal((await post('webhook',update,{'X-Telegram-Bot-Api-Secret-Token':secret})).status,200);
 const r=await post('poll',{challengeId:c.challengeId,pollToken:c.pollToken});assert.equal(r.status,200);
 assert.equal((await r.json()).user.id,'user-123');
});
