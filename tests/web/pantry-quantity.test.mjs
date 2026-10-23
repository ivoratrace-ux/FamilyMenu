import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({window:{}});vm.runInContext(await readFile(new URL('../../src/pantry-quantity.js',import.meta.url),'utf8'),context);
const qty=context.window.FamilyMenuPantryQty;
test('grams and millilitres move by exactly 100, including amounts not divisible by 100',()=>{
 for(const unit of ['g','ml']){assert.equal(qty.step(unit),100);assert.equal(qty.change(unit,350,1),450);assert.equal(qty.change(unit,350,-1),250);assert.equal(qty.normalise(unit,350.125),350.125);}
});
test('pieces and all agreed count units move by one without decimal fractions',()=>{
 for(const unit of ['шт','банка','пучок','зуб.','пак.']){assert.equal(qty.step(unit),1);assert.equal(qty.change(unit,2,1),3);assert.equal(qty.change(unit,2,-1),1);assert.ok(Number.isInteger(qty.change(unit,2.5,1)));assert.equal(qty.normalise(unit,2.1),2);}
});
test('all controls respect zero and the inventory quantity limit',()=>{
 for(const unit of ['g','ml','шт','банка','пучок','зуб.','пак.']){assert.equal(qty.change(unit,0,-1),0);assert.equal(qty.change(unit,1e9,1),1e9);assert.equal(qty.normalise(unit,'not a number'),0);}
});
