/* Shared units and bounds for the home inventory input and its overlay arrows. */
(() => {
  const weight=unit=>unit==='g'||unit==='ml';
  const step=unit=>weight(unit)?100:1;
  function normalise(unit,value){
    const number=Number(value),precision=weight(unit)?1000:1;
    return Number.isFinite(number)?Math.min(1e9,Math.max(0,Math.round(number*precision)/precision)):0;
  }
  const change=(unit,value,direction)=>normalise(unit,normalise(unit,value)+step(unit)*direction);
  window.FamilyMenuPantryQty={step,normalise,change};
})();
