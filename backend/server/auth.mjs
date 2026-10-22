import {randomBytes} from 'node:crypto';
import { DEFAULT_SUPABASE_URL } from './supabase.mjs';

export class AuthError extends Error {
  constructor(status, code, message, retryAfter) {
    super(message); this.status = status; this.code = code; this.retryAfter = retryAfter;
  }
}
const unavailable = () => new AuthError(503, 'AUTH_UNAVAILABLE', 'Сервис входа временно недоступен. Попробуйте позже.');
export const invalidSession = () => new AuthError(401, 'INVALID_SESSION', 'Сессия недействительна. Войдите ещё раз.');

function userInfo(user) {
  if (!user || typeof user.id !== 'string' || !user.id) throw unavailable();
  const meta=user.app_metadata || {};
  return {id:user.id,application:meta.login_application || 'legacy',providerUserId:meta.provider_user_id || '',
    login:meta.login || '',displayName:meta.display_name || 'Пользователь'};
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
  async function request(path, { method = 'POST', body, accessToken, operation, admin = false } = {}) {
    if (!base || !apiKey?.trim()) throw new AuthError(503, 'AUTH_NOT_CONFIGURED', 'Вход пока не настроен.');
    const key=admin ? (process.env.SUPABASE_SERVICE_ROLE_KEY || apiKey) : apiKey;
    const headers = { apikey: key, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    else if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;
    let response;
    try {
      response = await fetchImpl(`${base}${path.startsWith('/rest/')?'':'/auth/v1'}${path}`, {
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
      if (operation === 'verify' && [400, 401, 403, 422].includes(response.status)) throw new AuthError(401, 'INVALID_CODE', 'Код неверен или истёк. Запросите новый код.');
      if (['refresh', 'user', 'logout'].includes(operation) && [400, 401, 403, 422].includes(response.status)) throw invalidSession();
      throw unavailable();
    }
    if (operation === 'logout') return;
    try { return await response.json(); } catch { throw unavailable(); }
  }
  return {
    async signInWithTelegram(identity) {
      // GoTrue still needs an internal address to issue its own refreshable sessions.
      // It is never displayed, mailed, used as a login, or stored in the application profile.
      const profiles=await request('/rest/v1/profiles?select=id&login_application=eq.telegram&provider_user_id=eq.'+encodeURIComponent(identity.id),{method:'GET',admin:true});
      if(!Array.isArray(profiles) || profiles.length>1)throw unavailable();
      const existing=profiles[0]?.id;
      const previous=existing ? await request('/admin/users/'+encodeURIComponent(existing),{method:'GET',admin:true}) : null;
      // Random internal addresses cannot be preclaimed through the retired public email signup flow.
      const email=previous?.email || `telegram-${randomBytes(24).toString('hex')}@auth.familymenu.invalid`;
      const result=await request('/admin/generate_link',{admin:true,body:{type:'magiclink',email}});
      if(!result?.id || !result.hashed_token || (existing && result.id!==existing)) throw unavailable();
      await request('/admin/users/'+encodeURIComponent(result.id),{method:'PUT',admin:true,body:{app_metadata:{
        ...result.app_metadata,login_application:'telegram',provider_user_id:identity.id,
        login:identity.username ? '@'+identity.username : identity.name,display_name:identity.name
      }}});
      return sessionInfo(await request('/verify',{body:{token_hash:result.hashed_token,type:result.verification_type==='signup'?'signup':'magiclink'},operation:'verify'}));
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
    }
  };
}
