// Shared, provider-independent contract for web and future mobile clients.
export const EXCLUSIONS = [
  ['dairy', 'Молочные продукты'], ['eggs', 'Яйца'], ['peanuts', 'Арахис'],
  ['nuts', 'Орехи'], ['fish', 'Рыба'], ['seafood', 'Морепродукты'],
  ['gluten', 'Глютен'], ['soy', 'Соя']
];
export const DIETS = [['regular', 'Обычное'], ['vegetarian', 'Вегетарианское'], ['vegan', 'Веганское']];
export const MEAL_TYPES = [['breakfast', 'Завтрак'], ['soup', 'Суп'], ['main', 'Основное'], ['salad', 'Салат'], ['snack', 'Перекус'], ['dessert', 'Десерт']];
export const TIMES = [10, 20, 30, 45, 60, 90, 120, 180];
export const DEFAULTS = Object.freeze({ dailyCalories: 2000, maxMinutes: 30, mealsPerDay: 3, diet: 'regular', excludedProducts: [], customExcludedProducts: '', mealTypes: ['main'] });

export function normalizeSettings(input) {
  const fail = message => { throw new Error(message); };
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !(key in DEFAULTS) || !Object.hasOwn(DEFAULTS, key))) fail('Некорректные настройки питания.');
  const settings = { ...DEFAULTS, ...input };
  if (!Number.isInteger(settings.dailyCalories) || settings.dailyCalories < 1000 || settings.dailyCalories > 3000 || settings.dailyCalories % 100 !== 0) fail('Выберите от 1000 до 3000 ккал с шагом 100.');
  if (!TIMES.includes(settings.maxMinutes)) fail('Выберите время приготовления из предложенных вариантов.');
  if (!Number.isInteger(settings.mealsPerDay) || settings.mealsPerDay < 1 || settings.mealsPerDay > 10) fail('Выберите от 1 до 10 приёмов пищи.');
  if (!DIETS.some(([id]) => id === settings.diet)) fail('Выберите обычное, вегетарианское или веганское питание.');
  for (const [key, catalog, required] of [['excludedProducts', EXCLUSIONS, false], ['mealTypes', MEAL_TYPES, true]]) {
    const values = settings[key];
    if (!Array.isArray(values) || values.length > catalog.length || (required && !values.length) || values.some(value => !catalog.some(([id]) => id === value)) || new Set(values).size !== values.length) fail(key === 'mealTypes' ? 'Выберите хотя бы один тип блюд.' : 'Проверьте список стоп-продуктов.');
    settings[key] = [...values];
  }
  if (typeof settings.customExcludedProducts !== 'string' || settings.customExcludedProducts.length > 500) fail('Свои стоп-продукты: не больше 500 символов.');
  settings.customExcludedProducts = settings.customExcludedProducts.trim();
  return settings;
}
export function mealBudgets(settings) {
  const base = Math.floor(settings.dailyCalories / settings.mealsPerDay);
  return Array.from({ length: settings.mealsPerDay }, (_, index) => base + (index < settings.dailyCalories % settings.mealsPerDay ? 1 : 0));
}
export function mealNames(count) {
  if (count === 3) return ['Завтрак', 'Обед', 'Ужин'];
  if (count === 4) return ['Завтрак', 'Обед', 'Перекус', 'Ужин'];
  return Array.from({ length: count }, (_, index) => `Приём пищи ${index + 1}`);
}
export function validatePlan(plan, input) {
  const settings = normalizeSettings(input);
  const invalid = () => { throw new Error('Сервис вернул некорректный план питания. Попробуйте ещё раз.'); };
  const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 5000;
  const list = values => Array.isArray(values) && values.length > 0 && values.length <= 30 && values.every(text);
  if (!plan || plan.dailyCalories !== settings.dailyCalories || plan.mealsPerDay !== settings.mealsPerDay || !Array.isArray(plan.meals) || plan.meals.length !== settings.mealsPerDay) invalid();
  const budgets = mealBudgets(settings);
  for (const [index, meal] of plan.meals.entries()) {
    const budget = budgets[index];
    if (!meal || !text(meal.name) || meal.targetCalories !== budget || !Array.isArray(meal.options) || meal.options.length !== 3) invalid();
    const names = new Set();
    for (const option of meal.options) {
      if (!option || !text(option.name) || !text(option.description) || !list(option.ingredients) || !list(option.steps) || !settings.mealTypes.includes(option.type) ||
          !Number.isInteger(option.calories) || option.calories < Math.ceil(budget * .9) || option.calories > Math.floor(budget * 1.1) ||
          !Number.isInteger(option.minutes) || option.minutes < 1 || option.minutes > settings.maxMinutes) invalid();
      names.add(option.name.trim().toLocaleLowerCase('ru'));
    }
    if (names.size !== 3) invalid();
  }
  return plan;
}
