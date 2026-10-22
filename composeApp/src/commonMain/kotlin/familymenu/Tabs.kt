@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package familymenu

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.math.roundToInt

private val weekdays=listOf("Пн","Вт","Ср","Чт","Пт","Сб","Вс")
private val months=listOf("января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря")
private val weekdayNames=listOf("Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье")
internal fun slotName(meal: String)=slotLabels[meal] ?: mealLabels[meal].orEmpty()
private fun slotTime(meal: String)=mealTimes[meal]?.let {"${it/60}:${(it%60).toString().padStart(2,'0')}"}.orEmpty()

// ---------- Menu: days, the nearest meal large, the rest below ----------
@Composable internal fun MenuScreen(m: AppModel,preview: Boolean=false) {
    val plan=m.state.plan
    if(plan==null || plan.days.isEmpty()) {Page {
        Heading("Меню","Меню ещё нет")
        Note("Составим по вашим ответам: цель, тип питания, ограничения и продукты дома.")
        Primary("Составить меню") {m.update(m.state.copy(stage="loading"))}
    };return}
    val today=m.state.today().toString()
    LaunchedEffect(plan.days.first().date) {val i=plan.days.indexOfFirst {it.date==today};if(i>=0) m.menuDay=i}
    val di=m.menuDay.coerceIn(0,plan.days.lastIndex);val day=plan.days[di];val date=LocalDate.parse(day.date)
    Page {
        if(preview) Hint("Ваше меню готово! Сохраните его — и список покупок соберётся сам.")
        Row(verticalAlignment=Alignment.Bottom) {
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                Eyebrow(if(day.date==today) "Сегодня" else if(plan.days.size>1) "Меню на ${plan.days.size} ${plural(plan.days.size,"день","дня","дней")}" else "Меню")
                Text("${weekdayNames[date.dayOfWeek.ordinal]}, ${date.dayOfMonth} ${months[date.monthNumber-1]}",style=if(plan.days.size==1) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.headlineSmall)
            }
            if(!preview) Badge(if(plan.approved) "утверждено" else "черновик",!plan.approved)
        }
        if(plan.days.size>1) Row(horizontalArrangement=Arrangement.spacedBy(4.dp)) {
            plan.days.forEachIndexed {i,d -> val ld=LocalDate.parse(d.date);val selected=i==di
                Column(Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(if(selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface)
                    .border(1.dp,if(selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,RoundedCornerShape(10.dp))
                    .clickable {m.menuDay=i}.padding(vertical=6.dp),horizontalAlignment=Alignment.CenterHorizontally) {
                    Text(weekdays[ld.dayOfWeek.ordinal],color=if(selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,fontSize=12.sp)
                    Text("${ld.dayOfMonth}",color=if(selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,fontSize=15.sp,fontWeight=FontWeight.Bold)
                }
            }
        }
        if(day.slots.isEmpty()) Note("На этот день блюд нет.")
        val nowMinutes=Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault()).let {it.hour*60+it.minute}
        val next=if(day.date==today) day.slots.indexOfFirst {!it.cooked && (mealTimes[it.meal] ?: 0)+90>=nowMinutes}.takeIf {it>=0} ?: day.slots.indexOfFirst {!it.cooked}.coerceAtLeast(0)
        else 0
        day.slots.getOrNull(next)?.let {BigMealCard(m,di,next,it,preview)}
        val rest=day.slots.withIndex().filter {it.index!=next}
        if(rest.isNotEmpty()) Surface(shape=RoundedCornerShape(14.dp),border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant),color=MaterialTheme.colorScheme.surface) {
            Column {
                Row(Modifier.fillMaxWidth().background(if(day.date==today) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.background).padding(horizontal=14.dp,vertical=10.dp)) {
                    Text("Ещё в этот день",fontWeight=FontWeight.SemiBold,modifier=Modifier.weight(1f))
                    if(day.date==today) Text("сегодня",color=MaterialTheme.colorScheme.primary,fontSize=12.sp,fontWeight=FontWeight.SemiBold)
                }
                rest.forEach {(si,s) -> HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant);SlotRow(m,di,si,s,preview)}
            }
        }
        if(!preview) {
            if(m.state.kcalVisible() && day.date==today) CaloriesPanel(m,di)
            if(!plan.approved) Primary("Утвердить меню и собрать покупки") {m.update(m.state.copy(plan=plan.copy(approved=true)));m.track("menu_approved");m.open("shop")}
            else Secondary("Отправить меню семье") {m.share=true;m.track("share_opened")}
            Ghost("Пересобрать меню",Modifier.fillMaxWidth().heightIn(min=46.dp)) {m.update(m.state.copy(stage="loading"))}
        }
    }
}
/** v4 hero: green card with the dish picture, white title and a white button. */
@Composable private fun BigMealCard(m: AppModel,di: Int,si: Int,slot: Slot,preview: Boolean) {
    val r=m.catalog.byRecipe[slot.recipeId]
    val onAccent=MaterialTheme.colorScheme.onPrimary
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(MaterialTheme.colorScheme.primary).padding(18.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Picture(r?.imageUrl,Modifier.fillMaxWidth().aspectRatio(400f/260).clip(RoundedCornerShape(14.dp)))
        Text("${slotName(slot.meal)} · ${slotTime(slot.meal)}",color=onAccent.copy(alpha=.85f),fontSize=14.sp)
        if(r==null) {Text("Не нашли подходящее блюдо. Ослабьте ограничения в профиле.",color=onAccent);return@Column}
        Text(r.name,fontFamily=DishFont.current,fontSize=24.sp,lineHeight=29.sp,fontWeight=FontWeight.SemiBold,color=onAccent)
        Text("${r.minutes} мин   ${servingsText(slot.servings)}"+(if(m.state.kcalVisible()) "   ${m.catalog.nutrition(r)[0].roundToInt()} ккал" else "")+(if(slot.cooked) "   приготовлено ✓" else ""),color=onAccent.copy(alpha=.85f),fontSize=12.5.sp)
        if(!preview) Row(horizontalArrangement=Arrangement.spacedBy(10.dp),verticalAlignment=Alignment.CenterVertically) {
            Button(onClick={m.selectedSlot=m.recipePosition(di,si)},Modifier.weight(1f).heightIn(min=46.dp),shape=RoundedCornerShape(12.dp),
                colors=ButtonDefaults.buttonColors(containerColor=onAccent,contentColor=MaterialTheme.colorScheme.primary)) {Text(if(slot.cooked) "Открыть рецепт" else "Готовить",style=MaterialTheme.typography.labelLarge)}
            OutlinedButton(onClick={m.replacement=m.recipePosition(di,si)},Modifier.heightIn(min=36.dp),shape=RoundedCornerShape(999.dp),border=BorderStroke(1.dp,onAccent),
                colors=ButtonDefaults.outlinedButtonColors(contentColor=onAccent),contentPadding=PaddingValues(horizontal=12.dp)) {Text("Заменить",fontSize=13.sp)}
        }
    }
}
/** v4 slot row inside a day card: meal label column, thumbnail, dish name, meta, replace icon. */
@Composable private fun SlotRow(m: AppModel,di: Int,si: Int,slot: Slot,preview: Boolean) {
    val r=m.catalog.byRecipe[slot.recipeId]
    Row(Modifier.fillMaxWidth().clickable(enabled=!preview && r!=null) {m.selectedSlot=m.recipePosition(di,si)}.padding(horizontal=14.dp,vertical=10.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
        Picture(r?.imageUrl,Modifier.size(width=64.dp,height=46.dp).clip(RoundedCornerShape(10.dp)))
        Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(2.dp)) {
            Text(slotName(slot.meal).uppercase(),fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant,fontWeight=FontWeight.SemiBold,letterSpacing=0.5.sp)
            Text(r?.name ?: "Нет подходящего блюда",fontFamily=DishFont.current,fontSize=16.sp,fontWeight=FontWeight.SemiBold,
                textDecoration=if(slot.cooked) androidx.compose.ui.text.style.TextDecoration.LineThrough else null)
            if(r!=null) Text("${r.minutes} мин   ${servingsText(slot.servings)}",fontSize=12.5.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if(!preview && r!=null) IconBox({m.replacement=m.recipePosition(di,si)}) {AppIcon("replace",MaterialTheme.colorScheme.primary)}
    }
}

// ---------- Home: what is in the fridge ----------
@Composable internal fun HomeTab(m: AppModel,scope: CoroutineScope) {
    Page {
        Heading("Дома","Что есть дома")
        if(m.inventory==null && m.inventoryBusy) LinearProgressIndicator(Modifier.fillMaxWidth(),color=MaterialTheme.colorScheme.primary,trackColor=MaterialTheme.colorScheme.outlineVariant)
        PantryBlock(m,scope)
        val have=m.have()
        if(have.isNotEmpty()) Primary("Что приготовить из этого") {m.open("cookfrom")}
        Note("Продукты из этого списка вычитаются из покупок и учитываются при подборе меню.")
    }
}

// ---------- Shopping ----------
@Composable internal fun ShoppingScreen(m: AppModel) {
    val clipboard=LocalClipboardManager.current;val scope=rememberCoroutineScope()
    val rows=shoppingRows(m);val need=rows.filter {!it.covered};val left=need.filter {it.item.ingredient.id !in m.state.bought}
    if(rows.isEmpty()) {Page {
        Heading("Покупки","Список пуст")
        Note("Он соберётся сам, когда вы утвердите меню.")
        Primary("Открыть меню") {m.open("menu")}
    };return}
    Page {
        Row(verticalAlignment=Alignment.Bottom) {
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {Eyebrow("Покупки");Text("Список покупок",style=MaterialTheme.typography.headlineSmall)}
            Ghost("Копировать") {clipboard.setText(AnnotatedString(left.joinToString("\n") {"${it.item.ingredient.name} — ${quantity(it.item.ingredient,it.toBuy)}"}));m.track("list_copied")}
        }
        if(m.state.plan?.approved==false) Hint("Меню ещё не утверждено: список может измениться после замен.")
        Panel(Modifier.clickable {m.track("cart_price_tapped");m.open("autocart")}) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Text("Осталось купить: ",color=MaterialTheme.colorScheme.onSurfaceVariant);Text("${left.size} ${plural(left.size,"позиция","позиции","позиций")}",fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
                Text("≈${money(left.sumOf {it.cost})}",fontWeight=FontWeight.Bold,fontSize=17.sp)
            }
            Progress(if(need.isEmpty()) 1f else (need.size-left.size)/need.size.toFloat())
            Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                Text("Собрать корзину автоматически ›",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.SemiBold,modifier=Modifier.weight(1f,fill=false));Badge("Premium",true)
            }
            Note("Одинаковые продукты из разных блюд объединены. Цены — снимок на 20–21 октября, примерные.")
        }
        need.groupBy {it.item.ingredient.category}.forEach {(category,products) ->
            Column {
                Eyebrow(category);Spacer(Modifier.height(6.dp))
                Surface(shape=RoundedCornerShape(12.dp),border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant),color=MaterialTheme.colorScheme.surface) {Column {
                    products.forEachIndexed {index,row ->
                        val i=row.item.ingredient;val done=i.id in m.state.bought
                        if(index>0) HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
                        Row(Modifier.fillMaxWidth().padding(horizontal=8.dp,vertical=8.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            Check(done) {m.update(m.state.copy(bought=m.state.bought.toggle(i.id)));if(it) m.track("item_bought")}
                            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(2.dp)) {
                                Row(verticalAlignment=Alignment.Top) {
                                    Text(i.name,Modifier.weight(1f),color=if(done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                                        textDecoration=if(done) androidx.compose.ui.text.style.TextDecoration.LineThrough else null)
                                    Text(quantity(i,row.toBuy),fontWeight=FontWeight.SemiBold,modifier=Modifier.padding(start=8.dp))
                                }
                                Text("для: ${row.item.dishes.joinToString()}"+if(row.stock>0) " · дома ${quantity(i,row.stock)}" else "",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            if(Account.current!=null) Ghost("есть") {m.setStock(scope,i.id,row.item.amount)}
                        }
                    }
                }}
            }
        }
        val covered=rows.filter {it.covered}
        if(covered.isNotEmpty()) Column(verticalArrangement=Arrangement.spacedBy(6.dp)) {Eyebrow("Уже есть дома");Panel {covered.forEach {Note("${it.item.ingredient.name} — хватает запаса")}}}
        if(m.state.extraBuy.isNotEmpty()) Ghost("Убрать докупки для блюд «из того, что есть»",Modifier.fillMaxWidth()) {m.update(m.state.copy(extraBuy=emptyMap()))}
        val spices=m.state.plan?.days?.flatMap {it.slots}?.flatMap {m.catalog.byRecipe[it.recipeId]?.spices.orEmpty()}?.distinct().orEmpty()
        if(spices.isNotEmpty()) Column(verticalArrangement=Arrangement.spacedBy(6.dp)) {Eyebrow("Специи — проверьте, есть ли дома");Panel {Text(spices.joinToString());Note("Количество «по вкусу», в список не суммируем.")}}
    }
}

// ---------- Premium ----------
@Composable internal fun PremiumOffer(m: AppModel,title: String,text: String) {
    var plan by remember {mutableStateOf("year")}
    Page {
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalAlignment=Alignment.CenterVertically) {AppIcon("lock",Amber);Text(title,style=MaterialTheme.typography.headlineSmall,modifier=Modifier.weight(1f,fill=false));Badge("Premium",true)}
        Text(text,style=MaterialTheme.typography.bodyLarge)
        Panel(accent=Amber) {
            Text("Что входит в Premium",style=MaterialTheme.typography.titleMedium)
            listOf("Автосборка корзины из утверждённого меню под ваш бюджет","Сравнение цен: где купить дешевле","Подборка акций ВкусВилла и Лавки","Калории и КБЖУ для каждого члена семьи").forEach {Text("• $it")}
        }
        listOf(Triple("year","На год · 1 990 ₽","≈166 ₽ в месяц — на 45% выгоднее"),Triple("month","На месяц · 299 ₽","отмена в любой момент")).forEach {(key,label,note) ->
            Panel(Modifier.clickable {plan=key},accent=if(plan==key) MaterialTheme.colorScheme.primary else null) {Text(label,style=MaterialTheme.typography.titleMedium);Note(note)}
        }
        Primary("Подключить за ${if(plan=="year") "1 990 ₽" else "299 ₽"}") {m.update(m.state.copy(subscription=Subscription(plan,m.state.today().toString())));m.track("subscribed",plan)}
        Note("Прототип: деньги не списываются.")
    }
    LaunchedEffect(title) {m.track("paywall_shown",title)}
}
@Composable internal fun SubscriptionPage(m: AppModel) {
    val sub=m.state.subscription ?: return PremiumOffer(m,"Premium","Меню и список покупок остаются бесплатными. Premium экономит время и деньги на покупках.")
    Page {
        Heading("Premium","Подписка подключена")
        Panel {Text(if(sub.plan=="year") "На год — 1 990 ₽" else "На месяц — 299 ₽");Note("С ${dateLabel(sub.since)}. Отменить можно в любой момент — меню и настройки останутся.")}
        Secondary("Отменить подписку (прототип)") {m.update(m.state.copy(subscription=null));m.track("unsubscribed")}
    }
}
@Composable internal fun AutoCartPage(m: AppModel) {
    if(!m.state.premiumOn()) return PremiumOffer(m,"Автосборка корзины","Соберём корзину из утверждённого меню на нужную сумму и подскажем, в каком магазине дешевле.")
    val plan=m.state.plan;val p=m.state.profile
    Page {
        Heading("Premium","Автосборка корзины")
        if(plan==null) {Note("Сначала составьте меню.");Primary("Открыть меню") {m.open("menu")};return@Page}
        if(!plan.approved) {Panel {Note("Корзина собирается из утверждённого меню.");Primary("Утвердить меню") {m.update(m.state.copy(plan=plan.copy(approved=true)));m.track("menu_approved")}};return@Page}
        Panel {
            Text("Бюджет",style=MaterialTheme.typography.titleMedium)
            NumberInput("Сумма на эту корзину, ₽",p.budget,300..200000) {m.profile(m.state.profile.copy(budget=it,budgetSet=true))}
        }
        val totals=listOf("vv" to "ВкусВилл","lavka" to "Яндекс Лавка").map {(key,label) -> val st=m.state.copy(store=key)
            Triple(key,label,m.engine.shopping(st).filter {it.ingredient.id !in st.bought}.sumOf {r -> val stock=m.stock(r.ingredient.id);(r.amount-stock).coerceAtLeast(0.0)*price(r.ingredient,key,p.city)})}
        val cheapest=totals.minBy {it.third}.first
        Panel {
            Text("Где купить",style=MaterialTheme.typography.titleMedium)
            totals.forEach {(key,label,sum) -> Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable {m.update(m.state.copy(store=key))}.padding(vertical=4.dp),verticalAlignment=Alignment.CenterVertically) {
                RadioButton(m.state.store==key,{m.update(m.state.copy(store=key))});Text(label,Modifier.weight(1f));if(key==cheapest) Badge("дешевле");Text("  ≈ ${money(sum)}",fontWeight=FontWeight.SemiBold)
            }}
        }
        val total=totals.first {it.first==m.state.store}.third
        if(total>p.budget) Panel(accent=Amber) {Text("Не укладываемся: ≈ ${money(total)} из ${p.budget} ₽",color=Amber,fontWeight=FontWeight.SemiBold);Note("Замените самые дорогие блюда в меню или увеличьте бюджет.")}
        else Note("Укладываемся: ≈ ${money(total)} из ${p.budget} ₽")
        val left=shoppingRows(m).filter {!it.covered && it.item.ingredient.id !in m.state.bought}
        Primary("Собрать корзину · ${left.size} ${plural(left.size,"продукт","продукта","продуктов")}",left.isNotEmpty()) {m.cart=CartSession(left.map {it.item.ingredient.id});m.track("cart_started")}
    }
}
@Composable internal fun PromoPage(m: AppModel) {if(m.state.premiumOn()) PromoScreen(m) else PremiumOffer(m,"Подборка акций","Каждую неделю — скидки ВкусВилла и Лавки на продукты из вашего меню.")}
@Composable internal fun KcalGate(m: AppModel) {if(m.state.premiumOn()) KcalPage(m) else PremiumOffer(m,"Калории и КБЖУ","Норма для каждого члена семьи, КБЖУ блюд и дневник «что съели».")}

// ---------- Profile ----------
@Composable internal fun ProfileHub(m: AppModel,scope: CoroutineScope) {
    val s=m.state;val p=s.profile
    var reset by remember {mutableStateOf(false)}
    Page {
        Panel {
            Text(Account.current?.user?.login ?: "Профиль",style=MaterialTheme.typography.titleMedium)
            Account.current?.user?.let {Note("Вход через Telegram")}
        }
        Panel {
            Text("НАСТРОЙКИ",style=MaterialTheme.typography.labelMedium,color=Muted)
            NavRow("Семья","${p.members.size} ${plural(p.members.size,"человек","человека","человек")} · вес, рост, калории") {m.open("family")}
            NavRow("Питание и ограничения",(goalLabel(p)+" · "+(diets[p.diet] ?: p.diet))+(if(p.allergies.isNotEmpty()) " · аллергии: ${p.allergies.size}" else "")) {m.open("food")}
            NavRow("Мои рецепты",if(s.myRecipes.isEmpty()) "Добавьте свои блюда — они попадут в меню" else "${s.myRecipes.size} ${plural(s.myRecipes.size,"рецепт","рецепта","рецептов")}") {m.open("recipes")}
            NavRow("Дни и приёмы пищи","${p.days} ${plural(p.days,"день","дня","дней")} · "+slotLabels.filter {(k,_) -> (p.mealSetup[k] ?: defaultMealSetup[k])!="none"}.values.joinToString {it.lowercase()}) {m.open("details")}
        }
        Panel(accent=if(s.premiumOn()) null else Amber) {
            Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {Text("PREMIUM",style=MaterialTheme.typography.labelMedium,color=Muted);if(s.premiumOn()) Badge("подключён")}
            NavRow("Автосборка корзины","Из утверждённого меню, под ваш бюджет",locked=!s.premiumOn()) {m.open("autocart")}
            NavRow("Подборка акций","ВкусВилл и Яндекс Лавка",locked=!s.premiumOn()) {m.open("promo")}
            NavRow("Калории и КБЖУ",if(p.kcalOn && s.premiumOn()) "Включены" else "Норма и дневник для каждого",locked=!s.premiumOn()) {m.open("kcal")}
            NavRow("Подписка",if(s.premiumOn()) "Подключена" else "299 ₽ в месяц или 1 990 ₽ в год") {m.open("sub")}
        }
        Panel {
            Text("Оформление",style=MaterialTheme.typography.titleMedium)
            FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {listOf("system" to "Системное","light" to "Светлое","dark" to "Тёмное").forEach {(key,label) -> Choice(label,s.theme==key) {m.update(s.copy(theme=key))}}}
        }
        Secondary("Выйти") {scope.launch {try {Account.logout()} catch(_: Exception) {} finally {m.resetAccount()}}}
        TextButton(onClick={reset=true}) {Text("Пройти знакомство заново")}
        TextButton(onClick={m.open("metrics")}) {Text("Метрики пилота")}
    }
    if(reset) AlertDialog(onDismissRequest={reset=false},title={Text("Пройти знакомство заново?")},text={Text("Ответим на вопросы ещё раз и составим новое меню. Свои рецепты и продукты дома сохранятся.")},
        confirmButton={TextButton(onClick={m.onboardingStep=0;m.page=null;reset=false;m.update(s.copy(stage="quiz"))}) {Text("Начать")}},
        dismissButton={TextButton(onClick={reset=false}) {Text("Отмена")}})
}
private fun goalLabel(p: Profile)=when(p.goals.firstOrNull()) {"lose" -> "Похудение";"mass" -> "Набор массы";"pp" -> "Правильное питание";"protein" -> "Больше белка";"lowcarb" -> "Меньше углеводов";else -> "Без цели"}
@Composable internal fun FamilyPage(m: AppModel) {Page {MembersEditor(m)}}
@Composable internal fun FoodPage(m: AppModel) {
    val p=m.state.profile
    Page {
        Panel {Text("Цель",style=MaterialTheme.typography.titleMedium)
            FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {(goals.toList()+("none" to "Без цели")).forEach {(key,label) -> Choice(label,if(key=="none") p.goals.isEmpty() else key in p.goals) {m.profile(p.copy(goals=if(key=="none") emptySet() else setOf(key)))}}}}
        DietEditor(m)
        Panel {Text("Аллергии",style=MaterialTheme.typography.titleMedium);CollapsingChips(allergies.toList(),p.allergies) {m.profile(m.state.profile.copy(allergies=m.state.profile.allergies.toggle(it)))}}
        Panel {Text("Не нравится",style=MaterialTheme.typography.titleMedium)
            val items=remember {m.catalog.ingredients.filter {it.id !in pantryStaples}.sortedBy {it.name}.map {it.id to it.name}}
            CollapsingChips(items,p.dislikes) {m.profile(m.state.profile.copy(dislikes=m.state.profile.dislikes.toggle(it)))}}
        if(m.state.blocked.isNotEmpty()) Panel {Text("Скрытые блюда",style=MaterialTheme.typography.titleMedium);m.state.blocked.forEach {id -> Row(verticalAlignment=Alignment.CenterVertically) {Text(m.catalog.byRecipe[id]?.name ?: id,Modifier.weight(1f));TextButton(onClick={m.update(m.state.copy(blocked=m.state.blocked-id))}) {Text("Вернуть")}}}}
        Note("Изменения учтём в следующем меню.")
        Secondary("Пересобрать меню сейчас") {m.update(m.state.copy(stage="loading"))}
    }
}
@Composable internal fun DetailsPage(m: AppModel) {Page {DetailsEditor(m);Primary("Пересобрать меню",m.state.profile.mealSetup.values.any {it!="none"}) {m.update(m.state.copy(stage="loading"))}}}

// ---------- My recipes ----------
@Composable internal fun MyRecipesPage(m: AppModel) {
    Page {
        Note("Ваши рецепты попадают в подбор меню наравне с нашими, с учётом ограничений.")
        Primary("+ Добавить рецепт") {m.editRecipe="";m.open("recipe")}
        if(m.state.myRecipes.isEmpty()) Panel {Text("Пока пусто",style=MaterialTheme.typography.titleMedium);Note("Добавьте блюдо, которое любят в семье: продукты из справочника, шаги — и оно появится в меню.")}
        m.state.myRecipes.forEach {r -> Panel(Modifier.clickable {m.editRecipe=r.id;m.open("recipe")}) {
            Text(r.name,fontFamily=DishFont.current,style=MaterialTheme.typography.titleMedium)
            Note("${myKinds[r.myKind()]} · ${r.minutes} мин · ${servingsText(r.servings)} · ${r.ingredients.size} ${plural(r.ingredients.size,"продукт","продукта","продуктов")}")
        }}
    }
}
@Composable internal fun RecipeEditorPage(m: AppModel) {
    val existing=m.state.myRecipes.firstOrNull {it.id==m.editRecipe}
    var name by remember(existing?.id) {mutableStateOf(existing?.name.orEmpty())}
    var kind by remember(existing?.id) {mutableStateOf(existing?.myKind() ?: "dish")}
    var minutes by remember(existing?.id) {mutableStateOf(existing?.minutes ?: 30)}
    var servings by remember(existing?.id) {mutableStateOf(existing?.servings ?: 4)}
    val ingredients=remember(existing?.id) {mutableStateListOf<Quantity>().apply {existing?.ingredients?.let {addAll(it)}}}
    val steps=remember(existing?.id) {mutableStateListOf<String>().apply {addAll(existing?.steps ?: listOf(""))}}
    var query by remember {mutableStateOf("")}
    var kindOpen by remember {mutableStateOf(false)}
    var confirmDelete by remember {mutableStateOf(false)}
    Page {
        OutlinedTextField(name,{name=it.take(80)},label={Text("Название блюда")},singleLine=true,modifier=Modifier.fillMaxWidth())
        Box {
            OutlinedButton(onClick={kindOpen=true},Modifier.fillMaxWidth(),shape=RoundedCornerShape(12.dp)) {Text("Что это: ${myKinds.getValue(kind)}",Modifier.weight(1f));Text("▾")}
            DropdownMenu(kindOpen,{kindOpen=false}) {myKinds.forEach {(k,label) -> DropdownMenuItem(text={Text(label)},onClick={kind=k;kindOpen=false})}}
        }
        Row(horizontalArrangement=Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {NumberInput("Время, мин",minutes,1..600) {minutes=it}}
            Column(Modifier.weight(1f)) {NumberInput("Порций",servings,1..20) {servings=it}}
        }
        Panel {
            Text("Продукты",style=MaterialTheme.typography.titleMedium)
            ingredients.forEachIndexed {index,q -> val i=m.catalog.byIngredient.getValue(q.id)
                Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    Text(i.name,Modifier.weight(1f))
                    var text by remember(q.id) {mutableStateOf(q.quantity.let {if(it==it.roundToInt().toDouble()) it.roundToInt().toString() else it.toString()})}
                    OutlinedTextField(text,{v -> text=v.filter {c -> c.isDigit() || c=='.' || c==','}.take(7);text.replace(',','.').toDoubleOrNull()?.takeIf {it>0}?.let {ingredients[index]=q.copy(quantity=it)}},
                        suffix={Text(unitLabel(i))},singleLine=true,modifier=Modifier.width(120.dp))
                    TextButton(onClick={ingredients.removeAt(index)}) {Text("×")}
                }
            }
            OutlinedTextField(query,{query=it.take(40)},label={Text("Добавить продукт")},singleLine=true,modifier=Modifier.fillMaxWidth())
            if(query.isNotBlank()) FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                m.catalog.ingredients.filter {it.name.contains(query.trim(),true) && ingredients.none {q -> q.id==it.id}}.take(10).forEach {i ->
                    Choice("+ ${i.name}",false) {ingredients+=Quantity(i.id,if(i.unit in listOf("g","ml")) 100.0 else 1.0);query=""}
                }
            }
            Note("Количество — на все порции рецепта.")
        }
        Panel {
            Text("Шаги",style=MaterialTheme.typography.titleMedium)
            steps.forEachIndexed {index,text -> Row(verticalAlignment=Alignment.CenterVertically) {
                OutlinedTextField(text,{steps[index]=it.take(500)},label={Text("Шаг ${index+1}")},modifier=Modifier.weight(1f))
                if(steps.size>1) TextButton(onClick={steps.removeAt(index)}) {Text("×")}
            }}
            TextButton(onClick={steps+=""}) {Text("+ Шаг")}
        }
        val valid=name.isNotBlank() && ingredients.isNotEmpty() && steps.any {it.isNotBlank()}
        Primary("Сохранить рецепт",valid) {
            val clean=steps.map {it.trim()}.filter {it.isNotEmpty()}
            val id=existing?.id ?: "u-"+(1..10).map {"abcdefghijklmnopqrstuvwxyz0123456789".random()}.joinToString("")
            val recipe=Recipe(id=id,name=name.trim(),meal=myKindMeal(kind),minutes=minutes,tags=if(kind=="soup") listOf("soup","mine") else listOf("mine"),
                ingredients=ingredients.toList(),spices=emptyList(),steps=clean,stepSeconds=clean.map {0},stepTips=clean.map {""},servings=servings)
            m.update(m.state.copy(myRecipes=m.state.myRecipes.filter {it.id!=id}+recipe));m.track(if(existing==null) "recipe_added" else "recipe_edited",kind)
            m.open("recipes")
        }
        if(!valid) Note("Нужны название, хотя бы один продукт и один шаг.")
        if(existing!=null) TextButton(onClick={confirmDelete=true}) {Text("Удалить рецепт",color=MaterialTheme.colorScheme.error)}
    }
    if(confirmDelete && existing!=null) AlertDialog(onDismissRequest={confirmDelete=false},title={Text("Удалить «${existing.name}»?")},text={Text("Рецепт пропадёт из списка и из меню.")},
        confirmButton={TextButton(onClick={confirmDelete=false;m.update(m.state.copy(myRecipes=m.state.myRecipes.filter {it.id!=existing.id}));m.open("recipes")}) {Text("Удалить")}},
        dismissButton={TextButton(onClick={confirmDelete=false}) {Text("Отмена")}})
}
private fun unitLabel(i: Ingredient)=when(i.unit) {"g" -> "г";"ml" -> "мл";else -> i.unit}
