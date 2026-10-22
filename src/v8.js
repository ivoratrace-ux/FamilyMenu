/* ============ v8 «Frigo»: v4 look with the v6 flow ============
   splash → 4 feature slides → 5-step getting to know → 2 s loader → first menu → Telegram sign-in
   tabs: Меню · Покупки · Дома · Профиль; per-meal kinds, 1–7 days, main+side pairs, own recipes, Premium as a subscription */

const SLOT8={b:'Завтрак',l:'Обед',s:'Перекус',d:'Ужин'};
const KIND8={breakfast:'Завтрак: каши, яйца, сырники',soup:'Суп',pair:'Второе с гарниром',dish:'Целое блюдо или салат',dessert:'Десерт',drink:'Напиток',snack:'Перекус',none:'Не нужен'};
const KOPT8={b:['breakfast','none'],l:['soup','pair','dish','none'],s:['none','dessert','drink','snack'],d:['pair','dish','soup','none']};
const MYK8={breakfast:['Завтрак','b'],soup:['Суп','m'],main:['Основное: мясо, рыба','p'],side:['Гарнир','g'],dish:['Целое блюдо или салат','m'],dessert:['Десерт','z'],drink:['Напиток','k'],snack:['Перекус','s']};
const GOAL8={lose:'Похудение',mass:'Набор массы',pp:'Правильное питание',protein:'Больше белка',lowcarb:'Меньше углеводов',none:'Просто вкусно и разнообразно'};
const PAGES8={pFamily:'Семья',pFood:'Питание и ограничения',pRecipes:'Мои рецепты',pRecipe:'Рецепт',pDays:'Дни и приёмы пищи',autocart:'Автосборка корзины',promo:'Подборка акций',kcal:'Калории и КБЖУ',sub:'Premium',metrics:'Метрики пилота'};
const premium8=()=>subscribed();

/* ---------- profile defaults & compatibility with the stored model ---------- */
function P8(){
  const p=S.profile;
  if(!p.mealSetup) p.mealSetup={b:p.meals&&p.meals.b?'breakfast':'none',l:p.meals&&p.meals.l===false?'none':'soup',s:'none',d:p.meals&&p.meals.d===false?'none':'pair'};
  if(!(p.days>=1&&p.days<=7)) p.days=3;
  if(!Array.isArray(S.myRecipes)) S.myRecipes=[];
  if(!S.ans) S.ans={};
  p.soupBatch=false;
  p.meals={b:p.mealSetup.b!=='none',l:p.mealSetup.l!=='none',s:p.mealSetup.s!=='none',d:p.mealSetup.d!=='none',z:false,k:false};
  if(!premium8()) p.kcalOn=false;
  return p;
}

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
poolFor=(function(orig){return function(slot){if(String(slot).startsWith('k:')) return pool8(slot.slice(2)); return orig(slot)}})(poolFor);
function sideFor(main){const sides=pool8('side'); if(!sides.length) return null; const pref=sides.filter(x=>(main.tags||[]).includes('pair:'+x.id)); const list=pref.length?pref:sides; return list[Math.floor(Math.random()*list.length)]}

/* ---------- menu generation: chosen kinds, 1–7 days (the stored menu keeps 7 days) ---------- */
generate=function(){
  const p=P8(),start=day0(NOW()),used={},por=portions(),days=[]; let prev=null;
  for(let d=0;d<7;d++){
    const date=addDays(start,d),wd=date.getDay(),weekend=wd===0||wd===6,slots={};
    if(d<p.days) for(const k of ['b','l','s','d']){
      const kind=p.mealSetup[k]||'none'; if(kind==='none') continue;
      let r=pick('k:'+kind,used,weekend,k==='d'?{prevProtein:prev}:{});
      if(r&&kind==='pair'){const side=sideFor(r); if(side) r=comboOf(r,side)}
      slots[k]={rid:r&&r.id,serv:por}; if(k==='d'&&r) prev=r.protein;
    }
    days.push({date:date.toISOString(),slots});
  }
  S.plan={created:NOW().toISOString(),status:'draft',days}; S.bought={}; S.eaten={}; S.extra={};
  track('menu_built',{days:p.days});
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
const head8=(eyebrow,title,right='')=>`<div class="row between" style="align-items:flex-end"><div class="grow"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div>${right}</div>`;
const navRow8=(act,v,icon,title,sub,lock)=>`<button class="ditem navrow" data-act="${act}" data-v="${v}">${lock?IC.lock:icon}<span class="grow"><b>${title}</b>${sub?`<br><span class="small muted">${sub}</span>`:''}</span><span class="muted" aria-hidden="true">›</span></button>`;
function clampChips(){
  document.querySelectorAll('.chips[data-clamp]').forEach(box=>{
    const key=box.dataset.clamp,more=box.querySelector('.morechip'),chips=[...box.querySelectorAll('.chip:not(.morechip)')];
    chips.forEach(c=>c.hidden=false); more.hidden=true;
    if(UI.open8&&UI.open8[key]){more.hidden=false; more.textContent='Свернуть'; return}
    const tops=[...new Set(chips.map(c=>c.offsetTop))].sort((a,b)=>a-b); if(tops.length<=4) return;
    const limit=tops[3]; chips.forEach(c=>{if(c.offsetTop>limit) c.hidden=true});
    more.hidden=false; more.textContent='Ещё ▾';
    const vis=chips.filter(c=>!c.hidden); while(more.offsetTop>limit&&vis.length) vis.pop().hidden=true;
  });
}
const clampBox8=(key,list,sel,act,cls='')=>`<div class="chips" data-clamp="${key}">${list.map(([k,l])=>`<button class="chip ${cls}" data-act="${act}" data-v="${esc(k)}" aria-pressed="${sel.includes(k)}">${esc(l)}</button>`).join('')}<button class="chip morechip" data-act="more8" data-v="${key}">Ещё ▾</button></div>`;
const dislikeList8=()=>Object.keys(ING).filter(k=>!['oil','sugar','salt','water'].includes(k)).map(k=>[k,ING[k][0]]).sort((a,b)=>a[1].localeCompare(b[1],'ru'));
function restr8(){const p=S.profile; return `
  <div class="card"><h3>Аллергии</h3><p class="small muted">Блюда с этими продуктами исключим полностью.</p>${clampBox8('allerg',Object.entries(ALLERG),p.allergies,'allergy','danger')}</div>
  <div class="card"><h3>Не нравится</h3><p class="small muted">Такие продукты не попадут в меню.</p>${clampBox8('dislike',dislikeList8(),p.dislikes,'dislike')}</div>`}
const stepper8=(act,val,label)=>`<div class="stepper big"><button data-act="${act}" data-v="-1" aria-label="Меньше">−</button><span>${label}</span><button data-act="${act}" data-v="1" aria-label="Больше">+</button></div>`;
function details8(){
  const p=P8(),a=p.members.filter(m=>m.kind==='adult').length,c=p.members.length-a;
  return `<div class="card bigcount"><div><h2>Дней в меню</h2><p class="small muted">максимум — неделя</p></div>${stepper8('days8',p.days,p.days)}</div>
   <div class="card bigcount"><div><h2>Взрослые</h2><p class="small muted">от 14 лет</p></div><div class="stepper big"><button data-act="qcnt" data-v="adult:-1" aria-label="Меньше">−</button><span>${a}</span><button data-act="qcnt" data-v="adult:1" aria-label="Больше">+</button></div></div>
   <div class="card bigcount"><div><h2>Дети</h2><p class="small muted">до 14 лет</p></div><div class="stepper big"><button data-act="qcnt" data-v="child:-1" aria-label="Меньше">−</button><span>${c}</span><button data-act="qcnt" data-v="child:1" aria-label="Больше">+</button></div></div>
   <div class="card"><h3>Что готовим</h3>${Object.entries(SLOT8).map(([k,l])=>`<label class="field mealsel" for="kind_${k}"><span>${l}</span><select id="kind_${k}" data-act="kind8" data-v="${k}">${KOPT8[k].map(o=>`<option value="${o}" ${p.mealSetup[k]===o?'selected':''}>${KIND8[o]}</option>`).join('')}</select></label>`).join('')}
   ${Object.values(p.mealSetup).every(v=>v==='none')?'<p class="small" style="color:var(--danger)">Выберите хотя бы один приём пищи</p>':`<p class="small muted">Готовим на ${portions()} ${plural(portions(),'порцию','порции','порций')} за приём пищи.</p>`}</div>`;
}

/* ---------- pantry block (fridge step and «Дома») ---------- */
const defQty8=k=>{const u=ING[k][2];return u==='g'?500:u==='ml'?1000:1};
const hasP8=k=>S.pantry.some(x=>x.key===k);
function togglePantry8(k){const i=S.pantry.findIndex(x=>x.key===k); if(i>=0) S.pantry=S.pantry.filter(x=>x.key!==k); else S.pantry.push({key:k,qty:defQty8(k)})}
function pantry8(full){
  const q=(UI.q8||'').trim().toLowerCase(),found=q?Object.keys(ING).filter(k=>ING[k][0].toLowerCase().includes(q)).slice(0,12):[];
  const cats=CAT_ORDER.filter(c=>Object.keys(ING).some(k=>ING[k][1]===c));
  const photos=UI.photos||[];
  return `<input type="search" class="bigsearch" id="pq8" placeholder="Найти продукт: курица, рис, сыр…" value="${esc(UI.q8||'')}" data-act="search8" autocomplete="off" aria-label="Поиск продукта">
   ${q?(found.length?`<div class="chips">${found.map(k=>`<button class="chip" data-act="pt8" data-v="${k}" aria-pressed="${hasP8(k)}">${hasP8(k)?'✓ ':'+ '}${esc(ING[k][0])}</button>`).join('')}</div>`:'<p class="small muted">Ничего не нашли — попробуйте по-другому.</p>'):''}
   <div class="phototiles">${[0,1].map(i=>{const ph=photos[i];return ph?`<div class="phototile"><img src="${ph.url}" alt="Фото ${i+1}"><button class="iconbtn photodel" data-act="photoDel" data-v="${i}" aria-label="Удалить фото ${i+1}">✕</button></div>`
     :`<button class="phototile" data-act="photoAdd"><span class="plusbig">+</span><span class="small muted">${i?'Фото полок':'Фото холодильника'}</span></button>`}).join('')}</div>
   ${photos.length>2?`<p class="small muted">Ещё фото: ${photos.length-2}</p>`:''}
   ${photos.length?(FamilyMenuApi.session?`<button class="btn block" data-act="scan8" ${UI.scanBusy?'disabled':''}>${UI.scanBusy?'Распознаём фото…':`Распознать продукты (${photos.length})`}</button>`:'<p class="small muted">Распознаем продукты на фото после того, как вы сохраните меню.</p>'):'<p class="small muted">Сфотографируйте холодильник — распознаем продукты сами. Или отметьте вручную ниже.</p>'}
   ${UI.scanErr?`<p class="small" role="alert" style="color:var(--danger)">${esc(UI.scanErr)}</p>`:''}
   ${UI.scan?scanResult8():''}
   <div class="group8">${cats.map(c=>{const ks=Object.keys(ING).filter(k=>ING[k][1]===c&&!['salt','water'].includes(k)).sort((a,b)=>ING[a][0].localeCompare(ING[b][0],'ru')),n=ks.filter(hasP8).length,open=UI.cat8&&UI.cat8[c];
     return `<div class="group"><button data-act="cat8" data-v="${esc(c)}" aria-expanded="${!!open}"><span>${esc(c)}${n?` <span class="pill">${n}</span>`:''}</span><span class="plus">${open?'−':'+'}</span></button>${open?`<div class="chips">${ks.map(k=>`<button class="chip" data-act="pt8" data-v="${k}" aria-pressed="${hasP8(k)}">${esc(ING[k][0])}</button>`).join('')}</div>`:''}</div>`}).join('')}</div>
   ${full&&S.pantry.length?`<h3>Сколько есть</h3>${S.pantry.map((p,i)=>`<div class="card" style="flex-direction:row;align-items:center;padding:10px 12px;gap:8px"><span class="grow">${esc(ING[p.key][0])}${p.src==='list'?'<br><span class="pill grey">из списка покупок</span>':''}</span>
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
 {t:'Готовим из того, что есть',d:'Отметьте продукты из холодильника — подберём блюда и поведём по шагам с таймером.',art:()=>`<div class="heroimg">${stepArt(RBY.m2,3)}</div><div class="card timerbox" style="margin-top:-30px;width:70%;align-self:center"><span class="bigtime" style="font-size:40px">4:59</span></div>`},
 {t:'Большая база рецептов',d:`${R.filter(r=>r.m!=='c').length} блюд с картинками и пошаговыми фото. Пополняем каждую неделю.`,art:()=>`<div class="collage">${['m5','m3','b1','p1'].filter(id=>RBY[id]).map(id=>`<div class="heroimg">${dishArt(RBY[id])}</div>`).join('')}</div><span class="pill" style="align-self:center">+ новые рецепты каждую неделю</span>`},
 {t:'Уложимся в бюджет',premium:true,d:'Соберём корзину на нужную сумму и подскажем, где купить дешевле.',art:()=>`<div class="card"><h3>Корзина на неделю</h3><p><b style="font-size:30px">3 480 ₽</b> <span class="muted">из 4 000 ₽</span></p><div class="progress"><i style="width:87%"></i></div><div class="row"><span class="pill">ВкусВилл · 3 480 ₽</span><span class="pill warn">Лавка · 3 910 ₽</span></div><p class="small muted">Дешевле во ВкусВилле на 430 ₽</p></div>`},
 {t:'Калории и питание',d:'Посчитаем калории для каждого и настроим меню под вашу цель и тип питания.',art:()=>`<div class="card kcal"><h3>Сегодня</h3><p><b style="font-size:30px">1 640</b> <span class="muted">из 2 100 ккал</span></p><div class="kbar"><i style="width:78%"></i></div><div class="macros">${[['82','белки'],['54','жиры'],['190','углеводы']].map(([v,l])=>`<div class="macro"><b>${v}</b><span>${l}, г</span></div>`).join('')}</div><div class="row"><span class="pill">Похудение</span><span class="pill">Без свинины</span></div></div>`},
];
function intro8(){
  const i=Math.min(S.introIdx||0,SLIDES8.length-1),s=SLIDES8[i];
  return `<div class="screen onbscreen">
   <div class="row between"><span style="width:96px"></span><div class="progress grow" style="margin:0 12px"><i style="width:${Math.round((i+1)/SLIDES8.length*100)}%"></i></div><button class="btn ghost small" data-act="introSkip8">Пропустить</button></div>
   <div class="stack introart">${s.art()}</div>
   <div class="stack" style="gap:8px"><div class="row"><h1 class="oneline">${s.t}</h1>${s.premium?'<span class="pill warn">Premium</span>':''}</div><p class="muted">${s.d}</p></div>
   <div style="flex:1"></div>
   <button class="btn block" data-act="introNext8">${i<SLIDES8.length-1?'Дальше':'Начать'}</button>
   <button class="linkbtn" style="align-self:center" data-act="toAuth8">Уже есть аккаунт? Войти</button></div>`;
}
const QUIZ8=['Какая у вас цель?','Какой у вас тип питания?','Чего не должно быть в меню?','Что уже есть в холодильнике?','Ещё немного деталей'];
const QHINT8=['Под цель подберём блюда и посчитаем порции.','Строгое правило: другие блюда в меню не попадут.','Отметьте аллергии и продукты, которые не любите.','Подберём блюда, где докупать меньше всего.','Сколько дней планируем и что готовим на каждый приём пищи.'];
function quiz8(){
  const i=Math.min(S.qStep||0,4),p=P8(),last=i===4;
  let body='',btn='Дальше',ok=true;
  if(i===0){body=`<div class="stack" style="gap:8px">${Object.entries(GOAL8).map(([k,l])=>`<button class="optcard" data-act="goal8" data-v="${k}" aria-pressed="${S.ans.goal===k}"><b>${l}</b></button>`).join('')}</div>`; ok=!!S.ans.goal}
  else if(i===1){body=`<div class="stack" style="gap:8px">${Object.entries(DIETS).map(([k,[l,d]])=>`<button class="optcard" data-act="diet8" data-v="${k}" aria-pressed="${S.ans.diet&&p.diet===k}"><b>${l}</b>${d?`<span class="small muted">${esc(d)}</span>`:''}</button>`).join('')}</div>`; ok=!!S.ans.diet}
  else if(i===2){body=restr8(); if(!p.allergies.length&&!p.dislikes.length) btn='Ограничений нет — дальше'}
  else if(i===3){body=pantry8(false); if(!S.pantry.length&&!(UI.photos||[]).length) btn='Холодильник пуст — дальше'}
  else {body=details8(); btn='Составить меню'; ok=Object.values(p.mealSetup).some(v=>v!=='none')}
  return `<div class="screen onbscreen">
   <div class="row between"><button class="iconbtn" data-act="qBack8" aria-label="Назад">←</button><div class="progress grow" style="margin:0 12px"><i style="width:${Math.round((i+1)/5*100)}%"></i></div><span style="width:36px"></span></div>
   <div class="stack" style="gap:6px;margin-top:8px"><p class="eyebrow">Вопрос ${i+1} из 5</p><h1>${QUIZ8[i]}</h1><p class="muted">${QHINT8[i]}</p></div>
   ${body}
   <div style="flex:1"></div>
   <button class="btn block" data-act="${last?'build8':'qNext8'}" ${ok?'':'disabled'}>${btn}</button></div>`;
}
function loader8(){
  return `<div class="screen onbscreen"><div class="loader"><img class="logo8" src="src/frigo-logo.jpg" alt="Frigo"><div class="progress fill8" style="width:80%"><i></i></div><h2>Подбираем меню</h2><p class="muted small">Учитываем цель, ограничения и то, что есть в холодильнике</p></div></div>`;
}
function ready8(){return scrMenu8(true)+`<div class="savebar"><button class="btn block" data-act="toAuth8">Сохранить меню</button><p class="small muted">Войдите, чтобы сохранить меню, список покупок и продукты.</p></div>`}
function auth8(){
  return auth().replace(/<\/div>\s*$/,`${S.plan?'<button class="btn ghost block" data-act="backReady8">← Вернуться к меню</button>':'<button class="linkbtn" style="align-self:center" data-act="backIntro8">Я здесь впервые</button>'}</div>`);
}

/* ---------- app screens ---------- */
function appbar8(){const sub=PAGES8[S.tab];return `<header class="appbar">${sub?`<button class="iconbtn" data-act="back8" aria-label="Назад">←</button>`:''}<b class="grow">${sub||({menu:'Меню',shop:'Покупки',home:'Дома',profile:'Профиль'}[S.tab]||'Меню')}</b></header>`}
function tabs8(){
  const left=S.plan?shopping().items.filter(i=>!i.covered&&!i.bought).length:0,cur=PAGES8[S.tab]?'profile':S.tab;
  return `<div class="tabs"><nav aria-label="Разделы" style="grid-template-columns:repeat(4,1fr)">${[['menu','Меню'],['shop','Покупки'],['home','Дома'],['profile','Профиль']].map(([k,l])=>`<button data-act="tab" data-v="${k}" ${cur===k?'aria-current="page"':''}>${IC[k]}<span>${l}</span>${k==='shop'&&left?`<span class="badge">${left}</span>`:''}</button>`).join('')}</nav></div>`;
}
function scrMenu8(preview){
  const vis=visibleDays();
  if(!vis.length) return `<div class="screen"><div class="empty"><h2>Меню ещё нет</h2><p>Составим по вашим ответам: цель, тип питания, ограничения и продукты дома.</p><button class="btn" data-act="regen">Составить меню</button></div></div>`;
  const ti=todayIdx(); if(UI.mday==null||!vis.some(([,i])=>i===UI.mday)) UI.mday=vis.some(([,i])=>i===ti)?ti:vis[0][1];
  const di=UI.mday,d=S.plan.days[di],date=new Date(d.date),keys=SLOTS.filter(k=>d.slots[k]);
  const mk=di===ti?nextSlotKey(di):keys[0],r=slotRecipe(di,mk),s=d.slots[mk],others=keys.filter(k=>k!==mk);
  const big=vis.length===1;
  return `<div class="screen${preview?' preview8':''}">
   ${preview?'<div class="note"><b>✓</b><span>Ваше меню готово! Сохраните его — и список покупок соберётся сам.</span></div>':''}
   ${head8(di===ti?'Сегодня':vis.length>1?`Меню на ${vis.length} ${plural(vis.length,'день','дня','дней')}`:'Меню',`<span style="${big?'font-size:30px':''}">${DOWL[date.getDay()][0].toUpperCase()+DOWL[date.getDay()].slice(1)}, ${date.getDate()} ${MON[date.getMonth()]}</span>`,preview?'':S.plan.status==='draft'?'<span class="pill warn">черновик</span>':'<span class="pill">утверждено</span>')}
   ${vis.length>1?`<div class="weekstrip" style="grid-template-columns:repeat(${vis.length},1fr)">${vis.map(([x,i])=>{const dd=new Date(x.date);return `<button data-act="mday8" data-v="${i}" aria-pressed="${i===di}">${i===ti?'сег.':DOW[dd.getDay()]}<b>${dd.getDate()}</b></button>`}).join('')}</div>`:''}
   ${r?`<div class="hero"><div class="heroimg">${dishArt(r)}</div><p class="small" style="opacity:.85">${SLOT8[mk]||SLOT_NAMES[mk]}${s.cooked?' · приготовлено ✓':''}</p><p class="dish">${esc(r.n)}</p>
     <div class="meta"><span>${r.t} мин</span>${KC()?`<span>${r.kcal} ккал на порцию</span>`:''}<span>${s.serv} ${plural(s.serv,'порция','порции','порций')}</span></div>
     ${preview?'':`<div class="row"><button class="btn grow" data-act="cook" data-v="${di}:${mk}">${s.cooked?'Открыть рецепт':'Готовить'}</button><button class="eat" style="background:transparent;color:inherit;border-color:currentColor" data-act="replace" data-v="${di}:${mk}">Заменить</button></div>`}</div>`
     :s?`<div class="card"><p class="muted">${SLOT8[mk]}: не нашли подходящее блюдо. Ослабьте ограничения в профиле.</p></div>`:''}
   ${others.length?`<div class="day ${di===ti?'today':''}"><header><b>Ещё в этот день</b>${di===ti?'<span class="pill">сегодня</span>':''}</header>${others.map(k=>slotRow(di,k,true)).join('')}</div>`:''}
   ${!preview&&KC()&&di===ti?kcalCard(ti):''}
   ${preview?'':`<div class="stack">${S.plan.status==='draft'?'<button class="btn block" data-act="approve">Утвердить меню и собрать покупки</button>':`<button class="btn secondary block" data-act="share">${IC.share} Отправить меню семье</button>`}
    <button class="btn ghost block" data-act="regen">Пересобрать меню</button></div>`}
  </div>`;
}
function scrShop8(){
  if(!S.plan) return `<div class="screen"><div class="empty"><h2>Список пуст</h2><p>Он соберётся сам, когда вы утвердите меню.</p><button class="btn" data-act="tab" data-v="menu">Открыть меню</button></div></div>`;
  const sh=shopping(),need_=sh.items.filter(i=>!i.covered),home=sh.items.filter(i=>i.covered),left=need_.filter(i=>!i.bought);
  const cats=CAT_ORDER.filter(c=>need_.some(i=>i.cat===c));
  const row=i=>`<div class="item ${i.bought?'done':''}"><input type="checkbox" class="chk" id="b_${i.k}" data-act="bought" data-v="${i.k}" ${i.bought?'checked':''} aria-label="Куплено: ${esc(i.name)}">
    <label class="grow" for="b_${i.k}" style="min-width:0;cursor:pointer"><div class="row between" style="align-items:flex-start"><span class="nm">${esc(i.name)}</span><span class="qty">${fmtQty(i.k,i.toBuy,true)}</span></div>
    <div class="for8">${i.pq>0?`дома ${fmtQty(i.k,i.pq,true)} · `:''}для: ${esc(i.dishes.join(', '))}</div></label>
    <button class="iconbtn" data-act="have" data-v="${i.k}" aria-label="Уже есть дома: ${esc(i.name)}" style="font-size:12px">есть</button></div>`;
  return `<div class="screen">
   ${head8('Покупки','Список покупок','<button class="iconbtn" data-act="copy">Копировать</button>')}
   ${S.plan.status==='draft'?`<div class="note"><b>!</b><span>Меню ещё не утверждено: список может измениться после замен. <button class="btn ghost small" style="margin-top:6px" data-act="approve">Утвердить меню</button></span></div>`:''}
   <button class="card pricecard" data-act="tab" data-v="autocart"><span class="row between"><span>Осталось купить: <b>${left.length}</b> ${plural(left.length,'позиция','позиции','позиций')}</span><span class="qty" style="font-size:18px">≈${rub(left.reduce((a,i)=>a+i.cost,0))}</span></span>
    <div class="progress"><i style="width:${need_.length?Math.round((need_.length-left.length)/need_.length*100):100}%"></i></div>
    <span class="row"><b style="color:var(--accent)">Собрать корзину автоматически ›</b><span class="pill warn">Premium</span></span>
    <span class="small muted">Одинаковые продукты из разных блюд объединены. Цены на ${PRICE_DATE} — примерные.</span></button>
   ${cats.map(c=>`<section class="cat"><h3>${c}</h3>${need_.filter(i=>i.cat===c).map(row).join('')}</section>`).join('')}
   ${sh.spices.length?`<section class="cat"><h3>Специи — проверьте, есть ли дома</h3><div class="card small">${esc(sh.spices.join(', '))}<p class="muted">Количество «по вкусу», в список не суммируем.</p></div></section>`:''}
   ${home.length?`<section class="cat"><h3>Уже есть дома</h3>${home.map(i=>`<div class="item done"><span class="grow nm">${esc(i.name)}</span><span class="small muted">${fromList(i.k)?'отмечено «есть»':'хватает запаса'}</span>${fromList(i.k)?`<button class="iconbtn" data-act="have" data-v="${i.k}">вернуть</button>`:''}</div>`).join('')}</section>`:''}
  </div>`;
}
function scrHome8(){return `<div class="screen">${head8('Дома','Что есть дома')}${pantry8(true)}<p class="small muted">Продукты отсюда вычитаются из покупок и учитываются при подборе меню.</p></div>`}
function scrProfile8(){
  const p=P8(),s=S,n=p.members.length;
  return `<div class="screen">
   <div class="card row"><span class="avatar big">${esc(initials())}</span><div class="grow"><b>${esc((p.members[0]&&p.members[0].name)||'Профиль')}</b><br><span class="small muted">${S.user&&S.user.phone?esc(S.user.phone):'Вход через Telegram'}</span></div></div>
   <p class="eyebrow">Настройки</p>
   <div class="card navcard">
    ${navRow8('tab','pFamily',IC.profile,'Семья',`${n} ${plural(n,'человек','человека','человек')} · вес, рост, калории`)}
    ${navRow8('tab','pFood',IC.scale,'Питание и ограничения',`${GOAL8[p.goals[0]||'none']} · ${DIETS[p.diet][0]}${p.allergies.length?` · аллергии: ${p.allergies.length}`:''}`)}
    ${navRow8('tab','pRecipes',IC.pot,'Мои рецепты',s.myRecipes.length?`${s.myRecipes.length} ${plural(s.myRecipes.length,'рецепт','рецепта','рецептов')} — попадают в меню`:'Добавьте свои блюда — они попадут в меню')}
    ${navRow8('tab','pDays',IC.menu,'Дни и приёмы пищи',`${p.days} ${plural(p.days,'день','дня','дней')} · ${Object.entries(SLOT8).filter(([k])=>p.mealSetup[k]!=='none').map(([,l])=>l.toLowerCase()).join(', ')}`)}
   </div>
   <div class="row"><p class="eyebrow grow">Premium</p>${premium8()?'<span class="pill">подключён</span>':''}</div>
   <div class="card navcard ${premium8()?'':'lockcard8'}">
    ${navRow8('tab','autocart',IC.cart,'Автосборка корзины','Из утверждённого меню, под ваш бюджет',!premium8())}
    ${navRow8('tab','promo',IC.tag,'Подборка акций','ВкусВилл и Яндекс Лавка',!premium8())}
    ${navRow8('tab','kcal',IC.chart,'Калории и КБЖУ',KC()?'Включены':'Норма и дневник для каждого',!premium8())}
    ${navRow8('tab','sub',IC.card,'Подписка',premium8()?'Подключена':'299 ₽ в месяц или 1 990 ₽ в год')}
   </div>
   <div class="card"><label class="field" for="theme8">Оформление<select id="theme8" data-act="theme8">${[['system','Как в системе'],['light','Светлое'],['dark','Тёмное']].map(([k,l])=>`<option value="${k}" ${(S.theme||'system')===k?'selected':''}>${l}</option>`).join('')}</select></label></div>
   <button class="btn ghost block" data-act="logout">${IC.logout} Выйти</button>
   <button class="linkbtn" style="align-self:center" data-act="reset">Пройти знакомство заново</button>
   <button class="linkbtn" style="align-self:center" data-act="tab" data-v="metrics">Метрики пилота</button>
  </div>`;
}
function pFamily8(){const k=S.profile.kcalOn; S.profile.kcalOn=true; const h=famFields(); S.profile.kcalOn=k; return `<div class="screen">${head8('Профиль','Семья')}${h}</div>`}
function pFood8(){const p=S.profile;return `<div class="screen">${head8('Профиль','Питание и ограничения')}
  <div class="card"><h3>Цель</h3><div class="chips">${Object.entries(GOAL8).map(([k,l])=>`<button class="chip" data-act="goal8" data-v="${k}" aria-pressed="${k==='none'?!p.goals.length:p.goals[0]===k}">${l}</button>`).join('')}</div></div>
  <div class="card"><h3>Тип питания</h3><div class="chips">${Object.entries(DIETS).map(([k,[l,d]])=>`<button class="chip" data-act="diet" data-v="${k}" aria-pressed="${p.diet===k}" title="${esc(d)}">${l}</button>`).join('')}</div></div>
  ${restr8()}
  <div class="card">${tasteFields()}</div>
  ${S.history.blocked.length?`<div class="card"><h3>Скрытые блюда</h3>${S.history.blocked.filter(id=>RBY[id]).map(id=>`<div class="row between"><span>${esc(RBY[id].n)}</span><button class="iconbtn" data-act="unblock" data-v="${id}">вернуть</button></div>`).join('')}</div>`:''}
  <button class="btn block" data-act="regen">Сохранить и пересобрать меню</button></div>`}
function pDays8(){const p=S.profile;return `<div class="screen">${head8('Профиль','Дни и приёмы пищи')}${details8()}
  <div class="card"><label class="toggle"><span><b>Напоминание накануне</b><br><span class="small muted">Проверить продукты для завтрашнего блюда</span></span><input type="checkbox" class="switch" id="remOn" data-act="remOn" ${p.reminder.on?'checked':''}></label>
  ${p.reminder.on?`<label class="field" for="remT">Время<select id="remT" data-act="remT">${['18:00','19:00','20:00','21:00','22:00'].map(t=>`<option ${t===p.reminder.time?'selected':''}>${t}</option>`).join('')}</select></label>`:''}</div>
  <button class="btn block" data-act="regen" ${Object.values(p.mealSetup).some(v=>v!=='none')?'':'disabled'}>Сохранить и пересобрать меню</button></div>`}
function pRecipes8(){return `<div class="screen">${head8('Профиль','Мои рецепты')}
  <p class="small muted">Ваши рецепты попадают в подбор меню наравне с нашими — с учётом аллергий и ограничений.</p>
  <button class="btn block" data-act="recNew">+ Добавить рецепт</button>
  ${S.myRecipes.length?S.myRecipes.map(r=>`<button class="card recrow" data-act="recEdit" data-v="${r.id}"><div class="row"><div class="thumb">${dishArt(r)}</div><span class="grow"><span class="dish">${esc(r.n)}</span><br><span class="small muted">${MYK8[kindOfMine(r)][0]} · ${r.t} мин · ${r.i.length} ${plural(r.i.length,'продукт','продукта','продуктов')}</span></span><span class="muted">›</span></div></button>`).join('')
   :'<div class="empty"><p>Пока пусто. Добавьте блюдо, которое любят в семье, — и оно появится в меню.</p></div>'}</div>`}
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
   <div class="card"><h3>Что входит в Premium</h3><ul class="plain8">${['Автосборка корзины из утверждённого меню под ваш бюджет','Сравнение цен: где купить дешевле','Подборка акций ВкусВилла и Лавки','Калории и КБЖУ для каждого члена семьи'].map(x=>`<li>${x}</li>`).join('')}</ul></div>
   <div class="stack" style="gap:8px">${[['year','На год','1 990 ₽','≈166 ₽ в месяц — на 45% выгоднее'],['month','На месяц','299 ₽','отмена в любой момент']].map(([k,l,pp,d])=>`<button class="optcard tariff" data-act="tariff" data-v="${k}" aria-pressed="${sel===k}"><span class="row between"><b>${l}</b><b>${pp}</b></span><span class="small muted">${d}</span></button>`).join('')}</div>
   <button class="btn block" data-act="subscribe8">Подключить за ${sel==='year'?'1 990 ₽':'299 ₽'} — оплата по СБП</button>
   <p class="small muted">Прототип: деньги не списываются. Меню и список покупок остаются бесплатными.</p></div>`;
}
function scrSub8(){
  if(!premium8()) return offer8('Premium','Меню и список покупок — бесплатно. Premium экономит время и деньги на покупках.');
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
const SCR8={menu:()=>scrMenu8(false),today:()=>scrMenu8(false),shop:scrShop8,home:scrHome8,profile:scrProfile8,pFamily:pFamily8,pFood:pFood8,pRecipes:pRecipes8,pRecipe:pRecipe8,pDays:pDays8,
  autocart:autocart8,promo:()=>premium8()?scrPromo():offer8('Подборка акций','Каждую неделю — скидки ВкусВилла и Лавки на продукты из вашего меню.'),
  kcal:()=>premium8()?`<div class="screen">${head8('Premium','Калории и КБЖУ')}${kcalToggle()}</div>`:offer8('Калории и КБЖУ','Норма для каждого члена семьи, КБЖУ блюд и дневник «что съели».'),sub:scrSub8,metrics:scrMetrics};
kcalToggle=(function(orig){return function(){const was=V().ul.kcal; V().ul.kcal=V().ul.kcal||'v8'; const h=orig(); if(!was) delete V().ul.kcal; return h}})(kcalToggle);

/* ---------- render ---------- */
render=function(){
  const app=$('#app'); P8(); ensureRecipes(); if(S.tab==='today') S.tab='menu';
  if(UI.fam){app.innerHTML=famView(); renderSheet(); return}
  const st=S.stage,signed=!!FamilyMenuApi.session;
  if(st==='intro'&&!signed) app.innerHTML=intro8();
  else if(st==='quiz') app.innerHTML=quiz8();
  else if(st==='gen') app.innerHTML=loader8();
  else if(st==='ready'&&!signed) app.innerHTML=ready8();
  else if(!signed) app.innerHTML=auth8();
  else app.innerHTML=appbar8()+(SCR8[S.tab]||SCR8.menu)()+tabs8();
  renderSheet(); renderCook(); renderCart(); paintTimers(); clampChips();
};

/* ---------- actions ---------- */
function v8Act(a,v,el){
  const p=S.profile;
  switch(a){
   case 'introNext8': if((S.introIdx||0)<SLIDES8.length-1) S.introIdx=(S.introIdx||0)+1; else {S.stage='quiz'; S.qStep=0; track('intro_done')} window.scrollTo(0,0); return true;
   case 'introSkip8': S.stage='quiz'; S.qStep=0; window.scrollTo(0,0); return true;
   case 'toAuth8': S.stage='auth'; window.scrollTo(0,0); return true;
   case 'backReady8': S.stage='ready'; return true;
   case 'backIntro8': S.stage='intro'; S.introIdx=0; return true;
   case 'qNext8': S.qStep=Math.min(4,(S.qStep||0)+1); window.scrollTo(0,0); return true;
   case 'qBack8': if((S.qStep||0)>0) S.qStep--; else S.stage=S.plan?(FamilyMenuApi.session?'app':'ready'):'intro'; window.scrollTo(0,0); return true;
   case 'build8': track('onboarding_done',{members:p.members.length,days:p.days}); build(); return 'done';
   case 'goal8': S.ans.goal=v; p.goals=v==='none'?[]:[v]; p.members.forEach(m=>{if(m.kind==='adult') m.goal=v==='lose'?'lose':v==='mass'?'gain':'keep'}); return true;
   case 'diet8': S.ans.diet=true; p.diet=v; return true;
   case 'more8': UI.open8=UI.open8||{}; UI.open8[v]=!UI.open8[v]; return true;
   case 'days8': p.days=Math.max(1,Math.min(7,p.days+ +v)); return true;
   case 'cat8': UI.cat8=UI.cat8||{}; UI.cat8[v]=!UI.cat8[v]; return true;
   case 'pt8': togglePantry8(v); return true;
   case 'photoAdd': {const inp=document.createElement('input'); inp.type='file'; inp.accept='image/jpeg,image/png,image/webp'; inp.multiple=true; inp.style.display='none'; inp.onchange=()=>{photoFiles8(inp.files); inp.remove()}; document.body.append(inp); inp.click(); return 'done'}
   case 'photoDel': UI.photos.splice(+v,1); return true;
   case 'scan8': scan8(); return 'done';
   case 'scanSel': UI.scan.on[+v]=!UI.scan.on[+v]; return true;
   case 'scanAlt': {const [i,id]=v.split(':'); UI.scan.pick[+i]=UI.scan.pick[+i]===id?null:id; return true}
   case 'scanCancel': UI.scan=null; return true;
   case 'scanSave': {const sc=UI.scan; let n=0; sc.products.forEach((pr,i)=>{const id=pr.ingredientId?(sc.on[i]?pr.ingredientId:null):sc.pick[i]; if(id&&ING[id]&&!hasP8(id)){S.pantry.push({key:id,qty:defQty8(id)}); n++}});
     UI.scan=null; UI.photos=[]; toast(n?`Добавили в «Дома»: ${n}`:'Новых продуктов не нашли'); return true}
   case 'mday8': UI.mday=+v; return true;
   case 'back8': S.tab=S.tab==='pRecipe'?'pRecipes':'profile'; UI.sheet=null; window.scrollTo(0,0); return true;
   case 'approve8': S.plan.status='approved'; track('menu_approved'); return true;
   case 'subscribe8': {const pl=UI.tariff||'year'; V().sub={plan:pl,since:NOW().toISOString()}; track('subscribed',{plan:pl}); toast('Premium подключён. Прототип: деньги не списаны'); if(S.tab==='sub') S.tab='profile'; return true}
   case 'unsub8': V().sub=null; p.kcalOn=false; track('unsubscribed'); toast('Подписка отменена'); return true;
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
  const r=v8Act(a,v,el);
  if(r){if(r===true){save(); render()} else save(); return}
  if(a==='tab'&&!PAGES8[v]&&!['menu','shop','home','profile'].includes(v)) v='menu';
  return orig(a,v,el);
}})(act);

/* ---------- inputs that should not re-render on every key ---------- */
document.addEventListener('input',e=>{const t=e.target,a=t.dataset&&t.dataset.act; if(!a) return;
  if(a==='search8'){UI.q8=t.value; render(); refocus('pq8')}
  else if(a==='rq8'){UI.rq=t.value; render(); refocus('rq8')}
  else if(a==='rf8'&&UI.edit){const f=t.dataset.v; UI.edit[f]=f==='n'?t.value:+t.value; const b=document.querySelector('[data-act="recSave"]'); if(b) b.disabled=!(UI.edit.n.trim()&&UI.edit.i.length&&UI.edit.s.some(x=>x.trim()))}
  else if(a==='ri8'&&UI.edit){const q=+String(t.value).replace(',','.'); if(q>0) UI.edit.i[+t.dataset.v][1]=q}
  else if(a==='rstep8'&&UI.edit){UI.edit.s[+t.dataset.v]=t.value; const b=document.querySelector('[data-act="recSave"]'); if(b) b.disabled=!(UI.edit.n.trim()&&UI.edit.i.length&&UI.edit.s.some(x=>x.trim()))}
},true);
document.addEventListener('change',e=>{const t=e.target,a=t.dataset&&t.dataset.act; if(!a) return;
  if(a==='kind8'){S.profile.mealSetup[t.dataset.v]=t.value; P8(); save(); render()}
  else if(a==='rk8'||a==='theme8'){act(a,t.value,t)}
  else if(a==='scanSel'){act(a,t.dataset.v,t)}
});
window.addEventListener('resize',()=>clampChips());
try{const th=S.theme; if(th&&th!=='system') document.documentElement.dataset.theme=th}catch(e){}
