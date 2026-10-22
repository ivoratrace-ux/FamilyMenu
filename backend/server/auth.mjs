import { DEFAULT_SUPABASE_URL } from './supabase.mjs';

export class AuthError extends Error {
  constructor(status, code, message, retryAfter) {
    super(message); this.status = status; this.code = code; this.retryAfter = retryAfter;
  }
}
const unavailable = () => new AuthError(503, 'AUTH_UNAVAILABLE', 'Сервис входа временно недоступен. Попробуйте позже.');
export const invalidSession = () => new AuthError(401, 'INVALID_SESSION', 'Сессия недействительна. Войдите ещё раз.');

function userInfo(user) {
  if (!user || typeof user.id !== 'string' || !user.id || typeof user.email !== 'string') throw unavailable();
  return { id: user.id, email: user.email };
}
function sessionInfo(data) {
  if (!data || typeof data.access_token !== 'string' || !data.access_token || typeof data.refresh_token !== 'string' || !data.refresh_token || !Number.isInteger(data.expires_in) || data.expires_in <= 0) throw unavailable();
  return { user: userInfo(data.user), session: {
    accessToken: data.access_token, refreshToken: data.refresh_token, tokenType: 'bearer',
    expiresIn: data.expires_in,
    expiresAt: Number.isInteger(data.expires_at) ? data.expires_at : Math.floor(Date.now() / 1000) + data.expires_in
  } };
}
export function createSupabaseAuth({ url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL, apiKey = process.env.SUPABASE_API_KEY, fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  let base;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash && ['', '/'].includes(parsed.pathname)) base = parsed.origin;
  } catch { /* Configuration errors are reported without exposing their values. */ }
  async function request(path, { method = 'POST', body, accessToken, operation } = {}) {
    if (!base || !apiKey?.trim()) throw new AuthError(503, 'AUTH_NOT_CONFIGURED', 'Вход пока не настроен.');
    const headers = { apikey: apiKey, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    else if (apiKey.split('.').length === 3) headers.Authorization = `Bearer ${apiKey}`;
    let response;
    try {
      response = await fetchImpl(`${base}/auth/v1${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs), redirect: 'error'
      });
    } catch { throw unavailable(); }
    if (!response.ok) {
      let data;
      try { data = await response.json(); } catch { data = {}; }
      const code = data?.error_code || data?.code;
      if (response.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code)) {
        throw new AuthError(429, 'AUTH_RATE_LIMITED', 'Слишком много попыток. Подождите перед повторной отправкой.', 60);
      }
      if (code === 'email_address_not_authorized') throw new AuthError(403, 'EMAIL_NOT_AUTHORIZED', 'Встроенная почта Supabase отправляет письма только участникам команды проекта.');
      if (['signup_disabled', 'email_provider_disabled', 'otp_disabled'].includes(code)) throw new AuthError(503, 'EMAIL_AUTH_DISABLED', 'Вход или регистрация по email отключены в настройках проекта.');
      if (['signup','password'].includes(operation) && [400,401,403,422].includes(response.status)) throw new AuthError(400,'INVALID_CREDENTIALS',operation==='signup'?'Не удалось зарегистрироваться. Проверьте email и пароль или войдите в существующий аккаунт.':'Неверный email или пароль.');
      if (operation === 'verify' && [400, 401, 403, 422].includes(response.status)) throw new AuthError(401, 'INVALID_CODE', 'Код неверен или истёк. Запросите новый код.');
      if (['refresh', 'user', 'logout'].includes(operation) && [400, 401, 403, 422].includes(response.status)) throw invalidSession();
      throw unavailable();
    }
    if (operation === 'logout') return;
    try { return await response.json(); } catch { throw unavailable(); }
  }
  let settingsPending, settingsCache, settingsUntil = 0;
  return {
    async signUp(email,password) {return sessionInfo(await request('/signup',{body:{email,password},operation:'signup'}));},
    async signIn(email,password) {return sessionInfo(await request('/token?grant_type=password',{body:{email,password},operation:'password'}));},
    async sendCode(email) {
      // Supabase creates a new user on the first request and signs existing users in with the same flow.
      await request('/otp', { body: { email, create_user: true }, operation: 'otp' });
    },
    async verifyCode(email, code) {
      return sessionInfo(await request('/verify', { body: { email, token: code, type: 'email' }, operation: 'verify' }));
    },
    async refreshSession(refreshToken) {
      return sessionInfo(await request('/token?grant_type=refresh_token', { body: { refresh_token: refreshToken }, operation: 'refresh' }));
    },
    async getUser(accessToken) {
      // Ask Supabase Auth to validate the JWT; never trust a locally decoded token or a client-supplied user ID.
      return userInfo(await request('/user', { method: 'GET', accessToken, operation: 'user' }));
    },
    async signOut(accessToken) {
      await request('/logout?scope=local', { accessToken, operation: 'logout' });
    },
    async checkConfiguration() {
      if (settingsCache && Date.now() < settingsUntil) return settingsCache;
      if (settingsPending) return settingsPending;
      settingsPending = (async () => {
        const data = await request('/settings', { method: 'GET', operation: 'settings' });
        if (typeof data?.external?.email !== 'boolean' || typeof data.disable_signup !== 'boolean' || typeof data.mailer_autoconfirm !== 'boolean') throw unavailable();
        settingsCache = { status: data.external.email ? 'ok' : 'email_disabled', emailEnabled: data.external.email,
          registrationEnabled: !data.disable_signup, emailConfirmationRequired: !data.mailer_autoconfirm };
        settingsUntil = Date.now() + 30000;
        return settingsCache;
      })();
      try { return await settingsPending; } finally { settingsPending = undefined; }
    }
  };
}
