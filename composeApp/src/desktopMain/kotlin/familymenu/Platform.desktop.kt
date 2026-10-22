package familymenu

import androidx.compose.runtime.*
import androidx.compose.ui.graphics.toComposeImageBitmap
import java.io.File
import java.awt.Toolkit
import java.util.Base64
import javax.swing.JFileChooser

private fun stateFile() = File(System.getProperty("familymenu.state") ?: "${System.getProperty("user.home")}/.familymenu/state.json")
actual fun loadState(): String? = stateFile().takeIf {it.exists()}?.readText()
actual fun saveState(value: String) {stateFile().apply {parentFile?.mkdirs();writeText(value)}}
actual fun notifyTimer() {Toolkit.getDefaultToolkit().beep()}
@Composable actual fun rememberPhotoPicker(onResult: (PhotoResult)->Unit): PhotoPicker {
    val callback by rememberUpdatedState(onResult)
    return remember {PhotoPicker {
        val chooser=JFileChooser().apply {isMultiSelectionEnabled=true}
        if(chooser.showOpenDialog(null)==JFileChooser.APPROVE_OPTION) {
            val files=chooser.selectedFiles.toList()
            callback(runCatching {
                require(files.size in 1..5) {"Выберите от 1 до 5 фото."}
                PhotoResult.Batch(files.map { file ->
                    val mime=when(file.extension.lowercase()) {"png" -> "image/png";"webp" -> "image/webp";else -> "image/jpeg"}
                    require(file.length()<=4*1024*1024) {"Фото должно быть не больше 4 МБ."}
                    PhotoResult.Success(Base64.getEncoder().encodeToString(file.readBytes()),mime)
                })
            }.getOrElse {PhotoResult.Error(it.message ?: "Не удалось прочитать фото.")})
        } else callback(PhotoResult.Cancelled)
    }}
}

@OptIn(kotlin.io.encoding.ExperimentalEncodingApi::class)
actual fun decodePhotoPreview(base64: String): androidx.compose.ui.graphics.ImageBitmap =
    org.jetbrains.skia.Image.makeFromEncoded(kotlin.io.encoding.Base64.decode(base64)).toComposeImageBitmap()

actual val supportsPhotoCamera: Boolean = false
