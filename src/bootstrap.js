(() => {
  async function load(file) {await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='src/'+file;script.onload=resolve;script.onerror=()=>reject(new Error('Не удалось загрузить приложение.'));document.head.append(script);});}
  const loaded=new Set();
  async function start() {
    const root=document.getElementById('app');root.replaceChildren();
    // Splash: exactly 2 s; three chef hats above the logo light up one after another.
    const pending=document.createElement('div');pending.className='splash8';pending.setAttribute('role','img');pending.setAttribute('aria-label','Frigo, загрузка');
    pending.innerHTML='<div class="hats8">'+'<span class="hat8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M7 14.5a4 4 0 0 1-.6-7.9A5 5 0 0 1 12 3a5 5 0 0 1 5.6 3.6 4 4 0 0 1-.6 7.9V20H7z" fill="currentColor" fill-opacity=".9"/><path d="M7 17h10" stroke="#2c6a4c"/></svg></span>'.repeat(3)+'</div>';root.append(pending);
    const splash=new Promise(r=>setTimeout(r,2000));
    try {
      const [catalog]=await Promise.all([FamilyMenuApi.catalog(),FamilyMenuApi.restore(),splash]);
      if(!Array.isArray(catalog.recipes) || !catalog.recipes.length || !Array.isArray(catalog.ingredients) || !catalog.ingredients.length || !Array.isArray(catalog.foods) || !Array.isArray(catalog.promos))throw new Error('Сервер вернул неполный каталог.');
      window.FamilyMenuCatalog=catalog;
      for(const file of ['art-specs.js','data.js','art.js','cook.js','app.js','shell.js','v4.js','v8.js','bridge.js'])if(!loaded.has(file)){await load(file);loaded.add(file);}
      await FamilyMenuBridge.mount();
    } catch(error) {
      await splash;root.replaceChildren();const box=document.createElement('div');box.className='screen stack';
      const title=document.createElement('h1');title.textContent='Не удалось загрузить приложение';
      const text=document.createElement('p');text.className='muted';text.textContent=error.message || 'Проверьте интернет.';
      const retry=document.createElement('button');retry.className='btn block';retry.textContent='Повторить';retry.onclick=start;box.append(title,text,retry);root.append(box);
    }
  }
  start();
})();
