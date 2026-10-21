import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMeals, parseModelPlan, buildPrompt, responseSchema } from '../server/openai.mjs';
import { normalizeSettings } from '../plan.mjs';
import { makePlan, rawPlan, providerResponse } from './fixtures.mjs';

test('server aggregates settings, exclusions and diet into prompt, with exact slot/option schema', async () => {
  const settings=normalizeSettings({ dailyCalories:1800, mealsPerDay:4, maxMinutes:20, diet:'vegan', excludedProducts:['peanuts','soy'], customExcludedProducts:'Грибы', mealTypes:['soup','salad'] });
  const expected=makePlan(settings);
  const plan=await generateMeals({settings,apiKey:'test-key',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer test-key');
    const body=JSON.parse(options.body), prompt=JSON.parse(body.messages[1].content);
    assert.equal(prompt.суточные_ккал,1800); assert.equal(prompt.питание,'Веганское');
    assert.deepEqual(prompt.исключить,['Арахис','Соя']); assert.equal(prompt.свои_стоп_продукты,'Грибы');
    assert.equal(body.response_format.json_schema.strict,true);
    const slots=body.response_format.json_schema.schema.properties.meals;
    assert.equal(slots.minItems,1); assert.equal(slots.maxItems,1);
    assert.equal(slots.items.properties.options.minItems,3);
    assert.deepEqual(slots.items.properties.options.items.properties.type.enum,['soup','salad']);
    return providerResponse(expected, prompt.текущий_приём - 1);
  }});
  assert.deepEqual(plan,expected);
});
test('schema and parser support both 1 and 10 meals, never fewer than 3 alternatives per slot', () => {
  for (const mealsPerDay of [1,10]) {
    const settings=normalizeSettings({mealsPerDay});
    assert.equal(responseSchema(settings).properties.meals.maxItems,1);
    assert.equal(parseModelPlan(rawPlan(makePlan(settings)),settings).meals.length,mealsPerDay);
    assert.equal(JSON.parse(buildPrompt(settings)).приёмов_пищи,mealsPerDay);
  }
});
test('rejects malformed or out-of-budget model output', () => {
  for (const text of ['not json','null','{}',JSON.stringify({meals:[]})]) assert.throws(()=>parseModelPlan(text,{}));
  const plan=makePlan(); plan.meals[0].options[0].calories=9999;
  assert.throws(()=>parseModelPlan(rawPlan(plan),{}),/некорректный/);
});
test('rejects missing server key before any provider call', async () => {
  await assert.rejects(generateMeals({settings:{},apiKey:'',fetchImpl:()=>assert.fail('no call')}),/ключ/);
});
test('handles provider errors, refusal, truncation, network failure and timeout', async () => {
  const args={settings:{},apiKey:'secret'};
  for (const status of [400,401,403,404,429,503]) await assert.rejects(generateMeals({...args,fetchImpl:async()=>({ok:false,status})}),error=>!error.message.includes('secret'));
  for (const payload of [{choices:[]},{choices:[{finish_reason:'length'}]},{choices:[{finish_reason:'stop',message:{refusal:'no'}}]}]) await assert.rejects(generateMeals({...args,fetchImpl:async()=>({ok:true,json:async()=>payload})}));
  await assert.rejects(generateMeals({...args,fetchImpl:async()=>{throw new TypeError('fetch');}}),/подключиться/);
  await assert.rejects(generateMeals({...args,timeoutMs:5,fetchImpl:(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('abort'))))}),/вовремя/);
});

test('generates 10 slots with bounded parallelism, preserves order and per-slot calorie bounds', async () => {
  const settings=normalizeSettings({dailyCalories:2000,mealsPerDay:10});
  const expected=makePlan(settings);
  let active=0, peak=0, calls=0;
  const actual=await generateMeals({settings,apiKey:'test',fetchImpl:async(url,options)=>{
    const body=JSON.parse(options.body), index=JSON.parse(body.messages[1].content).текущий_приём-1;
    const calorieSchema=body.response_format.json_schema.schema.properties.meals.items.properties.options.items.properties.calories;
    assert.equal(calorieSchema.minimum,180); assert.equal(calorieSchema.maximum,220);
    active++; calls++; peak=Math.max(peak,active);
    await new Promise(resolve=>setTimeout(resolve, 12-index));
    active--;
    return providerResponse(expected,index);
  }});
  assert.equal(calls,10); assert.equal(peak,3); assert.deepEqual(actual,expected);
});
