import { AuthError, invalidSession, createSupabaseAuth } from './auth.mjs';
import {createTelegramAuth} from './telegram-auth.mjs';

const routes = new Map([
  ['/api/auth/refresh','POST'],['/api/auth/logout','POST'],['/api/auth/me','GET'],['/health/auth','GET'],
  ['/api/auth/telegram/start','POST'],['/api/auth/telegram/poll','POST'],['/api/auth/telegram/webhook','POST']
]);
const invalid=message=>new AuthError(400,'INVALID_INPUT',message);
export function bearer(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || header.length > 8192 || !/^Bearer [A-Za-z0-9._~-]+$/i.test(header)) throw invalidSession();
  return header.slice(7);
}
async function jsonBody(req, allowedFields) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new AuthError(415, 'JSON_REQUIRED', 'Нужен запрос в формате JSON.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw new AuthError(413, 'BODY_TOO_LARGE', 'Слишком большой запрос.');
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw invalid('Некорректный JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || allowedFields && Object.keys(body).some(key => !allowedFields.includes(key))) throw invalid('Некорректные поля запроса.');
  return body;
}
function limiter(limit, windowMs, now) {
  const entries = new Map();
  return key => {
    const time = now();
    for (const [storedKey, entry] of entries) if (entry.until <= time) entries.delete(storedKey);
    const entry = entries.get(key) || { count: 0, until: time + windowMs };
    if (entry.count >= limit || (!entries.has(key) && entries.size >= 500)) {
      throw new AuthError(429, 'AUTH_RATE_LIMITED', 'Слишком много попыток. Подождите и повторите.', Math.max(1, Math.ceil((entry.until - time) / 1000)));
    }
    entry.count++; entries.set(key, entry);
  };
}
export function createAuthRouter({ auth = createSupabaseAuth(), now = () => Date.now(), telegram = createTelegramAuth({auth}) } = {}) {
  const allRequests=limiter(6000,60000,now);
  const starts=limiter(60,60000,now);
  return async (req, path, send, res) => {
    const method = routes.get(path);
    if (!method) return send(404, { error: 'Не найдено.', code: 'NOT_FOUND' });
    if (req.method !== method) { res.setHeader('Allow', `${method}, OPTIONS`); return send(405, { error: 'Метод не поддерживается.', code: 'METHOD_NOT_ALLOWED' }); }
    try {
      allRequests('global');
      if(path==='/health/auth') return send(telegram.configured?200:503,{status:telegram.configured?'ok':'not_configured',provider:'telegram'});
      if(path==='/api/auth/telegram/start') {await jsonBody(req,[]);starts('global');return send(200,await telegram.start());}
      if(path==='/api/auth/telegram/poll') return send(200,await telegram.poll(await jsonBody(req,['challengeId','pollToken'])));
      if(path==='/api/auth/telegram/webhook') {
        await telegram.webhook(await jsonBody(req,null),req.headers['x-telegram-bot-api-secret-token']);
        return send(200,{ok:true});
      }
      if (path === '/api/auth/me') return send(200, { user: await auth.getUser(bearer(req)) });
      if (path === '/api/auth/logout') { await auth.signOut(bearer(req)); return send(204); }
      if (path === '/api/auth/refresh') {
        const body = await jsonBody(req, ['refreshToken']);
        if (typeof body.refreshToken !== 'string' || !body.refreshToken.trim() || body.refreshToken.length > 8192) throw invalid('Укажите refreshToken.');
        return send(200, await auth.refreshSession(body.refreshToken));
      }
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
        return send(error.status, { error: error.message, code: error.code });
      }
      return send(503, { error: 'Сервис входа временно недоступен.', code: 'AUTH_UNAVAILABLE' });
    }
  };
}
