package familymenu

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.media.ToneGenerator
import android.media.AudioManager
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.*
import java.io.ByteArrayOutputStream
import java.io.File

internal lateinit var appContext: Context
actual fun loadState(): String? = appContext.getSharedPreferences("family-menu",Context.MODE_PRIVATE).getString(STATE_KEY,null)
actual fun saveState(value: String) {check(appContext.getSharedPreferences("family-menu",Context.MODE_PRIVATE).edit().putString(STATE_KEY,value).commit())}
actual fun notifyTimer() {runCatching {val tone=ToneGenerator(AudioManager.STREAM_NOTIFICATION,80);tone.startTone(ToneGenerator.TONE_PROP_BEEP,500);android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({tone.release()},700)}}

@Composable actual fun rememberPhotoPicker(onResult:(PhotoResult)->Unit): PhotoPicker {
    val context=LocalContext.current;val scope=rememberCoroutineScope();val callback by rememberUpdatedState(onResult)
    var cameraUri by remember {mutableStateOf<Uri?>(null)}
    var captureFile by remember {mutableStateOf<File?>(null)}
    fun process(uris: List<Uri>) {scope.launch {
        val result=withContext(Dispatchers.IO) {runCatching {PhotoResult.Batch(uris.map {encodePhoto(context,it)})}.getOrElse {PhotoResult.Error(it.message ?: "Не удалось прочитать фото.")}}
        callback(result);captureFile?.delete();captureFile=null
    }}
    val camera=rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) {success -> if(success) cameraUri?.let {process(listOf(it))} else {captureFile?.delete();callback(PhotoResult.Cancelled)}}
    val gallery=rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(5)) {uris -> if(uris.isNotEmpty()) process(uris) else callback(PhotoResult.Cancelled)}
    return PhotoPicker {useCamera ->
        runCatching {
            if(useCamera) {
                val dir=File(context.cacheDir,"camera").apply {mkdirs()}
                captureFile=File.createTempFile("fridge-",".jpg",dir)
                cameraUri=FileProvider.getUriForFile(context,"${context.packageName}.files",captureFile!!)
                camera.launch(cameraUri!!)
            } else gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }.onFailure {callback(PhotoResult.Error("Не удалось открыть камеру или выбор фото."))}
    }
}
private fun encodePhoto(context: Context,uri: Uri): PhotoResult.Success {
    val resolver=context.contentResolver
    val bounds=BitmapFactory.Options().apply {inJustDecodeBounds=true}
    resolver.openInputStream(uri).use {BitmapFactory.decodeStream(it,null,bounds)}
    require(bounds.outWidth>0 && bounds.outHeight>0) {"Не удалось прочитать фото."}
    var sample=1;while(maxOf(bounds.outWidth,bounds.outHeight)/sample>1600) sample*=2
    val bitmap=resolver.openInputStream(uri).use {BitmapFactory.decodeStream(it,null,BitmapFactory.Options().apply {inSampleSize=sample})} ?: error("Не удалось прочитать фото.")
    val orientation=resolver.openInputStream(uri).use {if(it==null) ExifInterface.ORIENTATION_NORMAL else ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION,ExifInterface.ORIENTATION_NORMAL)}
    val matrix=Matrix().apply {when(orientation) {
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> setScale(-1f,1f)
        ExifInterface.ORIENTATION_ROTATE_180 -> setRotate(180f)
        ExifInterface.ORIENTATION_FLIP_VERTICAL -> setScale(1f,-1f)
        ExifInterface.ORIENTATION_TRANSPOSE -> {setRotate(90f);postScale(-1f,1f)}
        ExifInterface.ORIENTATION_ROTATE_90 -> setRotate(90f)
        ExifInterface.ORIENTATION_TRANSVERSE -> {setRotate(270f);postScale(-1f,1f)}
        ExifInterface.ORIENTATION_ROTATE_270 -> setRotate(270f)
    }}
    val oriented=Bitmap.createBitmap(bitmap,0,0,bitmap.width,bitmap.height,matrix,true)
    try {
        val bytes=ByteArrayOutputStream().use {oriented.compress(Bitmap.CompressFormat.JPEG,85,it);it.toByteArray()}
        require(bytes.size<=4*1024*1024) {"Фото должно быть не больше 4 МБ."}
        return PhotoResult.Success(Base64.encodeToString(bytes,Base64.NO_WRAP),"image/jpeg")
    } finally {if(oriented!==bitmap) oriented.recycle();bitmap.recycle()}
}

actual fun decodePhotoPreview(base64: String): androidx.compose.ui.graphics.ImageBitmap {
    val bytes=Base64.decode(base64,Base64.DEFAULT)
    return requireNotNull(BitmapFactory.decodeByteArray(bytes,0,bytes.size)).asImageBitmap()
}
