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
import androidx.compose.ui.text.font.*
import androidx.compose.ui.unit.*
import familymenu.resources.Res
import familymenu.resources.golos
import familymenu.resources.literata
import kotlinx.coroutines.*
import kotlinx.datetime.Clock
import kotlinx.datetime.toLocalDateTime
import org.jetbrains.compose.resources.*
import org.jetbrains.compose.resources.decodeToImageBitmap

internal val Green=Color(0xff2c6a4c)
internal val Cream=Color(0xfff4f5f1)
internal val Soft=Color(0xffe2eee6)
internal val Ink=Color(0xff1b201c)
internal val Muted=Color(0xff646c66)
internal val Line=Color(0xffdfe3dc)
internal val Amber=Color(0xffc98a10)
internal val AmberSoft=Color(0xfffaf0d9)
internal val Danger=Color(0xffb03a2e)
internal val DangerSoft=Color(0xfff8e3df)
internal val DishFont=staticCompositionLocalOf<FontFamily> { FontFamily.Serif }

@Composable fun FamilyMenuApp() {
    Account.initialize()
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
    var splash by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) { delay(1500); splash=false }
    val dark=when(model?.state?.theme) {"dark" -> true; "light" -> false; else -> isSystemInDarkTheme()}
    // Design tokens of prototype v4: same palette, type scale, radii and spacing.
    val colors=if(dark) darkColorScheme(primary=Color(0xff78c09a),onPrimary=Color(0xff0f1a14),background=Color(0xff121513),surface=Color(0xff1b1f1c),onSurface=Color(0xffe8ece8),onBackground=Color(0xffe8ece8),
            onSurfaceVariant=Color(0xffa0a9a2),secondaryContainer=Color(0xff1e3328),onSecondaryContainer=Color(0xff78c09a),outline=Color(0xff2f3631),outlineVariant=Color(0xff2f3631),error=Color(0xffef8a7d),surfaceVariant=Color(0xff121513),
            surfaceContainer=Color(0xff1b1f1c),surfaceContainerHigh=Color(0xff1b1f1c),surfaceContainerHighest=Color(0xff222723),surfaceContainerLow=Color(0xff1b1f1c))
        else lightColorScheme(primary=Green,onPrimary=Color.White,background=Cream,surface=Color.White,onSurface=Ink,onBackground=Ink,onSurfaceVariant=Muted,
            secondaryContainer=Soft,onSecondaryContainer=Green,outline=Line,outlineVariant=Line,error=Danger,surfaceVariant=Cream,
            surfaceContainer=Color.White,surfaceContainerHigh=Color.White,surfaceContainerHighest=Color(0xfff0f2ee),surfaceContainerLow=Color.White)
    val type=Typography().let { t -> t.copy(
        bodyLarge=t.bodyLarge.copy(fontFamily=uiFont,fontSize=15.sp,lineHeight=22.sp),bodyMedium=t.bodyMedium.copy(fontFamily=uiFont,fontSize=14.sp,lineHeight=20.sp),bodySmall=t.bodySmall.copy(fontFamily=uiFont,fontSize=13.sp,lineHeight=18.sp),
        titleLarge=t.titleLarge.copy(fontFamily=uiFont,fontSize=18.sp,fontWeight=FontWeight.SemiBold),titleMedium=t.titleMedium.copy(fontFamily=uiFont,fontSize=15.sp,fontWeight=FontWeight.SemiBold),titleSmall=t.titleSmall.copy(fontFamily=uiFont,fontWeight=FontWeight.SemiBold),
        headlineSmall=t.headlineSmall.copy(fontFamily=uiFont,fontSize=24.sp,fontWeight=FontWeight.Bold,lineHeight=30.sp),headlineMedium=t.headlineMedium.copy(fontFamily=uiFont,fontWeight=FontWeight.Bold),
        labelLarge=t.labelLarge.copy(fontFamily=uiFont,fontSize=15.sp,fontWeight=FontWeight.SemiBold),labelMedium=t.labelMedium.copy(fontFamily=uiFont,fontSize=12.sp,fontWeight=FontWeight.SemiBold),labelSmall=t.labelSmall.copy(fontFamily=uiFont,fontSize=11.sp)) }
    val shapes=Shapes(extraSmall=RoundedCornerShape(10.dp),small=RoundedCornerShape(10.dp),medium=RoundedCornerShape(14.dp),large=RoundedCornerShape(20.dp),extraLarge=RoundedCornerShape(20.dp))
    MaterialTheme(colorScheme=colors,typography=type,shapes=shapes) {
        CompositionLocalProvider(DishFont provides dishFont) {
            Surface(Modifier.fillMaxSize(),color=MaterialTheme.colorScheme.background) {
                Box(Modifier.fillMaxSize(),contentAlignment=Alignment.TopCenter) {
                    if(splash || (model==null && !failure)) SplashScreen()
                    else if(model==null) Column(Modifier.padding(32.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
                        Text(if(failure) "Не удалось загрузить каталог. Проверьте подключение к интернету." else "Загружаем семейное меню…")
                        if(!failure) CircularProgressIndicator()
                        else Button(onClick={loadAttempt++}) { Text("Повторить") }
                    } else AppContent(model)
                }
            }
        }
    }
}

private val tabs=listOf("menu" to "Меню","shop" to "Покупки","home" to "Дома","profile" to "Профиль")
private val pageTitles=mapOf("family" to "Семья","food" to "Питание и ограничения","details" to "Дни и приёмы пищи","recipes" to "Мои рецепты","recipe" to "Рецепт",
    "promo" to "Подборка акций","autocart" to "Автосборка корзины","kcal" to "Калории и КБЖУ","sub" to "Premium","metrics" to "Метрики пилота","familyview" to "Как увидит семья","cookfrom" to "Что приготовить")

@Composable private fun AppContent(m: AppModel) {
    val scope=rememberCoroutineScope()
    val scannerService=remember {ScannerService()}
    DisposableEffect(scannerService) {onDispose {scannerService.close()}}
    val documents=remember {UserDocumentService()}
    DisposableEffect(documents) {onDispose {documents.close()}}
    var accountLoadError by remember {mutableStateOf<String?>(null)}
    var loadRetry by remember {mutableStateOf(0)}
    val accountId=Account.current?.user?.id
    LaunchedEffect(accountId,loadRetry) {
        m.accountReady=false;accountLoadError=null
        if(accountId==null) {
            if(m.state.stage=="app") m.resetAccount()
        } else {
            try {
                m.applyDocument(documents.load());saveState("")
                m.loadInventory(scope);m.flushDraft(scope)
                while(isActive) {
                    delay(600)
                    if(!m.syncConflict && m.changeNumber>m.savedNumber) {
                        val number=m.changeNumber;val state=m.state
                        try {val saved=documents.save(state,m.remoteRevision);m.remoteRevision=saved.revision;m.savedNumber=number;m.persistenceError=null}
                        catch(e: CancellationException) {throw e}
                        catch(e: UserDocumentConflict) {m.syncConflict=true;m.persistenceError=e.message}
                        catch(e: SignInRequired) {throw e}
                        catch(e: Exception) {m.persistenceError="Не удалось сохранить изменения. Они остаются на экране; повторим синхронизацию.";delay(4000)}
                    }
                }
            }catch(e: CancellationException) {throw e}
            catch(e: SignInRequired) {m.resetAccount()}
            catch(e: Exception) {accountLoadError="Не удалось загрузить личные данные. Проверьте интернет."}
        }
    }
    var reminder by remember { mutableStateOf(false) }
    var now by remember { mutableStateOf(Clock.System.now().toEpochMilliseconds()) }
    LaunchedEffect(m) {
        while(isActive) {
            now=Clock.System.now().toEpochMilliseconds()
            m.timers.toMap().forEach { (key,t) -> if(!t.done && t.paused==null && t.remaining(now)==0) { m.timers[key]=t.copy(done=true); notifyTimer() } }
            val local=Clock.System.now().toLocalTimeString()
            if(m.state.stage=="app" && m.state.plan!=null && m.state.profile.reminder && local==m.state.profile.reminderTime && m.state.reminderShown!=today().toString()) {
                reminder=true;m.update(m.state.copy(reminderShown=today().toString()))
            }
            delay(500)
        }
    }
    val selectedTarget=m.selectedSlot?.let {pos ->
        val slot=m.state.plan?.days?.getOrNull(pos.first)?.slots?.getOrNull(pos.second)
        slot?.let {m.catalog.byRecipe[it.recipeId]?.let {recipe -> CookTarget(recipe,it.servings,pos)}}
    }
    if(m.selectedSlot!=null && selectedTarget==null) LaunchedEffect(m.selectedSlot) {m.selectedSlot=null}
    // Main-scene screens avoid stale Web accessibility nodes left by dismissed dialogs.
    Column(Modifier.widthIn(max=480.dp).fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
        if(Account.current!=null && (!m.accountReady || m.loadedAccountId!=accountId)) {
            Page {Heading("Аккаунт","Загружаем ваши данные")
                if(accountLoadError==null) CircularProgressIndicator() else {Note(accountLoadError!!);Primary("Повторить загрузку") {loadRetry++}}
                TextButton(onClick={Account.clear();m.resetAccount()}) {Text("Вернуться ко входу")}
            }
        } else if(m.state.stage=="intro" && Account.current==null) {
            IntroScreen(m)
        } else if(m.state.stage=="quiz") {
            OnboardingScreen(m,scope)
        } else if(m.state.stage=="loading") {
            LoadingScreen(m)
        } else if(m.state.stage=="ready" && Account.current==null) {
            ReadyScreen(m)
        } else if(Account.current==null) {
            AuthenticationScreen(m)
        } else if(m.state.stage!="app") {
            LaunchedEffect(Unit) {m.update(m.state.copy(stage=if(m.state.plan!=null) "app" else "quiz"))}
        } else if(m.cart!=null) {
            CartScreen(m,m.cart!!,scope)
        } else if(m.cooking!=null) {
            CookingScreen(m,scope,m.cooking!!,now)
        } else if(selectedTarget!=null) {
            CookingScreen(m,scope,selectedTarget,now)
        } else if(m.nowRecipe!=null) {
            NowRecipeScreen(m,m.nowRecipe!!)
        } else if(m.replacement!=null) {
            ReplacementScreen(m,m.replacement!!)
        } else if(m.share) {
            ShareScreen(m)
        } else if(m.page=="familyview") {
            FamilyViewScreen(m)
        } else {
            val page=m.page
            // v4 app bar: back control, 17sp bold title, hairline below.
            Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.background).padding(horizontal=16.dp,vertical=10.dp).heightIn(min=36.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                if(page!=null) IconBox({m.back()}) {Text("‹",fontSize=22.sp,color=MaterialTheme.colorScheme.primary)}
                Text(page?.let {pageTitles[it]} ?: when(m.tab) {"menu" -> "Меню"; "shop" -> "Покупки"; "home" -> "Дома"; else -> "Профиль"},
                    Modifier.weight(1f),fontSize=17.sp,fontWeight=FontWeight.Bold)
            }
            HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
            m.persistenceError?.let { Text(it,Modifier.padding(12.dp),color=MaterialTheme.colorScheme.error,style=MaterialTheme.typography.bodySmall);if(m.syncConflict) TextButton(onClick={loadRetry++}) {Text("Загрузить актуальные данные")} }
            val running=m.timers.filterValues { it.paused==null || it.done }
            if(running.isNotEmpty()) FlowRow(Modifier.fillMaxWidth().background(if(isSystemInDarkTheme()) Color(0xff352a12) else AmberSoft).padding(horizontal=16.dp,vertical=8.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                running.forEach { (key,t) -> Text(if(t.done) "Таймер готов ×" else "⏱ ${timeText(t.remaining(now))}",Modifier.clickable {m.timers.remove(key)},color=if(t.done) MaterialTheme.colorScheme.error else Amber,fontSize=13.sp,fontWeight=FontWeight.SemiBold) }
            }
            Box(Modifier.weight(1f)) {
                when(page) {
                    "family" -> FamilyPage(m)
                    "food" -> FoodPage(m)
                    "details" -> DetailsPage(m)
                    "recipes" -> MyRecipesPage(m)
                    "recipe" -> RecipeEditorPage(m)
                    "promo" -> PromoPage(m)
                    "autocart" -> AutoCartPage(m)
                    "kcal" -> KcalGate(m)
                    "sub" -> SubscriptionPage(m)
                    "metrics" -> MetricsPage(m)
                    "cookfrom" -> CookScreen(m,scope)
                    else -> when(m.tab) {
                        "home" -> if(m.scanningFridge && m.inventory!=null) ScannerScreen(m,scope,scannerService,m.inventoryService,m.inventory!!,m.inventoryBusy,
                            onSaved={m.inventory=it;m.scanningFridge=false;m.scannerProducts=emptyList();m.scannerPhotos=emptyList();m.track("fridge_scanned")},
                            onConflict={m.inventoryError=it;m.scanningFridge=false;m.loadInventory(scope)},onCancel={m.scanningFridge=false})
                            else HomeTab(m,scope)
                        "shop" -> ShoppingScreen(m)
                        "profile" -> ProfileHub(m,scope)
                        else -> MenuScreen(m)
                    }
                }
            }
            HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
            Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface)) {
                val left=shoppingRows(m).count {!it.covered && it.item.ingredient.id !in m.state.bought}
                tabs.forEach { (key,label) ->
                    val selected=m.tab==key
                    val tint=if(selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                    Column(Modifier.weight(1f).clickable { m.open(key) }.padding(top=8.dp,bottom=10.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(3.dp)) {
                        Box {AppIcon(key,tint)
                            if(key=="shop" && left>0) Text("$left",Modifier.align(Alignment.TopEnd).offset(x=12.dp,y=(-4).dp).clip(RoundedCornerShape(999.dp)).background(Amber).padding(horizontal=5.dp),color=Color.White,fontSize=10.sp,fontWeight=FontWeight.Bold)}
                        Text(label,color=tint,fontSize=11.sp,fontWeight=if(selected) FontWeight.SemiBold else FontWeight.Normal)
                    }
                }
            }
        }
    }
    if(reminder) AlertDialog(onDismissRequest={reminder=false},title={Text("Проверьте продукты на завтра")},text={Text("Откройте список покупок и подготовьте продукты для следующего дня.")},confirmButton={TextButton(onClick={reminder=false;m.open("shop")}) { Text("Покупки") }},dismissButton={TextButton(onClick={reminder=false}) { Text("Позже") }})

}

private fun kotlinx.datetime.Instant.toLocalTimeString(): String {
    val local=this.toLocalDateTime(kotlinx.datetime.TimeZone.currentSystemDefault())
    return "${local.hour.toString().padStart(2,'0')}:${local.minute.toString().padStart(2,'0')}"
}

@Composable internal fun AppIcon(type: String,color: Color) {
    Canvas(Modifier.size(22.dp)) {
        val s=size.width/24;val stroke=Stroke(1.8f*s)
        fun line(x:Float,y:Float,x2:Float,y2:Float)=drawLine(color,androidx.compose.ui.geometry.Offset(x*s,y*s),androidx.compose.ui.geometry.Offset(x2*s,y2*s),1.8f*s)
        when(type) {
            "replace" -> {drawArc(color,40f,290f,false,androidx.compose.ui.geometry.Offset(4*s,4*s),androidx.compose.ui.geometry.Size(16*s,16*s),style=stroke);line(18f,3f,20f,8f);line(20f,8f,15f,8f)}
            "link" -> {line(5f,19f,19f,5f);line(10f,5f,19f,5f);line(19f,5f,19f,14f)}
            "home","today" -> {line(4f,11f,12f,4f);line(12f,4f,20f,11f);line(5f,10f,5f,20f);line(19f,10f,19f,20f);line(5f,20f,19f,20f);line(10f,20f,10f,14f);line(14f,20f,14f,14f);line(10f,14f,14f,14f)}
            "cook" -> {drawRoundRect(color,androidx.compose.ui.geometry.Offset(4*s,11*s),androidx.compose.ui.geometry.Size(16*s,9*s),androidx.compose.ui.geometry.CornerRadius(3*s),style=stroke);line(2f,11f,22f,11f);line(9f,4f,9f,8f);line(14f,4f,14f,8f)}
            "menu" -> {drawRoundRect(color,androidx.compose.ui.geometry.Offset(4*s,5*s),androidx.compose.ui.geometry.Size(16*s,16*s),androidx.compose.ui.geometry.CornerRadius(2*s),style=stroke);line(4f,10f,20f,10f);line(9f,3f,9f,7f);line(15f,3f,15f,7f);line(8f,14f,15f,14f);line(8f,17f,13f,17f)}
            "shop" -> {val path=Path().apply {moveTo(5*s,8*s);lineTo(19*s,8*s);lineTo(17*s,21*s);lineTo(7*s,21*s);close()};drawPath(path,color,style=stroke);drawArc(color,180f,180f,false,androidx.compose.ui.geometry.Offset(9*s,3*s),androidx.compose.ui.geometry.Size(6*s,10*s),style=stroke)}
            "profile" -> {drawCircle(color,3.5f*s,androidx.compose.ui.geometry.Offset(12*s,8.5f*s),style=stroke);drawArc(color,180f,180f,false,androidx.compose.ui.geometry.Offset(5*s,13*s),androidx.compose.ui.geometry.Size(14*s,14*s),style=stroke)}
            "lock" -> {drawRoundRect(color,androidx.compose.ui.geometry.Offset(5*s,11*s),androidx.compose.ui.geometry.Size(14*s,9*s),androidx.compose.ui.geometry.CornerRadius(2*s),style=stroke);drawArc(color,180f,180f,false,androidx.compose.ui.geometry.Offset(8*s,4*s),androidx.compose.ui.geometry.Size(8*s,10*s),style=stroke)}
            else -> {drawRoundRect(color,androidx.compose.ui.geometry.Offset(6*s,2*s),androidx.compose.ui.geometry.Size(12*s,20*s),androidx.compose.ui.geometry.CornerRadius(2*s),style=stroke);line(6f,10f,18f,10f);line(9f,5f,9f,7f);line(9f,13f,9f,16f)}
        }
    }
}

@Composable internal fun Page(content: @Composable ColumnScope.()->Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start=16.dp,end=16.dp,top=18.dp,bottom=28.dp),verticalArrangement=Arrangement.spacedBy(14.dp),content=content)
}
@Composable internal fun Panel(modifier: Modifier=Modifier,accent: Color?=null,content: @Composable ColumnScope.()->Unit) {
    Surface(modifier.fillMaxWidth(),shape=RoundedCornerShape(14.dp),border=BorderStroke(1.dp,accent ?: MaterialTheme.colorScheme.outlineVariant),color=MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp),content=content)
    }
}
/** v4 eyebrow: small uppercase muted label above a heading. */
@Composable internal fun Eyebrow(text: String,color: Color=MaterialTheme.colorScheme.onSurfaceVariant) { Text(text.uppercase(),style=MaterialTheme.typography.labelMedium,color=color,letterSpacing=0.84.sp) }
@Composable internal fun Heading(kicker: String,title: String) { Column(verticalArrangement=Arrangement.spacedBy(4.dp)) { Eyebrow(kicker);Text(title,style=MaterialTheme.typography.headlineSmall) } }
@Composable internal fun Note(text: String) { Text(text,style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant) }
/** Saffron hint box. */
@Composable internal fun Hint(text: String) { Text(text,Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if(isSystemInDarkTheme()) Color(0xff352a12) else AmberSoft).padding(horizontal=12.dp,vertical=10.dp),style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurface) }
@Composable internal fun Primary(text: String,enabled: Boolean=true,onClick:()->Unit) {
    Button(onClick=onClick,enabled=enabled,modifier=Modifier.fillMaxWidth().heightIn(min=46.dp),shape=RoundedCornerShape(12.dp),
        colors=ButtonDefaults.buttonColors(disabledContainerColor=MaterialTheme.colorScheme.primary.copy(alpha=.45f),disabledContentColor=MaterialTheme.colorScheme.onPrimary)) { Text(text,style=MaterialTheme.typography.labelLarge) }
}
/** v4 secondary: soft green fill, green text. */
@Composable internal fun Secondary(text: String,enabled: Boolean=true,onClick:()->Unit) {
    Button(onClick=onClick,enabled=enabled,modifier=Modifier.fillMaxWidth().heightIn(min=46.dp),shape=RoundedCornerShape(12.dp),elevation=null,
        colors=ButtonDefaults.buttonColors(containerColor=MaterialTheme.colorScheme.secondaryContainer,contentColor=MaterialTheme.colorScheme.primary,disabledContainerColor=MaterialTheme.colorScheme.secondaryContainer.copy(alpha=.45f))) { Text(text,style=MaterialTheme.typography.labelLarge) }
}
/** v4 ghost: thin border, green text. Small by default (36dp), as in the prototype's header buttons. */
@Composable internal fun Ghost(text: String,modifier: Modifier=Modifier,enabled: Boolean=true,onClick:()->Unit) {
    OutlinedButton(onClick=onClick,enabled=enabled,modifier=modifier.heightIn(min=36.dp),shape=RoundedCornerShape(10.dp),border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant),
        contentPadding=PaddingValues(horizontal=12.dp,vertical=6.dp),colors=ButtonDefaults.outlinedButtonColors(containerColor=MaterialTheme.colorScheme.surface,contentColor=MaterialTheme.colorScheme.primary)) { Text(text,fontSize=14.sp,fontWeight=FontWeight.SemiBold) }
}
/** v4 chip: pill with a thin border; selected is filled green. */
@Composable internal fun Choice(label: String,selected: Boolean,onClick:()->Unit) {
    Surface(onClick=onClick,shape=RoundedCornerShape(999.dp),color=if(selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface,
        contentColor=if(selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,border=BorderStroke(1.dp,if(selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant)) {
        Text(label,Modifier.padding(horizontal=13.dp,vertical=7.dp),fontSize=14.sp)
    }
}
@Composable internal fun Badge(text: String,warn: Boolean=false) {
    val dark=isSystemInDarkTheme()
    Text(text,Modifier.clip(RoundedCornerShape(999.dp)).background(if(warn) (if(dark) Color(0xff352a12) else AmberSoft) else MaterialTheme.colorScheme.secondaryContainer).padding(horizontal=9.dp,vertical=2.dp),
        color=if(warn) (if(dark) Color(0xffe8b347) else Amber) else MaterialTheme.colorScheme.primary,fontSize=12.sp,fontWeight=FontWeight.SemiBold,maxLines=1)
}
/** v4 progress: 6dp rounded track. */
@Composable internal fun Progress(value: Float,modifier: Modifier=Modifier,over: Boolean=false,height: Dp=6.dp) {
    Box(modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(999.dp)).background(MaterialTheme.colorScheme.outlineVariant)) {
        Box(Modifier.fillMaxWidth(value.coerceIn(0f,1f)).fillMaxHeight().clip(RoundedCornerShape(999.dp)).background(if(over) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary))
    }
}
/** v4 checkbox: 24dp rounded square. */
@Composable internal fun Check(checked: Boolean,onChange:(Boolean)->Unit) {
    Box(Modifier.padding(4.dp).size(24.dp).clip(RoundedCornerShape(7.dp)).background(if(checked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface)
        .border(2.dp,if(checked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,RoundedCornerShape(7.dp)).clickable {onChange(!checked)},contentAlignment=Alignment.Center) {
        if(checked) Text("✓",color=MaterialTheme.colorScheme.onPrimary,fontWeight=FontWeight.Bold,fontSize=14.sp)
    }
}
/** v4 icon button: 36dp, thin border. */
@Composable internal fun IconBox(onClick:()->Unit,content: @Composable ()->Unit) {
    Box(Modifier.size(36.dp).clip(RoundedCornerShape(10.dp)).background(MaterialTheme.colorScheme.surface).border(1.dp,MaterialTheme.colorScheme.outlineVariant,RoundedCornerShape(10.dp)).clickable(onClick=onClick),contentAlignment=Alignment.Center) {content()}
}
@Composable internal fun NavRow(title: String,subtitle: String,locked: Boolean=false,badge: String?=null,onClick:()->Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick=onClick).padding(vertical=10.dp,horizontal=4.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
        if(locked) AppIcon("lock",Amber)
        Column(Modifier.weight(1f)) {
            Row(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalAlignment=Alignment.CenterVertically) {Text(title,style=MaterialTheme.typography.titleMedium);badge?.let {Badge(it,true)}}
            Note(subtitle)
        }
        Text("›",color=Muted,style=MaterialTheme.typography.titleLarge)
    }
}
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
fun timeText(seconds: Int) = "${seconds/60}:${(seconds%60).toString().padStart(2,'0')}"
fun plural(n: Int,one: String,few: String,many: String): String {val a=kotlin.math.abs(n)%100;val b=a%10;return if(a in 11..19) many else if(b in 2..4) few else if(b==1) one else many}
