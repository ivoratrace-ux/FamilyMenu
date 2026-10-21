import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseIntegration } from '../server/supabase.mjs';
const spec={swagger:'2.0',paths:{}};
const options={url:'https://project.supabase.co',apiKey:'sb_secret_test'};
test('checks authenticated database metadata and storage without writes or exposing values',async()=>{
  const requests=[];
  const integration=createSupabaseIntegration({...options,fetchImpl:async(url,config)=>{
    requests.push(url); assert.equal(config.method,undefined);
    assert.equal(config.headers.apikey,'sb_secret_test');
    assert.equal(config.headers.Authorization,undefined);
    return {ok:true,json:async()=>url.includes('/rest/')?spec:[]};
  }});
  const report=await integration.checkConnection();
  assert.deepEqual(report,{status:'ok',database:'ok',storage:'ok'});
  assert.deepEqual(requests,['https://project.supabase.co/rest/v1/','https://project.supabase.co/storage/v1/bucket']);
  assert.ok(!JSON.stringify(report).includes('sb_secret_test'));
});
test('legacy JWT keys also use bearer auth, and concurrent checks share cached work',async()=>{
  let calls=0;
  const integration=createSupabaseIntegration({...options,apiKey:'eyJ.test.signature',fetchImpl:async(url,config)=>{
    calls++; assert.equal(config.headers.Authorization,'Bearer eyJ.test.signature');
    await new Promise(resolve=>setTimeout(resolve,5));
    return {ok:true,json:async()=>url.includes('/rest/')?spec:[]};
  }});
  await Promise.all([integration.checkConnection(),integration.checkConnection()]);
  await integration.checkConnection(); assert.equal(calls,2);
});
test('missing or invalid configuration never makes network requests',async()=>{
  for (const config of [{url:'',apiKey:'test'},{url:options.url,apiKey:''},{url:'http://project.supabase.co',apiKey:'test'},{url:'https://user:password@project.supabase.co',apiKey:'test'}]) {
    const integration=createSupabaseIntegration({...config,fetchImpl:()=>assert.fail('no request')});
    assert.notEqual((await integration.checkConnection()).status,'ok');
  }
});
test('auth, permissions, malformed responses and network errors are sanitized',async()=>{
  for (const [status,expected] of [[401,'unauthorized'],[403,'forbidden'],[500,'unavailable']]) {
    const integration=createSupabaseIntegration({...options,fetchImpl:async()=>({ok:false,status})});
    assert.equal((await integration.checkConnection()).database,expected);
  }
  const malformed=createSupabaseIntegration({...options,fetchImpl:async()=>({ok:true,json:async()=>({error:'provider data'})})});
  assert.equal((await malformed.checkConnection()).database,'invalid_response');
  const failed=createSupabaseIntegration({...options,fetchImpl:async()=>{throw new Error('secret credential provider message');}});
  assert.deepEqual(await failed.checkConnection(),{status:'error',database:'unavailable',storage:'unavailable'});
});
test('dependency timeout is bounded',async()=>{
  const integration=createSupabaseIntegration({...options,timeoutMs:5,fetchImpl:(url,{signal})=>new Promise((resolve,reject)=>{
    const keepAlive=setTimeout(resolve,100);
    signal.addEventListener('abort',()=>{clearTimeout(keepAlive);reject(new DOMException('timed out','TimeoutError'));});
  })});
  assert.equal((await integration.checkConnection()).database,'timeout');
});
