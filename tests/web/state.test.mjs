import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {validateUserState} from '../../backend/server/user-state.mjs';
const source=await readFile(new URL('../../src/state.js',import.meta.url),'utf8');
const context=vm.createContext({});vm.runInContext(source,context);
const convert=context.FamilyMenuState;
const plain=x=>JSON.parse(JSON.stringify(x));
function state(){return {stage:'app',tab:'menu',user:{id:'private-user'},pantry:[{key:'milk',qty:200}],store:'vv',profile:{members:[{id:'m1',name:'Я',kind:'adult',sex:'f',age:'32',weight:'60',height:'165',act:'mid',goal:'keep',custom:'',open:false}],likes:[],dislikes:[],allergies:[],diet:'all',goals:[],budget:8000,city:'msk',maxTime:45,meals:{b:false,l:true,s:false,d:true,z:false,k:false},soupBatch:true,reminder:{on:true,time:'20:00'}},history:{liked:['m1'],disliked:[],blocked:[],replaced:[]},bought:{milk:true},eaten:{'2026-10-22:l':true},extra:{'2026-10-22':{m1:[{label:'Банан',kcal:100}]}},plan:{created:'2026-10-22T12:00:00.000Z',status:'approved',days:Array.from({length:7},(_,i)=>({date:`2026-10-${22+i}T12:00:00.000Z`,slots:{l:i===1?{left:true,from:0,of:'l'}:{rid:'m1',serv:2,cooked:i===0}}}))}};}
test('original UI state satisfies unchanged backend contract, with no identity or stock in preferences',()=>{
 const s=state(),preferences=convert.toPreferences(s),menu=convert.toMenu(s.plan);
 validateUserState(preferences,menu);
 assert.equal(preferences.plan,null);assert.equal(preferences.profile.members[0].age,32);
 assert.equal(preferences.webPrototype.user,undefined);assert.equal(preferences.webPrototype.pantry,undefined);
 assert.deepEqual(plain(preferences.bought),['milk']);assert.equal(menu.days.length,7);assert.equal(menu.days[1].slots[0].recipeId,'m1');assert.equal(menu.days[1].slots[0].leftover,true);
});
test('saved menu, family, cooking state, food and likes round-trip to the original UI',()=>{
 const s=state(),preferences=convert.toPreferences(s),menu=convert.toMenu(s.plan);
 const restored=convert.fromDocument({preferences,menu},state());
 assert.deepEqual(plain(restored.profile),s.profile);assert.deepEqual(plain(restored.eaten),s.eaten);assert.deepEqual(plain(restored.extra),s.extra);
 assert.equal(restored.plan.status,'approved');assert.equal(restored.plan.days[1].slots.l.from,0);assert.equal(restored.plan.days[0].slots.l.cooked,true);assert.equal(restored.user,null);assert.deepEqual(plain(restored.pantry),[]);
});
test('existing account documents load and unrelated backend fields survive subsequent saves',()=>{
 const prior={profile:{members:[{name:'Анна',child:false,age:30}],meals:['d'],reminder:true},liked:['m5'],bought:['milk'],myRecipes:[{id:'own-1'}],subscription:{plan:'paid'},events:[{name:'old'}]};
 const s=convert.fromDocument({preferences:prior,menu:convert.toMenu(state().plan)},state());
 assert.equal(s.profile.members[0].name,'Анна');assert.equal(s.profile.meals.d,true);assert.equal(s.bought.milk,true);
 const result=convert.toPreferences(s,prior);validateUserState(result,convert.toMenu(s.plan));
 assert.deepEqual(plain(result.myRecipes),prior.myRecipes);assert.deepEqual(plain(result.subscription),prior.subscription);
});
test('shorter menus from prior clients are retained and padded for the seven-day API',()=>{
 const m=plain(convert.toMenu(state().plan));m.days=m.days.slice(0,3);
 const result=convert.fromMenu(m);assert.equal(result.days.length,7);assert.equal(result.days[0].slots.l.rid,'m1');
 validateUserState(convert.toPreferences(state()),convert.toMenu(result));
});
test('SVG artwork stays byte-for-byte identical to the source prototype',async()=>{
 for(const file of ['art.js'])assert.deepEqual(await readFile(new URL('../../src/'+file,import.meta.url)),await readFile(new URL('../../legacy/src/'+file,import.meta.url)));
});

test('Moscow midnight keeps the correct calendar day, food marks and quantities after a round-trip',()=>{
 const before=process.env.TZ;process.env.TZ='Europe/Moscow';
 try {
  const s=state();s.plan.days[0].date='2026-10-21T21:00:00.000Z';s.eaten={'2026-10-21:l':true};s.extra={'2026-10-21':{m1:[{label:'Банан',kcal:100}]}};
  const menu=convert.toMenu(s.plan),preferences=convert.toPreferences(s);
  assert.equal(menu.days[0].date,'2026-10-22');assert.equal(preferences.eaten[0],'2026-10-22:l');
  const restored=convert.fromDocument({preferences,menu},state());assert.equal(restored.plan.days[0].date,s.plan.days[0].date);assert.deepEqual(plain(restored.eaten),s.eaten);
 } finally {if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}
});

test('canonical server fields override stale UI metadata from another client',()=>{
 const s=state(),preferences=plain(convert.toPreferences(s));preferences.profile.budget=12000;preferences.profile.members[0].name='Новое имя';
 const result=convert.fromDocument({preferences,menu:convert.toMenu(s.plan)},state());assert.equal(result.profile.budget,12000);assert.equal(result.profile.members[0].name,'Новое имя');
});

test('original decimal weight values survive through the integer-compatible backend profile',()=>{
 const s=state();s.profile.members[0].weight='65.5';const preferences=convert.toPreferences(s),menu=convert.toMenu(s.plan);
 validateUserState(preferences,menu);assert.equal(preferences.profile.members[0].weight,66);
 const restored=convert.fromDocument({preferences,menu},state());assert.equal(restored.profile.members[0].weight,'65.5');
});

test('v8 answers, own recipes and per-meal kinds round-trip through the seven-day API',()=>{
 const s=state();s.profile.days=3;s.profile.mealSetup={b:'none',l:'soup',s:'none',d:'pair'};
 s.myRecipes=[{id:'uabc',n:'Бабушкин борщ',m:'m',t:60,tags:['soup','mine'],i:[['potato',300]],sp:[],s:['Сварить']}];
 const preferences=convert.toPreferences(s),menu=convert.toMenu(s.plan);validateUserState(preferences,menu);
 const restored=convert.fromDocument({preferences,menu},state());
 assert.equal(restored.profile.days,3);assert.deepEqual(plain(restored.profile.mealSetup),s.profile.mealSetup);assert.equal(restored.myRecipes[0].n,'Бабушкин борщ');
});
