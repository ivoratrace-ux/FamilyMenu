/* ============ STEP ANALYSIS: quantities, timers, actions, tips, pictures ============ */
const STEMS={chicken_fillet:['филе','куриц'],chicken_thigh:['куриц','бедр','бёдр'],chicken_liver:['печен'],beef:['говядин','мяс'],pork:['свинин','мяс'],minced_mix:['фарш'],minced_turkey:['фарш'],turkey:['индейк','филе'],
 fish_white:['рыб','филе','минта'],cod:['рыб','треск'],salmon:['рыб','семг','сёмг'],tuna:['тунец','тунц'],shrimp:['кревет'],squid:['кальмар'],eggs:['яйц','яйцо','яиц','желт'],milk:['молок'],kefir:['кефир'],
 yogurt:['йогурт'],sour_cream:['сметан'],cheese:['сыр'],feta:['фет'],cottage:['творог'],butter:['сливочн','масл'],cream:['сливк'],tofu:['тофу'],potato:['картоф'],onion:['лук'],carrot:['морков'],
 cabbage:['капуст'],beet:['свекл','свёкл'],tomato:['помидор'],cucumber:['огурц','огурец'],bell_pepper:['перец','перц'],zucchini:['кабач'],eggplant:['баклаж'],pumpkin:['тыкв'],broccoli:['брокколи'],
 cauliflower:['капуст'],green_peas:['горош'],corn:['кукуруз'],spinach:['шпинат'],lettuce:['салат'],celery:['сельдер'],greens:['зелен','укроп'],garlic:['чеснок'],mushrooms:['гриб'],avocado:['авокадо'],
 lemon:['лимон'],orange:['апельсин'],apple:['яблок'],banana:['банан'],berries:['ягод'],rice:['рис'],buckwheat:['гречк','гречн'],bulgur:['булгур'],millet:['пшен'],quinoa:['киноа'],pasta:['макарон','паст'],
 noodles:['вермишел','лапш','макарон'],oats:['хлопь','овсян'],flour:['мук'],lentils:['чечевиц'],chickpeas:['нут'],beans:['фасол'],canned_tomatoes:['томат'],tomato_paste:['томатн'],coconut_milk:['кокос'],
 sugar:['сахар'],honey:['мед','мёд'],oil:['масл'],soy_sauce:['соев'],mustard:['горчиц'],sesame:['кунжут'],walnuts:['орех'],peanut_butter:['арахис'],bread:['хлеб','батон'],lavash:['лаваш'],
 cocoa:['какао'],tea:['чай'],cranberries:['клюкв'],raisins:['изюм'],semolina:['манк'],barley:['перлов'],peas_dry:['горох'],pickles:['огурц','огурец'],processed_cheese:['сыр']};
const ICOL={chicken_fillet:'#e8b98a',chicken_thigh:'#d99a5c',chicken_liver:'#7a2e24',beef:'#8b3a28',pork:'#d98f78',minced_mix:'#a5523a',minced_turkey:'#d9a088',turkey:'#efc9a8',fish_white:'#f2ece2',cod:'#f2ece2',
 salmon:'#ef8b5f',tuna:'#d9b8a0',shrimp:'#f29a72',squid:'#efe6d6',eggs:'#f4c430',milk:'#fbf8f0',kefir:'#fbf8f0',yogurt:'#fbfaf5',sour_cream:'#fbfaf4',cheese:'#f5cf5d',feta:'#fbfbf5',cottage:'#fbf8f0',
 butter:'#f6e08a',cream:'#fbf6ea',tofu:'#f1e2bd',potato:'#e9c46a',onion:'#efe2c8',carrot:'#ef8a2b',cabbage:'#cfe0a8',beet:'#8e2440',tomato:'#e0442f',cucumber:'#6aa552',bell_pepper:'#e2482f',zucchini:'#a8c86a',
 eggplant:'#5b2a5e',pumpkin:'#f0913a',broccoli:'#4f8a3d',cauliflower:'#efe6cf',green_peas:'#7cb342',corn:'#f2c94c',spinach:'#3f7a32',lettuce:'#8cc265',celery:'#9cc77f',greens:'#5a9e48',garlic:'#f3ecdc',
 mushrooms:'#d9c3a2',avocado:'#8fae4a',lemon:'#f2d33a',orange:'#f28c1c',apple:'#d94b3a',banana:'#f2df8a',berries:'#9b2c48',rice:'#f5f0e2',buckwheat:'#9b6a43',bulgur:'#d8b26e',millet:'#f0c75a',quinoa:'#e8d9ae',
 pasta:'#f1d27a',noodles:'#f0d27f',oats:'#e2cd9e',flour:'#faf6ec',lentils:'#d9822b',chickpeas:'#dfbd76',beans:'#8c2f2f',canned_tomatoes:'#c8432c',tomato_paste:'#b8332a',coconut_milk:'#fbf8f2',sugar:'#ffffff',
 honey:'#e2a22a',oil:'#f2d675',soy_sauce:'#4a2a1a',mustard:'#d9b13a',sesame:'#f6efd8',walnuts:'#a8743f',peanut_butter:'#b7793d',bread:'#e3b878',lavash:'#ecd9a8',cocoa:'#6a3e25',tea:'#b5651d',
 cranberries:'#b8233a',raisins:'#6b3a2a',semolina:'#f6efdc',barley:'#d8c49a',peas_dry:'#e8c84a',pickles:'#7a8f3a',processed_cheese:'#f2d07a'};
const ACTIONS=[
 ['bake',/запек|выпека|духовк|в духовку/,'Духовку разогрейте заранее, 10–15 минут. Ставьте форму на средний уровень и не открывайте дверцу первые 15 минут.','Духовка'],
 ['blend',/блендер|пробейте/,'Горячее пробивайте осторожно: заполните чашу не больше чем наполовину и придерживайте крышку полотенцем.','Блендер'],
 ['fry',/обжар|жарьт|жарит|подрумян|подсушит|растоп/,'Разогрейте сковороду с маслом 1–2 минуты. Не перегружайте её — иначе продукты будут тушиться, а не жариться, и не будет корочки.','Сковорода'],
 ['stew',/туши|томит|под крышкой/,'Огонь — слабый, крышка закрыта. Заглядывайте раз в 10 минут; если жидкость выкипела, подлейте немного горячей воды.','Сотейник или кастрюля'],
 ['boil',/свар|варит|отвар|кипя|бульон|кипят|залейте .*вод|залейте .*л /,'Солите воду после закипания. Первые минуты снимайте пену шумовкой — бульон будет прозрачнее.','Кастрюля'],
 ['cut',/нареж|натрит|нашинк|порубит|измельч|отбейт|очист|разрежьт|выньте серединку/,'Режьте на устойчивой доске, пальцы держите «лапкой». Кусочки одного размера приготовятся одновременно.','Нож и доска'],
 ['shape',/сформир|скатай|начин|заверн|сложит|выкладывайт|раскатай/,'Смачивайте руки холодной водой — масса не будет липнуть, а изделия получатся ровными.','Доска или противень'],
 ['mix',/смеша|взбей|перемеш|разомн|замес|соедин|добавьте|всыпьт|влейт|замочит|промойт/,'Смешивайте в широкой миске — так удобнее и ничего не разлетается.','Миска'],
 ['serve',/подава|посыпь|разлож|выложит|разлейт|сбрызн|полейт|намажьт|наре?жьте треуг/,'Подавайте сразу, пока горячее. Зелень добавляйте в самом конце — она сохранит цвет и аромат.','Тарелки'],
];
const norm=t=>t.toLowerCase().replace(/ё/g,'е');
function stepDur(t){
  const s=norm(t); let m=s.match(/(\d+(?:[.,]\d+)?)\s*(?:[–-]\s*(\d+(?:[.,]\d+)?))?\s*(час|минут|мин|секунд)/);
  if(!m) return 0; const v=parseFloat((m[2]||m[1]).replace(',','.')),u=m[3];
  return Math.round(u.startsWith('час')?v*3600:u.startsWith('сек')?v:v*60);
}
function stepAction(t){const s=norm(t); for(const a of ACTIONS) if(a[1].test(s)) return a; return ACTIONS.find(a=>a[0]==='mix')}
function stepIngs(r,t){
  const s=' '+norm(t); const out=[];
  r.i.forEach(([k,q])=>{const st=STEMS[k]||[norm(ING[k][0]).split(' ')[0].slice(0,-1)];
    if(st.some(x=>new RegExp('[^а-яa-z]'+norm(x)).test(s))) out.push([k,q]);});
  return out;
}
function stepArt(r,idx){
  const t=r.s[idx],a=stepAction(t)[0],ings=stepIngs(r,t),cols=(ings.length?ings:r.i.slice(0,3)).map(([k])=>ICOL[k]||'#d9b38a');
  if(a==='serve') return dishArt(r);
  let seed=(idx+1)*9301+r.id.length*49297; const g=()=>{seed=(seed*9301+49297)%233280;return seed/233280};
  const W=400,H=260; let o=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Шаг ${idx+1}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="#efe9dd"/><rect y="190" width="${W}" height="70" fill="#e2d8c6"/>`;
  const piece=(x,y,s,c,shape)=>shape==='round'?`<circle cx="${x}" cy="${y}" r="${s}" fill="${c}" stroke="rgba(0,0,0,.08)"/>`:`<rect x="${x-s}" y="${y-s}" width="${s*2}" height="${s*2}" rx="${s*.35}" fill="${c}" stroke="rgba(0,0,0,.08)" transform="rotate(${Math.round(g()*60-30)} ${x} ${y})"/>`;
  const scatter=(cx,cy,rx,ry,n,s,shape)=>{let p='';for(let i=0;i<n;i++){const an=g()*6.283,rr=Math.sqrt(g());p+=piece(Math.round(cx+Math.cos(an)*rr*rx),Math.round(cy+Math.sin(an)*rr*ry),s,cols[i%cols.length],shape)}return p};
  if(a==='cut'){o+=`<rect x="70" y="95" width="230" height="120" rx="16" fill="#c99a62"/><rect x="70" y="95" width="230" height="120" rx="16" fill="none" stroke="#b5864f" stroke-width="3"/><circle cx="280" cy="112" r="6" fill="#b5864f"/>`;
    o+=scatter(165,160,70,35,12,9,'cube');
    o+=`<g transform="rotate(-18 290 120)"><rect x="250" y="112" width="120" height="22" rx="4" fill="#cfd5d9"/><path d="M250 112h120l-12 22h-108z" fill="#b8c0c6"/><rect x="370" y="110" width="58" height="26" rx="8" fill="#3b3330"/></g>`;}
  else if(a==='fry'){o+=`<ellipse cx="190" cy="168" rx="125" ry="52" fill="#2d2d2d"/><ellipse cx="190" cy="160" rx="112" ry="42" fill="#3d3d3d"/><rect x="300" y="150" width="95" height="20" rx="9" fill="#2b2b2b"/>`;
    o+=scatter(190,158,85,26,12,10,'cube');
    for(let i=0;i<3;i++) o+=`<path d="M${150+i*40} 98q8-12 0-24t0-24" fill="none" stroke="#bfb6a6" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;}
  else if(a==='boil'||a==='stew'){o+=`<rect x="105" y="95" width="190" height="125" rx="18" fill="#9aa5ad"/><rect x="95" y="88" width="210" height="18" rx="9" fill="#b7c1c8"/><rect x="80" y="120" width="25" height="12" rx="6" fill="#7d878e"/><rect x="295" y="120" width="25" height="12" rx="6" fill="#7d878e"/>`;
    if(a==='stew') o+=`<ellipse cx="200" cy="86" rx="108" ry="12" fill="#c6ced3"/><circle cx="200" cy="72" r="10" fill="#4a4a4a"/>`;
    else {o+=`<ellipse cx="200" cy="98" rx="98" ry="10" fill="${cols[0]}" opacity=".9"/>`+scatter(200,98,80,6,8,7,'round');}
    for(let i=0;i<3;i++) o+=`<path d="M${165+i*35} ${a==='stew'?58:78}q8-12 0-22t0-22" fill="none" stroke="#bfb6a6" stroke-width="3" stroke-linecap="round" opacity=".75"/>`;
    o+=`<rect x="110" y="225" width="180" height="10" rx="5" fill="#e3572e" opacity=".85"/>`;}
  else if(a==='bake'){o+=`<rect x="80" y="40" width="240" height="190" rx="18" fill="#3a3f44"/><rect x="100" y="80" width="200" height="120" rx="10" fill="#1f2326"/><rect x="100" y="80" width="200" height="120" rx="10" fill="#f0913a" opacity=".22"/>`;
    o+=`<rect x="120" y="150" width="160" height="34" rx="8" fill="#efe6d6"/>`+scatter(200,160,65,10,9,8,'cube');
    for(let i=0;i<4;i++) o+=`<circle cx="${120+i*22}" cy="60" r="7" fill="#80878d"/>`; o+=`<rect x="110" y="66" width="180" height="5" rx="2" fill="#c84b2a"/>`;}
  else if(a==='blend'){o+=`<rect x="160" y="200" width="80" height="35" rx="8" fill="#3b3b3b"/><path d="M150 60h100l-14 140h-72z" fill="#dfe9ee" stroke="#b9c8cf" stroke-width="3"/><path d="M158 110h84l-9 88h-66z" fill="${cols[0]}" opacity=".9"/><rect x="146" y="50" width="108" height="14" rx="6" fill="#3b3b3b"/>`;}
  else if(a==='shape'){o+=`<rect x="60" y="110" width="280" height="105" rx="14" fill="#efe6d6" stroke="#d9cdb8" stroke-width="3"/>`;
    for(let i=0;i<5;i++) o+=`<ellipse cx="${100+i*50}" cy="${150+(i%2)*25}" rx="20" ry="14" fill="${cols[0]}" stroke="rgba(0,0,0,.1)"/>`;}
  else { // mix
    o+=`<path d="M95 120h210a105 70 0 0 1 -210 0z" fill="#f7f3eb" stroke="#ddd5c6" stroke-width="3"/><ellipse cx="200" cy="120" rx="105" ry="20" fill="#e9e2d4"/><ellipse cx="200" cy="121" rx="92" ry="15" fill="${cols[0]}" opacity=".9"/>`;
    o+=scatter(200,120,75,9,10,7,'round');
    o+=`<g transform="rotate(25 250 70)"><rect x="244" y="10" width="10" height="70" rx="5" fill="#6d6d6d"/><path d="M249 80c-22 10-22 50 0 60c22-10 22-50 0-60z" fill="none" stroke="#9aa3a8" stroke-width="3"/><path d="M249 80c-10 10-10 50 0 60c10-10 10-50 0-60z" fill="none" stroke="#9aa3a8" stroke-width="3"/></g>`;}
  return o+'</svg>';
}
function fmtTime(sec){sec=Math.max(0,Math.ceil(sec));const m=Math.floor(sec/60),s=sec%60;return (m>=60?Math.floor(m/60)+':'+String(m%60).padStart(2,'0'):m)+':'+String(s).padStart(2,'0')}
function durLabel(sec){if(sec>=3600){const h=Math.floor(sec/3600),m=Math.round(sec%3600/60);return h+' ч'+(m?' '+m+' мин':'')} if(sec>=60) return Math.round(sec/60)+' мин'; return sec+' сек'}
function equipment(r){const set=new Set();r.s.forEach(t=>set.add(stepAction(t)[3]));return [...set].filter(x=>x!=='Тарелки')}

/* ============ TIMERS (shared by recipe card and cook mode) ============ */
const TIMERS={}; // key -> {total,left,running,endAt,label}
function tKey(rid,i){return rid+':'+i}
function timerToggle(key,total,label){const t=TIMERS[key]||(TIMERS[key]={total,left:total,running:false,label});
  if(t.running){t.left=Math.max(0,(t.endAt-Date.now())/1000);t.running=false} else {if(t.left<=0) t.left=t.total; t.endAt=Date.now()+t.left*1000;t.running=true;unlockAudio();}
  paintTimers();}
function timerReset(key){const t=TIMERS[key]; if(t){t.left=t.total;t.running=false;} paintTimers()}
function timerAdd(key,sec){const t=TIMERS[key]; if(!t) return; t.left+=sec; t.total+=sec; if(t.running) t.endAt+=sec*1000; paintTimers()}
function timerLeft(t){return t.running?Math.max(0,(t.endAt-Date.now())/1000):t.left}
let AC=null; function unlockAudio(){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==='suspended') AC.resume()}catch(e){}}
function beep(){try{unlockAudio(); if(!AC) return; let t0=AC.currentTime; for(let i=0;i<3;i++){const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=880;o.connect(g);g.connect(AC.destination);g.gain.setValueAtTime(.0001,t0+i*.45);g.gain.exponentialRampToValueAtTime(.3,t0+i*.45+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+i*.45+.35);o.start(t0+i*.45);o.stop(t0+i*.45+.4)}}catch(e){} try{navigator.vibrate&&navigator.vibrate([300,150,300,150,300])}catch(e){}}
function paintTimers(){
  document.querySelectorAll('[data-timer]').forEach(el=>{const t=TIMERS[el.dataset.timer]; const left=t?timerLeft(t):+el.dataset.total; el.textContent=fmtTime(left)});
  document.querySelectorAll('[data-tbtn]').forEach(el=>{const t=TIMERS[el.dataset.tbtn]; el.textContent=t&&t.running?'Пауза':(t&&t.left<t.total&&t.left>0?'Продолжить':'Старт таймера'); el.setAttribute('aria-pressed',!!(t&&t.running))});
  const strip=document.getElementById('tstrip'); if(strip){const run=Object.entries(TIMERS).filter(([,t])=>t.running||(t.left<=0&&t.done)); strip.innerHTML=run.map(([k,t])=>`<span class="tchip ${t.done?'done':''}">${esc(t.label)} · ${t.done?'готово!':fmtTime(timerLeft(t))}</span>`).join(''); strip.hidden=!run.length}
}
setInterval(()=>{let fired=false; Object.values(TIMERS).forEach(t=>{if(t.running&&Date.now()>=t.endAt){t.running=false;t.left=0;t.done=true;fired=true;toast('⏰ Готово: '+t.label);if(window.timerDone8)window.timerDone8(t)}}); if(fired) beep(); if(Object.values(TIMERS).some(t=>t.running)||fired) paintTimers()},500);

/* ============ VKUSVILL LINKS ============ */
const VVQ={chicken_fillet:'филе грудки цыпленка',chicken_thigh:'бедро цыпленка',chicken_liver:'печень цыплят',beef:'говядина мякоть',pork:'шейка свиная',minced_mix:'фарш домашний',minced_turkey:'фарш из индейки',turkey:'филе грудки индейки',
 fish_white:'минтай филе',cod:'треска филе',salmon:'семга филе',tuna:'тунец филе натуральный',shrimp:'креветки очищенные',squid:'кальмар тушка',eggs:'яйцо куриное',milk:'молоко 3,2%',kefir:'кефир 2,5%',
 yogurt:'йогурт греческий',sour_cream:'сметана 15%',cheese:'сыр российский',feta:'фета',cottage:'творог 5%',butter:'масло сливочное 82,5%',cream:'сливки 10%',bread:'батон нарезной',lavash:'лаваш армянский',
 greens:'укроп',berries:'смесь ягодная замороженная',broccoli:'брокколи замороженная',green_peas:'горошек зеленый замороженный',cauliflower:'капуста цветная',canned_tomatoes:'томаты в собственном соку',
 beans:'фасоль красная',chickpeas:'нут консервированный',oil:'масло подсолнечное рафинированное',soy_sauce:'соус соевый',processed_cheese:'сыр плавленый для супа',pickles:'огурцы соленые',tea:'чай черный пакетики',
 cranberries:'клюква замороженная',bell_pepper:'перец красный сладкий',tomato:'томаты',cucumber:'огурцы',potato:'картофель',onion:'лук репчатый',carrot:'морковь',cabbage:'капуста белокочанная',beet:'свекла',
 coconut_milk:'кокосовое молоко',tomato_paste:'томатная паста',sesame:'кунжут',walnuts:'орех грецкий',peanut_butter:'паста арахисовая',honey:'мед натуральный',raisins:'изюм',cocoa:'какао-порошок',
 semolina:'крупа манная',barley:'крупа перловая',peas_dry:'горох колотый',millet:'пшено',rice:'рис круглозерный',buckwheat:'крупа гречневая',oats:'хлопья овсяные',flour:'мука пшеничная',pasta:'макароны',noodles:'вермишель'};
const vvUrl=k=>'https://vkusvill.ru/search/?q='+encodeURIComponent(VVQ[k]||ING[k][0].replace(/\s*\(.*\)/,''));

/* ============ FOOD TEXT → KCAL ============ */
// [stems, kcal per 100 g/ml, grams per piece, grams per portion, drink?]
const FOODS=window.FamilyMenuCatalog.foods.map(f=>[f.stems,f.kcal,f.piece,f.portion]);
const NUMW={'один':1,'одна':1,'одно':1,'одну':1,'два':2,'две':2,'три':3,'четыре':4,'пять':5,'шесть':6,'семь':7,'пол':.5,'половина':.5,'половинку':.5,'полтора':1.5,'полторы':1.5,'пара':2,'пару':2,'несколько':3};
const UNITS=[['кг',1000],['грамм',1],['гр',1],['г',1],['мл',1],['литр',1000],['л',1000],['стакан',250],['кружк',300],['чашк',250],['бутылк',500],['банк',330],['ст.л',15],['ст. л',15],['столов',15],['ч.л',5],['ч. л',5],['чайн',5],['ложк',15],['тарелк',300],['горст',30],['шт','piece'],['кус','piece'],['ломт','slice'],['порци','portion'],['пачк','portion']];
function findFood(s){let best=null; FOODS.forEach(f=>f[0].forEach(st=>{const re=new RegExp('(^|[^а-яa-z])'+norm(st)); if(re.test(s)&&(!best||st.length>best.len)) best={f,len:st.length}})); return best&&best.f}
function parseFoodItem(raw){
  let s=norm(raw).trim().replace(/(\d)([а-я])/g,'$1 $2'); if(!s) return null;
  if(/^\d+(?:[.,]\d+)?\s*(ккал|кал)?$/.test(s)) return {label:raw.trim()+(/кал/.test(s)?'':' ккал'),kcal:Math.round(parseFloat(s.replace(',','.'))),ok:true};
  let qty=null,m=s.match(/^(\d+(?:[.,]\d+)?)\s*/); if(m){qty=parseFloat(m[1].replace(',','.'));s=s.slice(m[0].length)} else {const w=s.split(/\s+/)[0]; if(NUMW[w]!=null){qty=NUMW[w];s=s.slice(w.length).trim()}}
  let unit=null; const EXACT=['кг','гр','г','мл','л','шт']; for(const [u,mul] of UNITS){const exact=EXACT.includes(u); if(s.startsWith(u)&&(!exact||s.length===u.length||/[\s.]/.test(s[u.length]))){unit=mul;s=s.slice(u.length).replace(/^[а-я.]*\s*/,'');break}}
  const f=findFood(s); if(!f) return {label:raw.trim(),ok:false};
  const [,k100,pieceG,portionG]=f; qty=qty==null?1:qty; let g;
  if(typeof unit==='number') g=qty*unit; else if(unit==='slice') g=qty*(pieceG||30); else if(unit==='portion') g=qty*portionG; else g=qty*(pieceG||portionG);
  let kcal=k100*g/100; if(f[4]&&/с сахар/.test(s)) kcal+=20*qty;
  return {label:raw.trim(),kcal:Math.round(kcal),ok:true};
}
function parseFoods(text){return text.split(/[,;\n]|\s+и\s+|\s*\+\s*|\s+плюс\s+/i).map(x=>x.trim()).filter(Boolean).map(parseFoodItem).filter(Boolean)}
// No external artifact integrations. The original local parser uses the server-provided food dictionary.
const SAMPLE=null;
async function aiKcal(){return null;}
