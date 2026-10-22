// One-time setup: subscribe the MAX bot to the backend webhook. Secrets come only from the environment.
// MESSENGER_AUTH_SECRET=... MAX_BOT_TOKEN=... MAX_BOT_NAME=... node scripts/max-subscribe.mjs [https://backend.example]
import { createMessengerAuth } from '../backend/server/messenger-auth.mjs';
const base = process.argv[2] || 'https://vibe-coding-sc04.onrender.com';
const messenger = createMessengerAuth({ auth: {} });
const path = messenger.webhookPath();
if (!path) throw Error('Set MESSENGER_AUTH_SECRET, MAX_BOT_TOKEN and MAX_BOT_NAME');
const api = new URL('/subscriptions', process.env.MAX_API_BASE || 'https://botapi.max.ru');
api.searchParams.set('access_token', process.env.MAX_BOT_TOKEN);
const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: base + path, update_types: ['bot_started', 'message_created'] }) });
console.log(response.ok ? 'MAX webhook subscribed.' : `MAX subscription failed: HTTP ${response.status}`);
process.exitCode = response.ok ? 0 : 1;
