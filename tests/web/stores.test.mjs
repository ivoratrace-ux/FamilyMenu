import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../src/stores.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function setup() {
  const calls=[],navigated=[],prior=[],notices=[];
  let resolve,reject;
  const shopping=[{k:'milk',toBuy:1500},{k:'eggs',toBuy:2,bought:true},{k:'potato',toBuy:0,covered:true}];
  const api={session:{user:{id:'a'}},request:(path,options)=>{calls.push({path,options});return new Promise((r,j)=>{resolve=r;reject=j;});}};
  const ctx=vm.createContext({FamilyMenuApi:api,FamilyMenuBridge:{logout:()=>{api.session=null;}},S:{store:'vv'},URL,window:{open:(...args)=>navigated.push(args)},shopping:()=>({items:shopping}),render:()=>{},esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),toast:text=>notices.push(text),act:(...args)=>prior.push(args)});
  vm.runInContext(source,ctx);
  return {ctx,api,calls,navigated,prior,notices,shopping,resolve:value=>resolve(value),reject:error=>reject(error),card:()=>ctx.window.FamilyMenuStores.card(),click:()=>ctx.act('vkusvillCart')};
}
const response={store:'vkusvill',carts:[{url:'https://vkusvill.ru/mobile?basket&share=1001',productCount:1}]};
test('generation sends remaining amounts without opening any tab, then exposes a separate Add to basket button',async()=>{
  const f=setup();f.click();assert.equal(f.calls.length,1);assert.equal(f.navigated.length,0);assert.doesNotMatch(f.card(),/data-store-cart-link/);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].options.body)),{items:[{ingredientId:'milk',quantity:1500}]});assert.equal(f.calls[0].options.timeoutMs,165000);
  assert.match(f.card(),/Формируем корзину/);f.click();assert.equal(f.calls.length,1,'Repeated click cannot create a second basket');
  f.resolve(response);await tick();assert.equal(f.navigated.length,0);assert.match(f.card(),/Добавить в корзину/);assert.doesNotMatch(f.card(),/data-act="vkusvillCart"/);assert.equal(f.prior.length,0);assert.equal(f.shopping[0].bought,undefined);assert.match(f.card(),/data-store-cart-link/);
});
test('ready button links to the complete basket after generation',async()=>{
  const f=setup();f.click();f.resolve({...response,carts:[{...response.carts[0],productCount:43}]});await tick();
  assert.equal(f.navigated.length,0);assert.match(f.card(),/Корзина готова/);assert.equal((f.card().match(/data-store-cart-link/g)||[]).length,1);assert.doesNotMatch(f.card(),/20 товаров|разделён/);
});
test('failures permit retry and never expose arbitrary URLs',async()=>{
  const f=setup();f.click();f.resolve({...response,carts:[{url:'https://evil.example/cart'}]});await tick();assert.equal(f.navigated.length,0);assert.match(f.card(),/Не удалось получить ссылку/);
  f.click();assert.equal(f.calls.length,2);f.reject(new Error('ВкусВилл недоступен'));await tick();assert.match(f.card(),/ВкусВилл недоступен/);
});
test('logout, account switch, and changed shopping lists cannot expose a stale private cart',async()=>{
  for(const change of [f=>f.ctx.act('logout'),f=>{f.api.session={user:{id:'b'}};},f=>{f.shopping[0].toBuy=2000;}]) {
    const f=setup();f.click();change(f);f.resolve(response);await tick();assert.equal(f.navigated.length,0);assert.doesNotMatch(f.card(),/data-store-cart-link/);
  }
});
test('existing VkusVill cart action uses the integration; other stores retain their original behavior',async()=>{
  const f=setup();f.ctx.act('cartStart');assert.equal(f.calls.length,1);assert.equal(f.prior.length,0);f.resolve(response);await tick();
  f.ctx.S.store='lavka';f.ctx.act('cartStart');assert.equal(f.prior.length,1);
});
