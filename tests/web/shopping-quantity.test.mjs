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
 return {fixture,item:()=>ctx.shopping().items[0],format:q=>ctx.fmtQty('food',q,true),cookFormat:q=>ctx.fmtQty('food',q),recipeQuantity:q=>ctx.recipeQuantity('food',q)};
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
test('formatting preserves actual packaging amounts and precise existing stock',()=>{
 assert.equal(setup('g').format(1),'1 г');assert.equal(setup('g').format(2),'2 г');assert.equal(setup('ml').format(1),'1 мл');
 assert.equal(setup('g').format(1001),'1,001 кг');assert.equal(setup('ml').format(1040),'1,04 л');
});

test('unpacked weights and volumes round upward to 50 and use that quantity for price and stock',()=>{
 for(const unit of ['g','ml'])for(const [needed,expected] of [[1,50],[49.8,50],[50,50],[50.001,100],[9398,9400]]){
  const s=setup(unit);s.fixture.need=needed;s.fixture.stock=0;const purchase=s.item();
  assert.equal(purchase.toBuy,expected);assert.equal(purchase.cost,expected);s.fixture.stock+=purchase.toBuy;assert.equal(s.item().covered,true);
 }
 const s=setup();s.fixture.need=9398;s.fixture.stock=0;assert.equal(s.format(s.item().toBuy),'9,4 кг');
});
test('real pack sizes stay exact and are chosen before default weight rounding',()=>{
 const s=setup('g',125);s.fixture.need=120;s.fixture.stock=0;assert.equal(s.item().toBuy,125);assert.equal(s.item().packs,1);
 s.fixture.need=126;assert.equal(s.item().toBuy,250);assert.equal(s.item().packs,2);
 const pieces=setup('шт');pieces.fixture.need=2.1;pieces.fixture.stock=0;assert.equal(pieces.item().toBuy,3);
});
test('recipe inputs and cooking displays round to the same 10 g/ml, including kilograms and small positive amounts',()=>{
 for(const unit of ['g','ml']){
  const s=setup(unit);assert.equal(s.recipeQuantity(452),450);assert.equal(s.recipeQuantity(456),460);assert.equal(s.recipeQuantity(2),10);
  assert.equal(s.cookFormat(452),unit==='g'?'450 г':'450 мл');assert.equal(s.cookFormat(1452),unit==='g'?'1,45 кг':'1,45 л');
 }
});
