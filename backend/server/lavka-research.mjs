// Temporary experiment on research/lavka-render-probe only. No order/payment endpoints.
const origin='https://lavka.yandex.ru';
const position={location:[37.615,55.757]};
class ProbeError extends Error {
  constructor(stage,detail){super(stage);this.detail={stage,...detail};}
}
export async function probeLavka({fetchImpl=fetch,signal=AbortSignal.timeout(90000)}={}) {
  const steps=[];
  function session() {
    const cookies=new Map();let headers={};
    async function request(stage,path,body) {
      let response;
      try {
        response=await fetchImpl(origin+path,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),
          headers:{Accept:'application/json',...headers,...(cookies.size?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
      }catch{throw new ProbeError(stage,{reason:'network_error'});}
      for(const cookie of response.headers.getSetCookie()) {
        const part=cookie.split(';')[0],index=part.indexOf('=');if(index>0)cookies.set(part.slice(0,index),part.slice(index+1));
      }
      const text=await response.text(),type=response.headers.get('content-type') || '';
      steps.push({stage,httpStatus:response.status,responseType:type.split(';')[0]});
      if(!response.ok)throw new ProbeError(stage,{reason:'http_error',httpStatus:response.status,responseType:type.split(';')[0],captcha:response.headers.get('x-yandex-captcha')==='captcha'});
      return text;
    }
    async function post(stage,path,body) {
      const text=await request(stage,path,body);let data;
      try {data=JSON.parse(text);}catch{throw new ProbeError(stage,{reason:'non_json_response'});}
      return data?.data ?? data;
    }
    return {
      post,
      async open(stage) {
        const text=await request(stage,'/');
        const match=/<script[^>]+id="__page_props__-data"[^>]*>([\s\S]*?)<\/script>/.exec(text);
        let props;try{props=JSON.parse(match?.[1]);}catch{throw new ProbeError(stage,{reason:'missing_page_props'});}
        if(!props.csrfToken || !props.authProxyCsrfToken)throw new ProbeError(stage,{reason:'missing_csrf'});
        headers={'Origin':origin,'Referer':origin+'/','X-Lavka-Web-City':'213','X-Lavka-Web-Locale':'ru-RU','X-Csrf-Token-Bff':props.csrfToken,'X-Csrf-Token':props.authProxyCsrfToken};
      }
    };
  }
  function assert(condition,stage,reason){if(!condition)throw new ProbeError(stage,{reason});}
  const retrieveBody={position,isSupermarket:false};
  function updateBody(cart,items) {
    return {items,position,cartId:cart.cartId,cartVersion:cart.cartVersion,idempotencyToken:cart.nextIdempotencyToken || cart.idempotencyToken,
      isUserOrderEdit:false,depotType:'regular',deliveryType:cart.deliveryType,deliveryTimeInfo:cart.deliveryTimeInfo,additionalData:{}};
  }
  try {
    const source=session();await source.open('source_home');
    const cart=await source.post('source_cart','/api/v1/providers/cart/v1/retrieve',retrieveBody);
    assert(typeof cart.cartId==='string' && /^[a-z0-9-]{1,100}$/i.test(cart.cartId) && !cart.items?.length,'source_cart','invalid_or_nonempty_new_cart');
    const search=await source.post('search','/api/v1/providers/search/v3/lavka',{position,text:'молоко',productsLimit:5,subcategoriesLimit:0,useRetail:true,source:'manual_input',depotType:'regular',currencySign:'₽'});
    const product=search.cacheProducts?.find(p=>typeof p.id==='string' && p.currentPrice!==undefined);
    assert(product,'search','no_products');
    const item={id:product.id,quantity:'1',pricePerCount:'1',quantityType:'unit',price:String(product.currentPrice),title:'',currency:'RUB'};
    const updated=await source.post('source_update','/api/v1/providers/cart/v1/update',updateBody(cart,[item]));
    assert(updated.items?.some(i=>i.id===product.id && Number(i.quantity)===1),'source_update','item_not_added');
    const recipient=session();await recipient.open('recipient_home');
    const shared=await recipient.post('shared_retrieve','/api/v1/providers/cart/v1/shared/retrieve',{sharedCartId:cart.cartId,...retrieveBody});
    assert(shared.items?.length===1 && shared.items[0].id===product.id,'shared_retrieve','shared_items_differ');
    const target=await recipient.post('recipient_cart','/api/v1/providers/cart/v1/retrieve',retrieveBody);
    assert(target.cartId!==cart.cartId && !target.items?.length,'recipient_cart','recipient_not_independent');
    const imported=await recipient.post('recipient_update','/api/v1/providers/cart/v1/update',updateBody(target,shared.items));
    assert(imported.items?.some(i=>i.id===product.id && Number(i.quantity)===1),'recipient_update','import_failed');
    const link=new URL('/cart',origin);link.searchParams.set('sharedCartId',cart.cartId);link.searchParams.set('countryCode','RU');
    return {status:'ok',steps,anonymous:true,independentRecipient:true,itemCount:1,product:product.title?.replace(/[\u00ad]/g,'') || '',link:link.href,validUntil:updated.validUntil || cart.validUntil};
  }catch(error){return {status:'error',steps,error:error instanceof ProbeError?error.detail:{reason:'unexpected_response'}};}
}
