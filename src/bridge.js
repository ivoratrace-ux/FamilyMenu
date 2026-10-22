/* Keep the original renderer and interactions; adapt only persistence, authentication and API search. */
(() => {
  const api=FamilyMenuApi,convert=FamilyMenuState,publicRecipes=new Set(R.map(r=>r.id));
  function clearPrivateRecipes(){for(let i=R.length-1;i>=0;i--)if(!publicRecipes.has(R[i].id)){delete RBY[R[i].id];R.splice(i,1);}}
  let documentRevision=0,stockRevision=0,previousPreferences={},savedState='',savedStock='',generation=0;
  let ready=false,busy=false,scheduled=null,conflict=false,searchTimer=null,searchNumber=0,authNumber=0;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const originalArt=window.dishArt;
  window.dishArt=recipe=>{
    // Preserve all original vector drawings; use server artwork for later catalog additions.
    if(!window.FamilyMenuArtwork[recipe.id] && /^https:\/\/vibe-coding-sc04\.onrender\.com\/assets\/art\/[a-z0-9]+(?:-step-\d+)?\.png$/.test(recipe.imageUrl || ''))return `<svg viewBox="0 0 400 260" role="img" aria-label="${esc(recipe.n)}"><image href="${esc(recipe.imageUrl)}" width="400" height="260"/></svg>`;
    return originalArt(recipe);
  };
  const stockItems=()=>{const amounts=new Map();for(const p of S.pantry)if(p.qty>0)amounts.set(p.key,(amounts.get(p.key) || 0)+p.qty);return [...amounts].map(([ingredientId,quantity])=>({ingredientId,quantity:Math.round(quantity*1000)/1000})).sort((a,b)=>a.ingredientId.localeCompare(b.ingredientId));};
  const stockText=()=>JSON.stringify(stockItems());
  const payload=()=>({preferences:convert.toPreferences(S,previousPreferences),menu:convert.toMenu(S.plan)});
  const payloadText=()=>JSON.stringify(payload());
  function clearLayers(){UI={sheet:null,open:{},q:'',dq:'',member:null};document.querySelectorAll('.push,.toast').forEach(e=>e.remove());Object.keys(TIMERS).forEach(k=>delete TIMERS[k]);releaseWake();}
  function stockFrom(snapshot) {stockRevision=snapshot.revision;S.pantry=snapshot.items.filter(i=>ING[i.ingredientId]).map(i=>({key:i.ingredientId,qty:i.quantity}));savedStock=stockText();}
  function addSavedRecipes(document) {
    const needed=new Set(document.menu?.days.flatMap(d=>d.slots.map(s=>s.recipeId)) || []);
    for(const source of document.preferences?.myRecipes || []) if(needed.has(source.id) && !RBY[source.id]) {
      const recipe=legacyRecipe(source);if(recipe.i.some(([id])=>!ING[id]))continue;deriveRecipe(recipe);RBY[recipe.id]=recipe;R.push(recipe);
    }
    for(const id of needed) if(!RBY[id]) {
      const pair=/^c_(p\d+)_(g\d+)$/.exec(id);if(!pair)continue;
      const main=RBY[pair[1]],side=RBY[pair[2]];if(!main || !side)continue;
      const amounts={};for(const [k,q] of [...main.i,...side.i])amounts[k]=(amounts[k] || 0)+q;
      const recipe={id,imageUrl:main.imageUrl,n:main.n+' '+(side.tags.find(t=>t.startsWith('with:'))?.slice(5) || side.n),m:'c',t:Math.max(main.t,side.t)+5,tags:[],i:Object.entries(amounts),sp:[...new Set([...main.sp,...side.sp])],s:[side.s[0],...main.s,...side.s.slice(1)]};
      deriveRecipe(recipe);RBY[id]=recipe;R.push(recipe);
    }
  }
  async function hydrate() {
    const version=generation,user=api.session?.user?.id,local=S;ready=false;
    const [document,inventory]=await Promise.all([api.request('/api/user-state'),api.request('/api/inventory')]);
    if(generation!==version || api.session?.user?.id!==user)return;
    clearPrivateRecipes();addSavedRecipes(document);previousPreferences=document.preferences || {};documentRevision=document.revision;
    // A new account takes over the menu, answers, own recipes and products made before signing in.
    const adopt=!document.preferences && !document.menu && !!local?.plan;
    clearLayers();S=adopt?{...local}:convert.fromDocument(document,blank());S.user={...api.session.user,phone:api.session.user.login};
    S.stage=S.plan?'app':'quiz';if(adopt)S.tab='menu';S.tab=S.tab || 'menu';stockFrom(inventory);
    if(adopt)for(const item of local.pantry || [])if(ING[item.key] && !S.pantry.some(p=>p.key===item.key))S.pantry.push({key:item.key,qty:item.qty});
    savedState=adopt?'':payloadText();
    ready=true;conflict=false;localStorage.removeItem(KEY);render();if(adopt)flush();
  }
  function showError(error) {
    if(error.status===401){logout();return;}
    if(error.status===409)conflict=true;
    UI.syncError=conflict?'Данные изменились на другом устройстве. Загрузите актуальную версию перед сохранением.':error.message;
    renderStatus();
  }
  function renderStatus() {
    document.getElementById('sync-error')?.remove();
    if(!UI.syncError)return;
    const card=document.createElement('div');card.id='sync-error';card.className='card';card.setAttribute('role','alert');
    const text=document.createElement('p');text.className='small';text.textContent=UI.syncError;card.append(text);
    const retry=document.createElement('button');retry.className='btn secondary';retry.textContent=conflict?'Загрузить актуальные данные':'Повторить';
    retry.onclick=async()=>{try{if(conflict)await hydrate();else {UI.syncError=null;renderStatus();await flush();}}catch(error){showError(error);}};
    card.append(retry);document.getElementById('app').prepend(card);
  }
  const originalRender=render;
  render=function(){originalRender();renderStatus();};
  async function flush() {
    if(!ready || busy || conflict || !api.session)return;
    busy=true;const version=generation,user=api.session.user.id;
    try {
      const stock=stockText();
      if(stock!==savedStock) {
        const result=await api.request('/api/inventory',{method:'PUT',body:{revision:stockRevision,items:JSON.parse(stock)}});
        if(version!==generation || api.session?.user?.id!==user)return;
        stockRevision=result.revision;savedStock=stock;
      }
      const data=payload(),text=JSON.stringify(data);
      if(text!==savedState) {
        const result=await api.request('/api/user-state',{method:'PUT',body:{revision:documentRevision,...data}});
        if(version!==generation || api.session?.user?.id!==user)return;
        documentRevision=result.revision;previousPreferences=result.preferences;savedState=text;
      }
      UI.syncError=null;renderStatus();
    } catch(error){if(version===generation)showError(error);}
    finally {
      if(version===generation)busy=false;
      if(version===generation && ready && !conflict && api.session && (stockText()!==savedStock || payloadText()!==savedState))scheduled=setTimeout(flush,UI.syncError?5000:100);
    }
  }
  function changed() {
    clearTimeout(scheduled);
    // Before sign-in the answers, the first menu and marked products stay on this device only.
    if(!api.session){try{localStorage.setItem(KEY,JSON.stringify({...S,user:null}));}catch{}return;}
    if(ready)scheduled=setTimeout(flush,350);
  }
  async function logout() {
    generation++;authNumber++;ready=false;busy=false;conflict=false;clearTimeout(scheduled);previousPreferences={};
    clearPrivateRecipes();const signingOut=api.logout();
    clearLayers();S=blank();S.stage='auth';localStorage.removeItem(KEY);render();await signingOut;
  }
  async function startLogin() {
    const attempt=++authNumber;UI.authError=null;UI.authBusy=true;UI.telegram=null;render();
    try {
      const challenge=await api.start();if(attempt!==authNumber)return;
      if(!/^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=/.test(challenge.botUrl))throw new Error('Некорректная ссылка на Telegram.');
      UI.telegram=challenge;UI.authBusy=false;render();
      const expires=Date.now()+challenge.expiresIn*1000;
      while(attempt===authNumber && Date.now()<expires) {
        await new Promise(r=>setTimeout(r,2000));if(attempt!==authNumber)return;
        try {
          const result=await api.poll(challenge);if(attempt!==authNumber)return;
          if(result.status==='authenticated') {
            api.accept(result);generation++;UI.telegram=null;
            try {await hydrate();}catch(error){UI.authError=error.message;render();}
            return;
          }
        }catch(error){if(error.status===401)throw error;UI.authError=error.message;render();}
      }
      if(attempt===authNumber)throw new Error('Вход истёк. Начните заново.');
    }catch(error){if(attempt===authNumber){UI.telegram=null;UI.authBusy=false;UI.authError=error.message;render();}}
  }
  const originalAct=act;
  act=function(action,value,element) {
    if(action==='telegramStart' || action==='telegramRetry'){startLogin();return;}
    if(action==='accountRetry'){hydrate().catch(error=>{UI.authError=error.message;render();});return;}
    if(action==='guest' || action==='demo')return;
    if(action==='reset'){clearLayers();S={...blank(),user:S.user,stage:'quiz',qStep:0,myRecipes:S.myRecipes || [],pantry:S.pantry,v4:{...blank().v4,sub:S.v4?.sub || null,ev:S.v4?.ev || []},theme:S.theme};changed();render();return;}
    originalAct(action,value,element);
  };
  // Preserve the original search markup but use the authenticated dictionary endpoint (minimum 3 characters).
  document.addEventListener('input',event=>{
    if(event.target.dataset.act!=='search')return;
    event.stopImmediatePropagation();UI.q=event.target.value;const query=UI.q.trim(),version=++searchNumber;
    clearTimeout(searchTimer);UI.remoteSuggestions=[];render();refocus('pq');
    if(query.length<3)return;
    searchTimer=setTimeout(async()=>{try{const result=await api.request('/api/ingredients?q='+encodeURIComponent(query));if(version!==searchNumber)return;UI.remoteSuggestions=result.ingredients;render();refocus('pq');}catch(error){showError(error);}},250);
  },true);
  window.addEventListener('online',flush);
  window.addEventListener('pagehide',()=>{if(ready)flush();});
  window.FamilyMenuBridge={changed,logout,async mount(){if(api.session)await hydrate();else {S.user=null;if(S.stage==='gen')S.stage='quiz';if(!['intro','quiz','ready','auth'].includes(S.stage))S.stage=S.plan?'ready':'auth';render();}},get ready(){return ready;},get pending(){return busy || stockText()!==savedStock || payloadText()!==savedState;}};
})();
