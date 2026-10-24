/* Only Frigo-owned storage is removed: GitHub Pages may share its origin with other apps. */
(() => {
 const key='frigo-startup-v2';let epoch=0;
 const valid=b=>b&&typeof b.userId==='string'&&Number.isSafeInteger(b.document?.revision)&&Number.isSafeInteger(b.inventory?.revision)&&Array.isArray(b.inventory?.items)&&Array.isArray(b.catalog?.recipes)&&Array.isArray(b.catalog?.ingredients)&&Array.isArray(b.catalog?.foods)&&Array.isArray(b.catalog?.promos);
 window.FamilyMenuCache={
  get epoch(){return epoch;},
  read(userId){try{const b=JSON.parse(localStorage.getItem(key));return valid(b)&&b.userId===userId?b:null;}catch{return null;}},
  write(bundle,version=epoch){if(version!==epoch||!valid(bundle))return;try{localStorage.setItem(key,JSON.stringify(bundle));}catch{}},
  clear(){epoch++;for(const storage of [localStorage,sessionStorage]){try{for(const k of Object.keys(storage))if(/^(frigo-|family-menu-|ph_)/.test(k))storage.removeItem(k);}catch{}}}
 };
})();
