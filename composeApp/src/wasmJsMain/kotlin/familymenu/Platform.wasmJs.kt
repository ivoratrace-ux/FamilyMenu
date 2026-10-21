@file:OptIn(kotlin.js.ExperimentalWasmJsInterop::class)
package familymenu

import androidx.compose.runtime.*
import kotlin.js.js

private fun readStorage(): String? = js("window.localStorage.getItem('family-menu-compose-v1')")
private fun writeStorage(value: String): Unit = js("window.localStorage.setItem('family-menu-compose-v1', value)")
actual fun loadState(): String? = readStorage()
actual fun saveState(value: String) = writeStorage(value)
private fun beep(): Unit = js("""(() => { try { const a = new AudioContext(); const o = a.createOscillator(); const g = a.createGain(); o.connect(g);g.connect(a.destination);o.frequency.value=880;g.gain.value=.15;o.start();o.stop(a.currentTime+.5);o.onended=()=>a.close(); navigator.vibrate?.([300,150,300]); } catch(e) {} })()""")
actual fun notifyTimer() = beep()

@Composable actual fun rememberPhotoPicker(onResult: (PhotoResult)->Unit): PhotoPicker {
    val callback by rememberUpdatedState(onResult)
    return remember {PhotoPicker {camera ->
        selectPhoto(camera) {status,data,mime -> callback(when(status) {
            "success" -> PhotoResult.Success(data,mime)
            "cancel" -> PhotoResult.Cancelled
            else -> PhotoResult.Error(data)
        })}
    }}
}
private fun selectPhoto(camera: Boolean,done: (String,String,String)->Unit): Unit = js("""(() => {
    const input = document.createElement('input'); input.type='file';input.accept='image/*';
    if(camera) input.setAttribute('capture','environment');
    input.style.display='none';document.body.appendChild(input);
    const cleanup=()=>input.remove();
    input.addEventListener('cancel',()=>{cleanup();done('cancel','','');},{once:true});
    input.onchange=async()=>{
      const file=input.files?.[0];cleanup();
      if(!file){done('cancel','','');return;}
      let url;
      try {
        url=URL.createObjectURL(file);
        const image=new Image();image.src=url;await image.decode();
        const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
        const base64=canvas.toDataURL('image/jpeg',.85).split(',')[1];
        if(base64.length>5592408){done('error','Фото должно быть не больше 4 МБ.','');return;}
        done('success',base64,'image/jpeg');
      } catch(e) {done('error','Не удалось прочитать фото. Выберите другое изображение.','');}
      finally {if(url) URL.revokeObjectURL(url);}
    };
    input.click();
})()""")
