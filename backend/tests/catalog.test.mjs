import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile,access} from 'node:fs/promises';
import {createCatalogRepository} from '../server/catalog.mjs';
import {createApp,FIRST_PARTY_ORIGIN} from '../server/app.mjs';
import {seedSql,ART_BASE} from '../../scripts/catalog-seed.mjs';
const seed=JSON.parse(await readFile(new URL('../data/catalog.seed.json',import.meta.url)));
const doc={...seed,recipes:seed.recipes.map(r=>({...r,imageUrl:`${ART_BASE}/${r.id}.png`,stepImageUrls:r.steps.map((_,n)=>`${ART_BASE}/${r.id}-step-${n}.png`)}))};
test('import retains all recipe relations, timings, tips and image references',async()=>{
 assert.equal(seed.recipes.length,144);assert.equal(seed.ingredients.length,86);
 assert.equal(seed.recipes.reduce((n,r)=>n+r.steps.length,0),588);
 assert.equal(seed.recipes.reduce((n,r)=>n+r.ingredients.length,0),812);
 for(const r of doc.recipes) {
  assert.ok(r.steps.length>0);assert.equal(r.steps.length,r.stepSeconds.length);assert.equal(r.steps.length,r.stepTips.length);
  assert.ok(r.ingredients.every(q=>seed.ingredients.some(i=>i.id===q.id)&&q.quantity>0));
  for(const url of [r.imageUrl,...r.stepImageUrls]) await access(new URL('../public/art/'+url.split('/').at(-1),import.meta.url));
 }
 const sql=seedSql(seed);assert.ok(sql.startsWith('begin;'));assert.ok(sql.endsWith('commit;'));
 assert.ok(!sql.includes('truncate'));assert.ok(!sql.includes('delete from public.cooking_history'));
 assert.ok(seedSql({...seed,recipes:[{...seed.recipes[0],name:"Повар's рецепт"}]}).includes("Повар''s рецепт"));
});
test('catalog repository uses Supabase RPC, coalesces requests and caches only successes',async()=>{
 let calls=0;let fail=true;
 const repo=createCatalogRepository({apiKey:'server-only-key',fetchImpl:async(url,opts)=>{
  calls++;assert.equal(url,'https://ssahtncunusgptkrkxkj.supabase.co/rest/v1/rpc/get_catalog');
  assert.equal(opts.headers.apikey,'server-only-key');assert.ok(!opts.headers.Authorization);assert.equal(opts.method,'POST');
  await new Promise(r=>setTimeout(r,5));return new Response(JSON.stringify(doc),{status:fail?503:200});
 }});
 await assert.rejects(repo.load());fail=false;
 const [a,b]=await Promise.all([repo.load(),repo.load()]);assert.deepEqual(a,doc);assert.strictEqual(a,b);
 await repo.load();assert.equal(calls,2);
});
test('catalog endpoint serves database content, permits Pages CORS and masks provider failures',async t=>{
 let fail=false;
 const app=createApp({catalog:{load:async()=>{if(fail)throw Error('provider details and keys');return doc;}}});
 app.listen(0,'127.0.0.1');await once(app,'listening');
 t.after(()=>new Promise(r=>{app.close(r);app.closeAllConnections();}));
 const base=`http://127.0.0.1:${app.address().port}/api/catalog`;
 const headers={Origin:FIRST_PARTY_ORIGIN};
 const response=await fetch(base,{headers});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),FIRST_PARTY_ORIGIN);
 assert.deepEqual(await response.json(),doc);
 assert.equal((await fetch(base,{method:'OPTIONS',headers})).status,204);
 assert.equal((await fetch(base,{headers:{Origin:'https://unrelated.example'}})).status,403);
 assert.equal((await fetch(base,{method:'POST',headers})).status,405);
 fail=true;const failure=await fetch(base,{headers});assert.equal(failure.status,503);assert.ok(!(await failure.text()).includes('provider details'));
});
test('public images support HEAD and CORS without exposing arbitrary files',async t=>{
 const app=createApp();app.listen(0,'127.0.0.1');await once(app,'listening');
 t.after(()=>new Promise(r=>{app.close(r);app.closeAllConnections();}));
 const base=`http://127.0.0.1:${app.address().port}`;
 const image=await fetch(base+'/assets/art/b1.png');assert.equal(image.status,200);
 assert.equal(image.headers.get('content-type'),'image/png');assert.equal(image.headers.get('access-control-allow-origin'),'*');
 assert.deepEqual([...new Uint8Array(await image.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
 const head=await fetch(base+'/assets/art/b1-step-0.png',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 for(const path of ['/assets/art/missing.png','/assets/art/.env','/assets/art/%2e%2e%2fserver/app.mjs','/assets/art/b1.svg']) assert.equal((await fetch(base+path)).status,404);
});
