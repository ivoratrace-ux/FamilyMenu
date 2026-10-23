/* DISABLED for V1. Archive only; not loaded or copied to the published Web. */
/* Prepare store baskets first; links open only with a separate user click. */
(() => {
  const api=FamilyMenuApi;
  const stores={vkusvill:{title:'ВкусВилл',where:'во ВкусВилле',action:'vkusvillCart'},lavka:{title:'Яндекс Лавка',where:'в Яндекс Лавке',action:'lavkaCart'}};
  const states={},attempts={vkusvill:0,lavka:0};
  const items=()=>shopping().items.filter(i=>!i.covered && !i.bought && i.toBuy>0 && !window.CLIENT_ING8?.has(i.k)).map(i=>({ingredientId:i.k,quantity:i.toBuy})).sort((a,b)=>a.ingredientId.localeCompare(b.ingredientId));
  const fingerprint=()=>JSON.stringify(items());
  function safeUrl(value,store) {
    try {
      const url=new URL(value);
      if(url.protocol!=='https:' || url.username || url.password || url.port)return null;
      if(store==='lavka')return url.hostname==='lavka.yandex.ru' && url.pathname==='/cart' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.searchParams.get('sharedCartId') || '') && url.searchParams.get('countryCode')==='RU'?url.href:null;
      return url.hostname==='vkusvill.ru' || url.hostname.endsWith('.vkusvill.ru') || url.hostname==='vkusvill.onelink.me'?url.href:null;
    }catch{return null;}
  }
  function reset(store){for(const key of store?[store]:Object.keys(stores)){attempts[key]++;delete states[key];}}
  function current(store){const state=states[store];return state && state.owner===api.session?.user.id && state.list===fingerprint();}
  function card(store) {
    if(!store)return Object.keys(stores).map(card).join('');
    if(!stores[store])return '';
    if(states[store] && !current(store))reset(store);
    const state=states[store],info=stores[store],count=items().length;
    return `<div class="card" id="${store}-cart" aria-busy="${!!state?.busy}">
      <h3>Корзина ${info.where} ${store==='lavka'?'<span class="pill">Beta</span>':''}</h3>
      <p class="small muted">Подберём товары и фасовки из списка покупок. Проверить и оформить заказ можно ${info.where}.</p>
      ${store==='lavka'?'<p class="small muted">Используем текущее местоположение для подбора доступных товаров. Разрешите доступ к нему в браузере; адрес доставки уточните в Лавке.</p>':''}
      ${!state?.carts?`<button class="btn block" data-act="${info.action}" ${state?.busy || !count?'disabled':''}>${state?.busy?'Формируем корзину…':`Сформировать корзину ${info.where}`}</button>`:''}
      ${state?.busy?`<p class="small muted" role="status">${state.locating?'Определяем местоположение. Разрешите доступ в браузере.':'Ищем товары. Это может занять до трёх минут.'}</p>`:''}
      ${state?.error?`<p class="small" role="alert">${esc(state.error)}</p>`:''}
      ${state?.carts?`<p class="small" role="status">Корзина готова. Добавьте продукты ${info.where}.</p><a class="btn block" data-store-cart-link data-store="${store}" href="${esc(state.carts[0].url)}" target="_blank" rel="noopener noreferrer">Добавить в корзину</a>`:''}
      <p class="small muted">Цены, наличие и состав уточняйте ${info.where}. Специи «по вкусу» не добавляем.</p>
    </div>`;
  }
  function locate() {
    return new Promise((resolve,reject)=>{
      if(!globalThis.navigator?.geolocation){reject(Error('Браузер не поддерживает определение местоположения. Откройте сайт в другом браузере.'));return;}
      navigator.geolocation.getCurrentPosition(result=>{
        const {longitude,latitude}=result.coords;
        if(!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude)>180 || Math.abs(latitude)>90){reject(Error('Не удалось определить местоположение. Попробуйте ещё раз.'));return;}
        resolve([longitude,latitude]);
      },error=>reject(Error(error.code===1?'Разрешите доступ к местоположению в настройках браузера и попробуйте ещё раз.':'Не удалось определить местоположение. Проверьте геолокацию на устройстве и попробуйте ещё раз.')),{enableHighAccuracy:true,timeout:20000,maximumAge:300000});
    });
  }
  async function start(store) {
    if(states[store]?.busy && current(store))return;
    const list=items();if(!list.length)return;
    if(!api.session){toast('Войдите через Telegram');return;}
    reset(store);const version=attempts[store],owner=api.session.user.id,snapshot=JSON.stringify(list);
    states[store]={busy:true,owner,list:snapshot,locating:store==='lavka'};render();
    try {
      const body={items:list};
      if(store==='lavka'){
        body.location=await locate();
        if(version!==attempts[store])return;
        if(!current(store)){reset(store);render();return;}
        states[store].locating=false;render();
      }
      const result=await api.request(`/api/stores/${store}/cart`,{method:'POST',body,timeoutMs:165000});
      if(version!==attempts[store])return;
      if(owner!==api.session?.user.id || snapshot!==fingerprint()){reset(store);render();toast('Список изменился. Сформируйте корзину заново.');return;}
      if(result.store!==store || !Array.isArray(result.carts) || result.carts.length!==1 || result.carts.some(c=>!safeUrl(c.url,store)))throw Error('Не удалось получить ссылку на корзину. Попробуйте ещё раз.');
      states[store]={...states[store],busy:false,carts:result.carts.map(c=>({...c,url:safeUrl(c.url,store)}))};render();
    }catch(error){
      if(version!==attempts[store])return;
      if(error.status===401){reset();await FamilyMenuBridge.logout();return;}
      if(owner!==api.session?.user.id || snapshot!==fingerprint()){reset(store);render();return;}
      states[store]={...states[store],busy:false,error:error.message || 'Не удалось собрать корзину. Попробуйте ещё раз.'};render();
    }
  }
  const previousAct=act;
  act=function(action,value,element){
    if(action==='vkusvillCart' || action==='lavkaCart' || action==='cartStart'){
      const store=action==='lavkaCart' || action==='cartStart' && S.store==='lavka'?'lavka':'vkusvill';start(store);return;
    }
    if(action==='logout' || action==='reset')reset();
    previousAct(action,value,element);
  };
  window.FamilyMenuStores={card,reset};
})();
