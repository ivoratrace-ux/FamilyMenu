/* ============ v8 «Frigo»: v4 look with the v6 flow ============
   splash → 4 feature slides → 5-step getting to know → 2 s loader → first menu → Telegram sign-in
   tabs: Меню · Покупки · Дома · Профиль; per-meal kinds, 1–7 days, main+side pairs, own recipes, Premium as a subscription */

const SLOT8={b:'Завтрак',l:'Обед',s:'Перекус',d:'Ужин'};
const KIND8={breakfast:'Завтрак: каши, яйца, сырники',soup:'Суп',pair:'Второе с гарниром',dish:'Целое блюдо или салат',dessert:'Десерт',drink:'Напиток',snack:'Перекус',none:'Не нужен'};
const KOPT8={b:['breakfast','drink'],l:['soup','pair','dish','drink','dessert'],s:['snack','dessert','drink'],d:['pair','dish','soup','drink','dessert']};
const KSHORT8={breakfast:'Завтрак',soup:'Суп',pair:'Второе с гарниром',dish:'Блюдо или салат',drink:'Напиток',dessert:'Десерт',snack:'Перекус'};
const KTAG8={soup:'суп',pair:'второе',dish:'блюдо',drink:'напиток',dessert:'десерт',snack:'перекус',breakfast:''};
/* Snacks, desserts and drinks open with the subscription. */
const kopt8=k=>KOPT8[k];
const MYK8={breakfast:['Завтрак','b'],soup:['Суп','m'],main:['Основное: мясо, рыба','p'],side:['Гарнир','g'],dish:['Целое блюдо или салат','m'],dessert:['Десерт','z'],drink:['Напиток','k'],snack:['Перекус','s']};
const GOAL8={lose:'Похудение',mass:'Набор массы',pp:'Правильное питание',protein:'Больше белка',lowcarb:'Меньше углеводов',none:'Просто вкусно и разнообразно'};
const PAGES8={rec8:'Рецепт',diary:'Дневник',pBudget:'Бюджет и цены',pFamily:'Семья',pFood:'Питание и ограничения',pRecipes:'Мои рецепты',pRecipe:'Рецепт',pDays:'Дни и приёмы пищи',autocart:'Автосборка корзины',promo:'Подборка акций',kcal:'Калории и КБЖУ',sub:'Premium',metrics:'Метрики пилота'};
const trialOn8=()=>!!V().trialStart&&!subscribed()&&dayN()<7;
const premium8=()=>subscribed()||trialOn8();
const premiumNote8=()=>subscribed()?'Подписка подключена':trialOn8()?`Открыто бесплатно ещё ${daysW(7-dayN())}`:V().trialStart?'Пробные 7 дней закончились':'Откроется на 7 дней с первым меню';

/* ---------- profile defaults & compatibility with the stored model ---------- */
function P8(){
  const p=S.profile;
  if(!p.mealSetup) p.mealSetup={b:p.meals&&p.meals.b?'breakfast':'none',l:p.meals&&p.meals.l===false?'none':'soup',s:'none',d:p.meals&&p.meals.d===false?'none':'pair'};
  // Since v8.4 every meal holds a list of kinds (several dishes per meal).
  for(const k of ['b','l','s','d']){const v=p.mealSetup[k]; if(!Array.isArray(v)) p.mealSetup[k]=!v||v==='none'?[]:[v]; p.mealSetup[k]=p.mealSetup[k].filter(x=>KOPT8[k].includes(x))}
  if(!(p.days>=1&&p.days<=7)) p.days=3;
  if(!Array.isArray(S.myRecipes)) S.myRecipes=[];
  if(!S.ans) S.ans={};
  p.soupBatch=false; p.kcalOn=true;
  p.meals={b:!!p.mealSetup.b.length,l:!!p.mealSetup.l.length,s:!!p.mealSetup.s.length,d:!!p.mealSetup.d.length,z:false,k:false};
  return p;
}
const anyMeal8=()=>['b','l','s','d'].some(k=>P8().mealSetup[k].length);
/* Slot keys look like «l_soup»: meal and kind. Older menus use plain «l». */
const ORDER8=['b','l','s','d','z','k'];
const baseOf8=k=>k.split('_')[0];
function keysOf8(day){return Object.keys(day.slots).sort((a,b)=>ORDER8.indexOf(baseOf8(a))-ORDER8.indexOf(baseOf8(b))||(KOPT8[baseOf8(a)]||[]).indexOf(a.split('_')[1])-(KOPT8[baseOf8(b)]||[]).indexOf(b.split('_')[1]))}
function nameSlot8(key){if(SLOT_NAMES[key]) return; const [b,kind]=key.split('_'); SLOT_NAMES[key]=(SLOT8[b]||SLOT_NAMES[b]||'')+(kind&&KTAG8[kind]?' · '+KTAG8[kind]:'')}
nextSlotKey=function(di){
  const d=S.plan.days[di],keys=keysOf8(d),h=NOW().getHours()+NOW().getMinutes()/60;
  return keys.find(k=>SLOT_END[baseOf8(k)]>h&&!d.slots[k].cooked&&!S.eaten[eatKey(di,k)])||keys.find(k=>!d.slots[k].cooked&&!S.eaten[eatKey(di,k)])||keys[keys.length-1];
};
/* ---------- recipes: own recipes and main+side combinations ---------- */
function comboOf(main,side){
  const id=`c_${main.id}_${side.id}`; if(RBY[id]) return RBY[id];
  const amounts={}; for(const [k,q] of [...main.i,...side.i]) amounts[k]=(amounts[k]||0)+q;
  const withP=(side.tags.find(t=>t.startsWith('with:'))||'').slice(5)||('с '+side.n.toLowerCase());
  const r={id,art:main.art,imageUrl:main.imageUrl,n:main.n+' '+withP,m:'c',t:Math.max(main.t,side.t)+5,tags:[],i:Object.entries(amounts),sp:[...new Set([...(main.sp||[]),...(side.sp||[])])],
    s:['Гарнир. '+side.s[0],...main.s,...side.s.slice(1).map(x=>'Гарнир. '+x)]};
  deriveRecipe(r); RBY[id]=r; R.push(r); return r;
}
function registerMine(src){
  if(RBY[src.id]||src.i.some(([k])=>!ING[k])) return;
  const r={...src,tags:[...src.tags],i:src.i.map(x=>[...x]),sp:[...(src.sp||[])],s:[...src.s]}; deriveRecipe(r); RBY[r.id]=r; R.push(r);
}
function ensureRecipes(){
  (S.myRecipes||[]).forEach(registerMine);
  if(S.plan) S.plan.days.forEach(d=>Object.keys(d.slots).forEach(nameSlot8));
  if(S.plan) S.plan.days.forEach(d=>Object.values(d.slots).forEach(s=>{
    const m=s&&s.rid&&!RBY[s.rid]&&/^c_(.+)_(g\d+)$/.exec(s.rid); if(m&&RBY[m[1]]&&RBY[m[2]]) comboOf(RBY[m[1]],RBY[m[2]]);
  }));
}
const artOrig8=window.dishArt;
window.dishArt=function(r){
  if(r&&!r.art&&!r.imageUrl) return `<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(r.n)}" preserveAspectRatio="xMidYMid slice"><rect width="400" height="260" fill="#e2eee6"/><circle cx="200" cy="130" r="78" fill="#fff"/><text x="200" y="152" text-anchor="middle" font-family="Literata,Georgia,serif" font-size="64" fill="#2c6a4c">${esc((r.n||'?')[0].toUpperCase())}</text></svg>`;
  return artOrig8(r);
};
function pool8(kind){
  const all=R.filter(r=>r.m!=='c'&&allowed(r));
  switch(kind){
   case 'breakfast': return all.filter(r=>r.m==='b');
   case 'soup': return all.filter(r=>r.m==='m'&&isSoup(r));
   case 'dish': return all.filter(r=>r.m==='m'&&!isSoup(r));
   case 'pair': return all.filter(r=>r.m==='p');
   case 'side': return all.filter(r=>r.m==='g');
   case 'dessert': return all.filter(r=>r.m==='z');
   case 'drink': return all.filter(r=>r.m==='k');
   case 'snack': return all.filter(r=>r.m==='s');
  }
  return [];
}
poolFor=(function(orig){return function(slot){
  slot=String(slot); if(slot.startsWith('k:')) return pool8(slot.slice(2));
  const kind=slot.split('_')[1]; if(!kind) return orig(slot);
  // Replacing «второе с гарниром» offers mains already paired with a side.
  if(kind==='pair') return pool8('pair').map(m=>{const sides=pool8('side'),pref=sides.find(x=>(m.tags||[]).includes('pair:'+x.id))||sides[0];return pref?comboOf(m,pref):m});
  return pool8(kind);
}})(poolFor);
/* Budget shapes the dishes: a small budget prefers cheaper recipes, a large one — salmon, beef, shrimp and other pricier dishes. */
function budgetLevel8(){const p=S.profile,per=p.budget/Math.max(1,p.members.length);return Math.max(-2.5,Math.min(3,(per-3500)/1500))}
const AVG8={};
function costZ8(r){const m=r.m==='c'?'p':r.m; if(AVG8[m]==null){const list=R.filter(x=>x.m===m);AVG8[m]=list.length?list.reduce((a,x)=>a+rc(x),0)/list.length:1} return Math.max(-1,Math.min(2,(rc(r)-AVG8[m])/Math.max(1,AVG8[m])))}
score=(function(orig){return function(r,ctx){return orig(r,ctx)+budgetLevel8()*costZ8(r)*2}})(score);
function sideFor(main){const sides=pool8('side'); if(!sides.length) return null; const pref=sides.filter(x=>(main.tags||[]).includes('pair:'+x.id)); const list=pref.length?pref:sides; return list[Math.floor(Math.random()*list.length)]}

/* ---------- menu generation: chosen kinds, 1–7 days (the stored menu keeps 7 days) ---------- */
generate=function(){
  const p=P8(),start=day0(NOW()),used={},por=portions(),days=[]; let prev=null;
  for(let d=0;d<7;d++){
    const date=addDays(start,d),wd=date.getDay(),weekend=wd===0||wd===6,slots={};
    if(d<p.days) for(const k of ['b','l','s','d']) for(const kind of KOPT8[k].filter(x=>p.mealSetup[k].includes(x))){
      let r=pick('k:'+kind,used,weekend,k==='d'?{prevProtein:prev}:{});
      if(r&&kind==='pair'){const side=sideFor(r); if(side) r=comboOf(r,side)}
      const key=k+'_'+kind; nameSlot8(key); slots[key]={rid:r&&r.id,serv:por}; if(k==='d'&&r&&['pair','dish'].includes(kind)) prev=r.protein;
    }
    days.push({date:date.toISOString(),slots});
    if(d<p.days) topUp8(days[d],used,weekend);
  }
  S.plan={created:NOW().toISOString(),status:'draft',days}; S.bought={}; S.eaten={}; S.extra={};
  fit8();
};
/* Hard limits. Portions are scaled per person (need ÷ 2 200), so a day of standard portions within 2 200 kcal keeps
   every person within their own norm. The plan must also fit the budget for its days. */
const kindOfKey8=k=>(k.split('_')[1]||'').replace(/\d+$/,'')||({b:'breakfast',l:'soup',d:'dish',s:'snack',z:'dessert',k:'drink'}[k]||'');
const OPTIONAL8=['snack','dessert','drink'];
function budgetLimit8(){const p=S.profile;return p.budget*p.days/7}
function swapFor8(day,key,better){
  const kind=kindOfKey8(key),cur=RBY[day.slots[key].rid]; if(!cur) return false;
  const taken=new Set(Object.values(day.slots).map(x=>x.rid));
  let pool=kind==='pair'?poolFor('l_pair'):pool8(kind); pool=pool.filter(r=>!taken.has(r.id)&&better(r,cur));
  if(!pool.length) return false; pool.sort((a,b)=>score(b,{})-score(a,{})); day.slots[key].rid=pool[0].id; return true;
}
function fit8(){
  const days=S.plan.days.filter(d=>Object.keys(d.slots).length),cap=KCAL_TARGET8;
  const live=d=>Object.keys(d.slots).filter(k=>d.slots[k].rid&&RBY[d.slots[k].rid]);
  // 1) calories: lighter dishes; if that is not enough, drop a meal (snacks, drinks, desserts first)
  for(const day of days) for(let n=0;n<14&&dayKcal8(day)>cap;n++){
    const keys=live(day).sort((a,b)=>RBY[day.slots[b].rid].kcal-RBY[day.slots[a].rid].kcal),over=dayKcal8(day)-cap,auto=keys.find(k=>day.slots[k].auto);
    if(auto){delete day.slots[auto]; continue}
    if(keys.some(k=>swapFor8(day,k,(r,cur)=>r.kcal<cur.kcal&&r.kcal>=cur.kcal-over-250))) continue;
    const drop=keys.find(k=>OPTIONAL8.includes(kindOfKey8(k)))||(keys.length>1?keys[0]:null); if(!drop) break; delete day.slots[drop];
  }
  // 2) budget: cheaper dishes (biggest saving first, never above the calorie cap); then drop the priciest meal
  const limit=budgetLimit8(),costOf=(k,d)=>{const sl=d.slots[k];return rc(RBY[sl.rid])*sl.serv/4};
  for(let n=0;n<80&&shopping().cost>limit;n++){
    let best=null;
    for(const d of days) for(const k of live(d)){
      const cur=RBY[d.slots[k].rid],kind=kindOfKey8(k),taken=new Set(Object.values(d.slots).map(x=>x.rid));
      const pool=(kind==='pair'?poolFor('l_pair'):pool8(kind)).filter(r=>!taken.has(r.id)&&rc(r)<rc(cur)&&dayKcal8(d)-cur.kcal+r.kcal<=cap);
      for(const r of pool){const save=(rc(cur)-rc(r))*d.slots[k].serv/4; if(!best||save>best.save) best={d,k,r,save}}
    }
    if(best&&best.save>1){best.d.slots[best.k].rid=best.r.id; continue}
    const all=days.flatMap(d=>live(d).map(k=>[k,d])).filter(([,d])=>live(d).length>1).sort((a,b)=>(OPTIONAL8.includes(kindOfKey8(b[0]))-OPTIONAL8.includes(kindOfKey8(a[0])))||costOf(b[0],b[1])-costOf(a[0],a[1]));
    if(!all.length) break; delete all[0][1].slots[all[0][0]];
  }
}
/* Calories: a day of standard portions should give ≈2 200 kcal (portions are scaled per person).
   Below 2 000 — add filling snacks (up to two); above 2 600 — drop dessert or drink snacks first. */
const KCAL_TARGET8=2200;
function dayKcal8(day){return Object.values(day.slots).reduce((a,s)=>a+((s&&s.rid&&RBY[s.rid])?RBY[s.rid].kcal:0),0)}
function topUp8(day,used,weekend){
  const por=portions();
  for(let n=1;n<=2&&dayKcal8(day)<KCAL_TARGET8-200;n++){
    const gap=KCAL_TARGET8-dayKcal8(day),taken=new Set(Object.values(day.slots).map(s=>s.rid));
    const list=pool8('snack').filter(r=>!taken.has(r.id)&&r.kcal<=KCAL_TARGET8-dayKcal8(day)).map(r=>({r,s:-Math.abs(r.kcal-gap)/100+score(r,{})*.3+Math.random()})).sort((a,b)=>b.s-a.s);
    if(!list.length) break; const key=n===1?'s_snack':'s_snack2'; SLOT_NAMES[key]='Перекус'; day.slots[key]={rid:list[0].r.id,serv:por,auto:true};
  }
}
const generateOnce8=generate;
generate=function(){
  const p=P8(),limit=p.budget*p.days/7; let best=null;
  for(let i=0;i<4;i++){generateOnce8(); const cost=shopping().cost; if(!best||cost<best.cost) best={plan:S.plan,cost}; if(cost<=limit) break}
  S.plan=best.plan; if(!V().trialStart){V().trialStart=NOW().toISOString(); track('trial_started')}
  track('menu_built',{days:p.days,cost:Math.round(best.cost),budget:Math.round(limit)});
};
build=function(){
  UI.sheet=null; P8(); S.stage='gen'; UI.mday=null; render(); window.scrollTo(0,0);
  setTimeout(()=>{
    try{generate(); S.stage=FamilyMenuApi.session?'app':'ready'; S.tab='menu'; save(); render(); window.scrollTo(0,0)}
    catch(e){console.error(e); S.stage=S.plan?'app':'quiz'; render(); toast('Не получилось составить меню. Попробуйте ещё раз')}
  },2000);
};
const visibleDays=()=>S.plan?S.plan.days.map((d,i)=>[d,i]).filter(([d])=>Object.keys(d.slots).length):[];

/* ---------- small pieces ---------- */
const head8=(eyebrow,title,right='')=>`<div class="row between" style="align-items:flex-end"><div class="grow">${eyebrow?`<p class="eyebrow">${eyebrow}</p>`:''}<h1>${title}</h1></div>${right}</div>`;
const navRow8=(act,v,icon,title,sub,lock)=>`<button class="ditem navrow" data-act="${act}" data-v="${v}">${lock?IC.lock:icon}<span class="grow"><b>${title}</b>${sub?`<br><span class="small muted">${sub}</span>`:''}</span><span class="muted" aria-hidden="true">›</span></button>`;
/* Chip lists show three rows; the rest hides behind «Ещё», which sits on the third row. */
const CLAMP_ROWS=3;
function clampChips(){
  document.querySelectorAll('.chips[data-clamp]').forEach(box=>{
    const key=box.dataset.clamp,more=box.querySelector('.morechip'),chips=[...box.querySelectorAll('.chip:not(.morechip)')];
    chips.forEach(c=>c.hidden=false); more.hidden=true;
    if(UI.open8&&UI.open8[key]){more.hidden=false; more.textContent='Свернуть'; return}
    const tops=[...new Set(chips.map(c=>c.offsetTop))].sort((a,b)=>a-b); if(tops.length<=CLAMP_ROWS) return;
    const limit=tops[CLAMP_ROWS-1]; chips.forEach(c=>{if(c.offsetTop>limit) c.hidden=true});
    more.hidden=false; more.textContent='Ещё ▾';
    const vis=chips.filter(c=>!c.hidden); while(more.offsetTop>limit&&vis.length) vis.pop().hidden=true;
  });
}
const clampBox8=(key,list,isOn,act,cls='')=>`<div class="chips" data-clamp="${key}">${list.length?list.map(([k,l])=>`<button class="chip ${cls}" data-act="${act}" data-v="${esc(k)}" aria-pressed="${isOn(k)}">${esc(l)}</button>`).join(''):'<span class="small muted">Ничего не нашли</span>'}<button class="chip morechip" data-act="more8" data-v="${key}">Ещё ▾</button></div>`;
/* One-word labels: allergens and ingredients grouped by their first word (e.g. «Брокколи замороженная» → «Брокколи»). */
const ALLERG8={gluten:'Глютен',milk:'Молоко',lactose:'Лактоза',egg:'Яйца',fish:'Рыба',crustacean:'Креветки',mollusc:'Моллюски',peanut:'Арахис',nuts:'Орехи',soy:'Соя',sesame:'Кунжут',mustard:'Горчица',celery:'Сельдерей',citrus:'Цитрусовые',honey:'Мёд'};
const word8=name=>{const w=name.replace(/\(.*?\)/g,'').replace(/[«»"]/g,'').trim().split(/[\s,]+/)[0]||name;return w[0].toUpperCase()+w.slice(1)};
let DISLIKE8=null;
function dislikeGroups8(){
  if(DISLIKE8) return DISLIKE8; const m=new Map();
  Object.keys(ING).filter(k=>!['oil','sugar','salt','water'].includes(k)).forEach(k=>{const w=word8(ING[k][0]);if(!m.has(w)) m.set(w,[]);m.get(w).push(k)});
  return DISLIKE8=[...m].sort((a,b)=>a[0].localeCompare(b[0],'ru'));
}
const match8=(q,label)=>!q||label.toLowerCase().includes(q.trim().toLowerCase());
function restr8(){
  const p=S.profile,qa=(UI.rs8||{}).allerg||'',qd=(UI.rs8||{}).dislike||'';
  const groups=dislikeGroups8(),byWord=Object.fromEntries(groups);
  return `<div class="card eqcard"><h3>Аллергии</h3><p class="small muted oneline">Такие блюда исключим полностью</p>
    <input type="search" class="minisearch" id="rs8_allerg" data-act="rsearch8" data-v="allerg" value="${esc(qa)}" placeholder="Найти: молоко, орехи…" autocomplete="off" aria-label="Поиск аллергии">
    ${clampBox8('allerg',Object.entries(ALLERG8).filter(([,l])=>match8(qa,l)),k=>p.allergies.includes(k),'allergy','danger')}</div>
   <div class="card eqcard"><h3>Не нравится</h3><p class="small muted oneline">Эти продукты не попадут в меню</p>
    <input type="search" class="minisearch" id="rs8_dislike" data-act="rsearch8" data-v="dislike" value="${esc(qd)}" placeholder="Найти: лук, грибы…" autocomplete="off" aria-label="Поиск продукта">
    ${clampBox8('dislike',groups.filter(([w])=>match8(qd,w)).map(([w])=>[w,w]),w=>byWord[w].every(k=>p.dislikes.includes(k)),'dislike8')}</div>`;
}
const stepper8=(act,val,label)=>`<div class="stepper big"><button data-act="${act}" data-v="-1" aria-label="Меньше">−</button><span>${label}</span><button data-act="${act}" data-v="1" aria-label="Больше">+</button></div>`;
function details8(){
  const p=P8(),n=p.members.length;
  return `<div class="card bigcount"><div><h2>Дней в меню</h2><p class="small muted">максимум — неделя</p></div>${stepper8('days8',p.days,p.days)}</div>
   <div class="card bigcount"><div><h2>Персон</h2><p class="small muted">сколько человек едят</p></div>${stepper8('persons8',n,n)}</div>
   <p class="small muted">Завтрак, обед и ужин можно настроить потом: меню слева сверху → «Дни и приёмы пищи».</p>`;
}
function budget8(){const p=S.profile;return `
  <div class="card"><label class="field" for="budget">Бюджет на продукты в неделю<b id="budgetv" style="color:var(--fg);font-size:20px;font-variant-numeric:tabular-nums">${rub(p.budget)}</b></label>
   <input type="range" id="budget" min="2000" max="30000" step="500" value="${p.budget}" data-act="budget" aria-label="Бюджет в неделю"><p class="small muted">Меню на ${p.days} ${plural(p.days,'день','дня','дней')} подберём в пределах ≈${rub(p.budget*p.days/7)}</p></div>
  <div class="card"><label class="field" for="city">Город — по нему считаем цены<select id="city" data-act="city">${Object.entries(CITIES).map(([k,[l]])=>`<option value="${k}" ${p.city===k?'selected':''}>${l}</option>`).join('')}</select></label></div>
`}
function mealKinds8(){const p=P8();return `<div class="card"><h3>Приёмы пищи</h3><p class="small muted">Можно выбрать несколько блюд на один приём пищи</p>
   ${Object.entries(SLOT8).map(([k,l])=>`<div class="mealrow8"><b>${l}</b><div class="chips">${KOPT8[k].map(o=>`<button class="chip" data-act="kind8" data-v="${k}:${o}" aria-pressed="${p.mealSetup[k].includes(o)}">${KSHORT8[o]}</button>`).join('')}</div></div>`).join('')}
   ${anyMeal8()?'':'<p class="small" style="color:var(--danger)">Выберите хотя бы одно блюдо</p>'}</div>`}
function days8card(){const p=P8();return `<div class="card"><div class="row between"><h3>Дней в меню</h3>${stepper8('days8',p.days,p.days)}</div><p class="small muted">Максимум — неделя</p></div>`}
function timeCard8(){const p=S.profile;return `<div class="card"><h3>Сколько готовить в будни</h3>${chips({30:'до 30 мин',45:'до 45 мин',60:'до часа',0:'не важно'},[String(p.maxTime)],'time')}<p class="small muted">В выходные — на 30 минут дольше</p></div>`}

/* ---------- pantry block (fridge step and «Дома») ---------- */
const defQty8=k=>{const u=ING[k][2];return u==='g'?500:u==='ml'?1000:1};
const hasP8=k=>S.pantry.some(x=>x.key===k);
function togglePantry8(k){const i=S.pantry.findIndex(x=>x.key===k); if(i>=0) S.pantry=S.pantry.filter(x=>x.key!==k); else S.pantry.push({key:k,qty:defQty8(k)})}
/* Small picture for a product: colour of the ingredient in step art, its first letter. */
const EMOJI8={carrot:'🥕',beet:'🫜',potato:'🥔',onion:'🧅',garlic:'🧄',tomato:'🍅',cucumber:'🥒',bell_pepper:'🫑',zucchini:'🥒',eggplant:'🍆',pumpkin:'🎃',broccoli:'🥦',cauliflower:'🥦',cabbage:'🥬',lettuce:'🥬',spinach:'🥬',greens:'🌿',celery:'🥬',green_peas:'🫛',corn:'🌽',mushrooms:'🍄',avocado:'🥑',lemon:'🍋',orange:'🍊',apple:'🍎',banana:'🍌',berries:'🫐',cranberries:'🍒',raisins:'🍇',
 chicken_fillet:'🍗',chicken_thigh:'🍗',chicken_liver:'🍗',turkey:'🦃',minced_turkey:'🦃',beef:'🥩',pork:'🥓',minced_mix:'🥩',fish_white:'🐟',cod:'🐟',salmon:'🍣',tuna:'🐟',shrimp:'🦐',squid:'🦑',
 eggs:'🥚',milk:'🥛',kefir:'🥛',yogurt:'🥛',cream:'🥛',sour_cream:'🥛',cheese:'🧀',feta:'🧀',processed_cheese:'🧀',cottage:'🥣',butter:'🧈',tofu:'🍢',
 rice:'🍚',buckwheat:'🌾',bulgur:'🌾',millet:'🌾',quinoa:'🌾',oats:'🌾',semolina:'🌾',barley:'🌾',pasta:'🍝',noodles:'🍜',flour:'🌾',lentils:'🫘',chickpeas:'🫘',beans:'🫘',peas_dry:'🫘',
 bread:'🍞',lavash:'🫓',honey:'🍯',sugar:'🧂',oil:'🫒',walnuts:'🌰',peanut_butter:'🥜',sesame:'🌰',cocoa:'🍫',tea:'🍵',coconut_milk:'🥥',canned_tomatoes:'🥫',tomato_paste:'🥫',pickles:'🥒',soy_sauce:'🍶',mustard:'🍯'};
const CATEMOJI8={'Овощи и зелень':'🥬','Фрукты и ягоды':'🍎','Мясо и рыба':'🥩','Молочное и яйца':'🥛','Бакалея':'🌾','Хлеб':'🍞'};
function ingPic8(k){return `<span class="ingpic8" aria-hidden="true">${EMOJI8[k]||CATEMOJI8[ING[k][1]]||'🛒'}</span>`}
function pantry8(full){
  const q=(UI.q8||'').trim().toLowerCase(),found=q?Object.keys(ING).filter(k=>ING[k][0].toLowerCase().includes(q)).slice(0,12):[];
  const cats=CAT_ORDER.filter(c=>Object.keys(ING).some(k=>ING[k][1]===c)),photos=UI.photos||[],open=UI.cat8;
  const short={'Овощи и зелень':'Овощи','Фрукты и ягоды':'Фрукты','Мясо и рыба':'Мясо и рыба','Молочное и яйца':'Молочное','Бакалея':'Бакалея','Хлеб':'Хлеб'};
  const ks=open?Object.keys(ING).filter(k=>ING[k][1]===open&&!['salt','water'].includes(k)).sort((a,b)=>ING[a][0].localeCompare(ING[b][0],'ru')):[];
  return `<input type="search" class="bigsearch" id="pq8" placeholder="Найти продукт: курица, рис, сыр…" value="${esc(UI.q8||'')}" data-act="search8" autocomplete="off" aria-label="Поиск продукта">
   ${q?(found.length?`<div class="chips">${found.map(k=>`<button class="chip" data-act="pt8s" data-v="${k}" aria-pressed="${hasP8(k)}">${hasP8(k)?'✓ ':'+ '}${esc(ING[k][0])}</button>`).join('')}</div>`:'<p class="small muted">Ничего не нашли — попробуйте по-другому.</p>'):''}
   <div class="phototiles">${[0,1].map(i=>{const ph=photos[i];return ph?`<div class="phototile"><img src="${ph.url}" alt="Фото ${i+1}"><button class="iconbtn photodel" data-act="photoDel" data-v="${i}" aria-label="Удалить фото ${i+1}">✕</button></div>`
     :`<button class="phototile" data-act="photoAdd"><span class="plusbig">+</span><span class="small muted">${i?'Фото полок':'Фото холодильника'}</span></button>`}).join('')}</div>
   ${photos.length>2?`<p class="small muted">Ещё фото: ${photos.length-2}</p>`:''}
   ${photos.length?(FamilyMenuApi.session?`<button class="btn block" data-act="scan8" ${UI.scanBusy?'disabled':''}>${UI.scanBusy?'Распознаём фото…':`Распознать продукты (${photos.length})`}</button>`:'<p class="small muted">Распознаем продукты на фото после того, как вы сохраните меню.</p>'):''}
   ${UI.scanErr?`<p class="small" role="alert" style="color:var(--danger)">${esc(UI.scanErr)}</p>`:''}
   ${UI.scan?scanResult8():''}
   <div class="cats8">${cats.map(c=>{const n=Object.keys(ING).filter(k=>ING[k][1]===c&&hasP8(k)).length;
     return `<button class="cat8" data-act="cat8" data-v="${esc(c)}" aria-expanded="${open===c}"><span class="oneline">${short[c]||esc(c)}</span>${n?`<span class="pill">${n}</span>`:''}<span class="plus">${open===c?'−':'+'}</span></button>`}).join('')}</div>
   ${open?`<div class="card"><h3>${esc(open)}</h3><div class="chips">${ks.map(k=>`<button class="chip" data-act="pt8" data-v="${k}" aria-pressed="${hasP8(k)}">${esc(ING[k][0])}</button>`).join('')}</div></div>`:''}
   ${full&&S.pantry.length?`<h3>Детали</h3>${S.pantry.map((p,i)=>`<div class="card prow8">${ingPic8(p.key)}<span class="grow prname8">${esc(ING[p.key][0])}${p.src==='list'?'<br><span class="small muted">из списка покупок</span>':''}</span>
     <input type="number" inputmode="decimal" id="pqty_${i}" value="${p.qty}" min="0" max="1000000000" step="0.001" style="width:84px" data-act="pqty" data-v="${i}" aria-label="Количество: ${esc(ING[p.key][0])}"><span class="small muted" style="width:34px">${unitLabel(p.key)}</span>
     <button class="iconbtn" data-act="delP" data-v="${i}" aria-label="Удалить ${esc(ING[p.key][0])}">✕</button></div>`).join('')}`:''}`;
}
function scanResult8(){
  const sc=UI.scan;
  return `<div class="card"><h3>Что нашли на фото</h3>${sc.products.map((p,i)=>{
    const id=sc.pick[i];
    if(p.ingredientId) return `<label class="toggle"><span>${esc(ING[p.ingredientId]?ING[p.ingredientId][0]:p.name)}<br><span class="small muted">${esc(p.amount)}</span></span><input type="checkbox" class="chk2" data-act="scanSel" data-v="${i}" ${sc.on[i]?'checked':''}></label>`;
    if(p.alternatives.length) return `<div class="stack" style="gap:6px"><span>${esc(p.name)} <span class="small muted">· ${esc(p.amount)} · выберите вариант</span></span><div class="chips">${p.alternatives.map(a=>`<button class="chip" data-act="scanAlt" data-v="${i}:${a.ingredientId}" aria-pressed="${id===a.ingredientId}">${esc(a.name)}</button>`).join('')}</div></div>`;
    return `<p class="small muted">${esc(p.name)} · ${esc(p.amount)} — нет в справочнике, пропустим</p>`;
  }).join('')}
   <div class="row"><button class="btn grow" data-act="scanSave">Добавить в «Дома»</button><button class="btn ghost" data-act="scanCancel">Отмена</button></div></div>`;
}
async function photoFiles8(files){
  for(const f of [...files].slice(0,5-(UI.photos||[]).length)){
    try{
      const url=URL.createObjectURL(f),img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url});
      const k=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height); const data=c.toDataURL('image/jpeg',.82);
      (UI.photos=UI.photos||[]).push({url:data,image:data.split(',')[1],mimeType:'image/jpeg'}); URL.revokeObjectURL(url);
    }catch(e){UI.scanErr='Не удалось открыть фото. Попробуйте другое.'}
  }
  render();
}
async function scan8(){
  UI.scanBusy=true; UI.scanErr=null; render();
  try{
    const res=await FamilyMenuApi.request('/api/fridge/scan',{method:'POST',body:{images:UI.photos.map(p=>({mimeType:p.mimeType,image:p.image}))}});
    const products=(res.products||[]).filter(p=>!p.ingredientId||ING[p.ingredientId]);
    UI.scan={products,on:products.map(p=>!!p.ingredientId),pick:products.map(()=>null)}; track('fridge_scanned',{n:products.length});
  }catch(e){UI.scanErr=e.message||'Не удалось распознать фото.'}
  UI.scanBusy=false; render();
}

/* ---------- screens before the app ---------- */
const SLIDES8=[
 {t:'Меню на неделю для всей семьи',d:'Блюда, которые семья правда съест: суп на обед, второе на ужин — как привыкли. Аллергии учтём.',btn:'А что ещё?',art:()=>`<div class="collage">${['m5','m3','b1','m66'].filter(id=>RBY[id]).map(id=>`<div class="heroimg">${dishArt(RBY[id])}</div>`).join('')}</div>`},
 {t:'Список покупок соберётся сам',d:'С точными граммами и без дублей. Корзину во ВкусВилле или Лавке соберёте по шагам.',btn:'Ух ты, понял',art:()=>`<div class="card introlist">${[['potato',1.4],['chicken_fillet',700],['buckwheat',300],['tomato',400]].filter(([k])=>ING[k]).map(([k,q])=>`<div class="row between"><span class="row"><span class="chkfake"></span>${esc(ING[k][0])}</span><span class="qty">${q<10?dec(q)+' кг':q+' г'}</span></div>`).join('')}<div class="row between small"><span class="pill">ВкусВилл ≈ 1 240 ₽</span><span class="pill warn">Лавка ≈ 1 090 ₽</span></div></div>`},
 {t:'Первая неделя — бесплатно',d:'Акции и сравнение цен открыты 7 дней. Готовьте по шагам с таймером.',btn:'Начать',art:()=>`<div class="heroimg">${stepArt(RBY.m2,3)}</div><div class="card timerbox" style="margin-top:-30px;width:70%;align-self:center"><span class="bigtime" style="font-size:40px">4:59</span></div>`},
];
function intro8(){
  const i=Math.min(S.introIdx||0,SLIDES8.length-1),s=SLIDES8[i];
  return `<div class="screen onbscreen">
   <div class="row between">${i?'<button class="iconbtn" data-act="introBack8" aria-label="Назад">←</button>':'<span style="width:36px"></span>'}<div class="progress grow" style="margin:0 12px"><i style="width:${Math.round((i+1)/SLIDES8.length*100)}%"></i></div><span style="width:36px"></span></div>
   <div class="stack introart">${s.art()}</div>
   <div class="stack qhead"><div class="row"><h1 class="oneline">${s.t}</h1>${s.premium?'<span class="pill warn">Premium</span>':''}</div><p class="muted oneline2">${s.d}</p></div>
   <div style="flex:1"></div>
   <button class="btn block" data-act="introNext8">${s.btn}</button>
   <button class="linkbtn" style="align-self:center" data-act="toAuth8">Уже есть аккаунт? Войти</button></div>`;
}
const QUIZ8=['Какая у вас цель?','Какой у вас тип питания?','Чего не должно быть в меню?','Что уже есть дома?','Ещё немного деталей','Неделя и бюджет'];
const QHINT8=['Можно выбрать несколько','Строгое правило для всего меню','Аллергии и продукты, которые не любите','Подберём блюда, где докупать меньше всего','Сколько дней и на сколько человек','Меню сразу уложим в бюджет'];
const DIET8={all:['Едим всё','без ограничений'],halal:['Без свинины','халяль и не только'],pesc:['Пескетарианство','без мяса, рыба есть'],veg:['Вегетарианство','без мяса и рыбы'],vegan:['Веганство','только растительное'],lent:['Постное','без мяса, молочного и яиц']};
function quiz8(){
  const i=Math.min(S.qStep||0,5),p=P8(),last=i===5,goals=S.ans.goals||[];
  let body='',btn='Дальше',ok=true;
  if(i===0){body=`<div class="stack" style="gap:8px">${Object.entries(GOAL8).map(([k,l])=>`<button class="optcard opt8" data-act="goal8" data-v="${k}" aria-pressed="${goals.includes(k)}"><b>${l}</b><span class="check8" aria-hidden="true"></span></button>`).join('')}</div>`; ok=goals.length>0}
  else if(i===1){body=`<div class="stack" style="gap:8px">${Object.entries(DIET8).map(([k,[l,d]])=>`<button class="optcard opt8" data-act="diet8" data-v="${k}" aria-pressed="${!!S.ans.diet&&p.diet===k}"><span class="grow"><b>${l}</b><br><span class="small muted oneline">${d}</span></span></button>`).join('')}</div>`; ok=!!S.ans.diet}
  else if(i===2){body=restr8(); if(!p.allergies.length&&!p.dislikes.length) btn='Ограничений нет — дальше'}
  else if(i===3){body=pantry8(false); if(!S.pantry.length&&!(UI.photos||[]).length) btn='Ничего нет — дальше'}
  else if(i===4){body=details8()}
  else {body=budget8(); btn='Составить меню'; ok=anyMeal8()}
  return `<div class="screen onbscreen">
   <div class="row between"><button class="iconbtn" data-act="qBack8" aria-label="Назад">←</button><div class="progress grow" style="margin:0 12px"><i style="width:${Math.round((i+1)/6*100)}%"></i></div><span style="width:36px"></span></div>
   <div class="stack qhead"><p class="eyebrow">Вопрос ${i+1} из 6</p><h1 class="oneline">${QUIZ8[i]}</h1><p class="muted oneline">${QHINT8[i]}</p></div>
   ${body}
   <div style="flex:1"></div>
   <button class="btn block" data-act="${last?'build8':'qNext8'}" ${ok?'':'disabled'}>${btn}</button></div>`;
}
function loader8(){
  return `<div class="screen onbscreen"><div class="loader"><img class="logo8" src="src/frigo-logo.jpg" alt="Frigo"><div class="progress fill8" style="width:80%"><i></i></div><h2>Подбираем меню</h2><p class="muted small">Учитываем цель, ограничения и то, что есть дома</p></div></div>`;
}
function ready8(){return scrMenu8(true)+`<div class="savebar"><button class="btn block" data-act="toAuth8">Сохранить меню</button><p class="small muted">Войдите, чтобы сохранить меню, список покупок и продукты.</p></div>`}
function auth8(){
  return auth().replace(/<\/div>\s*$/,`${S.plan?'<button class="btn ghost block" data-act="backReady8">← Вернуться к меню</button>':'<button class="linkbtn" style="align-self:center" data-act="backIntro8">Я здесь впервые</button>'}</div>`);
}

/* ---------- app shell: burger (left), title, cooked-dishes counter (right), three tabs ---------- */
const TG8='<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M21.4 4.6 2.9 11.7c-1 .4-1 1.6 0 1.9l4.6 1.5 1.8 5.5c.2.7 1.1.9 1.6.4l2.6-2.5 4.6 3.4c.6.4 1.4.1 1.6-.6l3.1-14.6c.2-.9-.6-1.5-1.4-1.1zM9.8 14.6l-.4 3.6-1.3-4 9.6-6.2-7.9 6.6z"/></svg>';
const cookedTotal8=()=>V().ev.filter(e=>e.n==='dish_cooked').length;
const HAT8='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 14.5a4 4 0 0 1-.6-7.9A5 5 0 0 1 12 3a5 5 0 0 1 5.6 3.6 4 4 0 0 1-.6 7.9V20H7z"/><path d="M7 17h10"/></svg>';
function appbar8(){
  const sub=PAGES8[S.tab];
  return `<header class="appbar">${sub?`<button class="iconbtn" data-act="back8" aria-label="Назад">←</button>`:`<button class="iconbtn burger" data-act="drawer" aria-label="Открыть меню">${IC.burger}</button>`}
   <span class="grow"></span>
   <button class="cooked8" data-act="nav8d" data-v="diary" aria-label="Дневник: приготовлено блюд ${cookedTotal8()}">${HAT8}<b>${cookedTotal8()}</b></button></header>`;
}
function tabs8(){
  const left=S.plan?shopping().items.filter(i=>!i.covered&&!i.bought).length:0,cur=PAGES8[S.tab]?'':S.tab;
  return `<div class="tabs"><nav aria-label="Разделы" style="grid-template-columns:repeat(4,1fr)">${[['today','Сегодня'],['menu','Меню'],['shop','Покупки'],['home','Дома']].map(([k,l])=>`<button data-act="tab" data-v="${k}" ${cur===k?'aria-current="page"':''}>${IC[k]}<span>${l}</span>${k==='shop'&&left?`<span class="badge">${left}</span>`:''}</button>`).join('')}</nav></div>`;
}
function drawer8(){
  if(!UI.drawer) return '';
  const p=P8(),n=p.members.length,it=(v,icon,label,sub,lock)=>`<button class="ditem" data-act="nav8" data-v="${v}">${lock?IC.lock:icon}<span class="grow"><b>${label}</b>${sub?`<br><span class="small muted">${sub}</span>`:''}</span></button>`;
  return `<div class="dscrim" data-act="drawerClose"><nav class="drawer" aria-label="Главное меню">
   <div class="duser"><span class="avatar big">${esc(initials())}</span><div><b>${esc((p.members[0]&&p.members[0].name)||'Профиль')}</b><br><span class="small muted">${S.user&&S.user.phone?esc(S.user.phone):'Вход через Telegram'}</span></div></div>
   <p class="eyebrow dhead">Настройки</p>
   ${it('pFamily',IC.profile,'Семья',`${n} ${plural(n,'человек','человека','человек')} · вес, рост, калории`)}
   ${it('pFood',IC.scale,'Питание и ограничения','Цель, стоп-продукты')}
   ${it('pDays',IC.menu,'Дни и приёмы пищи',`${p.days} ${plural(p.days,'день','дня','дней')} · ${Object.entries(SLOT8).filter(([k])=>p.mealSetup[k].length).map(([,l])=>l.toLowerCase()).join(', ')}`)}
   ${it('pBudget',IC.tag,'Бюджет и цены',`${rub(p.budget)} в неделю · ${CITIES[p.city][0]}`)}
   ${it('pRecipes',IC.pot,'Мои рецепты',S.myRecipes.length?`${S.myRecipes.length} — попадают в меню`:'Свои блюда попадут в меню')}
   ${S.plan&&S.plan.status!=='draft'?`<button class="ditem" data-act="share">${IC.share}<span class="grow"><b>Отправить меню семье</b></span></button>`:''}
   <p class="eyebrow dhead">Премиум <span class="small muted" style="text-transform:none;letter-spacing:0;font-weight:400">· ${premiumNote8()}</span></p>
   ${it('autocart',IC.cart,'Автосборка корзины','Из меню, под ваш бюджет',!premium8())}
   ${it('promo',IC.tag,'Акции и сравнение цен',`${VV_PROMO.length} акций ВкусВилла, скидки Лавки, где дешевле`,!premium8())}
   ${it('sub',IC.card,'Подписка',subscribed()?'Подключена':'299 ₽ в месяц или 1 990 ₽ в год')}
   <div style="flex:1"></div>
   <div class="protobox"><div class="row" style="flex-wrap:wrap">
    <button class="btn ghost small" data-act="resetAll8">${UI.resetAsk8?'Точно сбросить? Нажмите ещё раз':'Сбросить все настройки'}</button>
    <button class="btn ghost small" data-act="reset">Пройти знакомство заново</button><button class="btn ghost small" data-act="nav8" data-v="metrics">Метрики</button></div></div>
   <button class="ditem" data-act="logout">${IC.logout}<span class="grow"><b>Выйти</b></span></button>
  </nav></div>`;
}
/* Leaderboard: your count is real; other players are a pilot demo until the server keeps a shared table. */
const RIVALS8=[['Аня',41],['Марина',33],['Олег',27],['Катя',22],['Дима',18],['Света',14],['Игорь',9],['Лена',6],['Паша',3]];
function board8(){
  const me=cookedTotal8(),rows=[...RIVALS8.map(([n,c])=>({n,c})),{n:'Вы',c:me,me:true}].sort((a,b)=>b.c-a.c||(a.me?-1:b.me?1:0)),pos=rows.findIndex(r=>r.me)+1;
  const ahead=pos>1?rows[pos-2]:null;
  return `<div class="scrim" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="Турнирная таблица"><div class="grab"></div>
   <div class="row between"><div><p class="eyebrow">Турнирная таблица</p><h1>Вы на ${pos}-м месте</h1></div><button class="iconbtn" data-act="close" aria-label="Закрыть">✕</button></div>
   <p class="muted">Приготовлено блюд из меню: <b>${me}</b>.${ahead?` До ${pos-1}-го места — ${ahead.c-me+1} ${plural(ahead.c-me+1,'блюдо','блюда','блюд')}.`:' Вы впереди всех!'}</p>
   <div class="day">${rows.map((r,i)=>`<div class="slot ${r.me?'me8':''}"><span class="meal">${i+1}</span><span class="grow">${r.me?'<b>Вы</b>':esc(r.n)}</span><b>${r.c}</b></div>`).join('')}</div>
   <p class="small muted">Пилот: соперники пока демонстрационные. Ваш счёт настоящий — растёт, когда вы отмечаете блюдо приготовленным.</p></div></div>`;
}
/* Menu as in v4: day cards with drag ⠿, calories for today and per day; no prices here (they live in «Покупки»). */
function range8(a,b){const sameM=a.getMonth()===b.getMonth();return a.getTime()===b.getTime()?`${a.getDate()} ${MON[a.getMonth()]}`:sameM?`${a.getDate()} – ${b.getDate()} ${MON[b.getMonth()]}`:`${a.getDate()} ${MONS[a.getMonth()]} – ${b.getDate()} ${MONS[b.getMonth()]}`}
function groups8(d){const g=[];keysOf8(d).forEach(k=>{const b=baseOf8(k),x=g.find(y=>y.b===b);x?x.keys.push(k):g.push({b,keys:[k]})});return g}
function scrToday8(){
  const ti=todayIdx();
  if(!S.plan||ti<0||!Object.keys(S.plan.days[ti].slots).length) return `<div class="screen"><h1 class="range8">Сегодня</h1><div class="empty"><p>${S.plan?'На сегодня в меню блюд нет.':'Меню ещё нет.'}</p><button class="btn" data-act="tab" data-v="menu">Открыть меню</button></div></div>`;
  const d=S.plan.days[ti],date=new Date(d.date),mk=nextSlotKey(ti),nextB=baseOf8(mk);
  const action=k=>{const s=d.slots[k],eaten=!!S.eaten[eatKey(ti,k)];
    return s.cooked?`<button class="eat" data-act="eat" data-v="${ti}:${k}" aria-pressed="${eaten}">${eaten?'Съели ✓':'Съели'}</button>`:`<button class="btn small" data-act="cook" data-v="${srcRef(ti,k)}">Готовить</button>`};
  const row=k=>{nameSlot8(k); const r=slotRecipe(ti,k),s=d.slots[k]; if(!r) return '';
    return `<div class="slot ${s.cooked?'cooked':''}" data-slot="${ti}:${k}"><div class="thumb">${dishArt(r)}</div>
     <button class="open" data-act="recipe" data-v="${srcRef(ti,k)}"><span class="small muted">${SLOT_NAMES[k]}</span><span class="dish">${esc(r.n)}</span><span class="meta"><span>${r.t} мин</span><span>${r.kcal} ккал</span><span>${s.serv} ${plural(s.serv,'порция','порции','порций')}</span></span></button>${action(k)}</div>`};
  return `<div class="screen"><h1 class="range8" style="text-transform:capitalize">${DOWL[date.getDay()]}, ${date.getDate()} ${MON[date.getMonth()]}</h1>
   ${kcalAll8(ti)}
   <div class="day today"><header><b>Меню на сегодня</b><span class="small muted">≈${num(dayKcal(ti))} ккал</span></header>
   ${groups8(d).map(g=>`<div class="meal8 ${g.b===nextB?'next8m':''}"><div class="mealhead8"><b>${SLOT8[g.b]||SLOT_NAMES[g.b]||''}</b>${g.keys.length>1?`<span class="small muted">${g.keys.length} ${plural(g.keys.length,'блюдо','блюда','блюд')}</span>`:''}${g.b===nextB?'<span class="pill">скоро</span>':''}</div>${g.keys.map(row).join('')}</div>`).join('')}</div></div>`;
}
/* Favourites: heart on the recipe sheet and on the recipe page; liked recipes are offered more often. */
const isFav8=id=>(S.fav8||[]).includes(id);
const favBtn8=id=>`<button class="iconbtn fav8 ${isFav8(id)?'on':''}" data-act="fav8" data-v="${id}" aria-pressed="${isFav8(id)}" aria-label="${isFav8(id)?'Убрать из любимых':'В любимые'}">${isFav8(id)?'♥':'♡'}</button>`;
sheetRecipe=(function(orig){return function(o){const s0=S.plan.days[o.day].slots[o.slot],id=s0&&s0.rid;let h=orig(o);
  return id?h.replace('<h1 class="dish" style="font-size:26px">',`<div class="row between" style="align-items:flex-start"><h1 class="dish grow" style="font-size:26px">`).replace(/(<h1 class="dish grow"[^>]*>[^<]*<\/h1>)/,`$1${favBtn8(id)}</div>`):h}})(sheetRecipe);
score=(function(orig){return function(r,ctx){return orig(r,ctx)+(isFav8(r.id)?2:0)}})(score);
function recipeById8(id){
  if(RBY[id]) return RBY[id]; const m=/^c_(.+)_(g\d+)$/.exec(id); if(m&&RBY[m[1]]&&RBY[m[2]]) return comboOf(RBY[m[1]],RBY[m[2]]); return null;
}
function rec8(){
  const r=recipeById8(UI.rec8); if(!r) return `<div class="screen"><p class="muted">Рецепт не найден.</p></div>`;
  return `<div class="screen"><div class="cover">${dishArt(r)}</div>
   <div class="row between" style="align-items:flex-start"><h1 class="dish grow" style="font-size:26px">${esc(r.n)}</h1>${favBtn8(r.id)}</div>
   <div class="meta" style="font-size:14px"><span>${r.t} мин</span><span>${r.kcal} ккал на порцию</span></div>
   <div class="macros"><div class="macro"><b>${r.P} г</b><span>белки</span></div><div class="macro"><b>${r.F} г</b><span>жиры</span></div><div class="macro"><b>${r.C} г</b><span>углеводы</span></div></div>
   <div class="card"><h3>Продукты на 4 порции</h3>${r.i.map(([k,q])=>`<div class="ingr"><span>${esc(ING[k][0])}</span><span class="qty">${fmtQty(k,q)}</span></div>`).join('')}${(r.sp||[]).length?`<p class="small muted">По вкусу: ${esc(r.sp.join(', '))}</p>`:''}</div>
   <div class="card"><h3>Как готовить</h3><ol class="steps8">${r.s.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div></div>`;
}
/* Calories for every family member, children included; the extra-food field adds to the chosen person. */
function kcalAll8(ti){
  const ms=S.profile.members; if(!UI.member||!ms.find(m=>m.id===UI.member)) UI.member=ms[0].id;
  const dk=S.plan.days[ti].date.slice(0,10),plan=dayKcal(ti);
  const rows=ms.map(m=>{const n=need(m).kcal,ex=((S.extra[dk]||{})[m.id])||[],eat=Math.round(eatenKcal(ti)*pfactor(m)+ex.reduce((a,b)=>a+(typeof b==='number'?b:b.kcal),0)),pl=Math.round(plan*pfactor(m));
    return `<button class="kmem8 ${m.id===UI.member?'on':''}" data-act="kmember" data-v="${m.id}"><span class="row between"><b>${esc(m.name)}${m.kind==='child'&&!/реб[её]н/i.test(m.name)?' <span class="small muted">ребёнок</span>':''}</b><span class="small"><b>${num(eat)}</b> <span class="muted">/ ${num(n)}</span></span></span>
      <span class="kbar"><i style="width:${Math.min(100,eat/n*100)}%"></i><b style="left:calc(${Math.min(100,pl/n*100)}% - 1px)"></b></span></button>`}).join('');
  const sel=ms.find(m=>m.id===UI.member),ex=((S.extra[dk]||{})[UI.member])||[];
  return `<div class="card kcal"><div class="row between"><h3>Калории сегодня</h3><span class="small muted">ккал</span></div>${rows}
   <form class="row" data-form="kadd"><input type="text" id="kadd" placeholder="Что ещё съел(а) ${esc(sel.name)}?" autocomplete="off" aria-label="Что ещё съели" style="flex:1;min-width:0"><button class="btn secondary small" type="submit">Добавить</button></form>
   <p class="small muted" id="kmsg"></p>
   ${ex.length?`<div class="chips">${ex.map((v,i)=>{const o=typeof v==='number'?{label:'Вручную',kcal:v}:v;return `<button class="chip" data-act="kdel" data-v="${i}" aria-label="Удалить ${esc(o.label)}">${esc(o.label)} · ${num(o.kcal)} ккал ✕</button>`}).join('')}</div>`:''}</div>`;
}
/* Calories card without the long hints; short placeholder. */
kcalCard=(function(orig){return function(ti){return orig(ti)
  .replace(/<p class="small muted">[^<]*Отмечайте «Съели» у блюд\.[^<]*<\/p>/,'')
  .replace(/(<p class="small muted" id="kmsg">)[^<]*(<\/p>)/,'$1$2')
  .replace('placeholder="Съели что-то ещё? Например: 1 банан, латте"','placeholder="Что ещё съели?"')}})(kcalCard);
function newExtras8(){
  return '';
  return `<div class="card newcard"><div class="row" style="align-items:flex-start"><span class="newic">${IC.plus||IC.pot}</span><div class="grow stack" style="gap:2px"><p class="eyebrow" style="color:var(--accent)">Открылось новое</p><b>Перекусы, десерты и напитки</b><p class="small muted">Теперь их можно добавить в меню — в «Дни и приёмы пищи».</p></div></div>
   <div class="row"><button class="btn small" data-act="extrasGo8">Добавить</button><button class="btn ghost small" data-act="extrasSeen8">Понятно</button></div></div>`;
}
function scrMenu8(preview){
  const vis=visibleDays();
  if(!vis.length) return `<div class="screen"><div class="empty"><h2>Меню ещё нет</h2><p>Составим по вашим ответам: цель, тип питания, ограничения и продукты дома.</p><button class="btn" data-act="regen">Составить меню</button></div></div>`;
  const ti=todayIdx(),d0=new Date(vis[0][0].date),dn=new Date(vis[vis.length-1][0].date);
  const eatBtn=(di,k)=>`<button class="eat" data-act="eat" data-v="${di}:${k}" aria-pressed="${!!S.eaten[eatKey(di,k)]}">${S.eaten[eatKey(di,k)]?'Съели ✓':'Съели'}</button>`;
  const row=(di,k)=>{nameSlot8(k); let h=slotRow(di,k,!!preview); if(!preview&&di===ti&&d0) {const s=S.plan.days[di].slots[k]; if(s&&s.cooked) h=h.replace('<button class="iconbtn" data-act="replace"',eatBtn(di,k)+'<button class="iconbtn" data-act="replace"')} return h};
  return `<div class="screen${preview?' preview8':''}">
   ${preview?'<div class="note"><b>✓</b><span>Ваше меню готово! Сохраните его — и список покупок соберётся сам.</span></div>':''}
   <div class="row between" style="align-items:center"><h1 class="range8">${range8(d0,dn)}</h1>${preview?'':S.plan.status==='draft'?'<span class="pill warn">черновик</span>':'<span class="pill">утверждено</span>'}</div>
   ${vis.map(([d,di])=>{const groups=[];keysOf8(d).forEach(k=>{const b=baseOf8(k),g=groups.find(x=>x.b===b);g?g.keys.push(k):groups.push({b,keys:[k]})});
     return `<div class="day ${di===ti?'today':''}"><header><b style="text-transform:capitalize">${dateLabel(d.date,true)}</b><span class="small muted">${di===ti?'<span class="pill">сегодня</span> ':''}≈${num(dayKcal(di))} ккал</span></header>${groups.map(g=>`<div class="meal8"><div class="mealhead8"><b>${SLOT8[g.b]||SLOT_NAMES[g.b]||''}</b>${g.keys.length>1?`<span class="small muted">${g.keys.length} ${plural(g.keys.length,'блюдо','блюда','блюд')}</span>`:''}</div>${g.keys.map(k=>row(di,k)).join('')}</div>`).join('')}</div>`}).join('')}
   ${preview?'':`<p class="small muted">${KC()?'Калории дня — на одну стандартную порцию каждого блюда. ':''}Потяните за ⠿, чтобы поменять блюда местами. Смахните блюдо вправо, чтобы убрать его.</p>
   <div class="stack">${S.plan.status==='draft'?'<button class="btn block" data-act="approve">Утвердить меню и собрать покупки</button>':`<button class="btn secondary block" data-act="share">${IC.share} Отправить меню семье</button>`}
    <button class="btn ghost block" data-act="regen">Пересобрать меню</button></div>`}
  </div>`;
}
/* Diary (under the chef-hat counter): year calendar of cooking and calories; tap a date to see the day. */
const localKey8=v=>{const d=new Date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function snapDiary8(){
  if(!S.plan) return; S.diary8=S.diary8||{}; S.cook8=S.cook8||{}; const ti=todayIdx();
  S.plan.days.forEach((d,di)=>{const key=localKey8(d.date),ek=d.date.slice(0,10);
    const cooked=Object.keys(d.slots).filter(k=>{const s=d.slots[k];return s&&!s.left&&s.cooked}).map(k=>slotRecipe(di,k)).filter(Boolean).map(r=>({id:r.id,n:r.n}));
    if(cooked.length) S.cook8[key]=cooked; else delete S.cook8[key];
    if(ti<0||di>ti) return; const row={};
    S.profile.members.forEach(m=>{const ex=((S.extra[ek]||{})[m.id])||[],exs=ex.reduce((a,b)=>a+(typeof b==='number'?b:b.kcal),0);row[m.id]=Math.round(eatenKcal(di)*pfactor(m)+exs)});
    if(Object.values(row).some(v=>v>0)) S.diary8[key]=row; else delete S.diary8[key]});
}
const cookName8=x=>typeof x==='string'?x:x.n;
function diary8(){
  snapDiary8(); const ms=S.profile.members; if(!UI.dmem8||!ms.find(m=>m.id===UI.dmem8)) UI.dmem8=ms[0].id;
  const me=ms.find(m=>m.id===UI.dmem8),norm=need(me).kcal,now=day0(NOW()),iso=localKey8,gran=UI.gran8||'day';
  const pct=k=>{const v=(S.diary8[k]||{})[me.id]||0;return v?Math.round(v/norm*100):0};
  const sel=UI.cal8||iso(now),sd=new Date(sel+'T12:00:00'),kc=S.diary8[sel],ck=(S.cook8||{})[sel]||[];
  // days: from the first record (or 3 weeks back) to a week ahead, scrolled to the selected day
  const known=[...Object.keys(S.diary8||{}),...Object.keys(S.cook8||{})].sort(),start=new Date(Math.min(addDays(now,-21).getTime(),known.length?new Date(known[0]+'T12:00:00').getTime():Infinity));
  const days=[];for(let d=day0(start);d<=addDays(now,7);d=addDays(d,1)) days.push(d);
  const months=Array.from({length:12},(_,m)=>new Date(now.getFullYear(),m,1));
  const mpct=m=>{const ks=Object.keys(S.diary8||{}).filter(k=>k.startsWith(`${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`)).map(pct).filter(Boolean);return ks.length?Math.round(ks.reduce((a,b)=>a+b,0)/ks.length):0};
  const col=(label,num_,p,act,v,on,dot,today)=>`<button class="wday8 ${on?'sel8':''} ${today?'today8':''}" ${act?`data-act="${act}" data-v="${v}"`:''}><span class="small">${label}</span><b>${num_}</b><span class="wbar8"><i style="height:${Math.min(100,p)}%" class="${p>110?'over':''}"></i></span><span class="small ${p?'':'muted'}">${p?p+'%':'—'}</span>${dot?'<span class="cookdot8"></span>':''}</button>`;
  const history=Object.entries(S.cook8||{}).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30);
  return `<div class="screen">${head8('Дневник',`Приготовлено: ${cookedTotal8()}`,`<button class="btn ghost small" data-act="board8">Турнир ›</button>`)}
   <div class="chips">${ms.map(x=>`<button class="chip" data-act="dmem8" data-v="${x.id}" aria-pressed="${x.id===me.id}">${esc(x.name)}</button>`).join('')}</div>
   <div class="card"><div class="row between"><h3>Норма калорийности по дням</h3><div class="chips gran8">${[['day','день'],['month','месяц']].map(([k,l])=>`<button class="chip" data-act="gran8" data-v="${k}" aria-pressed="${gran===k}">${l}</button>`).join('')}</div></div>
    <div class="hscroll8" id="hscroll8">${gran==='day'?days.map(d=>{const k=iso(d);return col(DOW[d.getDay()],d.getDate(),pct(k),'cal8',k,k===sel,(S.cook8||{})[k],k===iso(now))}).join('')
     :months.map(m=>col(['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][m.getMonth()],'',mpct(m),'',null,m.getMonth()===now.getMonth(),false,false)).join('')}</div>
    <p class="small muted">${esc(me.name)}: % от суточной нормы ${num(norm)} ккал${gran==='month'?' — в среднем за месяц':''}</p></div>
   <div class="card"><h3 style="text-transform:capitalize">${DOWL[sd.getDay()]}, ${sd.getDate()} ${MON[sd.getMonth()]}</h3>
    ${ck.length?`<div class="stack" style="gap:6px"><b class="small">Приготовили</b>${ck.map(x=>typeof x==='string'?`<span class="small">${esc(x)}</span>`:`<button class="linkbtn" style="text-align:left" data-act="openRec8" data-v="${x.id}">${esc(x.n)} ›</button>`).join('')}</div>`:'<p class="small muted">В этот день ничего не отмечено приготовленным.</p>'}
    ${kc?ms.map(x=>{const v=kc[x.id]||0,nn=need(x).kcal;return `<div class="stack" style="gap:4px"><div class="row between"><span>${esc(x.name)}</span><span class="small"><b>${num(v)}</b> <span class="muted">/ ${num(nn)} ккал · ${Math.round(v/nn*100)}%</span></span></div><div class="progress ${v>nn*1.1?'over':''}"><i style="width:${Math.min(100,Math.round(v/nn*100))}%"></i></div></div>`}).join(''):'<p class="small muted">Калорий за этот день нет — отмечайте «Съели» у блюд.</p>'}</div>
   <div class="card"><h3>Что готовили</h3>${history.length?history.map(([k,list])=>{const d=new Date(k+'T12:00:00');return `<div class="stack" style="gap:4px"><span class="small muted" style="text-transform:capitalize">${DOWL[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}</span>${list.map(x=>typeof x==='string'?`<span>${esc(x)}</span>`:`<button class="histrow8" data-act="openRec8" data-v="${x.id}"><span class="thumb">${RBY[x.id]?dishArt(RBY[x.id]):''}</span><span class="grow">${esc(x.n)}</span><span class="muted">›</span></button>`).join('')}</div>`}).join(''):'<p class="small muted">Отмечайте блюда приготовленными — здесь появится история, и любое блюдо можно будет открыть снова.</p>'}</div>
  </div>`;
}
function pBudget8(){return `<div class="screen">${head8('Настройки','Бюджет и цены')}${budget8()}<button class="btn block" data-act="regen">Сохранить и пересобрать меню</button></div>`}
function scrShop8(){
  if(!S.plan) return `<div class="screen"><div class="empty"><h2>Список пуст</h2><p>Он соберётся сам, когда вы утвердите меню.</p><button class="btn" data-act="tab" data-v="menu">Открыть меню</button></div></div>`;
  const sh=shopping(),need_=sh.items.filter(i=>!i.covered),home=sh.items.filter(i=>i.covered),left=need_.filter(i=>!i.bought);
  const cats=CAT_ORDER.filter(c=>need_.some(i=>i.cat===c));
  const row=i=>`<div class="item ${i.bought?'done':''}"><input type="checkbox" class="chk" id="b_${i.k}" data-act="bought" data-v="${i.k}" ${i.bought?'checked':''} aria-label="Куплено: ${esc(i.name)}">
    <label class="grow" for="b_${i.k}" style="min-width:0;cursor:pointer"><div class="row between" style="align-items:flex-start"><span class="nm">${esc(i.name)}</span><span class="qty">${fmtQty(i.k,i.toBuy,true)}</span></div>
    <div class="for8">${i.pq>0?`дома ${fmtQty(i.k,i.pq,true)} · `:''}для: ${esc(i.dishes.join(', '))}</div></label>
    <button class="iconbtn" data-act="have" data-v="${i.k}" aria-label="Уже есть дома: ${esc(i.name)}" style="font-size:12px">есть</button></div>`;
  return `<div class="screen">
   ${head8('','Список покупок',`<button class="iconbtn tgbtn" data-act="share8" aria-label="Поделиться списком в Telegram" title="Поделиться в Telegram">${TG8}</button>`)}
   ${S.plan.status==='draft'?`<div class="note"><b>!</b><span>Меню ещё не утверждено: список может измениться после замен. <button class="btn ghost small" style="margin-top:6px" data-act="approve">Утвердить меню</button></span></div>`:''}
   <button class="card pricecard" data-act="tab" data-v="autocart"><span class="row between"><span>Осталось купить: <b>${left.length}</b> ${plural(left.length,'позиция','позиции','позиций')}</span><span class="qty" style="font-size:18px">≈${rub(left.reduce((a,i)=>a+i.cost,0))}</span></span>
    <div class="progress"><i style="width:${need_.length?Math.round((need_.length-left.length)/need_.length*100):100}%"></i></div>
    <span class="small ${left.reduce((a,i)=>a+i.cost,0)>budgetLimit8()+1?'over8':'muted'}">Бюджет на ${S.profile.days} ${plural(S.profile.days,'день','дня','дней')} меню: ${rub(budgetLimit8())} (${rub(S.profile.budget)} в неделю)</span>
    <span class="row"><b style="color:var(--accent)">Собрать корзину автоматически ›</b><span class="pill warn">Premium</span></span>
    <span class="small muted">Одинаковые продукты из разных блюд объединены. Цены на ${PRICE_DATE} — примерные.</span></button>
   ${cats.map(c=>`<section class="cat"><h3>${c}</h3>${need_.filter(i=>i.cat===c).map(row).join('')}</section>`).join('')}
   ${sh.spices.length?`<section class="cat"><h3>Специи — проверьте, есть ли дома</h3><div class="card small">${esc(sh.spices.join(', '))}<p class="muted">Количество «по вкусу», в список не суммируем.</p></div></section>`:''}
   ${home.length?`<section class="cat"><h3>Уже есть дома</h3>${home.map(i=>`<div class="item done"><span class="grow nm">${esc(i.name)}</span><span class="small muted">${fromList(i.k)?'отмечено «есть»':'хватает запаса'}</span>${fromList(i.k)?`<button class="iconbtn" data-act="have" data-v="${i.k}">вернуть</button>`:''}</div>`).join('')}</section>`:''}
  </div>`;
}
function scrHome8(){return `<div class="screen">${head8('','Что есть дома')}${pantry8(true)}<p class="small muted">Продукты отсюда вычитаются из покупок и учитываются при подборе меню.</p></div>`}

function pFamily8(){const k=S.profile.kcalOn; S.profile.kcalOn=true; const h=famFields(); S.profile.kcalOn=k; return `<div class="screen">${head8('Настройки','Семья')}${h}</div>`}
function pFood8(){const p=S.profile;return `<div class="screen">${head8('Настройки','Питание и ограничения')}
  <div class="card"><h3>Цель</h3><p class="small muted">Можно выбрать несколько</p><div class="chips">${Object.entries(GOAL8).map(([k,l])=>`<button class="chip" data-act="goal8" data-v="${k}" aria-pressed="${k==='none'?!p.goals.length:p.goals.includes(k)}">${l}</button>`).join('')}</div></div>
  <div class="card"><h3>Тип питания</h3><div class="chips">${Object.entries(DIETS).map(([k,[l,d]])=>`<button class="chip" data-act="diet" data-v="${k}" aria-pressed="${p.diet===k}" title="${esc(d)}">${l}</button>`).join('')}</div></div>
  ${restr8()}
  ${S.history.blocked.length?`<div class="card"><h3>Скрытые блюда</h3>${S.history.blocked.filter(id=>RBY[id]).map(id=>`<div class="row between"><span>${esc(RBY[id].n)}</span><button class="iconbtn" data-act="unblock" data-v="${id}">вернуть</button></div>`).join('')}</div>`:''}
  <button class="btn block" data-act="regen">Сохранить и пересобрать меню</button></div>`}
function pDays8(){const p=S.profile;return `<div class="screen">${head8('Настройки','Дни и приёмы пищи')}${days8card()}${mealKinds8()}${timeCard8()}
  <div class="card"><label class="toggle"><span><b>Напоминание накануне</b><br><span class="small muted">Проверить продукты для завтрашнего блюда</span></span><input type="checkbox" class="switch" id="remOn" data-act="remOn" ${p.reminder.on?'checked':''}></label>
  ${p.reminder.on?`<label class="field" for="remT">Время<select id="remT" data-act="remT">${['18:00','19:00','20:00','21:00','22:00'].map(t=>`<option ${t===p.reminder.time?'selected':''}>${t}</option>`).join('')}</select></label>`:''}</div>
  <button class="btn block" data-act="regen" ${anyMeal8()?'':'disabled'}>Сохранить и пересобрать меню</button></div>`}
function pRecipes8(){
  const tab=UI.rtab8||'fav',favs=(S.fav8||[]).map(recipeById8).filter(Boolean);
  const card=(r,act,v)=>`<button class="card recrow" data-act="${act}" data-v="${v}"><div class="row"><div class="thumb">${dishArt(r)}</div><span class="grow"><span class="dish">${esc(r.n)}</span><br><span class="small muted">${r.t} мин · ${r.kcal} ккал</span></span><span class="muted">›</span></div></button>`;
  return `<div class="screen">${head8('Настройки','Мои рецепты')}
   <div class="seg" role="tablist">${[['fav',`Любимые${favs.length?' · '+favs.length:''}`],['own',`Свои${S.myRecipes.length?' · '+S.myRecipes.length:''}`]].map(([k,l])=>`<button role="tab" aria-selected="${tab===k}" data-act="rtab8" data-v="${k}">${l}</button>`).join('')}</div>
   ${tab==='fav'?(favs.length?`<p class="small muted">Любимые блюда чаще попадают в меню.</p>${favs.map(r=>card(r,'openRec8',r.id)).join('')}`:'<div class="empty"><p>Нажмите ♡ в карточке блюда — оно появится здесь и будет чаще попадать в меню.</p></div>')
   :`<p class="small muted">Свои рецепты попадают в подбор меню наравне с нашими — с учётом аллергий и ограничений.</p><button class="btn block" data-act="recNew">+ Добавить рецепт</button>
    ${S.myRecipes.length?S.myRecipes.map(r=>`<button class="card recrow" data-act="recEdit" data-v="${r.id}"><div class="row"><div class="thumb">${dishArt(r)}</div><span class="grow"><span class="dish">${esc(r.n)}</span><br><span class="small muted">${MYK8[kindOfMine(r)][0]} · ${r.t} мин · ${r.i.length} ${plural(r.i.length,'продукт','продукта','продуктов')}</span></span><span class="muted">›</span></div></button>`).join(''):'<div class="empty"><p>Пока пусто. Добавьте блюдо, которое любят в семье.</p></div>'}`}</div>`;
}
const kindOfMine=r=>r.m==='b'?'breakfast':r.m==='m'?(r.tags.includes('soup')?'soup':'dish'):r.m==='p'?'main':r.m==='g'?'side':r.m==='z'?'dessert':r.m==='k'?'drink':'snack';
function pRecipe8(){
  const e=UI.edit||(UI.edit={id:null,n:'',kind:'dish',t:30,serv:4,i:[],s:['']});
  const q=(UI.rq||'').trim().toLowerCase(),found=q?Object.keys(ING).filter(k=>ING[k][0].toLowerCase().includes(q)&&!e.i.some(([x])=>x===k)).slice(0,10):[];
  const valid=e.n.trim()&&e.i.length&&e.s.some(x=>x.trim());
  return `<div class="screen">${head8('Мои рецепты',e.id?'Изменить рецепт':'Новый рецепт')}
   <label class="field" for="rn8">Название<input type="text" id="rn8" data-act="rf8" data-v="n" value="${esc(e.n)}" maxlength="80" placeholder="Например: бабушкин борщ"></label>
   <label class="field" for="rk8">Что это<select id="rk8" data-act="rk8">${Object.entries(MYK8).map(([k,[l]])=>`<option value="${k}" ${e.kind===k?'selected':''}>${l}</option>`).join('')}</select></label>
   <div class="row"><label class="field grow" for="rt8">Время, мин<input type="number" id="rt8" data-act="rf8" data-v="t" value="${e.t}" min="1" max="600"></label><label class="field grow" for="rs8">Порций<input type="number" id="rs8" data-act="rf8" data-v="serv" value="${e.serv}" min="1" max="20"></label></div>
   <div class="card"><h3>Продукты</h3><p class="small muted">Количество — на все порции рецепта.</p>
    ${e.i.map(([k,qv],i)=>`<div class="row"><span class="grow">${esc(ING[k][0])}</span><input type="number" inputmode="decimal" style="width:90px" data-act="ri8" data-v="${i}" value="${qv}" min="0" step="any" aria-label="Количество: ${esc(ING[k][0])}"><span class="small muted" style="width:30px">${unitLabel(k)}</span><button class="iconbtn" data-act="riDel8" data-v="${i}" aria-label="Убрать ${esc(ING[k][0])}">✕</button></div>`).join('')}
    <input type="search" id="rq8" data-act="rq8" value="${esc(UI.rq||'')}" placeholder="Добавить продукт: картофель, курица…" autocomplete="off" aria-label="Добавить продукт">
    ${found.length?`<div class="chips">${found.map(k=>`<button class="chip" data-act="riAdd8" data-v="${k}">+ ${esc(ING[k][0])}</button>`).join('')}</div>`:''}</div>
   <div class="card"><h3>Шаги</h3>${e.s.map((x,i)=>`<div class="row" style="align-items:flex-start"><span class="stepn">${i+1}</span><textarea class="grow" rows="2" data-act="rstep8" data-v="${i}" aria-label="Шаг ${i+1}">${esc(x)}</textarea>${e.s.length>1?`<button class="iconbtn" data-act="rsDel8" data-v="${i}" aria-label="Удалить шаг ${i+1}">✕</button>`:''}</div>`).join('')}
    <button class="btn ghost small" data-act="rsAdd8">+ Шаг</button></div>
   <button class="btn block" data-act="recSave" ${valid?'':'disabled'}>Сохранить рецепт</button>
   ${valid?'':'<p class="small muted">Нужны название, хотя бы один продукт и один шаг.</p>'}
   ${e.id?'<button class="btn ghost block" data-act="recDel" style="color:var(--danger)">Удалить рецепт</button>':''}</div>`;
}
function offer8(title,text){
  const sel=UI.tariff||'year';
  return `<div class="screen">${head8('Premium',title)}<p class="muted">${text}</p>
   <div class="card"><h3>Что входит в Premium</h3><ul class="plain8">${['Автосборка корзины из утверждённого меню под ваш бюджет','Сравнение цен: где купить дешевле','Подборка акций ВкусВилла и Лавки','Перекусы, десерты и напитки в меню'].map(x=>`<li>${x}</li>`).join('')}</ul></div>
   <div class="stack" style="gap:8px">${[['year','На год','1 990 ₽','≈166 ₽ в месяц — на 45% выгоднее'],['month','На месяц','299 ₽','отмена в любой момент']].map(([k,l,pp,d])=>`<button class="optcard tariff" data-act="tariff" data-v="${k}" aria-pressed="${sel===k}"><span class="row between"><b>${l}</b><b>${pp}</b></span><span class="small muted">${d}</span></button>`).join('')}</div>
   <button class="btn block" data-act="subscribe8">Подключить за ${sel==='year'?'1 990 ₽':'299 ₽'} — оплата по СБП</button>
   <p class="small muted">${premiumNote8()}. Прототип: деньги не списываются. Меню, список покупок и калории — бесплатно.</p></div>`;
}
function scrSub8(){
  if(!subscribed()) return offer8('Premium','Меню, список покупок и калории — бесплатно. Premium экономит время и деньги на покупках.');
  const v=V();
  return `<div class="screen">${head8('Premium','Подписка подключена')}<div class="card"><p>${v.sub.plan==='year'?'На год — 1 990 ₽':'На месяц — 299 ₽'}, с ${dateLabel(v.sub.since,true)}.</p>
   <p class="small muted">Напомним за 3 дня до продления. Отменить можно в любой момент — меню, рецепты и настройки сохранятся.</p><button class="btn ghost block" data-act="unsub8">Отменить подписку (прототип)</button></div></div>`;
}
function autocart8(){
  if(!premium8()) return offer8('Автосборка корзины','Соберём корзину из утверждённого меню на нужную сумму и подскажем, в каком магазине дешевле.');
  if(!S.plan) return `<div class="screen"><div class="empty"><p>Сначала составьте меню.</p><button class="btn" data-act="tab" data-v="menu">Открыть меню</button></div></div>`;
  if(S.plan.status==='draft') return `<div class="screen">${head8('Premium','Автосборка корзины')}<div class="card"><p class="muted">Корзина собирается из утверждённого меню.</p><button class="btn block" data-act="approve8">Утвердить меню</button></div></div>`;
  const vv=basketBy('vv'),lv=basketBy('lavka'),best=lv<vv?'lavka':'vv',st=S.store||'vv',sum=st==='lavka'?lv:vv,b=S.profile.budget,left=shopping().items.filter(i=>!i.covered&&!i.bought).length;
  return `<div class="screen">${head8('Premium','Автосборка корзины')}
   <div class="card"><label class="field" for="budget">Бюджет на эту корзину<b id="budgetv" style="color:var(--fg);font-size:20px;font-variant-numeric:tabular-nums">${rub(b)}</b></label>
    <input type="range" id="budget" min="1000" max="30000" step="500" value="${b}" data-act="budget" aria-label="Бюджет"></div>
   <div class="card"><h3>Где купить</h3><div class="compare"><button class="${st==='vv'?'win':''}" data-act="store" data-v="vv"><span class="small muted">ВкусВилл</span><b>${rub(vv)}</b>${best==='vv'?'<span class="pill">дешевле</span>':''}</button><button class="${st==='lavka'?'win':''}" data-act="store" data-v="lavka"><span class="small muted">Яндекс Лавка</span><b>${rub(lv)}</b>${best==='lavka'?'<span class="pill">дешевле</span>':''}</button></div></div>
   ${sum>b?`<div class="note"><b>!</b><span>Не укладываемся: ≈${rub(sum)} из ${rub(b)}. Замените самые дорогие блюда или увеличьте бюджет.</span></div>`:`<p class="small muted">Укладываемся: ≈${rub(sum)} из ${rub(b)}.</p>`}
   <button class="btn block" data-act="cartStart" ${left?'':'disabled'}>${IC.cart} Собрать корзину в ${STORES[st]} · ${left} ${plural(left,'продукт','продукта','продуктов')}</button></div>`;
}
const SCR8={rec8:rec8,today:scrToday8,menu:()=>scrMenu8(false),shop:scrShop8,home:scrHome8,pFamily:pFamily8,pFood:pFood8,pRecipes:pRecipes8,pRecipe:pRecipe8,pDays:pDays8,
  autocart:autocart8,promo:()=>premium8()?`${trialOn8()?`<div class="trialbar8">${premiumNote8()}</div>`:''}`+scrPromo():offer8('Акции и сравнение цен','Каждую неделю — скидки ВкусВилла и Лавки на продукты из вашего меню и сравнение корзины.'),
  kcal:()=>`<div class="screen">${head8('Настройки','Подсчёт калорий')}${kcalToggle()}</div>`,sub:scrSub8,metrics:scrMetrics,diary:diary8,pBudget:pBudget8};
kcalToggle=(function(orig){return function(){const was=V().ul.kcal; V().ul.kcal=V().ul.kcal||'v8'; const h=orig(); if(!was) delete V().ul.kcal; return h}})(kcalToggle);

/* ---------- render ---------- */
render=function(){
  const app=$('#app'); P8(); ensureRecipes(); if(!SCR8[S.tab]) S.tab='today';
  if(UI.fam){app.innerHTML=famView(); renderSheet(); return}
  const st=S.stage,signed=!!FamilyMenuApi.session;
  if(st==='intro'&&!signed) app.innerHTML=intro8();
  else if(st==='quiz') app.innerHTML=quiz8();
  else if(st==='gen') app.innerHTML=loader8();
  else if(st==='ready'&&!signed) app.innerHTML=ready8();
  else if(!signed) app.innerHTML=auth8();
  else {if(S.plan) snapDiary8(); app.innerHTML=appbar8()+SCR8[S.tab]()+tabs8()+drawer8()+(UI.board?board8():'')}
  renderSheet(); renderCook(); renderCart(); paintTimers(); clampChips();
  const hs=document.getElementById('hscroll8'); if(hs){const on=hs.querySelector('.sel8'); if(on&&!hs.dataset.done){hs.scrollLeft=on.offsetLeft-hs.clientWidth/2+on.clientWidth/2; hs.dataset.done=1}}
};
/* ---------- actions ---------- */
function v8Act(a,v,el){
  const p=S.profile;
  switch(a){
   case 'introNext8': if((S.introIdx||0)<SLIDES8.length-1) S.introIdx=(S.introIdx||0)+1; else {S.stage='quiz'; S.qStep=0; track('intro_done')} window.scrollTo(0,0); return true;
   case 'introBack8': S.introIdx=Math.max(0,(S.introIdx||0)-1); return true;
   case 'toAuth8': S.stage='auth'; window.scrollTo(0,0); return true;
   case 'backReady8': S.stage='ready'; return true;
   case 'backIntro8': S.stage='intro'; S.introIdx=0; return true;
   case 'qNext8': S.qStep=Math.min(5,(S.qStep||0)+1); window.scrollTo(0,0); return true;
   case 'qBack8': if((S.qStep||0)>0) S.qStep--; else S.stage=S.plan?(FamilyMenuApi.session?'app':'ready'):'intro'; window.scrollTo(0,0); return true;
   case 'build8': track('onboarding_done',{members:p.members.length,days:p.days}); build(); return 'done';
   case 'goal8': {let g=S.ans.goals||(p.goals.length?[...p.goals]:[]); if(v==='none') g=g.includes('none')?[]:['none']; else {g=g.filter(x=>x!=='none'); g=g.includes(v)?g.filter(x=>x!==v):[...g,v]; if(v==='lose') g=g.filter(x=>x!=='mass'); if(v==='mass') g=g.filter(x=>x!=='lose')}
     S.ans.goals=g; p.goals=g.filter(x=>x!=='none'); p.members.forEach(m=>{if(m.kind==='adult') m.goal=p.goals.includes('lose')?'lose':p.goals.includes('mass')?'gain':'keep'}); return true}
   case 'diet8': S.ans.diet=true; p.diet=v; return true;
   case 'more8': UI.open8=UI.open8||{}; UI.open8[v]=!UI.open8[v]; return true;
   case 'days8': p.days=Math.max(1,Math.min(7,p.days+ +v)); return true;
   case 'kind8': {const [k,o]=v.split(':'),l=p.mealSetup[k]; p.mealSetup[k]=l.includes(o)?l.filter(x=>x!==o):[...l,o]; P8(); return true}
   case 'cat8': UI.cat8=UI.cat8===v?null:v; return true;
   case 'pt8': togglePantry8(v); return true;
   case 'pt8s': togglePantry8(v); UI.q8=''; return true;
   case 'dislike8': {const ids=Object.fromEntries(dislikeGroups8())[v]||[],all=ids.every(k=>p.dislikes.includes(k)); p.dislikes=all?p.dislikes.filter(k=>!ids.includes(k)):[...new Set([...p.dislikes,...ids])]; return true}
   case 'persons8': {const n=p.members.length+ +v; if(n<1||n>12) return true; if(+v>0) p.members.push(newMember('adult','Взрослый '+n)); else p.members.pop(); return true}
   case 'nav8': UI.drawer=false; UI.fromDrawer8=true; S.tab=v; UI.sheet=null; window.scrollTo(0,0); return true;
   case 'nav8d': UI.drawer=false; UI.fromDrawer8=false; S.tab=v; {const t=day0(NOW());UI.cal8=`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`} window.scrollTo(0,0); return true;
   case 'cal8': UI.cal8=v; return true;
   case 'dmem8': UI.dmem8=v; return true;
   case 'gran8': UI.gran8=v; return true;
   case 'fav8': {S.fav8=S.fav8||[]; if(isFav8(v)) S.fav8=S.fav8.filter(x=>x!==v); else {S.fav8.push(v); toast('Добавили в «Любимые» — будем чаще предлагать')} track('favourite',{on:isFav8(v)}); return true}
   case 'rtab8': UI.rtab8=v; return true;
   case 'openRec8': UI.recFrom8=S.tab; UI.rec8=v; UI.sheet=null; S.tab='rec8'; window.scrollTo(0,0); return true;
   case 'swipeDel8': {const [d,k]=v.split(':'),day=S.plan.days[+d]; if(day&&day.slots[k]){const r=slotRecipe(+d,k); UI.undo8={d:+d,k,slot:day.slots[k]}; delete day.slots[k]; toast(`Убрали «${r?r.n:'блюдо'}» из меню`)} return true}
   case 'resetAll8': if(!UI.resetAsk8){UI.resetAsk8=true; setTimeout(()=>{UI.resetAsk8=false},4000); return true}
     UI.resetAsk8=false; {const b=blank(); S.profile={...b.profile,members:S.profile.members.map(m=>({...m,custom:''}))}; S.profile.mealSetup={b:['breakfast'],l:['soup'],s:[],d:['pair']}; S.profile.days=3; S.profile.kcalOn=true; S.store='vv'; S.theme='system'; S.history.blocked=[]; S.ans={}}
     toast('Настройки сброшены. Меню пересоберётся с настройками по умолчанию'); return true;
   case 'extrasSeen8': V().seen.extras8=1; return true;
   case 'extrasGo8': V().seen.extras8=1; S.tab='pDays'; UI.fromDrawer8=false; window.scrollTo(0,0); return true;
   case 'board8': UI.board=true; track('leaderboard_opened'); return true;
   case 'share8': {const t=shopping().items.filter(i=>!i.covered&&!i.bought).map(i=>`• ${i.name} — ${fmtQty(i.k,i.toBuy,true)}`).join('\n'); window.open('https://t.me/share/url?url='+encodeURIComponent(location.origin+location.pathname)+'&text='+encodeURIComponent('Список покупок:\n'+t),'_blank','noopener'); track('list_shared_telegram'); return 'done'}
   case 'close': if(UI.board){UI.board=false; return true} return false;
   case 'photoAdd': {const inp=document.createElement('input'); inp.type='file'; inp.accept='image/jpeg,image/png,image/webp'; inp.multiple=true; inp.style.display='none'; inp.onchange=()=>{photoFiles8(inp.files); inp.remove()}; document.body.append(inp); inp.click(); return 'done'}
   case 'photoDel': UI.photos.splice(+v,1); return true;
   case 'scan8': scan8(); return 'done';
   case 'scanSel': UI.scan.on[+v]=!UI.scan.on[+v]; return true;
   case 'scanAlt': {const [i,id]=v.split(':'); UI.scan.pick[+i]=UI.scan.pick[+i]===id?null:id; return true}
   case 'scanCancel': UI.scan=null; return true;
   case 'scanSave': {const sc=UI.scan; let n=0; sc.products.forEach((pr,i)=>{const id=pr.ingredientId?(sc.on[i]?pr.ingredientId:null):sc.pick[i]; if(id&&ING[id]&&!hasP8(id)){S.pantry.push({key:id,qty:defQty8(id)}); n++}});
     UI.scan=null; UI.photos=[]; toast(n?`Добавили в «Дома»: ${n}`:'Новых продуктов не нашли'); return true}
   case 'mday8': UI.mday=+v; return true;
   case 'back8': if(S.tab==='pRecipe'){S.tab='pRecipes'; return true} if(S.tab==='rec8'){S.tab=UI.recFrom8||'diary'; return true} S.tab=UI.prevTab8||'today'; UI.sheet=null; if(UI.fromDrawer8){UI.drawer=true; UI.fromDrawer8=false} window.scrollTo(0,0); return true;
   case 'approve8': S.plan.status='approved'; track('menu_approved'); return true;
   case 'subscribe8': {const pl=UI.tariff||'year'; V().sub={plan:pl,since:NOW().toISOString()}; delete V().seen.extras8; track('subscribed',{plan:pl}); toast('Premium подключён. Открылись перекусы, десерты и напитки'); if(S.tab==='sub') S.tab='menu'; return true}
   case 'unsub8': V().sub=null; track('unsubscribed'); toast('Подписка отменена'); return true;
   case 'theme8': S.theme=el.value; document.documentElement.dataset.theme=S.theme==='system'?'':S.theme; return true;
   case 'recNew': UI.edit=null; UI.rq=''; S.tab='pRecipe'; window.scrollTo(0,0); return true;
   case 'recEdit': {const r=S.myRecipes.find(x=>x.id===v); if(!r) return true; UI.edit={id:r.id,n:r.n,kind:kindOfMine(r),t:r.t,serv:4,i:r.i.map(x=>[...x]),s:[...r.s]}; UI.rq=''; S.tab='pRecipe'; window.scrollTo(0,0); return true}
   case 'rk8': UI.edit.kind=el.value; return true;
   case 'riAdd8': UI.edit.i.push([v,defQty8(v)===500?300:defQty8(v)===1000?250:1]); UI.rq=''; return true;
   case 'riDel8': UI.edit.i.splice(+v,1); return true;
   case 'rsAdd8': UI.edit.s.push(''); return true;
   case 'rsDel8': UI.edit.s.splice(+v,1); return true;
   case 'recSave': {const e=UI.edit,k=e.serv>0?4/e.serv:1,[,m]=MYK8[e.kind];
     const r={id:e.id||'u'+Date.now().toString(36),n:e.n.trim(),m,t:Math.max(1,Math.round(+e.t||30)),tags:e.kind==='soup'?['soup','mine']:['mine'],i:e.i.map(([id,q])=>[id,Math.round(q*k*1000)/1000]),sp:[],s:e.s.map(x=>x.trim()).filter(Boolean)};
     S.myRecipes=S.myRecipes.filter(x=>x.id!==r.id).concat([r]); if(RBY[r.id]){delete RBY[r.id]; const i=R.findIndex(x=>x.id===r.id); if(i>=0) R.splice(i,1)}
     registerMine(r); track(e.id?'recipe_edited':'recipe_added',{kind:e.kind}); toast('Рецепт сохранён — он попадёт в меню'); UI.edit=null; S.tab='pRecipes'; return true}
   case 'recDel': {const id=UI.edit.id; S.myRecipes=S.myRecipes.filter(x=>x.id!==id); UI.edit=null; S.tab='pRecipes'; toast('Рецепт удалён'); return true}
   case 'reset': S.stage='quiz'; S.qStep=0; S.ans={}; UI.sheet=null; window.scrollTo(0,0); return true;
  }
  return false;
}
act=(function(orig){return function(a,v,el){
  if(!PAGES8[S.tab]) UI.prevTab8=S.tab;
  const r=v8Act(a,v,el);
  if(r){if(r===true){save(); render()} else save(); return}
  if(a==='tab'&&!PAGES8[v]&&!['today','menu','shop','home'].includes(v)) v='today';
  return orig(a,v,el);
}})(act);

/* ---------- inputs that should not re-render on every key ---------- */
document.addEventListener('input',e=>{const t=e.target,a=t.dataset&&t.dataset.act; if(!a) return;
  if(a==='search8'){UI.q8=t.value; render(); refocus('pq8')}
  else if(a==='rsearch8'){UI.rs8=UI.rs8||{}; UI.rs8[t.dataset.v]=t.value; render(); refocus('rs8_'+t.dataset.v)}
  else if(a==='rq8'){UI.rq=t.value; render(); refocus('rq8')}
  else if(a==='rf8'&&UI.edit){const f=t.dataset.v; UI.edit[f]=f==='n'?t.value:+t.value; const b=document.querySelector('[data-act="recSave"]'); if(b) b.disabled=!(UI.edit.n.trim()&&UI.edit.i.length&&UI.edit.s.some(x=>x.trim()))}
  else if(a==='ri8'&&UI.edit){const q=+String(t.value).replace(',','.'); if(q>0) UI.edit.i[+t.dataset.v][1]=q}
  else if(a==='rstep8'&&UI.edit){UI.edit.s[+t.dataset.v]=t.value; const b=document.querySelector('[data-act="recSave"]'); if(b) b.disabled=!(UI.edit.n.trim()&&UI.edit.i.length&&UI.edit.s.some(x=>x.trim()))}
},true);
document.addEventListener('change',e=>{const t=e.target,a=t.dataset&&t.dataset.act; if(!a) return;
  if(a==='rk8'||a==='theme8'){act(a,t.value,t)}
  else if(a==='scanSel'){act(a,t.dataset.v,t)}
});
window.addEventListener('resize',()=>clampChips());
try{const th=S.theme; if(th&&th!=='system') document.documentElement.dataset.theme=th}catch(e){}

/* Swipe a dish row to the right to remove it from the menu. */
(()=>{let sw=null;
  document.addEventListener('pointerdown',e=>{const row=e.target.closest('.day .slot[data-slot]'); if(!row||e.target.closest('[data-drag],button.iconbtn,.eat,.btn')||S.stage!=='app'||!['menu','today'].includes(S.tab)) return; sw={row,x:e.clientX,y:e.clientY,dx:0,on:false}},true);
  document.addEventListener('pointermove',e=>{if(!sw) return; const dx=e.clientX-sw.x,dy=e.clientY-sw.y; if(!sw.on){if(Math.abs(dy)>12){sw=null;return} if(dx>12) {sw.on=true; sw.row.classList.add('swiping8')} else return}
    sw.dx=Math.max(0,dx); sw.row.style.transform=`translateX(${sw.dx}px)`; sw.row.style.opacity=String(Math.max(.3,1-sw.dx/260))},true);
  const end=()=>{if(!sw) return; const {row,dx,on}=sw; sw=null; if(!on) return; row.classList.remove('swiping8');
    if(dx>110){act('swipeDel8',row.dataset.slot)} else {row.style.transform='';row.style.opacity=''}
    const stop=ev=>{if(row.contains(ev.target)){ev.stopPropagation();ev.preventDefault()}}; document.addEventListener('click',stop,true); setTimeout(()=>document.removeEventListener('click',stop,true),350)};
  document.addEventListener('pointerup',end,true); document.addEventListener('pointercancel',()=>{if(sw){sw.row.style.transform='';sw.row.style.opacity='';sw=null}},true);
})();
