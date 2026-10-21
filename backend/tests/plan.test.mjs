import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, mealBudgets, validatePlan } from '../plan.mjs';
import { makePlan } from './fixtures.mjs';
test('defaults are usable and arrays are isolated between requests', () => {
  const a = normalizeSettings({}), b = normalizeSettings({});
  assert.equal(a.dailyCalories, 2000); assert.equal(a.mealsPerDay, 3); assert.equal(a.maxMinutes, 30); assert.equal(a.diet, 'regular');
  a.mealTypes.push('soup'); assert.deepEqual(b.mealTypes, ['main']);
});
test('rejects invalid controls, empty types and malformed settings', () => {
  for (const input of [null, [], { preferences:'legacy' }, { dailyCalories:999 }, { dailyCalories:3100 }, { dailyCalories:2050 }, { dailyCalories:'2000' }, { maxMinutes:11 }, { mealsPerDay:0 }, { mealsPerDay:11 }, { mealsPerDay:2.5 }, { diet:'keto' }, { diet:['vegan','vegetarian'] }, { excludedProducts:['unknown'] }, { excludedProducts:['nuts','nuts'] }, { mealTypes:[] }, { mealTypes:['unknown'] }, { customExcludedProducts:'x'.repeat(501) }]) assert.throws(() => normalizeSettings(input));
});
test('1–10 slots sum to daily calories, and every alternative combination stays within tolerance', () => {
  for (const dailyCalories of [1000, 2000, 3000]) for (let mealsPerDay=1; mealsPerDay<=10; mealsPerDay++) {
    const settings = normalizeSettings({dailyCalories,mealsPerDay});
    const budgets = mealBudgets(settings);
    assert.equal(budgets.reduce((a,b)=>a+b,0),dailyCalories);
    const plan=makePlan(settings);
    plan.meals.forEach(meal => { meal.options[0].calories=Math.ceil(meal.targetCalories*.9); meal.options[2].calories=Math.floor(meal.targetCalories*1.1); });
    validatePlan(plan,settings);
    const min=plan.meals.reduce((sum,meal)=>sum+Math.min(...meal.options.map(d=>d.calories)),0);
    const max=plan.meals.reduce((sum,meal)=>sum+Math.max(...meal.options.map(d=>d.calories)),0);
    assert.ok(min>=dailyCalories*.9); assert.ok(max<=dailyCalories*1.1);
  }
});
test('rejects wrong slot counts, alternatives, calorie budgets, times and categories', () => {
  for (const change of [p=>p.meals.pop(), p=>p.meals[0].options.pop(), p=>p.meals[0].targetCalories++, p=>p.meals[0].options[0].calories=9999, p=>p.meals[0].options[0].calories=1, p=>p.meals[0].options[0].minutes=31, p=>p.meals[0].options[0].type='soup', p=>p.meals[0].options[0].ingredients=[], p=>p.meals[0].options[1].name=p.meals[0].options[0].name]) {
    const plan=makePlan(); change(plan); assert.throws(()=>validatePlan(plan,{}), /некорректный/);
  }
});
