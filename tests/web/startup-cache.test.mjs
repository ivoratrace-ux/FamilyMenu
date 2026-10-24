import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../src/cache.js',import.meta.url),'utf8');
function storage(){const s={};Object.defineProperties(s,{getItem:{value:k=>s[k]??null},setItem:{value:(k,v)=>s[k]=v},removeItem:{value:k=>delete s[k]}});return s;}
function setup(){const localStorage=storage(),sessionStorage=storage(),window={};vm.runInNewContext(source,{window,localStorage,sessionStorage});return {cache:window.FamilyMenuCache,localStorage,sessionStorage};}
const bundle=userId=>({userId,document:{revision:1,menu:null},inventory:{revision:0,items:[]},catalog:{recipes:[],ingredients:[],foods:[],promos:[]}});
test('cached menu is returned only to its owner, and malformed cache is ignored',()=>{
 const {cache,localStorage}=setup();cache.write(bundle('a'));assert.equal(cache.read('a').userId,'a');assert.equal(cache.read('b'),null);
 localStorage.setItem('frigo-startup-v2','{"userId":"a"}');assert.equal(cache.read('a'),null);
 localStorage.setItem('frigo-startup-v2','broken');assert.equal(cache.read('a'),null);
});
test('logout removes app, analytics and session caches; late responses cannot repopulate them',()=>{
 const {cache,localStorage,sessionStorage}=setup();cache.write(bundle('a'));const before=cache.epoch;
 for(const k of ['family-menu-auth-v1','family-menu-web-draft-v1','frigo-catalog-v1','ph_test'])localStorage.setItem(k,'private');
 sessionStorage.setItem('frigo-session','private');localStorage.setItem('another-site','retained');
 cache.clear();assert.equal(cache.read('a'),null);assert.deepEqual(Object.keys(localStorage),['another-site']);assert.deepEqual(Object.keys(sessionStorage),[]);
 cache.write(bundle('a'),before);assert.equal(cache.read('a'),null);
 cache.write(bundle('b'));assert.equal(cache.read('b').userId,'b');
});
