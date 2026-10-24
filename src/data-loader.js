/* Merge small API responses into the renderer's existing dictionaries. */
(() => {
 let complete=false,ingredientsComplete=false,fullPending=null,ingredientPending=null,version=0;
 const categories=new Set(),pending=new Map();
 window.CLIENT_ING8=new Set(CATALOG.ingredients.filter(i=>i.client).map(i=>i.id));
 function install(data) {
  for(const key of Object.keys(AVG8))delete AVG8[key];
  for(const i of [...(data.ingredients || [])]) {
   ING[i.id]=[i.name,i.category,i.unit,i.price,i.allergens || [],i.flags || [],i.nutrition];
   if(i.client)window.CLIENT_ING8.add(i.id);
   if(i.lavkaPrice!=null)LAVKA[i.id]=[i.lavkaPrice,i.lavkaPrice,i.name,i.lavkaPath || ''];
   const at=CATALOG.ingredients.findIndex(x=>x.id===i.id);if(at<0)CATALOG.ingredients.push(i);else CATALOG.ingredients[at]=i;
  }
  for(const source of [...(data.recipes || [])]) {
   if(RBY[source.id])continue;
   const r=legacyRecipe(source);if(r.i.some(([id])=>!ING[id]))throw Error('Не хватает данных ингредиентов рецепта.');
   deriveRecipe(r);R.push(r);RBY[r.id]=r;if(!CATALOG.recipes.some(x=>x.id===source.id))CATALOG.recipes.push(source);
  }
  if(data.foods?.length)FOODS.splice(0,FOODS.length,...data.foods.map(f=>[f.stems,f.kcal,f.piece,f.portion]));
  if(data.promos?.length)VV_PROMO.splice(0,VV_PROMO.length,...data.promos.map(p=>[p.name,p.price,p.regularPrice,p.condition,p.until]));
  DISLIKE_POPULAR.splice(0,DISLIKE_POPULAR.length,...['onion','mushrooms','beet','cabbage','zucchini','eggplant','bell_pepper','cottage','liver','chicken_liver','fish_white','pumpkin','celery','garlic','lentils','buckwheat','squid','tofu'].filter(k=>ING[k]));
 }
 async function full() {
  if(complete)return;
  if(!fullPending){const epoch=version;fullPending=FamilyMenuApi.catalog().then(data=>{if(epoch!==version)return;install(data);complete=ingredientsComplete=true;}).finally(()=>{if(epoch===version)fullPending=null;});}
  return fullPending;
 }
 async function ingredients() {
  if(ingredientsComplete)return;
  if(!ingredientPending){const epoch=version;ingredientPending=fetchData('/api/catalog/ingredients').then(data=>{if(epoch!==version)return;install(data);ingredientsComplete=true;}).finally(()=>{if(epoch===version)ingredientPending=null;});}
  return ingredientPending;
 }
 async function fetchData(path){const r=await fetch('https://vibe-coding-sc04.onrender.com'+path,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Не удалось загрузить данные. Попробуйте ещё раз.');return r.json();}
 async function recipes(kind,ids=[]) {
  if(complete || (kind&&categories.has(kind)) || (!kind&&ids.every(id=>!!RBY[id])))return;
  const query=kind?'kind='+encodeURIComponent(kind):'ids='+encodeURIComponent(ids.join(','));
  if(!pending.has(query)){const epoch=version;pending.set(query,fetchData('/api/recipes?'+query).then(data=>{if(epoch!==version)return;install(data);if(kind)categories.add(kind);}).finally(()=>{if(epoch===version)pending.delete(query);}));}
  return pending.get(query);
 }
 async function search(query) {
  const epoch=version,data=await fetchData('/api/recipes?q='+encodeURIComponent(query));if(epoch===version)install(data);
 }
 async function savedRecipes(ids) {
  const epoch=version,bases=new Set();
  function base(id){if(RBY[id])return;const v=S.var8?.[id];if(v)base(v.b);else if(!id.startsWith('h8~')&&!S.myRecipes?.some(r=>r.id===id))bases.add(id);}
  for(const id of ids)base(id);
  if(bases.size)await recipes(null,[...bases]);
  if(epoch!==version)return;
  function restore(id){if(RBY[id])return;const v=S.var8?.[id];if(v){restore(v.b);variant8(v.b,v.i);}else ensureBase8(id);}
  ensureRecipes();for(const id of ids)restore(id);
 }
 async function gate(work,then) {
  const epoch=version;UI.dataLoading=true;UI.dataError=null;render();
  try{await work();if(epoch!==version)return;UI.dataLoading=false;UI.dataRetry=null;then();}
  catch(error){if(epoch!==version)return;UI.dataLoading=false;UI.dataError=error.message;UI.dataRetry=()=>gate(work,then);render();}
 }
 function loading(error) {return `<div class="screen"><div class="loader">${error?'':'<div class="spin" aria-hidden="true"></div>'}<h2>${error?'Не удалось загрузить данные':'Загружаем данные'}</h2><p class="muted small">${error?esc(error):'Это нужно только при первой загрузке'}</p>${error?'<button class="btn" data-act="dataRetry">Повторить</button>':''}</div></div>`;}
 const previousRender=render;
 render=function(){if(UI.dataLoading||UI.dataError||UI.accountLoading){document.getElementById('app').innerHTML=loading(UI.dataError);return;}previousRender();};
 window.FamilyMenuData={
  install,full,ingredients,recipes,savedRecipes,search,gate,hasCategory:kind=>categories.has(kind),get complete(){return complete;},get ingredientsComplete(){return ingredientsComplete;},
  background(promise){if(!promise)return;const epoch=version;fullPending=promise.then(data=>{if(epoch!==version||!data)return;install(data);complete=ingredientsComplete=true;}).finally(()=>{if(epoch===version)fullPending=null;});fullPending.catch(()=>{});},
  accountError(error){UI.accountLoading=false;UI.dataError=error.message;UI.dataRetry=()=>gate(()=>FamilyMenuBridge.mount(),()=>render());render();},
  reset(){version++;complete=ingredientsComplete=false;fullPending=ingredientPending=null;categories.clear();pending.clear();for(const id of Object.keys(RBY))delete RBY[id];R.splice(0);for(const id of Object.keys(ING))delete ING[id];for(const id of Object.keys(LAVKA))delete LAVKA[id];FOODS.splice(0);VV_PROMO.splice(0);CATALOG.recipes.splice(0);CATALOG.ingredients.splice(0);window.CLIENT_ING8.clear();}
 };
})();
