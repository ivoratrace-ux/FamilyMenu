/* Convert only explicit quantities; never guess package weights or overlapping photos. */
(() => {
  const units={g:['г','гр','грамм','грамма','граммов','g'],kg:['кг','килограмм','килограмма','килограммов','kg'],ml:['мл','миллилитр','миллилитра','миллилитров','ml'],l:['л','литр','литра','литров','l'],
    'шт':['шт','штука','штуки','штук'],'банка':['банка','банки','банок'],'пучок':['пучок','пучка','пучков'],'зуб.':['зуб','зубчик','зубчика','зубчиков'],'пак.':['пак','пакетик','пакетика','пакетиков']};
  function quantity(unit,value){
    if(value==='' || value==null)return null;
    const n=Number(String(value).replace(',','.'));
    if(!Number.isFinite(n)||n<=0||n>1e9 || Math.abs(n*1000-Math.round(n*1000))>1e-5)return null;
    if(!['g','ml'].includes(unit)&&!Number.isInteger(n))return null;
    return Math.round(n*1000)/1000;
  }
  function parseAmount(amount,unit){
    let text=String(amount||'').toLowerCase().replace(/\u00a0|\u202f/g,' ').trim().replace(/^(?:около|примерно|приблизительно|~|≈)\s*/,'').replace(/\.$/,'');
    // One explicit amount or a count of packages with an explicit weight/volume each.
    let multiplier=1;
    const multi=text.match(/^(\d+)\s*(?:[xх×*]|(?:упаковки|упаковок|упаковка|пачки|пачек|пачка|бутылки|бутылок|бутылка)\s+по)\s*(.+)$/);
    if(multi){multiplier=Number(multi[1]);text=multi[2];}
    const match=text.match(/^(\d+(?:[.,]\d+)?)\s*([a-zа-яё.]+)$/);if(!match)return null;
    const source=Object.keys(units).find(k=>units[k].includes(match[2].replace(/\.$/,'')));if(!source)return null;
    let factor=source===unit?1:unit==='g'&&source==='kg'?1000:unit==='ml'&&source==='l'?1000:null;
    if(factor===null)return null;
    return quantity(unit,Number(match[1].replace(',','.'))*multiplier*factor);
  }
  function add(pantry,additions){
    const result=pantry.map(p=>({...p})),totals=new Map(),added=new Map();
    for(const p of result)totals.set(p.key,(totals.get(p.key)||0)+Math.round(Number(p.qty||0)*1000));
    for(const {key,qty} of additions){
      if(typeof key!=='string'||!Number.isFinite(qty)||qty<=0||Math.abs(qty*1000-Math.round(qty*1000))>1e-5)throw Error('Проверьте количество распознанных продуктов.');
      const ticks=(added.get(key)||0)+Math.round(qty*1000);added.set(key,ticks);
      if((totals.get(key)||0)+ticks>1e12)throw Error('Количество в запасах превышает допустимый предел. Проверьте результат сканирования.');
    }
    for(const [key,ticks] of added){
      // Pack leftovers retain their special menu accounting; scanned food is available immediately.
      const existing=result.find(p=>p.key===key&&p.src!=='left8');
      if(existing)existing.qty=(Math.round(Number(existing.qty||0)*1000)+ticks)/1000;
      else result.push({key,qty:ticks/1000});
    }
    return result;
  }
  function consume(pantry,ingredients){
    const needed=new Map();
    for(const {key,qty} of ingredients){
      if(typeof key!=='string'||!Number.isFinite(qty)||qty<0)throw Error('Не удалось определить количество ингредиентов блюда.');
      needed.set(key,(needed.get(key)||0)+qty);
    }
    for(const [key,qty] of needed)needed.set(key,Math.round(qty*1000));
    return pantry.map(item=>{
      const available=Math.max(0,Math.round(Number(item.qty||0)*1000)),used=Math.min(available,needed.get(item.key)||0);
      needed.set(item.key,Math.max(0,(needed.get(item.key)||0)-used));
      return {...item,qty:(available-used)/1000};
    }).filter(item=>item.qty>0);
  }
  window.FamilyMenuScanInventory={quantity,parseAmount,add,consume};
})();
