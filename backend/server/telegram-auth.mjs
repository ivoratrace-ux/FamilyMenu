import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {AuthError} from './auth.mjs';

const ttl=5*60*1000;
const invalid=()=>new AuthError(401,'INVALID_CHALLENGE','Вход истёк. Откройте Telegram ещё раз.');
const unavailable=()=>new AuthError(503,'TELEGRAM_UNAVAILABLE','Telegram сейчас недоступен. Повторите попытку.');
const digest=value=>createHash('sha256').update(value).digest();
const equal=(a,b)=>typeof a==='string' && typeof b==='string' && timingSafeEqual(digest(a),digest(b));
export function createTelegramAuth({auth,token=process.env.TELEGRAM_BOT,fetchImpl=fetch,now=()=>Date.now()}={}) {
  const challenges=new Map(),accountLocks=new Map();
  let bot,pendingBot;
  const configured=Boolean(token?.trim());
  const webhookSecret=configured?createHash('sha256').update('familymenu-telegram-webhook:'+token).digest('hex'):null;
  async function api(method,body={}) {
    if(!configured) throw new AuthError(503,'TELEGRAM_NOT_CONFIGURED','Вход через Telegram пока не настроен.');
    let response,result;
    try {
      response=await fetchImpl(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error'});
      result=await response.json();
    } catch {throw unavailable();}
    if(!response.ok || result?.ok!==true) throw unavailable();
    return result.result;
  }
  async function getBot() {
    if(bot) return bot;
    if(!pendingBot) pendingBot=api('getMe').then(value=>{
      if(!value?.is_bot || !/^[A-Za-z0-9_]{5,32}$/.test(value.username)) throw unavailable();
      bot=value;return bot;
    }).finally(()=>{pendingBot=null;});
    return pendingBot;
  }
  function sweep() {for(const [id,c] of challenges) if(c.expiresAt<=now()) challenges.delete(id);}
  function challenge(id) {sweep();const c=challenges.get(id);if(!c)throw invalid();return c;}
  async function account(identity) {
    // Serialise token exchanges for the same Telegram account: GoTrue magic links are single-use.
    const previous=accountLocks.get(identity.id) || Promise.resolve();
    const pending=previous.catch(()=>{}).then(()=>auth.signInWithTelegram(identity));
    accountLocks.set(identity.id,pending);
    try {return await pending;} finally {if(accountLocks.get(identity.id)===pending)accountLocks.delete(identity.id);}
  }
  return {
    configured,
    async configureWebhook(base) {
      const url=new URL('/api/auth/telegram/webhook',base);
      if(url.protocol!=='https:' || url.username || url.password)throw unavailable();
      await getBot();
      await api('setWebhook',{url:url.href,secret_token:webhookSecret,allowed_updates:['message','callback_query'],drop_pending_updates:false});
    },
    async start() {
      const b=await getBot();sweep();
      if(challenges.size>=1000) throw new AuthError(429,'AUTH_RATE_LIMITED','Слишком много попыток входа. Подождите.',60);
      const id=randomBytes(18).toString('base64url'),pollToken=randomBytes(32).toString('base64url');
      const code=String(randomBytes(4).readUInt32BE()%10000).padStart(4,'0');
      challenges.set(id,{expiresAt:now()+ttl,pollHash:digest(pollToken),code,status:'pending'});
      return {challengeId:id,pollToken,code,expiresIn:ttl/1000,botUrl:`https://t.me/${b.username}?start=login_${id}`};
    },
    async poll({challengeId,pollToken}) {
      if(typeof challengeId!=='string' || typeof pollToken!=='string' || pollToken.length>100)throw invalid();
      const c=challenge(challengeId);
      if(!timingSafeEqual(c.pollHash,digest(pollToken)))throw invalid();
      if(c.status!=='approved')return {status:'pending'};
      c.status='exchanging';
      try {
        const session=await account(c.identity);
        challenges.delete(challengeId);
        return {status:'authenticated',...session};
      } catch(error) {c.status='approved';throw error;}
    },
    async webhook(update,secret) {
      if(!configured || !equal(secret,webhookSecret)) throw new AuthError(401,'INVALID_WEBHOOK','Не авторизовано.');
      const message=update?.message,callback=update?.callback_query;
      const match=typeof message?.text==='string' && message.text.match(/^\/start(?:@[A-Za-z0-9_]+)? login_([A-Za-z0-9_-]{24})$/);
      if(match) {
        if(message.chat?.type!=='private' || message.from?.is_bot || message.chat.id!==message.from?.id)return;
        let c;try{c=challenge(match[1]);}catch{await api('sendMessage',{chat_id:message.chat.id,text:'Вход истёк. Вернитесь в «Семейное меню» и начните заново.'});return;}
        if(c.status!=='pending')return;
        await api('sendMessage',{chat_id:message.chat.id,text:`Вход в "Frigo".\nКод на экране приложения: ${c.code}\nПодтверждайте, только если вы сами начали вход и код совпадает.`,reply_markup:{inline_keyboard:[[{text:'Подтвердить вход',callback_data:'login:'+match[1]}]]}});
        return;
      }
      if(!callback || typeof callback.data!=='string' || !/^login:[A-Za-z0-9_-]{24}$/.test(callback.data))return;
      if(callback.message?.chat?.type!=='private' || callback.message.chat.id!==callback.from?.id || callback.from.is_bot)return;
      let c;try{c=challenge(callback.data.slice(6));}catch{await api('answerCallbackQuery',{callback_query_id:callback.id,text:'Вход истёк. Начните заново.'});return;}
      const u=callback.from;
      if(!Number.isSafeInteger(u.id) || u.id<=0 || typeof u.first_name!=='string')return;
      // Only trusted Telegram webhook data supplies identity; clients cannot submit a user ID.
      if(c.status==='pending') {
        c.identity={id:String(u.id),username:typeof u.username==='string' && /^[A-Za-z0-9_]{1,32}$/.test(u.username)?u.username:null,
          name:[u.first_name,u.last_name].filter(x=>typeof x==='string').join(' ').slice(0,128)};
        c.status='approved';
      }
      await api('answerCallbackQuery',{callback_query_id:callback.id,text:'Вход подтверждён. Вернитесь в приложение.'});
    }
  };
}
