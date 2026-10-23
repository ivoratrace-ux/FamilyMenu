/* ============ DERIVED RECIPE DATA ============ */
const RBY=Object.fromEntries(R.map(r=>[r.id,r]));
function nutOf(k,q){const d=ING[k],n=d[6]||[0,0,0,0],f=(d[2]==='g'||d[2]==='ml')?q/100:q;return n.map(x=>x*f)}
function deriveRecipe(r){
  const a=new Set(),f=new Set(); let nut=[0,0,0,0];
  r.i.forEach(([k,q])=>{const d=ING[k];(d[4]||[]).forEach(x=>a.add(x));(d[5]||[]).forEach(x=>f.add(x));const n=nutOf(k,q);nut=nut.map((v,i)=>v+n[i]);});
  r.allerg=[...a]; r.flags=[...f];
  r.kcal=Math.round(nut[0]/4); r.P=Math.round(nut[1]/4); r.F=Math.round(nut[2]/4); r.C=Math.round(nut[3]/4);
  const keys=r.i.map(([k])=>k);
  if(keys.some(k=>k.startsWith('minced'))&&!r.tags.includes('mince')) r.tags.push('mince');
  if(keys.some(k=>k==='fish_white'||k==='cod')&&!r.tags.includes('whitefish')) r.tags.push('whitefish');
  if(r.t<=30&&!r.tags.includes('quick')) r.tags.push('quick');
  r.protein=(r.i.find(([k])=>(ING[k][5]||[]).some(x=>['meat','fish','seafood'].includes(x)))||[null])[0];
  r.veg=r.i.filter(([k])=>ING[k][1]==='Овощи и зелень'&&ING[k][2]==='g').reduce((s,[,q])=>s+q,0)/4;
}
R.forEach(deriveRecipe);
const SLOT_NAMES={b:'Завтрак',l:'Обед',s:'Перекус',d:'Ужин',z:'Десерт',k:'Напиток'};
const SLOTS=['b','l','s','d','z','k'];
const cityCoef=()=>(CITIES[S.profile.city]||CITIES.msk)[1];
const price=k=>storePrice(S.store||'vv',k)*cityCoef();
const rc=r=>r.i.reduce((s,[k,q])=>s+q*price(k),0)/4;
const DISLIKE_POPULAR=['onion','mushrooms','beet','cabbage','zucchini','eggplant','bell_pepper','cottage','liver','chicken_liver','fish_white','pumpkin','celery','garlic','lentils','buckwheat','squid','tofu'].filter(k=>ING[k]);

/* ============ STATE ============ */
const KEY='family-menu-web-draft-v1';
let mid=1; const newMember=(kind,name)=>({id:'m'+Date.now().toString(36)+(mid++),name,kind,sex:'',age:kind==='child'?'7':'',weight:'',height:'',act:'mid',goal:'keep',custom:'',open:false});
const blank=()=>({
  stage:'intro', tab:'today', onbStep:0, introIdx:0, qStep:0, user:null, store:'vv',
  profile:{members:[newMember('adult','Я'),newMember('adult','Партнёр'),newMember('child','Ребёнок')],likes:['t:kids','i:chicken_fillet'],dislikes:[],allergies:[],diet:'all',goals:[],budget:8000,budgetSet:false,kcalOn:false,city:'msk',maxTime:45,meals:{b:false,l:true,s:false,d:true,z:false,k:false},soupBatch:true,reminder:{on:true,time:'20:00'}},
  pantry:[], plan:null, bought:{}, eaten:{}, extra:{}, history:{liked:[],disliked:[],blocked:[],replaced:[]}, remShown:'',
  v4:{trialStart:null,sub:null,shift:0,ul:{},seen:{},ev:[],weeks:0}
});
let S=blank();
try {const draft=JSON.parse(localStorage.getItem(KEY));if(draft && !draft.user) S={...blank(),...draft,user:null};}catch{}
function save(){window.FamilyMenuBridge?.changed()}
let UI={sheet:null,open:{},q:'',dq:'',member:null};

/* ============ HELPERS ============ */
const $=s=>document.querySelector(s);
const NOW=()=>new Date(Date.now()+((S&&S.v4&&S.v4.shift)||0)*864e5);
const KC=()=>!!(S&&S.profile&&S.profile.kcalOn);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rub=n=>Math.round(n).toLocaleString('ru-RU')+' ₽';
const num=n=>Math.round(n).toLocaleString('ru-RU');
const dec=n=>(Math.round(n*10)/10).toLocaleString('ru-RU');
const DOW=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const DOWL=['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const MON=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONS=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const day0=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
function plural(n,a,b,c){n=Math.abs(Math.round(n))%100;const n1=n%10;if(n>10&&n<20)return c;if(n1>1&&n1<5)return b;if(n1===1)return a;return c}
const ACT={low:['Мало двигается',1.2],mid:['Умеренно',1.375],high:['Активно',1.55],sport:['Спорт 4+ раз в неделю',1.725]};
const MGOAL={keep:['Поддерживать вес',1],lose:['Похудеть',.85],gain:['Набрать массу',1.15]};
function need(m){
  if(+m.custom>0) return {kcal:Math.round(+m.custom),exact:true,custom:true};
  const a=+m.age,w=+m.weight,h=+m.height,gf=MGOAL[m.goal||'keep'][1],af=ACT[m.act||'mid'][1]/1.375;
  if(m.kind==='child'){
    let v; if(!a) return {kcal:1700,exact:false};
    if(a<=3) v=1200; else if(a<=6) v=1600; else if(a<=10) v=1900; else if(a<=14) v=m.sex==='m'?2400:2200; else v=m.sex==='m'?2800:2300;
    return {kcal:Math.round(v*af/50)*50,exact:true};
  }
  if(m.sex&&a&&w&&h){const bmr=10*w+6.25*h-5*a+(m.sex==='m'?5:-161);return {kcal:Math.round(bmr*ACT[m.act||'mid'][1]*gf/50)*50,exact:true}}
  const base=m.sex==='m'?2500:m.sex==='f'?2000:2200; return {kcal:Math.round(base*af*gf/50)*50,exact:false};
}
const pfactor=m=>Math.max(.4,Math.min(1.6,Math.round(need(m).kcal/2200*10)/10));
function portions(){return Math.max(1,Math.ceil(S.profile.members.reduce((s,m)=>s+pfactor(m),0)-0.05))}
function fmtQty(k,q,buy){
  const u=ING[k][2];
  if(u==='g'){ if(q>=1000) return dec(q/1000)+' кг'; return (q<50?Math.round(q/5)*5:Math.round(q/10)*10)+' г'}
  if(u==='ml'){ if(q>=1000) return dec(q/1000)+' л'; return (q<50?Math.round(q/5)*5:Math.round(q/10)*10)+' мл'}
  let v= buy? Math.ceil(q-0.001) : Math.round(q*2)/2; if(v===0) v=0.5;
  const t=v===0.5?'½':(v%1?(Math.floor(v)+'½'):String(v));
  const F={'пучок':['пучок','пучка','пучков'],'банка':['банка','банки','банок']}[u];
  return t+' '+(F&&v%1===0?plural(v,...F):(F&&v<1?F[1]:u));
}
const unitLabel=k=>{const u=ING[k][2];return u==='g'?'г':u==='ml'?'мл':u};

/* ============ RULES ============ */
function dietOk(r,d){
  const f=r.flags;
  if(d==='halal') return !f.includes('pork');
  if(d==='pesc') return !f.includes('meat');
  if(d==='veg') return !f.some(x=>['meat','fish','seafood'].includes(x));
  if(d==='vegan') return !f.some(x=>['meat','fish','seafood','dairy','egg','honey'].includes(x));
  if(d==='lent') return !f.some(x=>['meat','dairy','egg'].includes(x));
  return true;
}
function allowed(r){
  const p=S.profile;
  if(r.allerg.some(a=>p.allergies.includes(a))) return false;
  if(!dietOk(r,p.diet)) return false;
  if(r.i.some(([k])=>p.dislikes.includes(k))) return false;
  if(S.history.blocked.includes(r.id)) return false;
  return true;
}
function likeHits(r){return S.profile.likes.filter(t=>t.startsWith('i:')?r.i.some(([k])=>k===t.slice(2)):r.tags.includes(t.slice(2)))}
function goalScore(r){
  const g=S.profile.goals, k=r.m==='b'?.7:1; let s=0;
  if(g.includes('protein')) s+= r.P>=30*k?3:(r.P<15*k?-2:0);
  if(g.includes('lowcarb')) s+= r.C<=25*k?3:(r.C>60*k?-3:0);
  if(g.includes('lose')) s+= r.kcal<=450*k?3:(r.kcal>650*k?-3:0);
  if(g.includes('mass')) s+= (r.kcal>=600*k?2:(r.kcal<400*k?-2:0))+(r.P>=30*k?1:0);
  if(g.includes('pp')) s+= (r.kcal>=300*k&&r.kcal<=650*k&&r.F<=25*k?1:0)+(r.veg>=100?1:0)-(r.F>35?1:0);
  return s;
}
function mealsPerDay(){const m=S.profile.meals;return (m.b?1:0)+(m.l?(S.profile.soupBatch?.5:1):0)+(m.d?1:0)+(m.s?.3:0)+(m.z?.3:0)+(m.k?.2:0)}
function score(r,ctx){
  const p=S.profile; let s=0;
  s+=likeHits(r).length*2;
  const pk=new Set(S.pantry.map(x=>x.key));
  s+=r.i.filter(([k])=>pk.has(k)).length*1.2;
  if(S.history.liked.includes(r.id)) s+=1.5;
  if(S.history.disliked.includes(r.id)) s-=3;
  s+=goalScore(r);
  const target=p.budget/(7*Math.max(1,mealsPerDay())*portions());
  const rcost=rc(r)*(r.m==='b'||r.m==='m'?1:3); if(rcost>target) s-=Math.min(4,(rcost-target)/target*3);
  if(ctx&&ctx.prevProtein&&r.protein===ctx.prevProtein) s-=2;
  if(ctx&&ctx.reason==='time') s-=r.t/20;
  if(ctx&&ctx.reason==='cost') s-=rc(r)/60;
  if(ctx&&ctx.slot==='d'&&r.protein&&!r.tags.includes('salad')) s+=1.5;
  if(ctx&&ctx.reason==='pantry') s+=r.i.filter(([k])=>pk.has(k)).length*2;
  if(ctx&&ctx.reason==='light') s-=r.kcal/120;
  return s;
}
const isSoup=r=>r.tags.includes('soup');
function poolFor(slot){
  if(slot==='l'){const c=R.filter(r=>r.m==='m'&&isSoup(r)&&allowed(r)); return c.length?c:R.filter(r=>r.m==='m'&&allowed(r))}
  if(slot==='d'){const c=R.filter(r=>r.m==='m'&&!isSoup(r)&&allowed(r)); return c.length?c:R.filter(r=>r.m==='m'&&allowed(r))}
  return R.filter(r=>r.m===slot&&allowed(r));
}
function pick(slot,used,weekend,ctx){
  const p=S.profile; ctx=Object.assign({slot},ctx||{});
  let c=poolFor(slot); if(!c.length) return null;
  const maxT=p.maxTime?(weekend?p.maxTime+30:p.maxTime):999;
  const ct=c.filter(r=>r.t<=maxT); if(ct.length) c=ct;
  const cnt=id=>(used.cnt&&used.cnt[id])||0; const minU=Math.min(...c.map(r=>cnt(r.id)));
  const pool=c.filter(r=>cnt(r.id)===minU);
  const ranked=pool.map(r=>({r,s:score(r,ctx)+Math.random()*1.6})).sort((a,b)=>b.s-a.s);
  const top=ranked.slice(0,3); const ch=top[Math.floor(Math.random()*top.length)].r;
  used.cnt=used.cnt||{}; used.cnt[ch.id]=cnt(ch.id)+1; return ch;
}
function generate(){
  const p=S.profile,start=day0(NOW()),used={},por=portions(); let prev=null; const days=[];
  for(let d=0;d<7;d++){
    const date=addDays(start,d),wd=date.getDay(),weekend=wd===0||wd===6,slots={};
    if(p.meals.b){const r=pick('b',used,weekend);slots.b={rid:r&&r.id,serv:por}}
    if(p.meals.l){
      if(p.soupBatch&&d%2===1) slots.l={left:true,from:d-1,of:'l'};
      else {const r=pick('l',used,weekend);slots.l={rid:r&&r.id,serv:(p.soupBatch&&d<6)?por*2:por}}
    }
    if(p.meals.s){const r=pick('s',used,weekend);slots.s={rid:r&&r.id,serv:por}}
    if(p.meals.d){const r=pick('d',used,weekend,{prevProtein:prev});slots.d={rid:r&&r.id,serv:por}; if(r)prev=r.protein}
    if(p.meals.z){const r=pick('z',used,weekend);slots.z={rid:r&&r.id,serv:por}}
    if(p.meals.k){const r=pick('k',used,weekend);slots.k={rid:r&&r.id,serv:por}}
    days.push({date:date.toISOString(),slots});
  }
  S.plan={created:NOW().toISOString(),status:'draft',days}; S.bought={}; S.eaten={}; S.extra={}; fixLeftovers();
}
function slotRecipe(day,key){const s=S.plan.days[day].slots[key]; if(!s) return null; if(s.left){const src=S.plan.days[s.from].slots[s.of||'l']; return src&&src.rid?RBY[src.rid]:null} return s.rid?RBY[s.rid]:null}
const srcRef=(di,k)=>{const s=S.plan.days[di].slots[k];return s&&s.left?`${s.from}:${s.of||'l'}`:`${di}:${k}`};
const srcSlot=(di,k)=>{const s=S.plan.days[di].slots[k];return s.left?S.plan.days[s.from].slots[s.of||'l']:s};
function needMap(plan){
  const m={},spices=new Set();
  plan.days.forEach(d=>Object.values(d.slots).forEach(s=>{
    if(!s||s.left||!s.rid||!s.serv) return; const r=RBY[s.rid],f=s.serv/4; if(!r) return;
    r.i.forEach(([k,q])=>{if(!m[k]) m[k]={qty:0,dishes:new Set()}; m[k].qty+=q*f; m[k].dishes.add(r.n)});
    (r.sp||[]).forEach(x=>spices.add(x));
  }));
  return {m,spices};
}
const pantryQty=k=>S.pantry.filter(x=>x.key===k).reduce((s,x)=>s+(+x.qty||0),0);
const fromList=k=>S.pantry.some(x=>x.key===k&&x.src==='list');
function shopping(){
  if(!S.plan) return {items:[],spices:[],cost:0};
  const {m,spices}=needMap(S.plan),items=[];
  Object.entries(m).forEach(([k,v])=>{
    const pq=pantryQty(k),toBuy=Math.max(0,v.qty-pq),u=ING[k][2],buyQ=(u==='g'||u==='ml')?toBuy:Math.ceil(toBuy-0.001);
    items.push({k,name:ING[k][0],cat:ING[k][1],need:v.qty,pq,toBuy:buyQ,dishes:[...v.dishes],covered:toBuy<=0.0001,bought:!!S.bought[k],cost:buyQ*price(k)});
  });
  items.sort((a,b)=>CAT_ORDER.indexOf(a.cat)-CAT_ORDER.indexOf(b.cat)||a.name.localeCompare(b.name,'ru'));
  return {items,spices:[...spices].sort((a,b)=>a.localeCompare(b,'ru')),cost:items.filter(i=>!i.covered).reduce((s,i)=>s+i.cost,0)};
}
function markHave(k,qtyNeeded){
  const add=Math.max(0,qtyNeeded-pantryQty(k)); const u=ING[k][2];
  const q=(u==='g'||u==='ml')?Math.round(add):Math.ceil(add-0.001);
  if(q>0) S.pantry.push({key:k,qty:q,src:'list'});
}
const unmarkHave=k=>{S.pantry=S.pantry.filter(x=>!(x.key===k&&x.src==='list'))};
function todayIdx(){if(!S.plan) return -1; const t=day0(NOW()).getTime(); return S.plan.days.findIndex(d=>day0(d.date).getTime()===t)}
function dateLabel(iso,long){const d=new Date(iso); return long?`${DOWL[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`:`${DOW[d.getDay()]}, ${d.getDate()} ${MONS[d.getMonth()]}`}
const SLOT_END={b:11,l:15.5,s:17.5,d:21.5,z:23,k:24};
function nextSlotKey(day){const sl=S.plan.days[day].slots,h=NOW().getHours()+NOW().getMinutes()/60;
  const keys=SLOTS.filter(k=>sl[k]&&k!=='k');
  const k=keys.find(k=>SLOT_END[k]>h&&!S.eaten[eatKey(day,k)]); return k||keys.find(k=>!S.eaten[eatKey(day,k)])||keys[keys.length-1]||mainSlotKey(day)}
function mainSlotKey(day){const s=S.plan.days[day].slots; return s.d?'d':(s.l?'l':(s.b?'b':Object.keys(s)[0]))}
function dayKcal(di){return Object.keys(S.plan.days[di].slots).reduce((s,k)=>{const r=slotRecipe(di,k);return s+(r?r.kcal:0)},0)}
const eatKey=(di,k)=>S.plan.days[di].date.slice(0,10)+':'+k;
function eatenKcal(di){return Object.keys(S.plan.days[di].slots).reduce((s,k)=>{const r=slotRecipe(di,k);return s+(r&&S.eaten[eatKey(di,k)]?r.kcal:0)},0)}

/* ============ ICONS ============ */
const IC={
 today:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M9 3h6"/></svg>',
 menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M9 3v4M15 3v4M8 13h3M8 16h6"/></svg>',
 shop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.3 11.1a1 1 0 0 1-1 .9H7.3a1 1 0 0 1-1-.9z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 10h12M9 6.5v1.5M9 13v2.5"/></svg>',
 profile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14.5 15.5a4 4 0 0 1 6 3.5"/></svg>',
 bell:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
 burger:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
 tag:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>',
 scale:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z"/></svg>',
 logout:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/></svg>',
 pot:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 10h2M20 10h2M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2"/></svg>',
};

/* ============ RENDER ============ */
function render(){
  const app=$('#app');
  if(S.stage==='welcome') app.innerHTML=welcome();
  else if(S.stage==='onb') app.innerHTML=onboarding();
  else if(S.stage==='gen') app.innerHTML=`<div class="screen"><div class="loader"><div class="spin" aria-hidden="true"></div><h2>Подбираем меню на неделю</h2><p class="muted small">Учитываем семью, ограничения, калории, время и бюджет</p></div></div>`;
  else app.innerHTML=({today:scrToday,menu:scrMenu,shop:scrShop,home:scrHome,profile:scrProfile}[S.tab])()+tabs();
  renderSheet(); renderCook(); paintTimers();
}
function tabs(){
  const left=shopping().items.filter(i=>!i.covered&&!i.bought).length;
  const t=[['today','Сегодня'],['menu','Меню'],['shop','Покупки'],['home','Дома'],['profile','Семья']];
  return `<div class="tabs"><nav aria-label="Разделы">${t.map(([k,l])=>`<button data-act="tab" data-v="${k}" ${S.tab===k?'aria-current="page"':''}>${IC[k]}<span>${l}</span>${k==='shop'&&left?`<span class="badge">${left}</span>`:''}</button>`).join('')}</nav></div>`;
}
function welcome(){
  const sample=['m3','b1','m5','m10'].map(id=>RBY[id]);
  return `<div class="screen" style="justify-content:center;gap:20px;padding-bottom:40px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${sample.map(r=>`<div class="heroimg">${dishArt(r)}</div>`).join('')}</div>
    <div class="stack" style="gap:10px"><h1>Меню на неделю для вашей семьи</h1>
    <p class="muted">Расскажите о семье — получите меню на 7 дней с калориями, рецепты с граммовками и готовый список покупок. Заменили блюдо — список пересчитается сам.</p></div>
    <div class="stack"><button class="btn block" data-act="start">Начать</button>
    <button class="btn ghost block" data-act="demo">Посмотреть на примере семьи</button></div>
    <p class="proto">Прототип, версия 2 · ${R.length} рецептов · данные хранятся только в этом браузере</p></div>`;
}
function chips(list,sel,act,cls=''){return `<div class="chips">${Object.entries(list).map(([k,l])=>`<button class="chip ${cls}" data-act="${act}" data-v="${esc(k)}" aria-pressed="${sel.includes(k)}">${l}</button>`).join('')}</div>`}
function memberCard(m,i){
  if(!KC()) return memberLite(m,i);
  const n=need(m),pf=pfactor(m);
  const sexC=`<div class="chips">${[['f','Ж'],['m','М']].map(([k,l])=>`<button class="chip" data-act="mset" data-v="${i}:sex:${k}" aria-pressed="${m.sex===k}">${l}</button>`).join('')}</div>`;
  return `<div class="card member">
   <div class="row"><input type="text" id="mn_${m.id}" value="${esc(m.name)}" data-act="mname" data-v="${i}" aria-label="Имя" style="flex:1;min-width:0;font-weight:600">
    <div class="chips" style="flex:none">${[['adult','Взр.'],['child','Реб.']].map(([k,l])=>`<button class="chip" data-act="mset" data-v="${i}:kind:${k}" aria-pressed="${m.kind===k}">${l}</button>`).join('')}</div>
    ${S.profile.members.length>1?`<button class="iconbtn" data-act="mdel" data-v="${i}" aria-label="Удалить">✕</button>`:''}</div>
   <div class="row between"><span class="small">${m.kind==='child'?`порция ×${dec(pf)}`:`<b>≈ ${num(n.kcal)} ккал/день</b> · порция ×${dec(pf)}`}</span><button class="btn ghost small" data-act="mopen" data-v="${i}">${m.open?'Скрыть':'Подробнее'}</button></div>
   ${n.custom?'<p class="small muted">Норма задана вручную</p>':''}${!n.exact&&!m.open?`<p class="small muted">${m.kind==='child'?'Укажите возраст, чтобы точнее посчитать норму':'Примерно. Укажите пол, возраст, вес и рост — посчитаем точнее'}</p>`:''}
   ${m.open?`<div class="stack"><span class="small muted">Пол</span>${sexC}</div>
    <div class="grid2">
     <label class="field" for="ma_${m.id}">Возраст, лет<input type="number" inputmode="numeric" id="ma_${m.id}" value="${esc(m.age)}" min="1" max="99" data-act="mnum" data-v="${i}:age"></label>
     ${m.kind==='child'?`<label class="field" for="mact_${m.id}">Активность<select id="mact_${m.id}" data-act="msel" data-v="${i}:act">${Object.entries(ACT).map(([k,[l]])=>`<option value="${k}" ${m.act===k?'selected':''}>${l}</option>`).join('')}</select></label>`:''}
     ${m.kind==='adult'?`<label class="field" for="mw_${m.id}">Вес, кг<input type="number" inputmode="decimal" id="mw_${m.id}" value="${esc(m.weight)}" min="20" max="250" data-act="mnum" data-v="${i}:weight"></label>
     <label class="field" for="mh_${m.id}">Рост, см<input type="number" inputmode="numeric" id="mh_${m.id}" value="${esc(m.height)}" min="100" max="230" data-act="mnum" data-v="${i}:height"></label>
     <label class="field" for="mact_${m.id}">Активность<select id="mact_${m.id}" data-act="msel" data-v="${i}:act">${Object.entries(ACT).map(([k,[l]])=>`<option value="${k}" ${m.act===k?'selected':''}>${l}</option>`).join('')}</select></label>`:''}
    </div>
    <label class="field" for="mc_${m.id}">Своя норма калорий, ккал/день — если знаете<input type="number" inputmode="numeric" id="mc_${m.id}" value="${esc(m.custom||'')}" min="500" max="6000" placeholder="посчитаем сами" data-act="mnum" data-v="${i}:custom"></label>
    ${m.kind==='adult'?`<div class="stack"><span class="small muted">Цель</span><div class="chips">${Object.entries(MGOAL).map(([k,[l]])=>`<button class="chip" data-act="mset" data-v="${i}:goal:${k}" aria-pressed="${m.goal===k}">${l}</button>`).join('')}</div></div>`:''}
    <p class="small muted">${m.kind==='adult'?'Норма по формуле Миффлина — Сан-Жеора с учётом активности и цели.':'Норма — ориентир по возрасту.'} Это не медицинская рекомендация.</p>`:''}
  </div>`;
}
function famFields(){const p=S.profile;return `
  <div class="stack">${p.members.map(memberCard).join('')}</div>
  <div class="row"><button class="btn secondary small" data-act="madd" data-v="adult">+ Взрослый</button><button class="btn secondary small" data-act="madd" data-v="child">+ Ребёнок</button></div>
  <p class="small muted">Готовим на ${portions()} ${plural(portions(),'порцию','порции','порций')} за приём пищи: детская порция меньше взрослой.</p>`}
function likeGroups(){const p=S.profile;return LIKE_GROUPS.map(([title,items],gi)=>{const sel=Object.keys(items).filter(k=>p.likes.includes(k)).length;const open=!!UI.open[gi];
  return `<div class="group"><button data-act="grp" data-v="${gi}" aria-expanded="${open}"><span>${title}${sel?` <span class="pill">${sel}</span>`:''}</span><span class="plus" aria-hidden="true">${open?'−':'+'}</span></button>${open?chips(items,p.likes,'like'):''}</div>`}).join('')}
function dislikeFields(){const p=S.profile;const q=UI.dq.trim().toLowerCase();
  const sug=q?Object.entries(ING).filter(([k,v])=>v[0].toLowerCase().includes(q)&&!p.dislikes.includes(k)).slice(0,6):[];
  const pop=DISLIKE_POPULAR.filter(k=>!p.dislikes.includes(k)).slice(0,10);
  return `<div class="stack"><h3>Что не едите</h3><p class="small muted">Блюда с этими продуктами не попадут в меню</p>
   ${p.dislikes.length?`<div class="chips">${p.dislikes.map(k=>`<button class="chip danger" aria-pressed="true" data-act="dislike" data-v="${k}" aria-label="Убрать ${esc(ING[k][0])}">${esc(ING[k][0])} ✕</button>`).join('')}</div>`:''}
   <input type="search" id="dq" placeholder="Найти продукт: например, лук" value="${esc(UI.dq)}" data-act="dsearch" autocomplete="off" aria-label="Поиск продукта, который не едите">
   ${sug.length?`<div class="suggest">${sug.map(([k,v])=>`<button data-act="dislike" data-v="${k}">${esc(v[0])}</button>`).join('')}</div>`:(q?'<p class="small muted">Ничего не нашли</p>':'')}
   ${!q&&pop.length?`<p class="small muted">Часто исключают:</p><div class="chips">${pop.map(k=>`<button class="chip" data-act="dislike" data-v="${k}" aria-pressed="false">${esc(ING[k][0])}</button>`).join('')}</div>`:''}</div>`}
function tasteFields(){return `<div class="stack"><h3>Что любите</h3><p class="small muted">Нажмите на группу, чтобы выбрать. Такие блюда будут чаще.</p>${likeGroups()}</div>${dislikeFields()}`}
function restrFields(){const p=S.profile;return `
  <div class="stack"><h3>Аллергии и непереносимость</h3><p class="small muted">Строгое ограничение: блюда с этими продуктами исключаются полностью. Список — по обязательной маркировке аллергенов ТР ТС 022/2011, плюс цитрусовые и мёд.</p>${chips(ALLERG,p.allergies,'allergy','danger')}</div>
  <div class="stack"><h3>Тип питания</h3><p class="small muted">Строгое правило для всего меню</p>
   <div class="chips">${Object.entries(DIETS).map(([k,[l,d]])=>`<button class="chip" data-act="diet" data-v="${k}" aria-pressed="${p.diet===k}" title="${esc(d)}">${l}</button>`).join('')}</div>
   ${DIETS[p.diet][1]?`<p class="small muted">${esc(DIETS[p.diet][1])}</p>`:''}</div>
  ${KC()?`<div class="stack"><h3>Цель питания</h3><p class="small muted">Мягкое правило: подходящие блюда будут чаще</p>${chips(GOALS,p.goals,'goal')}</div>`:''}
  <div class="note"><b>!</b><span>Мы исключаем блюда по составу рецепта. Состав конкретного продукта в магазине проверяйте по упаковке. При медицинской диете согласуйте меню с врачом.</span></div>`}
function weekFields(){const p=S.profile;return `
  <div class="card"><label class="field" for="city">Город — по нему считаем цены<select id="city" data-act="city">${Object.entries(CITIES).map(([k,[l]])=>`<option value="${k}" ${p.city===k?'selected':''}>${l}</option>`).join('')}</select></label>
  <p class="small muted">${priceNote()}</p></div>
  <div class="card"><label class="field" for="budget">Бюджет на продукты в неделю<b id="budgetv" style="color:var(--fg);font-size:20px;font-variant-numeric:tabular-nums">${rub(p.budget)}</b></label>
  <input type="range" id="budget" min="2000" max="30000" step="500" value="${p.budget}" data-act="budget" aria-label="Бюджет в неделю">
  <p class="small muted">Цены — ориентир по каталогу магазина, без акций</p></div>
  <div class="stack"><h3>Сколько готовить в будни</h3>${chips({30:'до 30 мин',45:'до 45 мин',60:'до часа',0:'не важно'},[String(p.maxTime)],'time')}<p class="small muted">В выходные допускаем на 30 минут дольше</p></div>
  <div class="stack"><h3>Что планируем</h3>${chips(mealNames(),SLOTS.filter(k=>p.meals[k]),'meal')}${UL('extras')?'':'<p class="small muted">Перекусы, десерты и напитки откроются со второй недели.</p>'}
  <p class="small muted">На обед — супы, на ужин — второе: мясо или рыба с гарниром.</p>
  ${p.meals.l?`<label class="toggle"><span>Суп варить на два дня</span><input type="checkbox" class="switch" id="soupBatch" data-act="soupBatch" ${p.soupBatch?'checked':''}></label>`:''}</div>`}
function priceNote(){const c=S.profile.city||'msk';return c==='msk'?`Цены — ${PRICE_SOURCE}, обычные цены без акций.`:`Цены — ${PRICE_SOURCE}, пересчитаны для города: ×${dec(CITIES[c][1])} по разнице стоимости продуктовой корзины (Руспродсоюз, май 2026).`}
const QUICK_PANTRY=[['potato',2000],['onion',1000],['carrot',1000],['rice',800],['buckwheat',800],['pasta',800],['eggs',10],['milk',1000],['flour',1000],['oil',900],['sugar',1000],['garlic',10]];
function pantryQuick(){return `<div class="stack"><h3>Что уже есть дома</h3><p class="small muted">Можно пропустить. Эти продукты вычтем из списка покупок и постараемся использовать в меню.</p>
  <div class="chips">${QUICK_PANTRY.map(([k,q])=>`<button class="chip" data-act="qp" data-v="${k}:${q}" aria-pressed="${S.pantry.some(x=>x.key===k)}">${ING[k][0]}</button>`).join('')}</div>
  <p class="small muted">Точное количество и другие продукты — во вкладке «Дома».</p></div>`}
const ONB=[['Семья','Кого кормим?',famFields],['Вкусы','Вкусы семьи',tasteFields],['Ограничения','Ограничения и цели',restrFields],['Неделя','Неделя и бюджет',weekFields],['Дома','Продукты дома',pantryQuick]];
function onboarding(){
  const st=S.onbStep,okMeals=Object.values(S.profile.meals).some(Boolean);
  return `<div class="screen" style="padding-bottom:30px">
   <div class="row between"><button class="iconbtn" data-act="onbBack" aria-label="Назад">←</button><div class="dots">${ONB.map((_,i)=>`<i class="${i<=st?'on':''}"></i>`).join('')}</div><span class="small muted">${st+1}/5</span></div>
   <div class="stack"><p class="eyebrow">${ONB[st][0]}</p><h1>${ONB[st][1]}</h1></div>
   ${ONB[st][2]()}
   <div style="flex:1"></div>
   ${st<4?`<button class="btn block" data-act="onbNext" ${st===3&&!okMeals?'disabled':''}>Дальше</button>`:`<button class="btn block" data-act="build">Составить меню на неделю</button>`}
  </div>`;
}
function slotRow(di,sk,compact){
  const s=S.plan.days[di].slots[sk],r=slotRecipe(di,sk);
  const handle=compact?'':(s&&!s.left?`<button class="drag" data-drag="${di}:${sk}" aria-label="Перетащить блюдо" title="Перетащите в другой приём пищи или день">⠿</button>`:'<span class="drag ghost" aria-hidden="true"></span>');
  if(!r) return `<div class="slot" data-slot="${di}:${sk}">${handle}<span class="meal">${SLOT_NAMES[sk]}</span><div class="grow small muted">Не нашли подходящее блюдо. Ослабьте ограничения в профиле.</div></div>`;
  const eatBtn=compact?`<button class="eat" data-act="eat" data-v="${di}:${sk}" aria-pressed="${!!S.eaten[eatKey(di,sk)]}">${S.eaten[eatKey(di,sk)]?'Съели ✓':'Съели'}</button>`:'';
  if(s.left) return `<div class="slot" data-slot="${di}:${sk}" data-left="1">${handle}<div class="thumb">${dishArt(r)}</div><button class="open" data-act="recipe" data-v="${srcRef(di,sk)}"><span class="small muted">${SLOT_NAMES[sk]}</span><span class="dish">${esc(r.n)}</span><span class="meta"><span class="pill grey">остатки со вчера</span>${KC()?`<span>${r.kcal} ккал</span>`:''}</span></button>${eatBtn}</div>`;
  return `<div class="slot ${s.cooked?'cooked':''}" data-slot="${di}:${sk}">${handle}<div class="thumb">${dishArt(r)}</div>
   <button class="open" data-act="recipe" data-v="${di}:${sk}"><span class="small muted">${SLOT_NAMES[sk]}</span><span class="dish">${esc(r.n)}</span><span class="meta"><span>${r.t} мин</span>${KC()?`<span>${r.kcal} ккал</span>`:''}<span>${s.serv} ${plural(s.serv,'порция','порции','порций')}</span>${s.cooked?'<span class="pill">приготовлено</span>':''}</span></button>
   ${compact?eatBtn:`<button class="iconbtn" data-act="replace" data-v="${di}:${sk}" aria-label="Заменить блюдо">↻</button>`}</div>`;
}
function kcalCard(ti){
  const ms=S.profile.members.filter(m=>m.kind==='adult'); if(!UI.member||!ms.find(m=>m.id===UI.member)) UI.member=ms[0].id;
  const m=ms.find(x=>x.id===UI.member),n=need(m),pf=pfactor(m),dk=S.plan.days[ti].date.slice(0,10),ex=((S.extra[dk]||{})[m.id])||[],exs=ex.reduce((a,b)=>a+(typeof b==='number'?b:b.kcal),0),plan=dayKcal(ti)*pf,eat=eatenKcal(ti)*pf+exs;
  const max=Math.max(n.kcal,plan)*1.05,diff=n.kcal-plan;
  let hint=''; if(diff>n.kcal*.15) hint=`Меню даёт меньше нормы на ≈${num(diff)} ккал — добавьте перекус: фрукты, йогурт, орехи.`; else if(-diff>n.kcal*.15) hint=`Меню даёт больше нормы на ≈${num(-diff)} ккал — можно взять порцию поменьше.`; else hint='Меню на сегодня близко к норме.';
  return `<div class="card kcal"><div class="row between"><h3>Калории сегодня</h3><span class="small muted">порция ×${dec(pf)}</span></div>
   <div class="chips">${ms.map(x=>`<button class="chip" data-act="kmember" data-v="${x.id}" aria-pressed="${x.id===m.id}">${esc(x.name)}</button>`).join('')}</div>
   <div class="row between"><span><b style="font-size:22px;font-variant-numeric:tabular-nums">${num(eat)}</b> <span class="muted">/ ${num(n.kcal)} ккал</span></span><span class="small muted">по меню ≈${num(plan)}</span></div>
   <div class="kbar" aria-hidden="true"><i style="width:${Math.min(100,eat/max*100)}%"></i><b style="left:calc(${Math.min(100,plan/max*100)}% - 1px)"></b></div>
   <p class="small muted">${hint} Отмечайте «Съели» у блюд. ${n.exact?'':'Норма примерная — уточните данные в «Семье».'}</p>
   <form class="row" data-form="kadd"><input type="text" id="kadd" placeholder="Съели что-то ещё? Например: 1 банан, латте" autocomplete="off" aria-label="Что ещё съели" style="flex:1;min-width:0"><button class="btn secondary small" type="submit">Добавить</button></form>
   <p class="small muted" id="kmsg">Можно написать продукт и количество — посчитаем сами. Или просто число ккал.</p>
   ${ex.length?`<div class="chips">${ex.map((v,i)=>{const o=typeof v==='number'?{label:'Вручную',kcal:v}:v;return `<button class="chip" data-act="kdel" data-v="${i}" aria-label="Удалить ${esc(o.label)}">${esc(o.label)} · ${num(o.kcal)} ккал ✕</button>`}).join('')}</div>`:''}</div>`;
}
function scrToday(){
  if(!S.plan) return `<div class="screen"><div class="empty"><h2>Меню ещё нет</h2><p>Составим меню на неделю по профилю семьи.</p><button class="btn" data-act="regen">Составить меню</button></div></div>`;
  const ti=todayIdx(),now=NOW();
  if(ti<0) return `<div class="screen"><p class="eyebrow">${dateLabel(now.toISOString(),true)}</p>${weekEndCard()}</div>`;
  const mk=nextSlotKey(ti),r=slotRecipe(ti,mk),s=S.plan.days[ti].slots[mk];
  const others=SLOTS.filter(k=>S.plan.days[ti].slots[k]&&k!==mk);
  const sh=shopping(),toBuy=sh.items.filter(i=>!i.covered),bought=toBuy.filter(i=>i.bought).length;
  const tmr=ti+1<7?ti+1:null,rt=tmr!==null?slotRecipe(tmr,mainSlotKey(tmr)):null;
  return `<div class="screen">
   <div class="row between"><div><p class="eyebrow">Сегодня</p><h1 style="text-transform:capitalize">${dateLabel(S.plan.days[ti].date,true)}</h1></div>${S.plan.status==='draft'?'<span class="pill warn">меню не утверждено</span>':''}</div>
   ${v4Top()}
   ${r?`<div class="hero"><div class="heroimg">${dishArt(r)}</div><p class="small" style="opacity:.85">${SLOT_NAMES[mk]}${s.left?' · остатки со вчера':''}</p><p class="dish">${esc(r.n)}</p>
     <div class="meta"><span>${r.t} мин</span>${KC()?`<span>${r.kcal} ккал на порцию</span>`:''}<span>${s.left?'разогреть':s.serv+' '+plural(s.serv,'порция','порции','порций')}</span></div>
     <div class="row"><button class="btn grow" data-act="cook" data-v="${srcRef(ti,mk)}">${s.cooked?'Открыть рецепт':'Готовить'}</button><button class="eat" style="background:transparent;color:inherit;border-color:currentColor" data-act="eat" data-v="${ti}:${mk}" aria-pressed="${!!S.eaten[eatKey(ti,mk)]}">${S.eaten[eatKey(ti,mk)]?'Съели ✓':'Съели'}</button></div></div>`:''}
   ${others.length?`<div class="day">${others.map(k=>slotRow(ti,k,true)).join('')}</div>`:''}
   ${KC()?kcalCard(ti):''}
   ${S.profile.reminder.on&&rt?`<div class="card"><div class="row"><span class="appicon" style="width:34px;height:34px">${IC.bell}</span><div class="grow"><h3>Сегодня в ${S.profile.reminder.time}</h3><p class="small muted">Проверить продукты для завтрашнего блюда: «${esc(rt.n)}»</p></div></div><button class="btn secondary small" data-act="pushNow">Показать напоминание сейчас</button></div>`:''}
   <div class="card"><div class="row between"><h3>Покупки на неделю</h3><button class="btn ghost small" data-act="tab" data-v="shop">Открыть</button></div>
     <div class="progress"><i style="width:${toBuy.length?Math.round(bought/toBuy.length*100):100}%"></i></div>
     <p class="small muted">Куплено ${bought} из ${toBuy.length} · осталось ≈${rub(toBuy.filter(i=>!i.bought).reduce((a,i)=>a+i.cost,0))}</p></div>
   <p class="proto">Прототип v4 · меню подбирается из базы ${R.length} рецептов по правилам профиля</p>
  </div>`;
}
function scrMenu(){
  if(!S.plan) return scrToday();
  const sh=shopping(),b=S.profile.budget,pct=Math.min(100,Math.round(sh.cost/b*100)),over=sh.cost>b,ti=todayIdx();
  const d0=new Date(S.plan.days[0].date),d6=new Date(S.plan.days[6].date);
  return `<div class="screen">
   <div class="row between"><div><p class="eyebrow">Меню на неделю</p><h1>${d0.getDate()} ${MONS[d0.getMonth()]} — ${d6.getDate()} ${MONS[d6.getMonth()]}</h1></div>
   ${S.plan.status==='draft'?'<span class="pill warn">черновик</span>':'<span class="pill">утверждено</span>'}</div>
   ${S.profile.budgetSet?`<div class="card"><div class="row between"><h3>Оценка покупок</h3><span class="qty">≈${rub(sh.cost)} / ${rub(b)}</span></div>
    <div class="progress ${over?'over':''}"><i style="width:${pct}%"></i></div>
    <p class="small muted">${over?'Выше бюджета. Замените дорогие блюда или отметьте, что есть дома. ':''}Оценка по ценам магазина на ${PRICE_DATE}, без учёта фасовок и акций.</p></div>`:`<div class="card"><div class="row between"><h3>Покупки на неделю</h3><span class="qty">≈${rub(sh.cost)}</span></div><p class="small muted">По ценам ${STORES[S.store||'vv']} на ${PRICE_DATE}. Бюджет можно задать в «Семье и настройках».</p></div>`}
   ${S.plan.status!=='draft'?`<button class="btn secondary block" data-act="share">${IC.share} Отправить меню семье</button>`:''}
   ${S.plan.days.map((d,di)=>`<div class="day ${di===ti?'today':''}"><header><b style="text-transform:capitalize">${dateLabel(d.date,true)}</b><span class="small muted">${di===ti?'<span class="pill">сегодня</span> ':''}${KC()?'≈'+num(dayKcal(di))+' ккал':''}</span></header>${SLOTS.filter(k=>d.slots[k]).map(k=>slotRow(di,k)).join('')}</div>`).join('')}
   <p class="small muted">${KC()?'Калории дня — на одну стандартную порцию каждого блюда. ':''}Потяните за ⠿, чтобы поменять блюда местами между приёмами пищи и днями.</p>
   <div class="stack">${S.plan.status==='draft'?'<button class="btn block" data-act="approve">Утвердить меню и собрать список</button>':''}
   <button class="btn ghost block" data-act="regen">Пересобрать всю неделю</button></div>
  </div>`;
}
function scrShop(){
  if(!S.plan) return scrToday();
  const sh=shopping(),need_=sh.items.filter(i=>!i.covered),home=sh.items.filter(i=>i.covered),left=need_.filter(i=>!i.bought);
  const cats=CAT_ORDER.filter(c=>need_.some(i=>i.cat===c));
  const row=i=>`<div class="item ${i.bought?'done':''}"><input type="checkbox" class="chk" id="b_${i.k}" data-act="bought" data-v="${i.k}" ${i.bought?'checked':''} aria-label="Куплено: ${esc(i.name)}">
    <label class="grow" for="b_${i.k}" style="min-width:0;cursor:pointer"><div class="row between"><span class="nm">${esc(i.name)}</span><span class="qty">${fmtQty(i.k,i.toBuy,true)}</span></div>
    <div class="for">${i.pq>0?`дома ${fmtQty(i.k,i.pq,true)} · `:''}для: ${esc(i.dishes.join(', '))}</div>
    <div class="for">ВВ ${rub(i.toBuy*storePrice('vv',i.k)*cityCoef())}${LAVKA[i.k]?` · Лавка ${rub(i.toBuy*storePrice('lavka',i.k)*cityCoef())}`:''}</div></label>
    <a class="iconbtn vv" href="${storeLink(S.store||'vv',i.k)}" target="_blank" rel="noopener" aria-label="Открыть в магазине ${STORES[S.store||'vv']}: ${esc(i.name)}" title="Открыть в магазине">${(S.store||'vv')==='lavka'?'Лавка':'ВВ'} ↗</a>
    <button class="iconbtn" data-act="have" data-v="${i.k}" aria-label="Уже есть дома: ${esc(i.name)}" style="font-size:12px">есть</button></div>`;
  return `<div class="screen">
   <div class="row between"><div><p class="eyebrow">Покупки</p><h1>Список на неделю</h1></div><button class="iconbtn" data-act="copy">Копировать</button></div>
   ${S.plan.status==='draft'?`<div class="note"><b>!</b><span>Меню ещё не утверждено: список может измениться после замен. <button class="btn ghost small" style="margin-top:6px" data-act="approve">Утвердить меню</button></span></div>`:''}
   <div class="card"><div class="row between"><span>Осталось купить: <b>${left.length}</b> ${plural(left.length,'позиция','позиции','позиций')}</span><span class="qty">≈${rub(left.reduce((a,i)=>a+i.cost,0))}</span></div>
   <div class="seg small" role="tablist" aria-label="Магазин">${Object.entries(STORES).map(([k,l])=>`<button role="tab" aria-selected="${(S.store||'vv')===k}" data-act="store" data-v="${k}">${l} · ${rub(basketBy(k))}</button>`).join('')}</div>
   ${left.length?`<button class="btn block" data-act="cartStart">${IC.cart} Собрать корзину по шагам</button>`:''}
   <p class="small muted">Одинаковые продукты из разных блюд объединены. Цены на ${PRICE_DATE} — в магазине могут отличаться. «есть» — продукт уже дома, купить не нужно.${UL('promo')?' <button class="linkbtn" data-act="navPrices">Сравнить магазины</button>':''}</p></div>
   ${cats.map(c=>`<section class="cat"><h3>${c}</h3>${need_.filter(i=>i.cat===c).map(row).join('')}</section>`).join('')}
   ${sh.spices.length?`<section class="cat"><h3>Специи — проверьте, есть ли дома</h3><div class="card small">${esc(sh.spices.join(', '))}<p class="muted">Количество «по вкусу», в список не суммируем.</p></div></section>`:''}
   ${home.length?`<section class="cat"><h3>Уже есть дома</h3>${home.map(i=>`<div class="item done"><span class="grow nm">${esc(i.name)}</span><span class="small muted">${fromList(i.k)?'отмечено «есть»':'хватает запаса'}</span>${fromList(i.k)?`<button class="iconbtn" data-act="have" data-v="${i.k}">вернуть</button>`:''}</div>`).join('')}</section>`:''}
  </div>`;
}
function scrHome(){
  const q=UI.q.trim().toLowerCase(),sug=(UI.remoteSuggestions || []).map(i=>[i.id,ING[i.id]]).filter(([,i])=>i);
  return `<div class="screen">
   <div><p class="eyebrow">Продукты дома</p><h1>Что есть на кухне</h1></div>
   <p class="small muted">Эти продукты вычитаются из списка покупок сразу, а при следующей сборке меню мы постараемся их использовать. Сюда же попадает всё, что вы отметили «есть» в списке покупок.</p>
   <div class="stack"><input type="search" id="pq" placeholder="Найти продукт: например, рис" value="${esc(UI.q)}" data-act="search" autocomplete="off" aria-label="Поиск продукта">
   ${sug.length?`<div class="suggest">${sug.map(([k,v])=>`<button data-act="addP" data-v="${k}">${esc(v[0])} <span class="small muted">· ${unitLabel(k)}</span></button>`).join('')}</div>`:''}</div>
   ${S.pantry.length?S.pantry.map((p,i)=>`<div class="card" style="flex-direction:row;align-items:center;padding:10px 12px;gap:8px"><span class="grow">${esc(ING[p.key][0])}${p.src==='list'?'<br><span class="pill grey">из списка покупок</span>':''}</span>
     <input type="number" inputmode="decimal" id="pqty_${i}" value="${p.qty}" min="0" max="1000000000" step="0.001" style="width:84px" data-act="pqty" data-v="${i}" aria-label="Количество"><span class="small muted" style="width:34px">${unitLabel(p.key)}</span>
     <button class="iconbtn" data-act="delP" data-v="${i}" aria-label="Удалить">✕</button></div>`).join(''):`<div class="empty"><p>Пока пусто. Добавьте через поиск или отметьте «есть» в списке покупок.</p></div>`}
  </div>`;
}
function scrProfile(){const p=S.profile;return `<div class="screen">
   <div><p class="eyebrow">Профиль семьи</p><h1>Семья и настройки</h1></div>
   ${famFields()}${tasteFields()}${restrFields()}${weekFields()}
   <div class="card"><label class="toggle"><span><b>Напоминание накануне</b><br><span class="small muted">Проверить продукты для завтрашнего блюда</span></span><input type="checkbox" class="switch" id="remOn" data-act="remOn" ${p.reminder.on?'checked':''}></label>
   ${p.reminder.on?`<label class="field" for="remT">Время<select id="remT" data-act="remT">${['18:00','19:00','20:00','21:00','22:00'].map(t=>`<option ${t===p.reminder.time?'selected':''}>${t}</option>`).join('')}</select></label>`:''}</div>
   ${kcalToggle()}
   <button class="btn block" data-act="regen">Сохранить и пересобрать меню</button>
   ${S.history.blocked.length?`<div class="card"><h3>Скрытые блюда</h3>${S.history.blocked.map(id=>`<div class="row between"><span>${esc(RBY[id].n)}</span><button class="iconbtn" data-act="unblock" data-v="${id}">вернуть</button></div>`).join('')}</div>`:''}
   <button class="btn ghost block" data-act="reset">Сбросить все данные прототипа</button>
  </div>`}

/* ============ SHEETS ============ */
function renderSheet(){
  const L=$('#layer'),sh=UI.sheet; if(!sh){L.innerHTML='';return}
  const html=sh.type==='share'?sheetShare(sh):sh.type==='recipe'?sheetRecipe(sh):sh.type==='replace'?sheetReplace(sh):sh.type==='move'?sheetMove(sh):sheetRemind(sh);
  L.innerHTML=`<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
}
function sheetRecipe({day,slot,done=[]}){
  const s=S.plan.days[day].slots[slot],r=RBY[s.rid],f=s.serv/4;
  const al=r.allerg.map(a=>ALLERG[a].split(' (')[0].toLowerCase());
  const fb=S.history.liked.includes(r.id)?'liked':S.history.disliked.includes(r.id)?'disliked':'';
  return `<div class="grab"></div>
   <div class="row between"><p class="eyebrow">${SLOT_NAMES[slot]} · ${dateLabel(S.plan.days[day].date)}</p><button class="iconbtn" data-act="close" aria-label="Закрыть">✕</button></div>
   <div class="cover">${dishArt(r)}</div>
   <h1 class="dish" style="font-size:26px">${esc(r.n)}</h1>
   <div class="meta" style="font-size:14px"><span>${r.t} мин</span>${slot==='l'&&S.profile.soupBatch&&s.serv>portions()?'<span class="pill grey">на два дня</span>':''}</div>
   ${KC()?`<div class="stack"><h3>На одну порцию</h3><div class="macros"><div class="macro"><b>${r.kcal}</b><span>ккал</span></div><div class="macro"><b>${r.P} г</b><span>белки</span></div><div class="macro"><b>${r.F} г</b><span>жиры</span></div><div class="macro"><b>${r.C} г</b><span>углеводы</span></div></div></div>`:''}
   <div class="card"><div class="row between"><h3>Порции</h3><div class="stepper"><button data-act="serv" data-v="-1" aria-label="Меньше порций">−</button><span>${s.serv}</span><button data-act="serv" data-v="1" aria-label="Больше порций">+</button></div></div>
    <div>${r.i.map(([k,q])=>`<div class="ingr"><span>${esc(ING[k][0])}</span><span class="qty">${fmtQty(k,q*f)}</span></div>`).join('')}
    ${r.sp&&r.sp.length?`<div class="ingr"><span>${esc(r.sp.join(', '))}</span><span class="muted">по вкусу</span></div>`:''}</div>
    <p class="small muted">Количества пересчитываются вместе со списком покупок</p></div>
   ${al.length?`<div class="note"><b>!</b><span>По рецепту содержит: ${esc(al.join(', '))}. Состав конкретных продуктов проверяйте по упаковке.</span></div>`:''}
   <div class="stack"><div class="row between"><h2>Как готовить</h2><span class="small muted">${r.s.length} ${plural(r.s.length,'шаг','шага','шагов')}</span></div>
   <div class="card small"><b>Понадобится:</b> ${esc(equipment(r).join(', ')||'миска')}. <span class="muted">Шаги можно отмечать нажатием, таймер запускается кнопкой.</span></div>
   <button class="btn block" data-act="cook" data-v="${day}:${slot}">Готовить по шагам с таймером</button>
   ${r.s.map((t,i)=>{const d=stepDur(t),a=stepAction(t),ing=stepIngs(r,t),key=tKey(r.id,i);return `<div class="stepcard ${done.includes(i)?'done':''}">
     <div class="stepimg">${stepArt(r,i)}</div>
     <div class="stack" style="gap:6px"><button class="steptext" data-act="step" data-v="${i}" aria-pressed="${done.includes(i)}"><span class="stepn">${done.includes(i)?'✓':i+1}</span><span>${esc(t)}</span></button>
     ${ing.length?`<div class="chips">${ing.map(([k,q])=>`<span class="pill grey">${esc(ING[k][0])} · ${fmtQty(k,q*f)}</span>`).join('')}</div>`:''}
     <p class="small muted">${esc(a[2])}</p>
     ${d?`<div class="row"><span class="qty" data-timer="${key}" data-total="${d}">${fmtTime(TIMERS[key]?timerLeft(TIMERS[key]):d)}</span><button class="btn secondary small" data-act="tgo" data-v="${i}" data-tbtn="${key}">Старт таймера</button><button class="iconbtn" data-act="treset" data-v="${i}" aria-label="Сбросить таймер">↺</button></div>`:''}</div></div>`}).join('')}</div>
   <div class="card"><h3>Как прошло?</h3>
    <button class="btn ${s.cooked?'secondary':''} block" data-act="cooked">${s.cooked?'Приготовлено ✓':'Отметить: приготовила'}</button>
    <div class="chips"><button class="chip" data-act="fb" data-v="liked" aria-pressed="${fb==='liked'}">Понравилось</button><button class="chip danger" data-act="fb" data-v="disliked" aria-pressed="${fb==='disliked'}">Не понравилось</button></div>
    <div class="row" style="flex-wrap:wrap"><button class="btn ghost small" data-act="replace" data-v="${day}:${slot}">Заменить блюдо</button><button class="btn ghost small" data-act="moveOpen">Перенести</button><button class="btn ghost small" data-act="block">Больше не предлагать</button></div></div>`;
}
let WL=null; async function requestWake(){try{WL=await navigator.wakeLock.request('screen')}catch(e){WL=null}} function releaseWake(){try{WL&&WL.release()}catch(e){} WL=null}
function renderCook(){
  const L=$('#cooklayer'); if(!UI.cook){L.innerHTML='';document.documentElement.classList.remove('cooking');return}
  document.documentElement.classList.add('cooking');
  const c=UI.cook,r=RBY[c.rid],sl=S.plan.days[c.day].slots[c.slot],f=sl.serv/4,n=r.s.length,st=c.step;
  const total=r.s.reduce((a,t)=>a+stepDur(t),0);
  let body='';
  if(st<0){
    body=`<div class="cover">${dishArt(r)}</div><p class="eyebrow">Подготовка</p><h1 class="dish" style="font-size:26px">${esc(r.n)}</h1>
     <div class="meta" style="font-size:14px"><span>${r.t} мин всего</span><span>${n} ${plural(n,'шаг','шага','шагов')}</span>${total?`<span>таймеры: ${durLabel(total)}</span>`:''}<span>${sl.serv} ${plural(sl.serv,'порция','порции','порций')}</span></div>
     <div class="card"><h3>Достаньте продукты</h3>${r.i.map(([k,q])=>`<label class="ingr" style="cursor:pointer"><span class="row" style="gap:10px"><input type="checkbox" class="chk2" aria-label="${esc(ING[k][0])}"> ${esc(ING[k][0])}</span><span class="qty">${fmtQty(k,q*f)}</span></label>`).join('')}
      ${r.sp&&r.sp.length?`<div class="ingr"><span>${esc(r.sp.join(', '))}</span><span class="muted">по вкусу</span></div>`:''}</div>
     <div class="card small"><b>Посуда:</b> ${esc(equipment(r).join(', ')||'миска')}</div>
     <p class="small muted">Экран не будет гаснуть, пока открыт режим готовки (если устройство это поддерживает). Таймеры продолжают идти, даже если перейти к следующему шагу.</p>`;
  } else if(st<n){
    const t=r.s[st],d=stepDur(t),a=stepAction(t),ing=stepIngs(r,t),key=tKey(r.id,st);
    body=`<div class="cover">${stepArt(r,st)}</div><p class="eyebrow">Шаг ${st+1} из ${n}</p><p class="cooktext">${esc(t)}</p>
     ${ing.length?`<div class="chips">${ing.map(([k,q])=>`<span class="pill grey" style="font-size:14px;padding:4px 12px">${esc(ING[k][0])} · ${fmtQty(k,q*f)}</span>`).join('')}</div>`:''}
     ${d?`<div class="card timerbox"><span class="bigtime" data-timer="${key}" data-total="${d}">${fmtTime(TIMERS[key]?timerLeft(TIMERS[key]):d)}</span>
       <div class="row" style="justify-content:center;flex-wrap:wrap"><button class="btn" data-act="tgo" data-v="${st}" data-tbtn="${key}">Старт таймера</button><button class="btn ghost small" data-act="tplus" data-v="${st}">+1 мин</button><button class="btn ghost small" data-act="treset" data-v="${st}">Сброс</button></div></div>`:''}
     <div class="note"><b>?</b><span>${esc(a[2])}</span></div>`;
  } else {
    body=`<div class="cover">${dishArt(r)}</div><h1>Готово! Приятного аппетита</h1><p class="muted">«${esc(r.n)}» отмечено как приготовленное.</p>
     <div class="card"><h3>Как вам блюдо?</h3><div class="chips"><button class="chip" data-act="cfb" data-v="liked" aria-pressed="${S.history.liked.includes(r.id)}">Понравилось</button><button class="chip danger" data-act="cfb" data-v="disliked" aria-pressed="${S.history.disliked.includes(r.id)}">Не понравилось</button></div>
     <button class="btn secondary block" data-act="eat" data-v="${c.day}:${c.slot}" aria-pressed="${!!S.eaten[eatKey(c.day,c.slot)]}">${S.eaten[eatKey(c.day,c.slot)]?'Отмечено «Съели» ✓':'Отметить «Съели» — посчитаем калории'}</button></div>`;
  }
  L.innerHTML=`<div class="cook" role="dialog" aria-modal="true" aria-label="Режим готовки">
   <header class="cookhead"><button class="iconbtn" data-act="cclose" aria-label="Закрыть режим готовки">✕</button><div class="grow"><b class="small">${esc(r.n)}</b><div class="progress" style="margin-top:6px"><i style="width:${Math.round(Math.max(0,st+1)/n*100)}%"></i></div></div></header>
   <div id="tstrip" class="tstrip" hidden></div>
   <div class="cookbody">${body}</div>
   <footer class="cookfoot">${st>=0&&st<=n?`<button class="btn ghost" data-act="cprev">← Назад</button>`:'<span></span>'}${st<n?`<button class="btn" data-act="cnext">${st<0?'Начать готовить':st===n-1?'Готово ✓':'Далее →'}</button>`:`<button class="btn" data-act="cclose">Закрыть</button>`}</footer></div>`;
}
function sheetMove({day,slot}){
  const r=slotRecipe(day,slot);
  return `<div class="grab"></div>
   <div class="row between"><p class="eyebrow">Перенести блюдо</p><button class="iconbtn" data-act="close" aria-label="Закрыть">✕</button></div>
   <h2>Куда перенести «${esc(r.n)}»?</h2><p class="small muted">Блюда поменяются местами, список покупок пересчитается.</p>
   ${S.plan.days.map((d,di)=>`<div class="stack" style="gap:6px"><b class="small">${dateLabel(d.date,true)}</b>${SLOTS.filter(k=>d.slots[k]&&!(di===day&&k===slot)&&!d.slots[k].left).map(k=>{const t=slotRecipe(di,k);return `<button class="btn ghost small" style="justify-content:flex-start;text-align:left" data-act="moveTo" data-v="${di}:${k}">${SLOT_NAMES[k]}: ${t?esc(t.n):'—'}</button>`}).join('')}</div>`).join('')}`;
}
const REASONS={none:'Просто не хочется',time:'Долго готовить',cost:'Дорого',light:'Слишком калорийно',pantry:'Из того, что дома'};
function altList(day,slot,reason){
  const cur=slotRecipe(day,slot),inWeek=new Set(); S.plan.days.forEach(d=>Object.values(d.slots).forEach(s=>s&&s.rid&&inWeek.add(s.rid)));
  const wd=new Date(S.plan.days[day].date).getDay(),weekend=wd===0||wd===6,maxT=S.profile.maxTime?(weekend?S.profile.maxTime+30:S.profile.maxTime):999;
  const rank=arr=>arr.map(r=>({r,s:score(r,{reason,slot})})).sort((a,b)=>b.s-a.s).map(x=>x.r);
  const base=poolFor(slot).filter(r=>r.id!==cur.id);
  const wider=(slot==='l'||slot==='d'?R.filter(r=>r.m==='m'&&allowed(r)):slot==='b'?R.filter(r=>(r.m==='b'||r.m==='s')&&allowed(r)):R.filter(r=>['s','z','k'].includes(r.m)&&allowed(r))).filter(r=>r.id!==cur.id);
  const tiers=[base.filter(r=>!inWeek.has(r.id)&&r.t<=maxT),base.filter(r=>!inWeek.has(r.id)),wider.filter(r=>!inWeek.has(r.id)),base,wider];
  const out=[],seen=new Set(); for(const t of tiers){for(const r of rank(t)){if(out.length>=5) break; if(!seen.has(r.id)){seen.add(r.id);out.push(r)}} if(out.length>=5) break}
  return out;
}
function diffFor(day,slot,rid){
  const before=needMap(S.plan).m,clone=JSON.parse(JSON.stringify(S.plan)); clone.days[day].slots[slot].rid=rid; const after=needMap(clone).m;
  const out=[]; new Set([...Object.keys(before),...Object.keys(after)]).forEach(k=>{const a=before[k]?before[k].qty:0,b=after[k]?after[k].qty:0; if(Math.abs(a-b)<0.01) return;
    if(!a) out.push(`<span class="plus">+ ${esc(ING[k][0])} ${fmtQty(k,b,true)}</span>`);
    else if(!b) out.push(`<span class="minus">− ${esc(ING[k][0])} ${fmtQty(k,a,true)}</span>`);
    else out.push(`<span>${esc(ING[k][0])}: ${fmtQty(k,a,true)} → ${fmtQty(k,b,true)}</span>`);});
  return out;
}
function sheetReplace({day,slot,reason='none',open=null}){
  const cur=slotRecipe(day,slot),alts=altList(day,slot,reason),s=S.plan.days[day].slots[slot];
  return `<div class="grab"></div>
   <div class="row between"><p class="eyebrow">Замена · ${SLOT_NAMES[slot]}, ${dateLabel(S.plan.days[day].date)}</p><button class="iconbtn" data-act="close" aria-label="Закрыть">✕</button></div>
   <h2>Чем заменить «${esc(cur.n)}»?</h2>
   <div class="stack"><p class="small muted">Почему меняем</p>${chips(KC()?REASONS:Object.fromEntries(Object.entries(REASONS).filter(([k])=>k!=='light')),[reason],'reason')}</div>
   ${alts.length?alts.map(r=>{const d=open===r.id?diffFor(day,slot,r.id):null,inW=S.plan.days.some(x=>Object.values(x.slots).some(z=>z&&z.rid===r.id)); return `<div class="card alt">
     <button data-act="altOpen" data-v="${r.id}" style="border:0;background:none;text-align:left;padding:0" aria-expanded="${open===r.id}"><div class="row" style="align-items:flex-start"><div class="thumb">${dishArt(r)}</div><div class="stack" style="gap:4px">
       <span class="dish" style="font-size:17px">${esc(r.n)}</span>
       <span class="meta"><span>${r.t} мин${r.t<cur.t?` <b style="color:var(--accent)">−${cur.t-r.t}</b>`:''}</span>${KC()?`<span>${r.kcal} ккал${r.kcal<cur.kcal?` <b style="color:var(--accent)">−${cur.kcal-r.kcal}</b>`:''}</span>`:''}<span>≈${rub(rc(r)*s.serv)}${rc(r)<rc(cur)?' <b style="color:var(--accent)">дешевле</b>':''}</span></span>
       <span class="meta">${inW?'<span class="pill warn">уже есть в меню</span>':''}${r.t>(S.profile.maxTime||999)?'<span class="pill grey">дольше обычного</span>':''}${likeHits(r).slice(0,2).map(t=>`<span class="pill">${(LIKE_GROUPS.map(g=>g[1][t]).find(Boolean))||''}</span>`).join('')}</span></div></div></button>
     ${d?`<div class="diff"><b class="small">Что изменится в списке покупок</b>${d.slice(0,10).join('')}${d.length>10?`<span class="muted">и ещё ${d.length-10}</span>`:''}</div><button class="btn block" data-act="doReplace" data-v="${r.id}">Заменить</button>`:`<span class="small muted">Нажмите, чтобы увидеть изменения в списке</span>`}
   </div>`}).join(''):`<div class="empty">С текущими ограничениями замен нет: все подходящие блюда исключены аллергиями, типом питания или списком «не едите». <button class="btn ghost small" data-act="tab" data-v="profile">Открыть ограничения</button></div>`}`;
}
function sheetRemind({day}){
  const mk=mainSlotKey(day),s=S.plan.days[day].slots[mk],r=slotRecipe(day,mk),src=s.left?S.plan.days[s.from].slots[s.of||'l']:s,f=src.serv/4;
  return `<div class="grab"></div>
   <div class="row between"><p class="eyebrow">Проверка продуктов</p><button class="iconbtn" data-act="close" aria-label="Закрыть">✕</button></div>
   <div class="cover">${dishArt(r)}</div>
   <h2>Завтра: ${esc(r.n)}</h2>
   ${s.left?'<p class="muted">Это остатки со вчера — докупать ничего не нужно.</p>':`<p class="small muted">Отметьте, что уже есть, — продукт попадёт в «Дома» и уйдёт из списка покупок.</p>
   <div class="stack">${r.i.map(([k,q])=>{const ok=S.bought[k]||pantryQty(k)>=needMap(S.plan).m[k].qty-0.01; return `<div class="item ${ok?'done':''}" style="border-radius:12px;border-top:1px solid var(--line)"><input type="checkbox" class="chk" id="r_${k}" data-act="remHave" data-v="${k}" ${ok?'checked':''}><label for="r_${k}" class="grow row between" style="cursor:pointer"><span class="nm">${esc(ING[k][0])}</span><span class="qty">${fmtQty(k,q*f)}</span></label></div>`}).join('')}</div>`}
   <button class="btn block" data-act="close">Готово</button>`;
}

/* ============ ACTIONS ============ */
function toast(t){document.querySelectorAll('.toast').forEach(x=>x.remove());const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=t;document.body.appendChild(el);setTimeout(()=>el.remove(),2600)}
function push(){
  const ti=todayIdx(); if(ti<0||ti>=6){toast('На завтра в меню ничего нет');return}
  const mk=mainSlotKey(ti+1),r=slotRecipe(ti+1,mk); if(!r) return;
  const s=S.plan.days[ti+1].slots[mk],src=s.left?S.plan.days[s.from].slots[s.of||'l']:s,f=src.serv/4;
  const miss=s.left?[]:r.i.filter(([k,q])=>!(S.bought[k]||pantryQty(k)>=q*f));
  document.querySelectorAll('.push').forEach(x=>x.remove());
  const el=document.createElement('div'); el.className='push'; el.setAttribute('role','alert');
  el.innerHTML=`<span class="appicon">${IC.bell}</span><div class="grow stack" style="gap:4px"><div class="row between"><b class="small">Семейное меню</b><span class="small muted">сейчас</span></div>
   <p class="small"><b>Завтра ${SLOT_NAMES[mk].toLowerCase()}: ${esc(r.n)}.</b> ${s.left?'Остатки со вчера — готовить не нужно.':miss.length?`Проверьте, есть ли: ${esc(miss.slice(0,4).map(([k])=>ING[k][0].toLowerCase()).join(', '))}${miss.length>4?' и ещё '+(miss.length-4):''}.`:'Все продукты есть — можно готовить.'}</p>
   <div class="row"><button class="btn small" data-act="remOpen">Проверить</button><button class="btn ghost small" data-act="pushClose">Позже</button></div></div>`;
  document.body.appendChild(el); S.remShown=new Date().toDateString(); save();
}
setInterval(()=>{if(!S.plan||!S.profile.reminder.on) return; const n=new Date(),hm=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0'); if(hm===S.profile.reminder.time&&S.remShown!==n.toDateString()) push();},20000);
const tog=(arr,v)=>arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];

function act(a,v,el){
  const p=S.profile;
  switch(a){
   case 'start': S.stage='onb'; S.onbStep=0; break;
   case 'onbNext': S.onbStep=Math.min(4,S.onbStep+1); window.scrollTo(0,0); break;
   case 'onbBack': if(S.onbStep===0) S.stage='welcome'; else S.onbStep--; break;
   case 'build': build(); return;
   case 'madd': p.members.push(newMember(v,v==='child'?'Ребёнок':'Взрослый')); break;
   case 'mdel': p.members.splice(+v,1); break;
   case 'mopen': p.members[+v].open=!p.members[+v].open; break;
   case 'mset': {const [i,f,val]=v.split(':'); const m=p.members[+i]; m[f]=(f==='sex'&&m.sex===val)?'':val; if(f==='kind'&&val==='child'&&!m.age) m.age='7'; break}
   case 'grp': UI.open[v]=!UI.open[v]; break;
   case 'like': p.likes=tog(p.likes,v); break;
   case 'dislike': p.dislikes=tog(p.dislikes,v); UI.dq=''; break;
   case 'allergy': p.allergies=tog(p.allergies,v); break;
   case 'diet': p.diet=v; break;
   case 'goal': p.goals=tog(p.goals,v); if(v==='mass'&&p.goals.includes('lose')) p.goals=p.goals.filter(x=>x!=='lose'); if(v==='lose'&&p.goals.includes('mass')) p.goals=p.goals.filter(x=>x!=='mass'); break;
   case 'time': p.maxTime=+v; break;
   case 'meal': p.meals[v]=!p.meals[v]; break;
   case 'soupBatch': p.soupBatch=el.checked; break;
   case 'city': p.city=el.value; toast('Цены пересчитаны: '+CITIES[p.city][0]); break;
   case 'tgo': {const r=UI.sheet&&UI.sheet.type==='recipe'?RBY[srcSlot(UI.sheet.day,UI.sheet.slot).rid]:RBY[UI.cook.rid]; const i=+v; timerToggle(tKey(r.id,i),stepDur(r.s[i]),`${r.n.split(' ').slice(0,2).join(' ')}, шаг ${i+1}`); return}
   case 'treset': {const r=UI.sheet&&UI.sheet.type==='recipe'?RBY[srcSlot(UI.sheet.day,UI.sheet.slot).rid]:RBY[UI.cook.rid]; timerReset(tKey(r.id,+v)); return}
   case 'tplus': {timerAdd(tKey(UI.cook.rid,+v),60); return}
   case 'cook': {const [d,k]=v.split(':'),sl=S.plan.days[+d].slots[k]; UI.sheet=null; UI.cook={rid:sl.rid,day:+d,slot:k,step:-1}; requestWake(); break}
   case 'cnext': {const r=RBY[UI.cook.rid]; if(UI.cook.step<r.s.length-1) UI.cook.step++; else {const sl=S.plan.days[UI.cook.day].slots[UI.cook.slot]; sl.cooked=true; UI.cook.step=r.s.length} break}
   case 'cprev': UI.cook.step=Math.max(-1,UI.cook.step-1); break;
   case 'cclose': UI.cook=null; releaseWake(); break;
   case 'cfb': {const id=UI.cook.rid,h=S.history; h.liked=h.liked.filter(x=>x!==id); h.disliked=h.disliked.filter(x=>x!==id); h[v].push(id); toast(v==='liked'?'Будем предлагать чаще':'Будем предлагать реже'); break}
   case 'kdelx': break;
   case 'kdel': {const dk=S.plan.days[todayIdx()].date.slice(0,10); S.extra[dk][UI.member].splice(+v,1); break}
   case 'moveOpen': UI.sheet={type:'move',day:UI.sheet.day,slot:UI.sheet.slot}; break;
   case 'moveTo': {const [d,k]=v.split(':'); swapSlots(UI.sheet.day,UI.sheet.slot,+d,k); UI.sheet=null; break}
   case 'qp': {const [k,q]=v.split(':'); const i=S.pantry.findIndex(x=>x.key===k); if(i>=0) S.pantry.splice(i,1); else S.pantry.push({key:k,qty:+q}); break}
   case 'tab': S.tab=v; UI.sheet=null; window.scrollTo(0,0); break;
   case 'regen': if(!Object.values(p.meals).some(Boolean)){toast('Выберите хотя бы один приём пищи');return} build(); return;
   case 'approve': if(S.plan){S.plan.status='approved'; S.tab='shop'; toast('Меню утверждено, список покупок готов')} break;
   case 'recipe': {const [d,s]=v.split(':'); UI.sheet={type:'recipe',day:+d,slot:s,done:[]}; break}
   case 'replace': {const [d,s]=v.split(':'); if(S.plan.days[+d].slots[s].left){toast('Это остатки со вчера — замените само блюдо накануне');return} UI.sheet={type:'replace',day:+d,slot:s,reason:'none',open:null}; break}
   case 'reason': UI.sheet.reason=v; UI.sheet.open=null; break;
   case 'altOpen': UI.sheet.open=UI.sheet.open===v?null:v; break;
   case 'doReplace': {const {day,slot}=UI.sheet,old=slotRecipe(day,slot),ch=diffFor(day,slot,v).length; S.history.replaced.push({from:old.id,to:v,reason:UI.sheet.reason}); const sl=S.plan.days[day].slots[slot]; sl.rid=v; sl.cooked=false; fixLeftovers(); UI.sheet=null; toast(`Заменено. Список покупок пересчитан: ${ch} ${plural(ch,'изменение','изменения','изменений')}`); break}
   case 'serv': {const sl=S.plan.days[UI.sheet.day].slots[UI.sheet.slot]; sl.serv=Math.max(1,Math.min(16,sl.serv+ +v)); break}
   case 'step': {const i=+v,d=UI.sheet.done; UI.sheet.done=d.includes(i)?d.filter(x=>x!==i):[...d,i]; break}
   case 'cooked': {const sl=S.plan.days[UI.sheet.day].slots[UI.sheet.slot]; sl.cooked=!sl.cooked; if(sl.cooked) toast('Отмечено. Как вам блюдо?'); break}
   case 'fb': {const id=S.plan.days[UI.sheet.day].slots[UI.sheet.slot].rid,h=S.history; h.liked=h.liked.filter(x=>x!==id); h.disliked=h.disliked.filter(x=>x!==id); h[v].push(id); toast(v==='liked'?'Будем предлагать чаще':'Будем предлагать реже'); break}
   case 'block': {const {day,slot}=UI.sheet,id=S.plan.days[day].slots[slot].rid; if(!S.history.blocked.includes(id)) S.history.blocked.push(id); UI.sheet={type:'replace',day,slot,reason:'none',open:null}; toast('Больше не предложим. Выберите замену'); break}
   case 'unblock': S.history.blocked=S.history.blocked.filter(x=>x!==v); break;
   case 'eat': {const [d,k]=v.split(':'),key=eatKey(+d,k); S.eaten[key]=!S.eaten[key]; break}
   case 'kmember': UI.member=v; break;
   case 'bought': S.bought[v]=!S.bought[v]; break;
   case 'have': {if(fromList(v)){unmarkHave(v); toast('Вернули в список покупок')} else {markHave(v,needMap(S.plan).m[v].qty); toast(`«${ING[v][0]}» — в разделе «Дома»`)} break}
   case 'copy': {const txt=shopping().items.filter(i=>!i.covered&&!i.bought).map(i=>`${i.name} — ${fmtQty(i.k,i.toBuy,true)}`).join('\n'); if(navigator.clipboard) navigator.clipboard.writeText(txt).then(()=>toast('Список скопирован'),()=>toast('Не удалось скопировать')); return}
   case 'addP': {const u=ING[v][2]; S.pantry.push({key:v,qty:u==='g'?500:u==='ml'?1000:1}); UI.q=''; toast('Добавлено: '+ING[v][0]); break}
   case 'delP': S.pantry.splice(+v,1); break;
   case 'remOn': p.reminder.on=el.checked; break;
   case 'remT': p.reminder.time=el.value; break;
   case 'pushNow': push(); return;
   case 'pushClose': document.querySelectorAll('.push').forEach(x=>x.remove()); return;
   case 'remOpen': document.querySelectorAll('.push').forEach(x=>x.remove()); UI.sheet={type:'remind',day:todayIdx()+1}; break;
   case 'remHave': if(el.checked) markHave(v,needMap(S.plan).m[v].qty); else unmarkHave(v); break;
   case 'close': UI.sheet=null; break;
   case 'reset': S=blank(); try{history.replaceState(null,'',location.pathname+location.search)}catch(e){} UI={sheet:null,open:{},q:'',dq:'',member:null}; try{localStorage.removeItem(KEY)}catch(e){} break;
   default: if(!shellAct(a,v,el)) return;
  }
  save(); render();
}
function swapSlots(d1,k1,d2,k2){
  const a=S.plan.days[d1].slots[k1],b=S.plan.days[d2].slots[k2];
  if(!a||!b||a.left||b.left||(d1===d2&&k1===k2)) return false;
  const ra=a.rid,rb=b.rid,na=slotRecipe(d1,k1),nb=slotRecipe(d2,k2);
  a.rid=rb; b.rid=ra; a.cooked=false; b.cooked=false; if(fixLeftovers()) setTimeout(()=>toast('Салаты и перекусы не оставляем на завтра — на второй день подобрали новое блюдо'),2700);
  toast(nb?`Поменяли местами: «${na.n}» и «${nb.n}». Список покупок пересчитан`:'Перенесли');
  return true;
}
/* drag & drop between slots and days (pointer events, works with touch) */
let DR=null;
document.addEventListener('pointerdown',e=>{
  const h=e.target.closest('[data-drag]'); if(!h) return;
  e.preventDefault();
  const row=h.closest('.slot'),[d,k]=h.dataset.drag.split(':'),r=slotRecipe(+d,k); if(!r) return;
  const g=document.createElement('div'); g.className='dragghost'; g.innerHTML=`<div class="thumb">${dishArt(r)}</div><span class="dish">${esc(r.n)}</span>`;
  document.body.appendChild(g); row.classList.add('dragsrc');
  DR={d:+d,k,g,row,target:null,raf:null,y:e.clientY,x:e.clientX};
  moveGhost(e.clientX,e.clientY);
  try{h.setPointerCapture(e.pointerId)}catch(_){}
  DR.raf=requestAnimationFrame(autoScroll);
});
function moveGhost(x,y){if(!DR) return; DR.x=x; DR.y=y; DR.g.style.transform=`translate(${x-40}px,${y-28}px)`;
  const el=document.elementFromPoint(x,y),t=el&&el.closest('.slot[data-slot]');
  if(DR.target&&DR.target!==t) DR.target.classList.remove('droptarget');
  if(t&&t!==DR.row&&!t.dataset.left){t.classList.add('droptarget');DR.target=t} else DR.target=null;}
function autoScroll(){if(!DR) return; const m=90,h=window.innerHeight; if(DR.y<m) window.scrollBy(0,-12); else if(DR.y>h-m-60) window.scrollBy(0,12); moveGhost(DR.x,DR.y); DR.raf=requestAnimationFrame(autoScroll)}
document.addEventListener('pointermove',e=>{if(DR){e.preventDefault();moveGhost(e.clientX,e.clientY)}},{passive:false});
function endDrag(ok){if(!DR) return; cancelAnimationFrame(DR.raf); DR.g.remove(); DR.row.classList.remove('dragsrc'); const t=DR.target; if(t) t.classList.remove('droptarget');
  const src=DR; DR=null; if(ok&&t){const [d2,k2]=t.dataset.slot.split(':'); if(swapSlots(src.d,src.k,+d2,k2)){save();render()}}}
document.addEventListener('pointerup',()=>endDrag(true));
document.addEventListener('pointercancel',()=>endDrag(false));
function build(){
  UI.sheet=null; S.stage='gen'; render();
  setTimeout(()=>{try{generate(); S.stage='app'; S.tab='menu'; save(); render(); window.scrollTo(0,0); toast('Меню готово. Замените лишнее и утвердите')}
   catch(e){console.error(e); S.stage='app'; render(); toast('Не получилось составить меню. Попробуйте ещё раз')}},900);
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]'); if(!t) return;
  if(t.classList.contains('scrim')&&e.target!==t) return;
  if(t.matches('input,select')) return;
  act(t.dataset.act,t.dataset.v,t);
});
document.addEventListener('change',e=>{const t=e.target; if(!t.dataset||!t.dataset.act) return; const a=t.dataset.act;
  if(a==='pqty'){S.pantry[+t.dataset.v].qty=Math.min(1e9,Math.max(0,Math.round((+t.value||0)*1000)/1000)); save(); render(); return}
  if(a==='mname'){S.profile.members[+t.dataset.v].name=t.value.trim()||'Без имени'; save(); render(); return}
  if(a==='mnum'){const [i,f]=t.dataset.v.split(':'); S.profile.members[+i][f]=t.value; save(); render(); return}
  if(a==='msel'){const [i,f]=t.dataset.v.split(':'); S.profile.members[+i][f]=t.value; save(); render(); return}
  if(['soupBatch','city','remOn','remT','bought','remHave'].includes(a)) act(a,t.dataset.v,t);
});
function refocus(id){const i=document.getElementById(id); if(i){i.focus(); i.setSelectionRange(i.value.length,i.value.length)}}
document.addEventListener('input',e=>{const t=e.target;
  if(t.dataset.act==='budget'){S.profile.budget=+t.value; S.profile.budgetSet=true; const b=$('#budgetv'); if(b) b.textContent=rub(S.profile.budget); save()}
  if(t.dataset.act==='search'){UI.q=t.value; render(); refocus('pq')}
  if(t.dataset.act==='dsearch'){UI.dq=t.value; render(); refocus('dq')}
});
document.addEventListener('submit',async e=>{
  const f=e.target; if(!f.dataset||f.dataset.form!=='kadd') return; e.preventDefault();
  const inp=$('#kadd'),msg=$('#kmsg'),txt=inp.value.trim(); if(!txt) return;
  const ti=todayIdx(); if(ti<0) return;
  let items=parseFoods(txt),unknown=items.filter(x=>!x.ok),known=items.filter(x=>x.ok);
  if(unknown.length){
    if(SAMPLE){ msg.textContent='Считаем калории…'; const ai=await aiKcal(unknown.map(x=>x.label));
      if(ai){known=known.concat(ai.filter(x=>x.ok)); unknown=ai.filter(x=>!x.ok)} }
    if(unknown.length){ msg.textContent=`Не узнали: ${unknown.map(x=>x.label).join(', ')}. Уточните (например, «200 г творога») или напишите калории числом.`; if(!known.length) return }
  }
  const dk=S.plan.days[ti].date.slice(0,10); S.extra[dk]=S.extra[dk]||{}; const arr=(S.extra[dk][UI.member]=S.extra[dk][UI.member]||[]);
  known.forEach(x=>arr.push({label:x.label,kcal:x.kcal}));
  const who=(S.profile.members.find(m=>m.id===UI.member)||{}).name||'';
  toast(known.map(x=>`${x.label} ≈ ${x.kcal} ккал`).join(', ')+(who?` — добавили: ${who}`:''));
  save(); render();
});
document.addEventListener('keydown',e=>{
  if(UI.cook){ if(e.key==='ArrowRight'){act('cnext');return} if(e.key==='ArrowLeft'){act('cprev');return} if(e.key==='Escape'){act('cclose');return} }if(e.key==='Escape'&&UI.sheet){UI.sheet=null;render()} if((e.key==='Enter'||e.key===' ')&&e.target.matches('li[data-act]')){e.preventDefault();act('step',e.target.dataset.v)}});
if(S.stage==='gen') S.stage=S.plan?'app':'intro';
