@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package familymenu

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.ktor.http.encodeURLParameter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.toLocalDateTime
import kotlin.math.max
import kotlin.math.roundToInt

fun premiumNote(s: AppState) = when(s.premiumState()) {
    "soon" -> "откроется через ${max(1,7-s.dayNumber())} ${plural(max(1,7-s.dayNumber()),"день","дня","дней")}, первая неделя бесплатно"
    "trial" -> "бесплатно ещё ${14-s.dayNumber()} ${plural(14-s.dayNumber(),"день","дня","дней")}"
    "expired" -> "299 ₽ в месяц"
    else -> "подключено"
}
private fun mealName(meal: String)=mealLabels[meal].orEmpty()
private fun servingsText(n: Int)="$n ${plural(n,"порция","порции","порций")}"

// ---------- Home ----------
@Composable internal fun HomeScreen(m: AppModel) {
    val s=m.state;val plan=s.plan;val name=s.profile.members.firstOrNull()?.name.orEmpty()
    val hour=Clock.System.now().toLocalDateTime(kotlinx.datetime.TimeZone.currentSystemDefault()).hour
    val greeting=when {hour<5 -> "Доброй ночи";hour<12 -> "Доброе утро";hour<18 -> "Добрый день";else -> "Добрый вечер"}
    val rows=shoppingRows(m);val left=rows.filter {!it.covered && it.item.ingredient.id !in s.bought}
    Page {
        Heading(dateLabel(s.today().toString()),greeting+if(name.isNotBlank()) ", $name" else "")
        ScenarioCard("Что приготовить из того, что есть?",if(m.have().isEmpty()) "Отметьте продукты — подберём основное и гарнир, суп или целое блюдо" else "Дома ${m.have().size} ${plural(m.have().size,"продукт","продукта","продуктов")} — подберём основное и гарнир") {m.open("cook")}
        ScenarioCard("Меню на неделю",if(plan==null) "Составим за минуту по профилю семьи" else "${dateLabel(plan.days.first().date).substringAfter(", ")} — ${dateLabel(plan.days.last().date).substringAfter(", ")} · ${if(plan.approved) "утверждено" else "черновик, нужно утвердить"}") {
            if(plan==null) {m.weekFromApp=true;m.onboardingStep=6;m.update(m.state.copy(stage="quiz"))} else m.open("menu")
        }
        if(plan!=null) {
            val index=plan.days.indexOfFirst {it.date==s.today().toString()}
            if(index<0) Panel {Text("Неделя закончилась",style=MaterialTheme.typography.titleMedium);Note("Составим новое меню с теми же настройками и учётом ваших оценок.");Primary("Составить новое меню") {m.generate()}}
            else {
                Row(verticalAlignment=Alignment.CenterVertically) {Text("Сегодня по меню",Modifier.weight(1f),style=MaterialTheme.typography.titleMedium);TextButton(onClick={m.open("menu")}) {Text("Вся неделя")}}
                plan.days[index].slots.forEachIndexed {si,slot -> MealCard(m,index,si,slot,true)}
                if(s.kcalVisible()) CaloriesPanel(m,index)
            }
        }
        if(rows.isNotEmpty()) ScenarioCard("Покупки",if(left.isEmpty()) "Всё куплено" else "Осталось купить ${left.size} ${plural(left.size,"продукт","продукта","продуктов")}${if(s.premiumOn()) " · ≈${money(left.sumOf {it.cost})}" else ""}") {m.open("shop")}
        if(!s.premiumOn()) Panel(accent=Amber) {
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalAlignment=Alignment.CenterVertically) {AppIcon("lock",Amber);Text("Бюджет и калории",style=MaterialTheme.typography.titleMedium);Badge("Premium",true)}
            Note(if(s.premiumState()=="soon") "Откроются через ${max(1,7-s.dayNumber())} ${plural(max(1,7-s.dayNumber()),"день","дня","дней")}: первая неделя бесплатно, дальше 299 ₽ в месяц." else "Пробная неделя Premium закончилась — 299 ₽ в месяц.")
            TextButton(onClick={m.open("sub")}) {Text("Что входит")}
        }
        Note("Каталог: ${m.catalog.recipes.size} рецептов")
    }
}
@Composable private fun CaloriesPanel(m: AppModel,index: Int) {
    val day=m.state.plan!!.days[index]
    var memberIndex by remember {mutableStateOf(0)}
    var foodText by remember {mutableStateOf("")};var foodError by remember {mutableStateOf<String?>(null)}
    val adults=m.state.profile.members.withIndex().filter {!it.value.child}
    if(adults.isEmpty()) return
    val (realIndex,member)=adults.getOrElse(memberIndex) {adults.first()}
    val key="${day.date}:$realIndex";val extra=m.state.extra[key].orEmpty()
    val eaten=day.slots.mapIndexed {i,s -> if(m.eatKey(index,i) in m.state.eaten) m.catalog.byRecipe[s.recipeId]?.let {m.catalog.nutrition(it)[0]} ?: 0.0 else 0.0}.sum()*member.portionFactor()+extra.sumOf {it.calories}
    val planned=day.slots.sumOf {s -> m.catalog.byRecipe[s.recipeId]?.let {m.catalog.nutrition(it)[0]} ?: 0.0}*member.portionFactor()
    Panel {
        Text("Калории сегодня",style=MaterialTheme.typography.titleMedium)
        FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {adults.forEachIndexed {i,v -> Choice(v.value.name.ifBlank {"Вы"},i==memberIndex) {memberIndex=i}}}
        Text("${eaten.roundToInt()} / ${member.calories()} ккал",style=MaterialTheme.typography.headlineSmall)
        LinearProgressIndicator(progress={(eaten/member.calories()).toFloat().coerceIn(0f,1f)},modifier=Modifier.fillMaxWidth())
        Note("В меню ≈${planned.roundToInt()} ккал · порция ×${member.portionFactor()}. Отмечайте «Съели» у блюд.")
        OutlinedTextField(foodText,{foodText=it;foodError=null},label={Text("Съели ещё: например, 1 банан")},modifier=Modifier.fillMaxWidth(),singleLine=true)
        TextButton(onClick={val kcal=m.catalog.parseFood(foodText);if(kcal==null) foodError="Не узнали продукт. Укажите количество ккал числом." else {m.update(m.state.copy(extra=m.state.extra+(key to (extra+ExtraFood(foodText,kcal)))));foodText=""}}) {Text("Добавить")}
        foodError?.let {Text(it,color=MaterialTheme.colorScheme.error)}
        extra.forEachIndexed {i,f -> Row(verticalAlignment=Alignment.CenterVertically) {Text("${f.label} · ${f.calories} ккал",Modifier.weight(1f));TextButton(onClick={m.update(m.state.copy(extra=m.state.extra+(key to extra.filterIndexed {j,_ -> i!=j})))}) {Text("×")}}}
    }
}

// ---------- Cook from what you have ----------
private val pantryGroups=listOf(
    "Мясо и птица" to listOf("chicken_fillet","chicken_thigh","minced_turkey","minced_mix","beef","pork","turkey","chicken_liver"),
    "Рыба и морепродукты" to listOf("fish_white","cod","salmon","shrimp","squid","tuna"),
    "Крупы и макароны" to listOf("buckwheat","rice","pasta","bulgur","barley","quinoa","lentils","noodles","oats"),
    "Овощи" to listOf("potato","onion","carrot","cabbage","tomato","cucumber","zucchini","bell_pepper","broccoli","cauliflower","garlic","greens","mushrooms"),
    "Молочное и яйца" to listOf("eggs","milk","sour_cream","cheese","butter","cream","kefir","cottage"),
    "Другое" to listOf("tomato_paste","canned_tomatoes","chickpeas","beans","tofu","flour","bread","lemon"))
private data class Ranked(val recipe: Recipe,val missing: Int,val hits: Int)
private fun rank(list: List<Recipe>,have: Set<String>)=list.map {r -> Ranked(r,missingIngredients(r,have).size,r.ingredients.count {it.id in have && it.id !in pantryStaples})}
    .sortedWith(compareBy<Ranked>({it.missing},{-it.hits},{it.recipe.minutes}))

@Composable internal fun CookScreen(m: AppModel,scope: CoroutineScope) {
    var mode by remember {mutableStateOf("pair")}
    var more by remember {mutableStateOf(false)}
    val have=m.have()
    Page {
        Panel {
            Row(verticalAlignment=Alignment.CenterVertically) {Text("Что есть дома",Modifier.weight(1f),style=MaterialTheme.typography.titleMedium);TextButton(onClick={m.pantryPicker=true}) {Text(if(have.isEmpty()) "+ Отметить" else "Изменить")}}
            if(m.inventory==null && m.inventoryBusy) LinearProgressIndicator(Modifier.fillMaxWidth())
            val items=m.inventory?.items.orEmpty()
            if(items.isEmpty()) Note("Пока пусто. Отметьте, что лежит в холодильнике и шкафу, — подберём блюда, где докупать меньше всего.")
            else FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {items.forEach {item -> Choice("${item.name} ×",true) {m.togglePantry(scope,item.ingredientId)}}}
            OutlinedButton(onClick={m.scannerProducts=emptyList();m.scannerPhotos=emptyList();m.scanningFridge=true},enabled=m.inventory!=null && !m.inventoryBusy,modifier=Modifier.fillMaxWidth()) {Text("Сфотографировать холодильник")}
            m.inventoryError?.let {Note(it)}
            Note("Соль, специи, масло и сахар считаем, что есть.")
        }
        Row(verticalAlignment=Alignment.CenterVertically) {
            Text("Готовим на",Modifier.weight(1f),style=MaterialTheme.typography.titleMedium)
            TextButton(onClick={m.nowServings=max(1,m.portionsNow()-1)}) {Text("−")}
            Text(servingsText(m.portionsNow()))
            TextButton(onClick={m.nowServings=minOf(12,m.portionsNow()+1)}) {Text("+")}
        }
        FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {listOf("pair" to "Основное + гарнир","soup" to "Супы","dish" to "Целые блюда").forEach {(k,l) -> Choice(l,mode==k) {mode=k;more=false}}}
        val allowed={r: Recipe -> m.engine.allowed(r,m.state)}
        if(mode=="pair") {
            val mains=rank(m.catalog.mains().filter(allowed),have)
            Text("1. Основное",style=MaterialTheme.typography.titleMedium);Note("Мясо, рыба или растительное")
            if(mains.isEmpty()) Note("С вашими ограничениями основных блюд не нашлось — посмотрите «Целые блюда».")
            (if(more) mains else mains.take(6)).forEach {x -> PickRow(x,selected=x.recipe.id==m.nowMain) {m.nowMain=x.recipe.id}}
            if(mains.size>6) TextButton(onClick={more=!more}) {Text(if(more) "Свернуть" else "Показать ещё ${mains.size-6}")}
            m.nowMain?.let {id -> m.catalog.byRecipe[id]}?.let {main ->
                Text("2. Гарнир",style=MaterialTheme.typography.titleMedium);Note("К блюду «${main.name}»")
                val pairs=main.pairs()
                rank(m.catalog.sides().filter(allowed),have).sortedWith(compareBy<Ranked>({it.missing},{pairs.indexOf(it.recipe.id).let {i -> if(i<0) 99 else i}})).forEach {x ->
                    PickRow(x,note=if(x.recipe.id in pairs) "хорошо сочетается" else null) {m.track("now_selected","${main.id}+${x.recipe.id}");m.nowRecipe=combo(main,x.recipe)}
                }
                OutlinedButton(onClick={m.track("now_selected",main.id);m.nowRecipe=main},modifier=Modifier.fillMaxWidth()) {Text("Без гарнира")}
            }
        } else {
            val list=rank(m.catalog.recipes.filter {it.meal=="m" && allowed(it) && (("soup" in it.tags)==(mode=="soup"))},have)
            (if(more) list else list.take(10)).forEach {x -> PickRow(x) {m.track("now_selected",x.recipe.id);m.nowRecipe=x.recipe}}
            if(list.size>10) TextButton(onClick={more=!more}) {Text(if(more) "Свернуть" else "Показать ещё ${list.size-10}")}
        }
    }
}
@Composable private fun PickRow(x: Ranked,selected: Boolean=false,note: String?=null,onClick:()->Unit) {
    Panel(Modifier.clickable(role=androidx.compose.ui.semantics.Role.Button,onClick=onClick),accent=if(selected) Green else null) {
        Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            Picture(x.recipe.imageUrl,Modifier.size(width=72.dp,height=52.dp))
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                Text(x.recipe.name,fontFamily=DishFont.current,fontWeight=FontWeight.SemiBold)
                Row(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalAlignment=Alignment.CenterVertically) {
                    Note("${x.recipe.minutes} мин");if(x.missing==0) Badge("всё есть") else Badge("докупить ${x.missing}",true);note?.let {Note(it)}
                }
            }
        }
    }
}
@Composable internal fun PantryPicker(m: AppModel,scope: CoroutineScope) {
    var query by remember {mutableStateOf("")}
    val have=m.have()
    Surface(Modifier.widthIn(max=480.dp).fillMaxSize(),shape=RoundedCornerShape(20.dp)) {Page {
        Row(verticalAlignment=Alignment.CenterVertically) {Text("Что есть дома",Modifier.weight(1f),style=MaterialTheme.typography.titleMedium);TextButton(onClick={m.pantryPicker=false}) {Text("Готово")}}
        Note("Отметьте продукты. Количество поправите потом, а фото холодильника распознает всё сразу.")
        if(m.inventoryBusy) LinearProgressIndicator(Modifier.fillMaxWidth())
        m.inventoryError?.let {Note(it)}
        OutlinedTextField(query,{query=it.take(40)},label={Text("Найти продукт: например, фарш")},singleLine=true,modifier=Modifier.fillMaxWidth())
        if(query.isNotBlank()) FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
            m.catalog.ingredients.filter {it.name.contains(query.trim(),true)}.take(10).forEach {i -> Choice(i.name,i.id in have) {m.togglePantry(scope,i.id)}}
        }
        pantryGroups.forEach {(title,ids) ->
            Text(title,style=MaterialTheme.typography.titleMedium)
            FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {ids.mapNotNull {m.catalog.byIngredient[it]}.forEach {i -> Choice(i.name,i.id in have) {m.togglePantry(scope,i.id)}}}
        }
        Primary("Готово · ${have.size} ${plural(have.size,"продукт","продукта","продуктов")}") {m.pantryPicker=false}
    }}
}
@Composable internal fun NowRecipeScreen(m: AppModel,recipe: Recipe) {
    val servings=m.portionsNow();val have=m.have();val missing=missingIngredients(recipe,have)
    val factor=servings.toDouble()/recipe.servings
    val cost=missing.sumOf {q -> price(m.catalog.byIngredient.getValue(q.id),m.state.store,m.state.profile.city)*q.quantity*factor}
    val inList=missing.isNotEmpty() && missing.all {it.id in m.state.extraBuy}
    Surface(Modifier.widthIn(max=480.dp).fillMaxSize(),shape=RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {Text("Из того, что есть · ${servingsText(servings)}",Modifier.weight(1f),style=MaterialTheme.typography.labelMedium,color=Muted);TextButton(onClick={m.nowRecipe=null}) {Text("Закрыть")}}
            Picture(recipe.imageUrl,Modifier.fillMaxWidth().aspectRatio(400f/260))
            Text(recipe.name,fontFamily=DishFont.current,style=MaterialTheme.typography.headlineSmall)
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalAlignment=Alignment.CenterVertically) {
                Note("${recipe.minutes} мин");if(m.state.kcalVisible()) Note("${m.catalog.nutrition(recipe)[0].roundToInt()} ккал на порцию")
                if(missing.isEmpty()) Badge("всё есть") else Badge("докупить ${missing.size}",true)
            }
            Panel {
                Text("Продукты",style=MaterialTheme.typography.titleMedium)
                recipe.ingredients.forEach {q -> val i=m.catalog.byIngredient.getValue(q.id);val ok=q.id in have || q.id in pantryStaples
                    Row {Text(if(ok) "✓ " else "+ ",color=if(ok) Green else Amber);Text(i.name,Modifier.weight(1f));Text(quantity(i,q.quantity*factor)+if(ok) "" else " · докупить",color=if(ok) MaterialTheme.colorScheme.onSurface else Amber)}
                }
                if(recipe.spices.isNotEmpty()) Note("По вкусу: ${recipe.spices.joinToString()}")
            }
            if(missing.isNotEmpty()) {
                Note("Докупить ${missing.size} ${plural(missing.size,"продукт","продукта","продуктов")}${if(m.state.premiumOn()) " — примерно на ${money(cost)}" else ""}.")
                Secondary(if(inList) "Уже в списке покупок ✓" else "Добавить недостающее в «Покупки»",!inList) {
                    m.update(m.state.copy(extraBuy=m.state.extraBuy+missing.associate {it.id to ExtraBuy(it.quantity*factor,recipe.name)}));m.track("now_added_to_list",recipe.id)
                }
            }
            Primary("Готовить по шагам") {m.cooking=CookTarget(recipe,servings);m.nowRecipe=null;m.track("now_cook_started",recipe.id)}
            if(recipe.meal=="c" || recipe.meal=="p") TextButton(onClick={m.nowRecipe=null}) {Text("Выбрать другой гарнир")}
        }
    }
}

// ---------- Cooking (menu slot or "from what you have") ----------
@Composable internal fun CookingScreen(m: AppModel,scope: CoroutineScope,target: CookTarget,now: Long) {
    val recipe=target.recipe;val slot=target.slot?.let {m.state.plan?.days?.getOrNull(it.first)?.slots?.getOrNull(it.second)}
    var cooking by remember(recipe.id) {mutableStateOf(target.slot==null)}
    var step by remember(recipe.id) {mutableStateOf(0)}
    var finished by remember(recipe.id) {mutableStateOf(false)}
    var usedUp by remember(recipe.id) {mutableStateOf(false)}
    fun close() {m.selectedSlot=null;m.cooking=null}
    val factor=target.servings.toDouble()/recipe.servings
    Surface(Modifier.widthIn(max=480.dp).fillMaxSize(),shape=RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {Text(if(finished) "Готово" else if(cooking) "Шаг ${step+1} из ${recipe.steps.size}" else "Рецепт",Modifier.weight(1f),style=MaterialTheme.typography.titleMedium);TextButton(onClick={close()}) {Text("Закрыть")}}
            Picture(if(cooking && !finished) recipe.stepImageUrls.getOrNull(step) else recipe.imageUrl,Modifier.fillMaxWidth().aspectRatio(400f/260))
            Text(recipe.name,fontFamily=DishFont.current,style=MaterialTheme.typography.headlineSmall)
            val nutrition=m.catalog.nutrition(recipe)
            Note("${recipe.minutes} мин · ${servingsText(target.servings)}"+if(m.state.kcalVisible()) " · ${nutrition[0].roundToInt()} ккал на порцию" else "")
            if(m.state.kcalVisible() && !cooking) Note("Б ${nutrition[1].roundToInt()} · Ж ${nutrition[2].roundToInt()} · У ${nutrition[3].roundToInt()}")
            if(finished) {
                Text("Приятного аппетита!",style=MaterialTheme.typography.titleMedium)
                if(target.slot==null) {
                    Note("Уберём из «Что есть дома» то, что ушло в блюдо.")
                    Primary(if(usedUp) "Списали ✓" else "Списать использованное",!usedUp && m.inventory!=null) {m.useUp(scope,recipe,target.servings);usedUp=true}
                }
                FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    Choice("Понравилось",recipe.id in m.state.liked) {m.update(m.state.copy(liked=m.state.liked.toggle(recipe.id),disliked=m.state.disliked-recipe.id))}
                    Choice("Не понравилось",recipe.id in m.state.disliked) {m.update(m.state.copy(disliked=m.state.disliked.toggle(recipe.id),liked=m.state.liked-recipe.id))}
                }
                Secondary("Закрыть") {close()}
            } else if(cooking) {
                Text(recipe.steps[step],style=MaterialTheme.typography.titleMedium)
                recipe.stepTips.getOrNull(step)?.takeIf {it.isNotBlank()}?.let {Note(it)}
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
                    Button(onClick={if(step<recipe.steps.lastIndex) step++ else {
                        target.slot?.let {(d,i) -> m.changeSlot(d,i) {it.copy(cooked=true)};m.track("dish_cooked",recipe.id)} ?: m.track("now_cooked",recipe.id)
                        finished=true
                    }}) {Text(if(step<recipe.steps.lastIndex) "Дальше" else "Готово ✓")}
                }
                TextButton(onClick={cooking=false}) {Text("Все ингредиенты и шаги")}
            } else {
                Text("Ингредиенты",style=MaterialTheme.typography.titleMedium)
                recipe.ingredients.forEach {q -> val i=m.catalog.byIngredient.getValue(q.id);Text("${i.name} — ${quantity(i,q.quantity*factor)}")}
                if(recipe.spices.isNotEmpty()) Note("По вкусу: ${recipe.spices.joinToString()}")
                val allergens=m.catalog.allergens(recipe).mapNotNull {allergies[it]}
                if(allergens.isNotEmpty()) Note("По рецепту содержит: ${allergens.joinToString()}. Состав конкретных продуктов проверяйте по упаковке.")
                Primary("Готовить по шагам с таймером") {cooking=true;m.track("cook_started",recipe.id)}
                recipe.steps.forEachIndexed {i,text -> Text("${i+1}. $text")}
                if(target.slot!=null && slot!=null) {
                    val position=target.slot
                    FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                        Choice("Понравилось",recipe.id in m.state.liked) {m.update(m.state.copy(liked=m.state.liked.toggle(recipe.id),disliked=m.state.disliked-recipe.id))}
                        Choice("Не понравилось",recipe.id in m.state.disliked) {m.update(m.state.copy(disliked=m.state.disliked.toggle(recipe.id),liked=m.state.liked-recipe.id))}
                    }
                    TextButton(onClick={close();m.replacement=position}) {Text("Заменить блюдо")}
                    TextButton(onClick={m.update(m.state.copy(blocked=m.state.blocked+recipe.id));close();m.replacement=position}) {Text("Больше не предлагать")}
                    Primary(if(slot.cooked) "Приготовлено ✓" else "Отметить: приготовлено") {m.changeSlot(position.first,position.second) {it.copy(cooked=!it.cooked)};close()}
                }
            }
        }
    }
}
@Composable internal fun ReplacementScreen(m: AppModel,position: Pair<Int,Int>) {
    val slot=m.state.plan?.days?.getOrNull(position.first)?.slots?.getOrNull(position.second) ?: return
    val choices=m.engine.pool(slot.meal,m.state).sortedByDescending {m.engine.score(it,m.state)}
    Surface(Modifier.widthIn(max=480.dp).fillMaxSize(),shape=RoundedCornerShape(18.dp)) {Page {
        Heading("Замена блюда",mealName(slot.meal))
        TextButton(onClick={m.replacement=null}) {Text("Отмена")}
        if(choices.isEmpty()) Note("Подходящих блюд нет. Ослабьте ограничения в профиле.")
        choices.forEach {r -> Row(Modifier.fillMaxWidth().clickable {m.replace(position.first,position.second,r)}.padding(vertical=6.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            Picture(r.imageUrl,Modifier.size(60.dp));Column(Modifier.weight(1f)) {Text(r.name,fontFamily=DishFont.current);Note("${r.minutes} мин"+(if(m.state.kcalVisible()) " · ${m.catalog.nutrition(r)[0].roundToInt()} ккал" else "")+(if(m.state.premiumOn()) " · ≈${money(m.catalog.cost(r,m.state.store,m.state.profile.city))}" else ""))}
        }}
    }}
}

// ---------- Week menu ----------
@Composable internal fun MenuScreen(m: AppModel) {
    val plan=m.state.plan
    if(plan==null) {Page {
        Heading("Меню на неделю","Меню ещё нет")
        Note("Составим по профилю семьи: завтраки, супы на обед, второе на ужин — и сразу список покупок.")
        Primary("Составить меню") {m.weekFromApp=true;m.onboardingStep=6;m.update(m.state.copy(stage="quiz"))}
        Secondary("Или приготовить из того, что есть") {m.open("cook")}
    };return}
    val rows=shoppingRows(m);val cost=rows.filter {!it.covered}.sumOf {it.cost}
    Page {
        Heading("Меню на неделю","${dateLabel(plan.days.first().date).substringAfter(", ")} — ${dateLabel(plan.days.last().date).substringAfter(", ")}")
        Text(if(plan.approved) "Утверждено" else "Черновик — замените лишнее и утвердите",color=if(plan.approved) MaterialTheme.colorScheme.primary else Amber)
        Panel {
            if(m.state.premiumOn() && m.state.profile.budgetSet) {
                Text("Оценка покупок",style=MaterialTheme.typography.titleMedium)
                Text("≈${money(cost)} / ${m.state.profile.budget} ₽")
                LinearProgressIndicator(progress={(cost/m.state.profile.budget).toFloat().coerceIn(0f,1f)},modifier=Modifier.fillMaxWidth(),color=if(cost>m.state.profile.budget) Amber else MaterialTheme.colorScheme.primary)
            } else {Text("Покупки на неделю: ${rows.count {!it.covered}} ${plural(rows.count {!it.covered},"продукт","продукта","продуктов")}",style=MaterialTheme.typography.titleMedium)}
            Note(if(m.state.premiumOn()) "Оценка по ценам магазина на 20–21 октября, без учёта фасовок и акций." else "Лимит бюджета и сравнение магазинов — в Premium.")
        }
        if(plan.approved) Secondary("Отправить меню семье") {m.share=true;m.track("share_opened")}
        m.swapSource?.let {Panel {Note("Выберите другое блюдо кнопкой «Поменять сюда».");TextButton(onClick={m.swapSource=null}) {Text("Отмена")}}}
        plan.days.forEachIndexed {di,day ->
            Panel(accent=if(day.date==m.state.today().toString()) Green else null) {
                Text(dateLabel(day.date),style=MaterialTheme.typography.titleMedium)
                if(m.state.kcalVisible()) Note("≈${day.slots.sumOf {s -> m.catalog.byRecipe[s.recipeId]?.let {m.catalog.nutrition(it)[0]} ?: 0.0}.roundToInt()} ккал на стандартную порцию")
                day.slots.forEachIndexed {si,s -> MealCard(m,di,si,s,false)}
            }
        }
        if(!plan.approved) Primary("Утвердить меню и собрать список") {m.update(m.state.copy(plan=plan.copy(approved=true)));m.track("menu_approved");m.open("shop")}
        Secondary("Пересобрать всю неделю") {m.generate()}
    }
}
@Composable internal fun MealCard(m: AppModel,di: Int,si: Int,slot: Slot,compact: Boolean) {
    val r=m.catalog.byRecipe[slot.recipeId]
    if(r==null) {Note("${mealName(slot.meal)}: не нашли подходящее блюдо. Ослабьте ограничения в профиле.");return}
    Surface(shape=RoundedCornerShape(12.dp),color=if(slot.cooked) Soft else MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(4.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth().clickable {m.selectedSlot=m.recipePosition(di,si)},verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                Picture(r.imageUrl,Modifier.size(64.dp))
                Column(Modifier.weight(1f)) {
                    Note(mealName(slot.meal))
                    Text(r.name,fontFamily=DishFont.current,fontWeight=FontWeight.SemiBold)
                    Note("${r.minutes} мин"+(if(m.state.kcalVisible()) " · ${m.catalog.nutrition(r)[0].roundToInt()} ккал" else "")+" · ${slot.servings} порц.")
                    if(slot.leftover) Note("Остатки со вчера")
                    if(slot.cooked) Text("Приготовлено",color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.labelSmall)
                }
                if(!compact) TextButton(onClick={m.replacement=m.recipePosition(di,si)}) {AppIcon("replace",MaterialTheme.colorScheme.primary)}
            }
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                if(compact) {
                    TextButton(onClick={m.selectedSlot=m.recipePosition(di,si)}) {Text("Готовить")}
                    FilterChip(selected=m.eatKey(di,si) in m.state.eaten,onClick={m.toggleEat(di,si)},label={Text(if(m.eatKey(di,si) in m.state.eaten) "Съели ✓" else "Съели")})
                } else if(!slot.leftover && slot.servings<=m.state.profile.portions()) {
                    TextButton(onClick={if(m.swapSource==null) m.swapSource=di to si else m.swap(di to si)}) {Text(if(m.swapSource==null) "Переместить" else "Поменять сюда",style=MaterialTheme.typography.labelSmall)}
                }
            }
        }
    }
}

// ---------- Shopping ----------
internal data class ShoppingRow(val item: ShoppingItem,val toBuy: Double,val stock: Double,val covered: Boolean,val cost: Double)
internal fun shoppingRows(m: AppModel): List<ShoppingRow> = m.engine.shopping(m.state).map {item ->
    val stock=m.stock(item.ingredient.id);val i=item.ingredient
    val need=(item.amount-stock).coerceAtLeast(0.0);val buy=if(i.unit in listOf("g","ml")) need else kotlin.math.ceil(need-.001)
    ShoppingRow(item,buy,stock,buy<=0.0001,buy*price(i,m.state.store,m.state.profile.city))
}
private fun storeUrl(i: Ingredient,store: String)=if(store=="lavka" && i.lavkaPath!=null) "https://lavka.yandex.ru${i.lavkaPath}" else if(store=="lavka") "https://lavka.yandex.ru/search?text=${i.name.encodeURLParameter()}" else "https://vkusvill.ru/search/?q=${i.name.encodeURLParameter()}"
@Composable internal fun ShoppingScreen(m: AppModel) {
    val clipboard=LocalClipboardManager.current;val uri=LocalUriHandler.current;val scope=rememberCoroutineScope()
    val rows=shoppingRows(m);val need=rows.filter {!it.covered};val left=need.filter {it.item.ingredient.id !in m.state.bought}
    if(rows.isEmpty()) {Page {
        Heading("Покупки","Список пуст")
        Note("Он соберётся сам из меню на неделю или из блюда, которое вы выберете в «Готовить».")
        Primary("Меню на неделю") {m.open("menu")}
        Secondary("Приготовить из того, что есть") {m.open("cook")}
    };return}
    val premium=m.state.premiumOn()
    Page {
        Heading("Покупки","Список")
        if(m.state.plan?.approved==false) Panel {Note("Меню ещё не утверждено: список может измениться после замен.");TextButton(onClick={m.update(m.state.copy(plan=m.state.plan?.copy(approved=true)));m.track("menu_approved")}) {Text("Утвердить меню")}}
        Panel {
            Text("Осталось купить: ${left.size}"+if(premium) " · ≈${money(left.sumOf {it.cost})}" else "",style=MaterialTheme.typography.titleMedium)
            FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {listOf("vv" to "ВкусВилл","lavka" to "Яндекс Лавка").forEach {(key,label) -> Choice(label,m.state.store==key) {m.update(m.state.copy(store=key))}}}
            if(left.isNotEmpty()) Primary("Собрать корзину по шагам") {m.cart=CartSession(left.map {it.item.ingredient.id});m.track("cart_started")}
            TextButton(onClick={clipboard.setText(AnnotatedString(left.joinToString("\n") {"${it.item.ingredient.name} — ${quantity(it.item.ingredient,it.toBuy)}"}));m.track("list_copied")}) {Text("Копировать список")}
            Note("Одинаковые продукты из разных блюд объединены, то, что есть дома, вычтено. Цены на 20–21 октября."+if(premium) "" else " Сравнение магазинов — в Premium.")
            if(premium) TextButton(onClick={m.open("promo")}) {Text("Акции и сравнение магазинов")}
        }
        need.groupBy {it.item.ingredient.category}.forEach {(category,products) ->
            Text(category,style=MaterialTheme.typography.titleMedium)
            Panel {products.forEach {row ->
                val i=row.item.ingredient
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Checkbox(checked=i.id in m.state.bought,onCheckedChange={m.update(m.state.copy(bought=m.state.bought.toggle(i.id)));if(it) m.track("item_bought")})
                    Column(Modifier.weight(1f)) {
                        Text(i.name);Note(quantity(i,row.toBuy)+if(row.stock>0) " · дома ${quantity(i,row.stock)}" else "")
                        if(premium) Note("ВВ ${money(row.toBuy*price(i,"vv",m.state.profile.city))} · Лавка ${money(row.toBuy*price(i,"lavka",m.state.profile.city))}")
                        Note("Для: ${row.item.dishes.joinToString()}")
                    }
                    TextButton(onClick={m.setStock(scope,i.id,row.item.amount)}) {Text("есть")}
                    TextButton(onClick={uri.openUri(storeUrl(i,m.state.store))}) {AppIcon("link",MaterialTheme.colorScheme.primary)}
                }
            }}
        }
        val covered=rows.filter {it.covered}
        if(covered.isNotEmpty()) {Text("Уже есть дома",style=MaterialTheme.typography.titleMedium);Panel {covered.forEach {Note("${it.item.ingredient.name} — хватает запаса")}}}
        if(m.state.extraBuy.isNotEmpty()) TextButton(onClick={m.update(m.state.copy(extraBuy=emptyMap()))}) {Text("Убрать докупки из «Готовить»")}
        val spices=m.state.plan?.days?.flatMap {it.slots}?.flatMap {m.catalog.byRecipe[it.recipeId]?.spices.orEmpty()}?.distinct().orEmpty()
        if(spices.isNotEmpty()) Panel {Text("Специи — проверьте, есть ли дома");Note(spices.joinToString())}
    }
}
@Composable internal fun CartScreen(m: AppModel,session: CartSession,scope: CoroutineScope) {
    val uri=LocalUriHandler.current
    val store=m.state.store;val storeName=if(store=="lavka") "Лавке" else "ВкусВилле"
    val rows=shoppingRows(m).associateBy {it.item.ingredient.id}
    val items=session.items.mapNotNull {rows[it]}
    Surface(Modifier.widthIn(max=480.dp).fillMaxSize(),shape=RoundedCornerShape(20.dp)) {Page {
        Row(verticalAlignment=Alignment.CenterVertically) {Text("Корзина в $storeName",Modifier.weight(1f),style=MaterialTheme.typography.titleMedium);TextButton(onClick={m.cart=null}) {Text("Закрыть")}}
        LinearProgressIndicator(progress={if(items.isEmpty()) 1f else session.index.coerceAtMost(items.size)/items.size.toFloat()},modifier=Modifier.fillMaxWidth())
        val row=items.getOrNull(session.index)
        if(row==null) {
            Heading("Готово","Корзина собрана")
            Note("Положили ${session.added} из ${items.size}. ${if(session.home>0) "${session.home} отметили «есть дома». " else ""}Время доставки и оплату выберите в приложении магазина.")
            Primary("Открыть корзину в $storeName") {uri.openUri(if(store=="lavka") "https://lavka.yandex.ru/" else "https://vkusvill.ru/cart/")}
            Secondary("Закрыть") {m.cart=null;m.track("cart_done","${session.added}/${items.size}")}
        } else {
            val i=row.item.ingredient
            Note("Продукт ${session.index+1} из ${items.size}")
            Text(i.name,style=MaterialTheme.typography.headlineSmall)
            Text(quantity(i,row.toBuy),style=MaterialTheme.typography.headlineSmall,color=MaterialTheme.colorScheme.primary)
            Note("Для: ${row.item.dishes.joinToString()}")
            if(m.state.premiumOn()) Note("≈${money(row.cost)}")
            Secondary("Найти в $storeName ↗") {uri.openUri(storeUrl(i,store))}
            Note("Откроется магазин. Положите продукт в корзину, вернитесь и нажмите «Положила».")
            Primary("Положила ✓") {m.update(m.state.copy(bought=m.state.bought+i.id));m.track("item_bought");m.cart=session.copy(index=session.index+1,added=session.added+1)}
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick={m.setStock(scope,i.id,row.item.amount);m.cart=session.copy(index=session.index+1,home=session.home+1)},Modifier.weight(1f)) {Text("Есть дома")}
                OutlinedButton(onClick={m.cart=session.copy(index=session.index+1)},Modifier.weight(1f)) {Text("Пропустить")}
            }
            if(session.index>0) TextButton(onClick={m.cart=session.copy(index=session.index-1)}) {Text("‹ Назад")}
        }
    }}
}

// ---------- Family ----------
internal fun shareText(m: AppModel): String {
    val plan=m.state.plan ?: return ""
    val lines=mutableListOf("Меню на неделю: ${dateLabel(plan.days.first().date).substringAfter(", ")} — ${dateLabel(plan.days.last().date).substringAfter(", ")}","")
    plan.days.forEach {day -> lines+="${dateLabel(day.date)}:";day.slots.forEach {s -> m.catalog.byRecipe[s.recipeId]?.let {r -> lines+="  ${mealName(s.meal)} — ${r.name}${if(s.leftover) " (остатки)" else ""}"}}}
    val left=shoppingRows(m).count {!it.covered && it.item.ingredient.id !in m.state.bought}
    lines+="";lines+="Купить: $left ${plural(left,"продукт","продукта","продуктов")}"
    return lines.joinToString("\n")
}
@Composable internal fun ShareScreen(m: AppModel) {
    val clipboard=LocalClipboardManager.current
    Surface(Modifier.widthIn(max=480.dp).fillMaxSize(),shape=RoundedCornerShape(20.dp)) {Page {
        Row(verticalAlignment=Alignment.CenterVertically) {Text("Меню для семьи",Modifier.weight(1f),style=MaterialTheme.typography.titleMedium);TextButton(onClick={m.share=false}) {Text("Закрыть")}}
        Note("Партнёр посмотрит, что сегодня на ужин, и докупит продукты по общему списку.")
        Panel {Text("Ссылкой",style=MaterialTheme.typography.titleMedium);Note("Откроется страница с меню и списком покупок, отметки «куплено» общие. Ссылки появятся вместе с семейным аккаунтом — пока можно посмотреть, как это будет выглядеть.")
            Secondary("Посмотреть, как увидит семья") {m.share=false;m.open("familyview");m.track("family_view_opened")}}
        Panel {Text("Текстом в мессенджер",style=MaterialTheme.typography.titleMedium);Note(shareText(m))
            Primary("Скопировать") {clipboard.setText(AnnotatedString(shareText(m)));m.track("share_text_copied")}}
    }}
}
@Composable internal fun FamilyViewScreen(m: AppModel) {
    var tab by remember {mutableStateOf("menu")}
    val plan=m.state.plan
    Page {
        Panel(accent=Amber) {Note("Так меню увидит семья по ссылке.");TextButton(onClick={m.back()}) {Text("‹ Вернуться в приложение")}}
        Heading("${m.state.profile.members.firstOrNull()?.name?.ifBlank {null} ?: "Ваша семья"} делится меню","Меню на неделю")
        FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {Choice("Меню",tab=="menu") {tab="menu"};Choice("Покупки",tab=="shop") {tab="shop"}}
        if(plan==null) Note("Меню ещё не составлено.")
        else if(tab=="menu") plan.days.forEach {day -> Panel {
            Text(dateLabel(day.date),style=MaterialTheme.typography.titleMedium)
            day.slots.forEach {s -> m.catalog.byRecipe[s.recipeId]?.let {r -> Row(horizontalArrangement=Arrangement.spacedBy(10.dp),verticalAlignment=Alignment.CenterVertically) {
                Picture(r.imageUrl,Modifier.size(48.dp));Column {Note(mealName(s.meal));Text(r.name,fontFamily=DishFont.current)}
            }}}
        }} else {
            Note("Отметьте, что купили, — у всех в семье список обновится.")
            shoppingRows(m).filter {!it.covered}.forEach {row -> Row(verticalAlignment=Alignment.CenterVertically) {
                Checkbox(checked=row.item.ingredient.id in m.state.bought,onCheckedChange={m.update(m.state.copy(bought=m.state.bought.toggle(row.item.ingredient.id)))})
                Text(row.item.ingredient.name,Modifier.weight(1f));Text(quantity(row.item.ingredient,row.toBuy))
            }}
        }
    }
}

// ---------- Profile ----------
@Composable internal fun ProfileHub(m: AppModel,scope: CoroutineScope) {
    val s=m.state;val p=s.profile
    var reset by remember {mutableStateOf(false)}
    Page {
        Panel {
            Text(p.members.firstOrNull()?.name?.ifBlank {null} ?: "Профиль",style=MaterialTheme.typography.titleMedium)
            Note(Account.current?.login?.let {"${it.display} · вход через ${if(it.via=="max") "MAX" else "Telegram"}"} ?: Account.current?.user?.email ?: "")
        }
        Panel {
            Text("НАСТРОЙКИ",style=MaterialTheme.typography.labelMedium,color=Muted)
            NavRow("Семья","${p.members.size} ${plural(p.members.size,"человек","человека","человек")} · рост, вес, активность") {m.open("family")}
            NavRow("Питание и ограничения","${diets[p.diet] ?: p.diet}"+(if(p.allergies.isNotEmpty()) " · аллергии: ${p.allergies.size}" else "")+(if(p.dislikes.isNotEmpty()) " · не едим: ${p.dislikes.size}" else "")) {m.open("food")}
            NavRow("Неделя и напоминания",p.meals.mapNotNull {mealLabels[it]?.lowercase()}.joinToString()+" · напоминания "+(if(p.reminder) "в ${p.reminderTime}" else "выключены")) {m.open("week")}
        }
        Panel(accent=if(s.premiumOn()) null else Amber) {
            Text("PREMIUM",style=MaterialTheme.typography.labelMedium,color=Muted)
            NavRow("Подписка",when(s.premiumState()) {"paid" -> "Подключена";"trial" -> "Пробная неделя: ${premiumNote(s)}";"soon" -> premiumNote(s).replaceFirstChar {it.uppercase()};else -> "Пробная неделя закончилась"}) {m.open("sub")}
            NavRow("Бюджет и цены",if(s.premiumOn()) "Лимит, акции ВкусВилла и Лавки, сравнение корзины" else premiumNote(s),locked=!s.premiumOn(),badge="Premium") {m.open(if(s.premiumOn()) "promo" else "sub")}
            NavRow("Калории и КБЖУ",if(s.premiumOn()) (if(p.kcalOn) "Включены" else "Выключены — включить") else premiumNote(s),locked=!s.premiumOn(),badge="Premium") {m.open(if(s.premiumOn()) "kcal" else "sub")}
        }
        if(s.plan?.approved==true) Panel {NavRow("Отправить меню семье","Ссылкой или текстом в мессенджер") {m.share=true;m.track("share_opened")}}
        Panel {
            Row(verticalAlignment=Alignment.CenterVertically) {Column(Modifier.weight(1f)) {Text("Подборка акций раз в неделю");Note("По умолчанию выключено")};Switch(p.promoOptIn,{m.profile(p.copy(promoOptIn=it))})}
            Text("Оформление",style=MaterialTheme.typography.titleMedium)
            FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {listOf("system" to "Системное","light" to "Светлое","dark" to "Тёмное").forEach {(key,label) -> Choice(label,s.theme==key) {m.update(s.copy(theme=key))}}}
        }
        Panel {
            Text("Для пилота",style=MaterialTheme.typography.titleMedium)
            Note("День ${s.dayNumber()+1} с начала. Перемотайте время, чтобы проверить, как открывается Premium.")
            FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick={m.update(s.copy(dayShift=s.dayShift+1))}) {Text("+1 день")}
                OutlinedButton(onClick={m.update(s.copy(dayShift=s.dayShift+7))}) {Text("+неделя")}
                OutlinedButton(onClick={m.update(s.copy(dayShift=0))},enabled=s.dayShift!=0) {Text("Сегодня")}
                OutlinedButton(onClick={m.open("metrics")}) {Text("Метрики")}
            }
        }
        Secondary("Выйти") {scope.launch {try {Account.logout()} catch(_: Exception) {} finally {m.resetAccount()}}}
        TextButton(onClick={reset=true}) {Text("Начать настройку заново")}
    }
    if(reset) AlertDialog(onDismissRequest={reset=false},title={Text("Начать заново?")},text={Text("Меню и настройки семьи будут заменены новыми. Запасы «Что есть дома» сохранятся.")},
        confirmButton={TextButton(onClick={m.update(AppState(stage="quiz",premiumStart=s.premiumStart,subscription=s.subscription,events=s.events));m.onboardingStep=0;m.page=null;m.timers.clear();reset=false}) {Text("Начать заново")}},
        dismissButton={TextButton(onClick={reset=false}) {Text("Отмена")}})
}
@Composable internal fun FamilyPage(m: AppModel) {Page {MembersEditor(m);Note("Норма калорий нужна для размера порций. Подробный подсчёт калорий — в Premium.")}}
@Composable internal fun FoodPage(m: AppModel) {Page {DietEditor(m);AllergiesEditor(m);DislikesEditor(m);GoalsEditor(m);TastesEditor(m)
    if(m.state.blocked.isNotEmpty()) Panel {Text("Скрытые блюда");m.state.blocked.forEach {id -> Row(verticalAlignment=Alignment.CenterVertically) {Text(m.catalog.byRecipe[id]?.name ?: id,Modifier.weight(1f));TextButton(onClick={m.update(m.state.copy(blocked=m.state.blocked-id))}) {Text("Вернуть")}}}}
}}
@Composable internal fun WeekPage(m: AppModel) {
    val p=m.state.profile
    Page {
        MealsEditor(m);WeekEditor(m)
        Panel {
            Row(verticalAlignment=Alignment.CenterVertically) {Text("Напоминание накануне",Modifier.weight(1f));Switch(p.reminder,{m.profile(p.copy(reminder=it))})}
            if(p.reminder) {
                FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {listOf("18:00","19:00","20:00","21:00","22:00").forEach {t -> Choice(t,p.reminderTime==t) {m.profile(p.copy(reminderTime=t))}}}
                Note("Пока напоминание показывается, когда приложение открыто. Сообщение от бота в Telegram или MAX появится позже.")
            }
        }
        Primary("Сохранить и пересобрать меню",p.meals.isNotEmpty()) {m.generate()}
    }
}
@Composable internal fun PremiumLock(m: AppModel,kind: String) {
    val (title,text)=if(kind=="kcal") "Калории и КБЖУ" to "Норма для каждого члена семьи, КБЖУ блюд и дневник «что съели»." else "Бюджет и цены" to "Лимит на неделю, акции ВкусВилла и Лавки, сравнение корзины: где дешевле."
    Page {Panel(accent=Amber) {
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalAlignment=Alignment.CenterVertically) {AppIcon("lock",Amber);Text(title,style=MaterialTheme.typography.titleMedium);Badge("Premium",true)}
        Note(text)
        Text(if(m.state.premiumState()=="soon") "Откроется через ${max(1,7-m.state.dayNumber())} ${plural(max(1,7-m.state.dayNumber()),"день","дня","дней")} — первая неделя Premium бесплатно." else "Пробная неделя Premium закончилась.")
        Primary(if(m.state.premiumState()=="soon") "Подробнее о Premium" else "Подключить за 299 ₽ в месяц") {m.open("sub")}
    }}
}
@Composable internal fun KcalPage(m: AppModel) {
    if(!m.state.premiumOn()) return PremiumLock(m,"kcal")
    val p=m.state.profile
    Page {
        Panel {
            Row(verticalAlignment=Alignment.CenterVertically) {Column(Modifier.weight(1f)) {Text("Считать калории",style=MaterialTheme.typography.titleMedium);Note("Нормы для взрослых, КБЖУ блюд, дневник «что съели». Для детей нормы не показываем.")}
                Switch(p.kcalOn,{m.profile(p.copy(kcalOn=it));m.track("kcal_toggle",it.toString())})}
            Note("Это ориентир, а не медицинская рекомендация. Если подсчёт калорий вызывает тревогу, оставьте его выключенным.")
        }
        if(p.kcalOn) Panel {
            Text("Нормы семьи",style=MaterialTheme.typography.titleMedium)
            p.members.filter {!it.child}.forEach {mem -> Row {Text(mem.name.ifBlank {"Вы"},Modifier.weight(1f));Text(if(mem.sex.isEmpty()) "нет данных" else "≈ ${mem.calories()} ккал")}}
            TextButton(onClick={m.open("family")}) {Text("Изменить рост, вес, активность")}
        }
    }
}
@Composable internal fun SubscriptionPage(m: AppModel) {
    val s=m.state
    var plan by remember {mutableStateOf("year")}
    Page {
        val sub=s.subscription
        if(sub!=null) {
            Heading("Premium","Подписка подключена")
            Panel {Text(if(sub.plan=="year") "На год — 1 990 ₽" else "На месяц — 299 ₽");Note("С ${dateLabel(sub.since)}. Напомним за 3 дня до продления. Отменить можно в любой момент — меню и настройки останутся.")
                Secondary("Отменить подписку (прототип)") {m.update(s.copy(subscription=null));m.track("unsubscribed")}}
            return@Page
        }
        Heading(when(s.premiumState()) {"soon" -> "Откроется через ${max(1,7-s.dayNumber())} ${plural(max(1,7-s.dayNumber()),"день","дня","дней")}";"trial" -> "Бесплатно ещё ${14-s.dayNumber()} ${plural(14-s.dayNumber(),"день","дня","дней")}";else -> "Пробная неделя закончилась"},"Premium")
        Panel(accent=Amber) {
            Text("Бюджет и цены",style=MaterialTheme.typography.titleMedium);Note("Лимит на неделю, меню под бюджет, акции ВкусВилла и Лавки, сравнение корзины.")
            Text("Калории и КБЖУ",style=MaterialTheme.typography.titleMedium);Note("Норма для каждого члена семьи, КБЖУ блюд, дневник «что съели».")
        }
        Panel {Text("Остаётся бесплатно",style=MaterialTheme.typography.titleMedium);Note("Меню на неделю, блюда из того, что есть, список покупок и сборка корзины, рецепты с таймером.")}
        if(s.premiumState()=="soon") Note("Первую неделю Premium дадим бесплатно, без карты. Хотите сразу — можно подключить уже сейчас.")
        listOf(Triple("year","На год · 1 990 ₽","≈166 ₽ в месяц — на 45% выгоднее"),Triple("month","На месяц · 299 ₽","отмена в любой момент")).forEach {(key,title,note) ->
            Panel(Modifier.clickable {plan=key},accent=if(plan==key) Green else null) {Text(title,style=MaterialTheme.typography.titleMedium);Note(note)}
        }
        Primary("Подключить за ${if(plan=="year") "1 990 ₽" else "299 ₽"} — оплата по СБП") {m.update(s.copy(subscription=Subscription(plan,s.today().toString())));m.track("subscribed",plan)}
        Note("Прототип: деньги не списываются. В пилоте — ссылка на оплату по СБП, о продлении напомним за 3 дня.")
    }
    LaunchedEffect(Unit) {if(s.subscription==null) m.track("paywall_shown",s.premiumState())}
}
@Composable internal fun MetricsPage(m: AppModel) {
    val events=m.state.events
    val funnel=listOf("onboarding_done" to "Прошли знакомство","scenario_now" to "Выбрали «из того, что есть»","scenario_week" to "Выбрали «меню на неделю»","menu_built" to "Получили меню",
        "menu_approved" to "Утвердили меню","now_selected" to "Выбрали блюдо из того, что есть","cart_started" to "Собирали корзину","dish_cooked" to "Приготовили блюдо из меню",
        "now_cooked" to "Приготовили из того, что есть","share_opened" to "Делились с семьёй","paywall_shown" to "Смотрели Premium","subscribed" to "Подключили Premium")
    Page {
        Note("Что пилот считает по каждой семье. События сохраняются вместе с настройками аккаунта.")
        Panel {Text("Путь этой семьи",style=MaterialTheme.typography.titleMedium)
            funnel.forEach {(key,label) -> val n=events.count {it.name==key};Row {Text((if(n>0) "✓ " else "○ ")+label,Modifier.weight(1f));Text(if(n>0) "$n" else "—")}}}
        Panel {Text("Последние события",style=MaterialTheme.typography.titleMedium)
            if(events.isEmpty()) Note("Пока пусто")
            events.takeLast(15).reversed().forEach {e -> Note("${e.at.take(16).replace('T',' ')} · ${e.name}${if(e.detail.isNotBlank()) " · ${e.detail}" else ""}")}}
    }
}
