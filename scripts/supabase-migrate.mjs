// Management token is read only from the environment, never stored or logged.
// Node 24: NODE_USE_ENV_PROXY=1 node scripts/supabase-migrate.mjs --apply
import { readFile, readdir } from 'node:fs/promises';
import { seedSql } from './catalog-seed.mjs';
const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('backend/data/catalog.seed.json',root),'utf8'));
const seed=seedSql(catalog);
console.log(JSON.stringify({dishes:catalog.recipes.length,ingredients:catalog.ingredients.length,steps:catalog.recipes.reduce((n,r)=>n+r.steps.length,0),links:catalog.recipes.reduce((n,r)=>n+r.ingredients.length,0)}));
const apply=process.argv.includes('--apply');
const verify=process.argv.includes('--verify');
if(!apply && !verify) {console.log('Dry run. Use --apply to migrate and seed, --verify to run rollback-only database checks.');process.exit(0);}
const token=process.env.SUPABASE_ACCESS_TOKEN?.trim();
if(!token) throw Error('SUPABASE_ACCESS_TOKEN is required');
const ref=process.env.SUPABASE_PROJECT_REF || 'ssahtncunusgptkrkxkj';
if(!/^[a-z0-9]{20}$/.test(ref)) throw Error('Invalid project reference');
async function query(sql,readOnly=false) {
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(120000)});
 if(!response.ok) throw Error(`Supabase SQL failed (HTTP ${response.status}); no SQL or credentials logged`);
 return response.json();
}
if(verify && !apply) {
 console.log(JSON.stringify(await query(await readFile(new URL('supabase/tests/catalog.sql',root),'utf8'))));
 process.exit(0);
}
await query('create schema if not exists familymenu_internal; revoke all on schema familymenu_internal from public, anon, authenticated; create table if not exists familymenu_internal.migrations (name text primary key, applied_at timestamptz not null default now());');
const applied=new Set((await query('select name from familymenu_internal.migrations',true)).map(r=>r.name));
const dir=new URL('supabase/migrations/',root);
for(const name of (await readdir(dir)).filter(n=>/^\d+_[a-z_]+\.sql$/.test(n)).sort()) {
 if(applied.has(name)) {console.log('Already applied:',name);continue;}
 const sql=(await readFile(new URL(name,dir),'utf8')).replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');
 await query(`begin;\n${sql}\ninsert into familymenu_internal.migrations(name) values ('${name}');\ncommit;`);
 console.log('Applied:',name);
}
if(process.argv.includes('--migrations-only')) {console.log('Migrations applied without reimporting the catalog.');process.exit(0);}
await query(seed);console.log('Seed imported (repeatable upsert; history is preserved).');
console.log(JSON.stringify(await query('select (select count(*) from public.dishes) as dishes, (select count(*) from public.dish_steps) as steps, (select count(*) from public.ingredients) as ingredients, (select count(*) from public.dish_ingredients) as links',true)));
