import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../src/share.js',import.meta.url),'utf8');
const data={text:'Список покупок:\n• Молоко — 1 л',url:'https://ivoratrace-ux.github.io/FamilyMenu/'};
function setup(extra={}){
 const calls={native:[],links:[],copied:[],notices:[],events:[]},timers=new Map(),listeners=new Map();let n=0;
 const navigator={userAgent:'Windows desktop',platform:'Win32',maxTouchPoints:0,clipboard:{writeText:async text=>calls.copied.push(text)},share:async payload=>calls.native.push(payload),...extra};
 const document={hidden:false,hasFocus:()=>true,activeElement:{focus(){}},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),body:{append(){}},createElement:()=>({style:{},select(){},remove(){}}),execCommand:()=>false};
 const ctx=vm.createContext({window:{},navigator,document,location:{assign:url=>calls.links.push(url)},toast:text=>calls.notices.push(text),track:event=>calls.events.push(event),encodeURIComponent,setTimeout:fn=>{timers.set(++n,fn);return n;},clearTimeout:key=>timers.delete(key)});vm.runInContext(source,ctx);
 return {calls,document,navigator,ctx,timers,listeners,share:()=>ctx.window.FamilyMenuShare.share(data),timeout:()=>{for(const fn of [...timers.values()])fn();}};
}
test('mobile opens the native sheet with the unchanged list text and page URL',async()=>{
 const f=setup({userAgentData:{mobile:true}});await f.share();assert.equal(f.calls.native.length,1);assert.equal(f.calls.native[0].text,data.text);assert.equal(f.calls.native[0].url,data.url);assert.deepEqual(f.calls.links,[]);assert.deepEqual(f.calls.copied,[]);
});
test('iPad desktop user agent still uses native mobile sharing',async()=>{
 const f=setup({userAgent:'Mozilla Macintosh',platform:'MacIntel',maxTouchPoints:5});await f.share();assert.equal(f.calls.native.length,1);
});
test('cancelling native sharing never opens Telegram or overwrites the clipboard',async()=>{
 const f=setup({userAgent:'iPhone',share:async()=>{throw Object.assign(Error('cancelled'),{name:'AbortError'});}});await f.share();assert.deepEqual(f.calls.copied,[]);assert.deepEqual(f.calls.links,[]);
});
test('failed native sharing copies the full payload and reports success',async()=>{
 const f=setup({userAgent:'Android',share:async()=>{throw Error('not allowed');}});await f.share();assert.deepEqual(f.calls.copied,[data.text+'\n'+data.url]);assert.equal(f.calls.notices[0],'Список покупок скопирован');
});
test('desktop attempts Telegram even when native share exists, then copies if no app opens',async()=>{
 const f=setup(),pending=f.share();assert.equal(f.calls.native.length,0);assert.equal(f.calls.links.length,1);const link=new URL(f.calls.links[0]);assert.equal(link.protocol,'tg:');assert.equal(link.searchParams.get('text'),data.text);assert.equal(link.searchParams.get('url'),data.url);f.timeout();await pending;assert.deepEqual(f.calls.copied,[data.text+'\n'+data.url]);assert.equal(f.listeners.size,0);
});
test('successful handoff does not copy; repeated clicks cannot create competing fallbacks',async()=>{
 const f=setup(),pending=f.share();await f.share();assert.equal(f.calls.links.length,1);f.document.hidden=true;f.listeners.get('visibilitychange')();await pending;assert.deepEqual(f.calls.copied,[]);assert.equal(f.timers.size,0);assert.equal(f.listeners.size,0);
});
test('blocked Telegram launch uses clipboard fallback immediately',async()=>{
 const f=setup();f.ctx.location.assign=()=>{throw Error('blocked');};await f.share();assert.equal(f.calls.copied.length,1);assert.equal(f.timers.size,0);
});
test('unavailable clipboard uses legacy copy; failed copy is never reported as successful',async()=>{
 for(const works of [true,false]){
  const f=setup({clipboard:undefined});let command;f.document.execCommand=value=>{command=value;return works;};const pending=f.share();f.timeout();await pending;assert.equal(command,'copy');assert.equal(f.calls.notices[0].includes('Не удалось'),!works);
 }
});
