import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/app.mjs';
import { generateMeals as openai } from '../server/openai.mjs';
import { generateMeals as client } from '../meals.mjs';

import { normalizeSettings } from '../plan.mjs';
import { makePlan, providerResponse } from './fixtures.mjs';
const settings = normalizeSettings({diet:'vegan',excludedProducts:['peanuts']});
const plan = makePlan(settings);
async function start(t, options = {}) {
  const app = createApp({ apiKey: 'server-only-key', ...options });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  t.after(() => new Promise(resolve => { app.close(resolve); app.closeAllConnections(); }));
  return `http://127.0.0.1:${app.address().port}`;
}
const post = (base, body, extra = {}) => fetch(`${base}/api/meals`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });

test('HTTP client -> backend -> OpenAI structured request -> grouped daily plan; key stays server-side', async t => {
  const base = await start(t, { generate: args => openai({ ...args, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer server-only-key');
    const body = JSON.parse(options.body);
    assert.equal(JSON.parse(body.messages[1].content).питание, 'Веганское');
    assert.equal(body.response_format.json_schema.strict, true);
    return providerResponse(plan, JSON.parse(body.messages[1].content).текущий_приём - 1);
  } }) });
  const actual = await client({ settings, apiBaseUrl: base, fetchImpl: async (url, options) => {
    assert.ok(!JSON.stringify(options).includes('server-only-key'));
    const response = await fetch(url, options);
    assert.ok(!(await response.clone().text()).includes('server-only-key'));
    return response;
  } });
  assert.deepEqual(actual, plan);
});
test('invalid input never invokes provider', async t => {
  const base = await start(t, { generate: () => assert.fail('provider must not be called') });
  for (const body of [null, { dailyCalories:999 }, { mealsPerDay:11 }, { diet:'keto' }, { mealTypes:[] }]) assert.equal((await post(base, body)).status, 400);
  assert.equal((await fetch(`${base}/api/meals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
  assert.equal((await fetch(`${base}/api/meals`, { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await post(base, { preferences: 'x'.repeat(20000) })).status, 413);
});
test('CORS permits Pages and rejects other sites; handles preflight', async t => {
  const base = await start(t, { generate: async () => plan });
  const response = await fetch(`${base}/api/meals`, { method: 'OPTIONS', headers: { Origin: 'https://ivoratrace-ux.github.io' } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://ivoratrace-ux.github.io');
  assert.equal((await post(base, settings, { Origin: 'https://example.org' })).status, 403);
});
test('global prototype budget limits paid model calls', async t => {
  let calls = 0;
  const base = await start(t, { hourlyLimit: 3, generate: async () => { calls++; return plan; } });
  assert.equal((await post(base, settings)).status, 200);
  const response = await post(base, settings);
  assert.equal(response.status, 429);
  assert.ok(response.headers.get('Retry-After'));
  assert.equal(calls, 1);
});
test('provider failures never leak internal errors or credentials', async t => {
  const base = await start(t, { generate: async () => { throw new Error('server-only-key private provider error'); } });
  const response = await post(base, settings);
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('server-only-key'));
});
test('missing credentials report not ready and do not call model', async t => {
  const base = await start(t, { apiKey: '', generate: () => assert.fail('provider must not be called') });
  assert.equal((await fetch(`${base}/health`)).status, 503);
  assert.equal((await post(base, settings)).status, 503);
});
test('serves API metadata but never frontend assets, secrets or repository files', async t => {
  const base = await start(t);
  for (const path of ['/', '/health']) assert.equal((await fetch(base + path)).status, 200);
  for (const path of ['/.env', '/local-config.json', '/backend/server/openai.mjs', '/server/openai.mjs', '/.git/config', '/package.json', '/script.js', '/styles.css', '/plan.mjs', '/api-config.json', '/legacy/index.html']) assert.equal((await fetch(base + path)).status, 404);
});

test('backend validates provider output before exposing a plan', async t => {
  const base = await start(t, {generate:async()=>({meals:[]})});
  assert.equal((await post(base,settings)).status,502);
});

test('Supabase health performs dependency check and returns only a safe report', async t => {
  const base=await start(t,{supabase:{checkConnection:async()=>({status:'ok',database:'ok',storage:'ok'})}});
  const response=await fetch(base+'/health/supabase');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:'ok',database:'ok',storage:'ok'});
  assert.equal((await fetch(base+'/health/supabase',{method:'POST'})).status,405);
});
test('Supabase failure does not disable existing meal API or leak provider exceptions', async t => {
  const base=await start(t,{supabase:{checkConnection:async()=>{throw Error('secret');}},generate:async()=>plan});
  const response=await fetch(base+'/health/supabase');
  assert.equal(response.status,503); assert.ok(!(await response.text()).includes('secret'));
  assert.equal((await fetch(base+'/health')).status,200);
  assert.equal((await post(base,settings)).status,200);
});
