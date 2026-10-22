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
let inventory={userEmail:'test@test.com',revision:0,items:[{ingredientId:'milk',name:'Молоко',unit:'ml',quantity:100}]};
let inventoryWrites=0;
let searchCalls=0;

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
        const headers=[{name:'Access-Control-Allow-Origin',value:base},{name:'Access-Control-Allow-Methods',value:'GET, POST, PUT, DELETE, OPTIONS'},{name:'Access-Control-Allow-Headers',value:'content-type'},{name:'Content-Type',value:'application/json'}];
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
        else if(new URL(request.url).pathname==='/api/ingredients') {
          searchCalls++;
          const q=new URL(request.url).searchParams.get('q');assert.ok(q.trim().length>=3);
          const ingredients=catalog.ingredients.filter(i=>i.name.toLowerCase().includes(q.toLowerCase())).slice(0,20).map(({id,name,unit})=>({id,name,unit}));
          await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify({ingredients})).toString('base64')});
        }
        else if(new URL(request.url).pathname.startsWith('/api/inventory')) {
          if(request.method!=='GET') {
            const body=JSON.parse(request.postData);assert.equal(body.revision,inventory.revision);assert.ok(!('userId' in body));
            inventoryWrites++;
            const items=body.items || [{ingredientId:body.ingredientId,quantity:body.quantity}];
            if(new URL(request.url).pathname==='/api/inventory') inventory.items=[];
            for(const item of items) {
              inventory.items=inventory.items.filter(i=>i.ingredientId!==item.ingredientId);
              if(request.method!=='DELETE') {const ingredient=catalog.ingredients.find(i=>i.id===item.ingredientId);assert.ok(ingredient);assert.ok(item.quantity>0);inventory.items.push({...item,name:ingredient.name,unit:ingredient.unit});}
            }
            inventory.revision++;
          }
          await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:Buffer.from(JSON.stringify(inventory)).toString('base64')});
        }
        else {
          scanCalls++;
          assert.equal(request.method,'POST');
          const data=JSON.parse(request.postData);
          assert.equal(data.images.length,4);assert.ok(data.images.every(i=>i.mimeType==='image/jpeg' && i.image.length>100));
          assert.ok(!Object.keys(request.headers).some(k=>k.toLowerCase()==='authorization'));
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
    const clicked=await evaluate(`(()=>{${deep};const matches=all().filter(e=>(e.getAttribute('aria-label')||e.textContent||'').trim()===${JSON.stringify(label)});const e=matches.find(e=>e.getAttribute('role')==='button'||e.tagName==='BUTTON')||matches.at(-1);if(!e)return false;e.click();return true;})()`);
    assert.ok(clicked,`Cannot click ${label}`);await delay(200);
  };
  const fill=async(label,text)=>{
    await wait(`(()=>{${deep};return all().some(e=>e.getAttribute('role')==='textbox')})()`,`Missing text field: ${label}`);
    const point=await evaluate(`(()=>{${deep};const box=all().find(e=>e.getAttribute('role')==='textbox');if(!box)return null;const r=box.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
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
  await wait(has('Пропустить'),'Compose failed to render intro');
  assert.ok(catalogCalls>0,'App must load recipes from the backend');
  await click('Пропустить');await click('Посмотреть без входа (демо-семья)');
  await wait(`JSON.parse(localStorage.getItem('family-menu-compose-v1')||'{}').plan?.days?.length===7`,'Demo did not generate seven days');
  await click('Покупки');await wait(has('Список на неделю'),'Shopping screen did not render');
  assert.ok(imageCalls>0,'Dish images must be loaded using database URLs');
  await click('Дома');await wait(has('Мои запасы'),'Inventory tab did not render');
  await wait(has('Изменить Молоко'),'Saved inventory was not loaded');
  await click('Добавить ингредиент');
  await fill('Поиск ингредиента','ог');assert.equal(searchCalls,0,'Search started before three characters');
  await fill('Поиск ингредиента','огур');await click('Огурцы · г');
  await fill('Количество (г)','300');await click('Сохранить количество');
  await wait(has('Изменить Огурцы'),'Ingredient was not added');
  await click('Изменить Огурцы');await fill('Количество (г)','500');await click('Сохранить количество');
  await wait(`!(${has('Сохранить количество')})`,'Amount editor did not close');
  await click('Удалить Молоко');await wait(`!(${has('Изменить Молоко')})`,'Ingredient was not deleted');
  assert.equal(inventory.items.length,1);assert.equal(inventory.items[0].quantity,500);
  await click('Обновить запасы');await wait(has('Мой холодильник'),'Scanner did not open');
  const before=await evaluate(`localStorage.getItem('family-menu-compose-v1')`);
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
  await wait(has('Огурцы'),'Scanner alternatives did not render');
  await wait(has('Вне справочника'),'Unmatched products must be shown separately');
  await click('Огурцы');
  await wait(`!(${has('Выберите подходящий вариант')})`,'Alternative was not confirmed');
  assert.equal(scanCalls,1,'Expected exactly one mocked scanner request');
  assert.equal(await evaluate(`localStorage.getItem('family-menu-compose-v1')`),before,'Scanner modified persistent menu/profile/purchases');
  assert.equal(inventoryWrites,3,'Recognition must not write stock before Save');
  // Outside-catalog product must be removed or mapped before saving.
  await evaluate(`(()=>{${deep};const p=all().find(e=>e.textContent?.trim()==='Кимчи');let node=p;while(node){const buttons=[...node.querySelectorAll('[role=button],button')].filter(e=>e.textContent?.trim()==='Удалить');if(buttons.length===1){buttons[0].click();return true;}node=node.parentElement;}return false;})()`);
  await wait(`!(${has('Кимчи')})`,'Unmatched product was not removed');
  await click('Сохранить');await click('Отмена');assert.equal(inventoryWrites,3,'Cancelled replacement wrote inventory');
  await click('Сохранить');await click('Заменить запасы');
  await wait(has('Мои запасы'),'Saved scanner result did not return to inventory');
  assert.equal(inventoryWrites,4);assert.equal(inventory.items.length,2);assert.ok(!inventory.items.some(i=>i.ingredientId==='milk'));
  const screenshot=await send('Page.captureScreenshot' ,{format:'png'});
  await writeFile(resolve(report,'scanner.png'),Buffer.from(screenshot.data,'base64'));
  await send('Page.reload');
  await wait(has('Сегодня'),'App did not restore after reload');
  await click('Дома');await wait(has('Мои запасы'),'Inventory tab did not restore');
  await wait(has('Изменить Яйца'),'Saved stock did not load after reload');
  assert.equal(await evaluate(has('Кимчи')),false,'Unmatched item was saved unexpectedly');
  assert.equal(await evaluate(has('Удалить фото 1')),false,'Scanner photos persisted unexpectedly');
  assert.ok(await evaluate(`JSON.parse(localStorage.getItem('family-menu-compose-v1')).plan.days.length===7`));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Compose Web: inventory load → search → add → edit → delete → photos → confirm → replace → reload: PASS. Backend mocked; no paid API calls.');
} catch(e) {
  if(send) {try {const dom=await send('Runtime.evaluate',{expression:`(()=>{${deep};return all().map(e=>({tag:e.tagName,role:e.getAttribute('role'),label:e.getAttribute('aria-label'),text:e.textContent?.slice(0,300)}))})()`,returnByValue:true});await writeFile(resolve(report,'semantics.json'),JSON.stringify(dom.result.value,null,2));const image=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(report,'failure.png'),Buffer.from(image.data,'base64'));}catch{}}
  console.error(e);process.exitCode=1;
} finally {
  await writeFile(resolve(report,'browser.log'),browserLog.join(''));
  await writeFile(resolve(report,'network.json'),JSON.stringify(networkLog,null,2));
  ws?.close();chrome.kill();server.close();
  await delay(300);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
