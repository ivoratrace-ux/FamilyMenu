/* Public store integration: no per-product wizard; open the URL returned by the backend. */
(() => {
  const api=FamilyMenuApi;
  let state=null,popup=null,attempt=0;
  const items=()=>shopping().items.filter(i=>!i.covered && !i.bought && i.toBuy>0).map(i=>({ingredientId:i.k,quantity:i.toBuy})).sort((a,b)=>a.ingredientId.localeCompare(b.ingredientId));
  const fingerprint=()=>JSON.stringify(items());
  function safeUrl(value) {
    try {const url=new URL(value);return url.protocol==='https:' && !url.username && !url.password && !url.port && (url.hostname==='vkusvill.ru' || url.hostname.endsWith('.vkusvill.ru') || url.hostname==='vkusvill.onelink.me')?url.href:null;}catch{return null;}
  }
  function reset(){attempt++;state=null;if(popup && !popup.closed)popup.close();popup=null;}
  function current(){return state && state.owner===api.session?.user.id && state.list===fingerprint();}
  function card() {
    if(state && !current())reset();
    const count=items().length;
    return `<div class="card" id="vkusvill-cart" aria-busy="${!!state?.busy}">
      <h3>Корзина во ВкусВилле</h3>
      <p class="small muted">Подберём товары и фасовки из списка покупок. Проверить и оформить заказ можно во ВкусВилле.</p>
      <button class="btn block" data-act="vkusvillCart" ${state?.busy || !count?'disabled':''}>${state?.busy?'Формируем корзину…':'Сформировать корзину во ВкусВилле'}</button>
      ${state?.busy?'<p class="small muted" role="status">Ищем товары. Это может занять до трёх минут.</p>':''}
      ${state?.error?`<p class="small" role="alert">${esc(state.error)}</p>`:''}
      ${state?.carts?`<p class="small" role="status">Корзина готова. Если она не открылась, нажмите ссылку.</p><a class="btn ghost block" data-store-cart-link href="${esc(state.carts[0].url)}" target="_blank" rel="noopener noreferrer">Открыть корзину во ВкусВилле ↗</a>`:''}
      <p class="small muted">Цены, наличие и состав уточняйте во ВкусВилле. Специи «по вкусу» не добавляем.</p>
    </div>`;
  }
  async function start() {
    if(state?.busy && current())return;
    const list=items();if(!list.length)return;
    if(!api.session){toast('Войдите через Telegram');return;}
    reset();const version=attempt,owner=api.session.user.id,snapshot=JSON.stringify(list);
    // Reserve the tab during the user click: browsers block window.open after an awaited request.
    try {popup=window.open('about:blank','_blank');if(popup){popup.opener=null;popup.document.title='Формируем корзину ВкусВилла';popup.document.body.textContent='Формируем корзину ВкусВилла. Это может занять до трёх минут.';}}catch{popup=null;}
    state={busy:true,owner,list:snapshot};render();
    try {
      const result=await api.request('/api/stores/vkusvill/cart',{method:'POST',body:{items:list},timeoutMs:165000});
      if(version!==attempt)return;
      if(owner!==api.session?.user.id || snapshot!==fingerprint()){reset();render();toast('Список изменился. Сформируйте корзину заново.');return;}
      if(result.store!=='vkusvill' || !Array.isArray(result.carts) || result.carts.length!==1 || result.carts.some(c=>!safeUrl(c.url)))throw Error('Не удалось получить ссылку на корзину. Попробуйте ещё раз.');
      state={...state,busy:false,carts:result.carts.map(c=>({...c,url:safeUrl(c.url)}))};
      // Open the complete basket automatically; keep a fallback link if the popup was blocked.
      if(popup && !popup.closed)popup.location.replace(state.carts[0].url);
      popup=null;render();
    }catch(error){
      if(version!==attempt)return;
      if(popup && !popup.closed)popup.close();popup=null;
      if(error.status===401){reset();await FamilyMenuBridge.logout();return;}
      if(owner!==api.session?.user.id){reset();render();return;}
      state={...state,busy:false,error:error.message || 'Не удалось собрать корзину. Попробуйте ещё раз.'};render();
    }
  }
  const previousAct=act;
  act=function(action,value,element){
    if(action==='vkusvillCart' || action==='cartStart' && (S.store || 'vv')==='vv'){start();return;}
    if(action==='logout' || action==='reset')reset();
    previousAct(action,value,element);
  };
  window.FamilyMenuStores={card,reset};
})();
