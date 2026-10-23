import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../legacy/disabled-stores.js',import.meta.url),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function setup() {
  const calls=[],navigated=[],prior=[],notices=[];
  let resolve,reject;
  const shopping=[{k:'milk',toBuy:1500},{k:'eggs',toBuy:2,bought:true},{k:'potato',toBuy:0,covered:true}];
  const api={session:{user:{id:'a'}},request:(path,options)=>{calls.push({path,options});return new Promise((r,j)=>{resolve=r;reject=j;});}};
  const geo={getCurrentPosition:success=>success({coords:{longitude:37.615,latitude:55.757}})};
  const ctx=vm.createContext({navigator:{geolocation:geo},FamilyMenuApi:api,FamilyMenuBridge:{logout:()=>{api.session=null;}},S:{store:'vv'},URL,window:{open:(...args)=>navigated.push(args)},shopping:()=>({items:shopping}),render:()=>{},esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),toast:text=>notices.push(text),act:(...args)=>prior.push(args)});
  vm.runInContext(source,ctx);
  return {ctx,api,calls,navigated,prior,notices,shopping,resolve:value=>resolve(value),reject:error=>reject(error),geo,card:(store)=>ctx.window.FamilyMenuStores.card(store),click:()=>ctx.act('vkusvillCart')};
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
test('both existing cart actions use real store integrations',async()=>{
  const f=setup();f.ctx.act('cartStart');assert.equal(f.calls.length,1);assert.equal(f.prior.length,0);f.resolve(response);await tick();
  f.ctx.S.store='lavka';f.ctx.act('cartStart');await tick();assert.equal(f.prior.length,0);assert.equal(f.calls[1].path,'/api/stores/lavka/cart');assert.deepEqual(JSON.parse(JSON.stringify(f.calls[1].options.body.location)),[37.615,55.757]);
});

const lavka={store:'lavka',carts:[{url:'https://lavka.yandex.ru/cart?sharedCartId=fcff2c28-0215-4691-89b5-cf7619580282&countryCode=RU'}]};
test('Lavka has Beta, waits for location and basket, and reveals a separate safe button without navigating',async()=>{
 const f=setup();let located;f.geo.getCurrentPosition=success=>{located=success;};
 assert.match(f.card('lavka'),/Beta/);f.ctx.act('lavkaCart');assert.equal(f.calls.length,0);assert.match(f.card('lavka'),/Определяем местоположение/);assert.doesNotMatch(f.card('lavka'),/data-store-cart-link/);
 located({coords:{longitude:30.3,latitude:59.9}});await tick();assert.equal(f.calls.length,1);assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].options.body.location)),[30.3,59.9]);
 f.resolve(lavka);await tick();assert.match(f.card('lavka'),/Добавить в корзину/);assert.equal(f.navigated.length,0);assert.doesNotMatch(f.card('vkusvill'),/data-store-cart-link/);
});
test('denied location never calls backend; retry can create a basket',async()=>{
 const f=setup();f.geo.getCurrentPosition=(success,fail)=>fail({code:1});f.ctx.act('lavkaCart');await tick();assert.equal(f.calls.length,0);assert.match(f.card('lavka'),/Разрешите доступ/);
 f.geo.getCurrentPosition=success=>success({coords:{longitude:37,latitude:55}});f.ctx.act('lavkaCart');await tick();assert.equal(f.calls.length,1);f.resolve(lavka);await tick();assert.match(f.card('lavka'),/data-store-cart-link/);
});
test('store basket states are independent and reject links belonging to another store',async()=>{
 const f=setup();f.click();f.resolve(response);await tick();f.ctx.act('lavkaCart');await tick();f.resolve(response);await tick();assert.match(f.card('lavka'),/Не удалось получить ссылку/);assert.match(f.card('vkusvill'),/data-store-cart-link/);
 f.ctx.act('lavkaCart');await tick();f.resolve(lavka);await tick();assert.equal((f.card().match(/data-store-cart-link/g)||[]).length,2);
 f.shopping[0].toBuy=2000;assert.doesNotMatch(f.card(),/data-store-cart-link/);
});
test('logout during geolocation prevents a late request and stale links',async()=>{
 const f=setup();let located;f.geo.getCurrentPosition=success=>{located=success;};f.ctx.act('lavkaCart');f.ctx.act('logout');located({coords:{longitude:37,latitude:55}});await tick();assert.equal(f.calls.length,0);assert.doesNotMatch(f.card(),/data-store-cart-link/);
});
