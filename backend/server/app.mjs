import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createCatalogRepository } from './catalog.mjs';
import { createFridgeRouter, analyzeFridge } from './fridge.mjs';
import { generateMeals } from './openai.mjs';
import { createSupabaseIntegration } from './supabase.mjs';
import { createAuthRouter } from './auth-routes.mjs';
import { normalizeSettings, validatePlan } from '../plan.mjs';

export const FIRST_PARTY_ORIGIN = 'https://ivoratrace-ux.github.io';
export function configuredOrigins(value = process.env.ALLOWED_ORIGINS || '') {
  // Keep the new first-party client working even if Render retains its previous CORS variable.
  return [...new Set([FIRST_PARTY_ORIGIN, 'http://localhost:8080', 'http://127.0.0.1:8080',
    'http://localhost:8000', 'http://127.0.0.1:8000', ...value.split(',').map(s => s.trim()).filter(Boolean)])];
}
export function deploymentRevision(value = process.env.RENDER_GIT_COMMIT || '') {
  return /^[0-9a-f]{40}$/i.test(value) ? value : 'local';
}

export function createApp({ apiKey = process.env.OPENAI_API_KEY, allowedOrigins = configuredOrigins(), revision = deploymentRevision(), catalog = createCatalogRepository(), analyze = analyzeFridge, generate = generateMeals, hourlyLimit = 30, supabase = createSupabaseIntegration(), authRouter = createAuthRouter() } = {}) {
  const fridgeRouter = createFridgeRouter({ apiKey, analyze, hourlyLimit });
  // A deliberately small global budget for this unauthenticated single-instance prototype.
  let calls = 0, resetAt = Date.now() + 3600000, inFlight = 0;
  return http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
    };
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/api/catalog' || path === '/api/fridge/scan' || path === '/api/meals' || path === '/health' || path === '/health/supabase' || path === '/health/auth' || path.startsWith('/api/auth/')) {
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.includes(origin) && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) return send(403, { error: 'Этот сайт не подключён к API.' });
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Expose-Headers', 'Retry-After');
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (path === '/api/catalog') {
        if (req.method !== 'GET') {res.setHeader('Allow','GET, OPTIONS');return send(405,{error:'Метод не поддерживается.'});}
        try {return send(200,await catalog.load());}
        catch {return send(503,{error:'Каталог временно недоступен. Попробуйте ещё раз.'});}
      }
      if (path === '/api/fridge/scan') return fridgeRouter(req, res, send);
      if (path.startsWith('/api/auth/') || path === '/health/auth') return authRouter(req, path, send, res);
      if (path === '/health/supabase' && req.method === 'GET') {
        try {
          const report = await supabase.checkConnection();
          return send(report.status === 'ok' ? 200 : 503, report);
        } catch { return send(503, { status: 'error', database: 'unavailable', storage: 'unavailable' }); }
      }
      if (path === '/health' && req.method === 'GET') return send(apiKey ? 200 : 503, { status: apiKey ? 'ok' : 'missing_api_key', apiVersion: 2, generationMode: 'per-meal', service: 'family-menu-api', revision });
      if (path !== '/api/meals' || req.method !== 'POST') { res.setHeader('Allow', path.startsWith('/health') ? 'GET, OPTIONS' : 'POST, OPTIONS'); return send(405, { error: 'Метод не поддерживается.' }); }
      if (!apiKey) return send(503, { error: 'Сервис ещё не настроен. Попробуйте позже.' });
      if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return send(415, { error: 'Нужен запрос в формате JSON.' });
      let size = 0, chunks = [];
      try {
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16384) { send(413, { error: 'Слишком большой запрос.' }); req.resume(); return; }
          chunks.push(chunk);
        }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400, { error: 'Некорректный JSON.' }); }
        let settings;
        try { settings = normalizeSettings(body); } catch (error) { return send(400, { error: error.message }); }
        if (Date.now() >= resetAt) { calls = 0; resetAt = Date.now() + 3600000; }
        if (calls + settings.mealsPerDay > hourlyLimit || inFlight >= 2) { res.setHeader('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)))); return send(429, { error: 'Сервис достиг тестового лимита запросов. Попробуйте позже.' }); }
        calls += settings.mealsPerDay; inFlight++;
        try {
          const plan = validatePlan(await generate({ settings, apiKey }), settings);
          send(200, plan);
        } catch {
          // Provider errors can contain credentials or request data: never forward or log them.
          send(502, { error: 'Нейросеть сейчас недоступна. Попробуйте позже.' });
        } finally { inFlight--; }
      } catch { if (!res.headersSent) send(400, { error: 'Не удалось прочитать запрос.' }); }
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: 'Метод не поддерживается.' });
    const asset=path.match(/^\/assets\/art\/([a-z0-9]+(?:-step-\d+)?\.png)$/);
    if(asset) {
      try {
        const image=await readFile(new URL('../public/art/'+asset[1],import.meta.url));
        res.writeHead(200,{'Content-Type':'image/png','Content-Length':image.length,'Cache-Control':'public, max-age=86400','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'});
        return res.end(req.method==='HEAD' ? undefined : image);
      } catch {return send(404,{error:'Изображение не найдено.'});}
    }

    if (path === '/' || path === '/index.html') return send(200, {
      service: 'family-menu-api', apiVersion: 2, revision, health: '/health'
    });
    return send(404, { error: 'Не найдено.' });
  });
}
