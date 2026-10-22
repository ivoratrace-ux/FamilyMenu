(() => {
  async function load(file) {await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='src/'+file;script.onload=resolve;script.onerror=()=>reject(new Error('Не удалось загрузить приложение.'));document.head.append(script);});}
  const loaded=new Set();
  async function start() {
    const root=document.getElementById('app');root.replaceChildren();
    const pending=document.createElement('div');pending.className='screen';pending.textContent='Загружаем рецепты…';root.append(pending);
    try {
      const [catalog]=await Promise.all([FamilyMenuApi.catalog(),FamilyMenuApi.restore()]);
      if(!Array.isArray(catalog.recipes) || !catalog.recipes.length || !Array.isArray(catalog.ingredients) || !catalog.ingredients.length || !Array.isArray(catalog.foods) || !Array.isArray(catalog.promos))throw new Error('Сервер вернул неполный каталог.');
      window.FamilyMenuCatalog=catalog;
      for(const file of ['art-specs.js','data.js','art.js','cook.js','app.js','shell.js','bridge.js'])if(!loaded.has(file)){await load(file);loaded.add(file);}
      await FamilyMenuBridge.mount();
    } catch(error) {
      root.replaceChildren();const box=document.createElement('div');box.className='screen stack';
      const title=document.createElement('h1');title.textContent='Не удалось загрузить приложение';
      const text=document.createElement('p');text.className='muted';text.textContent=error.message || 'Проверьте интернет.';
      const retry=document.createElement('button');retry.className='btn block';retry.textContent='Повторить';retry.onclick=start;box.append(title,text,retry);root.append(box);
    }
  }
  start();
})();
