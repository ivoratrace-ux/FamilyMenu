import { DEFAULT_SUPABASE_URL } from './supabase.mjs';
export class InventoryError extends Error {
  constructor(status,message) {super(message);this.status=status;}
}
export function validateInventoryItems(items,action='replace') {
  if (!Array.isArray(items) || items.length>1000 || (action!=='replace' && items.length!==1)) throw new InventoryError(400,'Неверный список ингредиентов.');
  const seen=new Set();
  for(const item of items) {
    if(!item || typeof item!=='object' || Object.keys(item).some(k=>!['ingredientId','quantity'].includes(k)) ||
      typeof item.ingredientId!=='string' || !/^[a-z0-9_-]{1,100}$/.test(item.ingredientId) || seen.has(item.ingredientId)) throw new InventoryError(400,'Проверьте ингредиенты: повторения недопустимы.');
    seen.add(item.ingredientId);
    if(action!=='delete' && (typeof item.quantity!=='number' || !Number.isFinite(item.quantity) || item.quantity<=0 || item.quantity>1e9 || Math.abs(item.quantity*1000-Math.round(item.quantity*1000))>0.0001)) throw new InventoryError(400,'Количество должно быть положительным числом, до трёх знаков после запятой.');
  }
  return items;
}
export function createInventoryRepository({url=process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL,apiKey=process.env.SUPABASE_API_KEY,fetchImpl=fetch}={}) {
  async function rpc(name,body={}) {
    if(!apiKey?.trim()) throw new InventoryError(503,'Запасы временно недоступны.');
    const base=new URL(url);
    if(base.protocol!=='https:' || base.username || base.password || base.search || base.hash || !['','/'].includes(base.pathname)) throw Error('Invalid database configuration');
    const headers={apikey:apiKey,'Content-Type':'application/json'};
    if(apiKey.split('.').length===3) headers.Authorization=`Bearer ${apiKey}`;
    const response=await fetchImpl(`${base.origin}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok) {
      const error=await response.json().catch(()=>({}));
      if(error.code==='40001') throw new InventoryError(409,'Запасы уже изменились. Обновите список и повторите действие.');
      if(error.code==='22023') throw new InventoryError(400,'Проверьте ингредиенты и количество.');
      throw new InventoryError(503,'Не удалось сохранить или загрузить запасы. Попробуйте ещё раз.');
    }
    const result=await response.json();
    if(!result || result.userEmail!=='test@test.com' || !Number.isSafeInteger(result.revision) || !Array.isArray(result.items)) throw Error('Invalid inventory response');
    return result;
  }
  return {load:()=>rpc('get_test_inventory'),mutate:async(action,items,revision)=>{
    validateInventoryItems(items,action);
    if(!Number.isSafeInteger(revision) || revision<0) throw new InventoryError(400,'Обновите список запасов перед изменением.');
    return rpc('mutate_test_inventory',{p_action:action,p_items:items,p_revision:revision});
  }};
}
export function createInventoryRouter({inventory,catalog}) {
 return async(req,path,send,res)=>{
  try {
    if(path==='/api/ingredients') {
      if(req.method!=='GET') {res.setHeader('Allow','GET, OPTIONS');return send(405,{error:'Метод не поддерживается.'});}
      const q=new URL(req.url,'http://localhost').searchParams.get('q')?.trim() || '';
      if(q.length<3 || q.length>80) return send(400,{error:'Введите от 3 до 80 символов для поиска.'});
      const ingredients=(await catalog.load()).ingredients.filter(i=>i.name.toLocaleLowerCase('ru').includes(q.toLocaleLowerCase('ru'))).sort((a,b)=>a.name.localeCompare(b.name,'ru')).slice(0,20).map(({id,name,unit})=>({id,name,unit}));
      return send(200,{ingredients});
    }
    if(path==='/api/inventory' && req.method==='GET') return send(200,await inventory.load());
    const action=path==='/api/inventory' && req.method==='PUT' ? 'replace' : path==='/api/inventory/item' && req.method==='PUT' ? 'upsert' : path==='/api/inventory/item' && req.method==='DELETE' ? 'delete' : null;
    if(!action) {res.setHeader('Allow',path==='/api/inventory'?'GET, PUT, OPTIONS':'PUT, DELETE, OPTIONS');return send(405,{error:'Метод не поддерживается.'});}
    if(req.headers['content-type']?.split(';')[0].trim()!=='application/json') return send(415,{error:'Нужен JSON.'});
    const chunks=[];let size=0;
    for await(const chunk of req) {size+=chunk.length;if(size>131072){req.resume();return send(413,{error:'Список слишком большой.'});}chunks.push(chunk);}
    let body;try {body=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return send(400,{error:'Некорректный JSON.'});}
    const keys=action==='replace'?['items','revision']:action==='delete'?['ingredientId','revision']:['ingredientId','quantity','revision'];
    if(!body || typeof body!=='object' || Object.keys(body).some(k=>!keys.includes(k)) || !Number.isSafeInteger(body.revision) || body.revision<0) throw new InventoryError(400,'Неверный запрос запасов.');
    const items=action==='replace'?body.items:action==='delete'?[{ingredientId:body.ingredientId}]:[{ingredientId:body.ingredientId,quantity:body.quantity}];
    validateInventoryItems(items,action);
    return send(200,await inventory.mutate(action,items,body.revision));
  } catch(error) {return send(error instanceof InventoryError?error.status:503,{error:error instanceof InventoryError?error.message:'Запасы временно недоступны. Повторите попытку.'});}
 };
}
