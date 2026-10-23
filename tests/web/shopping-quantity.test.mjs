import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../../src/app.js',import.meta.url),'utf8');
const web=await readFile(new URL('../../src/v8.js',import.meta.url),'utf8');
function setup(unit='g',pack){
 const fixture={need:100,stock:100};
 const ctx=vm.createContext({S:{plan:{},bought:{}},ING:{food:['Food','cat',unit]},CAT_ORDER:['cat'],PACK8:pack?{food:pack}:{},
  pantryQty:()=>fixture.stock,needMap:()=>({m:{food:{qty:fixture.need,dishes:new Set(['Recipe'])}},spices:new Set()}),price:()=>1});
 vm.runInContext(app.slice(app.indexOf('function fmtQty('),app.indexOf('const unitLabel=')),ctx);
 vm.runInContext(app.slice(app.indexOf('function shopping(){'),app.indexOf('function markHave(')),ctx);
 vm.runInContext(web.slice(web.indexOf('shopping=(function(orig)'),web.indexOf('/* ---------- menu generation')),ctx);
 return {fixture,item:()=>ctx.shopping().items[0],format:q=>ctx.fmtQty('food',q,true)};
}
test('stock precision absorbs tiny float deficits instead of showing a zero purchase',()=>{
 for(const unit of ['g','ml','шт'])for(const delta of [0,1e-10,0.0002,0.0004]){
  const s=setup(unit,unit==='шт'?undefined:500);s.fixture.need+=delta;assert.equal(s.item().covered,true);assert.equal(s.item().toBuy,0);
 }
});
test('meaningful small deficits buy at least one gram, ml or item and disappear after adding stock',()=>{
 for(const unit of ['g','ml','шт'])for(const delta of [0.0006,0.001,0.2,2.4]){
  const s=setup(unit);s.fixture.need+=delta;const purchase=s.item();assert.equal(purchase.covered,false);assert.ok(purchase.toBuy>=1&&Number.isInteger(purchase.toBuy));
  s.fixture.stock+=purchase.toBuy;assert.equal(s.item().covered,true);
 }
});
test('small packed deficits buy a full package, never zero packages',()=>{
 const s=setup('g',500);s.fixture.need+=0.0006;assert.equal(s.item().packs,1);assert.equal(s.item().toBuy,500);
 s.fixture.stock+=500;assert.equal(s.item().covered,true);
});
test('small shopping amounts remain visible and larger amounts retain precision',()=>{
 assert.equal(setup('g').format(1),'1 г');assert.equal(setup('g').format(2),'2 г');assert.equal(setup('ml').format(1),'1 мл');
 assert.equal(setup('g').format(1001),'1,001 кг');assert.equal(setup('ml').format(1040),'1,04 л');
});
