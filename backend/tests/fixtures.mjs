import { normalizeSettings, mealBudgets, mealNames } from '../plan.mjs';
export function makePlan(input = {}) {
  const s = normalizeSettings(input), budgets = mealBudgets(s), names = mealNames(s.mealsPerDay);
  return { dailyCalories: s.dailyCalories, mealsPerDay: s.mealsPerDay,
    meals: budgets.map((targetCalories, index) => ({ name: names[index], targetCalories,
      options: Array.from({ length: 3 }, (_, option) => ({ name: `Блюдо ${index + 1}.${option + 1}`, description: 'С овощами', type: s.mealTypes[option % s.mealTypes.length], calories: targetCalories, minutes: Math.min(20, s.maxMinutes), ingredients: ['Морковь 100 г'], steps: ['Приготовить овощи.'] }))
    })) };
}
export const rawPlan = plan => JSON.stringify({ meals: plan.meals.map(({ options }) => ({ options })) });
export const providerResponse = (plan, slotIndex) => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: rawPlan(Number.isInteger(slotIndex) ? { meals: [plan.meals[slotIndex]] } : plan) } }] }) });
