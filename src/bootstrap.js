(() => {
  const loaded=new Set(),FILES=['art-specs.js','data.js','art.js','cook.js','app.js','shell.js','v4.js','share.js','pantry-quantity.js','scan-inventory.js','v8.js','data-loader.js','bridge.js','analytics.js'];
  // v8.13: download the app scripts while the catalog is loading; they run in order once it is there
  for(const f of FILES){const l=document.createElement('link');l.rel='preload';l.as='script';l.href='src/'+f;document.head.append(l);}
  async function loadAll(){const todo=FILES.filter(f=>!loaded.has(f));await Promise.all(todo.map(f=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='src/'+f;s.async=false;s.onload=()=>{loaded.add(f);resolve();};s.onerror=()=>reject(new Error('Не удалось загрузить приложение.'));document.head.append(s);})));}
  async function start() {
    const root=document.getElementById('app');root.replaceChildren();
    // Keep a brief decorative splash while application scripts initialize.
    // The splash is decorative; network requests do not hold it open.
    document.querySelector('.splash8')?.remove();
    const splashEl=document.createElement('div');splashEl.className='splash8';splashEl.setAttribute('role','img');splashEl.setAttribute('aria-label','Frigo, загрузка');
    splashEl.innerHTML='<div class="hats8">'+'<span class="hat8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M7 14.5a4 4 0 0 1-.6-7.9A5 5 0 0 1 12 3a5 5 0 0 1 5.6 3.6 4 4 0 0 1-.6 7.9V20H7z" fill="currentColor" fill-opacity=".9"/><path d="M7 17h10" stroke="#2c6a4c"/></svg></span>'.repeat(3)+'</div>';document.body.append(splashEl);
    const started=Date.now(),wait=ms=>new Promise(r=>setTimeout(r,ms));
    try {
      await FamilyMenuApi.restore({verify:false});
      const cached=FamilyMenuApi.session?FamilyMenuCache.read(FamilyMenuApi.session.user.id):null;
      window.FamilyMenuCatalog=cached?.catalog || {recipes:[],ingredients:[],foods:[],promos:[]};
      // Start preparing the first menu while the introductory slides are visible.
      let preparation=null;
      if(!FamilyMenuApi.session) {
        const epoch=FamilyMenuCache.epoch;
        preparation=FamilyMenuApi.catalog().then(c=>{if(epoch!==FamilyMenuCache.epoch)return null;return c;});
        preparation.catch(()=>{});
      }
      await loadAll();
      window.FamilyMenuData.background(preparation);
      if(FamilyMenuApi.session) {
        // Account/network loading has its own screen; it never prolongs the decorative splash.
        FamilyMenuBridge.mount(cached).catch(error=>FamilyMenuData.accountError(error));
      } else await FamilyMenuBridge.mount();
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
