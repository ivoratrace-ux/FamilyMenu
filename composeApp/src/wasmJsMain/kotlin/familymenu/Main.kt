@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class, kotlin.js.ExperimentalWasmJsInterop::class)
package familymenu
import androidx.compose.ui.window.ComposeViewport
fun main() {removeLoading();ComposeViewport("app") {FamilyMenuApp()}}
private fun removeLoading(): Unit = kotlin.js.js("document.getElementById('loading')?.remove()")
