import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../src/api.js',import.meta.url),'utf8');
const bundle=(id='a',expiresAt=4e9)=>({user:{id,application:'telegram',login:'@'+id},session:{accessToken:id+'-access',refreshToken:id+'-refresh',expiresAt}});
function api(fetchImpl,initial=bundle()) {
 const values=new Map(initial?[['family-menu-auth-v1',JSON.stringify(initial)]]:[]);
 const context=vm.createContext({window:{},fetch:fetchImpl,AbortSignal,localStorage:{getItem:k=>values.get(k) || null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},URL,Date});
 vm.runInContext(source,context);return context.window.FamilyMenuApi;
}
test('concurrent private requests share a refresh and always use the refreshed bearer',async()=>{
 let refreshes=0;
 const client=api(async(url,options)=>{
  if(url.endsWith('/me'))return Response.json({user:bundle().user});
  if(url.endsWith('/refresh')){refreshes++;await new Promise(r=>setTimeout(r,5));return Response.json({...bundle(),session:{...bundle().session,accessToken:'renewed'}});}
  assert.equal(options.headers.Authorization,'Bearer renewed');return Response.json({ok:true});
 });
 await client.restore();client.accept(bundle('a',0));await Promise.all([client.request('/api/inventory'),client.request('/api/user-state')]);assert.equal(refreshes,1);
});
test('a failed request from account A is never retried using account B credentials',async()=>{
 let resolve,calls=0;
 const client=api(async url=>{if(url.endsWith('/me'))return Response.json({user:bundle().user});calls++;return new Promise(r=>resolve=r);});
 await client.restore();const request=client.request('/api/inventory');await new Promise(r=>setImmediate(r));
 client.accept(bundle('b'));resolve(Response.json({error:'expired'},{status:401}));await assert.rejects(request,e=>e.status===401);assert.equal(calls,1);assert.equal(client.session.user.id,'b');
});
test('logout while refreshing cannot resurrect the previous account',async()=>{
 let resolve;
 const client=api(async url=>{if(url.endsWith('/me'))return Response.json({user:bundle().user});if(url.endsWith('/logout'))return new Response(null,{status:204});if(url.endsWith('/refresh'))return new Promise(r=>resolve=r);throw Error('Unexpected request');});
 await client.restore();client.accept(bundle('a',0));const request=client.request('/api/inventory');await new Promise(r=>setImmediate(r));await client.logout();resolve(Response.json(bundle()));await assert.rejects(request,e=>e.status===401);assert.equal(client.session,null);
});
test('an approved poll only installs a session after the UI accepts its current challenge',async()=>{
 const client=api(async()=>Response.json({status:'authenticated',...bundle()}),null);
 const result=await client.poll({challengeId:'challenge',pollToken:'secret'});assert.equal(client.session,null);client.accept(result);assert.equal(client.session.user.id,'a');
});

test('malformed or retired cached identities are discarded before any private request',async()=>{
 for(const initial of [{user:{id:'a',application:'telegram'}},{user:{id:'a',email:'old@example.test'},session:bundle().session}]){
  const client=api(()=>assert.fail('Invalid cached identity must not make a private request'),initial);assert.equal(await client.restore(),null);assert.equal(client.session,null);
 }
});
