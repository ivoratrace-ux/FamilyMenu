import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/app.mjs';
import { FRIDGE_PROMPT, FRIDGE_SCHEMA } from '../server/fridge-prompt.mjs';
import { analyzeFridge, createFridgeRouter, validateImage, validateProducts } from '../server/fridge.mjs';
const input = { mimeType:'image/jpeg', image:Buffer.from([255,216,255,224,0,0]).toString('base64') };
async function server(t, options = {}) {
  const app = createApp({ apiKey:'private-key', ...options });
  app.listen(0,'127.0.0.1'); await once(app,'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const base = `http://127.0.0.1:${app.address().port}`;
  return (body=input, headers={}) => fetch(base+'/api/fridge/scan',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
}
test('scan HTTP contract returns products and isolates provider key', async t => {
  let calls=0;
  const post=await server(t,{analyze:async args => {calls++; assert.equal(args.apiKey,'private-key'); assert.equal(args.image,input.image); return {products:[{name:'Молоко',amount:'около 500 мл',confidence:'high',alternatives:[]}]};}});
  const r=await post(); assert.equal(r.status,200); assert.deepEqual(await r.json(),{products:[{name:'Молоко',amount:'около 500 мл',confidence:'high',alternatives:[]}]}); assert.equal(calls,1);
});
test('invalid uploads are rejected before provider call',async t=>{
  const post=await server(t,{analyze:()=>assert.fail('provider called')});
  for(const body of [{},{...input,image:'bad'}, {...input,mimeType:'text/html'},{...input,image:Buffer.from('not a photo').toString('base64')},{...input,url:'https://example.com'}]) assert.equal((await post(body)).status,400);
  assert.equal((await post(input,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await post(input,{Origin:'https://evil.example'})).status,403);
  assert.equal((await post({...input,image:'A'.repeat(5600000)})).status,413);
});
test('missing credentials, provider failures and malformed results are safe',async t=>{
  assert.equal((await (await server(t,{apiKey:''}))()).status,503);
  for(const analyze of [async()=>{throw Error('private-key');},async()=>({products:[{name:'x'}]})]) {
    const r=await (await server(t,{analyze}))(); assert.equal(r.status,502); assert.ok(!(await r.text()).includes('private-key'));
  }
});
test('empty recognition is valid and hourly budget prevents further paid calls',async t=>{
  let calls=0; const post=await server(t,{hourlyLimit:1,analyze:async()=>{calls++;return {products:[]};}});
  assert.deepEqual(await (await post()).json(),{products:[]}); assert.equal((await post()).status,429); assert.equal(calls,1);
});
test('concurrent scan limit protects provider',async t=>{
  let release; const gate=new Promise(resolve=>{release=resolve;});
  let entered=0;
  const post=await server(t,{analyze:async()=>{entered++; await gate; return {products:[]};}});
  const first=post(), second=post();
  while(entered<2) await new Promise(resolve=>setTimeout(resolve,5));
  try {assert.equal((await post()).status,429);} finally {release();}
  assert.equal((await first).status,200); assert.equal((await second).status,200);
});
test('vision request uses structured output and validates provider results',async()=>{
  const result=await analyzeFridge({...input,apiKey:'secret',fetchImpl:async(url,opts)=>{
    assert.equal(url,'https://api.openai.com/v1/chat/completions');
    const body=JSON.parse(opts.body); assert.equal(body.response_format.json_schema.strict,true);
    assert.deepEqual(body.response_format.json_schema.schema,FRIDGE_SCHEMA);
    assert.equal(body.messages[0].content,FRIDGE_PROMPT);
    assert.match(body.messages[0].content,/Не учитывай полноценные готовые блюда/);
    assert.equal(body.messages[1].content[1].image_url.url,`data:image/jpeg;base64,${input.image}`);
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{"products":[{"name":"Яйца","amount":"3 шт.","confidence":"high","alternatives":[]}]}'}}]})};
  }}); assert.equal(result.products[0].name,'Яйца');
  for(const candidate of [{finish_reason:'length',message:{}},{finish_reason:'stop',message:{refusal:'no'}},{finish_reason:'stop',message:{content:'{}'}}]) {
    await assert.rejects(analyzeFridge({...input,apiKey:'secret',fetchImpl:async()=>({ok:true,json:async()=>({choices:[candidate]})})}));
  }
  assert.throws(()=>validateProducts({products:Array(61).fill({name:'a',amount:'b'})}));
  assert.throws(()=>validateImage({...input,image:Buffer.alloc(4*1024*1024+1).toString('base64')}));
});

test('simultaneous uploads cannot spend the final hourly slot twice', async()=>{
  let release; const gate=new Promise(resolve=>{release=resolve;});
  let calls=0;
  const route=createFridgeRouter({apiKey:'key',hourlyLimit:1,analyze:async()=>{calls++;return {products:[]};}});
  const statuses=[];
  const request=()=>({method:'POST',headers:{'content-type':'application/json'},async *[Symbol.asyncIterator](){await gate;yield Buffer.from(JSON.stringify(input));}});
  const response=()=>({setHeader(){},headersSent:false});
  const a=route(request(),response(),status=>statuses.push(status));
  const b=route(request(),response(),status=>statuses.push(status));
  release(); await Promise.all([a,b]);
  assert.deepEqual(statuses.sort(),[200,429]); assert.equal(calls,1);
});

test('HTTP returns high and medium products and excludes low confidence',async t=>{
  const products=[
    {name:'Молоко',amount:'1 упаковка',confidence:'high',alternatives:[]},
    {name:'Тёмный соус',amount:'1 бутылка',confidence:'medium',alternatives:['Соевый соус','Бальзамический соус']},
    {name:'Порционная упаковка',amount:'2 шт.',confidence:'low',alternatives:[]}
  ];
  const post=await server(t,{analyze:async()=>({products})});
  const response=await post(); assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{products:products.slice(0,2)});
});
test('rejects invalid uncertainty metadata rather than silently dropping it',async()=>{
  const good={name:'Соус',amount:'1 шт.',confidence:'medium',alternatives:['Соевый соус']};
  for(const patch of [
    {confidence:undefined},{confidence:'certain'},{confidence:null},
    {alternatives:undefined},{alternatives:'Соус'},{alternatives:[null]},
    {alternatives:[' ']},{alternatives:['a','b','c','d']},{alternatives:['a'.repeat(121)]}
  ]) assert.throws(()=>validateProducts({products:[{...good,...patch}]}));
  const normal=validateProducts({products:[{...good,name:' Соус ',alternatives:[' Масло ','Масло','Уксус']}]});
  assert.equal(normal.products[0].name,'Соус');
  assert.deepEqual(normal.products[0].alternatives,['Масло','Уксус']);
  assert.equal(validateProducts({products:Array(60).fill(good)}).products.length,60);
  assert.throws(()=>validateProducts({products:Array(61).fill(good)}));
});
test('invalid confidence from provider becomes a safe HTTP error',async t=>{
  const post=await server(t,{analyze:async()=>({products:[{name:'x',amount:'1',confidence:'wrong',alternatives:[]}]})});
  const response=await post();assert.equal(response.status,502);
});

test('confidence policy hides low and unusable medium results, high needs no alternatives',()=>{
  const products=[
    {name:'Молоко',amount:'1 упаковка',confidence:'high',alternatives:['Кефир']},
    {name:'Соус',amount:'1 бутылка',confidence:'medium',alternatives:['Масло','Уксус']},
    {name:'Упаковка',amount:'1 шт.',confidence:'medium',alternatives:[]},
    {name:'Неясный продукт',amount:'1 шт.',confidence:'low',alternatives:['Сыр']}
  ];
  const result=validateProducts({products});
  assert.deepEqual(result.products,[{...products[0],alternatives:[]},products[1]]);
  assert.match(FRIDGE_PROMPT,/Продукты с `low` вообще не включай/);
});
