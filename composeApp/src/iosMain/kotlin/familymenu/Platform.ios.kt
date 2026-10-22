@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)
package familymenu

import androidx.compose.runtime.*
import androidx.compose.ui.graphics.toComposeImageBitmap
import kotlinx.cinterop.*
import platform.CoreFoundation.*
import platform.Security.*
import platform.Foundation.*
import platform.UIKit.*
import platform.PhotosUI.*
import platform.CoreGraphics.CGSizeMake
import platform.CoreGraphics.CGRectMake
import platform.AudioToolbox.AudioServicesPlaySystemSound
import platform.darwin.NSObject

actual fun loadState(): String? = NSUserDefaults.standardUserDefaults.stringForKey(STATE_KEY)
actual fun saveState(value: String) {NSUserDefaults.standardUserDefaults.setObject(value,STATE_KEY)}
actual fun notifyTimer() {AudioServicesPlaySystemSound(1005u)}

// UIImagePickerController's delegate is weak; keep a strong reference until dismissal,
// including when the user switches away from the scanner while the picker is open.
private var activeDelegate: NSObject? = null

@Composable actual fun rememberPhotoPicker(onResult:(PhotoResult)->Unit): PhotoPicker {
    val callback by rememberUpdatedState(onResult)
    return remember {PhotoPicker {camera ->
        var presenter=UIApplication.sharedApplication.keyWindow?.rootViewController
        while(presenter?.presentedViewController!=null) presenter=presenter.presentedViewController
        if(presenter==null) callback(PhotoResult.Error("Не удалось открыть выбор фото."))
        else if(camera) {
            if(!UIImagePickerController.isSourceTypeAvailable(UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypeCamera)) {
                callback(PhotoResult.Error("Камера недоступна. Выберите готовое фото."))
            } else {
                val picker=UIImagePickerController()
                val delegate=PhotoDelegate(callback)
                activeDelegate=delegate;picker.delegate=delegate
                picker.sourceType=UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypeCamera
                picker.modalPresentationStyle=UIModalPresentationFullScreen
                presenter.presentViewController(picker,true,null)
            }
        } else {
            val configuration=PHPickerConfiguration().apply {
                selectionLimit=5
                filter=PHPickerFilter.imagesFilter
            }
            val picker=PHPickerViewController(configuration)
            val delegate=GalleryDelegate(callback)
            activeDelegate=delegate;picker.delegate=delegate
            presenter.presentViewController(picker,true,null)
        }
    }}
}
private class PhotoDelegate(val result:(PhotoResult)->Unit): NSObject(),UIImagePickerControllerDelegateProtocol,UINavigationControllerDelegateProtocol {
    override fun imagePickerControllerDidCancel(picker: UIImagePickerController) {
        picker.dismissViewControllerAnimated(true) {result(PhotoResult.Cancelled);activeDelegate=null}
    }
    override fun imagePickerController(picker: UIImagePickerController,didFinishPickingMediaWithInfo: Map<Any?,*>) {
        val image=didFinishPickingMediaWithInfo[UIImagePickerControllerOriginalImage] as? UIImage
        val photo=runCatching {encodeImage(image)}.getOrElse {PhotoResult.Error(it.message ?: "Не удалось прочитать фото.")}
        picker.dismissViewControllerAnimated(true) {result(photo);activeDelegate=null}
    }
}

@OptIn(kotlin.io.encoding.ExperimentalEncodingApi::class)
actual fun decodePhotoPreview(base64: String): androidx.compose.ui.graphics.ImageBitmap =
    org.jetbrains.skia.Image.makeFromEncoded(kotlin.io.encoding.Base64.decode(base64)).toComposeImageBitmap()

private class GalleryDelegate(val result:(PhotoResult)->Unit): NSObject(),PHPickerViewControllerDelegateProtocol {
    override fun picker(picker: PHPickerViewController, didFinishPicking: List<*>) {
        val selected=didFinishPicking.filterIsInstance<PHPickerResult>()
        picker.dismissViewControllerAnimated(true,null)
        if(selected.isEmpty()) {result(PhotoResult.Cancelled);activeDelegate=null;return}
        if(selected.size>5) {result(PhotoResult.Error("Можно выбрать не больше 5 фото."));activeDelegate=null;return}
        val photos=MutableList<PhotoResult.Success?>(selected.size) {null}
        var remaining=selected.size
        var failed=false
        selected.forEachIndexed {index,item ->
            item.itemProvider.loadDataRepresentationForTypeIdentifier("public.image") {data,error ->
                NSOperationQueue.mainQueue.addOperationWithBlock {
                    val photo=runCatching {
                        require(error==null && data!=null) {"Не удалось прочитать фото."}
                        encodeImage(UIImage.imageWithData(data))
                    }
                    photos[index]=photo.getOrNull()
                    if(photo.isFailure) failed=true
                    remaining--
                    if(remaining==0) {
                        result(if(failed) PhotoResult.Error("Не удалось прочитать фото. Выберите изображения до 4 МБ.") else PhotoResult.Batch(photos.filterNotNull()))
                        activeDelegate=null
                    }
                }
            }
        }
    }
}
private fun encodeImage(image: UIImage?): PhotoResult.Success {
            requireNotNull(image) {"Не удалось прочитать фото."}
            val width=image.size.useContents {width};val height=image.size.useContents {height}
            require(width>0 && height>0)
            val scale=minOf(1.0,1600.0/maxOf(width,height))
            UIGraphicsBeginImageContextWithOptions(CGSizeMake(width*scale,height*scale),true,1.0)
            val resized=try {image.drawInRect(CGRectMake(0.0,0.0,width*scale,height*scale));UIGraphicsGetImageFromCurrentImageContext()} finally {UIGraphicsEndImageContext()}
            val data=UIImageJPEGRepresentation(resized ?: image,.85) ?: error("Не удалось обработать фото.")
            require(data.length<=4uL*1024uL*1024uL) {"Фото должно быть не больше 4 МБ."}
            return PhotoResult.Success(data.base64EncodedStringWithOptions(0u),"image/jpeg")
}

actual val supportsPhotoCamera: Boolean = true

private inline fun <T> authKeychain(block:(CFMutableDictionaryRef?)->T): T {
    val query=CFDictionaryCreateMutable(null,0,null,null)
    val service=CFStringCreateWithCString(null,"FamilyMenu.Auth",kCFStringEncodingUTF8)
    val account=CFStringCreateWithCString(null,"session",kCFStringEncodingUTF8)
    try {
        CFDictionaryAddValue(query,kSecClass,kSecClassGenericPassword)
        CFDictionaryAddValue(query,kSecAttrService,service)
        CFDictionaryAddValue(query,kSecAttrAccount,account)
        return block(query)
    } finally {CFRelease(query);CFRelease(service);CFRelease(account)}
}
actual fun loadAuthSession(): String? = authKeychain {query ->
    CFDictionaryAddValue(query,kSecReturnData,kCFBooleanTrue)
    CFDictionaryAddValue(query,kSecMatchLimit,kSecMatchLimitOne)
    memScoped {
        val result=alloc<CFTypeRefVar>()
        if(SecItemCopyMatching(query,result.ptr)!=errSecSuccess) null
        else {
            val data: CFDataRef?=result.value?.reinterpret()
            try {CFDataGetBytePtr(data)?.readBytes(CFDataGetLength(data).toInt())?.decodeToString()} finally {CFRelease(data)}
        }
    }
}
actual fun saveAuthSession(value: String?) {authKeychain {query ->
    SecItemDelete(query)
    if(value!=null) {
        val bytes=value.encodeToByteArray()
        val data=bytes.usePinned {CFDataCreate(null,it.addressOf(0).reinterpret(),bytes.size.toLong())}
        try {
            CFDictionaryAddValue(query,kSecValueData,data)
            CFDictionaryAddValue(query,kSecAttrAccessible,kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
            check(SecItemAdd(query,null)==errSecSuccess)
        } finally {CFRelease(data)}
    }
}}
