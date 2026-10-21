import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=(process.env.BACKEND_URL || 'https://vibe-coding-sc04.onrender.com').replace(/\/$/,'');
const parsed=new URL(base);
assert.ok(parsed.protocol==='https:' || parsed.protocol==='http:' && ['localhost','127.0.0.1'].includes(parsed.hostname));
const origin='https://ivoratrace-ux.github.io';
const response=await fetch(base+'/api/catalog',{headers:{Origin:origin},signal:AbortSignal.timeout(150000)});
assert.equal(response.status,200);
assert.equal(response.headers.get('access-control-allow-origin'),origin);
const catalog=await response.json();
const seed=JSON.parse(await readFile(new URL('../backend/data/catalog.seed.json',import.meta.url),'utf8'));
for(const group of ['recipes','ingredients']) {
 const byId=new Map(catalog[group].map(row=>[row.id,row]));
 for(const row of seed[group]) for(const [field,value] of Object.entries(row)) assert.deepEqual(byId.get(row.id)?.[field],value,`${group} ${row.id} ${field}`);
}
for(const group of ['promos','foods']) assert.deepEqual(catalog[group],seed[group]);
for(const recipe of catalog.recipes) {
 assert.ok(recipe.steps.length>0);
 assert.equal(recipe.steps.length,recipe.stepImageUrls.length);
 assert.equal(recipe.steps.length,recipe.stepSeconds.length);
 assert.equal(recipe.steps.length,recipe.stepTips.length);
}
for(const url of [catalog.recipes[0].imageUrl,catalog.recipes[0].stepImageUrls[0],catalog.recipes.at(-1).imageUrl]) {
 assert.ok(url);
 const image=await fetch(base+new URL(url).pathname,{signal:AbortSignal.timeout(30000)});
 assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
 assert.deepEqual([...new Uint8Array(await image.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
}
console.log(`Live catalog matches imported data: ${catalog.recipes.length} dishes, ${catalog.ingredients.length} ingredients; images and CORS OK.`);
