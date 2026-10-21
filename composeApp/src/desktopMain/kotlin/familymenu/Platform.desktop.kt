package familymenu

import androidx.compose.runtime.*
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
        val chooser=JFileChooser()
        if(chooser.showOpenDialog(null)==JFileChooser.APPROVE_OPTION) {
            val file=chooser.selectedFile
            val mime=when(file.extension.lowercase()) {"png" -> "image/png";"webp" -> "image/webp";else -> "image/jpeg"}
            if(file.length()>4*1024*1024) callback(PhotoResult.Error("Фото должно быть не больше 4 МБ."))
            else callback(PhotoResult.Success(Base64.getEncoder().encodeToString(file.readBytes()),mime))
        } else callback(PhotoResult.Cancelled)
    }}
}
