import {probeLavka} from './lavka-research.mjs';
import {createApp} from './app.mjs';
import {createSupabaseAuth} from './auth.mjs';
import {createTelegramAuth} from './telegram-auth.mjs';
const port=Number(process.env.PORT || 8000);
const auth=createSupabaseAuth(),telegram=createTelegramAuth({auth});
const lavkaResearch={status:'pending'};
createApp({auth,telegram,lavkaResearch}).listen(port,'0.0.0.0',()=>{
  console.log(`Meal API listening on port ${port}`);
  probeLavka().then(result=>Object.assign(lavkaResearch,result)).catch(()=>Object.assign(lavkaResearch,{status:'error',error:{reason:'probe_failed'}}));
});
if(telegram.configured) {
  const configure=()=>telegram.configureWebhook(process.env.PUBLIC_API_BASE || 'https://vibe-coding-sc04.onrender.com')
    .then(()=>console.log('Telegram webhook ready'))
    .catch(()=>{console.error('Telegram webhook configuration failed; retrying in 60 seconds');setTimeout(configure,60000).unref();});
  configure();
}
