package familymenu

import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.*

@Composable internal fun ScannerScreen(m: AppModel,scope: CoroutineScope,service: ScannerService,
    inventory: InventoryService,snapshot: InventorySnapshot,blocked: Boolean,
    onSaved:(InventorySnapshot)->Unit,onConflict:(String)->Unit,onCancel:()->Unit) {
    var amounts by remember {mutableStateOf<List<String>>(emptyList())}
    var scanned by remember {mutableStateOf(false)}
    var saving by remember {mutableStateOf(false)}
    var confirmSave by remember {mutableStateOf(false)}
    var mapping by remember {mutableStateOf<Int?>(null)}
    val knownIngredients=remember {mutableStateMapOf<String,IngredientMatch>().apply {m.catalog.ingredients.forEach {put(it.id,IngredientMatch(it.id,it.name,it.unit))}}}
    val locked=m.scanning || saving || confirmSave

    var sourceDialog by remember {mutableStateOf(false)}
    var picking by remember {mutableStateOf(false)}
    fun add(photos: List<PhotoResult.Success>) {
        if(!locked) try {
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
    mapping?.let {index ->
        IngredientSearchScreen(inventory,onDismiss={mapping=null}) {ingredient ->
        m.scannerProducts=m.scannerProducts.mapIndexed {i,p -> if(i==index) p.copy(ingredientId=ingredient.id,name=ingredient.name,alternatives=emptyList(),confirmed=true) else p}
        amounts=amounts.mapIndexed {i,a -> if(i==index) initialScanQuantity(m.scannerProducts[index].amount,ingredient.unit) else a}
        knownIngredients[ingredient.id]=ingredient
        mapping=null
    }
        return
    }
    Page {
        Heading("Обновление запасов","Мой холодильник")
        if(confirmSave) Panel {
            Text("Заменить все запасы?",style=MaterialTheme.typography.titleMedium)
            Note(if(m.scannerProducts.isEmpty()) "Список пуст. Все текущие запасы будут удалены." else "Проверенный список заменит все прежние запасы. Это действие нельзя отменить.")
            Primary("Заменить запасы",!saving) {
                confirmSave=false;saving=true
                scope.launch {
                    try {onSaved(inventory.replace(snapshot.revision,scanInventoryInputs(m.scannerProducts,amounts)))}
                    catch(e: CancellationException) {throw e}
                    catch(e: InventoryConflict) {onConflict(e.message ?: "Обновите запасы.")}
                    catch(e: Exception) {m.scanMessage=e.message ?: "Не удалось сохранить запасы. Повторите попытку."}
                    finally {saving=false}
                }
            }
            TextButton(onClick={confirmSave=false},enabled=!saving) {Text("Отмена")}
        }
        TextButton(onClick=onCancel,enabled=!locked && !picking) {Text("Вернуться к запасам")}
        Text("Фото → продукты",color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.titleMedium)
        Note(m.scanMessage)
        Primary("Добавить фото",!locked && !picking && m.scannerPhotos.size<MAX_SCAN_PHOTOS) {sourceDialog=true}
        if(sourceDialog) Panel {
            Text("Сканировать холодильник",style=MaterialTheme.typography.titleMedium)
            Note(if(supportsPhotoCamera) "До 5 фото за один анализ. Добавляйте снимки камерой или из галереи." else "Прикрепите до 5 фото за один анализ.")
            if(supportsPhotoCamera) Primary("Камера") {sourceDialog=false;picking=true;picker.launch(true)}
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
                        TextButton(onClick={m.scannerPhotos=m.scannerPhotos.filterIndexed {i,_ -> i!=index}},enabled=!locked && !picking) {Text("Удалить фото ${index+1}")}
                    }
                }
            }
            Primary(if(m.scanning) "Анализируем фото…" else "Распознать (${m.scannerPhotos.size})",!locked && !picking) {
                val photos=m.scannerPhotos.toList()
                m.scanning=true
                m.scanMessage="Анализируем все фото вместе… Первый запрос может занять до двух минут."
                scope.launch {
                    try {
                        m.scannerProducts=service.scan(photos)
                        m.scanMessage=if(m.scannerProducts.isEmpty()) "Продукты не найдены. Попробуйте более чёткие фото." else "Количество приблизительное. Проверьте продукты и выберите неоднозначные варианты."
                        amounts=m.scannerProducts.map {product -> product.ingredientId?.let {knownIngredients[it]}?.let {initialScanQuantity(product.amount,it.unit)} ?: ""}
                        scanned=true
                        m.scannerPhotos=emptyList()
                    } catch(e: CancellationException) {throw e}
                    catch(e: Exception) {m.scanMessage=if(e is IllegalStateException || e is IllegalArgumentException) e.message ?: "Не удалось прочитать ответ сервера." else "Не удалось проанализировать фото. Проверьте интернет и повторите попытку."}
                    finally {m.scanning=false}
                }
            }
        }
        Note("Проверьте продукты и количество. Кнопка «Сохранить» полностью заменит прежние запасы. До сохранения данные в базе не меняются.")
        if(locked) LinearProgressIndicator(Modifier.fillMaxWidth())
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
                        TextButton(onClick={m.scannerProducts=m.scannerProducts.filterIndexed {i,_ -> i!=index};amounts=amounts.filterIndexed {i,_ -> i!=index}},enabled=!locked) {Text("Удалить")}
                    }
                    if(product.confidence=="medium" && !product.confirmed) {
                        Note("Выберите подходящий вариант или удалите продукт:")
                        product.alternatives.forEach {alternative ->
                            OutlinedButton(onClick={m.scannerProducts=m.scannerProducts.mapIndexed {i,p -> if(i==index) p.select(alternative) else p};amounts=amounts.mapIndexed {i,a -> if(i==index) alternative.ingredientId?.let {knownIngredients[it]}?.let {initialScanQuantity(product.amount,it.unit)} ?: "" else a}},enabled=!locked,modifier=Modifier.fillMaxWidth()) {Text(alternative.name + if(alternative.ingredientId==null) " · вне справочника" else "")}
                        }
                    } else if(product.confirmed) Note("Подтверждено")
                    if((product.ingredientId==null || product.ingredientId !in knownIngredients) && (product.confidence!="medium" || product.confirmed)) {
                        TextButton(onClick={mapping=index},enabled=!locked) {Text("Выбрать из справочника")}
                    }
                    product.ingredientId?.let {id -> knownIngredients[id]?.let {ingredient ->
                        OutlinedTextField(amounts.getOrElse(index){""},{value -> amounts=amounts.mapIndexed {i,a -> if(i==index) value else a}},
                            label={Text("Количество ${ingredient.name} (${inventoryUnit(ingredient.unit)})")},singleLine=true,enabled=!locked,
                            keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal))
                    }}
                }
            }
        }
        if(scanned) {
            val valid=runCatching {scanInventoryInputs(m.scannerProducts,amounts)}.isSuccess
            if(!valid) Note("Выберите ингредиенты из справочника и укажите количество каждого продукта. Ненужные продукты можно удалить.")
            Primary(if(saving) "Сохраняем…" else "Сохранить",valid && !locked && !picking && !blocked) {confirmSave=true}
        }
    }

}
