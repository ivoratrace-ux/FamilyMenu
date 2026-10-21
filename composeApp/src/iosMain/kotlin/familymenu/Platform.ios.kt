@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)
package familymenu

import androidx.compose.runtime.*
import kotlinx.cinterop.useContents
import platform.Foundation.*
import platform.UIKit.*
import platform.CoreGraphics.CGSizeMake
import platform.CoreGraphics.CGRectMake
import platform.AudioToolbox.AudioServicesPlaySystemSound
import platform.darwin.NSObject

actual fun loadState(): String? = NSUserDefaults.standardUserDefaults.stringForKey(STATE_KEY)
actual fun saveState(value: String) {NSUserDefaults.standardUserDefaults.setObject(value,STATE_KEY)}
actual fun notifyTimer() {AudioServicesPlaySystemSound(1005u)}

// UIImagePickerController's delegate is weak; keep a strong reference until dismissal,
// including when the user switches away from the scanner while the picker is open.
private var activeDelegate: PhotoDelegate? = null

@Composable actual fun rememberPhotoPicker(onResult:(PhotoResult)->Unit): PhotoPicker {
    val callback by rememberUpdatedState(onResult)
    return remember {PhotoPicker {camera ->
        val source=if(camera) UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypeCamera else UIImagePickerControllerSourceType.UIImagePickerControllerSourceTypePhotoLibrary
        if(!UIImagePickerController.isSourceTypeAvailable(source)) {
            callback(PhotoResult.Error(if(camera) "Камера недоступна. Выберите готовое фото." else "Выбор фото недоступен."))
        } else {
            var presenter=UIApplication.sharedApplication.keyWindow?.rootViewController
            while(presenter?.presentedViewController!=null) presenter=presenter.presentedViewController
            if(presenter==null) callback(PhotoResult.Error("Не удалось открыть выбор фото."))
            else {
                val picker=UIImagePickerController()
                val delegate=PhotoDelegate(callback)
                activeDelegate=delegate;picker.delegate=delegate;picker.sourceType=source
                // Full screen also works on iPad without a popover anchor.
                picker.modalPresentationStyle=UIModalPresentationFullScreen
                presenter.presentViewController(picker,true,null)
            }
        }
    }}
}
private class PhotoDelegate(val result:(PhotoResult)->Unit): NSObject(),UIImagePickerControllerDelegateProtocol,UINavigationControllerDelegateProtocol {
    override fun imagePickerControllerDidCancel(picker: UIImagePickerController) {
        picker.dismissViewControllerAnimated(true) {result(PhotoResult.Cancelled);activeDelegate=null}
    }
    override fun imagePickerController(picker: UIImagePickerController,didFinishPickingMediaWithInfo: Map<Any?,*>) {
        val image=didFinishPickingMediaWithInfo[UIImagePickerControllerOriginalImage] as? UIImage
        val photo=runCatching {
            requireNotNull(image) {"Не удалось прочитать фото."}
            val width=image.size.useContents {width};val height=image.size.useContents {height}
            require(width>0 && height>0)
            val scale=minOf(1.0,1600.0/maxOf(width,height))
            UIGraphicsBeginImageContextWithOptions(CGSizeMake(width*scale,height*scale),true,1.0)
            val resized=try {image.drawInRect(CGRectMake(0.0,0.0,width*scale,height*scale));UIGraphicsGetImageFromCurrentImageContext()} finally {UIGraphicsEndImageContext()}
            val data=UIImageJPEGRepresentation(resized ?: image,.85) ?: error("Не удалось обработать фото.")
            require(data.length<=4uL*1024uL*1024uL) {"Фото должно быть не больше 4 МБ."}
            PhotoResult.Success(data.base64EncodedStringWithOptions(0u),"image/jpeg")
        }.getOrElse {PhotoResult.Error(it.message ?: "Не удалось прочитать фото.")}
        picker.dismissViewControllerAnimated(true) {result(photo);activeDelegate=null}
    }
}
