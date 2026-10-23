(() => {
  async function load(file) {await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='src/'+file;script.onload=resolve;script.onerror=()=>reject(new Error('Не удалось загрузить приложение.'));document.head.append(script);});}
  const loaded=new Set();
  async function start() {
    const root=document.getElementById('app');root.replaceChildren();
    // Splash over the app: two hats light up at 0.6 s and 1.3 s, the third at the moment the app is ready
    // (not earlier than 2 s) — and the splash disappears right after it.
    document.querySelector('.splash8')?.remove();
    const splashEl=document.createElement('div');splashEl.className='splash8';splashEl.setAttribute('role','img');splashEl.setAttribute('aria-label','Frigo, загрузка');
    splashEl.innerHTML='<div class="hats8">'+'<span class="hat8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M7 14.5a4 4 0 0 1-.6-7.9A5 5 0 0 1 12 3a5 5 0 0 1 5.6 3.6 4 4 0 0 1-.6 7.9V20H7z" fill="currentColor" fill-opacity=".9"/><path d="M7 17h10" stroke="#2c6a4c"/></svg></span>'.repeat(3)+'</div>';document.body.append(splashEl);
    const started=Date.now(),wait=ms=>new Promise(r=>setTimeout(r,ms));
    try {
      const [catalog]=await Promise.all([FamilyMenuApi.catalog(),FamilyMenuApi.restore()]);
      if(!Array.isArray(catalog.recipes) || !catalog.recipes.length || !Array.isArray(catalog.ingredients) || !catalog.ingredients.length || !Array.isArray(catalog.foods) || !Array.isArray(catalog.promos))throw new Error('Сервер вернул неполный каталог.');
      window.FamilyMenuCatalog=catalog;
      for(const file of ['art-specs.js','extra8.js','data.js','art.js','cook.js','app.js','shell.js','v4.js','v8.js','bridge.js'])if(!loaded.has(file)){await load(file);loaded.add(file);}
      await FamilyMenuBridge.mount();
      await wait(Math.max(0,2000-(Date.now()-started)));
      splashEl.querySelectorAll('.hat8')[2].classList.add('on');await wait(220);splashEl.remove();
    } catch(error) {
      await wait(Math.max(0,2000-(Date.now()-started)));splashEl.remove();root.replaceChildren();const box=document.createElement('div');box.className='screen stack';
      const title=document.createElement('h1');title.textContent='Не удалось загрузить приложение';
      const text=document.createElement('p');text.className='muted';text.textContent=error.message || 'Проверьте интернет.';
      const retry=document.createElement('button');retry.className='btn block';retry.textContent='Повторить';retry.onclick=start;box.append(title,text,retry);root.append(box);
    }
  }
  start();
})();
