import assert from 'node:assert/strict';
export const ART_BASE='https://vibe-coding-sc04.onrender.com/assets/art';
const literal=v=>v===null || v===undefined ? 'null' : typeof v==='number' ? (assert.ok(Number.isFinite(v)),String(v)) : `'${String(v).replaceAll("'","''")}'`;
const array=(xs,type='text')=>`ARRAY[${xs.map(literal).join(',')}]::${type}[]`;
export function seedSql(catalog) {
 const {recipes,ingredients,promos,foods}=catalog;
 assert.equal(new Set(recipes.map(r=>r.id)).size,recipes.length);
 assert.equal(new Set(ingredients.map(i=>i.id)).size,ingredients.length);
 const ids=new Set(ingredients.map(i=>i.id));
 const statements=['begin;'];
 function insert(table,columns,rows,conflict) {
  statements.push(`insert into public.${table} (${columns.join(',')}) values\n${rows.map(row=>'('+row.join(',')+')').join(',\n')}\non conflict (${conflict.join(',')}) do update set ${columns.filter(c=>!conflict.includes(c)).map(c=>`${c}=excluded.${c}`).join(',')};`);
 }
 insert('ingredients',['id','name','description','category','unit','price','allergens','flags','nutrition','lavka_price','lavka_path'],ingredients.map(i=>[
  literal(i.id),literal(i.name),literal(i.description||i.category),literal(i.category),literal(i.unit),literal(i.price),array(i.allergens),array(i.flags),array(i.nutrition,'numeric'),literal(i.lavkaPrice),literal(i.lavkaPath)
 ]),['id']);
 insert('dishes',['id','name','description','cooking_minutes','image_url','meal','tags','spices','servings'],recipes.map(r=>{
  assert.ok(r.steps.length>0);assert.equal(r.steps.length,r.stepSeconds.length);assert.equal(r.steps.length,r.stepTips.length);
  assert.ok(r.ingredients.every(i=>ids.has(i.id)&&i.quantity>0));
  return [literal(r.id),literal(r.name),literal(r.description||`Основные ингредиенты: ${r.ingredients.slice(0,3).map(i=>ingredients.find(x=>x.id===i.id).name.toLowerCase()).join(', ')}.`),literal(r.minutes),literal(`${ART_BASE}/${r.id}.png`),literal(r.meal),array(r.tags),array(r.spices),'4'];
 }),['id']);
 const dishIds=recipes.map(r=>literal(r.id)).join(',');
 statements.push(`delete from public.dish_steps where dish_id in (${dishIds});`,`delete from public.dish_ingredients where dish_id in (${dishIds});`);
 insert('dish_steps',['dish_id','position','description','duration_seconds','tip','image_url'],recipes.flatMap(r=>r.steps.map((s,n)=>[
  literal(r.id),String(n+1),literal(s),literal(r.stepSeconds[n]),literal(r.stepTips[n]),literal(`${ART_BASE}/${r.id}-step-${n}.png`)
 ])),['dish_id','position']);
 insert('dish_ingredients',['dish_id','ingredient_id','position','quantity','unit'],recipes.flatMap(r=>r.ingredients.map((i,n)=>[
  literal(r.id),literal(i.id),String(n+1),literal(i.quantity),literal(ingredients.find(x=>x.id===i.id).unit)
 ])),['dish_id','ingredient_id']);
 insert('catalog_settings',['key','value'],[['promos',promos],['foods',foods]].map(([k,v])=>[literal(k),literal(JSON.stringify(v))+'::jsonb']),['key']);
 statements.push('commit;');return statements.join('\n');
}
