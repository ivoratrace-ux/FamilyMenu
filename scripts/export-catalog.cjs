// One-time migration of the original static catalog. Kept reproducible for data updates.
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({window:{}, setInterval:()=>{}});
vm.runInContext(fs.readFileSync('legacy/src/data.js','utf8'), context);
vm.runInContext(fs.readFileSync('legacy/src/art.js','utf8'), context);
context.dishArt = context.window.dishArt;
vm.runInContext(fs.readFileSync('legacy/src/cook.js','utf8'), context);
vm.runInContext(`R.forEach(r => {
  const keys = r.i.map(([key])=>key);
  if (keys.some(k=>k.startsWith('minced')) && !r.tags.includes('mince')) r.tags.push('mince');
  if (keys.some(k=>k==='fish_white'||k==='cod') && !r.tags.includes('whitefish')) r.tags.push('whitefish');
  if (r.t<=30 && !r.tags.includes('quick')) r.tags.push('quick');
})`,context);
const data = vm.runInContext(`({ ingredients:Object.entries(ING).map(([id,v])=>({id,name:v[0],category:v[1],unit:v[2],price:v[3],allergens:v[4],flags:v[5],nutrition:v[6],lavkaPrice:LAVKA[id]?.[0]??null,lavkaPath:LAVKA[id]?.[3]??null})), recipes:R.map(r=>({id:r.id,name:r.n,meal:r.m,minutes:r.t,tags:r.tags,ingredients:r.i.map(([id,quantity])=>({id,quantity})),spices:r.sp||[],steps:r.s,stepSeconds:r.s.map(stepDur),stepTips:r.s.map(t=>stepAction(t)[2])})), foods:FOODS.map(f=>({stems:f[0],kcal:f[1],piece:f[2],portion:f[3]})), promos:VV_PROMO.map(v=>({name:v[0],price:v[1],regularPrice:v[2],condition:v[3],until:v[4]})) })`,context);
const root='backend/public';
fs.writeFileSync(`backend/data/catalog.seed.json`,JSON.stringify(data,null,2)+'\n');
if(!process.argv.includes("--catalog-only")) for(const recipe of vm.runInContext('R',context))fs.writeFileSync(`${root}/art/${recipe.id}.svg`,context.window.dishArt(recipe));
if(!process.argv.includes("--catalog-only")) for(const recipe of vm.runInContext('R',context))for(let i=0;i<recipe.s.length;i++)fs.writeFileSync(`${root}/art/${recipe.id}-step-${i}.svg`,context.stepArt(recipe,i));
console.log(`Exported ${data.recipes.length} recipes and ${data.ingredients.length} ingredients`);
