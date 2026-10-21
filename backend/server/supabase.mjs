// Server-only, read-only Supabase connectivity checks. Never return provider bodies or keys.
export const DEFAULT_SUPABASE_URL = 'https://ssahtncunusgptkrkxkj.supabase.co';
export function createSupabaseIntegration({ url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL, apiKey = process.env.SUPABASE_API_KEY, fetchImpl = fetch, timeoutMs = 8000, cacheMs = 30000 } = {}) {
  let base;
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) throw Error('invalid');
      base = parsed.origin;
    } catch { /* Report configuration errors without including the original value. */ }
  }
  let cached, expires = 0, pending;
  async function checkService(path, accept, kind) {
    const headers = { apikey: apiKey, Accept: accept };
    // Legacy anon/service_role keys are JWTs. New sb_* keys are API keys, not bearer JWTs.
    if (apiKey.split('.').length === 3) headers.Authorization = `Bearer ${apiKey}`;
    try {
      const response = await fetchImpl(`${base}${path}`, { headers, signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        if (response.status === 401) return 'unauthorized';
        if (response.status === 403) return 'forbidden';
        return 'unavailable';
      }
      let data;
      try { data = await response.json(); } catch { return 'invalid_response'; }
      if (kind === 'database') return data && typeof data === 'object' && data.paths && (typeof data.swagger === 'string' || typeof data.openapi === 'string') ? 'ok' : 'invalid_response';
      return Array.isArray(data) ? 'ok' : 'invalid_response';
    } catch (error) { return ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'unavailable'; }
  }
  return {
    async checkConnection() {
      if (!url?.trim() || !apiKey?.trim()) return { status: 'not_configured', missing: [...(!url?.trim() ? ['SUPABASE_URL'] : []), ...(!apiKey?.trim() ? ['SUPABASE_API_KEY'] : [])], database: 'not_checked', storage: 'not_checked' };
      if (!base) return { status: 'invalid_configuration', database: 'not_checked', storage: 'not_checked' };
      if (cached && Date.now() < expires) return cached;
      if (pending) return pending;
      pending = (async () => {
        const [database, storage] = await Promise.all([
          checkService('/rest/v1/', 'application/openapi+json', 'database'),
          checkService('/storage/v1/bucket', 'application/json', 'storage')
        ]);
        cached = { status: database === 'ok' && storage === 'ok' ? 'ok' : 'error', database, storage };
        expires = Date.now() + cacheMs;
        return cached;
      })();
      try { return await pending; } finally { pending = undefined; }
    }
  };
}
