import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../src/data-loader.js',import.meta.url),'utf8');
const ingredient={id:'rice',name:'Рис',unit:'g',category:'Бакалея',price:1,nutrition:[350,7,1,70]};
function setup(){
 let calls=0,resolve;
 const window={},ING={};
 const context={window,ING,AVG8:{},LAVKA:{},RBY:{},R:[],FOODS:[],VV_PROMO:[],DISLIKE_POPULAR:[],CATALOG:{ingredients:[],recipes:[]},render(){},AbortSignal,
  fetch:()=>{calls++;return new Promise(r=>resolve=r);}};
 vm.runInNewContext(source,context);
 return {data:window.FamilyMenuData,ING,get calls(){return calls;},reply:(status=200)=>resolve(Response.json({ingredients:[ingredient]},{status}))};
}
test('opening pantry during background prefetch shares one request; loaded ingredients need no further request',async()=>{
 const app=setup(),background=app.data.ingredients(),opening=app.data.ingredients();assert.equal(app.calls,1);assert.equal(app.data.ingredientsComplete,false);
 app.reply();await Promise.all([background,opening]);assert.equal(app.data.ingredientsComplete,true);assert.equal(app.ING.rice[0],'Рис');
 await app.data.ingredients();assert.equal(app.calls,1);
});
test('failed background prefetch can be retried when pantry opens',async()=>{
 const app=setup(),background=app.data.ingredients().catch(()=>{});app.reply(503);await background;assert.equal(app.data.ingredientsComplete,false);
 const opening=app.data.ingredients();assert.equal(app.calls,2);app.reply();await opening;assert.equal(app.data.ingredientsComplete,true);
});
test('logout discards an in-flight prefetch and allows the next account to load again',async()=>{
 const app=setup(),background=app.data.ingredients();app.data.reset();app.reply();await background;
 assert.deepEqual(app.ING,{});assert.equal(app.data.ingredientsComplete,false);
 const next=app.data.ingredients();assert.equal(app.calls,2);app.reply();await next;assert.equal(app.data.ingredientsComplete,true);
});
