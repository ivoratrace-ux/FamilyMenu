package familymenu

import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.*

@Composable internal fun ScannerScreen(m: AppModel,scope: CoroutineScope,service: ScannerService) {
    var sourceDialog by remember {mutableStateOf(false)}
    var picking by remember {mutableStateOf(false)}
    fun add(photos: List<PhotoResult.Success>) {
        if(!m.scanning) try {
            m.scannerPhotos=appendScanPhotos(m.scannerPhotos,photos)
            m.scanMessage="Выбрано фото: ${m.scannerPhotos.size} из 5. Проверьте снимки перед отправкой."
        } catch(e: IllegalArgumentException) {m.scanMessage=e.message ?: "Можно выбрать не больше 5 фото."}
    }
    val picker=rememberPhotoPicker { result ->
        picking=false
        when(result) {
            is PhotoResult.Success -> add(listOf(result))
            is PhotoResult.Batch -> add(result.photos)
            is PhotoResult.Error -> m.scanMessage=result.message
            PhotoResult.Cancelled -> Unit
        }
    }
    Page {
        Heading("Продукты дома","Мой холодильник")
        Text("Фото → продукты",color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.titleMedium)
        Note(m.scanMessage)
        Primary("Добавить фото",!m.scanning && !picking && m.scannerPhotos.size<MAX_SCAN_PHOTOS) {sourceDialog=true}
        if(sourceDialog) Panel {
            Text("Сканировать холодильник",style=MaterialTheme.typography.titleMedium)
            Note("До 5 фото за один анализ. Добавляйте снимки камерой или из галереи.")
            Primary("Камера") {sourceDialog=false;picking=true;picker.launch(true)}
            OutlinedButton(onClick={sourceDialog=false;picking=true;picker.launch(false)},modifier=Modifier.fillMaxWidth()) {Text("Выбрать фото")}
            TextButton(onClick={sourceDialog=false}) {Text("Отмена")}
        }
        if(m.scannerPhotos.isNotEmpty()) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                m.scannerPhotos.forEachIndexed {index,photo ->
                    Column(horizontalAlignment=Alignment.CenterHorizontally) {
                        val bitmap=remember(photo) {runCatching {decodePhotoPreview(photo.base64)}.getOrNull()}
                        if(bitmap!=null) Image(bitmap,"Фото ${index+1}",Modifier.size(96.dp),contentScale=ContentScale.Crop)
                        else Text("Фото ${index+1}")
                        TextButton(onClick={m.scannerPhotos=m.scannerPhotos.filterIndexed {i,_ -> i!=index}},enabled=!m.scanning && !picking) {Text("Удалить фото ${index+1}")}
                    }
                }
            }
            Primary(if(m.scanning) "Анализируем фото…" else "Распознать (${m.scannerPhotos.size})",!m.scanning && !picking) {
                val photos=m.scannerPhotos.toList()
                m.scanning=true
                m.scanMessage="Анализируем все фото вместе… Первый запрос может занять до двух минут."
                scope.launch {
                    try {
                        m.scannerProducts=service.scan(photos)
                        m.scanMessage=if(m.scannerProducts.isEmpty()) "Продукты не найдены. Попробуйте более чёткие фото." else "Количество приблизительное. Проверьте продукты и выберите неоднозначные варианты."
                        m.scannerPhotos=emptyList()
                    } catch(e: CancellationException) {throw e}
                    catch(e: Exception) {m.scanMessage=if(e is IllegalStateException || e is IllegalArgumentException) e.message ?: "Не удалось прочитать ответ сервера." else "Не удалось проанализировать фото. Проверьте интернет и повторите попытку."}
                    finally {m.scanning=false}
                }
            }
        }
        Note("Фото отправляются на сервер для анализа. Результаты временные: они не добавляются в запасы, покупки или Supabase и исчезнут после закрытия приложения.")
        if(m.scanning) LinearProgressIndicator(Modifier.fillMaxWidth())
        val groups=listOf(
            "Уточните продукт" to m.scannerProducts.withIndex().filter {it.value.confidence=="medium" && !it.value.confirmed},
            "Из справочника" to m.scannerProducts.withIndex().filter {(it.value.confidence!="medium" || it.value.confirmed) && it.value.ingredientId!=null},
            "Вне справочника" to m.scannerProducts.withIndex().filter {(it.value.confidence!="medium" || it.value.confirmed) && it.value.ingredientId==null}
        )
        groups.forEach { (title,products) ->
            if(products.isNotEmpty()) Text(title,style=MaterialTheme.typography.titleMedium)
            products.forEach { (index,product) ->
                Panel {
                    Row(verticalAlignment=Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {Text(product.name,style=MaterialTheme.typography.titleMedium);Note(product.amount)}
                        TextButton(onClick={m.scannerProducts=m.scannerProducts.filterIndexed {i,_ -> i!=index}},enabled=!m.scanning) {Text("Удалить")}
                    }
                    if(product.confidence=="medium" && !product.confirmed) {
                        Note("Выберите подходящий вариант или удалите продукт:")
                        product.alternatives.forEach {alternative ->
                            OutlinedButton(onClick={m.scannerProducts=m.scannerProducts.mapIndexed {i,p -> if(i==index) p.select(alternative) else p}},enabled=!m.scanning,modifier=Modifier.fillMaxWidth()) {Text(alternative.name + if(alternative.ingredientId==null) " · вне справочника" else "")}
                        }
                    } else if(product.confirmed) Note("Подтверждено")
                }
            }
        }
    }
}
