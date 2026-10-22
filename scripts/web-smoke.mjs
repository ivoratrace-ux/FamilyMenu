// Exercise the restored HTML UI against the existing backend contract. No real login or paid calls.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {validateUserState} from '../backend/server/user-state.mjs';
const root=resolve(process.argv[2] || '_site'),reference=resolve('legacy'),report=resolve('build/reports/web-smoke');
await mkdir(report,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),isReference=path.startsWith('/reference/');
 const base=isReference?reference:root,prefix=isReference?'/reference/':'/FamilyMenu/';
 if(!path.startsWith(prefix)){res.writeHead(404);return res.end();}
 const file=resolve(base,path.slice(prefix.length) || 'index.html');if(!file.startsWith(base+sep)){res.writeHead(403);return res.end();}
 const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream'});res.end(data);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,profile=await mkdtemp(resolve(tmpdir(),'familymenu-classic-'));
const port=9333,chrome=spawn(process.env.CHROME_BIN || 'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-proxy-server',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
const browserLog=[],errors=[];chrome.stderr.on('data',x=>browserLog.push(x.toString()));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,send,chromeError;chrome.on('error',e=>chromeError=e);
const catalog=JSON.parse(await readFile('backend/data/catalog.seed.json','utf8'));
const documents=new Map(),stocks=new Map(['a','b'].map(id=>[id,{revision:0,userLogin:'@'+id,userApplication:'telegram',items:[]}]))
let approved=false,user='a',catalogCalls=0,searchCalls=0,privateCalls=0,refreshCalls=0,failSave=false;
const bundle=(id=user)=>({user:{id,application:'telegram',providerUserId:id,login:'@'+id,displayName:id},session:{accessToken:id+'-access',refreshToken:id+'-refresh',expiresAt:Math.floor(Date.now()/1000)+3600}});
const bodyText=`document.body.innerText`;
try {
 let pages;
 for(let n=0;n<100;n++){if(chromeError)throw chromeError;try{pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();if(pages.length)break;}catch{}await delay(100);}
 assert.ok(pages?.length,'Chrome did not start');ws=new WebSocket(pages[0].webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map();send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id;const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('CDP timeout: '+method));},30000);pending.set(requestId,r=>{clearTimeout(timer);r.error?reject(Error(JSON.stringify(r.error))):resolve(r.result)});ws.send(JSON.stringify({id:requestId,method,params}));});
 ws.onmessage=async event=>{
  const m=JSON.parse(event.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);return;}
  if(m.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(m.params.exceptionDetails));
  if(m.method!=='Fetch.requestPaused')return;
  const {request,requestId}=m.params;
  const respond=(body,status=200)=>send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Access-Control-Allow-Origin',value:base},{name:'Access-Control-Allow-Methods',value:'GET,POST,PUT,DELETE,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'content-type,authorization'},{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
  try {
   const url=new URL(request.url),path=url.pathname;
   if(url.hostname==='fonts.googleapis.com' || url.hostname==='fonts.gstatic.com'){await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/css'}],body:''});return;}
   if(request.method==='OPTIONS'){await respond(null,204);return;}
   if(path==='/api/catalog'){catalogCalls++;await respond(catalogCalls===1?{error:'Catalog retry test'}:catalog,catalogCalls===1?503:200);return;}
   const data=request.postData?JSON.parse(request.postData):{};
   if(path==='/api/auth/telegram/start'){assert.deepEqual(data,{});await respond({challengeId:'challenge',pollToken:'poll-secret',code:'4826',expiresIn:300,botUrl:'https://t.me/familymenu_test_bot?start=login_mock'});return;}
   if(path==='/api/auth/telegram/poll'){assert.equal(data.pollToken,'poll-secret');await respond(approved?{status:'authenticated',...bundle()}:{status:'pending'});return;}
   if(path==='/api/auth/refresh'){refreshCalls++;await respond(bundle(data.refreshToken.startsWith('b-')?'b':'a'));return;}
   const token=Object.entries(request.headers).find(([k])=>k.toLowerCase()==='authorization')?.[1];
   const owner=token==='Bearer a-access'?'a':token==='Bearer b-access'?'b':null;
   assert.ok(owner,'Private request must have a user bearer');
   if(path==='/api/auth/me'){await respond({user:bundle(owner).user});return;}
   if(path==='/api/auth/logout'){await respond(null,204);return;}
   privateCalls++;
   if(path==='/api/ingredients'){searchCalls++;const q=url.searchParams.get('q');assert.ok(q.length>=3);await respond({ingredients:catalog.ingredients.filter(i=>i.name.toLowerCase().includes(q.toLowerCase())).map(({id,name,unit})=>({id,name,unit}))});return;}
   if(path==='/api/user-state'){
    let document=documents.get(owner) || {revision:0,preferences:null,menu:null};
    if(request.method==='PUT'){
     validateUserState(data.preferences,data.menu);assert.equal(data.revision,document.revision);
     if(failSave){failSave=false;document={...document,revision:document.revision+1,preferences:{...document.preferences,profile:{...document.preferences.profile,budget:9000}}};documents.set(owner,document);await respond({error:'Conflict'},409);return;}
     document={...data,revision:document.revision+1};documents.set(owner,document);
    }
    await respond(document);return;
   }
   if(path==='/api/inventory'){
    let stock=stocks.get(owner);if(request.method==='PUT'){assert.equal(data.revision,stock.revision);assert.ok(!('userId' in data));stock={...stock,revision:stock.revision+1,items:data.items.map(item=>({...item,...Object.fromEntries(['name','unit'].map(k=>[k,catalog.ingredients.find(i=>i.id===item.ingredientId)[k]]))}))};stocks.set(owner,stock);}
    await respond(stock);return;
   }
   throw Error('Unexpected backend route '+path);
  }catch(error){errors.push(error.stack);await respond({error:'Mock failed'},500);}
 };
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:480,height:900,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]});
 await send('Fetch.enable',{patterns:[{urlPattern:'https://vibe-coding-sc04.onrender.com/*'},{urlPattern:'https://fonts.googleapis.com/*'},{urlPattern:'https://fonts.gstatic.com/*'}]});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async(expression,message)=>{for(let n=0;n<300;n++){if(errors.length)throw Error(errors.join('\n'));if(await evaluate(expression))return;await delay(100);}throw Error(message);};
 const click=async selector=>{console.log('UI:',selector);await wait(`!!document.querySelector(${JSON.stringify(selector)})`,'Missing '+selector);assert.ok(await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(e.disabled)return false;e.click();return true;})()`));await delay(80);};
 const fill=async(selector,value,event='input')=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);await delay(80);};
 const has=text=>`${bodyText}.includes(${JSON.stringify(text)})`;
 // Compare every intro slide with the archived original, with identical markup and layout in the same browser (screenshots are retained).
 const referenceImages=[],referenceMarkup=[],referenceLayout=[];
 await send('Page.navigate',{url:base+'/reference/'});await wait(has('Меню на неделю для всей семьи'),'Reference intro missing');
 for(let n=0;n<3;n++){await evaluate('document.fonts.ready.then(()=>true)');referenceMarkup.push(await evaluate('document.querySelector("#app").innerHTML'));referenceLayout.push(await evaluate('JSON.stringify([...document.querySelectorAll("#app *")].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}))'));referenceImages.push((await send('Page.captureScreenshot',{format:'png'})).data);await writeFile(resolve(report,'reference-'+n+'.png'),Buffer.from(referenceImages.at(-1),'base64'));if(n<2)await click('[data-act="introNext"]');}
 await send('Page.navigate',{url:base+'/FamilyMenu/'});await wait(has('Не удалось загрузить приложение'),'Catalog failure must be visible');
 await click('#app button');await wait(has('Меню на неделю для всей семьи'),'Restored intro missing');
 for(let n=0;n<3;n++){await evaluate('document.fonts.ready.then(()=>true)');const screenshot=(await send('Page.captureScreenshot',{format:'png'})).data;await writeFile(resolve(report,'intro-'+n+'.png'),Buffer.from(screenshot,'base64'));assert.equal(await evaluate('document.querySelector("#app").innerHTML'),referenceMarkup[n],'Original intro slide markup must match');assert.equal(await evaluate('JSON.stringify([...document.querySelectorAll("#app *")].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}))'),referenceLayout[n],'Original intro layout must match');if(n<2)await click('[data-act="introNext"]');}
 await click('[data-act="introSkip"]');await wait(has('Войти через Telegram'),'Telegram login missing');assert.equal(privateCalls,0);
 await click('[data-act="telegramStart"]');await wait(has('4826'),'Challenge missing');await delay(2200);assert.equal(privateCalls,0);approved=true;
 await wait(has('Для кого готовим?'),'Original onboarding did not open');
 for(let n=0;n<5;n++)await click('[data-act="qNext"]');await click('[data-act="build"]');
 await wait(`S.stage==='app' && S.plan?.days.length===7`,'Week menu did not build');
 for(let n=0;n<100 && !documents.get('a')?.menu;n++)await delay(100);assert.equal(documents.get('a').menu.days.length,7);
 await click('[data-act="approve"]');await wait('S.tab==="shop" && !!document.querySelector(".screen")','Shopping did not render');
 await click('[data-act="tab"][data-v="home"]');await wait(has('Что есть на кухне'),'Home missing');
 await fill('#pq','мо');await delay(350);assert.equal(searchCalls,0);
 await fill('#pq','мол');await wait('!!document.querySelector(\'[data-act="addP"][data-v="milk"]\')','Server ingredient suggestion missing');
 await click('[data-act="addP"][data-v="milk"]');
 for(let n=0;n<100 && stocks.get('a').items.length!==1;n++)await delay(100);assert.equal(stocks.get('a').items[0].ingredientId,'milk');
 await fill('#pqty_0','350','change');for(let n=0;n<100 && stocks.get('a').items[0]?.quantity!==350;n++)await delay(100);assert.equal(stocks.get('a').items[0].quantity,350);
 await click('[data-act="delP"]');for(let n=0;n<100 && stocks.get('a').items.length;n++)await delay(100);assert.equal(stocks.get('a').items.length,0);
 await fill('#pq','мол');await wait('!!document.querySelector(\'[data-act="addP"][data-v="milk"]\')','Suggestion missing');await click('[data-act="addP"][data-v="milk"]');
 await fill('#pqty_0','250','change');for(let n=0;n<100 && stocks.get('a').items[0]?.quantity!==250;n++)await delay(100);assert.equal(stocks.get('a').items[0].quantity,250);
 // Recipe layer and original step-by-step cooking close back into the real DOM.
 await click('[data-act="tab"][data-v="menu"]');await click('[data-act="recipe"]');await wait('!!document.querySelector(\'[data-act="cook"]\')','Recipe missing');await click('[data-act="cook"]');await wait('!!document.querySelector(\'[data-act="cclose"]\')','Cooking missing');await click('[data-act="cclose"]');await wait('!UI.cook','Cooking did not close');
 await wait('!window.FamilyMenuBridge.pending','Pending saves did not finish');
 const ownRecipe={...catalog.recipes.find(r=>r.id==='m1'),id:'own-a',name:'Личный рецепт A'};
 const saved=documents.get('a');saved.preferences.myRecipes=[ownRecipe];saved.menu.days[0].slots[0].recipeId=ownRecipe.id;saved.revision++;
 await evaluate(`(()=>{const key='family-menu-auth-v1',s=JSON.parse(localStorage.getItem(key));s.session.expiresAt=1;localStorage.setItem(key,JSON.stringify(s));})()`);
 await send('Page.reload');await wait('window.FamilyMenuBridge?.ready','Account did not restore');assert.ok(refreshCalls>0);assert.equal(await evaluate('!!RBY["own-a"]'),true,'Existing personal recipe did not load');
 await click('[data-act="tab"][data-v="home"]');await wait('document.querySelector("#pqty_0")?.value==="250"','Saved stock did not reload');
 // A stale save requires explicit reload; it must not overwrite another client.
 await click('[data-act="drawer"]');await click('[data-act="nav"][data-v="profile"]');
 failSave=true;await fill('#budget','10000');await wait(has('Данные изменились на другом устройстве'),'Conflict was not shown');await click('#sync-error button');await wait('S.profile.budget===9000','Conflict reload ignored canonical server fields');
 await click('[data-act="drawer"]');await click('[data-act="logout"]');await wait(has('Войти через Telegram'),'Logout failed');
 assert.equal(await evaluate('S.plan'),null);assert.equal(await evaluate('S.pantry.length'),0);assert.equal(await evaluate('!!RBY["own-a"]'),false,'Private recipe leaked after logout');
 approved=false;user='b';await click('[data-act="telegramStart"]');await wait(has('4826'),'Second challenge missing');approved=true;
 await wait(has('Для кого готовим?'),'Second user inherited a plan');assert.equal(stocks.get('b').items.length,0);assert.equal(await evaluate('S.pantry.length'),0);
 assert.equal(errors.length,0);console.log('PASS: original intro markup/layout parity; catalog retry; real Telegram contract; original onboarding/menu/shopping/recipes; authenticated server search and stock CRUD; refresh/reload; explicit conflict reload; account isolation. No backend writes or paid calls.');
}catch(error){
 console.error(error);if(send)try{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(report,'failure.png'),Buffer.from(r.data,'base64'));const r2=await send('Runtime.evaluate',{expression:'document.body.innerText',returnByValue:true});console.error('Screen:',r2.result.value);}catch{}
 console.log('::error title=web-smoke::'+String(error.message).replace(/\n/g,'%0A'));process.exitCode=1;
}finally{await writeFile(resolve(report,'browser.log'),browserLog.join(''));ws?.close();chrome.kill();server.close();await delay(300);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
