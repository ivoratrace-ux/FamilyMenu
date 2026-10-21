import { FRIDGE_PROMPT, FRIDGE_SCHEMA } from './fridge-prompt.mjs';

const MAX_IMAGE = 4 * 1024 * 1024;
export function validateImage(body) {
  if (!body || Object.keys(body).some(k => !['image', 'mimeType'].includes(k)) ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(body.mimeType) ||
      typeof body.image !== 'string' || !body.image.length || body.image.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(body.image)) throw new Error('Нужна фотография JPEG, PNG или WebP.');
  const bytes = Buffer.from(body.image, 'base64');
  if (bytes.length > MAX_IMAGE) throw new Error('Фото должно быть не больше 4 МБ.');
  const valid = body.mimeType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
    body.mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!valid) throw new Error('Содержимое файла не соответствует формату фото.');
  return body;
}
export function validateProducts(data) {
  if (!data || !Array.isArray(data.products) || data.products.length > 60) throw new Error('Invalid products');
  return { products: data.products.map(p => {
    if (!p || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 120 ||
        typeof p.amount !== 'string' || !p.amount.trim() || p.amount.length > 100 ||
        !['high', 'medium', 'low'].includes(p.confidence) ||
        !Array.isArray(p.alternatives) || p.alternatives.length > 3 ||
        p.alternatives.some(a => typeof a !== 'string' || !a.trim() || a.length > 120)) throw new Error('Invalid product');
    return { name: p.name.trim(), amount: p.amount.trim(), confidence: p.confidence,
      alternatives: p.confidence === 'high' ? [] : [...new Set(p.alternatives.map(a => a.trim()))] };
  }).filter(p => p.confidence === 'high' || (p.confidence === 'medium' && p.alternatives.length > 0)) };
}
export async function analyzeFridge({ image, mimeType, apiKey, fetchImpl = fetch, timeoutMs = 90000 }) {
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4.1-mini', max_completion_tokens: 6000,
      messages: [
        { role: 'system', content: FRIDGE_PROMPT },
        { role: 'user', content: [{ type: 'text', text: 'Какие видимые продукты можно использовать как ингредиенты? Укажи количество, уверенность и обоснованные альтернативы.' }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}`, detail: 'auto' } }] }
      ], response_format: { type: 'json_schema', json_schema: { name: 'fridge_products', strict: true,
        schema: FRIDGE_SCHEMA } }
    })
  });
  if (!response.ok) throw new Error('Provider unavailable');
  const choice = (await response.json()).choices?.[0];
  if (choice?.finish_reason !== 'stop' || choice.message?.refusal) throw new Error('Incomplete response');
  return validateProducts(JSON.parse(choice.message.content));
}
export function createFridgeRouter({ apiKey, analyze = analyzeFridge, hourlyLimit = 30 }) {
  let calls = 0, resetAt = Date.now() + 3600000, active = 0;
  return async (req, res, send) => {
    if (req.method !== 'POST') { res.setHeader('Allow','POST, OPTIONS'); return send(405,{error:'Метод не поддерживается.'}); }
    if (!apiKey) return send(503,{error:'Сервис сканирования ещё не настроен.'});
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return send(415,{error:'Нужен JSON с фотографией.'});
    if (Date.now() >= resetAt) { calls = 0; resetAt = Date.now()+3600000; }
    if (active >= 2 || calls >= hourlyLimit) { res.setHeader('Retry-After', calls >= hourlyLimit ? String(Math.max(1, Math.ceil((resetAt-Date.now())/1000))) : '60'); return send(429,{error:'Сервис занят. Попробуйте позже.'}); }
    // Reserve a slot before reading the bounded body, including slow uploads.
    active++;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 5600000) { send(413,{error:'Фото слишком большое.'}); req.resume(); return; }
        chunks.push(chunk);
      }
      let input;
      try { input = validateImage(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { return send(400,{error:'Не удалось прочитать фото. Выберите JPEG, PNG или WebP до 4 МБ.'}); }
      // Other uploads may have consumed the remaining budget while this body arrived.
      if (calls >= hourlyLimit) { res.setHeader('Retry-After',String(Math.max(1, Math.ceil((resetAt-Date.now())/1000)))); return send(429,{error:'Сервис занят. Попробуйте позже.'}); }
      calls++;
      try { send(200,validateProducts(await analyze({...input,apiKey}))); }
      catch { send(502,{error:'Не удалось проанализировать фото. Попробуйте ещё раз.'}); }
    } catch { if (!res.headersSent) send(400,{error:'Не удалось загрузить фото.'}); }
    finally { active--; }
  };
}
