import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../src/bootstrap.js',import.meta.url),'utf8');
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
function start({signed=false,cached=null}={}) {
 let resolveCatalog,resolveAccount,mounts=0,removed=0,catalogCalls=0;const waits=[];
 const catalog=new Promise(r=>resolveCatalog=r),account=new Promise(r=>resolveAccount=r);
 const window={},cache={epoch:0,read:()=>cached};
 const api={session:signed?{user:{id:'a'}}:null,restore:async options=>assert.equal(options.verify,false),catalog:()=>{catalogCalls++;return catalog;}};
 const data={background:promise=>{data.promise=promise;},accountError:()=>assert.fail('unexpected account error')};
 window.FamilyMenuData=data;
 const bridge={mount:async value=>{mounts++;assert.equal(value,signed?cached:undefined);if(signed)await account;}};
 const document={querySelector:()=>null,getElementById:()=>({replaceChildren(){}}),head:{append(node){if(node.src)queueMicrotask(()=>node.onload());}},body:{append(){}},createElement:()=>({setAttribute(){},remove(){removed++;},querySelectorAll:()=>Array.from({length:3},()=>({classList:{add(){}}}))})};
 vm.runInNewContext(source,{window,document,FamilyMenuApi:api,FamilyMenuCache:cache,FamilyMenuData:data,FamilyMenuBridge:bridge,Date,Set,Promise,setTimeout:(fn,ms)=>{waits.push(ms);queueMicrotask(fn);}});
 return {window,data,waits,get mounts(){return mounts;},get removed(){return removed;},get catalogCalls(){return catalogCalls;},resolveCatalog,resolveAccount};
}
test('first launch mounts onboarding and removes the short splash while catalog is still pending',async()=>{
 const app=start();await settle();assert.equal(app.mounts,1);assert.equal(app.removed,1);assert.equal(app.catalogCalls,1);assert.ok(app.waits.every(ms=>ms<=700));
 assert.ok(app.data.promise,'Catalog is loading in the background');
});
test('signed-in startup never requests a full catalog and does not hold splash for account network calls',async()=>{
 const app=start({signed:true});await settle();assert.equal(app.mounts,1);assert.equal(app.removed,1);assert.equal(app.catalogCalls,0);app.resolveAccount();
});
test('a cached menu is passed to mounting before server startup completes',async()=>{
 const cached={catalog:{recipes:[],ingredients:[],foods:[],promos:[]}};
 const app=start({signed:true,cached});await settle();assert.equal(app.window.FamilyMenuCatalog,cached.catalog);assert.equal(app.removed,1);assert.equal(app.catalogCalls,0);app.resolveAccount();
});
