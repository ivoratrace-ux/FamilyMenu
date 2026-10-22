/* Translate the original prototype state without changing the existing backend contract. */
(() => {
  const clone=x=>JSON.parse(JSON.stringify(x));
  const selected=map=>Object.keys(map || {}).filter(k=>map[k]);
  const marked=list=>Object.fromEntries((list || []).map(k=>[k,true]));
  const dayKey=value=>{const d=new Date(value);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  const mealKeys=['b','l','s','d','z','k'];
  function toMenu(plan) {
    if(!plan)return null;
    return {approved:plan.status==='approved',days:plan.days.map((day,index)=>({date:dayKey(day.date),slots:Object.entries(day.slots).map(([meal,slot])=>{
      const source=slot.left?plan.days[slot.from]?.slots[slot.of || meal]:slot;
      return {meal,recipeId:source?.rid || null,servings:source?.serv || 1,leftover:!!slot.left,cooked:!!(source?.cooked || slot.cooked)};
    })}))};
  }
  function fromMenu(menu) {
    if(!menu)return null;
    const days=menu.days.map((day,index)=>({date:new Date(day.date.slice(0,10)+'T12:00:00').toISOString(),slots:Object.fromEntries(day.slots.map(slot=>[slot.meal,slot.leftover && index>0?{left:true,from:index-1,of:slot.meal,cooked:slot.cooked}:{rid:slot.recipeId,serv:slot.servings,cooked:slot.cooked}]))}));
    // Older clients could save shorter menus directly. Keep their days, pad to the API's seven-day contract.
    while(days.length && days.length<7){const d=new Date(days.at(-1).date);d.setDate(d.getDate()+1);days.push({date:d.toISOString(),slots:{}});}
    return days.length?{created:days[0].date,status:menu.approved?'approved':'draft',days:days.slice(0,7)}:null;
  }
  function toPreferences(state,previous={}) {
    const p=state.profile;
    const extra={},dates=Object.fromEntries((state.plan?.days || []).map(d=>[d.date.slice(0,10),dayKey(d.date)]));
    for(const [date,members] of Object.entries(state.extra || {})) for(const [id,foods] of Object.entries(members)) {
      const index=p.members.findIndex(m=>m.id===id);if(index>=0)extra[(dates[date] || date)+':'+index]=foods.map(f=>({label:f.label,calories:Math.round(f.kcal)}));
    }
    const {plan,pantry,user,...webPrototype}=clone(state);
    webPrototype.planDates=state.plan?.days.map(d=>d.date) || [];
    return {...previous,stage:'app',plan:null,onboarded:!!state.plan,
      profile:{...previous.profile,members:p.members.map(m=>({name:m.name,child:m.kind==='child',sex:m.sex,age:Math.round(+m.age || 0),weight:Math.round(+m.weight || 0),height:Math.round(+m.height || 0),activity:m.act,goal:m.goal,customCalories:Math.round(+m.custom || 0)})),
        likes:p.likes,dislikes:p.dislikes,allergies:p.allergies,diet:p.diet,goals:p.goals,budget:p.budget,city:p.city,maxTime:p.maxTime,meals:selected(p.meals),days:7,soupBatch:p.soupBatch,reminder:!!p.reminder?.on,reminderTime:p.reminder?.time || '20:00'},
      bought:selected(state.bought),eaten:selected(state.eaten).map(key=>(dates[key.slice(0,10)] || key.slice(0,10))+key.slice(10)),extra,liked:state.history.liked,disliked:state.history.disliked,blocked:state.history.blocked,
      store:state.store,theme:state.theme || previous.theme || 'system',reminderShown:state.remShown || '',webPrototype};
  }
  function fromDocument(document,defaults) {
    const p=document.preferences;
    if(!p)return {...defaults,plan:fromMenu(document.menu)};
    let state=p.webPrototype?{...defaults,...clone(p.webPrototype)}:clone(defaults);
    const profile=p.profile || {},oldMembers=state.profile.members;
    const shown=(value,old)=>old!=null && Math.round(+old || 0)===value?old:(value?String(value):'');
    for(const key of ['likes','dislikes','allergies','diet','goals','budget','city','maxTime','soupBatch'])if(key in profile)state.profile[key]=clone(profile[key]);
    if(profile.members?.length)state.profile.members=profile.members.map((m,i)=>({...oldMembers[i],id:oldMembers[i]?.id || 'remote-'+i,name:m.name,kind:m.child?'child':'adult',sex:m.sex || '',age:shown(m.age,oldMembers[i]?.age),weight:shown(m.weight,oldMembers[i]?.weight),height:shown(m.height,oldMembers[i]?.height),act:m.activity || 'mid',goal:m.goal || 'keep',custom:shown(m.customCalories,oldMembers[i]?.custom),open:oldMembers[i]?.open || false}));
    state.profile.meals=Object.fromEntries(mealKeys.map(k=>[k,(profile.meals || []).includes(k)]));
    state.profile.reminder={on:profile.reminder!==false,time:profile.reminderTime || '20:00'};
    state.bought=marked(p.bought);state.store=p.store || 'vv';state.theme=p.theme || 'system';
    state.history={...state.history,liked:p.liked || [],disliked:p.disliked || [],blocked:p.blocked || []};
    state.plan=fromMenu(document.menu);
    if(state.plan && p.webPrototype?.planDates?.length===state.plan.days.length)state.plan.days.forEach((d,i)=>{const original=p.webPrototype.planDates[i];if(dayKey(original)===document.menu.days[i].date)d.date=original;});
    const dates=Object.fromEntries((state.plan?.days || []).map(d=>[dayKey(d.date),d.date.slice(0,10)]));
    state.eaten=marked((p.eaten || []).map(key=>(dates[key.slice(0,10)] || key.slice(0,10))+key.slice(10)));
    state.extra={};
    for(const [key,foods] of Object.entries(p.extra || {})) {const split=key.lastIndexOf(':'),date=key.slice(0,split),member=state.profile.members[+key.slice(split+1)];if(member)(state.extra[dates[date] || date] ||= {})[member.id]=foods.map(f=>({label:f.label,kcal:f.calories}));}
    state.pantry=[];state.user=null;
    return state;
  }
  globalThis.FamilyMenuState={toMenu,fromMenu,toPreferences,fromDocument};
})();
