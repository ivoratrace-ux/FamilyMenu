import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server/app.mjs';
import {createVkusvillMcp,createVkusvillHealth,cartUrl,StoreError} from '../server/vkusvill-mcp.mjs';
import {buildVkusvillCart,cartIngredients,searchProducts,selectedProducts,selectStoreProducts} from '../server/store-cart.mjs';

const ingredients=[{id:'milk',name:'Молоко',unit:'ml'},{id:'potato',name:'Картофель',unit:'g'}];
const items=ingredients.map(i=>({ingredientId:i.id,name:i.name,unit:i.unit,quantity:1500}));
const product=(id=10,name='Молоко 1 л')=>({id,name,weight:'1 л',unit:'шт',price:{current:100}});
const candidates=new Map(items.map(i=>[i.ingredientId,searchProducts({products:[product()]})]));
const selected={selections:items.map(i=>({ingredientId:i.ingredientId,productId:10,quantity:2}))};

test('public MCP negotiates a session, supports SSE, and never sends OAuth or app user tokens',async()=>{
  const calls=[];
  const mcp=createVkusvillMcp({fetchImpl:async(url,options)=>{
    assert.equal(url,'https://mcp.vkusvill.ru/mcp');assert.equal(options.headers.Authorization,undefined);
    if(options.method==='DELETE')return new Response(null,{status:204});
    const body=JSON.parse(options.body);calls.push(body.method);
    if(body.method==='initialize')return Response.json({jsonrpc:'2.0',id:body.id,result:{protocolVersion:'2025-03-26'}},{headers:{'mcp-session-id':'public-session'}});
    assert.equal(options.headers['Mcp-Session-Id'],'public-session');
    if(body.method==='notifications/initialized')return new Response(null,{status:202});
    const result=body.method==='tools/list'?{tools:['vkusvill_products_search','vkusvill_cart_link_create'].map(name=>({name}))}:{content:[{type:'text',text:JSON.stringify({products:[product()]})}]};
    return new Response(': keepalive\n\ndata: '+JSON.stringify({jsonrpc:'2.0',method:'notifications/message',params:{}})+'\n\ndata: '+JSON.stringify({jsonrpc:'2.0',id:body.id,result})+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
  }});
  await mcp.connect();assert.deepEqual(await mcp.call('vkusvill_products_search',{q:'Молоко'}),{products:[product()]});await mcp.close();
  assert.deepEqual(calls,['initialize','notifications/initialized','tools/list','tools/call']);
});
test('edge 403 is a store connection failure; provider HTML is never exposed to clients',async()=>{
  const mcp=createVkusvillMcp({fetchImpl:async()=>new Response('<html>Access Blocked private details</html>',{status:403})});
  await assert.rejects(mcp.connect(),e=>e instanceof StoreError && e.status===502 && !e.message.includes('private'));
});
test('public dependency health coalesces concurrent probes and caches failures; no search, carts or model calls',async()=>{
  let connected=0,closed=0,time=0,fail=false;
  const check=createVkusvillHealth({now:()=>time,mcpFactory:()=>({connect:async()=>{connected++;if(fail)throw Error('upstream secret');},close:async()=>{closed++;}})});
  assert.deepEqual(await Promise.all([check(),check(),check()]),[true,true,true]);assert.equal(connected,1);assert.equal(closed,1);
  time=60001;fail=true;assert.equal(await check(),false);assert.equal(await check(),false);assert.equal(connected,2);
});
test('real current product IDs only; malformed search and fake/model URLs cannot enter the cart',()=>{
  assert.deepEqual(searchProducts({products:[{xml_id:10,name:'Молоко'}]}),[]);
  assert.throws(()=>searchProducts({other:[]}),StoreError);
  assert.throws(()=>selectedProducts({selections:[{...selected.selections[0],productId:'invented'},selected.selections[1]]},items,candidates),StoreError);
  assert.throws(()=>selectedProducts({selections:[selected.selections[0],selected.selections[0]]},items,candidates),StoreError);
  assert.throws(()=>selectedProducts({selections:[{...selected.selections[0],quantity:Infinity},selected.selections[1]]},items,candidates),StoreError);
  for(const url of ['https://evil.example/?share_basket=1','https://vkusvill.ru.evil.example/','https://evil@vkusvill.ru/','javascript:alert(1)'])assert.throws(()=>cartUrl({url}),StoreError);
  assert.equal(cartUrl({link:'https://vkusvill.ru/?share_basket=123'}),'https://vkusvill.ru/?share_basket=123');
  assert.equal(cartUrl('Готово: https://vkusvill.onelink.me/abc/cart'),'https://vkusvill.onelink.me/abc/cart');
  assert.equal(cartUrl({ok:true,data:{link:'https://vkusvill.ru/mobile?basket&share=68149'}}),'https://vkusvill.ru/mobile?basket&share=68149');
  assert.equal(cartUrl({message:'Готово',link:'https://vkusvill.ru/mobile?basket&share=68149'}),'https://vkusvill.ru/mobile?basket&share=68149');
});
test('catalog names and units are authoritative; invalid/duplicate ingredients fail before paid calls',()=>{
  assert.deepEqual(cartIngredients({items:[{ingredientId:'milk',quantity:1500}]},ingredients),[items[0]]);
  for(const body of [{items:[]},{items:[{ingredientId:'fake',quantity:1}]},{items:[{ingredientId:'milk',quantity:0}]},{items:[{ingredientId:'milk',quantity:NaN}]},{items:[{ingredientId:'milk',quantity:1,name:'injected'}]},{items:[{ingredientId:'milk',quantity:1},{ingredientId:'milk',quantity:2}]}])assert.throws(()=>cartIngredients(body,ingredients),StoreError);
});
test('selection uses the backend OpenAI key, keeps quantities/packaging, and requires structured complete output',async()=>{
  const data=await selectStoreProducts({items,candidates,apiKey:'server-only',signal:AbortSignal.timeout(1000),fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer server-only');
    const body=JSON.parse(options.body);assert.equal(body.response_format.json_schema.strict,true);
    const input=JSON.parse(body.messages[1].content);assert.equal(input.items[0].quantity,1500);assert.equal(input.items[0].unit,'ml');assert.equal(input.items[0].candidates[0].productId,10);
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(selected)}}]});
  }});
  assert.deepEqual(selectedProducts(data,items,candidates),[{id:10,q:4}],'Same product chosen for two ingredients is merged');
});
test('lists over 20 products stay in one basket at the current 100-product limit; URLs come exclusively from the MCP cart tool',async()=>{
  const many=Array.from({length:43},(_,n)=>({ingredientId:'i'+n,name:'Продукт '+n,unit:'g',quantity:500})),cartCalls=[];
  let closed=false;
  const result=await buildVkusvillCart({items:many,apiKey:'key',mcpFactory:()=>({connect:async()=>{},close:async()=>{closed=true;},call:async(name,args)=>{
    if(name==='vkusvill_products_search')return {products:[product(Number(args.q.split(' ').at(-1))+1)]};
    assert.ok(args.products.every(p=>Number.isSafeInteger(p.id)),'Numeric current IDs reach the MCP as numbers');
    cartCalls.push(args.products);return {url:'https://vkusvill.ru/?share_basket='+cartCalls.length};
  }}),select:async({items,candidates})=>({selections:items.map(i=>({ingredientId:i.ingredientId,productId:candidates.get(i.ingredientId)[0].productId,quantity:1}))})});
  assert.deepEqual(cartCalls.map(c=>c.length),[43]);assert.equal(result.ingredientCount,43);assert.equal(result.productCount,43);assert.equal(result.carts.length,1);assert.ok(closed);
});
test('missing products or uncertain packaging abort the whole basket; never silently drop an ingredient',async()=>{
  let created=0,closed=0;
  const factory=()=>({connect:async()=>{},close:async()=>{closed++;},call:async name=>{if(name==='vkusvill_products_search')return {products:[]};created++;}});
  await assert.rejects(buildVkusvillCart({items,apiKey:'key',mcpFactory:factory,select:()=>assert.fail('No paid selection for empty search')}),e=>e.status===422);
  assert.equal(created,0);assert.equal(closed,1);
  assert.throws(()=>selectedProducts({selections:[selected.selections[0],{ingredientId:'potato',productId:null,quantity:0}]},items,candidates),e=>e.status===422);
});
test('current IDs and quantity limits prevent old-schema fallbacks and silently truncated baskets',()=>{
  assert.deepEqual(searchProducts({ok:true,data:{products:[product(),{id:0,name:'bad'},{id:'unsafe',name:'bad'},product()]}}).map(p=>p.productId),[10]);
  assert.deepEqual(selectedProducts({selections:[{ingredientId:'milk',productId:10,quantity:0.001}]},[items[0]],candidates),[{id:10,q:0.01}]);
  assert.throws(()=>selectedProducts({selections:items.map(i=>({ingredientId:i.ingredientId,productId:10,quantity:30}))},items,candidates),e=>e.status===422);
  assert.throws(()=>selectedProducts({selections:[{ingredientId:'milk',productId:10,quantity:41}]},[items[0]],candidates),StoreError);
});
test('current live public search envelope uses data.items and HTML-encoded packaging in the name',()=>{
  const payload={ok:true,data:{meta:{q:'Молоко',personalized:false},items:[{id:36296,name:'Молоко 2,5% в бутылке, 900&nbsp;мл',unit:'шт',price:{current:100,currency:'RUB'}}]}};
  const actual=searchProducts(payload);
  assert.equal(actual[0].productId,36296);assert.equal(actual[0].name,'Молоко 2,5% в бутылке, 900 мл');assert.equal(actual[0].unit,'"шт"');
});
test('V1 does not register store cart or integration health routes, even with a valid bearer',async t=>{
  const app=createApp({apiKey:'server-only',auth:{getUser:()=>assert.fail('Disabled routes must not authenticate or call a store')},catalog:{load:()=>assert.fail('No catalog access')}});
  app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.close();app.closeAllConnections();});
  const base=`http://127.0.0.1:${app.address().port}`;
  for(const path of ['/api/stores/vkusvill/cart','/api/stores/lavka/cart','/health/vkusvill']){
    assert.equal((await fetch(base+path)).status,404);
    for(const method of ['POST','OPTIONS'])assert.equal((await fetch(base+path,{method,headers:{Authorization:'Bearer valid','Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({items:[{ingredientId:'milk',quantity:1500}],location:[37,55]})}:{})})).status,405);
  }
  assert.equal((await fetch(base+'/health')).status,200);
});
