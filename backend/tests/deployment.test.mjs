import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, configuredOrigins, deploymentRevision, FIRST_PARTY_ORIGIN } from '../server/app.mjs';

test('FamilyMenu origin is retained when Render has an existing custom CORS variable', () => {
  const origins=configuredOrigins(' https://retained.example, https://retained.example ');
  assert.ok(origins.includes(FIRST_PARTY_ORIGIN));
  assert.ok(origins.includes('https://retained.example'));
  assert.equal(origins.filter(x=>x==='https://retained.example').length,1);
  assert.ok(!origins.includes('*'));
});
test('deployment revision exposes only a full commit hash', () => {
  assert.equal(deploymentRevision('a'.repeat(40)),'a'.repeat(40));
  assert.equal(deploymentRevision('not-a-commit-or-a-secret'),'local');
  assert.equal(deploymentRevision(''),'local');
});
test('deployed API identifies its revision and handles the new scanner origin without provider calls', async t => {
  const revision='a'.repeat(40);
  const app=createApp({apiKey:'test-only-key',revision,allowedOrigins:configuredOrigins('https://retained.example'),analyze:()=>assert.fail('invalid photo must never call OpenAI')});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  t.after(()=>new Promise(resolve=>{app.close(resolve);app.closeAllConnections();}));
  const base=`http://127.0.0.1:${app.address().port}`;
  const root=await fetch(base+'/');assert.equal(root.status,200);
  assert.deepEqual(await root.json(),{service:'family-menu-api',apiVersion:2,revision,health:'/health'});
  const head=await fetch(base+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  const health=await fetch(base+'/health');assert.equal(health.status,200);assert.equal((await health.json()).revision,revision);
  const headers={Origin:FIRST_PARTY_ORIGIN,'Content-Type':'application/json'};
  const options=await fetch(base+'/api/fridge/scan',{method:'OPTIONS',headers});
  assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),FIRST_PARTY_ORIGIN);
  const invalid=await fetch(base+'/api/fridge/scan',{method:'POST',headers,body:'{}'});
  assert.equal(invalid.status,400);assert.equal(invalid.headers.get('Access-Control-Allow-Origin'),FIRST_PARTY_ORIGIN);
  assert.equal((await fetch(base+'/api/fridge/scan',{method:'OPTIONS',headers:{Origin:'https://unrelated.example'}})).status,403);
});
