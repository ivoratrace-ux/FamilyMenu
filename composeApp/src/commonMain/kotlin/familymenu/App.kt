@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package familymenu

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.*
import androidx.compose.ui.window.Dialog
import familymenu.resources.Res
import familymenu.resources.golos
import familymenu.resources.literata
import kotlinx.coroutines.*
import kotlinx.datetime.Clock
import kotlinx.datetime.toLocalDateTime
import io.ktor.http.encodeURLParameter
import org.jetbrains.compose.resources.*
import org.jetbrains.compose.resources.decodeToImageBitmap
import kotlin.math.*

private val Green=Color(0xff2c6a4c)
private val Cream=Color(0xfff4f5f1)
private val Soft=Color(0xffe2eee6)
private val Ink=Color(0xff1b201c)
private val Muted=Color(0xff646c66)
private val Line=Color(0xffdfe3dc)
private val Amber=Color(0xffc98a10)
private val DishFont=staticCompositionLocalOf<FontFamily> { FontFamily.Serif }

@Composable fun FamilyMenuApp() {
    var catalog by remember { mutableStateOf<Catalog?>(null) }
    var failure by remember { mutableStateOf(false) }
    var loadAttempt by remember { mutableStateOf(0) }
    val catalogService=remember { CatalogService() }
    DisposableEffect(catalogService) { onDispose { catalogService.close() } }
    LaunchedEffect(loadAttempt) {
        failure=false
        try { catalog=catalogService.load() }
        catch(e: CancellationException) { throw e }
        catch(e: Exception) { failure=true }
    }
    val uiFont=FontFamily(Font(Res.font.golos))
    val dishFont=FontFamily(Font(Res.font.literata))
    val model=catalog?.let { remember(it) { AppModel(it) } }
    val dark=when(model?.state?.theme) {"dark" -> true; "light" -> false; else -> isSystemInDarkTheme()}
    val colors=if(dark) darkColorScheme(primary=Color(0xff78c09a),background=Color(0xff121513),surface=Color(0xff1b1f1c),onSurface=Color(0xffe8ece8),secondaryContainer=Color(0xff1e3328))
        else lightColorScheme(primary=Green,background=Cream,surface=Color.White,onSurface=Ink,secondaryContainer=Soft,outline=Line)
    MaterialTheme(colorScheme=colors,typography=Typography().let { t -> t.copy(
        bodyLarge=t.bodyLarge.copy(fontFamily=uiFont,fontSize=15.sp), bodyMedium=t.bodyMedium.copy(fontFamily=uiFont),bodySmall=t.bodySmall.copy(fontFamily=uiFont),
        titleLarge=t.titleLarge.copy(fontFamily=uiFont,fontWeight=FontWeight.Bold),titleMedium=t.titleMedium.copy(fontFamily=uiFont,fontWeight=FontWeight.SemiBold),
        headlineSmall=t.headlineSmall.copy(fontFamily=uiFont,fontWeight=FontWeight.Bold),labelLarge=t.labelLarge.copy(fontFamily=uiFont),labelMedium=t.labelMedium.copy(fontFamily=uiFont),labelSmall=t.labelSmall.copy(fontFamily=uiFont)) }) {
        CompositionLocalProvider(DishFont provides dishFont) {
            Surface(Modifier.fillMaxSize(),color=MaterialTheme.colorScheme.background) {
                Box(Modifier.fillMaxSize(),contentAlignment=Alignment.TopCenter) {
                    if(model==null) Column(Modifier.padding(32.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
                        Text(if(failure) "Не удалось загрузить каталог. Проверьте подключение к интернету." else "Загружаем семейное меню…")
                        if(!failure) CircularProgressIndicator()
                        else Button(onClick={loadAttempt++}) { Text("Повторить") }
                    } else AppContent(model)
                }
            }
        }
    }
}

@Composable private fun AppContent(m: AppModel) {
    val scope=rememberCoroutineScope()
    val scannerService=remember {ScannerService()}
    DisposableEffect(scannerService) {onDispose {scannerService.close()}}
    var drawer by remember { mutableStateOf(false) }
    var reminder by remember { mutableStateOf(false) }
    var now by remember { mutableStateOf(Clock.System.now().toEpochMilliseconds()) }
    LaunchedEffect(m) {
        while(isActive) {
            now=Clock.System.now().toEpochMilliseconds()
            m.timers.toMap().forEach { (key,t) -> if(!t.done && t.paused==null && t.remaining(now)==0) { m.timers[key]=t.copy(done=true); notifyTimer() } }
            val local=Clock.System.now().toLocalTimeString()
            if(m.state.stage=="app" && m.state.profile.reminder && local==m.state.profile.reminderTime && m.state.reminderShown!=today().toString()) {
                reminder=true;m.update(m.state.copy(reminderShown=today().toString()))
            }
            delay(500)
        }
    }
    Column(Modifier.widthIn(max=480.dp).fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
        if(m.state.stage!="app") {
            Welcome(m)
        } else {
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=10.dp),verticalAlignment=Alignment.CenterVertically) {
                TextButton(onClick={drawer=true}) { AppIcon("drawer",MaterialTheme.colorScheme.primary) }
                Text(when(m.page) {"profile" -> "Семья и настройки"; "promo" -> "Акции и цены"; else -> when(m.tab) {"today" -> "Сегодня"; "menu" -> "Меню на неделю"; "shop" -> "Покупки"; else -> "Мой холодильник"}},Modifier.weight(1f),style=MaterialTheme.typography.titleMedium)
                FilledTonalButton(onClick={m.page="profile"},contentPadding=PaddingValues(10.dp)) { Text(m.state.profile.members.firstOrNull()?.name?.take(1) ?: "Я") }
            }
            HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
            m.persistenceError?.let { Text(it,Modifier.padding(12.dp),color=MaterialTheme.colorScheme.error,style=MaterialTheme.typography.bodySmall) }
            val running=m.timers.filterValues { it.paused==null || it.done }
            if(running.isNotEmpty()) FlowRow(Modifier.padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                running.forEach { (key,t) -> TextButton(onClick={m.timers.remove(key)}) { Text(if(t.done) "Таймер готов ×" else "Таймер ${timeText(t.remaining(now))}") } }
            }
            Box(Modifier.weight(1f)) {
                // The upload uses the app scope and survives navigation between tabs.
                if(m.tab=="home" && m.page==null) InventoryScreen(m,scope,scannerService) else when(m.page) {
                    "profile" -> ProfileScreen(m)
                    "promo" -> PromoScreen(m)
                    else -> when(m.tab) {"menu" -> MenuScreen(m); "shop" -> ShoppingScreen(m); else -> TodayScreen(m)}
                }
            }
            HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
            Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(vertical=4.dp)) {
                listOf("today" to "Сегодня","menu" to "Меню","shop" to "Покупки","home" to "Дома").forEach { (key,label) ->
                    val selected=m.tab==key && m.page==null
                    Column(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).clickable { m.tab=key;m.page=null }.padding(vertical=8.dp),horizontalAlignment=Alignment.CenterHorizontally) {
                        AppIcon(key,if(selected) MaterialTheme.colorScheme.primary else Muted)
                        Text(label,color=if(selected) MaterialTheme.colorScheme.primary else Muted,style=MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
    if(drawer) AlertDialog(onDismissRequest={drawer=false},title={Text("Семейное меню")},text={Column {
        listOf("Семья и настройки" to "profile","Акции и цены" to "promo").forEach { (label,page) -> TextButton(onClick={m.page=page;drawer=false}) { Text(label) } }
        TextButton(onClick={m.tab="home";m.page=null;drawer=false}) { Text("Сканировать холодильник") }
        TextButton(onClick={m.update(m.state.copy(stage="auth"));drawer=false}) { Text("Выйти из демо") }
        Note("Прототип · ${m.catalog.recipes.size} рецепта")
    }},confirmButton={TextButton(onClick={drawer=false}) { Text("Закрыть") }})
    if(reminder) AlertDialog(onDismissRequest={reminder=false},title={Text("Проверьте продукты на завтра")},text={Text("Откройте список покупок и подготовьте продукты для следующего дня.")},confirmButton={TextButton(onClick={reminder=false;m.tab="shop";m.page=null}) { Text("Покупки") }},dismissButton={TextButton(onClick={reminder=false}) { Text("Позже") }})
    m.selectedSlot?.let { RecipeDialog(m,it,now) }
    m.replacement?.let { ReplacementDialog(m,it) }
}

private fun kotlinx.datetime.Instant.toLocalTimeString(): String {
    val local=this.toLocalDateTime(kotlinx.datetime.TimeZone.currentSystemDefault())
    return "${local.hour.toString().padStart(2,'0')}:${local.minute.toString().padStart(2,'0')}"
}

@Composable private fun AppIcon(type: String,color: Color) {
    Canvas(Modifier.size(25.dp)) {
        val s=size.width/24;val stroke=Stroke(1.8f*s)
        fun line(x:Float,y:Float,x2:Float,y2:Float)=drawLine(color,androidx.compose.ui.geometry.Offset(x*s,y*s),androidx.compose.ui.geometry.Offset(x2*s,y2*s),1.8f*s)
        when(type) {
            "drawer" -> {line(4f,7f,20f,7f);line(4f,12f,20f,12f);line(4f,17f,20f,17f)}
            "replace" -> {drawArc(color,40f,290f,false,androidx.compose.ui.geometry.Offset(4*s,4*s),androidx.compose.ui.geometry.Size(16*s,16*s),style=stroke);line(18f,3f,20f,8f);line(20f,8f,15f,8f)}
            "link" -> {line(5f,19f,19f,5f);line(10f,5f,19f,5f);line(19f,5f,19f,14f)}
            "today" -> {drawCircle(color,8*s,androidx.compose.ui.geometry.Offset(12*s,13*s),style=stroke);line(12f,9f,12f,13f);line(12f,13f,15f,15f);line(9f,2f,15f,2f)}
            "menu" -> {drawRoundRect(color,androidx.compose.ui.geometry.Offset(4*s,5*s),androidx.compose.ui.geometry.Size(16*s,16*s),androidx.compose.ui.geometry.CornerRadius(2*s),style=stroke);line(4f,10f,20f,10f);line(9f,3f,9f,7f);line(15f,3f,15f,7f);line(8f,14f,15f,14f);line(8f,17f,13f,17f)}
            "shop" -> {val path=Path().apply {moveTo(5*s,8*s);lineTo(19*s,8*s);lineTo(17*s,21*s);lineTo(7*s,21*s);close()};drawPath(path,color,style=stroke);drawArc(color,180f,180f,false,androidx.compose.ui.geometry.Offset(9*s,3*s),androidx.compose.ui.geometry.Size(6*s,10*s),style=stroke)}
            else -> {drawRoundRect(color,androidx.compose.ui.geometry.Offset(6*s,2*s),androidx.compose.ui.geometry.Size(12*s,20*s),androidx.compose.ui.geometry.CornerRadius(2*s),style=stroke);line(6f,10f,18f,10f);line(9f,5f,9f,7f);line(9f,13f,9f,16f)}
        }
    }
}

@Composable internal fun Page(content: @Composable ColumnScope.()->Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp),content=content)
}
@Composable internal fun Panel(modifier: Modifier=Modifier,content: @Composable ColumnScope.()->Unit) {
    Surface(modifier.fillMaxWidth(),shape=RoundedCornerShape(14.dp),border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant),color=MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp),content=content)
    }
}
@Composable internal fun Heading(kicker: String,title: String) { Column(verticalArrangement=Arrangement.spacedBy(4.dp)) { Text(kicker.uppercase(),style=MaterialTheme.typography.labelMedium,color=Muted);Text(title,style=MaterialTheme.typography.headlineSmall) } }
@Composable internal fun Note(text: String) { Text(text,style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant) }
@Composable internal fun Primary(text: String,enabled: Boolean=true,onClick:()->Unit) { Button(onClick=onClick,enabled=enabled,modifier=Modifier.fillMaxWidth().heightIn(min=46.dp),shape=RoundedCornerShape(12.dp)) { Text(text) } }
@Composable internal fun Choice(label: String,selected: Boolean,onClick:()->Unit) { FilterChip(selected=selected,onClick=onClick,label={Text(label)},shape=RoundedCornerShape(24.dp)) }
@Composable internal fun Picture(url: String?,modifier: Modifier=Modifier) {
    var bitmap by remember(url) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(url) {
        if(url!=null) try { bitmap=loadCatalogImage(url).decodeToImageBitmap() }
        catch(e: CancellationException) { throw e }
        catch(e: Exception) { bitmap=null }
    }
    Box(modifier.clip(RoundedCornerShape(12.dp)).background(Soft),contentAlignment=Alignment.Center) {
        bitmap?.let { Image(it,contentDescription=null,modifier=Modifier.fillMaxSize(),contentScale=ContentScale.Crop) }
    }
}

@Composable private fun TodayScreen(m: AppModel) {
    val plan=m.state.plan
    if(plan==null) { Page { Heading("Семейное меню","Что будем готовить?"); Primary("Составить меню на неделю") {m.generate()} };return }
    val index=plan.days.indexOfFirst { it.date==today().toString() }
    if(index<0) { Page { Heading("Сегодня","Неделя закончилась");Note("Составьте новое меню с текущими настройками семьи.");Primary("Составить новую неделю") { m.generate() } };return }
    val day=plan.days[index]
    var memberIndex by remember { mutableStateOf(0) }
    var foodText by remember { mutableStateOf("") };var foodError by remember { mutableStateOf<String?>(null) }
    val member=m.state.profile.members.getOrElse(memberIndex) {m.state.profile.members.first()}
    val key="${day.date}:$memberIndex"
    val extra=m.state.extra[key].orEmpty()
    val eaten=day.slots.mapIndexed { i,s -> if(m.eatKey(index,i) in m.state.eaten) m.catalog.byRecipe[s.recipeId]?.let {m.catalog.nutrition(it)[0]} ?: 0.0 else 0.0 }.sum()*member.portionFactor()+extra.sumOf {it.calories}
    val planned=day.slots.sumOf {s -> m.catalog.byRecipe[s.recipeId]?.let {m.catalog.nutrition(it)[0]} ?: 0.0}*member.portionFactor()
    Page {
        Heading("Сегодня",dateLabel(day.date))
        Panel {
            Text("Калории сегодня",style=MaterialTheme.typography.titleMedium)
            FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {m.state.profile.members.forEachIndexed { i,v -> Choice(v.name,i==memberIndex) {memberIndex=i} }}
            Text("${eaten.roundToInt()} / ${member.calories()} ккал",style=MaterialTheme.typography.headlineSmall)
            LinearProgressIndicator(progress={(eaten/member.calories()).toFloat().coerceIn(0f,1f)},modifier=Modifier.fillMaxWidth())
            Note("В меню ≈${planned.roundToInt()} ккал · порция ×${member.portionFactor()}")
            OutlinedTextField(foodText,{foodText=it;foodError=null},label={Text("Съел ещё: например, 1 банан")},modifier=Modifier.fillMaxWidth(),singleLine=true)
            TextButton(onClick={val kcal=m.catalog.parseFood(foodText);if(kcal==null) foodError="Не узнали продукт. Укажите количество ккал числом." else {m.update(m.state.copy(extra=m.state.extra+(key to (extra+ExtraFood(foodText,kcal)))));foodText=""}}) {Text("Добавить")}
            foodError?.let {Text(it,color=MaterialTheme.colorScheme.error)}
            extra.forEachIndexed { i,f -> Row(verticalAlignment=Alignment.CenterVertically) {Text("${f.label} · ${f.calories} ккал",Modifier.weight(1f));TextButton(onClick={m.update(m.state.copy(extra=m.state.extra+(key to extra.filterIndexed { j,_ -> i!=j })))}) {Text("×")} } }
        }
        day.slots.forEachIndexed { si,slot -> MealCard(m,index,si,slot,true) }
        val shopping=m.engine.shopping(m.state);val left=shopping.filter {it.ingredient.id !in m.state.bought}
        Panel { Text("Покупки к неделе",style=MaterialTheme.typography.titleMedium);Note("Осталось ${left.size} позиций · ≈${money(left.sumOf {it.cost})}");TextButton(onClick={m.tab="shop"}) {Text("Открыть список")} }
        Note("Прототип · меню подбирается из базы ${m.catalog.recipes.size} рецептов по настройкам семьи")
    }
}

@Composable private fun MenuScreen(m: AppModel) {
    val plan=m.state.plan ?: return TodayScreen(m)
    val shopping=m.engine.shopping(m.state);val cost=shopping.sumOf {it.cost}
    Page {
        Heading("Меню на неделю","${dateLabel(plan.days.first().date).substringAfter(", ")} — ${dateLabel(plan.days.last().date).substringAfter(", ")}")
        Text(if(plan.approved) "Утверждено" else "Черновик",color=if(plan.approved) MaterialTheme.colorScheme.primary else Amber)
        Panel {
            Text("Оценка покупок",style=MaterialTheme.typography.titleMedium)
            Text("≈${money(cost)} / ${m.state.profile.budget} ₽")
            LinearProgressIndicator(progress={(cost/m.state.profile.budget).toFloat().coerceIn(0f,1f)},modifier=Modifier.fillMaxWidth(),color=if(cost>m.state.profile.budget) Amber else MaterialTheme.colorScheme.primary)
            Note("Оценка по средним ценам без учёта фасовок и акций. Цены: Москва, 20–21.10.2026.")
        }
        m.swapSource?.let {Panel {Note("Выберите другое блюдо кнопкой «Поменять сюда».");TextButton(onClick={m.swapSource=null}) {Text("Отмена")} }}
        plan.days.forEachIndexed { di,day ->
            Panel {
                Text(dateLabel(day.date),style=MaterialTheme.typography.titleMedium)
                Note("≈${day.slots.sumOf {s -> m.catalog.byRecipe[s.recipeId]?.let {m.catalog.nutrition(it)[0]} ?: 0.0}.roundToInt()} ккал на стандартную порцию")
                day.slots.forEachIndexed { si,s -> MealCard(m,di,si,s,false) }
            }
        }
        if(!plan.approved) Primary("Утвердить меню и собрать список") { m.update(m.state.copy(plan=plan.copy(approved=true)));m.tab="shop" }
        OutlinedButton(onClick={m.generate()},modifier=Modifier.fillMaxWidth()) {Text("Пересобрать всю неделю")}
    }
}

@Composable private fun MealCard(m: AppModel,di: Int,si: Int,slot: Slot,compact: Boolean) {
    val r=m.catalog.byRecipe[slot.recipeId]
    if(r==null) { Note("${mealLabels[slot.meal]}: не нашли подходящее блюдо. Ослабьте ограничения в профиле.");return }
    Column(verticalArrangement=Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth().clickable {m.selectedSlot=m.recipePosition(di,si)},verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            Picture(r.imageUrl,Modifier.size(64.dp))
            Column(Modifier.weight(1f)) {
                Note(mealLabels[slot.meal].orEmpty())
                Text(r.name,fontFamily=DishFont.current,fontWeight=FontWeight.SemiBold)
                Note("${r.minutes} мин · ${m.catalog.nutrition(r)[0].roundToInt()} ккал · ${slot.servings} порц.")
                if(slot.leftover) Note("Остатки со вчера")
                if(slot.cooked) Text("Приготовлено",color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.labelSmall)
            }
            if(!compact) TextButton(onClick={m.replacement=m.recipePosition(di,si)}) {AppIcon("replace",MaterialTheme.colorScheme.primary)}
        }
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            if(compact) {
                TextButton(onClick={m.selectedSlot=m.recipePosition(di,si)}) {Text("Готовить")}
                FilterChip(selected=m.eatKey(di,si) in m.state.eaten,onClick={m.toggleEat(di,si)},label={Text(if(m.eatKey(di,si) in m.state.eaten) "Съели" else "Съели")})
            } else if(!slot.leftover && slot.servings<=m.state.profile.portions()) {
                TextButton(onClick={if(m.swapSource==null) m.swapSource=di to si else m.swap(di to si)}) {Text(if(m.swapSource==null) "Переместить" else "Поменять сюда",style=MaterialTheme.typography.labelSmall)}
            }
        }
    }
}

@Composable private fun ShoppingScreen(m: AppModel) {
    val clipboard=LocalClipboardManager.current;val uri=LocalUriHandler.current
    val items=m.engine.shopping(m.state);val left=items.filter {it.ingredient.id !in m.state.bought}
    Page {
        Heading("Покупки","Список на неделю")
        if(m.state.plan?.approved==false) Panel {Note("Меню ещё не утверждено: список может измениться после замен.");TextButton(onClick={m.update(m.state.copy(plan=m.state.plan?.copy(approved=true)))}) {Text("Утвердить меню")} }
        Panel {
            Text("Осталось купить: ${left.size} · ≈${money(left.sumOf {it.cost})}")
            FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) { listOf("vv" to "ВкусВилл","lavka" to "Яндекс Лавка").forEach { (key,label) -> Choice(label,m.state.store==key) {m.update(m.state.copy(store=key))} } }
            TextButton(onClick={clipboard.setText(AnnotatedString(left.joinToString("\n") {"${it.ingredient.name} — ${quantity(it.ingredient,it.amount)}"}))}) {Text("Копировать список")}
            Note("Продукты из разных блюд объединены. Сканирование пока не изменяет список покупок.")
        }
        items.groupBy {it.ingredient.category}.forEach { (category,products) ->
            Text(category,style=MaterialTheme.typography.titleMedium)
            Panel { products.forEach { product ->
                val i=product.ingredient
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Checkbox(checked=i.id in m.state.bought,onCheckedChange={m.update(m.state.copy(bought=m.state.bought.toggle(i.id)))})
                    Column(Modifier.weight(1f)) {
                        Text(i.name);Note(quantity(i,product.amount))
                        Note("ВВ ${money(product.amount*price(i,"vv",m.state.profile.city))} · Лавка ${money(product.amount*price(i,"lavka",m.state.profile.city))}")
                        Note("Для: ${product.dishes.joinToString()}")
                    }
                    TextButton(onClick={val url=if(m.state.store=="lavka" && i.lavkaPath!=null) "https://lavka.yandex.ru${i.lavkaPath}" else "https://vkusvill.ru/search/?q=${i.name.encodeURLParameter()}";uri.openUri(url)}) {AppIcon("link",MaterialTheme.colorScheme.primary)}
                }
            } }
        }
        val spices=m.state.plan?.days?.flatMap {it.slots}?.flatMap {m.catalog.byRecipe[it.recipeId]?.spices.orEmpty()}?.distinct().orEmpty()
        if(spices.isNotEmpty()) Panel { Text("Специи — проверьте, есть ли дома");Note(spices.joinToString()) }
    }
}

@Composable private fun RecipeDialog(m: AppModel,position: Pair<Int,Int>,now: Long) {
    val (di,si)=position;val slot=m.state.plan?.days?.getOrNull(di)?.slots?.getOrNull(si) ?: return
    val recipe=m.catalog.byRecipe[slot.recipeId] ?: return
    var cooking by remember(recipe.id) {mutableStateOf(false)}
    var step by remember(recipe.id) {mutableStateOf(0)}
    Dialog(onDismissRequest={m.selectedSlot=null}) {
        Surface(Modifier.widthIn(max=480.dp).fillMaxHeight(.94f),shape=RoundedCornerShape(20.dp)) {
            Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment=Alignment.CenterVertically) {Text(if(cooking) "Шаг ${step+1} из ${recipe.steps.size}" else "Рецепт",Modifier.weight(1f),style=MaterialTheme.typography.titleMedium);TextButton(onClick={m.selectedSlot=null}) {Text("Закрыть")} }
                Picture(if(cooking) recipe.stepImageUrls.getOrNull(step) else recipe.imageUrl,Modifier.fillMaxWidth().aspectRatio(400f/260))
                Text(recipe.name,fontFamily=DishFont.current,style=MaterialTheme.typography.headlineSmall)
                val nutrition=m.catalog.nutrition(recipe)
                Note("${recipe.minutes} мин · ${slot.servings} порц. · ${nutrition[0].roundToInt()} ккал на порцию")
                Note("Б ${nutrition[1].roundToInt()} · Ж ${nutrition[2].roundToInt()} · У ${nutrition[3].roundToInt()}")
                if(cooking) {
                    Text(recipe.steps[step],style=MaterialTheme.typography.titleMedium)
                    recipe.stepTips.getOrNull(step)?.let {Note(it)}
                    val seconds=recipe.stepSeconds.getOrElse(step) {0};val key="${recipe.id}:$step";val timer=m.timers[key]
                    if(seconds>0) {
                        Text(timeText(timer?.remaining(now) ?: seconds),style=MaterialTheme.typography.headlineSmall)
                        Row {
                            TextButton(onClick={
                                when {
                                    timer==null || timer.done -> m.startTimer(key,seconds)
                                    timer.paused==null -> m.timers[key]=timer.copy(paused=timer.remaining(now))
                                    else -> m.timers[key]=timer.copy(endAt=now+timer.paused*1000L,paused=null)
                                }
                            }) {Text(if(timer?.done==true) "Ещё раз" else if(timer!=null && timer.paused==null) "Пауза" else "Старт таймера")}
                            TextButton(onClick={m.timers.remove(key)}) {Text("Сброс")}
                            TextButton(onClick={if(timer!=null) m.timers[key]=timer.copy(endAt=timer.endAt+60000,paused=timer.paused?.plus(60),done=false)}) {Text("+1 мин")}
                        }
                    }
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick={step--},enabled=step>0) {Text("Назад")}
                        Button(onClick={if(step<recipe.steps.lastIndex) step++ else {m.changeSlot(di,si) {it.copy(cooked=true)};m.selectedSlot=null}}) {Text(if(step<recipe.steps.lastIndex) "Дальше" else "Приготовлено")}
                    }
                    TextButton(onClick={cooking=false}) {Text("Все ингредиенты и шаги")}
                } else {
                    Text("Ингредиенты",style=MaterialTheme.typography.titleMedium)
                    recipe.ingredients.forEach {q -> val i=m.catalog.byIngredient.getValue(q.id);Text("${i.name} — ${quantity(i,q.quantity*slot.servings/recipe.servings)}")}
                    if(recipe.spices.isNotEmpty()) Note("По вкусу: ${recipe.spices.joinToString()}")
                    val allergens=m.catalog.allergens(recipe).mapNotNull {allergies[it]}
                    if(allergens.isNotEmpty()) Note("Аллергены: ${allergens.joinToString()}")
                    Primary("Готовить по шагам с таймером") {cooking=true}
                    recipe.steps.forEachIndexed {i,text -> Text("${i+1}. $text")}
                    FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                        Choice("Нравится",recipe.id in m.state.liked) {m.update(m.state.copy(liked=m.state.liked.toggle(recipe.id),disliked=m.state.disliked-recipe.id))}
                        Choice("Не нравится",recipe.id in m.state.disliked) {m.update(m.state.copy(disliked=m.state.disliked.toggle(recipe.id),liked=m.state.liked-recipe.id))}
                    }
                    TextButton(onClick={m.update(m.state.copy(blocked=m.state.blocked+recipe.id));m.selectedSlot=null;m.replacement=position}) {Text("Больше не предлагать")}
                    Primary(if(slot.cooked) "Приготовлено" else "Отметить: приготовлено") {m.changeSlot(di,si) {it.copy(cooked=!it.cooked)};m.selectedSlot=null}
                }
            }
        }
    }
}
@Composable private fun ReplacementDialog(m: AppModel,position: Pair<Int,Int>) {
    val slot=m.state.plan?.days?.getOrNull(position.first)?.slots?.getOrNull(position.second) ?: return
    val choices=m.engine.pool(slot.meal,m.state).sortedByDescending {m.engine.score(it,m.state)}
    Dialog(onDismissRequest={m.replacement=null}) {Surface(Modifier.widthIn(max=480.dp).fillMaxHeight(.9f),shape=RoundedCornerShape(18.dp)) {Page {
        Heading("Замена блюда",mealLabels[slot.meal].orEmpty())
        TextButton(onClick={m.replacement=null}) {Text("Отмена")}
        if(choices.isEmpty()) Note("Подходящих блюд нет. Ослабьте ограничения в настройках.")
        choices.forEach {r -> Row(Modifier.fillMaxWidth().clickable {m.replace(position.first,position.second,r)}.padding(vertical=6.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            Picture(r.imageUrl,Modifier.size(60.dp));Column(Modifier.weight(1f)) {Text(r.name,fontFamily=DishFont.current);Note("${r.minutes} мин · ${m.catalog.nutrition(r)[0].roundToInt()} ккал · ≈${money(m.catalog.cost(r,m.state.store,m.state.profile.city))}")}
        } }
    } } }
}
fun timeText(seconds: Int) = "${seconds/60}:${(seconds%60).toString().padStart(2,'0')}"
