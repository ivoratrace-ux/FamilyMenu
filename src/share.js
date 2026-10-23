/* Shopping-list sharing: native mobile sheet, desktop Telegram, clipboard fallback. */
(() => {
  let busy=false;
  const mobile=()=>navigator.userAgentData?.mobile===true || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || navigator.platform==='MacIntel' && navigator.maxTouchPoints>1;
  async function copy(text,url) {
    const value=text+'\n'+url;
    try {
      if(!navigator.clipboard?.writeText)throw Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(value);
    }catch{
      const previous=document.activeElement,input=document.createElement('textarea');
      input.value=value;input.readOnly=true;input.style.cssText='position:fixed;left:-9999px;top:0';
      document.body.append(input);input.select();let copied=false;
      try{copied=document.execCommand('copy');}catch{}finally{input.remove();previous?.focus?.();}
      if(!copied){toast('Не удалось скопировать список. Разрешите доступ к буферу обмена и попробуйте ещё раз.');return;}
    }
    toast('Список покупок скопирован');track('list_shared_clipboard');
  }
  function telegram(text,url) {
    return new Promise(resolve=>{
      let finished=false,timer;
      const finish=opened=>{if(finished)return;finished=true;clearTimeout(timer);document.removeEventListener('visibilitychange',hidden);resolve(opened);};
      const hidden=()=>{if(document.hidden)finish(true);};
      document.addEventListener('visibilitychange',hidden);
      // No browser API can query installed applications. Visibility/focus are only best-effort signals.
      timer=setTimeout(()=>finish(document.hidden || !document.hasFocus()),1600);
      try{location.assign('tg://msg_url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(text));}
      catch{finish(false);}
    });
  }
  async function share({text,url}) {
    if(busy)return;busy=true;
    try {
      if(mobile() && typeof navigator.share==='function'){
        const data={text,url};
        if(!navigator.canShare || navigator.canShare(data)){
          try{await navigator.share(data);track('list_shared_native');return;}
          catch(error){if(error.name==='AbortError')return;await copy(text,url);return;}
        }
      }
      if(await telegram(text,url)){track('list_shared_telegram');return;}
      await copy(text,url);
    }finally{busy=false;}
  }
  window.FamilyMenuShare={share};
})();
