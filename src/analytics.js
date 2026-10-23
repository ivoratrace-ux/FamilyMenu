/* Explicit product events only. This is a public ingestion token; management keys stay off the client. */
(() => {
  const local=/^(localhost|127\.0\.0\.1)$/.test(location.hostname),mock=local&&window.__FRIGO_POSTHOG_TEST_CLIENT__;
  if(local&&!mock)return;
  const TOKEN='phc_Cxn93nUxLyjSVxAyeNpmvFL4J8zoDK6iu2372Jb5YPQM';
  let client=null,queue=[],opened=false,lastScreen='',identity=null,loginAttempt=false,generation=null,onboarding=false;
  const safe=fn=>{try{return fn();}catch{}},uid=()=>crypto.randomUUID();
  const invoke=(method,...args)=>safe(()=>{if(client)client[method](...args);else if(queue.length<200)queue.push([method,...args]);});
  const read=key=>safe(()=>JSON.parse(localStorage.getItem(key))),write=(key,value)=>safe(()=>localStorage.setItem(key,JSON.stringify(value)));
  const query=new URLSearchParams(location.search),ref=safe(()=>new URL(document.referrer).hostname)||'';
  const first=read('frigo-acquisition-v1')||{first_source:query.get('utm_source')?.slice(0,100)||(!['ivoratrace-ux.github.io','frigo-family-menu.pages.dev',location.hostname].includes(ref)&&ref?ref:'direct'),first_medium:query.get('utm_medium')?.slice(0,100)||'',first_campaign:query.get('utm_campaign')?.slice(0,100)||''};
  write('frigo-acquisition-v1',first);
  const common={app:'Frigo',analytics_version:1,surface:location.hostname,...first};
  function capture(event,properties={}){invoke('capture',event,{...common,...properties},{timestamp:new Date()});}
  function install(sdk){client=sdk;for(const [method,...args] of queue)safe(()=>client[method](...args));queue=[];}
  if(mock)install(mock);
  else {
    const script=document.createElement('script');script.async=true;script.src='https://us-assets.i.posthog.com/static/array.js';
    script.onload=()=>safe(()=>window.posthog.init(TOKEN,{api_host:'https://us.i.posthog.com',ui_host:'https://us.posthog.com',autocapture:false,capture_pageview:false,capture_pageleave:false,capture_dead_clicks:false,capture_exceptions:false,capture_heatmaps:false,capture_performance:false,disable_session_recording:true,disable_surveys:true,advanced_disable_feature_flags:true,advanced_disable_feature_flags_on_first_load:true,person_profiles:'identified_only',persistence:'localStorage',save_referrer:false,store_google:false,property_blacklist:['$current_url','$referrer','$initial_referrer','$initial_current_url'],sanitize_properties:properties=>{for(const key of ['$current_url','$referrer','$initial_referrer','$initial_current_url']){delete properties[key];for(const field of ['$set','$set_once'])if(properties[field])delete properties[field][key];}return properties;},loaded:install}));
    script.onerror=()=>{queue=[];};document.head.append(script);
  }
  const feature=(action,properties={})=>capture('feature_used',{action,...properties});
  const recipeInfo=(di,k)=>{const r=slotRecipe(di,k),id=r?.base8||r?.id||'';return {recipe_id:/^(?:[a-z]\d+|c_[a-z]\d+_[a-z]\d+|u[a-z0-9]+)$/.test(id)?id:'custom_recipe',category:kindOfKey8(k)};};
  const cookKey=(di,k)=>S.plan.days[di].date.slice(0,10)+':'+k+':'+S.plan.days[di].slots[k].rid;
  const runs=read('frigo-cooking-runs-v1')||{};
  function screen(){if(UI.cook)return 'cooking';if(UI.sheet?.type==='recipe')return 'recipe_preview';if(UI.sheet?.type==='replace')return 'recipe_replacement';return S.stage==='app'?S.tab:S.stage==='quiz'?'onboarding':S.stage==='ready'?'menu_preview':S.stage==='gen'?'menu_generation':S.stage;}
  function observe(){
    const user=FamilyMenuApi.session?.user?.id||null;
    if(user!==identity){
      flushEngagement();
      if(identity&&!user)invoke('reset');
      identity=user;if(user)invoke('identify','user:'+user);
      if(loginAttempt&&user){capture('sign_in_finished',{success:true,provider:'telegram'});loginAttempt=false;}
    }
    if(!opened){opened=true;lastTick=Date.now();lastInteraction=lastTick;activeSeconds=0;capture('app_opened',{authenticated:!!user});}
    if(generation&&S.stage!=='gen'){
      capture('menu_generation_finished',{success:generation.success??(S.plan!==generation.plan),duration_seconds:Math.round((Date.now()-generation.started)/100)/10,source:generation.source});generation=null;
    }
    const current=screen(),key=current+(current==='onboarding'?':'+S.qStep:'');
    if(key!==lastScreen){flushEngagement();lastScreen=key;capture('screen_viewed',{screen_name:current,...(current==='onboarding'?{step_number:(S.qStep||0)+1}:{})});if(current==='menu_preview')capture('menu_preview_viewed');}
    if(S.stage==='quiz'&&!onboarding){onboarding=true;capture('onboarding_started');}
  }
  let lastTick=Date.now(),lastInteraction=lastTick,visible=!document.hidden,focused=document.hasFocus(),activeSeconds=0;
  function accrueEngagement(){
    const now=Date.now(),end=Math.min(now,lastInteraction+60000),seconds=visible&&focused?Math.max(0,end-lastTick)/1000:0;lastTick=now;
    if(opened)activeSeconds+=seconds;
  }
  function flushEngagement(){accrueEngagement();if(activeSeconds>0){capture('engagement_tick',{screen_name:lastScreen.split(':')[0],active_seconds:Math.round(activeSeconds*100)/100});activeSeconds=0}}
  for(const name of ['pointerdown','keydown','scroll','touchstart'])document.addEventListener(name,()=>{accrueEngagement();lastInteraction=Date.now();},{passive:true,capture:true});
  document.addEventListener('visibilitychange',()=>{flushEngagement();visible=!document.hidden;if(visible)lastInteraction=Date.now();});
  window.addEventListener('focus',()=>{flushEngagement();focused=true;lastInteraction=Date.now();});
  window.addEventListener('blur',()=>{flushEngagement();focused=false;});
  window.addEventListener('pagehide',flushEngagement);setInterval(flushEngagement,15000);
  const renderOriginal=render;render=function(){const result=renderOriginal();safe(observe);return result;};
  const buildOriginal=build;build=function(){generation={plan:S.plan,started:Date.now(),source:S.stage==='quiz'?'onboarding':'rebuild'};return buildOriginal();};
  const generateOriginal=generate;generate=function(){try{const result=generateOriginal();if(generation)generation.success=true;return result;}catch(error){if(generation)generation.success=false;throw error;}};
  const completeOriginal=completeDish;completeDish=function(di,k){const info=safe(()=>recipeInfo(di,k)),key=safe(()=>cookKey(di,k)),run=runs[(identity||'anonymous')+':'+key];const result=completeOriginal(di,k);if(result)capture('cooking_completed',{...info,...(run?{cooking_run_id:run.id,duration_seconds:Math.round((Date.now()-run.started)/1000)}:{})});return result;};
  const scanOriginal=scan8;scan8=async function(){const photos=UI.photos?.length||0;await scanOriginal();feature('pantry_scan_finished',{success:!!UI.scan&&!UI.scanErr,photo_count:photos,product_count:UI.scan?.products?.length||0});};
  const trackOriginal=track;track=function(name,properties){trackOriginal(name,properties);if(/^list_shared_(native|telegram|clipboard)$/.test(name))feature('shopping_list_shared',{method:name.slice(12)});};
  const actionOriginal=act;act=function(action,value,element){
    const before=safe(()=>({stage:S.stage,step:S.qStep,tab:S.tab,status:S.plan?.status,stock:JSON.stringify(S.pantry),rid:UI.sheet?.type==='replace'?S.plan.days[UI.sheet.day].slots[UI.sheet.slot].rid:null,sheet:UI.sheet?{...UI.sheet}:null,cook:UI.cook,scan:UI.scan}));
    if(action==='telegramStart'||action==='telegramRetry'){loginAttempt=true;}
    if(action==='reset')onboarding=false;
    const result=actionOriginal(action,value,element);
    safe(()=>{
      if(!before)return;
      if(before.stage==='quiz'&&((action==='qNext8'&&S.qStep>before.step)||(action==='build8'&&S.stage==='gen')))capture('onboarding_step_completed',{step_number:before.step+1});
      if(['approve','approve8'].includes(action)&&before.status!=='approved'&&S.plan?.status==='approved')capture('menu_approved',{day_count:S.profile.days,person_count:S.profile.members.length});
      if(action==='recipe'&&UI.sheet?.type==='recipe')feature('recipe_preview_opened');
      if(['doReplace','side8'].includes(action)&&before.sheet&&S.plan.days[before.sheet.day].slots[before.sheet.slot].rid!==before.rid)capture('recipe_replaced',{category:kindOfKey8(before.sheet.slot)});
      if(action==='cook'&&UI.cook&&!before.cook&&!S.plan.days[UI.cook.day].slots[UI.cook.slot].cooked){const {day,slot}=UI.cook,key=(identity||'anonymous')+':'+cookKey(day,slot);if(!runs[key]){const run=runs[key]={id:uid(),started:Date.now()};write('frigo-cooking-runs-v1',Object.fromEntries(Object.entries(runs).slice(-100)));capture('cooking_started',{...recipeInfo(day,slot),cooking_run_id:run.id});}}
      if(action==='eat')feature('meal_marked_eaten',{marked:!!S.eaten[eatKey(...value.split(':'))]});
      if(before.stock!==JSON.stringify(S.pantry)){
        if(action==='bought')feature('shopping_item_added_home');
        else if(action==='scanSave')feature('pantry_updated',{method:'scan'});
        else if(['pantryStep8','pqty','delP','pt8','pt8s','addP'].includes(action)&&S.stage==='app')feature('pantry_updated',{method:'manual'});
      }
      const section=['pFamily','pFood','pDays','pBudget'].includes(before.tab)?before.tab:null;
      if(S.stage==='app'&&section&&['madd','mdel','mset','days8','kind8','diet8','dislike8','allergy','goal8','goal'].includes(action))feature('preferences_changed',{section});
    });return result;
  };
  document.addEventListener('change',event=>{if(S.stage==='app'&&['budget','city'].includes(event.target.dataset?.act))feature('preferences_changed',{section:'pBudget'});});
  window.FamilyMenuAnalytics={capture,flushEngagement,signInFailed(){if(loginAttempt){capture('sign_in_finished',{success:false,provider:'telegram'});loginAttempt=false;}}};
})();
