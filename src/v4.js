/* ============ v4: step-by-step feature unlocks, trial & subscription, cart assembly, pilot analytics ============ */
const PRICE_DATE='20–21 октября';
const TRIAL_DAYS=7;
Object.assign(IC,{
 lock:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
 share:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
 cart:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.2 11h11l2-8H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>',
 chart:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
 card:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>',
 plus:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>',
});

/* ---------- state & time ---------- */
function V(){if(!S.v4) S.v4={trialStart:null,sub:null,shift:0,ul:{},seen:{},ev:[],weeks:0}; return S.v4}
const dayN=()=>{const t=V().trialStart; if(!t) return 0; return Math.round((day0(NOW())-day0(new Date(t)))/864e5)};
const weekNo=()=>Math.floor(dayN()/7)+1;
const subscribed=()=>!!V().sub;
const trialLeft=()=>Math.max(0,TRIAL_DAYS-dayN());
const trialOver=()=>!!V().trialStart&&!subscribed()&&dayN()>=TRIAL_DAYS;
const daysW=n=>`${n} ${plural(n,'день','дня','дней')}`;

/* ---------- analytics (pilot events) ---------- */
function track(n,p){const v=V(); v.ev.push({t:NOW().toISOString(),n,p:p||null}); if(v.ev.length>600) v.ev.splice(0,v.ev.length-600)}
const countCooked=()=>S.plan?S.plan.days.reduce((s,d)=>s+Object.values(d.slots).filter(x=>x&&!x.left&&x.cooked).length,0):0;
const countBought=()=>Object.values(S.bought||{}).filter(Boolean).length;

/* ---------- progressive disclosure ---------- */
const FEAT={
 home:{t:'Продукты дома',d:'Отмечайте, что уже есть на кухне: список покупок станет короче, а следующее меню использует эти продукты.',when:'после утверждения первого меню',icon:'home',go:'home'},
 promo:{t:'Акции и цены',d:'Скидки ВкусВилла и Лавки на продукты из вашего меню и сравнение корзины: где дешевле на этой неделе.',when:'на 3-й день или когда купите половину списка',icon:'tag',go:'promo'},
 extras:{t:'Перекусы, десерты и напитки',d:'Теперь их можно добавить в меню — в «Семье и настройках», раздел «Что планируем».',when:'со второй недели',icon:'plus',go:'profile'},
 kcal:{t:'Подсчёт калорий',d:'Нормы для взрослых, КБЖУ блюд и дневник «что съели». По умолчанию выключен — включите в настройках, если нужно.',when:'со второй недели',icon:'chart',go:'profile'},
};
const UL=k=>!!(S&&S.v4&&S.v4.ul[k]);
function unlock(k,manual){const v=V(); if(v.ul[k]) return false; v.ul[k]=NOW().toISOString(); if(manual) v.seen[k]=1; track('feature_unlocked',{f:k,manual:!!manual}); return true}
function checkUnlocks(){
  if(!S.plan||!V().trialStart) return false;
  let ch=false; const n=dayN();
  if(S.plan.status!=='draft') ch=unlock('home')||ch;
  if(n>=2) ch=unlock('promo')||ch;
  else {const need=shopping().items.filter(i=>!i.covered); if(need.length&&need.filter(i=>i.bought).length/need.length>=.5) ch=unlock('promo')||ch}
  if(n>=7){ch=unlock('extras')||ch; ch=unlock('kcal')||ch}
  return ch;
}
const mealNames=()=>UL('extras')?SLOT_NAMES:{b:'Завтрак',l:'Обед',d:'Ужин'};

/* ---------- wrappers: build gate, generate, act tracking ---------- */
build=(function(orig){return function(){
  if(S.plan&&trialOver()){UI.sheet=null; S.stage='app'; S.tab='sub'; track('paywall_shown',{from:'new_week'}); save(); render(); window.scrollTo(0,0); return}
  return orig();
}})(build);
generate=(function(orig){return function(){
  const first=!V().trialStart; orig(); const v=V();
  if(first){v.trialStart=NOW().toISOString(); track('onboarding_done',{members:S.profile.members.length,allergies:S.profile.allergies.length,diet:S.profile.diet}); track('trial_started')}
  track('menu_built',{week:weekNo()});
}})(generate);
act=(function(orig){return function(a,v,el){
  const c0=countCooked(),b0=countBought(),t0=S.tab;
  const r=orig(a,v,el);
  try{
    const E={approve:'menu_approved',recipe:'recipe_opened',cook:'cook_started',doReplace:'dish_replaced',copy:'list_copied'};
    if(E[a]) track(E[a]);
    if(S.tab!==t0){track('screen',{s:S.tab}); if(S.tab==='shop') track('list_opened'); if(S.tab==='sub'&&!subscribed()) track('paywall_shown',{from:a})}
    if(countCooked()>c0) track('dish_cooked');
    if(countBought()>b0) track('item_bought');
    if(checkUnlocks()) render();
    save();
  }catch(e){console.error(e)}
  return r;
}})(act);

/* ---------- tabs & drawer ---------- */
function tabsV4(){
  const left=S.plan?shopping().items.filter(i=>!i.covered&&!i.bought).length:0;
  const t=[['today','Сегодня'],['menu','Меню'],['shop','Покупки']]; if(UL('home')) t.push(['home','Дома']);
  return `<div class="tabs"><nav aria-label="Разделы" style="grid-template-columns:repeat(${t.length},1fr)">${t.map(([k,l])=>`<button data-act="tab" data-v="${k}" ${S.tab===k?'aria-current="page"':''}>${IC[k]}<span>${l}</span>${k==='shop'&&left?`<span class="badge">${left}</span>`:''}</button>`).join('')}</nav></div>`;
}
function drawer(){
  if(!UI.drawer) return '';
  const v=V();
  const it=(act,val,icon,label,sub,extra='')=>`<button class="ditem" data-act="${act}" data-v="${val||''}">${icon}<span class="grow"><b>${label}</b>${sub?`<br><span class="small muted">${sub}</span>`:''}</span>${extra}</button>`;
  const lockIt=k=>{const f=FEAT[k]; return `<div class="ditem locked">${IC.lock}<span class="grow"><b>${f.t}</b><br><span class="small muted">Откроется ${f.when}</span></span><button class="btn ghost small" data-act="ulNow" data-v="${k}">Открыть</button></div>`};
  const nb=k=>v.ul[k]&&!v.seen[k]?'<span class="pill">новое</span>':'';
  const subLine=subscribed()?'Активна':v.trialStart?(trialOver()?'Пробная неделя закончилась':`Пробная неделя: осталось ${daysW(trialLeft())}`):'Первая неделя бесплатно';
  const n=S.profile.members.length;
  return `<div class="dscrim" data-act="drawerClose"><nav class="drawer" aria-label="Главное меню">
   <div class="duser"><span class="avatar big">${esc(initials())}</span><div><b>${esc((S.profile.members[0]&&S.profile.members[0].name)||'Профиль')}</b><br><span class="small muted">${S.user?esc(S.user.phone):'гость (демо)'}</span></div></div>
   ${it('nav','profile',IC.profile,'Семья и настройки',`${n} ${plural(n,'человек','человека','человек')} · вкусы и ограничения`)}
   ${UL('home')?it('nav','home',IC.home,'Продукты дома','',nb('home')):lockIt('home')}
   ${UL('promo')?it('nav','promo',IC.tag,'Акции и цены',`${VV_PROMO.length} акций ВкусВилла, скидки Лавки, сравнение корзины`,nb('promo')):lockIt('promo')}
   ${UL('kcal')||KC()?it('featGo','kcal',IC.chart,'Калории',KC()?'Включены':'Выключены — включить в настройках',nb('kcal')):lockIt('kcal')}
   ${UL('extras')?'':lockIt('extras')}
   ${it('navRem','',IC.bell,'Напоминания',S.profile.reminder.on?`накануне в ${S.profile.reminder.time}`:'выключены')}
   ${it('nav','sub',IC.card,'Подписка',subLine)}
   <div style="flex:1"></div>
   <div class="protobox"><p class="small muted"><b>Прототип v4</b>${v.trialStart?` · день ${dayN()+1} с первого меню`:''}. Перемотайте время, чтобы увидеть, как открываются функции и заканчивается пробная неделя.</p>
    <div class="row" style="flex-wrap:wrap"><button class="btn ghost small" data-act="shift" data-v="1">+1 день</button><button class="btn ghost small" data-act="shift" data-v="7">+неделя</button><button class="btn ghost small" data-act="nav" data-v="metrics">Метрики</button></div></div>
   ${it('logout','',IC.logout,'Выйти','')}
  </nav></div>`;
}
// clicks inside the drawer panel must not close it
document.addEventListener('click',e=>{const t=e.target.closest('[data-act]'); if(t&&t.classList.contains('dscrim')&&e.target.closest('.drawer')) e.stopImmediatePropagation()},true);

/* ---------- Today: "new feature" and trial cards ---------- */
function v4Top(){
  const v=V(),out=[];
  Object.keys(FEAT).filter(k=>v.ul[k]&&!v.seen[k]).sort((a,b)=>v.ul[b].localeCompare(v.ul[a])).slice(0,2).forEach(k=>{const f=FEAT[k];
    out.push(`<div class="card newcard"><div class="row" style="align-items:flex-start"><span class="newic">${IC[f.icon]}</span><div class="grow stack" style="gap:2px"><p class="eyebrow" style="color:var(--accent)">Открылось новое</p><b>${f.t}</b><p class="small muted">${f.d}</p></div></div>
     <div class="row"><button class="btn small" data-act="featGo" data-v="${k}">Посмотреть</button><button class="btn ghost small" data-act="seen" data-v="${k}">Понятно</button></div></div>`)});
  if(v.trialStart&&!subscribed()&&trialLeft()>0&&trialLeft()<=2) out.push(`<div class="card"><div class="row between"><span><b>Пробная неделя: осталось ${daysW(trialLeft())}</b><br><span class="small muted">Дальше — 299 ₽ в месяц или 1 990 ₽ в год. Карту не просим заранее.</span></span><button class="btn ghost small" data-act="nav" data-v="sub">Тарифы</button></div></div>`);
  return out.join('');
}
function weekEndCard(){
  if(trialOver()) return `<div class="card"><h2>Неделя закончилась</h2><p class="muted">Пробная неделя тоже. Чтобы получить меню на следующую неделю, оформите подписку — настройки семьи и то, что понравилось, сохранятся.</p><button class="btn" data-act="nav" data-v="sub">Посмотреть тарифы</button><button class="btn ghost" data-act="tab" data-v="menu">Открыть прошлое меню</button></div>`;
  return `<div class="card"><h2>Неделя закончилась</h2><p class="muted">Составим новое меню с теми же настройками и учётом того, что понравилось.</p><button class="btn" data-act="regen">Составить новое меню</button></div>`;
}

/* ---------- profile: lite member card & calories toggle ---------- */
function memberLite(m,i){return `<div class="card member">
  <div class="row"><input type="text" id="mn_${m.id}" value="${esc(m.name)}" data-act="mname" data-v="${i}" aria-label="Имя" style="flex:1;min-width:0;font-weight:600">
   <div class="chips" style="flex:none">${[['adult','Взр.'],['child','Реб.']].map(([k,l])=>`<button class="chip" data-act="mset" data-v="${i}:kind:${k}" aria-pressed="${m.kind===k}">${l}</button>`).join('')}</div>
   ${S.profile.members.length>1?`<button class="iconbtn" data-act="mdel" data-v="${i}" aria-label="Удалить">✕</button>`:''}</div>
  ${m.kind==='child'?`<label class="field" for="ma_${m.id}">Возраст, лет — чтобы точнее посчитать порцию<input type="number" inputmode="numeric" id="ma_${m.id}" value="${esc(m.age)}" min="1" max="17" data-act="mnum" data-v="${i}:age"></label>`:''}
  <span class="small muted">Порция ×${dec(pfactor(m))}</span></div>`}
function kcalToggle(){
  if(!UL('kcal')&&!KC()) return `<div class="card lockcard"><div class="row">${IC.lock}<div class="grow"><b>Подсчёт калорий</b><br><span class="small muted">Откроется со второй недели</span></div><button class="btn ghost small" data-act="ulNow" data-v="kcal">Открыть</button></div></div>`;
  return `<div class="card"><label class="toggle"><span><b>Считать калории</b><br><span class="small muted">Нормы для взрослых, КБЖУ блюд, дневник «что съели». Для детей нормы не показываем.</span></span><input type="checkbox" class="switch" id="kcalOn" data-act="kcalOn" ${KC()?'checked':''}></label>
   <p class="small muted">Это ориентир, а не медицинская рекомендация. Если подсчёт калорий вызывает тревогу, оставьте его выключенным.</p></div>`;
}
document.addEventListener('change',e=>{const t=e.target; if(t.dataset&&t.dataset.act==='kcalOn'){S.profile.kcalOn=t.checked; track('kcal_toggle',{on:t.checked}); save(); render()}});

/* ---------- subscription / paywall ---------- */
function weekStats(){
  const dishes=S.plan?S.plan.days.reduce((s,d)=>s+Object.values(d.slots).filter(x=>x&&x.rid&&!x.left).length,0):0;
  const items=S.plan?shopping().items.filter(i=>!i.covered).length:0;
  return {dishes,cooked:countCooked(),items,replaced:S.history.replaced.length};
}
function scrSub(){
  const v=V(),st=weekStats(),sel=UI.tariff||'year';
  if(subscribed()) return `<div class="screen"><div><p class="eyebrow">Подписка</p><h1>Подписка активна</h1></div>
   <div class="card"><p>${v.sub.plan==='year'?'Годовая — 1 990 ₽ в год':'Месячная — 299 ₽ в месяц'}, оформлена ${dateLabel(v.sub.since,true)}.</p>
   <p class="small muted">Напомним за 3 дня до продления. Отменить можно в любой момент — меню, рецепты и настройки семьи сохранятся.</p>
   <button class="btn ghost block" data-act="unsub">Отменить подписку (прототип)</button></div></div>`;
  const over=trialOver();
  return `<div class="screen">
   <div><p class="eyebrow">${over?'Пробная неделя закончилась':v.trialStart?`Пробная неделя · осталось ${daysW(trialLeft())}`:'Первая неделя бесплатно'}</p><h1>${over?'Продолжим планировать вместе?':'Подписка «Семейное меню»'}</h1></div>
   ${v.trialStart?`<div class="card"><h3>${over?'Ваша первая неделя':'Эта неделя'}</h3><div class="statgrid"><div><b>${st.dishes}</b><span>блюд в меню</span></div><div><b>${st.cooked}</b><span>приготовлено</span></div><div><b>${st.items}</b><span>продуктов в списке</span></div></div>
    <p class="small muted">Обычно на то, чтобы придумать меню и составить список, уходит 30–60 минут в неделю.</p></div>`:''}
   <div class="stack" style="gap:8px">${[['year','На год','1 990 ₽','≈166 ₽ в месяц — на 45% выгоднее'],['month','На месяц','299 ₽','отмена в любой момент']].map(([k,l,p,d])=>`<button class="optcard tariff" data-act="tariff" data-v="${k}" aria-pressed="${sel===k}"><span class="row between"><b>${l}</b><b>${p}</b></span><span class="small muted">${d}</span></button>`).join('')}</div>
   <div class="card small"><b>Что входит:</b> новое меню каждую неделю, список покупок, замены блюд, готовка по шагам, акции и сравнение цен, меню для всей семьи.</div>
   <button class="btn block" data-act="subscribe">Оформить за ${sel==='year'?'1 990 ₽':'299 ₽'} — оплата по СБП</button>
   <p class="small muted">Прототип: деньги не списываются. В пилоте будет ссылка на оплату по СБП: без привязки карты, а о продлении напомним за 3 дня.</p>
   ${over?`<button class="btn ghost block" data-act="tab" data-v="menu">Не сейчас — открыть прошлое меню</button>`:''}
  </div>`;
}


/* ---------- pilot metrics ---------- */
const FUNNEL=[['onboarding_done','Прошли онбординг'],['menu_built','Получили меню'],['menu_approved','Утвердили меню'],['list_opened','Открыли список покупок'],['dish_cooked','Приготовили блюдо из меню'],['paywall_shown','Увидели тарифы'],['subscribed','Оформили подписку']];
function scrMetrics(){
  const ev=V().ev,cnt=n=>ev.filter(e=>e.n===n).length,wk2=ev.some(e=>e.n==='menu_built'&&e.p&&e.p.week>=2),st=weekStats();
  return `<div class="screen"><div><p class="eyebrow">Для пилота</p><h1>Метрики</h1></div>
   <p class="small muted">Что пилот считает по каждой семье. В прототипе события хранятся только на этом телефоне; в пилоте они будут уходить на сервер.</p>
   <div class="card"><h3>Путь этой семьи</h3>${FUNNEL.map(([k,l])=>{const c=cnt(k); return `<div class="ingr"><span>${c?'✓':'○'} ${l}</span><span class="qty">${c?c+' раз':'—'}</span></div>`}).join('')}
    <div class="ingr"><span>${wk2?'✓':'○'} Вернулись на вторую неделю</span><span class="qty">${wk2?'да':'—'}</span></div>
    <div class="ingr"><span>Приготовлено из текущего меню</span><span class="qty">${st.cooked} из ${st.dishes}</span></div></div>
   <div class="card"><h3>Пороги пилота на 15 семей</h3>
    ${[['Оплатили вторую неделю','≥ 5 из 15'],['Пользуются 4 недели подряд','≥ 40%'],['Готовили по нашему меню','≥ половины блюд'],['Стоимость заявки с рекламы','≤ 50 ₽']].map(([a,b])=>`<div class="ingr"><span>${a}</span><span class="qty">${b}</span></div>`).join('')}
    <p class="small muted">Ниже порогов — не строим полноценное приложение, а пересматриваем нишу.</p></div>
   <div class="card"><h3>Последние события</h3>${ev.slice(-15).reverse().map(e=>`<div class="ingr"><span class="small">${esc(e.n)}${e.p?` <span class="muted">${esc(JSON.stringify(e.p))}</span>`:''}</span><span class="small muted">${new Date(e.t).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span></div>`).join('')||'<p class="small muted">Пока пусто</p>'}
    <button class="btn ghost small" data-act="metricsCopy">Скопировать все события (JSON)</button></div>
  </div>`;
}

/* ---------- v4 actions ---------- */
function v4Act(a,v,el){
  const p=S.profile,V4=V();
  switch(a){
   case 'ulNow': unlock(v,true); if(v==='kcal'){UI.drawer=false; S.tab='profile'} toast(`Открыто: ${FEAT[v].t}`); return true;
   case 'seen': V4.seen[v]=1; return true;
   case 'featGo': V4.seen[v]=1; UI.drawer=false; S.tab=FEAT[v].go; window.scrollTo(0,0); if(v==='kcal'||v==='extras') setTimeout(()=>{const e=document.getElementById(v==='kcal'?'kcalOn':'soupBatch')||document.querySelector('[data-act="meal"]'); e&&e.scrollIntoView({block:'center'})},60); return true;
   case 'shift': V4.shift=(V4.shift||0)+(+v); UI.drawer=false; UI.sheet=null; checkUnlocks(); S.tab='today'; window.scrollTo(0,0); toast(`Прототип: +${+v===1?'1 день':'неделя'}. ${V4.trialStart?'День '+(dayN()+1)+' с первого меню':''}`); return true;
   case 'tariff': UI.tariff=v; return true;
   case 'subscribe': {const pl=UI.tariff||'year'; V4.sub={plan:pl,since:NOW().toISOString()}; track('subscribed',{plan:pl}); toast('Подписка оформлена. Прототип: деньги не списаны');
     if(!S.plan||todayIdx()<0){save(); build(); return false} S.tab='today'; return true}
   case 'unsub': V4.sub=null; track('unsubscribed'); toast('Подписка отменена'); return true;
   case 'metricsCopy': {const t=JSON.stringify(V4.ev,null,1); if(navigator.clipboard) navigator.clipboard.writeText(t).then(()=>toast('События скопированы'),()=>toast('Не удалось скопировать')); return false}
  }
  return false;
}

/* ---------- boot ---------- */
V(); checkUnlocks();
render();
