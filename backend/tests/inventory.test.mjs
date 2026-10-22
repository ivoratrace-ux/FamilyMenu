import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server/app.mjs';
import {createInventoryRepository,InventoryError,validateInventoryItems} from '../server/inventory.mjs';
const ingredients=[{id:'milk',name:'Молоко',unit:'ml'},{id:'cucumber',name:'Огурец',unit:'g'}];
async function setup(t) {
 let state={userEmail:'test@test.com',revision:0,items:[]};let writes=0;
 const app=createApp({catalog:{load:async()=>({ingredients})},inventory:{load:async()=>structuredClone(state),mutate:async(action,items,revision)=>{
  if(revision!==state.revision) throw new InventoryError(409,'Inventory conflict');
  for(const item of items) assert.ok(ingredients.some(i=>i.id===item.ingredientId));
  writes++;state.revision++;
  if(action==='replace') state.items=[];
  for(const item of items) {
   state.items=state.items.filter(i=>i.ingredientId!==item.ingredientId);
   if(action!=='delete') {const i=ingredients.find(i=>i.id===item.ingredientId);state.items.push({...item,name:i.name,unit:i.unit});}
  }
  return structuredClone(state);
 }}});
 app.listen(0,'127.0.0.1');await once(app,'listening');t.after(()=>{app.closeAllConnections();app.close();});
 const base=`http://127.0.0.1:${app.address().port}`;
 return {request:async(path='/api/inventory',method='GET',body,headers={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})}),writes:()=>writes};
}
test('inventory load, add, edit, delete and full replacement share only the fixed test identity',async t=>{
 const {request}=await setup(t);
 const initial=await (await request()).json();assert.deepEqual(initial,{userEmail:'test@test.com',revision:0,items:[]});
 let r=await request('/api/inventory/item','PUT',{revision:0,ingredientId:'milk',quantity:500});assert.equal(r.status,200);
 let state=await r.json();assert.equal(state.items[0].quantity,500);
 state=await (await request('/api/inventory/item','PUT',{revision:1,ingredientId:'milk',quantity:250})).json();assert.equal(state.items.length,1);assert.equal(state.items[0].quantity,250);
 state=await (await request('/api/inventory','PUT',{revision:2,items:[{ingredientId:'cucumber',quantity:300}]})).json();assert.deepEqual(state.items.map(i=>i.ingredientId),['cucumber']);
 state=await (await request('/api/inventory/item','DELETE',{revision:3,ingredientId:'cucumber'})).json();assert.deepEqual(state.items,[]);
 assert.deepEqual((await (await request()).json()),state);
});
test('stale writes, client user IDs, duplicates and invalid quantities cannot modify inventory',async t=>{
 const {request,writes}=await setup(t);
 for(const quantity of [0,-1,null,'2',1.2345,1e10]) assert.equal((await request('/api/inventory/item','PUT',{revision:0,ingredientId:'milk',quantity})).status,400);
 assert.equal((await request('/api/inventory','PUT',{revision:0,items:[{ingredientId:'milk',quantity:1},{ingredientId:'milk',quantity:2}]})).status,400);
 assert.equal((await request('/api/inventory','PUT',{revision:0,userId:'other',items:[]})).status,400);
 assert.equal((await request('/api/inventory/item','PUT',{revision:9,ingredientId:'milk',quantity:2})).status,409);
 assert.equal(writes(),0);
});
test('ingredient search requires three characters and returns dictionary units without secrets',async t=>{
 const {request}=await setup(t);
 assert.equal((await request('/api/ingredients?q=мо')).status,400);
 const r=await request('/api/ingredients?q='+encodeURIComponent('МОЛ'));assert.equal(r.status,200);assert.deepEqual(await r.json(),{ingredients:[ingredients[0]]});
 assert.deepEqual(await (await request('/api/ingredients?q=xyz')).json(),{ingredients:[]});
 const options=await request('/api/inventory','OPTIONS',undefined,{Origin:'https://ivoratrace-ux.github.io'});assert.equal(options.status,204);assert.match(options.headers.get('access-control-allow-methods'),/PUT/);assert.match(options.headers.get('access-control-allow-methods'),/DELETE/);
 assert.equal((await request('/api/inventory','GET',undefined,{Origin:'https://evil.example'})).status,403);
});
test('database repository uses scoped atomic RPC and maps conflicts without exposing provider details',async()=>{
 let body;
 const repo=createInventoryRepository({apiKey:'private',fetchImpl:async(url,opts)=>{
  assert.equal(url,'https://ssahtncunusgptkrkxkj.supabase.co/rest/v1/rpc/mutate_test_inventory');body=JSON.parse(opts.body);assert.equal(opts.headers.apikey,'private');
  return new Response(JSON.stringify({userEmail:'test@test.com',revision:1,items:[]}));
 }});
 await repo.mutate('replace',[],0);assert.deepEqual(body,{p_action:'replace',p_items:[],p_revision:0});
 const conflict=createInventoryRepository({apiKey:'private',fetchImpl:async()=>new Response(JSON.stringify({code:'40001',message:'provider private'}),{status:400})});
 await assert.rejects(conflict.mutate('replace',[],0),e=>e.status===409 && !e.message.includes('provider'));
 const httpConflict=createInventoryRepository({apiKey:'private',fetchImpl:async()=>new Response(JSON.stringify({code:'PT409',message:'Inventory version conflict'}),{status:409})});
 await assert.rejects(httpConflict.mutate('replace',[],0),e=>e.status===409);
 assert.throws(()=>validateInventoryItems([{ingredientId:'bad id',quantity:1}]));
});
