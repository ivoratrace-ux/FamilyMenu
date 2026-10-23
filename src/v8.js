/* ============ v8 «Frigo»: v4 look with the v6 flow ============
   splash → 4 feature slides → 5-step getting to know → 2 s loader → first menu → Telegram sign-in
   tabs: Меню · Покупки · Дома · Профиль; per-meal kinds, 1–7 days, main+side pairs, own recipes, Premium as a subscription */

const SLOT8={b:'Завтрак',l:'Обед',s:'Перекус',d:'Ужин'};
const KIND8={breakfast:'Завтрак: каши, яйца, сырники',soup:'Суп',pair:'Второе с гарниром',dish:'Целое блюдо',salad:'Салат',dessert:'Десерт',drink:'Напиток',snack:'Перекус',none:'Не нужен'};
const KOPT8={b:['breakfast','drink'],l:['salad','soup','pair','drink','dessert'],s:['snack','salad','dessert','drink'],d:['salad','pair','soup','drink','dessert']};
const KSHORT8={breakfast:'Завтрак',soup:'Суп',pair:'Второе с гарниром',dish:'Целое блюдо',salad:'Салат',drink:'Напиток',dessert:'Десерт',snack:'Перекус'};
const KTAG8={soup:'суп',pair:'второе',dish:'блюдо',salad:'салат',drink:'напиток',dessert:'десерт',snack:'перекус',breakfast:''};
/* Snacks, desserts and drinks open with the subscription. */
const kopt8=k=>KOPT8[k];
const MYK8={breakfast:['Завтрак','b'],soup:['Суп','m'],main:['Основное: мясо, рыба','p'],side:['Гарнир','g'],dish:['Целое блюдо','m'],salad:['Салат','m'],dessert:['Десерт','z'],drink:['Напиток','k'],snack:['Перекус','s']};
const GOAL8={lose:'Похудение',mass:'Набор массы',pp:'Правильное питание',protein:'Больше белка',lowcarb:'Меньше углеводов',none:'Просто вкусно и разнообразно'};
const PAGES8={pNotify:'Уведомления',rec8:'Рецепт',diary:'Дневник',pBudget:'Бюджет и цены',pFamily:'Семья',pFood:'Питание и ограничения',pRecipes:'Мои рецепты',pRecipe:'Рецепт',pDays:'Дни и приёмы пищи',promo:'Подборка акций',kcal:'Калории и КБЖУ',sub:'Premium',metrics:'Метрики пилота'};
const trialOn8=()=>!!V().trialStart&&!subscribed()&&dayN()<7;
const premium8=()=>subscribed()||trialOn8();
const premiumNote8=()=>subscribed()?'Подписка подключена':trialOn8()?`Открыто бесплатно ещё ${daysW(7-dayN())}`:V().trialStart?'Пробные 7 дней закончились':'Откроется на 7 дней с первым меню';

/* ---------- profile defaults & compatibility with the stored model ---------- */
function P8(){
  const p=S.profile;
  if(!p.mealSetup) p.mealSetup={b:p.meals&&p.meals.b?'breakfast':'none',l:p.meals&&p.meals.l===false?'none':'soup',s:'none',d:p.meals&&p.meals.d===false?'none':'pair'};
  // Since v8.4 every meal holds a list of kinds (several dishes per meal).
  for(const k of ['b','l','s','d']){const v=p.mealSetup[k]; if(!Array.isArray(v)) p.mealSetup[k]=!v||v==='none'?[]:[v]; p.mealSetup[k]=[...new Set(p.mealSetup[k].map(x=>x==='dish'?'pair':x))].filter(x=>KOPT8[k].includes(x))}
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
/* v8.11: a person's own version of a dish — products crossed out or added; calories, proteins, fats and carbs are recalculated. */
function ensureBase8(id){
  if(RBY[id]) return RBY[id]; const m=/^c_(.+)_(g\d+)$/.exec(id); if(m&&RBY[m[1]]&&RBY[m[2]]) return comboOf(RBY[m[1]],RBY[m[2]]);
  if(id.startsWith('h8~')){const [,p,b,sa,v]=id.split('~'); return homeRecipe8(p,b,sa||null,v||null)} return null;
}
function variant8(baseId,list){
  const base=ensureBase8(baseId); if(!base||!list.length||list.some(([k])=>!ING[k])) return null;
  let h=0; for(const c of list.map(([k,q])=>k+':'+q).join(',')) h=(h*31+c.charCodeAt(0))|0;
  const id='v8~'+baseId+'~'+(h>>>0).toString(36); S.var8=S.var8||{}; S.var8[id]={b:baseId,i:list.map(x=>[...x])};
  if(!RBY[id]){const r={...base,id,i:list.map(x=>[...x]),tags:[...(base.tags||[]).filter(t=>t!=='quick'),'var8'],base8:baseId}; deriveRecipe(r); RBY[id]=r; R.push(r)}
  return RBY[id];
}
function ensureRecipes(){
  homeFromPlan8();
  (S.myRecipes||[]).forEach(registerMine);
  if(S.plan) S.plan.days.forEach(d=>Object.keys(d.slots).forEach(nameSlot8));
  if(S.plan) S.plan.days.forEach(d=>Object.values(d.slots).forEach(s=>{
    const m=s&&s.rid&&!RBY[s.rid]&&/^c_(.+)_(g\d+)$/.exec(s.rid); if(m&&RBY[m[1]]&&RBY[m[2]]) comboOf(RBY[m[1]],RBY[m[2]]);
  }));
  if(S.plan) S.plan.days.forEach(d=>Object.values(d.slots).forEach(s=>{if(s&&s.rid&&!RBY[s.rid]&&String(s.rid).startsWith('v8~')&&S.var8&&S.var8[s.rid]) variant8(S.var8[s.rid].b,S.var8[s.rid].i)}));
}
const artOrig8=window.dishArt;
window.dishArt=function(r){
  if(r&&!r.art&&!r.imageUrl) return `<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(r.n)}" preserveAspectRatio="xMidYMid slice"><rect width="400" height="260" fill="#e2eee6"/><circle cx="200" cy="130" r="78" fill="#fff"/><text x="200" y="152" text-anchor="middle" font-family="Literata,Georgia,serif" font-size="64" fill="#2c6a4c">${esc((r.n||'?')[0].toUpperCase())}</text></svg>`;
  return artOrig8(r);
};
const isSalad8=r=>(r.tags||[]).includes('salad')||/^(Салат|Винегрет|Табуле)/.test(r.n||'');
function pool8(kind){
  const all=R.filter(r=>r.m!=='c'&&!r.base8&&allowed(r));
  switch(kind){
   case 'breakfast': return all.filter(r=>r.m==='b');
   case 'soup': return all.filter(r=>r.m==='m'&&isSoup(r));
   case 'dish': return all.filter(r=>r.m==='m'&&!isSoup(r)&&!isSalad8(r));
   case 'salad': return all.filter(r=>r.m==='m'&&isSalad8(r));
   case 'pair': return all.filter(r=>r.m==='p'||(r.m==='m'&&!isSoup(r)&&!isSalad8(r)));
   case 'pairmain': return all.filter(r=>r.m==='p');
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
  if(kind==='pair') return pool8('pair').map(m=>{if(m.m!=='p') return m;const sides=pool8('side'),home=S.pantry.length?sides.filter(x=>hits8(x)).sort((a,b)=>missing8(a)-missing8(b))[0]:null,pref=home||sides.find(x=>(m.tags||[]).includes('pair:'+x.id))||sides[0];return pref?comboOf(m,pref):m});
  return pool8(kind);
}})(poolFor);
/* Budget shapes the dishes: a small budget prefers cheaper recipes, a large one — salmon, beef, shrimp and other pricier dishes. */
function budgetLevel8(){const p=S.profile,per=p.budget/Math.max(1,p.members.length);return Math.max(-2.5,Math.min(3,(per-3500)/1500))}
const AVG8={};
function costZ8(r){const m=r.m==='c'?'p':r.m; if(AVG8[m]==null){const list=R.filter(x=>x.m===m);AVG8[m]=list.length?list.reduce((a,x)=>a+rc(x),0)/list.length:1} return Math.max(-1,Math.min(2,(rc(r)-AVG8[m])/Math.max(1,AVG8[m])))}
score=(function(orig){return function(r,ctx){return orig(r,ctx)+budgetLevel8()*costZ8(r)*2}})(score);
/* v8.7: what is already at home comes first. Every product at home in a recipe adds a lot; every product to buy subtracts.
   Oil, sugar and salt do not count as purchases. */
const STAPLE8=new Set(['oil','sugar','salt','water']);
const inPantry8=k=>S.pantry.some(x=>x.key===k&&(+x.qty||0)>0);
function missing8(r){return r?r.i.filter(([k])=>!STAPLE8.has(k)&&!inPantry8(k)).length:0}
function hits8(r){return r?r.i.filter(([k])=>!STAPLE8.has(k)&&inPantry8(k)).length:0}
const buyTag8=(r,short)=>{if(!r) return ''; const m=missing8(r); if(short&&!m) return ''; return short?`<span class="buy8 ${m?'':'ok'}" title="${m?`Докупить ${m} ${plural(m,'продукт','продукта','продуктов')}`:'Всё есть дома'}">${m?`🛒 +${m}`:'✓ дома'}</span>`:`<span class="buy8 ${m?'':'ok'}">${m?`докупить +${m}`:'всё есть дома'}</span>`};
score=(function(orig){return function(r,ctx){const s=orig(r,ctx); if(!S.pantry.length) return s; const h=hits8(r),m=missing8(r); return s+h*4-m*1.5+(h&&!m?5:0)}})(score);
/* Draw among suitable dishes, with a soft penalty for the two previous menus. */
function variedPick8(list,value){
  const ranked=list.map(r=>({r,v:value(r)})).sort((a,b)=>b.v-a.v),best=ranked[0]?.v;
  const choices=ranked.filter(x=>x.v>=best-10).slice(0,16),weights=choices.map(x=>Math.exp((x.v-best)/4));
  let draw=Math.random()*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<choices.length;i++){draw-=weights[i];if(draw<=0)return choices[i].r}
  return choices.at(-1)?.r;
}
function recentPenalty8(r){const id=baseKey8(r.id);return (S.menuRecent8||[]).reduce((sum,menu,i)=>sum+(menu.includes(id)?(i===0?7:3):0),0)}
pick=function(slot,used,weekend,ctx){
  const p=S.profile;ctx={slot,...ctx};let list=poolFor(slot);if(!list.length)return null;
  const max=p.maxTime?(weekend?p.maxTime+30:p.maxTime):Infinity,timed=list.filter(r=>r.t<=max);if(timed.length)list=timed;
  const count=r=>(used.cnt||{})[baseKey8(r.id)]||0,min=Math.min(...list.map(count));
  list=list.filter(r=>count(r)===min);
  const r=variedPick8(list,r=>score(r,ctx)-recentPenalty8(r));
  used.cnt=used.cnt||{};const key=baseKey8(r.id);used.cnt[key]=(used.cnt[key]||0)+1;return r;
};
altList=(function(orig){return function(day,slot,reason){buildHome8();
  return orig(day,slot,reason).map((r,i)=>({r,i,m:missing8(r)})).sort((a,b)=>a.m-b.m||a.i-b.i).map(x=>x.r);
}})(altList);
const kindLabel8=k=>{const kind=kindOfKey8(k),l=KSHORT8[kind]||SLOT_NAMES[k]||'';return l.toLowerCase()===(SLOT8[baseOf8(k)]||'').toLowerCase()?'':l};
slotRow=(function(orig){return function(di,sk,compact){let h=orig(di,sk,compact),r=slotRecipe(di,sk); h=h.replace(`<span class="small muted">${SLOT_NAMES[sk]}</span>`,kindLabel8(sk)?`<span class="small muted">${esc(kindLabel8(sk))}</span>`:''); return r?h.replace('<span class="meta">','<span class="meta meta8">'+buyTag8(r,true)+partTag8(S.plan.days[di],sk)).replace(/<span>\d+ ккал<\/span>/,`<span>${Math.round(r.kcal*S.plan.days[di].slots[sk].serv/portions())} ккал в среднем</span>`).replace(/<span>\d+ (?:порция|порции|порций)<\/span>/,''):h}})(slotRow);
sheetReplace=(function(orig){return function(o){let h=orig(o);
  // v8.11: «второе с гарниром» — keep the main, pick any other side (pasta, buckwheat, rice…)
  const cur=slotRecipe(o.day,o.slot),mm=cur&&/^c_(.+)_(g\d+)$/.exec(cur.id);
  if(mm&&RBY[mm[1]]){const sides=pool8('side').sort((a,b)=>missing8(a)-missing8(b));
    h=h.replace(/(<\/h2>)/,`$1<div class="card"><h3>Другой гарнир к «${esc(RBY[mm[1]].n)}»</h3><div class="chips">${sides.map(x=>`<button class="chip" data-act="side8" data-v="${x.id}" aria-pressed="${x.id===mm[2]}">${esc(x.n)}${missing8(x)?'':' ✓'}</button>`).join('')}</div></div>`)} for(const r of altList(o.day,o.slot,o.reason||'none')) h=h.replace(new RegExp(`(data-act="altOpen" data-v="${r.id}"[\\s\\S]*?<span class="meta">)`),'$1'+buyTag8(r)); return h}})(sheetReplace);
/* v8.9: dishes composed from what is at home — protein + grain + sauce (+ one vegetable).
   Calories, proteins, fats and carbs come from the products' nutrition per 100 g (open food composition tables, as for every recipe). */
const HP8={fish_white:['Минтай','fish','fish',600],cod:['Треска','fish','fish',600],hake:['Хек','fish','fish',600],salmon:['Сёмга','salmon','fish',600],pink_salmon:['Горбуша','salmon','fish',600],
 trout:['Форель','salmon','fish',600],mackerel:['Скумбрия','fish','fish',600],chicken_fillet:['Курица','chicken','poultry',600],chicken_thigh:['Куриные бёдра','chicken','poultry',700],
 chicken_drum:['Куриные голени','chicken','poultry',900],turkey:['Индейка','turkey','poultry',600],beef:['Говядина','beef','meat',600],pork:['Свинина','chop','meat',600],pork_loin:['Свиная вырезка','chop','meat',600],
 shrimp:['Креветки','shrimp','sea',400],squid:['Кальмары','squid','sea',500],tofu:['Тофу','tofu','tofu',400],tuna:['Тунец','tuna','canned',2],eggs:['Яйца','egg_bits','egg',8]};
const HB8={rice:['с рисом','rice',300],basmati:['с рисом басмати','rice',300],rice_round:['с рисом','rice',300],buckwheat:['с гречкой','buckwheat',300],pasta:['с макаронами','pasta',350],
 spaghetti:['со спагетти','pasta',350],orzo:['с орзо','pasta',300],couscous:['с кус-кусом','bulgur',300],bulgur:['с булгуром','bulgur',300],quinoa:['с киноа','quinoa',300],potato:['с картофелем','potato',1000],
 noodles:['с лапшой','noodles',300],rice_noodles:['с рисовой лапшой','noodles',250],soba:['с гречневой лапшой','noodles',250],egg_noodles:['с яичной лапшой','noodles',300]};
const HS8={soy_sauce:['в соевом соусе','sesame',50],sour_cream:['в сметанном соусе','sauce_cream',200],cream:['в сливочном соусе','sauce_cream',200],cream33:['в сливочном соусе','sauce_cream',150],
 canned_tomatoes:['в томатном соусе','sauce_red',1],tomato_paste:['в томатном соусе','sauce_red',60],coconut_milk:['в кокосовом соусе','curry',1]};
const HV8={onion:150,carrot:200,bell_pepper:200,zucchini:300,broccoli:300,mushrooms:300,green_peas:200,spinach:150,mixed_veg:300,beans_green:300,cauliflower:300,spinach_frozen:200,corn_frozen:200};
const NOMC8={rice:'Рис',basmati:'Рис басмати',rice_round:'Рис',buckwheat:'Гречка',pasta:'Макароны',spaghetti:'Спагетти',orzo:'Орзо',couscous:'Кус-кус',bulgur:'Булгур',quinoa:'Киноа',potato:'Картофель',noodles:'Лапша',rice_noodles:'Рисовая лапша',soba:'Гречневая лапша',egg_noodles:'Яичная лапша'};
const NOM8={rice:'рис',basmati:'рис',rice_round:'рис',buckwheat:'гречку',pasta:'макароны',spaghetti:'спагетти',orzo:'орзо',couscous:'кус-кус',bulgur:'булгур',quinoa:'киноа',potato:'картофель',noodles:'лапшу',rice_noodles:'лапшу',soba:'лапшу',egg_noodles:'лапшу'};
function homeRecipe8(pk,bk,sk,vk){
  const id=['h8',pk,bk,sk||'',vk||''].join('~'); if(RBY[id]) return RBY[id];
  const P=HP8[pk],B=HB8[bk],Sx=sk?HS8[sk]:null; if(!P||!B||!ING[pk]||!ING[bk]||(sk&&(!Sx||!ING[sk]))||(vk&&!ING[vk])) return null;
  const i=[[pk,P[3]],[bk,B[2]]]; if(Sx) i.push([sk,Sx[2]]); if(vk) i.push([vk,HV8[vk]]); i.push(['oil',30]);
  const base=NOM8[bk],veg=vk?ING[vk][0].toLowerCase().replace(/\s*\(.*\)/,''):'';
  const cookB=bk==='couscous'?'Залейте кус-кус кипятком с солью и накройте на 5 минут.':bk==='potato'?'Нарежьте картофель дольками и отварите в подсоленной воде 15–20 минут.':
    ['pasta','spaghetti','orzo','noodles','rice_noodles','soba','egg_noodles'].includes(bk)?`Отварите ${base} в подсоленной воде по времени на упаковке.`:`Промойте ${base} и отварите в подсоленной воде 15–18 минут.`;
  const cookP={fish:`Нарежьте рыбу порционно, посолите и обжарьте на масле по 3–4 минуты с каждой стороны.`,poultry:`Нарежьте ${P[0].toLowerCase()} кусочками и обжарьте на масле 8–10 минут, до готовности.`,
    meat:`Нарежьте мясо тонкими полосками и обжарьте на сильном огне 7–8 минут.`,sea:`Обжарьте ${P[0].toLowerCase()} на масле 2–3 минуты — дольше не нужно, иначе станут жёсткими.`,tofu:'Нарежьте тофу кубиками и обжарьте до золотистой корочки, 5–6 минут.',canned:'Слейте жидкость с тунца, разберите его вилкой и прогрейте на сковороде 1–2 минуты.',egg:'Взбейте яйца с щепоткой соли и обжарьте на масле, помешивая, 2–3 минуты.'}[P[2]];
  const cookS=!sk?'':sk==='soy_sauce'?'Влейте соевый соус с 3 ложками воды и прогрейте 1–2 минуты, чтобы всё пропиталось.':['canned_tomatoes','tomato_paste'].includes(sk)?'Добавьте томаты (пасту разведите стаканом воды) и тушите 7–10 минут.':sk==='coconut_milk'?'Влейте кокосовое молоко и потушите 5 минут.':'Добавьте сметану или сливки с половиной стакана воды и потушите 5 минут на слабом огне.';
  const steps=[cookB,...(vk?[`Нарежьте ${veg} и обжарьте на масле 5 минут.`]:[]),cookP,...(cookS?[cookS]:[]),`Разложите ${base} по тарелкам, сверху — ${P[0].toLowerCase()}${sk?' с соусом':''}.`];
  const r={id,n:(pk==='eggs'?`${NOMC8[bk]} с яйцом`:`${P[0]} ${B[0]}`)+`${vk?` и ${veg}`:''}${Sx?' '+Sx[0]:''}`,m:'m',t:bk==='potato'||P[2]==='meat'?35:25,tags:['home8','quick'],i,sp:['соль','чёрный перец'],s:steps,art:`plate:${[P[1],B[1],Sx?Sx[1]:'greens'].join(',')}`};
  deriveRecipe(r); RBY[id]=r; R.push(r); return r;
}
function homeFromPlan8(){if(S.plan) S.plan.days.forEach(d=>Object.values(d.slots).forEach(s=>{if(s&&s.rid&&!RBY[s.rid]&&s.rid.startsWith('h8~')){const [,p,b,sa,v]=s.rid.split('~'); homeRecipe8(p,b,sa||null,v||null)}}))}
/* All protein × grain pairs from «Дома», each with a sauce and a vegetable from «Дома» when there are any. */
function buildHome8(){
  const ps=Object.keys(HP8).filter(inPantry8),bs=Object.keys(HB8).filter(inPantry8),ss=Object.keys(HS8).filter(inPantry8),vs=Object.keys(HV8).filter(k=>inPantry8(k)&&k!=='onion');
  const out=[]; ps.forEach((p,pi)=>bs.forEach((b,bi)=>{const r=homeRecipe8(p,b,ss.length?ss[(pi+bi)%ss.length]:null,vs.length?vs[(pi+bi)%vs.length]:null); if(r) out.push(r)})); return out.slice(0,16);
}
const pantrySig8=()=>S.pantry.filter(x=>(+x.qty||0)>0).map(x=>x.key).sort().join(',');
function homeFit8(){
  if(!S.plan) return 0; buildHome8();
  const ti=Math.max(0,todayIdx()),used={}; let n=0;
  S.plan.days.forEach(d=>Object.values(d.slots).forEach(s=>{if(s&&s.rid) used[s.rid]=(used[s.rid]||0)+1}));
  S.plan.days.forEach((d,di)=>{if(di<ti) return;
    for(const k of Object.keys(d.slots)){
      const s=d.slots[k]; if(!s||s.left||s.cooked||S.eaten[eatKey(di,k)]) continue;
      const cur=s.rid?RBY[s.rid]:null,kind=kindOfKey8(k); if(!KOPT8.b.concat(KOPT8.l,KOPT8.s,KOPT8.d).includes(kind)) continue;
      const taken=new Set(Object.values(d.slots).map(x=>x.rid)),room=KCAL_TARGET8-dayKcal8(d)+(cur?cur.kcal:0);
      const pool=(kind==='pair'?poolFor('l_pair'):pool8(kind)).filter(r=>!taken.has(r.id)&&fresh8(r,cur)&&hits8(r)>0&&r.kcal<=room);
      if(!pool.length) continue;
      const best=pool.map(r=>({r,v:score(r,{})-(used[r.id]||0)*4})).sort((a,b)=>b.v-a.v)[0].r;
      if(missing8(best)<(cur?missing8(cur):99)){if(cur) used[cur.id]--; used[best.id]=(used[best.id]||0)+1; s.rid=best.id; n++}
    }});
  if(n)S.plan.days.slice(ti).forEach(balanceDay8);
  return n;
}
const buyLine8=r=>{const miss=r.i.filter(([k])=>!STAPLE8.has(k)&&!inPantry8(k)).map(([k])=>ING[k][0]);
  return `<p class="small buyline8">${miss.length?`<b>Докупить +${miss.length}</b> · ${esc(miss.join(', '))}`:'<b>Всё есть дома</b> — докупать ничего не нужно'}</p>`};
function sideFor(main){const sides=pool8('side'); if(!sides.length) return null;
  // v8.8: a side made of what is at home wins (rice at home → fish with rice, not mash that needs milk and butter)
  const home=sides.filter(r=>hits8(r)>0);return variedPick8(home.length?home:sides,r=>hits8(r)*3-missing8(r)+((main.tags||[]).includes('pair:'+r.id)?2:0)-recentPenalty8(r));}


/* v8.8: shops sell packs. The list buys whole packs (the price counts the whole pack); what is left after cooking goes to «Дома». */
const PACK8={chicken_fillet:500,chicken_thigh:700,chicken_liver:500,beef:400,pork:500,minced_mix:400,minced_turkey:400,turkey:500,fish_white:400,cod:400,salmon:250,shrimp:300,squid:500,
 milk:1000,kefir:900,yogurt:400,sour_cream:300,cheese:200,feta:200,cottage:300,butter:180,cream:500,tofu:300,broccoli:400,green_peas:400,spinach:250,lettuce:150,mushrooms:400,berries:300,cranberries:300,
 rice:900,buckwheat:900,bulgur:500,millet:800,quinoa:400,pasta:450,noodles:400,oats:500,flour:1000,lentils:450,tomato_paste:140,sugar:1000,honey:300,oil:1000,soy_sauce:250,mustard:150,sesame:100,walnuts:150,
 peanut_butter:300,semolina:800,barley:800,peas_dry:800,pickles:500,cocoa:100,raisins:200,
 orzo:400,pasteroni:400,couscous:400,spaghetti:450,penne:450,farfalle:400,lasagna:500,egg_noodles:250,rice_noodles:200,soba:250,basmati:900,rice_round:900,rice_brown:500,wheat_groats:800,corn_grits:700,
 muesli:400,corn_flakes:300,lentils_green:450,beans_dry:450,chickpeas_dry:450,olives:300,olive_oil:500,mayo:400,ketchup:350,vinegar:500,breadcrumbs:200,starch:400,baking_powder:10,cookies:300,chocolate:90,jam:350,
 almonds:150,hazelnuts:150,cashew:150,sunflower_seeds:150,pumpkin_seeds:150,dried_apricots:200,prunes:200,dates:250,puff_pastry:500,pineapple_canned:580,corn_frozen:400,beans_green:400,mixed_veg:400,
 spinach_frozen:400,cauli_frozen:400,arugula:125,cherry:250,ginger:100,brussels:400,sauerkraut:500,oyster_mush:300,forest_mush:400,tomatoes_pickled:680,grapes:500,strawberry:300,cherry_frozen:300,plum:500,
 chicken_drum:800,chicken_wings:800,minced_chicken:400,minced_beef:400,beef_liver:500,lamb:500,pork_loin:500,bacon:150,ham:300,sausages:400,boiled_sausage:400,hake:400,pink_salmon:500,trout:250,mackerel:400,
 herring:300,mussels:500,crab_sticks:200,mozzarella:125,parmesan:150,suluguni:300,adyghe:300,cream_cheese:140,ricotta:250,cream33:200,ryazhenka:500,greek_yogurt:400,cottage9:300,cottage_grain:300,
 condensed_milk:380,oat_milk:1000,crispbread:150,fig_jam:350,berry_jam:350};
shopping=(function(orig){return function(){
  const sh=orig(); let cost=0;
  sh.items.forEach(i=>{const pk=PACK8[i.k];
    if(pk&&!i.covered&&i.toBuy>0&&['g','ml'].includes(ING[i.k][2])){const n=Math.ceil(i.toBuy/pk-1e-6),b=n*pk; i.packs=n; i.pack=pk; i.left=b-i.toBuy; i.toBuy=b; i.cost=b*price(i.k)}
    if(!i.covered) cost+=i.cost});
  sh.cost=cost; return sh;
}})(shopping);
/* ---------- menu generation: chosen kinds, 1–7 days (the stored menu keeps 7 days) ---------- */
generate=function(){
  const p=P8(),start=day0(NOW()),used={},por=cookingScale(),days=[]; let prev=null; S.parts8={};
  for(let d=0;d<7;d++){
    const date=addDays(start,d),wd=date.getDay(),weekend=wd===0||wd===6,slots={};
    if(d<p.days) for(const k of ['b','l','s','d']) for(const kind of KOPT8[k].filter(x=>p.mealSetup[k].includes(x))){
      if(p.noRepeat8) used.cnt=Object.assign(used.cnt||{},Object.fromEntries([...days.flatMap(x=>Object.values(x.slots)),...Object.values(slots)].filter(x=>x.rid).map(x=>[baseKey8(x.rid),99])));
      // «Второе с гарниром»: a main with a side on even days, any second course (whole dishes, dishes from «Дома») on odd ones; with meat or fish at home — whatever fits best
      const pk=kind==='pair'&&d%2===0&&!Object.keys(HP8).some(inPantry8)?'pairmain':kind;
      let r=pick('k:'+pk,used,weekend,k==='d'?{prevProtein:prev}:{});
      if(r&&kind==='pair'&&r.m==='p'){const side=sideFor(r); if(side) r=comboOf(r,side)}
      const key=k+'_'+kind; nameSlot8(key); slots[key]={rid:r&&r.id,serv:por}; if(k==='d'&&r&&['pair','dish'].includes(kind)) prev=r.protein;
    }
    days.push({date:date.toISOString(),slots});
    if(d<p.days) topUp8(days[d],used,weekend);
  }
  S.plan={created:NOW().toISOString(),status:'draft',days}; S.bought={}; S.eaten={}; S.extra={}; S.parts8={};
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
  let pool=kind==='pair'?poolFor('l_pair'):pool8(kind); pool=pool.filter(r=>!taken.has(r.id)&&fresh8(r,cur)&&better(r,cur));
  if(!pool.length) return false; pool.sort((a,b)=>score(b,{})-score(a,{})); day.slots[key].rid=pool[0].id; return true;
}
const rcp8=r=>r.i.reduce((s,[k,q])=>s+(inPantry8(k)?0:q*price(k)),0)/4;
/* v8.11: «Без повторений» — a dish (a main with any side counts as the same dish) appears once in the menu. */
const baseKey8=id=>{id=String(id||''); const m=/^c_(.+)_((?:g)\d+)$/.exec(id); if(m) return m[1]; if(id.startsWith('v8~')) return id.split('~')[1]; return id};
function usedKeys8(){const u=new Set(); if(S.plan) S.plan.days.forEach(d=>Object.values(d.slots).forEach(s=>{if(s&&s.rid) u.add(baseKey8(s.rid))})); return u}
const fresh8=(r,cur)=>!S.profile.noRepeat8||baseKey8(r.id)===baseKey8(cur&&cur.id)||!usedKeys8().has(baseKey8(r.id));
/* Preserve nutrition while reducing cost: compare the price of equivalent calories,
   then check whole-pack shopping costs before accepting a replacement. */
function balanceDay8(day){
  const all=Object.keys(day.slots).filter(k=>RBY[day.slots[k]?.rid]);
  const keys=all.filter(k=>!day.slots[k].cooked&&!S.eaten[eatKey(S.plan.days.indexOf(day),k)]);
  if(!keys.length)return;
  const fixed=all.filter(k=>!keys.includes(k)).reduce((sum,k)=>sum+RBY[day.slots[k].rid].kcal*partOf8(day,k),0);
  const desired=Math.max(0,KCAL_TARGET8-fixed);
  // Bisection distributes the remaining calories, with reasonable per-dish bounds.
  let lo=0,hi=12;
  for(let i=0;i<32;i++){const mid=(lo+hi)/2,total=keys.reduce((sum,k)=>sum+RBY[day.slots[k].rid].kcal*Math.max(.25,Math.min(2.5,partOf8(day,k)*mid)),0);if(total>desired)hi=mid;else lo=mid}
  const factor=lo,values=keys.map(k=>[k,Math.max(.25,Math.min(2.5,partOf8(day,k)*factor))]);
  values.forEach(([k,value])=>setPart8(day,k,value));
}
function fit8(){
  const days=S.plan.days.filter(d=>Object.keys(d.slots).length),limit=budgetLimit8();
  days.forEach(balanceDay8);
  for(let n=0;n<45&&shopping().cost>limit+1;n++){
    const options=[];
    for(const day of days)for(const key of Object.keys(day.slots)){
      const slot=day.slots[key],cur=RBY[slot.rid];if(!cur||slot.cooked||S.eaten[eatKey(S.plan.days.indexOf(day),key)])continue;
      const kind=kindOfKey8(key),taken=new Set(Object.values(day.slots).map(x=>baseKey8(x.rid)));
      const pool=kind==='pair'?poolFor('l_pair'):pool8(kind);
      for(const r of pool){
        if(r.kcal<=0||taken.has(baseKey8(r.id))||!fresh8(r,cur))continue;
        const saving=(rcp8(cur)/cur.kcal-rcp8(r)/r.kcal)*cur.kcal*partOf8(day,key)*cookingScale();
        if(saving>1)options.push({day,key,r,saving});
      }
    }
    options.sort((a,b)=>b.saving-a.saving);let changed=false;
    const before=shopping().cost;
    for(const option of options.slice(0,16)){
      const {day,key,r}=option,slots=structuredClone(day.slots),parts={...S.parts8};
      day.slots[key].rid=r.id;balanceDay8(day);
      if(shopping().cost<before-.01&&Math.abs(dayKcal8(day)-KCAL_TARGET8)<=KCAL_TARGET8*.05){changed=true;break}
      day.slots=slots;S.parts8=parts;
    }
    // Optional automatically added snacks may be removed only if the remaining
    // dishes can supply the same energy and the actual shopping basket gets cheaper.
    if(!changed)for(const day of days){
      for(const key of Object.keys(day.slots).filter(k=>day.slots[k].auto&&!day.slots[k].cooked&&!S.eaten[eatKey(S.plan.days.indexOf(day),k)])){
        const slots=structuredClone(day.slots),parts={...S.parts8};delete day.slots[key];delete S.parts8[partKey8(day,key)];balanceDay8(day);
        if(shopping().cost<before-.01&&Math.abs(dayKcal8(day)-KCAL_TARGET8)<=KCAL_TARGET8*.05){changed=true;break}
        day.slots=slots;S.parts8=parts;
      }
      if(changed)break;
    }
    if(!changed)break;
  }
  // Final lower/upper bounds are checked after every budget substitution.
  days.forEach(balanceDay8);
}
/* Standard-day energy is scaled by each member’s exact need / 2 200. */
const KCAL_TARGET8=2200;
/* Per-dish portions are persisted alongside the menu and used in both calories and shopping. */
const partKey8=(day,k)=>String(day.date).slice(0,10)+':'+k;
const partOf8=(day,k)=>(S.parts8||{})[partKey8(day,k)]||1;
function setPart8(day,k,v){S.parts8=S.parts8||{};v=Math.max(.01,Math.min(2.5,v));if(Math.abs(v-1)<1e-8)delete S.parts8[partKey8(day,k)];else S.parts8[partKey8(day,k)]=v;day.slots[k].serv=Math.round(Math.min(100,cookingScale()*v)*10000)/10000}
const partTag8=()=>`<span class="pill grey">${portions()} ${plural(portions(),'порция','порции','порций')}</span>`;
function dayKcal8(day){return Object.entries(day.slots).reduce((a,[k,s])=>a+((s&&s.rid&&RBY[s.rid])?RBY[s.rid].kcal*partOf8(day,k):0),0)}
dayKcal=function(di){const d=S.plan.days[di];return Object.keys(d.slots).reduce((s,k)=>{const r=slotRecipe(di,k);return s+(r?r.kcal*partOf8(d,k):0)},0)};
eatenKcal=function(di){const d=S.plan.days[di];return Object.keys(d.slots).reduce((s,k)=>{const r=slotRecipe(di,k);return s+(r&&S.eaten[eatKey(di,k)]?r.kcal*partOf8(d,k):0)},0)};
/* Meals with two or more dishes (drinks aside) get smaller portions, step by step: ¾, then ½. */
function shrink8(day){
  const groups={}; Object.keys(day.slots).forEach(k=>{const s=day.slots[k]; if(!s||!s.rid||s.auto||kindOfKey8(k)==='drink') return; (groups[baseOf8(k)]=groups[baseOf8(k)]||[]).push(k)});
  const ks=Object.values(groups).filter(g=>g.length>1).flat().filter(k=>partOf8(day,k)>.5); if(!ks.length) return false;
  ks.forEach(k=>setPart8(day,k,partOf8(day,k)>.75?.75:.5)); return true;
}
function topUp8(day,used,weekend){
  const por=cookingScale();
  for(let n=1;n<=2&&dayKcal8(day)<KCAL_TARGET8-200;n++){
    const gap=KCAL_TARGET8-dayKcal8(day),taken=new Set(Object.values(day.slots).map(s=>s.rid));
    const list=pool8('snack').filter(r=>!taken.has(r.id)&&(!S.profile.noRepeat8||!(used.cnt||{})[baseKey8(r.id)])&&r.kcal<=KCAL_TARGET8-dayKcal8(day)).map(r=>({r,s:-Math.abs(r.kcal-gap)/100+score(r,{})*.3-recentPenalty8(r)+Math.random()*4})).sort((a,b)=>b.s-a.s);
    if(!list.length) break; let key='s_snack';for(let i=2;day.slots[key];i++)key='s_snack'+i; SLOT_NAMES[key]='Перекус'; day.slots[key]={rid:list[0].r.id,serv:por,auto:true};used.cnt=used.cnt||{};const id=baseKey8(list[0].r.id);used.cnt[id]=(used.cnt[id]||0)+1;
  }
}
const generateOnce8=generate;
generate=function(){
  buildHome8(); S.hfSig8=pantrySig8();
  const old=S.plan?.days.flatMap(d=>Object.values(d.slots).filter(s=>s.rid).map(s=>baseKey8(s.rid)))||[];
  if(old.length)S.menuRecent8=[old,...(S.menuRecent8||[])].slice(0,2);
  const p=P8(),limit=p.budget*p.days/7;let best=null;
  for(let i=0;i<4;i++){
    generateOnce8();const cost=shopping().cost,deficit=S.plan.days.filter(d=>Object.keys(d.slots).length).reduce((sum,d)=>sum+Math.abs(dayKcal8(d)-KCAL_TARGET8),0);
    const quality=Math.max(0,cost-limit)*10+deficit;
    if(!best||quality<best.quality)best={plan:structuredClone(S.plan),parts:{...S.parts8},cost,quality};
    if(cost<=limit+1&&deficit<1)break;
  }
  S.plan=best.plan;S.parts8=best.parts;
  if(!V().trialStart){V().trialStart=NOW().toISOString();track('trial_started')}
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
   ${anyMeal8()?'':'<p class="small" style="color:var(--danger)">Выберите хотя бы одно блюдо</p>'}
   <label class="toggle"><span><b>Без повторений</b><br><span class="small muted">Каждое блюдо — один раз за меню</span></span><input type="checkbox" class="switch" id="norep8" data-act="norep8" ${p.noRepeat8?'checked':''}></label></div>`}
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
Object.assign(EMOJI8,{orzo:'🍝',pasteroni:'🍝',spaghetti:'🍝',penne:'🍝',farfalle:'🍝',lasagna:'🍝',egg_noodles:'🍜',rice_noodles:'🍜',soba:'🍜',couscous:'🌾',basmati:'🍚',rice_round:'🍚',rice_brown:'🍚',
 peas_canned:'🥫',beans_white:'🥫',mushrooms_canned:'🥫',sardines:'🥫',corn_frozen:'🌽',red_onion:'🧅',leek:'🧅',green_onion:'🌿',dill:'🌿',parsley:'🌿',cilantro:'🌿',basil:'🌿',cherry:'🍅',sweet_potato:'🍠',ginger:'🫚',chili:'🌶️',
 pear:'🍐',kiwi:'🥝',mandarin:'🍊',grapefruit:'🍊',lime:'🍋',grapes:'🍇',strawberry:'🍓',cherry_frozen:'🍒',peach:'🍑',mango:'🥭',pineapple_canned:'🍍',
 chicken_drum:'🍗',chicken_wings:'🍗',chicken_whole:'🍗',bacon:'🥓',ham:'🥓',sausages:'🌭',boiled_sausage:'🌭',pink_salmon:'🐟',trout:'🐟',hake:'🐟',mackerel:'🐟',herring:'🐟',mussels:'🦪',crab_sticks:'🦀',
 mozzarella:'🧀',parmesan:'🧀',suluguni:'🧀',adyghe:'🧀',cream_cheese:'🧀',ricotta:'🧀',quail_eggs:'🥚',condensed_milk:'🥫',almonds:'🌰',hazelnuts:'🌰',cashew:'🥜',chocolate:'🍫',cookies:'🍪',olives:'🫒',olive_oil:'🫒',
 rye_bread:'🍞',baguette:'🥖',toast_bread:'🍞',tortilla:'🫓',pita:'🫓',buns:'🍔'});
const CATEMOJI8={'Овощи и зелень':'🥬','Фрукты и ягоды':'🍎','Мясо и рыба':'🥩','Молочное и яйца':'🥛','Бакалея':'🌾','Хлеб':'🍞'};
function ingPic8(k){return `<span class="ingpic8" aria-hidden="true">${EMOJI8[k]||CATEMOJI8[ING[k][1]]||'🛒'}</span>`}
function pantry8(full){
  const q=(UI.q8||'').trim().toLowerCase(),found=q?Object.keys(ING).filter(k=>ING[k][0].toLowerCase().includes(q)).slice(0,12):[];
  const cats=CAT_ORDER.filter(c=>Object.keys(ING).some(k=>ING[k][1]===c)),photos=UI.photos||[],open=UI.cat8;
  const short={'Овощи и зелень':'Овощи','Фрукты и ягоды':'Фрукты','Мясо и рыба':'Мясо и рыба','Молочное и яйца':'Молочное','Бакалея':'Бакалея','Хлеб':'Хлеб'};
  const ks=open?Object.keys(ING).filter(k=>ING[k][1]===open&&!['salt','water'].includes(k)).sort((a,b)=>ING[a][0].localeCompare(ING[b][0],'ru')):[];
  return `<input type="search" class="bigsearch" id="pq8" placeholder="Найти продукт: курица, рис, сыр…" value="${esc(UI.q8||'')}" data-act="search8" autocomplete="off" aria-label="Поиск продукта">
   ${full?'<p class="hint8">Отметьте всё, что есть дома</p>':''}
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
   ${full&&S.pantry.length?`<h3>Детали</h3><div class="card list8">${S.pantry.map((p,i)=>`<div class="prow8">${ingPic8(p.key)}<span class="grow prname8">${esc(ING[p.key][0])}${p.src==='list'?'<br><span class="small muted">из списка покупок</span>':p.src==='left8'?'<br><span class="small muted">остаток упаковки</span>':''}</span>
     <span class="pqtywrap8"><input class="pqtyinput8" type="number" inputmode="${['g','ml'].includes(ING[p.key][2])?'decimal':'numeric'}" id="pqty_${i}" value="${p.qty}" min="0" max="1000000000" step="${FamilyMenuPantryQty.step(ING[p.key][2])}" data-act="pqty" data-v="${i}" aria-label="Количество: ${esc(ING[p.key][0])}"><span class="pqtyarrows8"><button type="button" data-act="pantryStep8" data-v="${i}:1" aria-label="Увеличить количество: ${esc(ING[p.key][0])}" ${p.qty>=1e9?'disabled':''}>▴</button><button type="button" data-act="pantryStep8" data-v="${i}:-1" aria-label="Уменьшить количество: ${esc(ING[p.key][0])}" ${p.qty<=0?'disabled':''}>▾</button></span></span><span class="small muted" style="width:34px">${unitLabel(p.key)}</span>
     <button class="iconbtn" data-act="delP" data-v="${i}" aria-label="Удалить ${esc(ING[p.key][0])}">✕</button></div>`).join('')}</div>`:''}`;
}
function scanChoice8(sc,i){const p=sc.products[i];return p.ingredientId?(sc.on[i]?p.ingredientId:null):sc.pick[i]}
function scanQuantity8(sc,i,id){return FamilyMenuScanInventory.quantity(ING[id][2],sc.qty[i])}
function scanResult8(){
  const sc=UI.scan,selected=sc.products.map((p,i)=>[i,scanChoice8(sc,i)]).filter(([,id])=>id&&ING[id]);
  const invalid=selected.some(([i,id])=>scanQuantity8(sc,i,id)===null);
  const amountInput=(i,id)=>id&&ING[id]?`<label class="row small">Добавить к запасам<input type="number" class="scanqty8" inputmode="${['g','ml'].includes(ING[id][2])?'decimal':'numeric'}" min="${['g','ml'].includes(ING[id][2])?.001:1}" max="1000000000" step="${['g','ml'].includes(ING[id][2])?'any':1}" value="${esc(sc.qty[i]??'')}" data-act="scanQty8" data-v="${i}" aria-label="Добавить: ${esc(ING[id][0])}" placeholder="Количество" style="width:110px"><span>${unitLabel(id)}</span></label>`:'';
  return `<div class="card"><h3>Что нашли на фото</h3><p class="small muted">Проверьте количество: оно прибавится к текущим запасам. Для новой фотографии тех же продуктов не добавляйте их повторно.</p>${sc.products.map((p,i)=>{
    const id=sc.pick[i];
    if(p.ingredientId) return `<div class="stack"><label class="toggle"><span>${esc(ING[p.ingredientId]?ING[p.ingredientId][0]:p.name)}<br><span class="small muted">${esc(p.amount)}</span></span><input type="checkbox" class="chk2" data-act="scanSel" data-v="${i}" ${sc.on[i]?'checked':''}></label>${sc.on[i]?amountInput(i,p.ingredientId):''}</div>`;
    if(p.alternatives.length) return `<div class="stack" style="gap:6px"><span>${esc(p.name)} <span class="small muted">· ${esc(p.amount)} · выберите вариант</span></span><div class="chips">${p.alternatives.filter(a=>ING[a.ingredientId]).map(a=>`<button class="chip" data-act="scanAlt" data-v="${i}:${a.ingredientId}" aria-pressed="${id===a.ingredientId}">${esc(a.name)}</button>`).join('')}</div>${amountInput(i,id)}</div>`;
    return `<p class="small muted">${esc(p.name)} · ${esc(p.amount)} — нет в справочнике, пропустим</p>`;
  }).join('')}
   <p class="small muted" id="scan-qty-note" ${invalid?'':'hidden'}>Укажите количество в выбранных единицах для каждого отмеченного продукта.</p>
   <div class="row"><button class="btn grow" data-act="scanSave" ${!selected.length||invalid?'disabled':''}>Добавить в «Дома»</button><button class="btn ghost" data-act="scanCancel">Отмена</button></div></div>`;
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
    UI.scan={products,on:products.map(p=>!!p.ingredientId),pick:products.map(()=>null),qty:products.map(p=>p.ingredientId?FamilyMenuScanInventory.parseAmount(p.amount,ING[p.ingredientId][2]):null)}; track('fridge_scanned',{n:products.length});
  }catch(e){UI.scanErr=e.message||'Не удалось распознать фото.'}
  UI.scanBusy=false; render();
}

/* ---------- screens before the app ---------- */
const SLIDES8=[
 {t:'Меню для всей семьи',d:'Неделя блюд, которые съедят все: суп на обед, второе на ужин. Аллергии учтём.',btn:'А что ещё?',art:()=>`<div class="collage">${['m5','m3','b1','m66'].filter(id=>RBY[id]).map(id=>`<div class="heroimg">${dishArt(RBY[id])}</div>`).join('')}</div>`},
 {t:'Из того, что есть',d:'Отметьте продукты дома — подберём блюда, где докупать меньше всего, и поведём по шагам с таймером.',btn:'Дальше',art:()=>`<div class="heroimg">${stepArt(RBY.m2,3)}</div><div class="card timerbox" style="margin-top:-30px;width:70%;align-self:center"><span class="bigtime" style="font-size:40px">4:59</span></div>`},
 {t:'Покупки соберутся сами',d:'Точные граммы, без дублей, с учётом упаковок и продуктов, которые уже есть дома.',btn:'Ух ты, понял',art:()=>`<div class="card introlist">${[['potato',1.4],['chicken_fillet',700],['buckwheat',300],['tomato',400]].filter(([k])=>ING[k]).map(([k,q])=>`<div class="row between"><span class="row"><span class="chkfake"></span>${esc(ING[k][0])}</span><span class="qty">${q<10?dec(q)+' кг':q+' г'}</span></div>`).join('')}<div class="row between small"><span class="pill">ВкусВилл ≈ 1 240 ₽</span><span class="pill warn">Лавка ≈ 1 090 ₽</span></div></div>`},
 {t:'В рамках бюджета',premium:true,d:'Подберём меню под ваш бюджет и покажем примерную стоимость покупок.',btn:'Интересно',art:()=>`<div class="card"><h3>Покупки на неделю</h3><p><b style="font-size:30px">3 480 ₽</b> <span class="muted">из 4 000 ₽</span></p><div class="progress"><i style="width:87%"></i></div><div class="row"><span class="pill">ВкусВилл · 3 480 ₽</span><span class="pill warn">Лавка · 3 910 ₽</span></div><p class="small muted">Дешевле во ВкусВилле на 430 ₽</p></div>`},
 {t:'Калории и БЖУ',d:'Норма для каждого в семье, дневник питания и меню под вашу цель.',btn:'Здорово',art:()=>`<div class="card"><h3>Сегодня</h3><p><b style="font-size:30px">1 640</b> <span class="muted">из 2 100 ккал</span></p><div class="kbar"><i style="width:78%"></i></div><div class="macros">${[['82','белки'],['54','жиры'],['190','углеводы']].map(([v,l])=>`<div class="macro"><b>${v}</b><span>${l}, г</span></div>`).join('')}</div><div class="row"><span class="pill">Похудение</span><span class="pill">Без свинины</span></div></div>`},
 {t:'Неделя Premium бесплатно',d:`${R.filter(r=>r.m!=='c').length} рецептов, акции и сравнение цен — 7 дней без оплаты.`,btn:'Начать',art:()=>`<div class="collage">${['x80','x76','x71','x63'].filter(id=>RBY[id]).map(id=>`<div class="heroimg">${dishArt(RBY[id])}</div>`).join('')}</div>`},
];
function intro8(){
  const i=Math.min(S.introIdx||0,SLIDES8.length-1),s=SLIDES8[i];
  return `<div class="screen onbscreen">
   <div class="row between">${i?'<button class="iconbtn" data-act="introBack8" aria-label="Назад">←</button>':'<span style="width:36px"></span>'}<div class="progress grow" style="margin:0 12px"><i style="width:${Math.round((i+1)/SLIDES8.length*100)}%"></i></div><span style="width:36px"></span></div>
   <div class="stack introart">${s.art()}</div>
   <div class="stack qhead"><div class="row" style="align-items:center;flex-wrap:wrap;gap:6px"><h1 class="h18">${s.t}</h1>${s.premium?'<span class="pill warn">Premium</span>':''}</div><p class="muted">${s.d}</p></div>
   <div style="flex:1"></div>
   <button class="btn block" data-act="introNext8">${s.btn}</button>
   <button class="linkbtn" style="align-self:center" data-act="toAuth8">Уже есть аккаунт? Войти</button></div>`;
}
const QUIZ8=['Зачем вам Frigo?','Какая у вас цель?','Какой у вас тип питания?','Чего не должно быть в меню?','Что уже есть дома?','Ещё немного деталей','Неделя и бюджет'];
const QHINT8=['Можно выбрать несколько','Можно выбрать несколько','Строгое правило для всего меню','Аллергии и продукты, которые не любите','Подберём блюда, где докупать меньше всего','Сколько дней и на сколько человек','Меню сразу уложим в бюджет'];
/* v8.7: why people come — to know the audience (tracked with the answer). */
const WHY8={tired:['Устал(а) придумывать, что готовить','каждый день один и тот же вопрос'],variety:['Хочется разнообразия','надоели одни и те же блюда'],diet:['Соблюдать диету, вести дневник','калории, белки, жиры, углеводы'],
  save:['Экономить на продуктах','меню под бюджет, меньше лишних покупок'],fridge:['Готовить из того, что есть дома','чтобы продукты не пропадали'],time:['Тратить меньше времени','быстрые рецепты и список покупок'],family:['Кормить семью и детей полезно','блюда, которые съедят все']};
const DIET8={all:['Едим всё','без ограничений'],halal:['Без свинины','халяль и не только'],pesc:['Пескетарианство','без мяса, рыба есть'],veg:['Вегетарианство','без мяса и рыбы'],vegan:['Веганство','только растительное'],lent:['Постное','без мяса, молочного и яиц']};
function quiz8(){
  const N=QUIZ8.length,i=Math.min(S.qStep||0,N-1),p=P8(),last=i===N-1,goals=S.ans.goals||[],why=S.why8||[];
  let body='',btn='Дальше',ok=true;
  if(i===0){body=`<div class="stack" style="gap:8px">${Object.entries(WHY8).map(([k,[l,d]])=>`<button class="optcard opt8" data-act="why8" data-v="${k}" aria-pressed="${why.includes(k)}"><span class="grow"><b>${l}</b><br><span class="small muted oneline">${d}</span></span><span class="check8" aria-hidden="true"></span></button>`).join('')}</div>`; ok=why.length>0}
  else if(i===1){body=`<div class="stack" style="gap:8px">${Object.entries(GOAL8).map(([k,l])=>`<button class="optcard opt8" data-act="goal8" data-v="${k}" aria-pressed="${goals.includes(k)}"><b>${l}</b><span class="check8" aria-hidden="true"></span></button>`).join('')}</div>`; ok=goals.length>0}
  else if(i===2){body=`<div class="stack" style="gap:8px">${Object.entries(DIET8).map(([k,[l,d]])=>`<button class="optcard opt8" data-act="diet8" data-v="${k}" aria-pressed="${!!S.ans.diet&&p.diet===k}"><span class="grow"><b>${l}</b><br><span class="small muted oneline">${d}</span></span></button>`).join('')}</div>`; ok=!!S.ans.diet}
  else if(i===3){body=restr8(); if(!p.allergies.length&&!p.dislikes.length) btn='Ограничений нет — дальше'}
  else if(i===4){body=pantry8(false); if(!S.pantry.length&&!(UI.photos||[]).length) btn='Ничего нет — дальше'}
  else if(i===5){body=details8()}
  else {body=budget8(); btn='Составить меню'; ok=anyMeal8()}
  return `<div class="screen onbscreen">
   <div class="row between"><button class="iconbtn" data-act="qBack8" aria-label="Назад">←</button><div class="progress grow" style="margin:0 12px"><i style="width:${Math.round((i+1)/N*100)}%"></i></div><span style="width:36px"></span></div>
   <div class="stack qhead"><p class="eyebrow">Вопрос ${i+1} из ${N}</p><h1 class="h18">${QUIZ8[i]}</h1><p class="muted">${QHINT8[i]}</p></div>
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
const cookedTotal8=()=>V().ev.filter(e=>e.n==='dish_cooked').length;
const DIARY8='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M12 3c.6 3.2 5 5.3 5 10.2A5 5 0 0 1 7 13.2c0-2.4 1.2-4 2.6-5.1.1 1.9.9 3 2 3.4-.6-2.8-.4-5.8.4-8.5z"/><path d="M10.2 16.5a1.9 1.9 0 0 0 3.6 0"/></svg>';
const HAT8='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 14.5a4 4 0 0 1-.6-7.9A5 5 0 0 1 12 3a5 5 0 0 1 5.6 3.6 4 4 0 0 1-.6 7.9V20H7z"/><path d="M7 17h10"/></svg>';
function appbar8(){
  const sub=PAGES8[S.tab];
  return `<header class="appbar">${sub?`<button class="iconbtn" data-act="back8" aria-label="Назад">←</button>`:`<button class="iconbtn burger" data-act="drawer" aria-label="Открыть меню">${IC.burger}</button>`}
   <span class="grow"></span>
   ${(()=>{const f=S.plan?familyToday8():null;return `<button class="cooked8 kc8" data-act="nav8d" data-v="diary" aria-label="Дневник питания${f?`: съедено ${f.eat} из ${f.need} ккал`:''}">${DIARY8}${f?`<span><b>${num(f.eat)}</b> / ${num(f.need)}</span>`:''}</button>`})()}</header>`;
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
   ${it('pNotify',IC.bell||IC.menu,'Уведомления',S.profile.tg8?'Напоминания в Telegram включены':'Напоминания в Telegram')}
   ${it('pRecipes',IC.pot,'Мои рецепты',S.myRecipes.length?`${S.myRecipes.length} — попадают в меню`:'Свои блюда попадут в меню')}
   <p class="eyebrow dhead">Премиум <span class="small muted" style="text-transform:none;letter-spacing:0;font-weight:400">· ${premiumNote8()}</span></p>
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
  const action=(k,hero)=>{const s=d.slots[k],eaten=!!S.eaten[eatKey(ti,k)];
    return s.cooked?`<button class="eat" ${hero?'style="background:transparent;color:inherit;border-color:currentColor"':''} data-act="eat" data-v="${ti}:${k}" aria-pressed="${eaten}">${eaten?'Съели ✓':'Съели'}</button>`
      :`<button class="btn small ${hero?'herobtn8':''}" data-act="cook" data-v="${srcRef(ti,k)}">Готовить</button>`};
  const row=k=>{nameSlot8(k); const r=slotRecipe(ti,k),s=d.slots[k]; if(!r) return '';
    return `<div class="slot ${s.cooked?'cooked':''}" data-slot="${ti}:${k}"><div class="thumb">${dishArt(r)}</div>
     <button class="open" data-act="recipe" data-v="${srcRef(ti,k)}">${kindLabel8(k)?`<span class="small muted">${esc(kindLabel8(k))}</span>`:''}<span class="dish">${esc(r.n)}</span><span class="meta meta8">${buyTag8(r,true)}${partTag8(d,k)}<span>${r.t} мин</span><span>${Math.round(r.kcal*s.serv/portions())} ккал в среднем</span></span></button>${action(k)}</div>`};
  nameSlot8(mk); const hr=slotRecipe(ti,mk),hs=d.slots[mk];
  const hero=hr?`<div class="hero hero8"><button class="heroimg" data-act="recipe" data-v="${srcRef(ti,mk)}" aria-label="Рецепт: ${esc(hr.n)}">${dishArt(hr)}</button><p class="small" style="opacity:.85">${SLOT_NAMES[mk]}${hs.cooked?' · приготовлено':''}</p><p class="dish">${esc(hr.n)}</p>
     <div class="meta">${missing8(hr)?buyTag8(hr):''}${partTag8(d,mk)}<span>${hr.t} мин</span><span>${Math.round(hr.kcal*hs.serv/portions())} ккал в среднем</span></div>
     <div class="row">${action(mk,true)}</div></div>`:'';
  const groups=groups8(d).map(g=>({...g,keys:g.keys.filter(k=>k!==mk)})).filter(g=>g.keys.length);
  return `<div class="screen"><h1 class="range8" style="text-transform:capitalize">${DOWL[date.getDay()]}, ${date.getDate()} ${MON[date.getMonth()]}</h1>
   ${ateForm8(ti)}
   ${hero}
   ${groups.length?`<div class="day today"><header><b>Ещё сегодня</b><span class="small muted">≈${num(dayKcal(ti)*cookingScale())} ккал за день${S.profile.members.length>1?' на семью':''}</span></header>
   ${groups.map(g=>`<div class="meal8"><div class="mealhead8"><b>${SLOT8[g.b]||SLOT_NAMES[g.b]||''}</b>${g.keys.length>1?`<span class="small muted">${g.keys.length} ${plural(g.keys.length,'блюдо','блюда','блюд')}</span>`:''}</div>${g.keys.map(row).join('')}</div>`).join('')}</div>`:''}</div>`;
}
/* Favourites: heart on the recipe sheet and on the recipe page; liked recipes are offered more often. */
const isFav8=id=>(S.fav8||[]).includes(id);
const favBtn8=id=>`<button class="iconbtn fav8 ${isFav8(id)?'on':''}" data-act="fav8" data-v="${id}" aria-pressed="${isFav8(id)}" aria-label="${isFav8(id)?'Убрать из любимых':'В любимые'}">${isFav8(id)?'♥':'♡'}</button>`;
sheetRecipe=(function(orig){return function(o){const s0=S.plan.days[o.day].slots[o.slot],id=s0&&s0.rid;let h=orig(o);
  const rr=slotRecipe(o.day,o.slot),own=s0&&!s0.left;
  if(rr&&own){let n=0; const f=s0.serv/4;
    // v8.14: every product can be crossed out or get its own amount (for the portions of this dish)
    h=h.replace(/<div class="ingr"><span>[^<]*<\/span><span class="qty">[^<]*<\/span><\/div>/g,m=>{if(n>=rr.i.length) return m; const [k,q]=rr.i[n++],u=ING[k][2],per=u==='g'||u==='ml',v=per?Math.round(q*f):Math.round(q*f*2)/2;
      return `<div class="ingr"><button class="iconbtn xs8" data-act="ingDrop8" data-v="${k}" aria-label="Убрать ${esc(ING[k][0])}">✕</button><span class="grow">${esc(ING[k][0])}</span><input type="number" class="iq8" inputmode="decimal" min="0" step="${per?10:0.5}" value="${v}" data-act="iq8" data-v="${k}" aria-label="Количество: ${esc(ING[k][0])}"><span class="small muted iu8">${esc(unitLabel(k))}</span></div>`});
    const q=(UI.ia8||'').trim().toLowerCase(),found=q?Object.keys(ING).filter(k=>ING[k][0].toLowerCase().includes(q)&&!rr.i.some(([x])=>x===k)).slice(0,8):[],base=rr.base8&&RBY[rr.base8];
    const diff=base?[...base.i.filter(([k])=>!rr.i.some(([x])=>x===k)).map(([k])=>'без: '+ING[k][0].toLowerCase()),...rr.i.filter(([k])=>!base.i.some(([x])=>x===k)).map(([k])=>'+ '+ING[k][0].toLowerCase())]:[];
    h=h.replace('<p class="small muted">Количества пересчитываются вместе со списком покупок</p>',`<input type="search" id="ia8" data-act="ia8" placeholder="+ Добавить продукт, например: варенье" value="${esc(UI.ia8||'')}" autocomplete="off" aria-label="Добавить продукт в блюдо">
      ${found.length?`<div class="chips">${found.map(k=>`<button class="chip" data-act="ingAdd8" data-v="${k}">+ ${esc(ING[k][0])}</button>`).join('')}</div>`:q?'<p class="small muted">Ничего не нашли</p>':''}
      ${diff.length?`<div class="row between"><span class="small">Изменено: ${esc(diff.join(', '))}</span><button class="linkbtn small" data-act="ingReset8">Как было</button></div>`:''}
      <p class="small muted">Готовим на всю семью; делите еду пропорционально потребности каждого в калориях. Меняйте объём продуктов — калории и список покупок пересчитаются.</p>`)}
  if(rr) h=h.replace('<div class="card"><div class="row between"><h3>Порции</h3>',buyLine8(rr)+'<div class="card"><div class="row between"><h3>Порции</h3>');
  return id?h.replace('<h1 class="dish" style="font-size:26px">',`<div class="row between" style="align-items:flex-start"><h1 class="dish grow" style="font-size:26px">`).replace(/(<h1 class="dish grow"[^>]*>[^<]*<\/h1>)/,`$1${favBtn8(id)}</div>`):h}})(sheetRecipe);
score=(function(orig){return function(r,ctx){return orig(r,ctx)+(isFav8(r.id)?2:0)}})(score);
function recipeById8(id){
  if(RBY[id]) return RBY[id]; const m=/^c_(.+)_(g\d+)$/.exec(id); if(m&&RBY[m[1]]&&RBY[m[2]]) return comboOf(RBY[m[1]],RBY[m[2]]); return null;
}
function rec8(){
  const r=recipeById8(UI.rec8); if(!r) return `<div class="screen"><p class="muted">Рецепт не найден.</p></div>`;
  const slot=(S.plan?.days||[]).flatMap(d=>Object.values(d.slots)).find(s=>s.rid===r.id&&!s.left),scale=slot?slot.serv:cookingScale(),perPerson=scale/portions();
  return `<div class="screen"><div class="cover">${dishArt(r)}</div>
   <div class="row between" style="align-items:flex-start"><h1 class="dish grow" style="font-size:26px">${esc(r.n)}</h1>${favBtn8(r.id)}</div>
   <div class="meta" style="font-size:14px"><span>${r.t} мин</span><span>${Math.round(r.kcal*perPerson)} ккал в среднем на человека</span></div>
   ${buyLine8(r)}
   <div class="macros"><div class="macro"><b>${Math.round(r.P*perPerson)} г</b><span>белки</span></div><div class="macro"><b>${Math.round(r.F*perPerson)} г</b><span>жиры</span></div><div class="macro"><b>${Math.round(r.C*perPerson)} г</b><span>углеводы</span></div></div>
   <div class="card"><h3>Продукты на ${portions()} ${plural(portions(),'порцию','порции','порций')}</h3>${r.i.map(([k,q])=>`<div class="ingr"><span>${esc(ING[k][0])}</span><span class="qty">${fmtQty(k,q*scale/4)}</span></div>`).join('')}${(r.sp||[]).length?`<p class="small muted">По вкусу: ${esc(r.sp.join(', '))}</p>`:''}</div>
   <div class="card"><h3>Как готовить</h3><ol class="steps8">${r.s.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div></div>`;
}
/* v8.7: proteins, fats and carbohydrates per person as donuts. */
function macroShare8(m){
  if(m.kind==='child') return [.14,.30,.56];
  const g=S.profile.goals||[]; let p=.15,f=.30;
  if(m.goal==='lose'||g.includes('lose')) p=.25; else if(m.goal==='gain'||g.includes('mass')){p=.20;f=.25}
  if(g.includes('protein')) p=Math.max(p,.25);
  if(g.includes('lowcarb')){p=Math.max(p,.25); f=.40}
  return [p,f,1-p-f];
}
function macroNeed8(m){const k=need(m).kcal,[p,f,c]=macroShare8(m);return [Math.round(k*p/4),Math.round(k*f/9),Math.round(k*c/4)]}
function eatenMacro8(di,m){const d=S.plan.days[di],pf=pfactor(m),out=[0,0,0]; Object.keys(d.slots).forEach(k=>{const r=slotRecipe(di,k),f=pf*partOf8(d,k); if(r&&S.eaten[eatKey(di,k)]){out[0]+=r.P*f;out[1]+=r.F*f;out[2]+=r.C*f}});
  // v8.12: what was added in «Что ещё съели» counts too
  const dk=d.date.slice(0,10); (((S.extra[dk]||{})[m.id])||[]).forEach(x=>{const mac=x&&typeof x==='object'?(x.P!=null?[x.P,x.F,x.C]:(S.exm8||{})[dk+'|'+m.id+'|'+x.label]):null; if(mac){out[0]+=mac[0];out[1]+=mac[1];out[2]+=mac[2]}});
  return out.map(Math.round)}
const MAC8=[['Белки','var(--accent)'],['Жиры','var(--saffron)'],['Углеводы','#5f86b8']];
function donuts8(m,eaten){const nd=macroNeed8(m),R_=26,C_=2*Math.PI*R_;
  return `<div class="donuts8">${MAC8.map(([l,c],i)=>{const v=eaten[i]||0,n=nd[i]||1,p=Math.min(1,v/n);
    return `<div class="donut8"><svg viewBox="0 0 64 64" width="72" height="72" role="img" aria-label="${l}: ${v} из ${n} г"><circle cx="32" cy="32" r="${R_}" fill="none" stroke="var(--line)" stroke-width="8"/>${p>0?`<circle cx="32" cy="32" r="${R_}" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(p*C_).toFixed(1)} ${C_.toFixed(1)}" transform="rotate(-90 32 32)"/>`:''}<text x="32" y="37" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor">${Math.round(v/n*100)}%</text></svg><b class="small">${l}</b><span class="small muted">${v} / ${n} г</span></div>`}).join('')}</div>`}
const macNote8=()=>`<details class="macnote8"><summary class="small muted">Как посчитано: формула Миффлина — Сан Жеора и МР 2.3.1.0253-21</summary><p class="small muted">Норма калорий — по формуле Миффлина — Сан Жеора с учётом пола, возраста, веса, роста, активности и цели; для детей — возрастные нормы. Доли белков, жиров и углеводов — по методическим рекомендациям Роспотребнадзора МР 2.3.1.0253-21 «Нормы физиологических потребностей в энергии и пищевых веществах»: белки 12–15%, жиры около 30%, углеводы 55–58% калорий. При похудении и цели «Больше белка» белков 25%, при «Меньше углеводов» — меньше углеводов и больше жиров. Съеденное считаем по блюдам, отмеченным «Съели», с учётом порции человека. Это ориентир, а не медицинская рекомендация.</p></details>`;
/* Calories for every family member, children included; the extra-food field adds to the chosen person. */
function eatenToday8(ti,m){const dk=S.plan.days[ti].date.slice(0,10),ex=((S.extra[dk]||{})[m.id])||[];return Math.round(eatenKcal(ti)*pfactor(m)+ex.reduce((a,b)=>a+(typeof b==='number'?b:b.kcal),0))}
function familyToday8(){const ti=todayIdx(); if(!S.plan||ti<0) return null; const ms=S.profile.members; return {n:ms.length,eat:ms.reduce((a,m)=>a+eatenToday8(ti,m),0),need:ms.reduce((a,m)=>a+need(m).kcal,0)}}
/* v8.12: search for what was eaten — products (per 100 g or per piece) and dishes (per portion), with proteins, fats and carbs. */
function eatFind8(q){
  q=q.trim().toLowerCase(); if(q.length<2) return [];
  const ings=Object.keys(ING).filter(k=>ING[k][0].toLowerCase().includes(q)&&ING[k][6]&&!['salt','water'].includes(k)).slice(0,6).map(k=>({t:'i',id:k,n:ING[k][0].replace(/\s*\(.*?\)/,''),u:ING[k][2]}));
  const dishes=R.filter(r=>!r.base8&&r.m!=='c'&&r.n.toLowerCase().includes(q)).slice(0,4).map(r=>({t:'r',id:r.id,n:r.n}));
  return [...ings,...dishes];
}
function eatPortion8(x,qty){
  if(x.t==='r'){const r=RBY[x.id],k=qty>0?qty:1;return {label:`${r.n}${k!==1?` × ${dec(k)}`:''}`,kcal:Math.round(r.kcal*k),P:Math.round(r.P*k),F:Math.round(r.F*k),C:Math.round(r.C*k)}}
  const d=ING[x.id],u=d[2],per=u==='g'||u==='ml',q=qty>0?qty:per?100:1,f=per?q/100:q,n=d[6];
  return {label:`${x.n}, ${per?q+(u==='g'?' г':' мл'):dec(q)+' '+u}`,kcal:Math.round(n[0]*f),P:Math.round(n[1]*f),F:Math.round(n[2]*f),C:Math.round(n[3]*f)};
}
function eatSugg8(){const list=eatFind8(UI.kq8||''); if(!(UI.kq8||'').trim()) return ''; if(!list.length) return '<p class="small muted">Ничего не нашли — попробуйте по-другому или впишите калории числом.</p>';
  return `<div class="chips">${list.map(x=>`<button class="chip" data-act="kpick8" data-v="${x.t}:${x.id}">${esc(x.n)} <span class="muted">${x.t==='r'?'порция':(x.u==='g'?'100 г':x.u==='ml'?'100 мл':'1 '+x.u)}</span></button>`).join('')}</div>`}
function ateForm8(ti){
  const ms=S.profile.members; if(!UI.member||!ms.find(m=>m.id===UI.member)) UI.member=ms[0].id;
  const dk=S.plan.days[ti].date.slice(0,10),ex=((S.extra[dk]||{})[UI.member])||[];
  return `<div class="card ate8"><h3>Что ещё съели</h3><form class="row" data-form="kadd">${ms.length>1?`<select id="kwho8" data-act="kwho8" aria-label="Кто съел">${ms.map(m=>`<option value="${m.id}" ${m.id===UI.member?'selected':''}>${esc(m.name)}</option>`).join('')}</select>`:''}<input type="search" id="kadd" data-act="kq8" value="${esc(UI.kq8||'')}" placeholder="Начните вводить: банан, творог…" autocomplete="off" aria-label="Что ещё съели" style="flex:1;min-width:0"><input type="number" id="kqty8" inputmode="decimal" min="0" placeholder="г/шт" aria-label="Сколько: граммы или штуки" style="width:74px;flex:none"></form>
   ${eatSugg8()}
   <p class="small muted" id="kmsg"></p>
   ${ex.length?`<div class="chips">${ex.map((v,i)=>{const o=typeof v==='number'?{label:'Вручную',kcal:v}:v;return `<button class="chip" data-act="kdel" data-v="${i}" aria-label="Удалить ${esc(o.label)}">${esc(o.label)} · ${num(o.kcal)} ккал ✕</button>`}).join('')}</div>`:''}</div>`;
}
function kcalAll8(ti){
  const ms=S.profile.members; if(!UI.member||!ms.find(m=>m.id===UI.member)) UI.member=ms[0].id;
  const dk=S.plan.days[ti].date.slice(0,10),plan=dayKcal(ti);
  const rows=ms.map(m=>{const n=need(m).kcal,ex=((S.extra[dk]||{})[m.id])||[],eat=Math.round(eatenKcal(ti)*pfactor(m)+ex.reduce((a,b)=>a+(typeof b==='number'?b:b.kcal),0)),pl=Math.round(plan*pfactor(m));
    return `<button class="kmem8 ${m.id===UI.member?'on':''}" data-act="kmember" data-v="${m.id}"><span class="row between"><b>${esc(m.name)}${m.kind==='child'&&!/реб[её]н/i.test(m.name)?' <span class="small muted">ребёнок</span>':''}</b><span class="small"><b>${num(eat)}</b> <span class="muted">/ ${num(n)}</span></span></span>
      <span class="kbar"><i style="width:${Math.min(100,eat/n*100)}%"></i><b style="left:calc(${Math.min(100,pl/n*100)}% - 1px)"></b></span></button>`}).join('');
  const sel=ms.find(m=>m.id===UI.member),ex=((S.extra[dk]||{})[UI.member])||[];
  return `<div class="card kcal kcal8"><div class="row between"><h3>Калории сегодня</h3><button class="linkbtn small" data-act="nav8d" data-v="diary">Детальнее ›</button></div>${rows}
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
  const row=(di,k)=>{nameSlot8(k);let h=slotRow(di,k,!!preview).replace(partTag8(),'').replace(' ккал в среднем',' ккал');
    if(preview)h=h.replace(/<button class="eat"[^>]*>[^<]*<\/button>/,`<button class="btn ghost small" data-act="replace" data-v="${di}:${k}">Заменить</button>`);
    const slot=S.plan.days[di].slots[k],status=!preview&&di===ti&&slot?.cooked?`<div class="menustatus8">${eatBtn(di,k)}</div>`:'';
    return h.replace('class="slot','class="menu-slot8 slot').replace(/(<button class="open"[\s\S]*?<\/button>)/,`<div class="menucontent8">${status}$1</div>`);
  };
  return `<div class="screen${preview?' preview8':''}">
   ${preview?'<div class="note"><b>✓</b><span>Ваше меню готово! Сохраните его — и список покупок соберётся сам.</span></div>':''}
   ${shopping().cost>budgetLimit8()+1?`<div class="note"><b>!</b><span class="grow">Для выбранной калорийности меню дороже бюджета на ≈${rub(shopping().cost-budgetLimit8())}. Увеличьте бюджет или измените блюда</span><button class="btn ghost small" data-act="cheaper8">Подобрать подешевле</button></div>`:''}
   <div class="row between" style="align-items:center"><h1 class="range8">${range8(d0,dn)}</h1>${preview?'':S.plan.status==='draft'?'<span class="pill warn">черновик</span>':'<span class="pill">утверждено</span>'}</div>
   ${vis.map(([d,di])=>{const groups=[];keysOf8(d).forEach(k=>{const b=baseOf8(k),g=groups.find(x=>x.b===b);g?g.keys.push(k):groups.push({b,keys:[k]})});
     const low=dayKcal8(d)<KCAL_TARGET8*.9?'<div class="warn8"><span class="small">Калорийность ниже нормы: с выбранными блюдами и ограничениями не удалось подобрать достаточный объём еды. Добавьте приём пищи или измените ограничения.</span></div>':'',over=Math.round(dayKcal8(d)-KCAL_TARGET8),warn=!preview&&over>110?`<div class="warn8"><span class="grow small">Выше нормы на ≈${num(over*cookingScale()/portions())} ккал в среднем на человека</span><button class="btn ghost small" data-act="lighter8" data-v="${di}">Подобрать полегче</button></div>`:'';
     return `<div class="day ${di===ti?'today':''}">${low}${warn}<header><b style="text-transform:capitalize">${dateLabel(d.date,true)}</b><span class="small muted">${di===ti?'<span class="pill">сегодня</span> ':''}≈${num(dayKcal(di)*cookingScale())} ккал${S.profile.members.length>1?' на семью':''}</span></header>${groups.map(g=>`<div class="meal8"><div class="mealhead8"><b>${SLOT8[g.b]||SLOT_NAMES[g.b]||''}</b>${g.keys.length>1?`<span class="small muted">${g.keys.length} ${plural(g.keys.length,'блюдо','блюда','блюд')}</span>`:''}</div>${g.keys.map(k=>row(di,k)).join('')}</div>`).join('')}</div>`}).join('')}
   ${preview?'':`<p class="small muted">${KC()?(S.profile.members.length>1?'Калории дня — на всю семью. ':'Калории дня — по вашей норме. ')+'Калории блюд — в среднем на человека; делите общий объём пропорционально потребности каждого. ':''}Потяните за ⠿, чтобы поменять блюда местами. Смахните блюдо вправо, чтобы убрать его.</p>
   <div class="stack">${S.plan.status==='draft'?'<button class="btn block" data-act="approve">Утвердить меню и собрать покупки</button>':''}
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
    S.dmac8=S.dmac8||{}; const mac={}; S.profile.members.forEach(m=>{mac[m.id]=eatenMacro8(di,m)}); if(Object.values(mac).some(v=>v.some(Boolean))) S.dmac8[key]=mac; else delete S.dmac8[key];
    if(Object.values(row).some(v=>v>0)) S.diary8[key]=row; else delete S.diary8[key]});
}
const cookName8=x=>typeof x==='string'?x:x.n;
function diary8(){
  snapDiary8(); const ms=S.profile.members; if(!UI.dmem8||!ms.find(m=>m.id===UI.dmem8)) UI.dmem8=ms[0].id;
  const me=ms.find(m=>m.id===UI.dmem8),norm=need(me).kcal,now=day0(NOW()),iso=localKey8,gran=UI.gran8||'day';
  const pct=k=>{const v=(S.diary8[k]||{})[me.id]||0;return v?Math.round(v/norm*100):0};
  const sel=UI.cal8||iso(now),sd=new Date(sel+'T12:00:00');
  // days: from the first record (or 3 weeks back) to a week ahead, scrolled to the selected day
  const known=[...Object.keys(S.diary8||{}),...Object.keys(S.cook8||{})].sort(),start=new Date(Math.min(addDays(now,-21).getTime(),known.length?new Date(known[0]+'T12:00:00').getTime():Infinity));
  const days=[];for(let d=day0(start);d<=addDays(now,7);d=addDays(d,1)) days.push(d);
  const months=Array.from({length:12},(_,m)=>new Date(now.getFullYear(),m,1));
  const mpct=m=>{const ks=Object.keys(S.diary8||{}).filter(k=>k.startsWith(`${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`)).map(pct).filter(Boolean);return ks.length?Math.round(ks.reduce((a,b)=>a+b,0)/ks.length):0};
  const col=(label,num_,p,act,v,on,dot,today)=>`<button class="wday8 ${on?'sel8':''} ${today?'today8':''}" ${act?`data-act="${act}" data-v="${v}"`:''}><span class="small">${label}</span><b>${num_}</b><span class="wbar8"><i style="height:${Math.min(100,p)}%" class="${p>110?'over':''}"></i></span><span class="small ${p?'':'muted'}">${p?p+'%':'—'}</span>${dot?'<span class="cookdot8"></span>':''}</button>`;
  const history=Object.entries(S.cook8||{}).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30);
  const fam=familyToday8();
  return `<div class="screen">${head8('Дневник питания',fam?`Сегодня: ${num(fam.eat)} / ${num(fam.need)} ккал`:'Сегодня')}
   ${fam?`<div class="progress ${fam.eat>fam.need*1.1?'over':''}"><i style="width:${Math.min(100,Math.round(fam.eat/fam.need*100))}%"></i></div><p class="small muted">Вся семья, ${fam.n} ${plural(fam.n,'человек','человека','человек')}: съедено / норма на сегодня</p>`:''}
   <div class="chips">${ms.map(x=>`<button class="chip" data-act="dmem8" data-v="${x.id}" aria-pressed="${x.id===me.id}">${esc(x.name)}</button>`).join('')}</div>
   <div class="card"><div class="row between"><h3>Норма калорийности по дням</h3><div class="chips gran8">${[['day','день'],['month','месяц']].map(([k,l])=>`<button class="chip" data-act="gran8" data-v="${k}" aria-pressed="${gran===k}">${l}</button>`).join('')}</div></div>
    <div class="hscroll8" id="hscroll8">${gran==='day'?days.map(d=>{const k=iso(d);return col(DOW[d.getDay()],d.getDate(),pct(k),'cal8',k,k===sel,(S.cook8||{})[k],k===iso(now))}).join('')
     :months.map(m=>col(['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][m.getMonth()],'',mpct(m),'',null,m.getMonth()===now.getMonth(),false,false)).join('')}</div>
    <p class="small muted">${esc(me.name)}: % от суточной нормы ${num(norm)} ккал${gran==='month'?' — в среднем за месяц':''}</p></div>
   <div class="card"><div class="row between"><h3>Белки, жиры, углеводы</h3><span class="small muted" style="text-transform:capitalize">${sel===iso(now)?'сегодня':`${DOWL[sd.getDay()]}, ${sd.getDate()} ${MON[sd.getMonth()]}`}</span></div>
    ${donuts8(me,((S.dmac8||{})[sel]||{})[me.id]||[0,0,0])}
    <p class="small muted">${esc(me.name)}: съедено / суточная норма. Выберите день на графике выше.</p>${macNote8()}</div>
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
    <div class="for8">${i.packs?`${i.packs} уп. × ${fmtQty(i.k,i.pack)}${i.left>=1?` · останется ${fmtQty(i.k,i.left)} — добавим в «Дома»`:''} · `:''}${i.pq>0?`дома ${fmtQty(i.k,i.pq,true)} · `:''}для: ${esc(i.dishes.join(', '))}</div></label>
    <button class="iconbtn" data-act="have" data-v="${i.k}" aria-label="Уже есть дома: ${esc(i.name)}" style="font-size:12px">есть</button></div>`;
  return `<div class="screen">
   <div class="row between" style="align-items:center"><p class="small muted grow">Отмечайте, что купили, — список обновится</p><button class="iconbtn" data-act="share8" aria-label="Поделиться списком покупок" title="Поделиться списком">${IC.share}</button></div>
   ${S.plan.status==='draft'?`<div class="note"><b>!</b><span>Меню ещё не утверждено: список может измениться после замен. <button class="btn ghost small" style="margin-top:6px" data-act="approve">Утвердить меню</button></span></div>`:''}
   <button class="card pricecard" data-act="navPrices" aria-label="Сравнить цены в магазинах"><span class="row between"><span>Осталось купить: <b>${left.length}</b> ${plural(left.length,'позиция','позиции','позиций')}</span><span class="qty" style="font-size:18px">≈${rub(left.reduce((a,i)=>a+i.cost,0))}</span></span>
    <div class="progress"><i style="width:${need_.length?Math.round((need_.length-left.length)/need_.length*100):100}%"></i></div>
    <span class="small ${left.reduce((a,i)=>a+i.cost,0)>budgetLimit8()+1?'over8':'muted'}">Бюджет на ${S.profile.days} ${plural(S.profile.days,'день','дня','дней')} меню: ${rub(budgetLimit8())} (${rub(S.profile.budget)} в неделю)</span>
    <span class="row between small"><span>ВкусВилл ≈ ${rub(basketBy('vv'))}</span><span>Лавка ≈ ${rub(basketBy('lavka'))}</span></span>
    <span style="color:var(--accent);font-weight:600">Сравнить цены в магазинах ›</span>
    <span class="small muted">Одинаковые продукты из разных блюд объединены. Цены на ${PRICE_DATE} — примерные.</span></button>
   ${cats.map(c=>`<section class="cat"><h3>${c}</h3>${need_.filter(i=>i.cat===c).map(row).join('')}</section>`).join('')}
   ${sh.spices.length?`<section class="cat"><h3>Специи — проверьте, есть ли дома</h3><div class="card small">${esc(sh.spices.join(', '))}<p class="muted">Количество «по вкусу», в список не суммируем.</p></div></section>`:''}
  </div>`;
}
function scrHome8(){return `<div class="screen">${pantry8(true)}<p class="small muted">Продукты отсюда вычитаются из покупок и учитываются при подборе меню.</p></div>`}

function pFamily8(){
  const p=S.profile,k=p.kcalOn; p.kcalOn=true;
  const macLine=m=>{const [P,F,C]=macroNeed8(m);return `<p class="small mac8">В день: <b>${num(need(m).kcal)} ккал</b> · белки ${P} г · жиры ${F} г · углеводы ${C} г</p>`};
  const cards=p.members.map((m,i)=>{
    if(m.open) return memberCard(m,i).replace(/(data-act="mopen" data-v="\d+">Скрыть<\/button><\/div>)/,'$1'+macLine(m));
    const [P,F,C]=macroNeed8(m),age=+m.age;
    return `<button class="card fam8" data-act="mopen" data-v="${i}"><span class="avatar">${esc((m.name||'?')[0].toUpperCase())}</span><span class="grow"><b>${esc(m.name)}</b> <span class="small muted">${m.kind==='child'?'ребёнок':'взрослый'}${age?`, ${age} ${plural(age,'год','года','лет')}`:''}</span>
      <span class="famnums8"><b>${num(need(m).kcal)} ккал</b><span>Б ${P} г</span><span>Ж ${F} г</span><span>У ${C} г</span></span></span><span class="muted" aria-hidden="true">›</span></button>`}).join('');
  p.kcalOn=k;
  return `<div class="screen">${head8('Настройки','Семья')}
   <div class="stack" style="gap:8px">${cards}</div>
   <div class="row"><button class="btn secondary small" data-act="madd" data-v="adult">+ Взрослый</button><button class="btn secondary small" data-act="madd" data-v="child">+ Ребёнок</button></div>
   <p class="small muted">Норма на человека в день. Нажмите на человека, чтобы указать пол, возраст, вес, рост и цель. Готовим на ${portions()} ${plural(portions(),'порцию','порции','порций')} за приём пищи.</p>
   ${macNote8()}</div>`}
function pFood8(){const p=S.profile;return `<div class="screen">${head8('Настройки','Питание и ограничения')}
  <div class="card"><h3>Цель</h3><p class="small muted">Можно выбрать несколько</p><div class="chips">${Object.entries(GOAL8).map(([k,l])=>`<button class="chip" data-act="goal8" data-v="${k}" aria-pressed="${k==='none'?!p.goals.length:p.goals.includes(k)}">${l}</button>`).join('')}</div></div>
  <div class="card"><h3>Тип питания</h3><div class="chips">${Object.entries(DIETS).map(([k,[l,d]])=>`<button class="chip" data-act="diet" data-v="${k}" aria-pressed="${p.diet===k}" title="${esc(d)}">${l}</button>`).join('')}</div></div>
  ${restr8()}
  ${S.history.blocked.length?`<div class="card"><h3>Скрытые блюда</h3>${S.history.blocked.filter(id=>RBY[id]).map(id=>`<div class="row between"><span>${esc(RBY[id].n)}</span><button class="iconbtn" data-act="unblock" data-v="${id}">вернуть</button></div>`).join('')}</div>`:''}
  <button class="btn block" data-act="regen">Сохранить и пересобрать меню</button></div>`}
function pDays8(){const p=S.profile;return `<div class="screen">${head8('Настройки','Дни и приёмы пищи')}${days8card()}${mealKinds8()}${timeCard8()}
  <button class="btn block" data-act="regen" ${anyMeal8()?'':'disabled'}>Сохранить и пересобрать меню</button></div>`}
/* v8.13: notifications — reminders will come from the Telegram bot the person signed in with. */
function pNotify8(){const p=S.profile,on=!!p.tg8,tsel=(id,act,val,list)=>`<select id="${id}" data-act="${act}" aria-label="Время" style="width:auto">${list.map(t=>`<option ${t===val?'selected':''}>${t}</option>`).join('')}</select>`;
  const row=(id,act,checked,title,sub,time)=>`<div class="nrow8"><label class="toggle grow"><span><b>${title}</b><br><span class="small muted">${sub}</span></span><input type="checkbox" class="switch" id="${id}" data-act="${act}" ${checked?'checked':''}></label>${checked&&time?time:''}</div>`;
  return `<div class="screen">${head8('Настройки','Уведомления')}
   <div class="card"><label class="toggle"><span><b>Напоминания в Telegram</b><br><span class="small muted">Пришлём в бот, через который вы вошли</span></span><input type="checkbox" class="switch" id="tg8" data-act="tg8" ${on?'checked':''}></label></div>
   ${on?`<div class="card list8">
    ${row('tgm8','tgm8',p.tgMorning8!==false,'Утром — что готовим сегодня','Блюда дня и что достать из морозилки',tsel('tgmT8','tgmT8',p.tgMorningT8||'08:00',['07:00','08:00','09:00','10:00']))}
    ${row('tgd8','tgd8',p.tgDinner8!==false,'Пора готовить ужин','Рецепт и таймер в одно касание',tsel('tgdT8','tgdT8',p.tgDinnerT8||'18:00',['17:00','18:00','19:00','20:00']))}
    ${row('remOn','remOn',p.reminder.on,'Накануне — проверить продукты','Чего не хватает для завтрашних блюд',tsel('remT','remT',p.reminder.time,['18:00','19:00','20:00','21:00','22:00']))}
   </div>`:''}
   <p class="small muted">Можно выключить в любой момент — здесь или командой /stop в боте.</p></div>`}
function pRecipes8(){
  const tab=UI.rtab8||'fav',favs=(S.fav8||[]).map(recipeById8).filter(Boolean);
  const card=(r,act,v)=>`<button class="card recrow" data-act="${act}" data-v="${v}"><div class="row"><div class="thumb">${dishArt(r)}</div><span class="grow"><span class="dish">${esc(r.n)}</span><br><span class="small muted">${r.t} мин · ${r.kcal} ккал</span></span><span class="muted">›</span></div></button>`;
  return `<div class="screen">${head8('Настройки','Мои рецепты')}
   <div class="seg" role="tablist">${[['fav',`Любимые${favs.length?' · '+favs.length:''}`],['own',`Свои${S.myRecipes.length?' · '+S.myRecipes.length:''}`]].map(([k,l])=>`<button role="tab" aria-selected="${tab===k}" data-act="rtab8" data-v="${k}">${l}</button>`).join('')}</div>
   ${tab==='fav'?(favs.length?`<p class="small muted">Любимые блюда чаще попадают в меню.</p>${favs.map(r=>card(r,'openRec8',r.id)).join('')}`:'<div class="empty"><p>Нажмите ♡ в карточке блюда — оно появится здесь и будет чаще попадать в меню.</p></div>')
   :`<p class="small muted">Свои рецепты попадают в подбор меню наравне с нашими — с учётом аллергий и ограничений.</p><button class="btn block" data-act="recNew">+ Добавить рецепт</button>
    ${S.myRecipes.length?S.myRecipes.map(r=>`<button class="card recrow" data-act="recEdit" data-v="${r.id}"><div class="row"><div class="thumb">${dishArt(r)}</div><span class="grow"><span class="dish">${esc(r.n)}</span><br><span class="small muted">${MYK8[kindOfMine(r)][0]} · ${r.t} мин · ${r.i.length} ${plural(r.i.length,'продукт','продукта','продуктов')}</span></span><span class="muted">›</span></div></button>`).join(''):'<div class="empty"><p>Пока пусто. Добавьте блюдо, которое любят в семье.</p></div>'}`}</div>`;
}
const kindOfMine=r=>r.m==='b'?'breakfast':r.m==='m'?(r.tags.includes('soup')?'soup':r.tags.includes('salad')?'salad':'dish'):r.m==='p'?'main':r.m==='g'?'side':r.m==='z'?'dessert':r.m==='k'?'drink':'snack';
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
   <div class="card"><h3>Что входит в Premium</h3><ul class="plain8">${['Сравнение цен: где купить дешевле','Подборка акций ВкусВилла и Лавки','Перекусы, десерты и напитки в меню'].map(x=>`<li>${x}</li>`).join('')}</ul></div>
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
const SCR8={pNotify:pNotify8,rec8:rec8,today:scrToday8,menu:()=>scrMenu8(false),shop:scrShop8,home:scrHome8,pFamily:pFamily8,pFood:pFood8,pRecipes:pRecipes8,pRecipe:pRecipe8,pDays:pDays8,
  promo:()=>premium8()?`${trialOn8()?`<div class="trialbar8">${premiumNote8()}</div>`:''}`+scrPromo():offer8('Акции и сравнение цен','Каждую неделю — скидки ВкусВилла и Лавки на продукты из вашего меню и сравнение корзины.'),
  kcal:()=>`<div class="screen">${head8('Настройки','Подсчёт калорий')}${kcalToggle()}</div>`,sub:scrSub8,metrics:scrMetrics,diary:diary8,pBudget:pBudget8};
kcalToggle=(function(orig){return function(){const was=V().ul.kcal; V().ul.kcal=V().ul.kcal||'v8'; const h=orig(); if(!was) delete V().ul.kcal; return h}})(kcalToggle);

/* v8.7: cooking timers keep running on every screen — a pill at the top centre; a notification when one ends. */
let SWREG8=null; try{if('serviceWorker' in navigator&&location.protocol!=='file:') navigator.serviceWorker.register('src/sw8.js',{scope:'src/'}).then(r=>{SWREG8=r}).catch(()=>{})}catch(e){}
function askNotify8(){try{if('Notification' in window&&Notification.permission==='default') Notification.requestPermission()}catch(e){}}
window.timerDone8=function(t){try{if(!('Notification' in window)||Notification.permission!=='granted') return; const o={body:'Готово: '+t.label,icon:'src/frigo-logo.jpg',tag:'frigo-timer',renotify:true};
  if(SWREG8&&SWREG8.active) SWREG8.showNotification('Frigo · таймер',o); else new Notification('Frigo · таймер',o)}catch(e){}};
function pill8(){
  let el=document.getElementById('tpill8'); if(!el){el=document.createElement('div'); el.id='tpill8'; el.className='tpill8'; document.body.append(el)}
  const list=Object.entries(TIMERS).filter(([,t])=>t.running||t.done);
  if(UI.cook||!list.length||S.stage!=='app'){el.hidden=true; el.innerHTML=''; return}
  el.hidden=false; el.innerHTML=list.slice(0,2).map(([k,t])=>`<button class="tp8 ${t.done?'done':''}" data-act="tpill8" data-v="${esc(k)}" aria-live="polite">⏱ <span class="tl8">${esc(t.label)}</span> <b>${t.done?'готово!':fmtTime(timerLeft(t))}</b></button>`).join('');
}
paintTimers=(function(orig){return function(){orig(); pill8()}})(paintTimers);
function openTimer8(key){
  const j=key.lastIndexOf(':'),rid=key.slice(0,j),step=+key.slice(j+1),t=TIMERS[key]; if(t&&t.done) delete TIMERS[key];
  let at=null; if(S.plan) S.plan.days.forEach((d,di)=>Object.keys(d.slots).forEach(k=>{const sl=d.slots[k]; if(!at&&sl&&!sl.left&&sl.rid===rid) at={di,k}}));
  if(at){UI.sheet=null; UI.cook={rid,day:at.di,slot:at.k,step}; requestWake()} else if(t&&t.done) toast('Таймер выключен');
}
/* ---------- render ---------- */
render=function(){
  const app=$('#app'); P8(); ensureRecipes(); if(!SCR8[S.tab]) S.tab='today';
  const st=S.stage,signed=!!FamilyMenuApi.session;
  if(st==='intro'&&!signed) app.innerHTML=intro8();
  else if(st==='quiz') app.innerHTML=quiz8();
  else if(st==='gen') app.innerHTML=loader8();
  else if(st==='ready'&&!signed) app.innerHTML=ready8();
  else if(!signed) app.innerHTML=auth8();
  else {if(S.plan&&pantrySig8()!==S.hfSig8){S.hfSig8=pantrySig8(); const n=homeFit8(); if(n){save(); setTimeout(()=>toast(`Подобрали ${n} ${plural(n,'блюдо','блюда','блюд')} из продуктов «Дома»`),50)}}
   if(S.plan) snapDiary8(); app.innerHTML=appbar8()+SCR8[S.tab]()+tabs8()+drawer8()+(UI.board?board8():'')}
  renderSheet(); renderCook(); paintTimers(); clampChips();
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
   case 'qNext8': if((S.qStep||0)===0) track('why_answered',{why:(S.why8||[]).join(',')}); S.qStep=Math.min(QUIZ8.length-1,(S.qStep||0)+1); window.scrollTo(0,0); return true;
   case 'qBack8': if((S.qStep||0)>0) S.qStep--; else S.stage=S.plan?(FamilyMenuApi.session?'app':'ready'):'intro'; window.scrollTo(0,0); return true;
   case 'build8': track('onboarding_done',{members:p.members.length,days:p.days}); build(); return 'done';
   case 'goal8': {let g=S.ans.goals||(p.goals.length?[...p.goals]:[]); if(v==='none') g=g.includes('none')?[]:['none']; else {g=g.filter(x=>x!=='none'); g=g.includes(v)?g.filter(x=>x!==v):[...g,v]; if(v==='lose') g=g.filter(x=>x!=='mass'); if(v==='mass') g=g.filter(x=>x!=='lose')}
     S.ans.goals=g; p.goals=g.filter(x=>x!=='none'); p.members.forEach(m=>{if(m.kind==='adult') m.goal=p.goals.includes('lose')?'lose':p.goals.includes('mass')?'gain':'keep'}); return true}
   case 'why8': {const w=S.why8||[]; S.why8=w.includes(v)?w.filter(x=>x!==v):[...w,v]; return true}
   case 'diet8': S.ans.diet=true; p.diet=v; return true;
   case 'more8': UI.open8=UI.open8||{}; UI.open8[v]=!UI.open8[v]; return true;
   case 'days8': p.days=Math.max(1,Math.min(7,p.days+ +v)); return true;
   case 'kind8': {const [k,o]=v.split(':'),l=p.mealSetup[k]; p.mealSetup[k]=l.includes(o)?l.filter(x=>x!==o):[...l,o]; P8(); return true}
   case 'cat8': UI.cat8=UI.cat8===v?null:v; return true;
   case 'pantryStep8': {const [index,direction]=v.split(':').map(Number),item=S.pantry[index];if(!item||![-1,1].includes(direction))return true;item.qty=FamilyMenuPantryQty.change(ING[item.key][2],item.qty,direction);setTimeout(()=>document.getElementById('pqty_'+index)?.focus({preventScroll:true}),0);return true}
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
   case 'bought': {if(!S.plan) return false; const it=shopping().items.find(i=>i.k===v); S.bought[v]=!S.bought[v];
     S.pantry=S.pantry.filter(x=>!(x.key===v&&x.src==='left8'&&x.plan===S.plan.created));
     if(S.bought[v]&&it&&it.left>=1){S.pantry.push({key:v,qty:Math.round(it.left),src:'left8',plan:S.plan.created}); toast(`Остаток ${fmtQty(v,it.left)} добавили в «Дома»`)} return true}
   case 'side8': {const sh=UI.sheet; if(!sh||sh.type!=='replace') return false; const sl=S.plan.days[sh.day].slots[sh.slot],cur=RBY[sl.rid],mm=cur&&/^c_(.+)_(g\d+)$/.exec(cur.id); if(!mm||!RBY[v]) return true;
     sl.rid=comboOf(RBY[mm[1]],RBY[v]).id; UI.sheet=null; toast('Гарнир заменён'); return true}
   case 'ingDrop8': case 'ingAdd8': case 'ingReset8': case 'iq8': {const sh=UI.sheet; if(!sh||sh.type!=='recipe') return false; const sl=S.plan.days[sh.day].slots[sh.slot],cur=RBY[sl.rid]; if(!cur||sl.left) return true;
     const baseId=cur.base8||cur.id;
     if(a==='ingReset8'){sl.rid=baseId; return true}
     let list=cur.i.map(x=>[...x]);
     if(a==='iq8'){const [k,val]=[v.slice(0,v.lastIndexOf(':')),+v.slice(v.lastIndexOf(':')+1)],f=sl.serv/4; if(!(val>0)){if(list.length<2) return true; list=list.filter(([x])=>x!==k)} else list=list.map(([x,q])=>x===k?[x,Math.round(val/f*1000)/1000]:[x,q])}
     if(a==='ingDrop8'){const was=list.find(([k])=>k===v); list=list.filter(([k])=>k!==v); if(!list.length){toast('В блюде должен остаться хотя бы один продукт'); return true} UI.drop8=was}
     else if(a==='ingAdd8'){const u=ING[v][2],d=UI.drop8&&ING[UI.drop8[0]][2]===u?UI.drop8[1]:(u==='g'||u==='ml')?150:1; list.push([v,d]); UI.ia8=''; UI.drop8=null}
     const base=ensureBase8(baseId),same=base&&base.i.length===list.length&&base.i.every(([k,q])=>list.some(([x,y])=>x===k&&y===q));
     const r=same?base:variant8(baseId,list); if(r) sl.rid=r.id; return true}
   case 'lighter8': {const day=S.plan.days[+v],cap=KCAL_TARGET8,before=dayKcal8(day);
     for(let n=0;n<14&&dayKcal8(day)>cap;n++){const keys=Object.keys(day.slots).filter(k=>day.slots[k].rid&&RBY[day.slots[k].rid]&&!day.slots[k].cooked).sort((a,b)=>RBY[day.slots[b].rid].kcal-RBY[day.slots[a].rid].kcal);
       if(keys.some(k=>swapFor8(day,k,(r,cur)=>r.kcal<cur.kcal))) continue; if(!shrink8(day)) break}
     toast(dayKcal8(day)<before?`Стало легче на ${num(before-dayKcal8(day))} ккал`:'Легче подобрать не получилось'); return true}
   case 'cheaper8': {const before=shopping().cost; fit8(); const after=shopping().cost; toast(after<before-1?`Дешевле на ${rub(before-after)}`:'Дешевле подобрать не получилось'); return true}
   case 'kpick8': {const ti=todayIdx(); if(ti<0) return true; const [t,id]=[v.slice(0,1),v.slice(2)],q=+((document.getElementById('kqty8')||{}).value||0),e=eatPortion8({t,id,n:t==='r'?RBY[id].n:ING[id][0].replace(/\s*\(.*?\)/,'')},q);
     const dk=S.plan.days[ti].date.slice(0,10); S.extra[dk]=S.extra[dk]||{}; (S.extra[dk][UI.member]=S.extra[dk][UI.member]||[]).push(e);
     S.exm8=S.exm8||{}; S.exm8[dk+'|'+UI.member+'|'+e.label]=[e.P,e.F,e.C]; UI.kq8=''; toast(`${e.label} ≈ ${e.kcal} ккал`); return true}
   case 'tg8': p.tg8=!!el.checked; track('tg_reminders',{on:p.tg8}); if(p.tg8) toast('Напоминания включены — пришлём в Telegram'); return true;
   case 'tgm8': p.tgMorning8=!!el.checked; return true;
   case 'tgd8': p.tgDinner8=!!el.checked; return true;
   case 'tgmT8': p.tgMorningT8=v; return true;
   case 'tgdT8': p.tgDinnerT8=v; return true;
   case 'kwho8': UI.member=v; return true;
   case 'norep8': p.noRepeat8=!!el.checked; return true;
   case 'tpill8': openTimer8(v); return true;
   case 'swipeDel8': {const [d,k]=v.split(':'),day=S.plan.days[+d]; if(day&&day.slots[k]){const r=slotRecipe(+d,k); UI.undo8={d:+d,k,slot:day.slots[k]}; delete day.slots[k]; toast(`Убрали «${r?r.n:'блюдо'}» из меню`)} return true}
   case 'resetAll8': if(!UI.resetAsk8){UI.resetAsk8=true; setTimeout(()=>{UI.resetAsk8=false},4000); return true}
     UI.resetAsk8=false; {const b=blank(); S.profile={...b.profile,members:S.profile.members.map(m=>({...m,custom:''}))}; S.profile.mealSetup={b:['breakfast'],l:['soup'],s:[],d:['pair']}; S.profile.days=3; S.profile.kcalOn=true; S.store='vv'; S.theme='system'; S.history.blocked=[]; S.ans={}}
     toast('Настройки сброшены. Меню пересоберётся с настройками по умолчанию'); return true;
   case 'extrasSeen8': V().seen.extras8=1; return true;
   case 'extrasGo8': V().seen.extras8=1; S.tab='pDays'; UI.fromDrawer8=false; window.scrollTo(0,0); return true;
   case 'board8': UI.board=true; track('leaderboard_opened'); return true;
   case 'share8': {const t=shopping().items.filter(i=>!i.covered&&!i.bought).map(i=>`• ${i.name} — ${fmtQty(i.k,i.toBuy,true)}`).join('\n'); FamilyMenuShare.share({text:'Список покупок:\n'+t,url:location.origin+location.pathname}); return 'done'}
   case 'close': if(UI.board){UI.board=false; return true} return false;
   case 'photoAdd': {const inp=document.createElement('input'); inp.type='file'; inp.accept='image/jpeg,image/png,image/webp'; inp.multiple=true; inp.style.display='none'; inp.onchange=()=>{photoFiles8(inp.files); inp.remove()}; document.body.append(inp); inp.click(); return 'done'}
   case 'photoDel': UI.photos.splice(+v,1); return true;
   case 'scan8': scan8(); return 'done';
   case 'scanSel': UI.scan.on[+v]=!UI.scan.on[+v]; return true;
   case 'scanAlt': {const [i,id]=v.split(':');if(!ING[id])return true;UI.scan.pick[+i]=UI.scan.pick[+i]===id?null:id;UI.scan.qty[+i]=FamilyMenuScanInventory.parseAmount(UI.scan.products[+i].amount,ING[id][2]);return true}
   case 'scanCancel': UI.scan=null; return true;
   case 'scanSave': {const sc=UI.scan;if(!sc)return true;const additions=[];
     for(let i=0;i<sc.products.length;i++){const id=scanChoice8(sc,i);if(!id||!ING[id])continue;const qty=scanQuantity8(sc,i,id);if(qty===null){toast('Укажите количество для каждого выбранного продукта');return true}additions.push({key:id,qty})}
     if(!additions.length){toast('Выберите продукты для добавления');return true}
     try{S.pantry=FamilyMenuScanInventory.add(S.pantry,additions)}catch(error){toast(error.message);return true}
     const n=new Set(additions.map(p=>p.key)).size;UI.scan=null;UI.photos=[];toast(`Обновили запасы: ${n} ${plural(n,'продукт','продукта','продуктов')}`);return true}
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
     const r={id:e.id||'u'+Date.now().toString(36),n:e.n.trim(),m,t:Math.max(1,Math.round(+e.t||30)),tags:e.kind==='soup'?['soup','mine']:e.kind==='salad'?['salad','mine']:['mine'],i:e.i.map(([id,q])=>[id,Math.round(q*k*1000)/1000]),sp:[],s:e.s.map(x=>x.trim()).filter(Boolean)};
     S.myRecipes=S.myRecipes.filter(x=>x.id!==r.id).concat([r]); if(RBY[r.id]){delete RBY[r.id]; const i=R.findIndex(x=>x.id===r.id); if(i>=0) R.splice(i,1)}
     registerMine(r); track(e.id?'recipe_edited':'recipe_added',{kind:e.kind}); toast('Рецепт сохранён — он попадёт в меню'); UI.edit=null; S.tab='pRecipes'; return true}
   case 'recDel': {const id=UI.edit.id; S.myRecipes=S.myRecipes.filter(x=>x.id!==id); UI.edit=null; S.tab='pRecipes'; toast('Рецепт удалён'); return true}
   case 'reset': S.stage='quiz'; S.qStep=0; S.ans={}; UI.sheet=null; window.scrollTo(0,0); return true;
  }
  return false;
}
function rescaleFamilyMenu8(before){
  const after=cookingScale();if(!S.plan||Math.abs(after-before)<1e-8||!(before>0))return false;
  for(const day of S.plan.days)for(const slot of Object.values(day.slots))if(slot&&!slot.left&&!slot.cooked)slot.serv=Math.round(Math.min(100,slot.serv*after/before)*10000)/10000;
  return true;
}
act=(function(orig){return function(a,v,el){
  const before=cookingScale();
  if(!PAGES8[S.tab]) UI.prevTab8=S.tab;
  if(a==='tgo') askNotify8();
  const r=v8Act(a,v,el);
  if(r){rescaleFamilyMenu8(before);if(r===true){save(); render()} else save(); return}
  if(a==='tab'&&!PAGES8[v]&&!['today','menu','shop','home'].includes(v)) v='today';
  const result=orig(a,v,el);if(rescaleFamilyMenu8(before)){save();render()}return result;
}})(act);

/* ---------- inputs that should not re-render on every key ---------- */
document.addEventListener('keydown',e=>{if(e.target.dataset?.act==='pqty' && ['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const item=S.pantry[+e.target.dataset.v];if(!item)return;item.qty=FamilyMenuPantryQty.normalise(ING[item.key][2],e.target.value);act('pantryStep8',e.target.dataset.v+':'+(e.key==='ArrowUp'?1:-1));}});
document.addEventListener('input',e=>{const t=e.target,a=t.dataset&&t.dataset.act; if(!a) return;
  if(a==='scanQty8'&&UI.scan){const index=+t.dataset.v;UI.scan.qty[index]=t.value;const selected=UI.scan.products.map((p,i)=>[i,scanChoice8(UI.scan,i)]).filter(([,id])=>id&&ING[id]),invalid=selected.some(([i,id])=>scanQuantity8(UI.scan,i,id)===null);const button=document.querySelector('[data-act="scanSave"]');if(button)button.disabled=!selected.length||invalid;const note=document.getElementById('scan-qty-note');if(note)note.hidden=!invalid;return}
  if(a==='search8'){UI.q8=t.value; render(); refocus('pq8')}
  else if(a==='rsearch8'){UI.rs8=UI.rs8||{}; UI.rs8[t.dataset.v]=t.value; render(); refocus('rs8_'+t.dataset.v)}
  else if(a==='rq8'){UI.rq=t.value; render(); refocus('rq8')}
  else if(a==='ia8'){UI.ia8=t.value; render(); refocus('ia8')}
  else if(a==='kq8'){UI.kq8=t.value; render(); refocus('kadd')}
  else if(a==='rf8'&&UI.edit){const f=t.dataset.v; UI.edit[f]=f==='n'?t.value:+t.value; const b=document.querySelector('[data-act="recSave"]'); if(b) b.disabled=!(UI.edit.n.trim()&&UI.edit.i.length&&UI.edit.s.some(x=>x.trim()))}
  else if(a==='ri8'&&UI.edit){const q=+String(t.value).replace(',','.'); if(q>0) UI.edit.i[+t.dataset.v][1]=q}
  else if(a==='rstep8'&&UI.edit){UI.edit.s[+t.dataset.v]=t.value; const b=document.querySelector('[data-act="recSave"]'); if(b) b.disabled=!(UI.edit.n.trim()&&UI.edit.i.length&&UI.edit.s.some(x=>x.trim()))}
},true);
document.addEventListener('change',e=>{const t=e.target,a=t.dataset&&t.dataset.act; if(!a) return;
  if(a==='rk8'||a==='theme8'||a==='kwho8'||a==='norep8'||a==='tgmT8'||a==='tgdT8'){act(a,a==='norep8'?t.checked:t.value,t)}
  else if(['tg8','tgm8','tgd8'].includes(a)){act(a,t.checked,t)}
  else if(a==='iq8'){act('iq8',t.dataset.v+':'+String(t.value).replace(',','.'),t)}
  else if(a==='scanSel'){act(a,t.dataset.v,t)}
});
document.addEventListener('submit',e=>{const f=e.target; if(!f.dataset||f.dataset.form!=='kadd') return; const first=eatFind8(UI.kq8||'')[0]; if(first){e.preventDefault(); e.stopImmediatePropagation(); act('kpick8',first.t+':'+first.id)}},true);
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
