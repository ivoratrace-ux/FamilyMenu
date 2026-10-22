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
          const data=JSON.parse(request.postData);
          let body;
          if(path==='/api/auth/register' && data.email.endsWith('@users.familymenu.invalid')) {messengerCalls++;assert.match(data.email,/^telegram-[a-z0-9]{20}@/);assert.ok(data.password.length>=32);body=authBundle('user-a');}
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
          assert.ok(data.images.length>=1 && data.images.length<=5);assert.ok(data.images.every(i=>i.mimeType==='image/jpeg' && i.image.length>100));
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
  await wait(has('Повторить'),'Catalog error should offer retry after the splash');
  await click('Повторить');
  // Feature slides
  await wait(has('Готовим из того, что есть'),'Feature slides did not render');
  assert.ok(catalogCalls>0,'App must load recipes from the backend');
  await click('Дальше');await wait(has('Большая база рецептов'),'Second slide did not render');
  await click('Пропустить');
  // Getting to know: every step needs an answer, no sign-in yet
  await wait(has('Какая у вас цель?'),'Goal step did not render');
  await click('Похудение');await click('Дальше');
  await wait(has('Какой у вас тип питания?'),'Diet step did not render');
  await click('Едим всё');await click('Дальше');
  await wait(has('Чего не должно быть в меню?'),'Restrictions step did not render');
  assert.ok(await evaluate(has('Ещё')),'Long chip lists must collapse behind «Ещё»');
  await click('Ограничений нет — дальше');
  await wait(has('Что уже есть в холодильнике?'),'Fridge step did not render');
  const potato=catalog.ingredients.find(i=>i.id==='potato');
  await click(potato.category);await click(potato.name);
  await click('Дальше');
  await wait(has('Ещё немного деталей'),'Details step did not render');
  assert.equal(protectedCalls,0,'Nothing protected may be requested before sign-in');
  await click('Составить меню');
  await wait(has('Ваше меню готово!'),'First menu did not render after the loader');
  await click('Сохранить меню');
  // Test messenger sign-in
  await wait(has('Войти через Telegram'),'Sign-in choice did not render');
  await click('Войти через Telegram');
  await fill('Номер телефона','9001234567');await click('Получить код в Telegram');
  await wait(has('Введите 4 цифры'),'Code step did not render');
  await fill('Код','1234');await click('Войти');
  await wait(has('Покупки'),'Sign-in did not open the app');
  assert.equal(messengerCalls,1,'Test messenger sign-in must register one device account');
  for(let i=0;i<100 && !(documents.get('user-a')?.menu?.days?.length===3);i++) await delay(100);
  assert.equal(documents.get('user-a')?.menu?.days?.length,3,'The first menu must be saved to the new account');
  assert.ok(documents.get('user-a')?.preferences?.onboarded===true,'Answers must be saved to the new account');
  for(let i=0;i<100 && !inventory.items.some(x=>x.ingredientId==='potato');i++) await delay(100);
  assert.ok(inventory.items.some(x=>x.ingredientId==='potato'),'Products marked before sign-in must be saved');
  assert.ok(imageCalls>0,'Dish images must be loaded using database URLs');
  // Cook the nearest meal
  await click('Готовить');await click('Готовить по шагам с таймером');await wait(has('Шаг 1 из'),'Step-by-step cooking did not open');
  await click('Закрыть');await wait(`!(${has('Шаг 1 из')})`,'Recipe screen did not close');
  // Shopping → Premium offer → auto cart
  await click('Покупки');await wait(has('Осталось купить'),'Shopping list did not render');
  await click('Собрать корзину автоматически ›');await wait(has('Что входит в Premium'),'Premium offer did not open');
  await click('Подключить за 1 990 ₽');await click('Утвердить меню');
  await clickWhere(`t.startsWith('Собрать корзину ·')`,'Collect cart');
  await wait(has('Положила ✓'),'Cart session did not open');await click('Положила ✓');
  await click('Закрыть');await wait(`!(${has('Положила ✓')})`,'Cart screen did not close');
  await click('‹');
  // Home: fridge photos → recognition → replace stock
  await click('Дома');await wait(has('Что есть дома'),'Home tab did not render');
  await click('Фото холодильника');
  await wait(`!!document.querySelector('input[type=file]')`,'File picker did not open');
  const doc=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[type=file]'});
  await send('DOM.setFileInputFiles',{nodeId,files:Array(3).fill(resolve('backend/public/art/b1.png'))});
  await wait(has('Распознать продукты (3)'),'Selected photos were not queued');
  assert.equal(scanCalls,0,'Selecting photos must not trigger recognition');
  await click('Распознать продукты (3)');await wait(has('Мой холодильник'),'Scanner did not open');
  await click('Распознать (3)');
  await wait(has('Вне справочника'),'Unmatched products must be shown separately');
  await click('Огурцы');
  await wait(`!(${has('Выберите подходящий вариант')})`,'Alternative was not confirmed');
  assert.equal(scanCalls,1,'Expected exactly one mocked scanner request');
  const writes2=inventoryWrites;
  await evaluate(`(()=>{${deep};const p=all().find(e=>e.textContent?.trim()==='Кимчи');let node=p;while(node){const buttons=[...node.querySelectorAll('[role=button],button')].filter(e=>e.textContent?.trim()==='Удалить');if(buttons.length===1){buttons[0].click();return true;}node=node.parentElement;}return false;})()`);
  await wait(`!(${has('Кимчи')})`,'Unmatched product was not removed');
  await click('Сохранить');await click('Отмена');assert.equal(inventoryWrites,writes2,'Cancelled replacement wrote inventory');
  await click('Сохранить');await click('Заменить запасы');
  await wait(has('Что есть дома'),'Saved scanner result did not return home');
  assert.equal(inventoryWrites,writes2+1);assert.equal(inventory.items.length,2);assert.ok(!inventory.items.some(i=>i.ingredientId==='milk'));
  const screenshot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(resolve(report,'home.png'),Buffer.from(screenshot.data,'base64'));
  // Own recipe
  await click('Профиль');await click('Мои рецепты');await click('+ Добавить рецепт');
  await fill('Название','Бабушкин борщ',0);await fill('Добавить продукт','карто',3);await click('+ '+potato.name);
  await fill('Шаг 1','Сварить всё вместе',5);await click('Сохранить рецепт');
  await wait(has('Бабушкин борщ'),'Own recipe was not saved');
  for(let i=0;i<100 && !(documents.get('user-a')?.preferences?.myRecipes?.length===1);i++) await delay(100);
  assert.equal(documents.get('user-a')?.preferences?.myRecipes?.length,1,'Own recipe must sync to the account');
  // Reload with an expired session
  await evaluate(`(()=>{const key='family-menu-auth-v1';const session=JSON.parse(localStorage.getItem(key));session.session.expiresAt=1;localStorage.setItem(key,JSON.stringify(session));})()`);
  await send('Page.reload');
  await wait(has('Покупки'),'App did not restore after reload');
  assert.ok(refreshCalls>0,'Expired session must be refreshed after reload');
  // Logout and account isolation (email sign-in)
  await click('Профиль');await click('Выйти');await wait(has('Войти через Telegram'),'Logout did not clear the session');
  await click('Войти по почте и паролю');
  await fill('Электронная почта','b@example.test');await fill('Пароль','StrongPass123!',1);await click('Зарегистрироваться');
  await wait(has('Какая у вас цель?'),'A new account must not inherit another user preferences/menu');
  assert.equal(stocks.get('user-b').items.length,0,'Account inventory leaked across users');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Compose Web: splash → slides → 5-step getting to know (no sign-in) → loader → first menu → test Telegram sign-in → menu and stock saved → cook → Premium → auto cart → fridge photos → replace stock → own recipe → refresh → logout → isolation: PASS. Backend mocked; no paid API calls.');
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
