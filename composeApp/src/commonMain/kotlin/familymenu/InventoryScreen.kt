package familymenu

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.*

@Composable internal fun InventoryScreen(m: AppModel,scope: CoroutineScope,scanner: ScannerService) {
    val service=remember {InventoryService()}
    DisposableEffect(service) {onDispose {service.close()}}
    var snapshot by remember {mutableStateOf<InventorySnapshot?>(null)}
    var busy by remember {mutableStateOf(false)}
    var message by remember {mutableStateOf<String?>(null)}
    var mustReload by remember {mutableStateOf(false)}
    var scanning by remember {mutableStateOf(false)}
    var adding by remember {mutableStateOf(false)}
    var editing by remember {mutableStateOf<IngredientMatch?>(null)}
    var amount by remember {mutableStateOf("")}
    fun load() {scope.launch {
        busy=true
        try {snapshot=service.load();mustReload=false;message=null}
        catch(e: CancellationException) {throw e}
        catch(e: Exception) {message="Не удалось загрузить запасы. Повторите попытку."}
        finally {busy=false}
    }}
    fun mutate(action: suspend (InventorySnapshot)->InventorySnapshot) {scope.launch {
        val current=snapshot ?: return@launch
        busy=true
        try {snapshot=action(current);editing=null;message=null}
        catch(e: CancellationException) {throw e}
        catch(e: Exception) {mustReload=e is InventoryConflict;message=e.message ?: "Не удалось сохранить изменения."}
        finally {busy=false}
    }}
    LaunchedEffect(Unit) {load()}
    if(adding) {
        IngredientSearchScreen(service,onDismiss={adding=false}) {ingredient ->
            adding=false;editing=ingredient
            amount=snapshot?.items?.find {it.ingredientId==ingredient.id}?.quantity?.let(::inventoryNumber) ?: ""
        }
        return
    }
    editing?.let {ingredient ->
        Page {
            Heading("Количество в наличии",ingredient.name)
            Note("Укажите количество в ${inventoryUnit(ingredient.unit)}. Для уже добавленного ингредиента значение будет заменено.")
            OutlinedTextField(amount,{amount=it},label={Text("Количество (${inventoryUnit(ingredient.unit)})")},singleLine=true,enabled=!busy,
                keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Decimal),isError=amount.isNotBlank() && inventoryQuantity(amount)==null)
            message?.let {Note(it)}
            if(busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            Primary("Сохранить количество",!busy && !mustReload && inventoryQuantity(amount)!=null) {mutate {service.edit(it.revision,ingredient.id,inventoryQuantity(amount)!!)}}
            TextButton(onClick={editing=null},enabled=!busy) {Text("Отмена")}
            if(mustReload) TextButton(onClick={editing=null;load()},enabled=!busy) {Text("Обновить список")}
        }
        return
    }
    if(scanning && snapshot!=null) {
        ScannerScreen(m,scope,scanner,service,snapshot!!,busy || mustReload,
            onSaved={snapshot=it;scanning=false;m.scannerProducts=emptyList();m.scannerPhotos=emptyList()},
            onConflict={mustReload=true;message=it;scanning=false},onCancel={scanning=false})
    } else Page {
        Heading("Продукты дома","Мои запасы")
        Note(Account.current?.user?.email ?: "Мои ингредиенты")
        if(busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        message?.let {Note(it)}
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick={load()},enabled=!busy,modifier=Modifier.weight(1f)) {Text("Обновить список")}
            OutlinedButton(onClick={
                m.scannerProducts=emptyList();m.scannerPhotos=emptyList();scanning=true
            },enabled=snapshot!=null && !busy && !mustReload,modifier=Modifier.weight(1f)) {Text("Обновить запасы")}
        }
        Primary("Добавить ингредиент",snapshot!=null && !busy && !mustReload) {adding=true}
        val items=snapshot?.items
        if(items!=null && items.isEmpty()) Note("Пока ничего нет. Добавьте ингредиент или обновите запасы по фото.")
        items?.forEach {item -> Panel {
            Text(item.name,style=MaterialTheme.typography.titleMedium)
            Text("${inventoryNumber(item.quantity)} ${inventoryUnit(item.unit)}")
            Row {
                TextButton(onClick={editing=IngredientMatch(item.ingredientId,item.name,item.unit);amount=inventoryNumber(item.quantity)},enabled=!busy && !mustReload) {Text("Изменить ${item.name}")}
                TextButton(onClick={mutate {service.delete(it.revision,item.ingredientId)}},enabled=!busy && !mustReload) {Text("Удалить ${item.name}")}
            }
        }}
    }

}
internal fun inventoryNumber(value: Double)=if(value%1.0==0.0) value.toLong().toString() else value.toString()

@Composable internal fun IngredientSearchScreen(service: InventoryService,onDismiss:()->Unit,onSelected:(IngredientMatch)->Unit) {
    var query by remember {mutableStateOf("")}
    var matches by remember {mutableStateOf<List<IngredientMatch>>(emptyList())}
    var busy by remember {mutableStateOf(false)}
    var error by remember {mutableStateOf<String?>(null)}
    var retry by remember {mutableStateOf(0)}
    LaunchedEffect(query,retry) {
        matches=emptyList();error=null;busy=false
        if(query.trim().length in 3..80) {
            busy=true
            try {delay(300);matches=service.search(query)}
            catch(e: CancellationException) {throw e}
            catch(e: Exception) {error="Поиск недоступен. Повторите попытку."}
            finally {busy=false}
        }
    }
    Page {
        Heading("Справочник продуктов","Найти ингредиент")
        OutlinedTextField(query,{query=it.take(80)},label={Text("Поиск ингредиента")},singleLine=true,modifier=Modifier.fillMaxWidth())
        if(query.trim().length<3) Note("Введите минимум 3 символа.")
        if(busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        error?.let {Note(it);TextButton(onClick={retry++}) {Text("Повторить поиск")}}
        if(!busy && error==null && query.trim().length>=3 && matches.isEmpty()) Note("Ничего не найдено.")
        matches.forEach {ingredient -> OutlinedButton(onClick={onSelected(ingredient)},modifier=Modifier.fillMaxWidth()) {Text("${ingredient.name} · ${inventoryUnit(ingredient.unit)}")}}
        TextButton(onClick=onDismiss) {Text("Отмена")}
    }
}
