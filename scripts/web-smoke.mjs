// Run against a production build with Node.js 24 and Chrome/Chromium.
// Scanner HTTP is intercepted: no real photo or paid OpenAI request leaves the browser.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
const root=resolve(process.argv[2] || 'composeApp/build/dist/wasmJs/productionExecutable');
const report=resolve('composeApp/build/reports/web-smoke');
await mkdir(report,{recursive:true});
const externalBase=process.env.WEB_SMOKE_DEV_URL;
if(!externalBase) {
  const index=await readFile(resolve(root,'index.html'),'utf8');
  assert.ok(index.includes('id="app"'),'Production index.html is missing the Compose viewport');
}
const browserLog=[];
const networkLog=[];
const mime={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
  try {
    const path=new URL(req.url,'http://localhost').pathname;
    if(!path.startsWith('/FamilyMenu/')){res.writeHead(404);return res.end();}
    const file=resolve(root,decodeURIComponent(path.slice('/FamilyMenu/'.length)) || 'index.html');
    if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream'});res.end(data);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=externalBase || `http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(resolve(tmpdir(),'familymenu-smoke-'));
const port=9333;
const chrome=spawn(process.env.CHROME_BIN || 'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-proxy-server','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
chrome.stderr.on('data',chunk=>browserLog.push(chunk.toString()));
let chromeError;
chrome.on('error',e=>{chromeError=e});
let ws,send;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[];
let scanCalls=0;
let catalogCalls=0;
let imageCalls=0;
let inventory={userEmail:'a@example.test',revision:0,items:[{ingredientId:'milk',name:'Молоко',unit:'ml',quantity:100}]};
let inventoryWrites=0;
let searchCalls=0;
let refreshCalls=0;
let protectedCalls=0;
let messengerCalls=0;
const documents=new Map();
const stocks=new Map([['user-a',inventory],['user-b',{userEmail:'b@example.test',revision:0,items:[]}]]);
const userForToken=token=>token?.startsWith('user-b')?'user-b':token?.startsWith('user-a')?'user-a':null;
const authBundle=id=>({user:{id,email:id==='user-a'?'a@example.test':'b@example.test'},session:{accessToken:id+'-token',refreshToken:id+'-refresh',expiresAt:Math.floor(Date.now()/1000)+3600,expiresIn:3600,tokenType:'bearer'}});


const catalog=JSON.parse(await readFile(resolve('backend/data/catalog.seed.json'),'utf8'));
const artBase='https://vibe-coding-sc04.onrender.com/assets/art';
for(const r of catalog.recipes) {r.imageUrl=`${artBase}/${r.id}.png`;r.stepImageUrls=r.steps.map((_,n)=>`${artBase}/${r.id}-step-${n}.png`);}
const deep=`function all(root=document){return [...root.querySelectorAll('*')].flatMap(e=>[e,...(e.shadowRoot?all(e.shadowRoot):[])])}`;
try {
  let pages;
  for(let i=0;i<100;i++){
    if(chromeError)throw chromeError;
    try {pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json();pages=pages.filter(p=>p.type==='page' && p.url==='about:blank');if(pages.length)break;}catch{}
    await delay(100);
  }
  assert.ok(pages?.length,'Chrome debugger did not start');
  ws=new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise((r,reject)=>{ws.onopen=r;ws.onerror=reject});
  let id=0;
  const pending=new Map();
  send=(method,params={})=>new Promise((r,reject)=>{
    const requestId=++id;
    const timeout=setTimeout(()=>{pending.delete(requestId);reject(Error(`CDP timeout: ${method}`));},30000);
    pending.set(requestId,m=>{clearTimeout(timeout);if(m.error)reject(Error(JSON.stringify(m.error)));else r(m.result)});
    ws.send(JSON.stringify({id:requestId,method,params}));
  });
  ws.onmessage=async e=>{
    const m=JSON.parse(e.data);
    if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);return;}
    if(m.method==='Inspector.targetCrashed')errors.push('Chrome renderer crashed');
    if(m.method==='Network.loadingFailed')networkLog.push(m.params);
    if(m.method==='Network.responseReceived')networkLog.push({url:m.params.response.url,status:m.params.response.status});
    if(m.method==='Runtime.exceptionThrown')errors.push(JSON.stringify(m.params.exceptionDetails));
    if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error') errors.push(m.params.args.map(x=>x.value || x.description || '').join(' '));
    if(m.method==='Fetch.requestPaused') {
      try {
        const {request,requestId}=m.params;
        const headers=[{name:'Access-Control-Allow-Origin',value:base},{name:'Access-Control-Allow-Methods',value:'GET, POST, PUT, DELETE, OPTIONS'},{name:'Access-Control-Allow-Headers',value:'content-type,authorization'},{name:'Content-Type',value:'application/json'}];
        if(new URL(request.url).pathname.includes('/assets/art/')) {
          imageCalls++;
          const filename=new URL(request.url).pathname.split('/').at(-1);
          assert.match(filename,/^[a-z0-9-]+\.png$/);
          const image=await readFile(resolve('backend/public/art',filename));
          await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Access-Control-Allow-Origin',value:base},{name:'Content-Type',value:'image/png'}],body:image.toString('base64')});
        }
        else if(request.method==='OPTIONS') await send('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:headers});
        else if(new URL(request.url).pathname==='/api/catalog') {
          catalogCalls++;
          if(catalogCalls===1) {
            await send('Fetch.fulfillRequest',{requestId,responseCode:503,responseHeaders:headers,body:Buffer.from('{}').toString('base64')});
            return;
          }
          assert.equal(request.method,'GET');
          await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify(catalog)).toString('base64')});
        }
        else if(new URL(request.url).pathname.startsWith('/api/auth/')) {
          const path=new URL(request.url).pathname;
          if(path==='/api/auth/logout') {await send('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:headers});return;}
          if(path==='/api/auth/messengers') {await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify({telegram:true,max:true})).toString('base64')});return;}
          const data=JSON.parse(request.postData);
          let body;
          if(path==='/api/auth/telegram/start') {messengerCalls++;assert.equal(data.phone.replace(/\D/g,'').slice(-10),'9001234567');body={challengeId:'tg-1',expiresIn:300,via:'telegram',destination:'+7 900 ***-**-67'};}
          else if(path==='/api/auth/telegram/verify') {messengerCalls++;assert.equal(data.challengeId,'tg-1');assert.equal(data.code,'1234');body={...authBundle('user-a'),login:{via:'telegram',display:'+7 900 ***-**-67'}};}
          else if(path==='/api/auth/refresh') {refreshCalls++;body=authBundle(data.refreshToken.startsWith('user-b')?'user-b':'user-a');}
          else {assert.equal(data.password,'StrongPass123!');body=authBundle(data.email==='b@example.test'?'user-b':'user-a');}
          await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify(body)).toString('base64')});
        }
        else if(new URL(request.url).pathname==='/api/user-state') {
          protectedCalls++;
          const token=Object.entries(request.headers).find(([k])=>k.toLowerCase()==='authorization')?.[1]?.replace('Bearer ','');
          const user=userForToken(token);assert.ok(user,'User-state requires bearer token');
          let doc=documents.get(user) || {revision:0,preferences:null,menu:null};
          if(request.method==='PUT') {const body=JSON.parse(request.postData);assert.equal(body.revision,doc.revision);doc={...body,revision:doc.revision+1};documents.set(user,doc);}
          await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify(doc)).toString('base64')});
        }
        else if(new URL(request.url).pathname==='/api/ingredients') {
          assert.ok(Object.keys(request.headers).some(k=>k.toLowerCase()==='authorization'));
          searchCalls++;
          const q=new URL(request.url).searchParams.get('q');assert.ok(q.trim().length>=3);
          const ingredients=catalog.ingredients.filter(i=>i.name.toLowerCase().includes(q.toLowerCase())).slice(0,20).map(({id,name,unit})=>({id,name,unit}));
          await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify({ingredients})).toString('base64')});
        }
        else if(new URL(request.url).pathname.startsWith('/api/inventory')) {
          protectedCalls++;
          const token=Object.entries(request.headers).find(([k])=>k.toLowerCase()==='authorization')?.[1]?.replace('Bearer ','');
          const user=userForToken(token);assert.ok(user,'Inventory requires user token');const stock=stocks.get(user);
          if(request.method!=='GET') {
            const body=JSON.parse(request.postData);assert.equal(body.revision,stock.revision);assert.ok(!('userId' in body));
            inventoryWrites++;
            const items=body.items || [{ingredientId:body.ingredientId,quantity:body.quantity}];
            if(new URL(request.url).pathname==='/api/inventory') stock.items=[];
            for(const item of items) {
              stock.items=stock.items.filter(i=>i.ingredientId!==item.ingredientId);
              if(request.method!=='DELETE') {const ingredient=catalog.ingredients.find(i=>i.id===item.ingredientId);assert.ok(ingredient);assert.ok(item.quantity>0);stock.items.push({...item,name:ingredient.name,unit:ingredient.unit});}
            }
            stock.revision++;
          }
          await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify(stock)).toString('base64')});
        }
        else {
          scanCalls++;
          assert.equal(request.method,'POST');
          const data=JSON.parse(request.postData);
          assert.equal(data.images.length,4);assert.ok(data.images.every(i=>i.mimeType==='image/jpeg' && i.image.length>100));
          assert.ok(Object.keys(request.headers).some(k=>k.toLowerCase()==='authorization'),'Scanner requires authorization');
          const body={products:[{ingredientId:'eggs',name:'Яйца',amount:'6 шт',confidence:'high',alternatives:[]},{ingredientId:null,name:'Овощ',amount:'около 300 г',confidence:'medium',alternatives:[{ingredientId:'zucchini',name:'Кабачок'},{ingredientId:'cucumber',name:'Огурцы'}]},{ingredientId:null,name:'Кимчи',amount:'1 банка',confidence:'high',alternatives:[]}]};
          await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify(body)).toString('base64')});
        }
      } catch(e) {errors.push(String(e));await send('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'Failed'});}
    }
  };
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  console.log('Browser:',JSON.stringify(await send('Browser.getVersion')));
  await send('Emulation.setDeviceMetricsOverride',{width:480,height:900,deviceScaleFactor:1,mobile:true});
  await send('Page.setInterceptFileChooserDialog',{enabled:true});
  await send('Fetch.enable',{patterns:[{urlPattern:'https://vibe-coding-sc04.onrender.com/*'},{urlPattern:artBase+'/*'}]});
  const evaluate=async expression=>{
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;
  };
  const wait=async(expression,message)=>{
    for(let i=0;i<600;i++) {if(errors.length)throw Error(errors.join('\n'));if(await evaluate(expression))return;await delay(100);}
    throw Error(message);
  };
  const has=label=>`(()=>{${deep};return all().some(e=>(e.getAttribute('aria-label')||e.textContent||'').includes(${JSON.stringify(label)}))})()`;
  const click=async label=>{
    console.log('UI control:',label);
    await wait(has(label),`Missing UI control: ${label}`);
    const clicked=await evaluate(`(()=>{${deep};const L=${JSON.stringify(label)};const text=e=>(e.getAttribute('aria-label')||e.textContent||'').trim();const isButton=e=>e.getAttribute('role')==='button'||e.tagName==='BUTTON';
      const exact=all().filter(e=>text(e)===L);let e=exact.filter(isButton).at(-1);
      if(!e){const containing=all().filter(e=>isButton(e)&&text(e).includes(L)).sort((a,b)=>text(a).length-text(b).length);e=containing[0];}
      if(!e)e=exact.at(-1);if(!e)return false;e.click();return true;})()`);
    assert.ok(clicked,`Cannot click ${label}`);await delay(250);
  };
  const clickUntil=async(label,condition,message)=>{
    for(let i=0;i<5;i++){await click(label);for(let j=0;j<10;j++){if(await evaluate(condition))return;await delay(100);}}
    throw Error(message);
  };
  const clickWhere=async(predicate,name)=>{
    console.log('UI control:',name);
    const expr=`(()=>{${deep};const hit=all().filter(e=>(e.getAttribute('role')==='button'||e.tagName==='BUTTON')&&(t=>${predicate})((e.getAttribute('aria-label')||e.textContent||'').trim()));if(!hit.length)return false;hit[0].click();return true;})()`;
    await wait(expr,`Missing UI control: ${name}`);await delay(250);
  };
  const fill=async(label,text,index=0)=>{
    await wait(`(()=>{${deep};return all().some(e=>e.getAttribute('role')==='textbox')})()`,`Missing text field: ${label}`);
    const point=await evaluate(`(()=>{${deep};const box=all().filter(e=>e.getAttribute('role')==='textbox')[${index}];if(!box)return null;const r=box.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    assert.ok(point,`Missing text field: ${label}`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});
    await send('Input.insertText',{text});await delay(400);
  };
  const navigation=await send('Page.navigate',{url:externalBase ? `${base}/` : `${base}/FamilyMenu/`});
  assert.ok(!navigation.errorText,`Browser navigation failed: ${navigation.errorText}`);
  await wait(has('Повторить'),'Catalog error should offer retry');
  await click('Повторить');
  // Intro slides → sign-in choice
  await wait(has('Меню на всю неделю'),'Intro slides did not render');
  assert.ok(catalogCalls>0,'App must load recipes from the backend');
  await click('Пропустить');
  await wait(has('Войти через Telegram'),'Sign-in choice did not render');
  assert.ok(await evaluate(has('Войти через MAX')),'MAX sign-in must be offered');
  assert.equal(protectedCalls,0,'Nothing protected may be requested before sign-in');
  // Telegram: phone → code
  await click('Войти через Telegram');
  await fill('Номер телефона','9001234567');await click('Получить код в Telegram');
  await wait(has('Введите 4 цифры'),'Code step did not render');
  await fill('Код','1234');await click('Войти');
  await wait(has('Кто в семье?'),'Telegram sign-in did not open getting to know');
  assert.equal(messengerCalls,2);
  assert.equal(await evaluate(`Object.values(localStorage).some(v=>v.includes('9001234567'))`),false,'Phone must not be persisted');
  // Getting to know: 5 steps, scenario choice, week setup
  for(let step=0;step<5;step++) await click('Дальше');
  await wait(has('С чего начнём?'),'Scenario step did not render');
  await click('Составить меню на неделю');
  await wait(has('Последний шаг'),'Week setup did not render');
  await click('Составить меню');
  await wait(has('Утвердить меню и собрать список'),'Week menu did not render');
  for(let i=0;i<100 && !(documents.get('user-a')?.menu?.days?.length===7);i++) await delay(100);
  assert.ok(documents.get('user-a')?.menu?.days?.length===7,'Menu must be saved to the account');
  assert.ok(documents.get('user-a')?.preferences?.onboarded===true,'Onboarding must be saved');
  await click('Утвердить меню и собрать список');
  await wait(has('Собрать корзину по шагам'),'Shopping list did not render after approval');
  assert.ok(imageCalls>0,'Dish images must be loaded using database URLs');
  await click('Собрать корзину по шагам');await wait(has('Положила ✓'),'Cart session did not open');
  await click('Положила ✓');await wait(has('Продукт 2 из'),'Cart did not advance');await clickUntil('Закрыть',`!(${has('Положила ✓')})`,'Cart dialog did not close');
  // Cook from what you have
  await click('Готовить');await wait(has('Что есть дома'),'Cook tab did not render');
  await wait(has('Молоко ×'),'Saved inventory was not loaded');
  const writes0=inventoryWrites;
  await click('Изменить');await wait(has('Мясо и птица'),'Pantry picker did not open');
  await click(catalog.ingredients.find(i=>i.id==='potato').name);
  for(let i=0;i<100 && inventoryWrites===writes0;i++) await delay(100);
  assert.equal(inventoryWrites,writes0+1,'Marking a product must save stock');
  await clickWhere(`t.startsWith('Готово ·')`,'Pantry done');await wait(`!(${has('Мясо и птица')})`,'Pantry picker did not close');
  await click('Супы');
  await clickWhere(`(t.includes('всё есть')||t.includes('докупить')) && t.includes('мин')`,'First soup');
  await wait(has('Готовить по шагам'),'Recipe card did not open');
  if(await evaluate(has('Добавить недостающее в «Покупки»'))) await click('Добавить недостающее в «Покупки»');
  await click('Готовить по шагам');await wait(has('Шаг 1 из'),'Step-by-step cooking did not open');
  for(let i=0;i<20 && !(await evaluate(has('Готово ✓')));i++) await click('Дальше');
  await click('Готово ✓');await wait(has('Приятного аппетита!'),'Cooking did not finish');
  const writes1=inventoryWrites;await click('Списать использованное');
  for(let i=0;i<100 && inventoryWrites===writes1;i++) await delay(100);
  await clickUntil('Закрыть',`!(${has('Приятного аппетита!')})`,'Cooking dialog did not close');
  // Fridge photos → recognition → replace stock
  await click('Сфотографировать холодильник');await wait(has('Мой холодильник'),'Scanner did not open');
  await click('Добавить фото');assert.equal(await evaluate(has('Камера')),false,'Web must offer attachment only');await click('Выбрать фото');
  await wait(`!!document.querySelector('input[type=file]')`,'File picker did not open');
  const doc=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[type=file]'});
  await send('DOM.setFileInputFiles',{nodeId,files:Array(3).fill(resolve('backend/public/art/b1.png'))});
  await wait(has('Удалить фото 3'),'Selected photos were not queued');
  await click('Добавить фото');await click('Выбрать фото');
  await wait(`!!document.querySelector('input[type=file]')`,'Second file picker did not open');
  const doc2=await send('DOM.getDocument');
  const input2=await send('DOM.querySelector',{nodeId:doc2.root.nodeId,selector:'input[type=file]'});
  await send('DOM.setFileInputFiles',{nodeId:input2.nodeId,files:Array(2).fill(resolve('backend/public/art/b1.png'))});
  await wait(has('Удалить фото 5'),'Additional photos replaced the queue');
  assert.equal(scanCalls,0,'Selecting photos must not trigger recognition');
  await click('Удалить фото 2');
  await click('Распознать (4)');
  await wait(has('Вне справочника'),'Unmatched products must be shown separately');
  await click('Огурцы');
  await wait(`!(${has('Выберите подходящий вариант')})`,'Alternative was not confirmed');
  assert.equal(scanCalls,1,'Expected exactly one mocked scanner request');
  const writes2=inventoryWrites;
  await evaluate(`(()=>{${deep};const p=all().find(e=>e.textContent?.trim()==='Кимчи');let node=p;while(node){const buttons=[...node.querySelectorAll('[role=button],button')].filter(e=>e.textContent?.trim()==='Удалить');if(buttons.length===1){buttons[0].click();return true;}node=node.parentElement;}return false;})()`);
  await wait(`!(${has('Кимчи')})`,'Unmatched product was not removed');
  await click('Сохранить');await click('Отмена');assert.equal(inventoryWrites,writes2,'Cancelled replacement wrote inventory');
  await click('Сохранить');await click('Заменить запасы');
  await wait(has('Что есть дома'),'Saved scanner result did not return to cooking');
  assert.equal(inventoryWrites,writes2+1);assert.equal(inventory.items.length,2);assert.ok(!inventory.items.some(i=>i.ingredientId==='milk'));
  const screenshot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(resolve(report,'cook.png'),Buffer.from(screenshot.data,'base64'));
  // Reload with an expired session
  await evaluate(`(()=>{const key='family-menu-auth-v1';const session=JSON.parse(localStorage.getItem(key));session.session.expiresAt=1;localStorage.setItem(key,JSON.stringify(session));})()`);
  await send('Page.reload');
  await wait(has('Главная'),'App did not restore after reload');
  assert.ok(refreshCalls>0,'Expired session must be refreshed after reload');
  await click('Готовить');await wait(has('Яйца ×'),'Saved stock did not load after reload');
  assert.equal(await evaluate(has('Кимчи')),false,'Unmatched item was saved unexpectedly');
  // Premium: locked in week one, trial opens after a week
  await click('Профиль');await wait(has('Калории и КБЖУ'),'Profile did not render');
  await click('+неделя');await wait(has('Пробная неделя'),'Premium trial did not start after a week');
  // Logout and account isolation (email sign-in)
  await click('Выйти');await wait(has('Войти через Telegram'),'Logout did not clear the session');
  await click('Войти по почте и паролю');
  await fill('Электронная почта','b@example.test');await fill('Пароль','StrongPass123!',1);await click('Зарегистрироваться');
  await wait(has('Кто в семье?'),'A new account must not inherit another user preferences/menu');
  assert.equal(stocks.get('user-b').items.length,0,'Account inventory leaked across users');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Compose Web: intro → Telegram code sign-in → getting to know → week menu → approve → cart → cook from what you have → steps → use up → fridge photos → replace stock → refresh → premium trial → logout → email account isolation: PASS. Backend mocked; no paid API calls.');
} catch(e) {
  let visible='';
  if(send) {try {const dom=await send('Runtime.evaluate',{expression:`(()=>{${deep};return all().map(e=>({tag:e.tagName,role:e.getAttribute('role'),label:e.getAttribute('aria-label'),text:e.textContent?.slice(0,300)}))})()`,returnByValue:true});await writeFile(resolve(report,'semantics.json'),JSON.stringify(dom.result.value,null,2));
    visible=[...new Set(dom.result.value.filter(x=>x.role==='button'||(x.text||'').length<60).map(x=>(x.label||x.text||'').trim()).filter(Boolean))].slice(0,90).join(' | ');
    const image=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(report,'failure.png'),Buffer.from(image.data,'base64'));}catch{}}
  console.error(e);
  const clean=t=>String(t).replace(/%/g,'%25').replace(/\r?\n/g,'%0A').slice(0,3500);
  console.log(`::error title=web-smoke::${clean(e?.stack||e)}`);
  if(visible) console.log(`::error title=web-smoke screen::${clean(visible)}`);
  process.exitCode=1;
} finally {
  await writeFile(resolve(report,'browser.log'),browserLog.join(''));
  await writeFile(resolve(report,'network.json'),JSON.stringify(networkLog,null,2));
  ws?.close();chrome.kill();server.close();
  await delay(300);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
