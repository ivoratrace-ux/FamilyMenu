import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const ctx=vm.createContext({window:{}});vm.runInContext(await readFile(new URL('../../src/scan-inventory.js',import.meta.url),'utf8'),ctx);const scan=ctx.window.FamilyMenuScanInventory,plain=x=>JSON.parse(JSON.stringify(x));
test('explicit weights, volumes, counts and labelled multipacks convert to catalog units',()=>{
 for(const [text,unit,expected] of [['около 300 г','g',300],['0,5 кг','g',500],['1.5 л','ml',1500],['2 × 500 г','g',1000],['2 бутылки по 0,5 л','ml',1000],['6 шт.','шт',6],['2 банки','банка',2],['1 пучок','пучок',1],['3 зубчика','зуб.',3],['4 пакетика','пак.',4]])assert.equal(scan.parseAmount(text,unit),expected,text);
});
test('unknown packaging, incompatible units, ranges and conflicting estimates require explicit quantity',()=>{
 for(const text of ['1 упаковка','1 бутылка','300–500 г','Количество уточните по фото','500 мл','2 шт.','примерно полкило'])assert.equal(scan.parseAmount(text,'g'),null,text);
 assert.equal(scan.parseAmount('0.5 шт','шт'),null);assert.equal(scan.quantity('g',''),null);assert.equal(scan.quantity('g',0),null);assert.equal(scan.quantity('g',Infinity),null);
});
test('existing stock and selected same-ID rows are added once, with decimal-safe arithmetic',()=>{
 const pantry=[{key:'milk',qty:0.1},{key:'eggs',qty:4}];const result=scan.add(pantry,[{key:'milk',qty:0.2},{key:'eggs',qty:6},{key:'eggs',qty:2},{key:'rice',qty:300}]);
 assert.deepEqual(plain(result),[{key:'milk',qty:0.3},{key:'eggs',qty:12},{key:'rice',qty:300}]);assert.equal(pantry[1].qty,4,'No mutation before validation finishes');
});
test('new scans remain available immediately, without inheriting pack-leftover accounting',()=>{
 const original=[{key:'milk',qty:200,src:'left8',plan:'current'}],result=scan.add(original,[{key:'milk',qty:500}]);assert.deepEqual(plain(result),[...original,{key:'milk',qty:500}]);
});
test('invalid additions or excessive aggregate stock fail atomically',()=>{
 const original=[{key:'eggs',qty:1e9}];assert.throws(()=>scan.add(original,[{key:'rice',qty:500},{key:'eggs',qty:1}]));assert.equal(original.length,1);
 assert.throws(()=>scan.add([],[{key:'milk',qty:NaN}]));
});
