import { AuthError, invalidSession, createSupabaseAuth } from './auth.mjs';

const routes = new Map([
  ['/api/auth/otp', 'POST'], ['/api/auth/verify', 'POST'], ['/api/auth/refresh', 'POST'],
  ['/api/auth/logout', 'POST'], ['/api/auth/me', 'GET'], ['/health/auth', 'GET']
]);
const invalid = message => new AuthError(400, 'INVALID_INPUT', message);
function emailAddress(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim())) throw invalid('Укажите корректный email.');
  return value.trim().toLowerCase();
}
function bearer(req) {
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
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowedFields.includes(key))) throw invalid('Некорректные поля запроса.');
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
export function createAuthRouter({ auth = createSupabaseAuth(), now = () => Date.now(), otpHourlyLimit = 2 } = {}) {
  const allRequests = limiter(120, 60000, now);
  const emailCooldown = limiter(1, 60000, now);
  const emailBudget = limiter(otpHourlyLimit, 3600000, now);
  const verificationAttempts = limiter(5, 60000, now);
  return async (req, path, send, res) => {
    const method = routes.get(path);
    if (!method) return send(404, { error: 'Не найдено.', code: 'NOT_FOUND' });
    if (req.method !== method) { res.setHeader('Allow', `${method}, OPTIONS`); return send(405, { error: 'Метод не поддерживается.', code: 'METHOD_NOT_ALLOWED' }); }
    try {
      allRequests('global');
      if (path === '/health/auth') {
        const report = await auth.checkConfiguration();
        return send(report.status === 'ok' ? 200 : 503, report);
      }
      if (path === '/api/auth/me') return send(200, { user: await auth.getUser(bearer(req)) });
      if (path === '/api/auth/logout') { await auth.signOut(bearer(req)); return send(204); }
      if (path === '/api/auth/refresh') {
        const body = await jsonBody(req, ['refreshToken']);
        if (typeof body.refreshToken !== 'string' || !body.refreshToken.trim() || body.refreshToken.length > 8192) throw invalid('Укажите refreshToken.');
        return send(200, await auth.refreshSession(body.refreshToken));
      }
      const body = await jsonBody(req, path === '/api/auth/otp' ? ['email'] : ['email', 'code']);
      const email = emailAddress(body.email);
      if (path === '/api/auth/otp') {
        emailCooldown(email); emailBudget('global');
        await auth.sendCode(email);
        return send(200, { message: 'Если адрес разрешён настройками проекта, письмо с кодом отправлено.', retryAfter: 60 });
      }
      if (typeof body.code !== 'string' || !/^\d{6,10}$/.test(body.code)) throw invalid('Укажите код из письма: от 6 до 10 цифр.');
      verificationAttempts(email);
      return send(200, await auth.verifyCode(email, body.code));
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
        return send(error.status, { error: error.message, code: error.code });
      }
      return send(503, { error: 'Сервис входа временно недоступен.', code: 'AUTH_UNAVAILABLE' });
    }
  };
}
