import { normalizeSettings, validatePlan } from './plan.mjs';
export async function generateMeals({ settings: input, apiBaseUrl = '', fetchImpl = fetch, timeoutMs = 195000 }) {
  const settings = normalizeSettings(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${apiBaseUrl.replace(/\/$/, '')}/api/meals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings), signal: controller.signal
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('Сервис подбора пока недоступен. Попробуйте позже.'); }
    if (!response.ok) throw new Error(data.error || 'Не удалось подобрать блюда. Попробуйте позже.');
    return validatePlan(data, settings);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Подбор занял слишком много времени. Попробуйте ещё раз.');
    if (error instanceof TypeError) throw new Error('Не удалось подключиться к серверу. Проверьте интернет и попробуйте ещё раз.');
    throw error;
  } finally { clearTimeout(timer); }
}
