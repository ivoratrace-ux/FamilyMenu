import { DEFAULT_SUPABASE_URL } from './supabase.mjs';
export function createCatalogRepository({url=process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL,apiKey=process.env.SUPABASE_API_KEY,fetchImpl=fetch,cacheMs=60000,timeoutMs=15000}={}) {
 let cached,expires=0,pending;
 return {async load() {
  if(cached && Date.now()<expires) return cached;
  if(pending) return pending;
  pending=(async()=>{
   if(!apiKey?.trim()) throw Error('Catalog not configured');
   const base=new URL(url);
   if(base.protocol!=='https:' || base.username || base.password || base.search || base.hash || !['','/'].includes(base.pathname)) throw Error('Invalid catalog configuration');
   const headers={apikey:apiKey,'Content-Type':'application/json'};
   if(apiKey.split('.').length===3) headers.Authorization=`Bearer ${apiKey}`;
   const response=await fetchImpl(`${base.origin}/rest/v1/rpc/get_catalog`,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
   if(!response.ok) throw Error('Catalog unavailable');
   const data=await response.json();
   if(!Array.isArray(data?.recipes) || !data.recipes.length || !Array.isArray(data.ingredients) || !data.ingredients.length || !Array.isArray(data.promos) || !Array.isArray(data.foods)) throw Error('Invalid catalog');
   cached=data;expires=Date.now()+cacheMs;return data;
  })();
  try{return await pending;}finally{pending=undefined;}
 }};
}
