import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../src/analytics.js',import.meta.url),'utf8');
function setup({sdkThrows=false,hostname='localhost',mock=true,generationThrows=false}={}){
 let now=0,interval,uuid=0;const events=[],ids=[],listeners={},storage=new Map(),scripts=[];
 const sdk={capture:(event,properties)=>{if(sdkThrows)throw Error('SDK unavailable');events.push({event,properties:JSON.parse(JSON.stringify(properties))});},identify:id=>ids.push(id),reset:()=>ids.push('reset')};
 const state={stage:'intro',qStep:0,tab:'today',profile:{days:7,members:[{},{}]},pantry:[],eaten:{},plan:{status:'draft',days:[{date:'2026-10-23',slots:{l_soup:{rid:'m1',serv:2,cooked:false}}}]}};
 const doc={hidden:false,referrer:'https://search.example/path?private=value',hasFocus:()=>true,addEventListener:(n,f)=>(listeners[n]||=[]).push(f),createElement:()=>({}),head:{append(script){scripts.push(script);}}};
 const ctx=vm.createContext({window:{...(mock?{__FRIGO_POSTHOG_TEST_CLIENT__:sdk}:{}),addEventListener:(n,f)=>(listeners[n]||=[]).push(f)},document:doc,location:{hostname,search:'?utm_source=campaign&utm_medium=social&utm_campaign=launch&token=secret'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,crypto:{randomUUID:()=>String(++uuid)},Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}},setInterval:fn=>{interval=fn;},S:state,UI:{sheet:null,cook:null},FamilyMenuApi:{session:null},render:()=>42,track:()=>{},kindOfKey8:()=> 'soup',slotRecipe:()=>({id:'m1'}),eatKey:(d,k)=>d+':'+k,scan8:async()=>{ctx.UI.scan={products:[{}]};}});
 ctx.generate=()=>{if(generationThrows){ctx.S.plan={...ctx.S.plan};throw Error('Generation failed');}};
 ctx.build=()=>{ctx.S.stage='gen';ctx.render();};
 ctx.completeDish=(d,k)=>{const slot=ctx.S.plan.days[d].slots[k];if(slot.cooked)return false;slot.cooked=true;return true;};
 ctx.act=(action,value)=>{if(action==='introNext8')ctx.S.stage='quiz';if(action==='qNext8')ctx.S.qStep++;if(action==='build8')ctx.build();if(action==='approve')ctx.S.plan.status='approved';if(action==='cook'&&ctx.S.plan.status==='approved')ctx.UI.cook={day:0,slot:'l_soup'};if(action==='cnext')ctx.completeDish(0,'l_soup');if(action==='recipe')ctx.UI.sheet={type:'recipe',day:0,slot:'l_soup'};ctx.render();};
 vm.runInContext(source,ctx);
 return {ctx,events,ids,storage,scripts,emit:n=>listeners[n]?.forEach(fn=>fn({target:{dataset:{}}})),tick:ms=>{now+=ms;interval?.();},advance:ms=>{now+=ms;},named:name=>events.filter(e=>e.event===name)};
}
test('explicit onboarding, generation and screen events are not duplicated by re-renders',()=>{
 const s=setup();s.ctx.render();s.ctx.render();assert.equal(s.named('app_opened').length,1);assert.equal(s.named('screen_viewed').length,1);
 s.ctx.act('introNext8');s.ctx.render();assert.equal(s.named('onboarding_started').length,1);s.ctx.act('qNext8');assert.equal(s.named('onboarding_step_completed')[0].properties.step_number,1);
 s.ctx.act('build8');s.advance(2000);s.ctx.S.plan={...s.ctx.S.plan};s.ctx.S.stage='ready';s.ctx.render();s.ctx.render();assert.equal(s.named('menu_generation_finished').length,1);assert.equal(s.named('menu_generation_finished')[0].properties.success,true);assert.equal(s.named('menu_preview_viewed').length,1);assert.ok(s.events.findIndex(e=>e.event==='menu_generation_finished')<s.events.findIndex(e=>e.event==='menu_preview_viewed'),'Funnel events keep their actual order');
});
test('anonymous actions merge on login, restore does not count as a new login, logout resets identity',()=>{
 const s=setup();s.ctx.render();s.ctx.act('telegramStart');s.ctx.FamilyMenuApi.session={user:{id:'internal-id',login:'@private',email:'private@example.com'}};s.ctx.render();assert.deepEqual(s.ids,['user:internal-id']);assert.equal(s.named('sign_in_finished').length,1);s.ctx.render();assert.equal(s.named('sign_in_finished').length,1);
 s.ctx.FamilyMenuApi.session=null;s.ctx.render();assert.equal(s.ids.at(-1),'reset');assert.ok(!JSON.stringify(s.events).includes('private'));
 const restored=setup();restored.ctx.FamilyMenuApi.session={user:{id:'restored'}};restored.ctx.render();assert.equal(restored.named('sign_in_finished').length,0);
});
test('absolute cooking events count a start and one successful completion, with a stable run ID',()=>{
 const s=setup();s.ctx.S.stage='app';s.ctx.render();s.ctx.act('approve');s.ctx.act('approve');assert.equal(s.named('menu_approved').length,1);s.ctx.act('cook');s.ctx.UI.cook=null;s.ctx.act('cook');s.advance(45000);s.ctx.act('cnext');s.ctx.act('cnext');assert.equal(s.named('cooking_started').length,1);assert.equal(s.named('cooking_completed').length,1);assert.equal(s.named('cooking_completed')[0].properties.duration_seconds,45);assert.equal(s.named('cooking_completed')[0].properties.cooking_run_id,s.named('cooking_started')[0].properties.cooking_run_id);
});
test('engagement excludes hidden and idle time and interactions do not create an event flood',()=>{
 const s=setup();s.ctx.render();s.tick(15000);assert.equal(s.named('engagement_tick')[0].properties.active_seconds,15);
 for(let n=0;n<40;n++)s.emit('scroll');assert.equal(s.named('engagement_tick').length,1);
 s.tick(90000);assert.equal(s.named('engagement_tick').reduce((sum,e)=>sum+e.properties.active_seconds,0),75);
 s.ctx.document.hidden=true;s.emit('visibilitychange');s.tick(60000);assert.equal(s.named('engagement_tick').reduce((sum,e)=>sum+e.properties.active_seconds,0),75);
 s.ctx.document.hidden=false;s.emit('visibilitychange');s.tick(10000);assert.equal(s.named('engagement_tick').at(-1).properties.active_seconds,10);
});
test('acquisition captures only selected UTM values and never full referrers or arbitrary query parameters',()=>{
 const s=setup();s.ctx.render();const p=s.named('app_opened')[0].properties;assert.equal(p.first_source,'campaign');assert.equal(p.first_campaign,'launch');assert.ok(!JSON.stringify(s.events).includes('token'));assert.ok(!JSON.stringify(s.events).includes('private=value'));assert.ok(!('audience' in p));
});
test('SDK failures cannot break app rendering/actions; localhost has no analytics by default',()=>{
 const broken=setup({sdkThrows:true});assert.equal(broken.ctx.render(),42);assert.doesNotThrow(()=>broken.ctx.act('introNext8'));assert.equal(broken.ctx.S.stage,'quiz');
 const local=setup({mock:false});assert.equal(local.ctx.window.FamilyMenuAnalytics,undefined);assert.equal(local.ctx.render(),42);
});

test('only a final sign-in failure is counted, and one attempt cannot fail twice',()=>{const s=setup();s.ctx.render();s.ctx.act('telegramStart');s.ctx.UI.authError='transient polling error';s.ctx.render();assert.equal(s.named('sign_in_finished').length,0);s.ctx.window.FamilyMenuAnalytics.signInFailed();s.ctx.window.FamilyMenuAnalytics.signInFailed();assert.equal(s.named('sign_in_finished').length,1);assert.equal(s.named('sign_in_finished')[0].properties.success,false);});

test('production SDK is asynchronous, explicit-only, and flushes queued events on load',()=>{const s=setup({hostname:'frigo-family-menu.pages.dev',mock:false});s.ctx.render();assert.equal(s.events.length,0);assert.equal(s.scripts.length,1);let config;s.ctx.window.posthog={init:(token,options)=>{assert.ok(token.startsWith('phc_'));config=options;options.loaded({capture:(event,properties)=>s.events.push({event,properties}),identify:()=>{},reset:()=>{}});}};s.scripts[0].onload();assert.equal(s.named('app_opened').length,1);assert.equal(config.autocapture,false);assert.equal(config.capture_pageview,false);assert.equal(config.disable_session_recording,true);assert.equal(config.capture_heatmaps,false);});

test('a generation failure is tracked even if a partial plan was assigned',()=>{const s=setup({generationThrows:true});s.ctx.render();s.ctx.build();assert.throws(()=>s.ctx.generate());s.ctx.S.stage='quiz';s.ctx.render();assert.equal(s.named('menu_generation_finished').length,1);assert.equal(s.named('menu_generation_finished')[0].properties.success,false);});
