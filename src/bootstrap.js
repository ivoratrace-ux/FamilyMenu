(() => {
  async function load(file) {await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='src/'+file;script.onload=resolve;script.onerror=()=>reject(new Error('Не удалось загрузить приложение.'));document.head.append(script);});}
  const loaded=new Set(),FILES=['art-specs.js','extra8.js','data.js','art.js','cook.js','app.js','shell.js','v4.js','share.js','pantry-quantity.js','v8.js','bridge.js'];
  // v8.13: download the app scripts while the catalog is loading; they run in order once it is there
  for(const f of FILES){const l=document.createElement('link');l.rel='preload';l.as='script';l.href='src/'+f;document.head.append(l);}
  async function loadAll(){const todo=FILES.filter(f=>!loaded.has(f));await Promise.all(todo.map(f=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='src/'+f;s.async=false;s.onload=()=>{loaded.add(f);resolve();};s.onerror=()=>reject(new Error('Не удалось загрузить приложение.'));document.head.append(s);})));}
  async function start() {
    const root=document.getElementById('app');root.replaceChildren();
    // Splash over the app: two hats light up at 0.6 s and 1.3 s, the third at the moment the app is ready
    // (not earlier than 2 s) — and the splash disappears right after it.
    document.querySelector('.splash8')?.remove();
    const splashEl=document.createElement('div');splashEl.className='splash8';splashEl.setAttribute('role','img');splashEl.setAttribute('aria-label','Frigo, загрузка');
    splashEl.innerHTML='<div class="hats8">'+'<span class="hat8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M7 14.5a4 4 0 0 1-.6-7.9A5 5 0 0 1 12 3a5 5 0 0 1 5.6 3.6 4 4 0 0 1-.6 7.9V20H7z" fill="currentColor" fill-opacity=".9"/><path d="M7 17h10" stroke="#2c6a4c"/></svg></span>'.repeat(3)+'</div>';document.body.append(splashEl);
    const started=Date.now(),wait=ms=>new Promise(r=>setTimeout(r,ms));
    try {
      // v8.13: the last catalog is kept on the device — the app starts at once, a fresh copy is saved for the next launch
      const CK='frigo-catalog-v1';let cached=null;try{cached=JSON.parse(localStorage.getItem(CK)||'null');}catch{}
      const fresh=FamilyMenuApi.catalog().then(c=>{try{localStorage.setItem(CK,JSON.stringify(c));}catch{}return c;});
      if(cached)fresh.catch(()=>{});
      const [catalog]=await Promise.all([cached&&Array.isArray(cached.recipes)&&cached.recipes.length?cached:fresh,FamilyMenuApi.restore()]);
      if(!Array.isArray(catalog.recipes) || !catalog.recipes.length || !Array.isArray(catalog.ingredients) || !catalog.ingredients.length || !Array.isArray(catalog.foods) || !Array.isArray(catalog.promos))throw new Error('Сервер вернул неполный каталог.');
      window.FamilyMenuCatalog=catalog;
      await loadAll();
      await FamilyMenuBridge.mount();
      await wait(Math.max(0,700-(Date.now()-started)));
      splashEl.querySelectorAll('.hat8')[2].classList.add('on');await wait(150);splashEl.remove();
    } catch(error) {
      await wait(Math.max(0,2000-(Date.now()-started)));splashEl.remove();root.replaceChildren();const box=document.createElement('div');box.className='screen stack';
      const title=document.createElement('h1');title.textContent='Не удалось загрузить приложение';
      const text=document.createElement('p');text.className='muted';text.textContent=error.message || 'Проверьте интернет.';
      const retry=document.createElement('button');retry.className='btn block';retry.textContent='Повторить';retry.onclick=start;box.append(title,text,retry);root.append(box);
    }
  }
  start();
})();
