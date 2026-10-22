import {createApp} from './app.mjs';
import {createSupabaseAuth} from './auth.mjs';
import {createTelegramAuth} from './telegram-auth.mjs';
const port=Number(process.env.PORT || 8000);
const auth=createSupabaseAuth(),telegram=createTelegramAuth({auth});
createApp({auth,telegram}).listen(port,'0.0.0.0',()=>console.log(`Meal API listening on port ${port}`));
if(telegram.configured) {
  const configure=()=>telegram.configureWebhook(process.env.PUBLIC_API_BASE || 'https://vibe-coding-sc04.onrender.com')
    .then(()=>console.log('Telegram webhook ready'))
    .catch(()=>{console.error('Telegram webhook configuration failed; retrying in 60 seconds');setTimeout(configure,60000).unref();});
  configure();
}
