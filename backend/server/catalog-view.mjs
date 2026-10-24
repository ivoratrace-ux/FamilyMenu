import {extendCatalog} from '../../src/extra8.js';

// The existing web-only recipes share one definition with the API. Inventory RPCs still
// use the canonical Supabase catalog; client ingredients remain in user preferences.
const views=new WeakMap();
export function catalogView(source) {
 if(!views.has(source))views.set(source,extendCatalog(structuredClone(source)));
 return views.get(source);
}
export function recipeCatalog(source,{ids=[],kind,document,inventory}={}) {
 const all=catalogView(source),byId=new Map(all.recipes.map(r=>[r.id,r]));
 const recipes=new Map(),ingredients=new Set();
 const web=document?.preferences?.webPrototype || {},variants=web.var8 || {};
 const own=web.myRecipes || document?.preferences?.myRecipes || [];
 for(const r of own)byId.set(r.id,r.ingredients?r:{id:r.id,name:r.n,meal:r.m,minutes:r.t,tags:r.tags || [],ingredients:(r.i || []).map(([id,quantity])=>({id,quantity})),steps:r.s || [],spices:r.sp || []});
 const visited=new Set();
 function add(id) {
  if(!id || visited.has(id))return;visited.add(id);
  const r=byId.get(id);
  if(r){recipes.set(id,r);for(const i of r.ingredients)ingredients.add(i.id);return;}
  const pair=/^c_(.+)_(g\d+)$/.exec(id);if(pair){add(pair[1]);add(pair[2]);return;}
  if(variants[id]){add(variants[id].b);for(const [key] of variants[id].i)ingredients.add(key);return;}
  if(id.startsWith('h8~')){ingredients.add('oil');for(const key of id.split('~').slice(1))if(key)ingredients.add(key);}
 }
 if(kind) {
  const soup=r=>r.tags.includes('soup');
  const salad=r=>r.tags.includes('salad') || /^(Салат|Винегрет|Табуле)/.test(r.name);
  const match={breakfast:r=>r.meal==='b',soup:r=>r.meal==='m'&&soup(r),salad:r=>r.meal==='m'&&salad(r),pair:r=>['p','g'].includes(r.meal)||(r.meal==='m'&&!soup(r)&&!salad(r)),dish:r=>r.meal==='m'&&!soup(r)&&!salad(r),side:r=>r.meal==='g',dessert:r=>r.meal==='z',drink:r=>r.meal==='k',snack:r=>r.meal==='s'}[kind];
  if(!match)throw new Error('Unknown recipe category');
  for(const r of all.recipes)if(match(r))add(r.id);
 }
 for(const id of ids)add(id);
 for(const day of document?.menu?.days || [])for(const slot of day.slots)add(slot.recipeId);
 for(const i of inventory?.items || [])ingredients.add(i.ingredientId);
 for(const i of web.pantryExtra8 || [])ingredients.add(i.key);
 // Saved personal recipes/variants can be rendered without a catalog download too.
 for(const r of own)for(const [id] of r.i || [])ingredients.add(id);
 return {recipes:[...recipes.values()],ingredients:all.ingredients.filter(i=>ingredients.has(i.id)),foods:[],promos:[]};
}
