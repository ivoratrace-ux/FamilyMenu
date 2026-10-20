/* ============ v3 SHELL: intro → auth → quiz onboarding, app bar, side drawer, promos, store prices ============ */
function storePrice(st,k){return st==='lavka'&&LAVKA[k]?LAVKA[k][0]:ING[k][3]}
const STORES={vv:'ВкусВилл',lavka:'Яндекс Лавка'};
function storeLink(st,k){return st==='lavka'?(LAVKA[k]?'https://lavka.yandex.ru'+LAVKA[k][3]:'https://lavka.yandex.ru/search?text='+encodeURIComponent(VVQ[k]||ING[k][0])):vvUrl(k)}
function basketBy(st){const sh=shopping();return sh.items.filter(i=>!i.covered&&!i.bought).reduce((a,i)=>a+i.toBuy*storePrice(st,i.k)*cityCoef(),0)}
function lavkaRegBasket(){const sh=shopping();return sh.items.filter(i=>!i.covered&&!i.bought).reduce((a,i)=>a+i.toBuy*(LAVKA[i.k]?LAVKA[i.k][1]:ING[i.k][3])*cityCoef(),0)}
function canKeep(r){return !!r&&r.m==='m'&&!r.tags.includes('salad')}
function fixLeftovers(){
  if(!S.plan) return; const por=portions(); let changed=0;
  S.plan.days.forEach((d,di)=>Object.entries(d.slots).forEach(([k,s])=>{
    if(!s||!s.left) return; const src=S.plan.days[s.from]&&S.plan.days[s.from].slots[s.of||'l']; const r=src&&src.rid&&RBY[src.rid];
    if(!canKeep(r)){ if(src&&src.serv>por) src.serv=por; const nr=pick(k,{},false); d.slots[k]={rid:nr&&nr.id,serv:por}; changed++; }
  }));
  return changed;
}
const TITLES={today:'Сегодня',menu:'Меню на неделю',shop:'Покупки',home:'Продукты дома',profile:'Семья и настройки',promo:'Акции и цены'};
const initials=()=>{const n=(S.profile.members[0]&&S.profile.members[0].name)||'';return (n&&n!=='Я'?n[0]:'Я').toUpperCase()};
function appbar(){return `<header class="appbar"><button class="iconbtn burger" data-act="drawer" aria-label="Открыть меню">${IC.burger}</button><b class="grow">${TITLES[S.tab]||''}</b><button class="avatar" data-act="drawer" aria-label="Профиль">${esc(initials())}</button></header>`}
function drawer(){
  if(!UI.drawer) return '';
  const it=(act,v,icon,label,sub)=>`<button class="ditem" data-act="${act}" data-v="${v||''}">${icon}<span class="grow"><b>${label}</b>${sub?`<br><span class="small muted">${sub}</span>`:''}</span></button>`;
  const promoCount=VV_PROMO.length;
  return `<div class="dscrim" data-act="drawerClose"><nav class="drawer" aria-label="Главное меню" data-stop>
   <div class="duser"><span class="avatar big">${esc(initials())}</span><div><b>${esc((S.profile.members[0]&&S.profile.members[0].name)||'Профиль')}</b><br><span class="small muted">${S.user?esc(S.user.phone):'гость (демо)'}</span></div></div>
   ${it('nav','profile',IC.profile,'Семья и настройки',`${S.profile.members.length} ${plural(S.profile.members.length,'человек','человека','человек')} · вкусы, ограничения, нормы калорий`)}
   ${it('nav','promo',IC.tag,'Акции ВкусВилла',`${promoCount} предложений до конца недели`)}
   ${it('navPrices','',IC.scale,'Цены: ВкусВилл и Лавка','Где ваша корзина дешевле')}
   ${it('nav','home',IC.home,'Продукты дома','')}
   ${it('navRem','',IC.bell,'Напоминания',S.profile.reminder.on?`накануне в ${S.profile.reminder.time}`:'выключены')}
   <div style="flex:1"></div>
   ${it('logout','',IC.logout,'Выйти','')}
   <p class="proto" style="padding:0 16px 8px">Прототип, версия 3 · ${R.length} рецептов</p>
  </nav></div>`;
}
function tabsV3(){
  const left=S.plan?shopping().items.filter(i=>!i.covered&&!i.bought).length:0;
  const t=[['today','Сегодня'],['menu','Меню'],['shop','Покупки'],['home','Дома']];
  return `<div class="tabs"><nav aria-label="Разделы" style="grid-template-columns:repeat(4,1fr)">${t.map(([k,l])=>`<button data-act="tab" data-v="${k}" ${S.tab===k?'aria-current="page"':''}>${IC[k]}<span>${l}</span>${k==='shop'&&left?`<span class="badge">${left}</span>`:''}</button>`).join('')}</nav></div>`;
}
/* ---------- intro ---------- */
const SLIDES=[
 {t:'Меню на неделю для всей семьи',d:'Учитываем вкусы, аллергии и нормы калорий каждого. Суп на обед, второе на ужин — как привыкли.',art:()=>`<div class="collage">${['m5','m3','b1','m66'].map(id=>`<div class="heroimg">${dishArt(RBY[id])}</div>`).join('')}</div>`},
 {t:'Список покупок соберётся сам',d:'Одинаковые продукты объединены, а цены сравниваются между ВкусВиллом и Яндекс Лавкой.',art:()=>`<div class="card introlist">${[['potato',1.4,'кг'],['chicken_fillet',700,'г'],['buckwheat',300,'г'],['tomato',400,'г']].map(([k,q])=>`<div class="row between"><span class="row"><span class="chkfake"></span>${esc(ING[k][0])}</span><span class="qty">${typeof q==='number'&&q<10?dec(q)+' кг':q+' г'}</span></div>`).join('')}<div class="row between small"><span class="pill">ВкусВилл ≈ 1 240 ₽</span><span class="pill warn">Лавка ≈ 1 090 ₽</span></div></div>`},
 {t:'Готовьте по шагам с таймером',d:'Картинка и граммовки на каждом шаге, таймер со звуком, калории считаются сами.',art:()=>`<div class="heroimg">${stepArt(RBY.m2,3)}</div><div class="card timerbox" style="margin-top:-30px;width:70%;align-self:center"><span class="bigtime" style="font-size:40px">4:59</span></div>`},
];
function intro(){
  const i=S.introIdx||0,s=SLIDES[i];
  return `<div class="screen onbscreen">
   <div class="row between"><span></span><button class="btn ghost small" data-act="introSkip">Пропустить</button></div>
   <div class="stack introart">${s.art()}</div>
   <div class="stack" style="gap:8px"><h1>${s.t}</h1><p class="muted">${s.d}</p></div>
   <div class="dots" style="justify-content:center">${SLIDES.map((_,j)=>`<i class="${j===i?'on':''}"></i>`).join('')}</div>
   <button class="btn block" data-act="introNext">${i<SLIDES.length-1?'Далее':'Начать'}</button></div>`;
}
/* ---------- auth (prototype: no real SMS) ---------- */
const fmtPhone=d=>{d=d.slice(0,10);let o='+7';if(d.length)o+=' ('+d.slice(0,3);if(d.length>=3)o+=')';if(d.length>3)o+=' '+d.slice(3,6);if(d.length>6)o+='-'+d.slice(6,8);if(d.length>8)o+='-'+d.slice(8,10);return o};
function auth(){
  const st=UI.authStep||'phone',digits=UI.phone||'';
  if(st==='phone') return `<div class="screen onbscreen">
   <div class="stack" style="gap:10px;margin-top:24px"><div class="appicon" style="width:56px;height:56px;border-radius:16px">${IC.pot}</div><h1>Вход</h1><p class="muted">Введите номер телефона — пришлём код. Так меню, список покупок и настройки семьи сохранятся.</p></div>
   <form class="stack" data-form="phone"><label class="field" for="phone">Номер телефона<input type="tel" id="phone" inputmode="tel" autocomplete="tel" value="${fmtPhone(digits)}" placeholder="+7 (900) 000-00-00" style="font-size:20px;letter-spacing:.02em"></label>
   <button class="btn block" type="submit" ${digits.length===10?'':'disabled'} id="phoneBtn">Получить код</button></form>
   <p class="small muted">Нажимая «Получить код», вы соглашаетесь с условиями сервиса. В прототипе СМС не отправляется.</p>
   <div style="flex:1"></div>
   <button class="btn ghost block" data-act="guest">Посмотреть без входа (демо-семья)</button></div>`;
  return `<div class="screen onbscreen">
   <div class="row"><button class="iconbtn" data-act="authBack" aria-label="Назад">←</button></div>
   <div class="stack" style="gap:10px"><h1>Код из СМС</h1><p class="muted">Отправили на ${fmtPhone(digits)}. <button class="linkbtn" data-act="authBack">Изменить номер</button></p></div>
   <form class="stack" data-form="code"><input type="text" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="4" class="codeinput" aria-label="Код из СМС" value="${esc(UI.code||'')}">
   ${UI.codeErr?`<p class="small" style="color:var(--danger)">${UI.codeErr}</p>`:''}
   <button class="btn block" type="submit">Войти</button></form>
   <p class="small muted">Прототип: подойдёт любой код из 4 цифр. Отправить повторно можно через 59 с.</p></div>`;
}
/* ---------- quiz onboarding ---------- */
function setCounts(kind,delta){const ms=S.profile.members,of=ms.filter(m=>m.kind===kind);
  if(delta>0) ms.push(newMember(kind,kind==='adult'?(of.length?'Взрослый '+(of.length+1):'Я'):'Ребёнок'+(of.length?' '+(of.length+1):'')));
  else if(of.length>(kind==='adult'?1:0)){const last=of[of.length-1];ms.splice(ms.indexOf(last),1)}}
const QUIZ=[
 ['Для кого готовим?','Посчитаем порции и нормы калорий. Подробнее о каждом — потом, в «Семье».',()=>{const p=S.profile,a=p.members.filter(m=>m.kind==='adult').length,k=p.members.length-a;
   return `<div class="stack" style="gap:12px">${[['adult','Взрослые','от 14 лет',a],['child','Дети','до 14 лет',k]].map(([kd,l,s,n])=>`<div class="card bigcount"><div><h2>${l}</h2><p class="small muted">${s}</p></div><div class="stepper big"><button data-act="qcnt" data-v="${kd}:-1" aria-label="Меньше">−</button><span>${n}</span><button data-act="qcnt" data-v="${kd}:1" aria-label="Больше">+</button></div></div>`).join('')}
   <p class="small muted">Готовим на ${portions()} ${plural(portions(),'порцию','порции','порций')} за приём пищи</p></div>`}],
 ['Есть ли аллергии?','Такие блюда исключим полностью.',()=>{const p=S.profile;return `<div class="chips">${`<button class="chip" data-act="noAllergy" aria-pressed="${!p.allergies.length}">Нет аллергий</button>`}${Object.entries(ALLERG).map(([k,l])=>`<button class="chip danger" data-act="allergy" data-v="${k}" aria-pressed="${p.allergies.includes(k)}">${l}</button>`).join('')}</div>`}],
 ['Как вы питаетесь?','Выберите один вариант.',()=>`<div class="stack" style="gap:8px">${Object.entries(DIETS).map(([k,[l,d]])=>`<button class="optcard" data-act="diet" data-v="${k}" aria-pressed="${S.profile.diet===k}"><b>${l}</b>${d?`<span class="small muted">${d}</span>`:''}</button>`).join('')}</div>`],
 ['Что планируем?','Можно выбрать несколько. На обед — суп, на ужин — второе.',()=>{const p=S.profile;return `${chips(SLOT_NAMES,SLOTS.filter(k=>p.meals[k]),'meal')}
   ${p.meals.l?`<label class="toggle togglecard"><span><b>Суп варить на два дня</b><br><span class="small muted">Остатки супа на следующий обед</span></span><input type="checkbox" class="switch" id="soupBatch" data-act="soupBatch" ${p.soupBatch?'checked':''}></label>`:''}`}],
 ['Бюджет и город','По городу пересчитаем цены магазинов.',()=>{const p=S.profile;return `<div class="card"><label class="field" for="budget">Бюджет на продукты в неделю<b id="budgetv" style="color:var(--fg);font-size:26px;font-variant-numeric:tabular-nums">${rub(p.budget)}</b></label>
   <input type="range" id="budget" min="2000" max="30000" step="500" value="${p.budget}" data-act="budget" aria-label="Бюджет в неделю"></div>
   <label class="field" for="city">Город<select id="city" data-act="city">${Object.entries(CITIES).map(([k,[l]])=>`<option value="${k}" ${p.city===k?'selected':''}>${l}</option>`).join('')}</select></label>`}],
 ['Есть цель по питанию?','Необязательно. Подходящие блюда будут чаще.',()=>chips(GOALS,S.profile.goals,'goal')],
];
function quiz(){
  const i=S.qStep||0,[t,d,body]=QUIZ[i],last=i===QUIZ.length-1,okMeals=Object.values(S.profile.meals).some(Boolean);
  return `<div class="screen onbscreen">
   <div class="row between">${i?`<button class="iconbtn" data-act="qBack" aria-label="Назад">←</button>`:'<span style="width:36px"></span>'}<div class="progress grow" style="margin:0 12px"><i style="width:${Math.round((i+1)/QUIZ.length*100)}%"></i></div><button class="btn ghost small" data-act="qSkip">${last?'Пропустить':'Позже'}</button></div>
   <div class="stack" style="gap:6px;margin-top:8px"><p class="eyebrow">Шаг ${i+1} из ${QUIZ.length}</p><h1>${t}</h1><p class="muted">${d}</p></div>
   ${body()}
   <div style="flex:1"></div>
   <button class="btn block" data-act="${last?'build':'qNext'}" ${i===3&&!okMeals?'disabled':''}>${last?'Составить меню':'Дальше'}</button></div>`;
}
/* ---------- promos & prices ---------- */
function scrPromo(){
  const tab=UI.promoTab||'vv',inMenu=S.plan?needMap(S.plan).m:{};
  const seg=`<div class="seg" role="tablist">${[['vv','ВкусВилл'],['lavka','Лавка'],['compare','Сравнить']].map(([k,l])=>`<button role="tab" aria-selected="${tab===k}" data-act="promoTab" data-v="${k}">${l}</button>`).join('')}</div>`;
  let body='';
  if(tab==='vv'){
    const list=[...VV_PROMO].sort((a,b)=>(inMenu[b[5]]?1:0)-(inMenu[a[5]]?1:0)||((b[2]-b[1])/b[2])-((a[2]-a[1])/a[2]));
    body=`<p class="small muted">Источник: каталог ВкусВилла (vkusvill.ru/offers), 20–21 октября 2026. Сначала — то, что есть в вашем меню.</p>`+list.map(([n,p,o,c,u,k])=>`<div class="card promo"><div class="row between" style="align-items:flex-start"><div class="stack" style="gap:2px"><b>${esc(n)}</b><span class="small muted">${esc(c)}${u&&u!=='—'?' · до '+u:''}</span>${k&&inMenu[k]?`<span class="pill">нужно для: ${esc([...inMenu[k].dishes].slice(0,2).join(', '))}</span>`:''}</div>
      <div class="pricebox"><b>${num(p)} ₽</b><s>${num(o)} ₽</s><span class="pill danger">−${Math.round((o-p)/o*100)}%</span></div></div>
      <a class="btn ghost small" href="https://vkusvill.ru/search/?q=${encodeURIComponent(n.replace(/[«»"]/g,'').split(',')[0])}" target="_blank" rel="noopener">Открыть во ВкусВилле ↗</a></div>`).join('');
  } else if(tab==='lavka'){
    const list=Object.entries(LAVKA).filter(([k,v])=>v[0]<v[1]-0.0001).map(([k,v])=>({k,v,d:(v[1]-v[0])/v[1]})).sort((a,b)=>(inMenu[b.k]?1:0)-(inMenu[a.k]?1:0)||b.d-a.d).slice(0,30);
    body=`<p class="small muted">Источник: каталог Яндекс Лавки, Москва, 21 октября 2026. Сейчас в Лавке много скидок до −30% — показываем продукты из базы рецептов, сначала то, что есть в вашем меню.</p>`+list.map(({k,v,d})=>`<div class="card promo"><div class="row between" style="align-items:flex-start"><div class="stack" style="gap:2px"><b>${esc(v[2])}</b>${inMenu[k]?`<span class="pill">нужно для: ${esc([...inMenu[k].dishes].slice(0,2).join(', '))}</span>`:`<span class="small muted">${esc(ING[k][0])}</span>`}</div>
      <div class="pricebox"><span class="pill danger">−${Math.round(d*100)}%</span></div></div>
      <a class="btn ghost small" href="https://lavka.yandex.ru${v[3]}" target="_blank" rel="noopener">Открыть в Лавке ↗</a></div>`).join('');
  } else {
    if(!S.plan) body='<p class="muted">Сначала составьте меню.</p>'; else {
    const vv=basketBy('vv'),lv=basketBy('lavka'),lr=lavkaRegBasket(),best=lv<vv?'lavka':'vv',diff=Math.abs(vv-lv);
    const sh=shopping(),items=sh.items.filter(i=>!i.covered&&!i.bought).map(i=>({i,a:i.toBuy*storePrice('vv',i.k)*cityCoef(),b:i.toBuy*storePrice('lavka',i.k)*cityCoef(),has:!!LAVKA[i.k]})).sort((x,y)=>Math.abs(y.a-y.b)-Math.abs(x.a-x.b));
    body=`<div class="card"><h3>Ваша корзина на неделю</h3>
      <div class="compare"><div class="${best==='vv'?'win':''}"><span class="small muted">ВкусВилл</span><b>${rub(vv)}</b><span class="small muted">обычные цены</span></div><div class="${best==='lavka'?'win':''}"><span class="small muted">Яндекс Лавка</span><b>${rub(lv)}</b><span class="small muted">со скидками · обычно ${rub(lr)}</span></div></div>
      <p><b>Дешевле ${best==='lavka'?'в Лавке':'во ВкусВилле'} на ${rub(diff)}</b>. <span class="small muted">Цены — ${PRICE_SOURCE} и ${LAVKA_SOURCE}${S.profile.city!=='msk'?`, пересчитаны для города ×${dec(cityCoef())}`:''}. Без учёта доставки и фасовок.</span></p>
      <div class="row"><button class="btn small ${S.store==='vv'?'':'ghost'}" data-act="store" data-v="vv">Считать по ВкусВиллу</button><button class="btn small ${S.store==='lavka'?'':'ghost'}" data-act="store" data-v="lavka">Считать по Лавке</button></div></div>
      <div class="card"><h3>Где что дешевле</h3>${items.slice(0,25).map(({i,a,b,has})=>`<div class="ingr"><span>${esc(i.name)}<br><span class="small muted">${fmtQty(i.k,i.toBuy,true)}${has?'':' · в Лавке не нашли'}</span></span><span class="qty" style="text-align:right">ВВ ${rub(a)}<br>${has?`<span style="color:${b<a?'var(--accent)':'var(--muted)'}">Лавка ${rub(b)}</span>`:''}</span></div>`).join('')}</div>`;}
  }
  return `<div class="screen">${seg}${body}</div>`;
}
/* ---------- render override ---------- */
function render(){
  const app=$('#app');
  if(S.stage==='intro') app.innerHTML=intro();
  else if(S.stage==='auth') app.innerHTML=auth();
  else if(S.stage==='quiz') app.innerHTML=quiz();
  else if(S.stage==='gen') app.innerHTML=`<div class="screen"><div class="loader"><div class="spin" aria-hidden="true"></div><h2>Подбираем меню на неделю</h2><p class="muted small">Учитываем семью, ограничения, калории, время и бюджет</p></div></div>`;
  else app.innerHTML=appbar()+({today:scrToday,menu:scrMenu,shop:scrShop,home:scrHome,profile:scrProfile,promo:scrPromo}[S.tab]||scrToday)()+tabsV3()+drawer();
  renderSheet(); renderCook(); paintTimers();
}
function shellAct(a,v,el){
  const p=S.profile;
  switch(a){
   case 'introNext': if((S.introIdx||0)<SLIDES.length-1) S.introIdx=(S.introIdx||0)+1; else S.stage=S.user?(S.plan?'app':'quiz'):'auth'; return true;
   case 'introSkip': S.stage=S.user?(S.plan?'app':'quiz'):'auth'; return true;
   case 'authBack': UI.authStep='phone'; UI.code=''; UI.codeErr=''; return true;
   case 'guest': {S.user=null; act('demo'); return false}
   case 'qNext': S.qStep=Math.min(QUIZ.length-1,(S.qStep||0)+1); return true;
   case 'qBack': S.qStep=Math.max(0,(S.qStep||0)-1); return true;
   case 'qSkip': if((S.qStep||0)<QUIZ.length-1){S.qStep++; return true} build(); return false;
   case 'qcnt': {const [k,d]=v.split(':'); setCounts(k,+d); return true}
   case 'noAllergy': p.allergies=[]; return true;
   case 'drawer': UI.drawer=true; return true;
   case 'drawerClose': UI.drawer=false; return true;
   case 'nav': UI.drawer=false; S.tab=v; window.scrollTo(0,0); return true;
   case 'navPrices': UI.drawer=false; S.tab='promo'; UI.promoTab='compare'; window.scrollTo(0,0); return true;
   case 'navRem': UI.drawer=false; S.tab='profile'; setTimeout(()=>{const e=document.getElementById('remOn'); if(e) e.scrollIntoView({block:'center'})},50); return true;
   case 'promoTab': UI.promoTab=v; return true;
   case 'store': S.store=v; toast('Цены считаем по: '+STORES[v]); return true;
   case 'logout': UI.drawer=false; S.user=null; S.stage='auth'; UI.authStep='phone'; UI.phone=''; toast('Вы вышли. Данные семьи сохранены на этом устройстве'); return true;
  }
  return false;
}
document.addEventListener('submit',e=>{
  const f=e.target; if(!f.dataset) return;
  if(f.dataset.form==='phone'){e.preventDefault(); if((UI.phone||'').length===10){UI.authStep='code';UI.code='';UI.codeErr='';render();setTimeout(()=>{const c=$('#code');c&&c.focus()},30)}}
  if(f.dataset.form==='code'){e.preventDefault(); const c=($('#code')||{}).value||''; if(!/^\d{4}$/.test(c)){UI.codeErr='Введите 4 цифры из СМС';render();return}
    S.user={phone:fmtPhone(UI.phone),since:new Date().toISOString()}; UI.authStep='phone'; S.stage=S.plan?'app':'quiz'; S.qStep=0; save(); render(); toast('Вы вошли')}
});
document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='phone'){let d=t.value.replace(/\D/g,''); if(d.startsWith('7')||d.startsWith('8')) d=d.slice(1); UI.phone=d.slice(0,10); t.value=fmtPhone(UI.phone); const b=$('#phoneBtn'); if(b) b.disabled=UI.phone.length!==10}
  if(t.id==='code'){t.value=t.value.replace(/\D/g,'').slice(0,4); UI.code=t.value; if(t.value.length===4){const f=t.closest('form'); f&&f.requestSubmit&&f.requestSubmit()}}
});

render();
