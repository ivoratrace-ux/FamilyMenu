// Exercise the v8 «Frigo» HTML UI against the existing backend contract. No real login or paid calls.
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
 const data=await readFile(file);if(path.endsWith('/'))console.log('Static HTML:',path,data.length);res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream'});res.end(data);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,profile=await mkdtemp(resolve(tmpdir(),'familymenu-classic-'));
const port=9333,chrome=spawn(process.env.CHROME_BIN || 'google-chrome',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--no-sandbox','--disable-dev-shm-usage','--no-proxy-server','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
const browserLog=[],networkLog=[],errors=[];chrome.stderr.on('data',x=>browserLog.push(x.toString()));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,send,chromeError;chrome.on('error',e=>chromeError=e);
const catalog=JSON.parse(await readFile('backend/data/catalog.seed.json','utf8'));
const documents=new Map(),stocks=new Map(['a','b'].map(id=>[id,{revision:0,userLogin:'@'+id,userApplication:'telegram',items:[]}]))
let cartCalls=0;
let approved=false,user='a',scanCalls=0,catalogCalls=0,searchCalls=0,privateCalls=0,refreshCalls=0,failSave=false;
const bundle=(id=user)=>({user:{id,application:'telegram',providerUserId:id,login:'@'+id,displayName:id},session:{accessToken:id+'-access',refreshToken:id+'-refresh',expiresAt:Math.floor(Date.now()/1000)+3600}});
const bodyText=`(document.body?.innerText || '')`;
try {
 let pages;
 for(let n=0;n<300;n++){if(chromeError)throw chromeError;try{pages=(await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter(target=>target.type==='page' && target.webSocketDebuggerUrl && !/^chrome-extension:/.test(target.url));if(pages.length)break;}catch{}await delay(100);}
 assert.ok(pages?.length,'Chrome did not start');ws=new WebSocket(pages[0].webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map();send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id;const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('CDP timeout: '+method));},30000);pending.set(requestId,r=>{clearTimeout(timer);r.error?reject(Error(JSON.stringify(r.error))):resolve(r.result)});ws.send(JSON.stringify({id:requestId,method,params}));});
 ws.onmessage=async event=>{
  const m=JSON.parse(event.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);return;}
  if(m.method==='Network.requestWillBeSent')networkLog.push({requestId:m.params.requestId,url:m.params.request.url,type:m.params.type});
  if(m.method==='Network.responseReceived')networkLog.push({url:m.params.response.url,status:m.params.response.status});
  if(m.method==='Network.loadingFailed')networkLog.push({requestId:m.params.requestId,error:m.params.errorText,type:m.params.type,blockedReason:m.params.blockedReason});
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
   if(path==='/api/stores/vkusvill/cart'){
    cartCalls++;assert.ok(data.items.length>0);assert.ok(data.items.every(i=>catalog.ingredients.some(c=>c.id===i.ingredientId) && i.quantity>0));
    await respond(cartCalls===1?{error:'ВкусВилл отклонил подключение'}:{store:'vkusvill',carts:[{url:'https://vkusvill.ru/mobile?basket&share=1001',productCount:data.items.length}],ingredientCount:data.items.length},cartCalls===1?502:200);return;
   }
   if(path==='/api/stores/lavka/cart'){
    assert.ok(data.items.length>0);assert.deepEqual(data.location,[37.615,55.757]);
    await respond({store:'lavka',carts:[{url:'https://lavka.yandex.ru/cart?sharedCartId=fcff2c28-0215-4691-89b5-cf7619580282&countryCode=RU',productCount:data.items.length}]});return;
   }
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
   if(path==='/api/fridge/scan'){scanCalls++;assert.ok(Array.isArray(data.images) && data.images.length>=1 && data.images.length<=5 && data.images.every(i=>i.mimeType==='image/jpeg' && i.image.length>100));
    await respond({products:[{ingredientId:'eggs',name:'Яйца',amount:'6 шт',confidence:'high',alternatives:[]},{ingredientId:null,name:'Овощ',amount:'около 300 г',confidence:'medium',alternatives:[{ingredientId:'cucumber',name:'Огурцы'},{ingredientId:'zucchini',name:'Кабачок'}]},{ingredientId:null,name:'Кимчи',amount:'1 банка',confidence:'high',alternatives:[]}]});return;}
   throw Error('Unexpected backend route '+path);
  }catch(error){errors.push(error.stack);await respond({error:'Mock failed'},500);}
 };
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:480,height:900,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'},{name:'prefers-reduced-motion',value:'reduce'}]});
 await send('Fetch.enable',{patterns:[{urlPattern:'https://vibe-coding-sc04.onrender.com/*'},{urlPattern:'https://fonts.googleapis.com/*'},{urlPattern:'https://fonts.gstatic.com/*'}]});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async(expression,message)=>{for(let n=0;n<300;n++){if(errors.length)throw Error(errors.join('\n'));if(await evaluate(expression))return;await delay(100);}throw Error(message);};
 const click=async selector=>{console.log('UI:',selector);await wait(`!!document.querySelector(${JSON.stringify(selector)})`,'Missing '+selector);assert.ok(await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(e.disabled)return false;e.click();return true;})()`));await delay(80);};
 const fill=async(selector,value,event='input')=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);await delay(80);};
 const has=text=>`${bodyText}.includes(${JSON.stringify(text)})`;
 const shot=async name=>writeFile(resolve(report,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Page.navigate',{url:base+'/FamilyMenu/'});
 await wait('document.querySelectorAll(".splash8 .hat8").length===3','Splash with three hats missing');
 await wait(has('Не удалось загрузить приложение'),'Catalog failure must be visible');
 await click('#app button');await wait('!document.querySelector(".splash8")','Splash must go away');await wait(has('Меню на неделю для всей семьи'),'Feature slides missing');await shot('01-slide');
 assert.equal(await evaluate('!!document.querySelector(\'[data-act="introSkip8"]\')'),false,'No skip on slides');
 await wait(has('Меню на неделю для всей семьи'),'v4 slide 1');for(const [label,next] of [['А что ещё?','Список покупок соберётся сам'],['Ух ты, понял','Первая неделя — бесплатно']]){await wait(has(label),'Button '+label);await click('[data-act="introNext8"]');await wait(has(next),'Slide '+next);}
 await click('[data-act="introBack8"]');await wait(has('Список покупок соберётся сам'),'Back arrow on slides');await click('[data-act="introNext8"]');
 await wait(has('Начать'),'Last slide says Начать');await click('[data-act="introNext8"]');await wait(has('Какая у вас цель?'),'Goal step missing');
 assert.equal(await evaluate('document.querySelector(\'[data-act="qNext8"]\').disabled'),true,'Every step needs an answer');
 await click('[data-act="goal8"][data-v="lose"]');await click('[data-act="goal8"][data-v="pp"]');assert.deepEqual(await evaluate('S.profile.goals'),['lose','pp'],'Several goals');await click('[data-act="qNext8"]');
 await wait(has('Какой у вас тип питания?'),'Diet step missing');await click('[data-act="diet8"][data-v="all"]');await click('[data-act="qNext8"]');
 await wait(has('Чего не должно быть в меню?'),'Restrictions step missing');await shot('02-restrictions');
 assert.equal(await evaluate('[...document.querySelectorAll(".morechip")].filter(e=>!e.hidden).length'),2,'Both chip blocks collapse behind «Ещё»');
 assert.equal(await evaluate('(()=>{const box=document.querySelector(\'[data-clamp="dislike"]\');const tops=new Set([...box.querySelectorAll(".chip")].filter(c=>!c.hidden).map(c=>c.offsetTop));return tops.size})()'),3,'Collapsed chips take three rows');
 assert.equal(await evaluate('[...document.querySelectorAll(\'[data-clamp] .chip\')].some(c=>/[(,\\d]/.test(c.textContent))'),false,'One-word chips');
 await fill('#rs8_dislike','лук');await click('[data-act="dislike8"][data-v="Лук"]');assert.ok(await evaluate('S.profile.dislikes.includes("onion")'),'Dislike search');
 await click('[data-act="allergy"][data-v="nuts"]');await click('[data-act="qNext8"]');
 await wait(has('Что уже есть дома?'),'Home step missing');
 await fill('#pq8','рис');await click('[data-act="pt8s"][data-v="rice"]');assert.equal(await evaluate('UI.q8'),'','Search clears after a pick');
 const potato=catalog.ingredients.find(i=>i.id==='potato');
 await click(`[data-act="cat8"][data-v="${potato.category}"]`);await click('[data-act="pt8"][data-v="potato"]');await shot('03-fridge');await click('[data-act="qNext8"]');
 await wait(has('Ещё немного деталей'),'Details step missing');
 assert.equal(await evaluate('!!document.querySelector("#kind_l")'),false,'Meal kinds live in settings');await click('[data-act="persons8"][data-v="1"]');assert.equal(await evaluate('S.profile.members.length'),4);
 await click('[data-act="days8"][data-v="1"]');await wait('S.profile.days===4','Days counter');await click('[data-act="days8"][data-v="-1"]');
 await click('[data-act="qNext8"]');await wait(has('Неделя и бюджет'),'Budget step missing');await fill('#budget','12000');assert.equal(await evaluate('S.profile.budget'),12000);
 await click('[data-act="build8"]');await wait('!!document.querySelector(".logo8")','Loader with logo missing');
 await wait(`S.stage==='ready'`,'First menu did not open before sign-in');await wait(has('Ваше меню готово'),'Ready text missing');await shot('04-ready');
 assert.equal(privateCalls,0,'Nothing private before sign-in');
 assert.equal(await evaluate('S.plan.days.filter(d=>Object.keys(d.slots).length).length'),3,'Menu for 3 days');
 assert.ok(await evaluate('S.plan.days[0].slots.d_pair.rid.startsWith("c_")'),'Dinner combines main and side');
 await click('[data-act="toAuth8"]');await wait(has('Войти через Telegram'),'Telegram login missing');
 await click('[data-act="telegramStart"]');await wait(has('4826'),'Challenge missing');approved=true;
 await wait(`window.FamilyMenuBridge?.ready && S.stage==='app'`,'Sign-in did not open the app');
 for(let n=0;n<100 && !documents.get('a')?.menu;n++)await delay(100);assert.equal(documents.get('a').menu.days.length,7,'API keeps seven days');
 assert.ok(documents.get('a').preferences.onboarded,'Answers saved to the new account');
 for(let n=0;n<100 && !stocks.get('a').items.some(i=>i.ingredientId==='potato');n++)await delay(100);assert.ok(stocks.get('a').items.some(i=>i.ingredientId==='potato'),'Products marked before sign-in were saved');
 await wait(`S.tab==='today'`,'App opens on «Сегодня»');await click('[data-act="tab"][data-v="menu"]');await wait('!!document.querySelector(".slot [data-drag]") && !document.querySelector(".hero")','v4 menu with drag handles');
 assert.equal(await evaluate(has('Калории сегодня')),false,'Calories moved to «Сегодня»');assert.equal(await evaluate('!!document.querySelector(".appbar > b") || /≈\\s?[0-9][0-9 \u00a0]*₽/.test(document.querySelector(".screen").innerText)'),false,'No duplicated title and no prices in the menu');await shot('05-menu');
 assert.ok(await evaluate('!!document.querySelector(".mealhead8")'),'Meals are grouped');
 {const before=await evaluate('Object.keys(S.plan.days[1].slots).length');await evaluate('document.querySelectorAll(".day")[1].scrollIntoView()');const box=await evaluate('(()=>{const r=document.querySelectorAll(".day")[1].querySelector(".slot[data-slot] .open").getBoundingClientRect();return {x:r.x+20,y:r.y+r.height/2}})()');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x,y:box.y,button:'left',clickCount:1});for(let i=1;i<=8;i++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:box.x+i*25,y:box.y,button:'left',buttons:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x+200,y:box.y,button:'left',clickCount:1});
  await wait(`Object.keys(S.plan.days[1].slots).length===${before}-1`,'Swipe right removes a dish');assert.equal(await evaluate('!!UI.sheet'),false,'Swipe does not open the recipe');}
 await click('[data-act="tab"][data-v="today"]');await wait(has('Калории сегодня'),'Today tab');await wait('!!document.querySelector(".day.today .mealhead8") && !!document.querySelector(".next8m")','Today has the same structure as the menu, upcoming meal marked');
 assert.equal(await evaluate('[...document.querySelectorAll(".day.today .slot")].some(c=>/Готовить/.test(c.innerText)&&/Съели/.test(c.innerText))'),false,'Never «Готовить» and «Съели» on one card');
 assert.equal(await evaluate('/Отмечайте|Можно написать/.test(document.querySelector(".kcal").innerText)'),false,'No long hints under the bar');await shot('05a-today');
 await click('.day.today .slot [data-act="recipe"]');await click('#layer [data-act="fav8"]');assert.equal(await evaluate('S.fav8.length'),1,'Favourite from the recipe card');await click('#layer [data-act="cooked"]');await wait('cookedTotal8()===1','Cooked counter');
 assert.equal(await evaluate('/₽/.test(document.querySelector("#layer").innerText)'),false,'No price on the dish card');
 await click('#layer [data-act="close"]');await click('.cooked8');await wait(`S.tab==='diary' && !!document.querySelector('#hscroll8 .wday8.sel8 .cookdot8') && !document.querySelector('.mchart8')`,'Diary: scrollable days with today cooked');assert.ok(await evaluate(has('Норма калорийности по дням')));
 await click('[data-act="gran8"][data-v="month"]');await wait('document.querySelectorAll("#hscroll8 .wday8").length===12','Month granularity');await click('[data-act="gran8"][data-v="day"]');
 await click('.histrow8');await wait(`S.tab==='rec8' && ${has('Как готовить')}`,'Recipe from the cooking history');await click('[data-act="back8"]');await wait(`S.tab==='diary'`,'Back to the diary');await shot('05c-diary');
 await click('[data-act="board8"]');await wait(has('Вы на 10-м месте'),'Leaderboard missing');await shot('05b-board');await click('.sheet [data-act="close"]');await wait('!UI.board','Leaderboard did not close');await click('[data-act="back8"]');await click('[data-act="tab"][data-v="menu"]');
 await click('[data-act="tab"][data-v="shop"]');await wait(has('Список покупок'),'Shopping missing');await shot('06-shop');
 assert.equal(await evaluate('document.querySelectorAll(".screen a[href*=\\"vkusvill\\"], .screen a[href*=\\"lavka\\"]").length'),0,'No store links in the list');
 // Generation never opens a tab; the ready basket gets its own explicit link.
 await evaluate('window.cartOpenCount=0;window.open=()=>{window.cartOpenCount++;return null};window.boughtBeforeCart=JSON.stringify(S.bought)');
 await click('[data-act="vkusvillCart"]');await wait(has('ВкусВилл отклонил подключение'),'Store connection error missing');
 await click('[data-act="vkusvillCart"]');await wait('!!document.querySelector("[data-store-cart-link]")','Ready basket link missing');
 assert.equal(await evaluate('document.querySelector("[data-store-cart-link]").href'),'https://vkusvill.ru/mobile?basket&share=1001');
 assert.equal(await evaluate('JSON.stringify(S.bought)===window.boughtBeforeCart'),true,'Cart creation must not mark groceries as bought');
 assert.equal(await evaluate('!!UI.cart'),false,'No per-product wizard for VkusVill');
 assert.equal(await evaluate('window.cartOpenCount'),0,'Generating must never open a tab');
 assert.equal(await evaluate('document.querySelector("[data-store-cart-link]").textContent'),'Добавить в корзину');
 await click('.pricecard');await wait(has('Автосборка корзины'),'Auto cart opens during the 7 free days');
 await wait(has('Утвердить меню'),'Auto cart needs an approved menu');await click('[data-act="approve8"]');
 await click('[data-act="store"][data-v="lavka"]');
 await evaluate(`Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:success=>success({coords:{longitude:37.615,latitude:55.757}})}})`);
 assert.ok(await evaluate('document.querySelector("#lavka-cart").textContent.includes("Beta")'),'Lavka Beta badge');
 await click('[data-act="lavkaCart"]');await wait('!!document.querySelector("[data-store-cart-link][data-store=lavka]")','Lavka ready link missing');
 assert.match(await evaluate('document.querySelector("[data-store-cart-link][data-store=lavka]").href'),/^https:\/\/lavka.yandex.ru\/cart\?sharedCartId=/);
 assert.equal(await evaluate('window.cartOpenCount'),0,'Lavka generation must never open a tab');
 assert.equal(await evaluate('JSON.stringify(S.bought)===window.boughtBeforeCart'),true,'Lavka must not mark groceries as bought');
 assert.equal(await evaluate('!!UI.cart'),false,'No product wizard for Lavka');
 await shot('06b-lavka-ready');
 await click('[data-act="back8"]');await wait(`S.tab==='shop'`,'Back returns to the tab it came from');
 assert.ok(await evaluate('!!document.querySelector(\'[data-act="share8"]\') && !document.querySelector(\'[data-act="copy"]\')'),'Telegram share instead of copy');
 await click('[data-act="drawer"]');assert.equal(await evaluate('!!document.querySelector(".dseg") || !!document.querySelector("#theme8")'),false,'No switcher and no theme');await click('[data-act="nav8"][data-v="sub"]');await click('[data-act="subscribe8"]');
 await click('[data-act="tab"][data-v="today"]');
 await click('[data-act="drawer"]');await click('[data-act="nav8"][data-v="pFamily"]');await click('[data-act="back8"]');await wait('UI.drawer','Drawer stays open after a page');
 await click('[data-act="nav8"][data-v="pDays"]');await click('[data-act="kind8"][data-v="l:drink"]');await click('[data-act="kind8"][data-v="l:dessert"]');assert.deepEqual(await evaluate('S.profile.mealSetup.l'),['soup','drink','dessert'],'Several dishes for lunch');
 await click('[data-act="regen"]');await wait(`S.stage==='app' && !!S.plan.days[0].slots.l_drink && !!S.plan.days[0].slots.l_dessert`,'Lunch with soup, drink and dessert');
 assert.ok(await evaluate('S.plan.days.filter(d=>Object.keys(d.slots).length).every(d=>dayKcal8(d)<=KCAL_TARGET8)'),'Day calories never exceed the norm');
 console.log('Budget stress:',await evaluate(`(()=>{const keep=S.plan,b0=S.profile.budget,d0=S.profile.days,out=[];for(const b of [5000,8000,12000,20000])for(const d of [3,7]){S.profile.budget=b;S.profile.days=d;generate();const vis=S.plan.days.filter(x=>Object.keys(x.slots).length);out.push(b+'/'+d+':'+Math.round(shopping().cost)+'<='+Math.round(budgetLimit8())+(shopping().cost<=budgetLimit8()+1?'':'!')+(vis.every(x=>dayKcal8(x)<=KCAL_TARGET8)?'':'kcal!'))}S.plan=keep;S.profile.budget=b0;S.profile.days=d0;return out.join(' ')})()`));
 assert.ok(!(await evaluate(`(()=>{const keep=S.plan,b0=S.profile.budget,d0=S.profile.days;let bad=0;for(const b of [5000,8000,12000,20000])for(const d of [3,7]){S.profile.budget=b;S.profile.days=d;generate();if(shopping().cost>budgetLimit8()+1||!S.plan.days.filter(x=>Object.keys(x.slots).length).every(x=>dayKcal8(x)<=KCAL_TARGET8))bad++}S.plan=keep;S.profile.budget=b0;S.profile.days=d0;return bad})()`)),'Every budget and length fits money and calories');
 assert.ok(await evaluate('shopping().cost<=budgetLimit8()+1'),'Plan fits the budget: '+await evaluate('Math.round(shopping().cost)+" / "+Math.round(budgetLimit8())'));
 assert.ok(await evaluate(`(()=>{const keep=S.plan,b0=S.profile.budget,avg=b=>{S.profile.budget=b;let t=0,n=0;for(let i=0;i<8;i++){generateOnce8();S.plan.days.forEach(d=>Object.values(d.slots).forEach(s=>{if(s.rid){t+=rc(RBY[s.rid]);n++}}))}return t/n};const a=avg(10000),b=avg(30000);S.plan=keep;S.profile.budget=b0;return b>a*1.1})()`),'Budget 30 000 gives pricier dishes than 10 000');

 await click('[data-act="tab"][data-v="home"]');await wait(has('Что есть дома'),'Home missing');
 await evaluate(`fetch('src/frigo-logo.jpg').then(r=>r.blob()).then(b=>photoFiles8([new File([b],'f.jpg',{type:'image/jpeg'})]))`);
 await wait(has('Распознать продукты (1)'),'Photo not queued');assert.equal(scanCalls,0);
 await click('[data-act="scan8"]');await wait(has('Что нашли на фото'),'Scan result missing');
 await click('[data-act="scanAlt"][data-v="1:cucumber"]');await click('[data-act="scanSave"]');
 for(let n=0;n<100 && !stocks.get('a').items.some(i=>i.ingredientId==='cucumber');n++)await delay(100);
 assert.ok(['eggs','cucumber','potato'].every(k=>stocks.get('a').items.some(i=>i.ingredientId===k)),'Recognized products saved');await shot('07-home');
 await click('[data-act="drawer"]');await shot('08-drawer');await click('[data-act="nav8"][data-v="pRecipes"]');await wait(has('Любимые · 1'),'Favourites tab');await click('[data-act="rtab8"][data-v="own"]');await click('[data-act="recNew"]');
 await fill('#rn8','Бабушкин борщ');await fill('#rq8','карто');await click('[data-act="riAdd8"][data-v="potato"]');
 await fill('[data-act="rstep8"]','Сварить всё вместе');await click('[data-act="recSave"]');await wait(has('Бабушкин борщ'),'Own recipe not listed');
 await wait('!window.FamilyMenuBridge.pending','Pending saves did not finish');
 assert.equal(documents.get('a').preferences.webPrototype.myRecipes.length,1,'Own recipe synced');
 const own=await evaluate('S.myRecipes[0].id');
 await evaluate(`(()=>{const key='family-menu-auth-v1',s=JSON.parse(localStorage.getItem(key));s.session.expiresAt=1;localStorage.setItem(key,JSON.stringify(s));})()`);
 await send('Page.reload');await wait('window.FamilyMenuBridge?.ready','Account did not restore');assert.ok(refreshCalls>0);
 assert.equal(await evaluate(`!!RBY[${JSON.stringify(own)}]`),true,'Own recipe did not load');
 assert.ok(await evaluate(`pool8('dish').some(r=>r.id===${JSON.stringify(own)})`),'Own recipe joins menu selection');
 await click('[data-act="drawer"]');await click('[data-act="nav8"][data-v="autocart"]');await evaluate('document.querySelector(\'[data-act="approve8"]\')?.click()');await wait('!!document.querySelector("#budget")','Auto cart budget');
 failSave=true;await fill('#budget','10000');await wait(has('Данные изменились на другом устройстве'),'Conflict was not shown');await click('#sync-error button');await wait('S.profile.budget===9000','Conflict reload ignored canonical server fields');
 await evaluate('S.tab="menu",render()');await click('[data-act="drawer"]');await click('.drawer [data-act="logout"]');await wait(has('Войти через Telegram'),'Logout failed');
 assert.equal(await evaluate('S.plan'),null);assert.equal(await evaluate('S.pantry.length'),0);assert.equal(await evaluate(`!!RBY[${JSON.stringify(own)}]`),false,'Private recipe leaked after logout');
 approved=false;user='b';await click('[data-act="telegramStart"]');await wait(has('4826'),'Second challenge missing');approved=true;
 await wait(has('Какая у вас цель?'),'Second user inherited a plan');assert.equal(stocks.get('b').items.length,0);assert.equal(await evaluate('S.pantry.length'),0);
 assert.equal(errors.length,0);console.log('PASS v8.6: splash; catalog retry; 4 slides; 5 answered steps with 4-row chips; loader; first menu before sign-in (3 days, main+side); Telegram contract; menu, answers and products adopted by the new account; cooking; Premium offer; auto cart; photo recognition; own recipe in the pool; refresh; conflict reload; isolation. No backend writes or paid calls.');
}catch(error){
 console.error(error);if(send)try{const r2=await send('Runtime.evaluate',{expression:'document.body?.innerText',returnByValue:true});console.error('Screen:',r2.result.value);const info=await send('Runtime.evaluate',{expression:'JSON.stringify({url:location.href,ready:document.readyState,scripts:[...document.scripts].map(s=>s.src)})',returnByValue:true});console.error('Page:',info.result.value);const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(report,'failure.png'),Buffer.from(r.data,'base64'));}catch{}
 console.log('::error title=web-smoke::'+String(error.message).replace(/\n/g,'%0A'));process.exitCode=1;
}finally{await writeFile(resolve(report,'network.json'),JSON.stringify(networkLog,null,2));await writeFile(resolve(report,'browser.log'),browserLog.join(''));ws?.close();chrome.kill();server.close();await delay(300);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
