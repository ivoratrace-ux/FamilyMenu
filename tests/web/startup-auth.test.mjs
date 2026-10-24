import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const bridge=await readFile(new URL('../../src/bridge.js',import.meta.url),'utf8');
const hydrate=bridge.slice(bridge.indexOf('  async function hydrate('),bridge.indexOf('  function showError('));
test('a rejected refresh that already cleared the API session exits loading and clears cached private data',async()=>{
 let logouts=0;
 const api={session:{user:{id:'a'}},request:async()=>{api.session=null;throw Object.assign(Error('Expired'),{status:401});}};
 const ctx=vm.createContext({api,generation:0,UI:{},render(){},payloadText:()=>'',stockText:()=>'',logout:async()=>{logouts++;ctx.UI.accountLoading=false;}});
 vm.runInContext(hydrate,ctx);await ctx.hydrate();assert.equal(logouts,1);assert.equal(ctx.UI.accountLoading,false);
});
test('a failed request from an old owner cannot log out a newly selected account',async()=>{
 let logouts=0;
 const api={session:{user:{id:'a'}},request:async()=>{api.session={user:{id:'b'}};throw Object.assign(Error('Expired'),{status:401});}};
 const ctx=vm.createContext({api,generation:0,UI:{},render(){},payloadText:()=>'',stockText:()=>'',logout:async()=>{logouts++;}});
 vm.runInContext(hydrate,ctx);await ctx.hydrate();assert.equal(logouts,0);assert.equal(api.session.user.id,'b');
});
