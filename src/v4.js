/* ============ v4: step-by-step feature unlocks, feature announcements and interaction hooks ============ */
const PRICE_DATE='20–21 октября';
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

/* ---------- generation and interaction tracking ---------- */
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
    if(S.tab!==t0){track('screen',{s:S.tab}); if(S.tab==='shop') track('list_opened')}
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
  const n=S.profile.members.length;
  return `<div class="dscrim" data-act="drawerClose"><nav class="drawer" aria-label="Главное меню">
   <div class="duser"><span class="avatar big">${esc(initials())}</span><div><b>${esc((S.profile.members[0]&&S.profile.members[0].name)||'Профиль')}</b><br><span class="small muted">${S.user?esc(S.user.phone):'гость (демо)'}</span></div></div>
   ${it('nav','profile',IC.profile,'Семья и настройки',`${n} ${plural(n,'человек','человека','человек')} · вкусы и ограничения`)}
   ${UL('home')?it('nav','home',IC.home,'Продукты дома','',nb('home')):lockIt('home')}
   ${UL('promo')?it('nav','promo',IC.tag,'Акции и цены',`${VV_PROMO.length} акций ВкусВилла, скидки Лавки, сравнение корзины`,nb('promo')):lockIt('promo')}
   ${UL('kcal')||KC()?it('featGo','kcal',IC.chart,'Калории',KC()?'Включены':'Выключены — включить в настройках',nb('kcal')):lockIt('kcal')}
   ${UL('extras')?'':lockIt('extras')}
   ${it('navRem','',IC.bell,'Напоминания',S.profile.reminder.on?`накануне в ${S.profile.reminder.time}`:'выключены')}
   <div style="flex:1"></div>
   ${it('logout','',IC.logout,'Выйти','')}
  </nav></div>`;
}
// clicks inside the drawer panel must not close it
document.addEventListener('click',e=>{const t=e.target.closest('[data-act]'); if(t&&t.classList.contains('dscrim')&&e.target.closest('.drawer')) e.stopImmediatePropagation()},true);

/* ---------- Today: feature announcements ---------- */
function v4Top(){
  const v=V(),out=[];
  Object.keys(FEAT).filter(k=>v.ul[k]&&!v.seen[k]).sort((a,b)=>v.ul[b].localeCompare(v.ul[a])).slice(0,2).forEach(k=>{const f=FEAT[k];
    out.push(`<div class="card newcard"><div class="row" style="align-items:flex-start"><span class="newic">${IC[f.icon]}</span><div class="grow stack" style="gap:2px"><p class="eyebrow" style="color:var(--accent)">Открылось новое</p><b>${f.t}</b><p class="small muted">${f.d}</p></div></div>
     <div class="row"><button class="btn small" data-act="featGo" data-v="${k}">Посмотреть</button><button class="btn ghost small" data-act="seen" data-v="${k}">Понятно</button></div></div>`)});
  return out.join('');
}
function weekEndCard(){
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

/* ---------- v4 actions ---------- */
function v4Act(a,v,el){
  const p=S.profile,V4=V();
  switch(a){
   case 'ulNow': unlock(v,true); if(v==='kcal'){UI.drawer=false; S.tab='profile'} toast(`Открыто: ${FEAT[v].t}`); return true;
   case 'seen': V4.seen[v]=1; return true;
   case 'featGo': V4.seen[v]=1; UI.drawer=false; S.tab=FEAT[v].go; window.scrollTo(0,0); if(v==='kcal'||v==='extras') setTimeout(()=>{const e=document.getElementById(v==='kcal'?'kcalOn':'soupBatch')||document.querySelector('[data-act="meal"]'); e&&e.scrollIntoView({block:'center'})},60); return true;

  }
  return false;
}

/* ---------- boot ---------- */
V(); checkUnlocks();
// Rendering starts centrally in bootstrap.js.
