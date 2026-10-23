// DISABLED for V1: retained for future use; no routes are mounted in app.mjs.
import {StoreError} from './vkusvill-mcp.mjs';
import {cartIngredients,selectStoreProducts} from './store-cart.mjs';

const origin='https://lavka.yandex.ru';
const cartPath='/api/v1/providers/cart/v1/';
const cartIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable=()=>new StoreError(502,'Лавка сейчас недоступна. Попробуйте сформировать корзину позже.');
const clean=value=>typeof value==='string'?value.replace(/\u00ad/g,'').replace(/[\u00a0\u202f]/g,' ').trim():'';

export function lavkaInput(body,ingredients) {
  if(!body || Object.keys(body).some(k=>!['items','location'].includes(k)))throw new StoreError(400,'Проверьте список покупок и местоположение.');
  const point=body.location;
  if(!Array.isArray(point) || point.length!==2 || !point.every(n=>typeof n==='number' && Number.isFinite(n)) || Math.abs(point[0])>180 || Math.abs(point[1])>90)throw new StoreError(400,'Для Лавки нужно определить место доставки.');
  return {items:cartIngredients({items:body.items},ingredients),location:point};
}

// An isolated, anonymous web session for each basket. Never reuse a user's Yandex cookies.
export function createLavkaClient({location,fetchImpl=fetch,signal=AbortSignal.timeout(150000)}) {
  const cookies=new Map(),position={location};let headers={};
  async function request(path,body) {
    let response;
    try {
      response=await fetchImpl(origin+path,{method:body===undefined?'GET':'POST',redirect:'error',
        signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),
        headers:{Accept:'application/json',...headers,...(cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},
        body:body===undefined?undefined:JSON.stringify(body)});
      for(const cookie of response.headers.getSetCookie()) {
        const part=cookie.split(';')[0],index=part.indexOf('=');
        if(index>0)cookies.set(part.slice(0,index),part.slice(index+1));
      }
    }catch{throw unavailable();}
    if(!response.ok)throw unavailable();
    return response.text();
  }
  async function post(path,body) {
    try {const data=JSON.parse(await request(path,body));return data?.data ?? data;}
    catch(error){if(error instanceof StoreError)throw error;throw unavailable();}
  }
  function updateBody(cart,items) {
    if(!cartIdPattern.test(cart?.cartId) || !Number.isInteger(cart.cartVersion) || !(cart.nextIdempotencyToken || cart.idempotencyToken))throw unavailable();
    return {items,position,cartId:cart.cartId,cartVersion:cart.cartVersion,idempotencyToken:cart.nextIdempotencyToken || cart.idempotencyToken,
      isUserOrderEdit:false,depotType:'regular',deliveryType:cart.deliveryType,deliveryTimeInfo:cart.deliveryTimeInfo,additionalData:{}};
  }
  return {
    async open() {
      const html=await request('/');let props;
      try {props=JSON.parse(/<script[^>]+id="__page_props__-data"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1]);}catch{throw unavailable();}
      if(!props.csrfToken || !props.authProxyCsrfToken)throw unavailable();
      // The explicit coordinates determine the depot. Do not force the homepage's fallback city.
      headers={Origin:origin,Referer:origin+'/','X-Lavka-Web-Locale':'ru-RU','X-Csrf-Token-Bff':props.csrfToken,'X-Csrf-Token':props.authProxyCsrfToken};
    },
    retrieve:()=>post(cartPath+'retrieve',{position,isSupermarket:false}),
    search:text=>post('/api/v1/providers/search/v3/lavka',{position,text,productsLimit:12,subcategoriesLimit:0,useRetail:true,source:'manual_input',depotType:'regular',currencySign:'₽'}),
    update:(cart,items)=>post(cartPath+'update',updateBody(cart,items)),
    shared:sharedCartId=>post(cartPath+'shared/retrieve',{sharedCartId,position,isSupermarket:false})
  };
}

export function lavkaProducts(data) {
  if(!Array.isArray(data?.cacheProducts))throw unavailable();
  const seen=new Set();
  return data.cacheProducts.slice(0,12).flatMap(p=>{
    const id=p?.id,options=p?.options;
    // Unit packs have unambiguous quantities. Unsupported weighted/modifier/restricted goods are excluded.
    if(typeof id!=='string' || !/^[a-z0-9-]{1,100}$/i.test(id) || seen.has(id) || !clean(p.title) || !clean(p.amount) || p.available!==true || p.comingSoon || p.adult || p.requiredRestriction || p.hasModifiers || options?.docsRequired || options?.quantityType!=='unit' || Number(options.pricePerCount)!==1 || !Number.isFinite(p.currentPrice) || p.currentPrice<=0 || !Number.isFinite(p.maxAmount) || p.maxAmount<1 || p.baseStep!==1 || p.incrementStep!==1)return [];
    seen.add(id);
    return [{productId:id,name:clean(p.longTitle || p.title).slice(0,250),amount:clean(p.amount).slice(0,100),price:p.currentPrice,maxQuantity:Math.min(40,Math.floor(p.maxAmount)),quantityType:'unit',pricePerCount:'1'}];
  });
}

export function selectedLavkaProducts(data,items,candidates) {
  const bad=()=>new StoreError(502,'Не удалось проверить подбор товаров Лавки. Попробуйте ещё раз.');
  if(!Array.isArray(data?.selections) || data.selections.length!==items.length)throw bad();
  const seen=new Set(),products=new Map(),missing=[];
  for(const row of data.selections) {
    const ingredient=items.find(i=>i.ingredientId===row?.ingredientId);
    if(!ingredient || seen.has(row.ingredientId))throw bad();seen.add(row.ingredientId);
    if(row.productId===null){missing.push(ingredient.name);continue;}
    const product=candidates.get(row.ingredientId)?.find(p=>p.productId===row.productId);
    if(!product || !Number.isInteger(row.quantity) || row.quantity<1 || row.quantity>product.maxQuantity)throw bad();
    const previous=products.get(product.productId),quantity=(previous?Number(previous.quantity):0)+row.quantity;
    if(quantity>product.maxQuantity)throw new StoreError(422,'В Лавке недостаточно товара: '+product.name+'. Список покупок сохранён.');
    products.set(product.productId,{id:product.productId,quantity:String(quantity),price:String(product.price),pricePerCount:product.pricePerCount,quantityType:product.quantityType,currency:'RUB',title:''});
  }
  if(missing.length)throw new StoreError(422,'В Лавке не удалось подобрать товары или фасовку: '+missing.join(', ')+'. Список покупок сохранён.');
  return [...products.values()];
}

function complete(actual,expected) {
  return Array.isArray(actual) && actual.length===expected.length && new Set(actual.map(i=>i.id)).size===expected.length && expected.every(e=>actual.some(i=>i.id===e.id && Number(i.quantity)===Number(e.quantity)));
}
export async function buildLavkaCart({items,location,apiKey,signal=AbortSignal.timeout(150000),clientFactory=createLavkaClient,select=selectStoreProducts}) {
  if(!apiKey)throw new StoreError(503,'Подбор товаров пока не настроен. Попробуйте позже.');
  const client=clientFactory({location,signal}),candidates=new Map();
  await client.open();
  const cart=await client.retrieve();
  if(!cartIdPattern.test(cart?.cartId) || !Array.isArray(cart.items) || cart.items.length)throw unavailable();
  let next=0,failed;
  async function worker(){try{while(!failed && next<items.length){signal.throwIfAborted();const item=items[next++];candidates.set(item.ingredientId,lavkaProducts(await client.search(item.name)));}}catch(error){failed=error;}}
  await Promise.all(Array.from({length:Math.min(3,items.length)},worker));
  if(failed)throw failed;
  const missing=items.filter(i=>!candidates.get(i.ingredientId)?.length);
  if(missing.length)throw new StoreError(422,'По вашему местоположению в Лавке не найдены: '+missing.map(i=>i.name).join(', ')+'. Проверьте зону доставки Лавки. Список покупок сохранён.');
  const products=selectedLavkaProducts(await select({items,candidates,apiKey,signal,store:'lavka'}),items,candidates);
  const updated=await client.update(cart,products);
  if(updated.cartId!==cart.cartId || !complete(updated.items,products))throw new StoreError(422,'Наличие товаров в Лавке изменилось. Попробуйте сформировать корзину заново.');
  // Verify the shared basket before exposing a link. No order or checkout is created.
  if(!complete((await client.shared(cart.cartId)).items,products))throw unavailable();
  const url=new URL('/cart',origin);url.searchParams.set('sharedCartId',cart.cartId);url.searchParams.set('countryCode','RU');
  return {store:'lavka',carts:[{url:url.href,productCount:products.length}],ingredientCount:items.length,productCount:products.length};
}
