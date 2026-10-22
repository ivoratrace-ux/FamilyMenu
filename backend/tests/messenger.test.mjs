import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server/app.mjs';
import {AuthError} from '../server/auth.mjs';
import {createMessengerAuth,normalizePhone,maskPhone} from '../server/messenger-auth.mjs';

const session=email=>({user:{id:'u-'+email.slice(0,20),email},session:{accessToken:'access',refreshToken:'refresh',expiresAt:1,expiresIn:3600,tokenType:'bearer'}});
function fakeAuth() {
 const accounts=new Map(),calls=[];
 return {calls,accounts,
  async signIn(email,password){calls.push(['signIn',email]);if(accounts.get(email)!==password) throw new AuthError(400,'INVALID_CREDENTIALS','Неверный email или пароль.');return session(email);},
  async signUp(email,password){calls.push(['signUp',email]);assert.ok(!accounts.has(email));accounts.set(email,password);return session(email);},
  async getUser(){throw new AuthError(401,'INVALID_SESSION','Войдите ещё раз.');}};
}
async function server(t,options) {const app=createApp(options);app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.closeAllConnections();app.close();});return `http://127.0.0.1:${app.address().port}`;}
const post=(base,path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('phone numbers are normalised and masked without exposing the full number',()=>{
 assert.equal(normalizePhone('8 (916) 123-45-67'),'+79161234567');
 assert.equal(normalizePhone('9161234567'),'+79161234567');
 assert.equal(normalizePhone('+7 916 123 45 67'),'+79161234567');
 assert.equal(maskPhone('+79161234567'),'+7 916 ***-**-67');
 for(const bad of ['', 'abc', '12345', 42]) assert.throws(()=>normalizePhone(bad));
});

test('messenger sign-in reports missing configuration instead of calling providers',async t=>{
 const base=await server(t,{auth:fakeAuth(),messenger:createMessengerAuth({auth:fakeAuth(),secret:'',telegramToken:'',maxToken:'',fetchImpl:()=>assert.fail('provider called')})});
 assert.deepEqual(await (await fetch(base+'/api/auth/messengers')).json(),{telegram:false,max:false});
 assert.equal((await post(base,'/api/auth/telegram/start',{phone:'+79161234567'})).status,503);
 assert.equal((await post(base,'/api/auth/max/start',{})).status,503);
});

test('Telegram Gateway code signs into one stable Supabase account per phone without storing the phone',async t=>{
 const auth=fakeAuth(),gateway=[];
 const fetchImpl=async(url,opts)=>{
  assert.equal(opts.headers.Authorization,'Bearer tg-token');
  const body=JSON.parse(opts.body);gateway.push([String(url).split('/').at(-1),body]);
  if(String(url).endsWith('sendVerificationMessage')) return Response.json({ok:true,result:{request_id:'req-'+gateway.length}});
  return Response.json({ok:true,result:{verification_status:{status:body.code==='1234'?'code_valid':'code_invalid'}}});
 };
 const messenger=createMessengerAuth({auth,secret:'test-secret',telegramToken:'tg-token',fetchImpl});
 const base=await server(t,{auth,messenger});
 const start=await post(base,'/api/auth/telegram/start',{phone:'8 916 123-45-67'});
 assert.equal(start.status,200);const challenge=await start.json();
 assert.equal(challenge.destination,'+7 916 ***-**-67');assert.ok(!JSON.stringify(challenge).includes('1234567'));
 assert.deepEqual(gateway[0],['sendVerificationMessage',{phone_number:'+79161234567',code_length:4,ttl:300}]);
 assert.equal((await post(base,'/api/auth/telegram/verify',{challengeId:challenge.challengeId,code:'0000'})).status,401);
 const ok=await post(base,'/api/auth/telegram/verify',{challengeId:challenge.challengeId,code:'1234'});
 assert.equal(ok.status,200);const signed=await ok.json();
 assert.equal(signed.login.via,'telegram');assert.equal(signed.session.accessToken,'access');
 assert.match(signed.user.email,/^telegram-[0-9a-f]{32}@users\.familymenu\.invalid$/);assert.ok(!signed.user.email.includes('9161234567'));
 assert.equal((await post(base,'/api/auth/telegram/verify',{challengeId:challenge.challengeId,code:'1234'})).status,401,'challenge is single-use');
 // A second sign-in with the same phone reuses the account; a cooldown limits repeated sends.
 assert.equal((await post(base,'/api/auth/telegram/start',{phone:'+79161234567'})).status,429);
 const direct=await messenger.telegramStart({phone:'+79161234567'});
 await messenger.telegramVerify({challengeId:direct.challengeId,code:'1234'});
 assert.deepEqual(auth.calls.map(c=>c[0]),['signIn','signUp','signIn']);
 assert.equal(auth.accounts.size,1);
});

test('Telegram verification is limited to five guesses per code',async()=>{
 const messenger=createMessengerAuth({auth:fakeAuth(),secret:'s',telegramToken:'t',fetchImpl:async url=>String(url).endsWith('sendVerificationMessage')?Response.json({ok:true,result:{request_id:'r'}}):Response.json({ok:true,result:{verification_status:{status:'code_invalid'}}})});
 const {challengeId}=await messenger.telegramStart({phone:'+79161234567'});
 for(let i=0;i<5;i++) await assert.rejects(messenger.telegramVerify({challengeId,code:'1111'}),{code:'INVALID_CODE'});
 await assert.rejects(messenger.telegramVerify({challengeId,code:'1111'}),{code:'INVALID_CODE'});
 await assert.rejects(messenger.telegramVerify({challengeId,code:'12'}),{code:'INVALID_INPUT'});
});

test('MAX bot deep link binds the chat through an authenticated webhook and delivers the code',async t=>{
 const auth=fakeAuth(),sent=[];
 const fetchImpl=async(url,opts)=>{const u=new URL(url);assert.equal(u.pathname,'/messages');assert.equal(u.searchParams.get('access_token'),'max-token');sent.push({user:u.searchParams.get('user_id'),text:JSON.parse(opts.body).text});return new Response('{}');};
 const messenger=createMessengerAuth({auth,secret:'test-secret',maxToken:'max-token',maxBotName:'familymenu_bot',fetchImpl});
 const base=await server(t,{auth,messenger});
 const start=await (await post(base,'/api/auth/max/start',{})).json();
 assert.equal(start.link,`https://max.ru/familymenu_bot?start=${start.challengeId}`);
 const early=await post(base,'/api/auth/max/verify',{challengeId:start.challengeId,code:'1234'});
 assert.equal(early.status,409,'code cannot be checked before the bot is opened');
 assert.equal((await post(base,'/api/max/webhook/wrong-secret',{update_type:'bot_started',user:{user_id:1},payload:start.challengeId})).status,404);
 const hook=messenger.webhookPath();
 assert.equal((await post(base,hook,{update_type:'bot_started',user:{user_id:77,name:'Аня'},payload:start.challengeId,chat_id:5,extra:'ignored'})).status,200);
 assert.equal(sent.length,1);assert.equal(sent[0].user,'77');
 const code=sent[0].text.match(/(\d{4})/)[1];
 assert.equal((await post(base,'/api/auth/max/verify',{challengeId:start.challengeId,code:code==='0000'?'0001':'0000'})).status,401);
 const ok=await post(base,'/api/auth/max/verify',{challengeId:start.challengeId,code});
 assert.equal(ok.status,200);const signed=await ok.json();
 assert.equal(signed.login.via,'max');assert.match(signed.user.email,/^max-[0-9a-f]{32}@/);
 assert.equal((await post(base,hook,{update_type:'bot_started',user:{user_id:77},payload:'expired'})).status,200);
 assert.match(sent.at(-1).text,/устарела/);
});
