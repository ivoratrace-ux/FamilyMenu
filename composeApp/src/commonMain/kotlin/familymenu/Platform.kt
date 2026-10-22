package familymenu

import androidx.compose.runtime.Composable

// Photos and recognition drafts stay in memory; confirmed inventory is saved through the backend.
sealed interface PhotoResult {
    data class Success(val base64: String, val mimeType: String) : PhotoResult
    data class Batch(val photos: List<Success>) : PhotoResult
    data class Error(val message: String) : PhotoResult
    data object Cancelled : PhotoResult
}
fun interface PhotoPicker { fun launch(camera: Boolean) }
@Composable expect fun rememberPhotoPicker(onResult: (PhotoResult) -> Unit): PhotoPicker
expect fun loadState(): String?
expect fun saveState(value: String)
expect fun notifyTimer()
const val STATE_KEY = "family-menu-compose-v2"
const val SCAN_API_BASE = "https://vibe-coding-sc04.onrender.com"

expect fun decodePhotoPreview(base64: String): androidx.compose.ui.graphics.ImageBitmap

expect val supportsPhotoCamera: Boolean

expect fun loadAuthSession(): String?
expect fun saveAuthSession(value: String?)
