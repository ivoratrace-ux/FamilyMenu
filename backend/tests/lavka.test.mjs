import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server/app.mjs';
import {StoreError} from '../server/vkusvill-mcp.mjs';
import {selectStoreProducts} from '../server/store-cart.mjs';
import {lavkaInput,createLavkaClient,lavkaProducts,selectedLavkaProducts,buildLavkaCart} from '../server/lavka.mjs';
const location=[37.615,55.757],id='fcff2c28-0215-4691-89b5-cf7619580282';
const ingredients=[{id:'milk',name:'Молоко',unit:'ml'}],items=[{ingredientId:'milk',name:'Молоко',unit:'ml',quantity:1500}];
const product=(extra={})=>({id:'milk-id',title:'Моло\u00adко',longTitle:'Молоко',amount:'930 мл',currentPrice:98,available:true,maxAmount:9,baseStep:1,incrementStep:1,options:{pricePerCount:'1',quantityType:'unit'},...extra});
const search={cacheProducts:[product()]},candidates=new Map([['milk',lavkaProducts(search)]]);
const selection={selections:[{ingredientId:'milk',productId:'milk-id',quantity:2}]};
const products=selectedLavkaProducts(selection,items,candidates);
const cart={cartId:id,cartVersion:1,nextIdempotencyToken:'version-one',items:[],deliveryType:'eats_dispatch',deliveryTimeInfo:{kind:'on_demand'}};

test('location and canonical ingredient validation reject invalid inputs before external requests',()=>{
 const body={items:[{ingredientId:'milk',quantity:1500}],location};assert.deepEqual(lavkaInput(body,ingredients),{items,location});
 for(const point of [undefined,[],[0],['37',55],[Infinity,55],[181,55],[37,-91],[37,55,0]])assert.throws(()=>lavkaInput({...body,location:point},ingredients),e=>e.status===400);
 for(const extra of [{cookie:'private'},{items:[]},{items:[{ingredientId:'fake',quantity:1}]}])assert.throws(()=>lavkaInput({...body,...extra},ingredients),StoreError);
});
test('only available, unrestricted, unambiguous unit packs become candidates; current amount wins over stale URL',()=>{
 assert.equal(lavkaProducts(search)[0].amount,'930 мл');assert.equal(lavkaProducts(search)[0].name,'Молоко');
 for(const extra of [{available:false},{adult:true},{comingSoon:true},{requiredRestriction:'medical'},{hasModifiers:true},{options:{quantityType:'weight',pricePerCount:'1'}},{options:{quantityType:'unit',pricePerCount:'1',docsRequired:true}},{amount:''},{maxAmount:0},{incrementStep:0.5},{currentPrice:NaN}])assert.deepEqual(lavkaProducts({cacheProducts:[product(extra)]}),[]);
 assert.equal(lavkaProducts({cacheProducts:[product(),product()]}).length,1);
 assert.throws(()=>lavkaProducts({products:[]}),StoreError);
});
test('selection rejects invented IDs, fractional quantities, incomplete lists and stock overflow, merges duplicates',()=>{
 assert.equal(products[0].quantity,'2');assert.equal(products[0].price,'98');
 for(const row of [{productId:1},{productId:'invented'},{quantity:0.5},{quantity:10},{quantity:Infinity}])assert.throws(()=>selectedLavkaProducts({selections:[{...selection.selections[0],...row}]},items,candidates),StoreError);
 assert.throws(()=>selectedLavkaProducts({selections:[]},items,candidates),StoreError);
 assert.throws(()=>selectedLavkaProducts({selections:[{ingredientId:'milk',productId:null,quantity:0}]},items,candidates),e=>e.status===422);
 const more=[...items,{...items[0],ingredientId:'milk2'}],both=new Map([...candidates,['milk2',candidates.get('milk')]]);
 const rows=[selection.selections[0],{...selection.selections[0],ingredientId:'milk2'}];
 assert.equal(selectedLavkaProducts({selections:rows},more,both)[0].quantity,'4');
 assert.throws(()=>selectedLavkaProducts({selections:rows.map(r=>({...r,quantity:5}))},more,both),e=>e.status===422);
});
test('Lavka model schema uses string catalog IDs and explicit whole-pack and amount rules',async()=>{
 await selectStoreProducts({items,candidates,store:'lavka',apiKey:'backend-key',fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body);assert.deepEqual(body.response_format.json_schema.schema.properties.selections.items.properties.productId.type,['string','null']);
  assert.match(body.messages[0].content,/не используй дробное/);assert.match(body.messages[0].content,/amount/);
  assert.equal(JSON.parse(body.messages[1].content).items[0].candidates[0].maxQuantity,9);
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(selection)}}]});
 }});
});
test('anonymous client keeps CSRF and cookies per basket, uses actual coordinates and current cart version; no auth or payment',async()=>{
 let sessions=0;const calls=[];
 const fetchImpl=async(url,options)=>{
  assert.ok(url.startsWith('https://lavka.yandex.ru/'));assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,undefined);
  if(url.endsWith('/')){sessions++;return new Response('<script id="__page_props__-data">'+JSON.stringify({csrfToken:'csrf-'+sessions,authProxyCsrfToken:'proxy-'+sessions})+'</script>',{headers:{'Set-Cookie':'anonymous=session-'+sessions+'; Path=/; HttpOnly'}});}
  calls.push({url,options,body:JSON.parse(options.body)});
  assert.equal(options.headers.Cookie,'anonymous=session-1');assert.equal(options.headers['X-Csrf-Token-Bff'],'csrf-1');assert.equal(options.headers['X-Csrf-Token'],'proxy-1');
  assert.deepEqual(JSON.parse(options.body).position,{location});
  return Response.json(url.endsWith('/update')?{...cart,items:products}:url.includes('/search/')?search:cart);
 };
 const a=createLavkaClient({location,fetchImpl});await a.open();await a.retrieve();await a.search('Молоко');await a.update(cart,products);
 assert.equal(calls[2].body.idempotencyToken,'version-one');assert.equal(calls[2].body.cartVersion,1);
 const b=createLavkaClient({location,fetchImpl:async(url,options)=>{
  if(url.endsWith('/'))return fetchImpl(url,options);
  assert.equal(options.headers.Cookie,'anonymous=session-2');assert.equal(options.headers['X-Csrf-Token-Bff'],'csrf-2');return Response.json(cart);
 }});await b.open();await b.retrieve();await a.retrieve();assert.equal(sessions,2);
 assert.ok(calls.every(c=>!c.url.includes('order') && !c.url.includes('checkout')));
});
test('upstream HTML, anti-bot, missing CSRF and malformed JSON produce sanitized errors',async()=>{
 for(const response of [new Response('<html>secret captcha</html>',{status:403}),new Response('<html>secret cookies</html>')])await assert.rejects(createLavkaClient({location,fetchImpl:async()=>response}).open(),e=>e.status===502 && !e.message.includes('secret'));
 await assert.rejects(createLavkaClient({location,fetchImpl:async()=>new Response('private HTML')}).retrieve(),e=>e.status===502 && !e.message.includes('private'));
});
function client(overrides={}) {return {open:async()=>{},retrieve:async()=>cart,search:async()=>search,update:async()=>({...cart,items:products}),shared:async()=>({items:products}),...overrides};}
const build=overrides=>buildLavkaCart({items,location,apiKey:'key',select:async()=>selection,...overrides});
test('one complete basket and a verified shared link are returned only after update, without checkout',async()=>{
 let updated=0,shared=0;
 const result=await build({clientFactory:options=>{assert.deepEqual(options.location,location);return client({update:async(actual,selected)=>{updated++;assert.deepEqual(selected,products);return {...cart,items:selected};},shared:async cartId=>{shared++;assert.equal(cartId,id);return {items:products};}});}});
 assert.equal(result.store,'lavka');assert.equal(result.carts[0].url,`https://lavka.yandex.ru/cart?sharedCartId=${id}&countryCode=RU`);assert.equal(updated,1);assert.equal(shared,1);
});
test('missing stock, partial basket, nonempty guest cart or unreadable shared cart never produce a ready link',async()=>{
 for(const overrides of [{retrieve:async()=>({...cart,items:products})},{search:async()=>({cacheProducts:[]})},{update:async()=>({...cart,items:[]})},{shared:async()=>({items:[]})}])await assert.rejects(build({clientFactory:()=>client(overrides)}),StoreError);
 let called=0;await assert.rejects(build({clientFactory:()=>client({search:async()=>({cacheProducts:[]}),update:()=>{called++;}}),select:()=>assert.fail('No paid call for empty catalog')}),e=>e.status===422);assert.equal(called,0);
});
test('new endpoint requires bearer/CORS/location and shares abuse quotas with VkusVill; personal data is untouched',async t=>{
 let lavka=0,vv=0;
 const app=createApp({apiKey:'key',hourlyLimit:1,auth:{getUser:async()=>({id:'user'})},catalog:{load:async()=>({ingredients})},buildLavkaStoreCart:async args=>{lavka++;assert.deepEqual(args.location,location);return {store:'lavka'};},buildStoreCart:async()=>{vv++;return {};},inventory:{load:()=>assert.fail('No inventory access')},userState:{load:()=>assert.fail('No menu access')}});
 app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.close();app.closeAllConnections();});
 const base=`http://127.0.0.1:${app.address().port}`,path='/api/stores/lavka/cart';
 const post=(body,headers={})=>fetch(base+path,{method:'POST',headers:{Authorization:'Bearer valid','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await fetch(base+path,{method:'POST'})).status,401);
 assert.equal((await fetch(base+path,{method:'OPTIONS',headers:{Origin:'https://ivoratrace-ux.github.io'}})).status,204);
 assert.equal((await post({},{Origin:'https://evil.example'})).status,403);
 assert.equal((await post({items:[{ingredientId:'milk',quantity:1500}]})).status,400);assert.equal(lavka,0);
 assert.equal((await post({items:[{ingredientId:'milk',quantity:1500}],location})).status,200);
 assert.equal((await fetch(base+'/api/stores/vkusvill/cart',{method:'POST',headers:{Authorization:'Bearer valid','Content-Type':'application/json'},body:JSON.stringify({items:[{ingredientId:'milk',quantity:1500}]})})).status,429);
 assert.equal(lavka,1);assert.equal(vv,0);
});
