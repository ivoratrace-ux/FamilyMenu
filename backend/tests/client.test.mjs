import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMeals } from '../meals.mjs';
import { makePlan } from './fixtures.mjs';
test('client sends structured settings and no API key, validates grouped results', async () => {
  const result=await generateMeals({ settings:{diet:'vegetarian'}, apiBaseUrl:'https://example.test/', fetchImpl:async(url,options)=>{
    assert.equal(url,'https://example.test/api/meals');
    const settings=JSON.parse(options.body); assert.equal(settings.diet,'vegetarian'); assert.equal(settings.dailyCalories,2000);
    assert.ok(!JSON.stringify(options).includes('apiKey'));
    return {ok:true,json:async()=>makePlan(settings)};
  }});
  assert.equal(result.meals.length,3); assert.equal(result.meals[0].options.length,3);
});
test('client rejects invalid settings before making requests', async () => {
  for (const settings of [null,{mealsPerDay:11},{mealTypes:[]}]) await assert.rejects(generateMeals({settings,fetchImpl:()=>assert.fail('no request')}));
});
test('client handles backend errors, invalid JSON, invalid plan, network and timeout', async () => {
  await assert.rejects(generateMeals({settings:{},fetchImpl:async()=>({ok:false,json:async()=>({error:'Тестовый лимит'})})}),/Тестовый лимит/);
  await assert.rejects(generateMeals({settings:{},fetchImpl:async()=>({ok:true,json:async()=>({meals:[]})})}),/некорректный/);
  await assert.rejects(generateMeals({settings:{},fetchImpl:async()=>({json:async()=>{throw Error('html');}})}),/недоступен/);
  await assert.rejects(generateMeals({settings:{},fetchImpl:async()=>{throw new TypeError('fetch');}}),/подключиться/);
  await assert.rejects(generateMeals({settings:{},timeoutMs:5,fetchImpl:(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('abort'))))}),/много времени/);
});
