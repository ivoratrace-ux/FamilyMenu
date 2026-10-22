// Sign-in with a one-time code delivered through Telegram or MAX.
//
// Telegram: the official Telegram Gateway API sends a 4-digit code to the phone number's Telegram account
// and later checks it (https://core.telegram.org/gateway/api). MAX: the user opens our bot through a deep
// link carrying a one-time challenge; the bot sends the code in the chat. In both cases the backend then
// signs the person into an ordinary Supabase Auth account whose email and password are derived with
// HMAC from MESSENGER_AUTH_SECRET, so no Supabase service key is needed and the phone is never stored.
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { AuthError } from './auth.mjs';

const CODE_TTL_SECONDS = 300;
const notConfigured = name => new AuthError(503, 'MESSENGER_AUTH_NOT_CONFIGURED', `Вход через ${name} пока не настроен.`);
const providerDown = name => new AuthError(503, 'MESSENGER_UNAVAILABLE', `${name} сейчас не отвечает. Попробуйте позже или войдите другим способом.`);
const invalidCode = () => new AuthError(401, 'INVALID_CODE', 'Код неверен или истёк. Запросите новый код.');
const invalid = message => new AuthError(400, 'INVALID_INPUT', message);

export function normalizePhone(value) {
  if (typeof value !== 'string' || value.length > 32) throw invalid('Укажите номер телефона.');
  let digits = value.replace(/[\s()+-]/g, '');
  if (!/^\d+$/.test(digits)) throw invalid('Укажите номер телефона цифрами.');
  if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (digits.length === 10 && digits.startsWith('9')) digits = '7' + digits;
  if (digits.length < 10 || digits.length > 15) throw invalid('Проверьте номер телефона.');
  return '+' + digits;
}
export function maskPhone(phone) {
  const d = phone.slice(1);
  return d.length === 11 && d.startsWith('7') ? `+7 ${d.slice(1, 4)} ***-**-${d.slice(9)}` : `+${d.slice(0, 2)}…${d.slice(-2)}`;
}
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export function createMessengerAuth({
  auth,
  secret = process.env.MESSENGER_AUTH_SECRET,
  telegramToken = process.env.TELEGRAM_GATEWAY_TOKEN,
  maxToken = process.env.MAX_BOT_TOKEN,
  maxBotName = process.env.MAX_BOT_NAME,
  maxApiBase = process.env.MAX_API_BASE || 'https://botapi.max.ru',
  emailDomain = process.env.MESSENGER_EMAIL_DOMAIN || 'users.familymenu.invalid',
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 10000
} = {}) {
  const challenges = new Map();
  const hmac = text => createHmac('sha256', secret).update(text).digest();
  const configured = { telegram: !!(secret?.trim() && telegramToken?.trim()), max: !!(secret?.trim() && maxToken?.trim() && maxBotName?.trim()) };
  const webhookSecret = () => hmac('max-webhook').toString('base64url').slice(0, 32);

  function sweep() {
    const time = now();
    for (const [id, c] of challenges) if (c.expiresAt <= time) challenges.delete(id);
    if (challenges.size > 2000) throw new AuthError(429, 'AUTH_RATE_LIMITED', 'Слишком много попыток. Подождите и повторите.', 60);
  }
  function remember(challenge) {
    sweep();
    const id = randomBytes(18).toString('base64url');
    challenges.set(id, { ...challenge, attempts: 0, expiresAt: now() + CODE_TTL_SECONDS * 1000 });
    return id;
  }
  function take(provider, challengeId, code) {
    if (typeof challengeId !== 'string' || challengeId.length > 64 || typeof code !== 'string' || !/^\d{4}$/.test(code)) throw invalid('Введите 4 цифры кода.');
    const c = challenges.get(challengeId);
    if (!c || c.provider !== provider || c.expiresAt <= now()) throw invalidCode();
    if (++c.attempts > 5) { challenges.delete(challengeId); throw invalidCode(); }
    return c;
  }
  async function session(provider, identity, display) {
    const id = hmac(`${provider}:id:${identity}`).toString('hex').slice(0, 32);
    const email = `${provider}-${id}@${emailDomain}`;
    const password = hmac(`${provider}:password:${identity}`).toString('base64url');
    let data;
    try { data = await auth.signIn(email, password); }
    catch (error) {
      if (!(error instanceof AuthError) || error.code !== 'INVALID_CREDENTIALS') throw error;
      data = await auth.signUp(email, password);
    }
    return { ...data, login: { via: provider, display } };
  }
  async function telegram(method, body) {
    let response;
    try {
      response = await fetchImpl(`https://gatewayapi.telegram.org/${method}`, {
        method: 'POST', headers: { Authorization: `Bearer ${telegramToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), redirect: 'error'
      });
    } catch { throw providerDown('Telegram'); }
    let data;
    try { data = await response.json(); } catch { throw providerDown('Telegram'); }
    if (data?.ok === true && data.result) return data.result;
    if (/PHONE_NUMBER_INVALID|PHONE_NUMBER_NOT_AVAILABLE/.test(String(data?.error))) throw invalid('На этот номер нельзя отправить код в Telegram. Проверьте номер или войдите через MAX.');
    if (/FLOOD|TOO_MANY/.test(String(data?.error))) throw new AuthError(429, 'AUTH_RATE_LIMITED', 'Слишком много попыток. Подождите и повторите.', 60);
    throw providerDown('Telegram');
  }
  async function maxSend(userId, text) {
    const url = new URL('/messages', maxApiBase);
    url.searchParams.set('user_id', String(userId));
    url.searchParams.set('access_token', maxToken);
    let response;
    try {
      response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    } catch { throw providerDown('MAX'); }
    if (!response.ok) throw providerDown('MAX');
  }

  return {
    configured,
    webhookPath: () => configured.max ? `/api/max/webhook/${webhookSecret()}` : null,
    async telegramStart(body) {
      if (!configured.telegram) throw notConfigured('Telegram');
      const phone = normalizePhone(body.phone);
      const result = await telegram('sendVerificationMessage', { phone_number: phone, code_length: 4, ttl: CODE_TTL_SECONDS });
      if (typeof result.request_id !== 'string' || !result.request_id) throw providerDown('Telegram');
      return { challengeId: remember({ provider: 'telegram', identity: phone, requestId: result.request_id }), expiresIn: CODE_TTL_SECONDS, via: 'telegram', destination: maskPhone(phone) };
    },
    async telegramVerify(body) {
      if (!configured.telegram) throw notConfigured('Telegram');
      const c = take('telegram', body.challengeId, body.code);
      const result = await telegram('checkVerificationStatus', { request_id: c.requestId, code: body.code });
      if (result?.verification_status?.status !== 'code_valid') {
        if (['code_max_attempts_exceeded', 'expired'].includes(result?.verification_status?.status)) challenges.delete(body.challengeId);
        throw invalidCode();
      }
      challenges.delete(body.challengeId);
      return session('telegram', c.identity, maskPhone(c.identity));
    },
    async maxStart() {
      if (!configured.max) throw notConfigured('MAX');
      const challengeId = remember({ provider: 'max', identity: null, code: String(randomInt(0, 10000)).padStart(4, '0') });
      return { challengeId, expiresIn: CODE_TTL_SECONDS, via: 'max', link: `https://max.ru/${encodeURIComponent(maxBotName)}?start=${challengeId}` };
    },
    async maxVerify(body) {
      if (!configured.max) throw notConfigured('MAX');
      const c = challenges.get(body.challengeId);
      if (c && c.provider === 'max' && !c.identity && c.expiresAt > now()) throw new AuthError(409, 'OPEN_BOT_FIRST', 'Откройте бота «Семейное меню» в MAX и нажмите «Начать» — он пришлёт код.');
      const taken = take('max', body.challengeId, body.code);
      if (!safeEqual(taken.code, body.code)) throw invalidCode();
      challenges.delete(body.challengeId);
      return session('max', taken.identity, 'MAX');
    },
    // MAX delivers bot updates here. The path carries an HMAC-derived secret so only MAX (which knows the
    // subscription URL) can bind a challenge to a chat.
    async maxWebhook(pathSecret, update) {
      if (!configured.max || !safeEqual(pathSecret, webhookSecret())) throw new AuthError(404, 'NOT_FOUND', 'Не найдено.');
      const type = update?.update_type;
      const payload = type === 'bot_started' ? update.payload : type === 'message_created' ? String(update.message?.body?.text || '').replace(/^\/start\s+/, '') : null;
      const userId = type === 'bot_started' ? update.user?.user_id : update.message?.sender?.user_id;
      if (typeof payload !== 'string' || !payload || userId == null) return { handled: false };
      const c = challenges.get(payload.trim());
      if (!c || c.provider !== 'max' || c.expiresAt <= now()) {
        await maxSend(userId, 'Ссылка для входа устарела. Вернитесь в приложение «Семейное меню» и нажмите «Войти через MAX» ещё раз.');
        return { handled: true };
      }
      c.identity = String(userId);
      await maxSend(userId, `Код для входа в «Семейное меню»: ${c.code}. Никому его не сообщайте. Код действует 5 минут.`);
      return { handled: true };
    }
  };
}
