@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package familymenu

import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.sp
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

internal fun mealName(meal: String)=mealLabels[meal].orEmpty()
internal fun servingsText(n: Int)="$n ${plural(n,"порция","порции","порций")}"

@Composable internal fun CaloriesPanel(m: AppModel,index: Int) {
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
        Progress((eaten/member.calories()).toFloat(),height=10.dp)
        Note("В меню ≈${planned.roundToInt()} ккал · порция ×${member.portionFactor()}. Отмечайте «Съели» у блюд.")
        OutlinedTextField(foodText,{foodText=it;foodError=null},label={Text("Съели ещё: например, 1 банан")},modifier=Modifier.fillMaxWidth(),singleLine=true)
        TextButton(onClick={val kcal=m.catalog.parseFood(foodText);if(kcal==null) foodError="Не узнали продукт. Укажите количество ккал числом." else {m.update(m.state.copy(extra=m.state.extra+(key to (extra+ExtraFood(foodText,kcal)))));foodText=""}}) {Text("Добавить")}
        foodError?.let {Text(it,color=MaterialTheme.colorScheme.error)}
        extra.forEachIndexed {i,f -> Row(verticalAlignment=Alignment.CenterVertically) {Text("${f.label} · ${f.calories} ккал",Modifier.weight(1f));TextButton(onClick={m.update(m.state.copy(extra=m.state.extra+(key to extra.filterIndexed {j,_ -> i!=j})))}) {Text("×")}}}
    }
}

private data class Ranked(val recipe: Recipe,val missing: Int,val hits: Int)
private fun rank(list: List<Recipe>,have: Set<String>)=list.map {r -> Ranked(r,missingIngredients(r,have).size,r.ingredients.count {it.id in have && it.id !in pantryStaples})}
    .sortedWith(compareBy<Ranked>({it.missing},{-it.hits},{it.recipe.minutes}))

@Composable internal fun CookScreen(m: AppModel,scope: CoroutineScope) {
    var mode by remember {mutableStateOf("pair")}
    var more by remember {mutableStateOf(false)}
    val have=m.have()
    Page {
        Note(if(have.isEmpty()) "Отметьте продукты во вкладке «Дома» — подберём блюда, где докупать меньше всего." else "Дома ${have.size} ${plural(have.size,"продукт","продукта","продуктов")}. Соль, специи, масло и сахар считаем, что есть.")
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
    Panel(Modifier.clickable(onClick=onClick),accent=if(selected) Green else null) {
        Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            Picture(x.recipe.imageUrl,Modifier.size(width=72.dp,height=52.dp).clip(RoundedCornerShape(10.dp)))
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                Text(x.recipe.name,fontFamily=DishFont.current,fontSize=16.sp,fontWeight=FontWeight.SemiBold)
                Row(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalAlignment=Alignment.CenterVertically) {
                    Note("${x.recipe.minutes} мин");if(x.missing==0) Badge("всё есть") else Badge("докупить ${x.missing}",true);note?.let {Note(it)}
                }
            }
        }
    }
}
/** v4 full-screen mode (cart, replacement, share…): header with «Закрыть», scrolling body. */
@Composable internal fun ModeScreen(title: String,onClose:()->Unit,content: @Composable ColumnScope.()->Unit) {
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(horizontal=16.dp,vertical=10.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
            Ghost("Закрыть") {onClose()}
            Text(title,Modifier.weight(1f),fontSize=17.sp,fontWeight=FontWeight.Bold,maxLines=1,overflow=androidx.compose.ui.text.style.TextOverflow.Ellipsis)
        }
        HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(start=16.dp,end=16.dp,top=16.dp,bottom=24.dp),verticalArrangement=Arrangement.spacedBy(14.dp),content=content)
    }
}
@Composable internal fun NowRecipeScreen(m: AppModel,recipe: Recipe) {
    val servings=m.portionsNow();val have=m.have();val missing=missingIngredients(recipe,have)
    val factor=servings.toDouble()/recipe.servings
    val cost=missing.sumOf {q -> price(m.catalog.byIngredient.getValue(q.id),m.state.store,m.state.profile.city)*q.quantity*factor}
    val inList=missing.isNotEmpty() && missing.all {it.id in m.state.extraBuy}
    ModeScreen("Из того, что есть · ${servingsText(servings)}",{m.nowRecipe=null}) {
        run {
            Picture(recipe.imageUrl,Modifier.fillMaxWidth().aspectRatio(400f/260).clip(RoundedCornerShape(14.dp)))
            Text(recipe.name,fontFamily=DishFont.current,fontSize=24.sp,lineHeight=29.sp,fontWeight=FontWeight.SemiBold)
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalAlignment=Alignment.CenterVertically) {
                Note("${recipe.minutes} мин");if(m.state.kcalVisible()) Note("${m.catalog.nutrition(recipe)[0].roundToInt()} ккал на порцию")
                if(missing.isEmpty()) Badge("всё есть") else Badge("докупить ${missing.size}",true)
            }
            Panel {
                Text("Продукты",style=MaterialTheme.typography.titleMedium)
                recipe.ingredients.forEach {q -> val i=m.catalog.byIngredient.getValue(q.id);val ok=q.id in have || q.id in pantryStaples
                    Row(verticalAlignment=Alignment.CenterVertically) {Text(if(ok) "✓ " else "+ ",color=if(ok) MaterialTheme.colorScheme.primary else Amber,fontWeight=FontWeight.Bold);Text(i.name,Modifier.weight(1f));Text(quantity(i,q.quantity*factor)+if(ok) "" else " · докупить",color=if(ok) MaterialTheme.colorScheme.onSurface else Amber)}
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
/** v4 cook mode: header with close, scrolling body, footer with step navigation. */
@Composable internal fun CookingScreen(m: AppModel,scope: CoroutineScope,target: CookTarget,now: Long) {
    val recipe=target.recipe;val slot=target.slot?.let {m.state.plan?.days?.getOrNull(it.first)?.slots?.getOrNull(it.second)}
    var cooking by remember(recipe.id) {mutableStateOf(target.slot==null)}
    var step by remember(recipe.id) {mutableStateOf(0)}
    var finished by remember(recipe.id) {mutableStateOf(false)}
    var usedUp by remember(recipe.id) {mutableStateOf(false)}
    fun close() {m.selectedSlot=null;m.cooking=null}
    fun next() {if(step<recipe.steps.lastIndex) step++ else {
        target.slot?.let {(d,i) -> m.changeSlot(d,i) {it.copy(cooked=true)};m.track("dish_cooked",recipe.id)} ?: m.track("now_cooked",recipe.id)
        finished=true
    }}
    val factor=target.servings.toDouble()/recipe.servings
    val nutrition=m.catalog.nutrition(recipe)
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(horizontal=16.dp,vertical=10.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
            Ghost("Закрыть") {close()}
            Column(Modifier.weight(1f)) {
                Text(if(finished) "Готово" else if(cooking) "Шаг ${step+1} из ${recipe.steps.size}" else "Рецепт",fontSize=17.sp,fontWeight=FontWeight.Bold)
                Text(recipe.name,fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant,maxLines=1,overflow=androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            }
        }
        HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
        if(cooking && !finished) Progress((step+1)/recipe.steps.size.toFloat(),height=4.dp)
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(start=16.dp,end=16.dp,top=16.dp,bottom=24.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
            if(finished) {
                Picture(recipe.imageUrl,Modifier.fillMaxWidth().aspectRatio(400f/260).clip(RoundedCornerShape(14.dp)))
                Text("Приятного аппетита!",style=MaterialTheme.typography.headlineSmall)
                if(target.slot==null) {
                    Note("Уберём из «Что есть дома» то, что ушло в блюдо.")
                    Primary(if(usedUp) "Списали ✓" else "Списать использованное",!usedUp && m.inventory!=null) {m.useUp(scope,recipe,target.servings);usedUp=true}
                }
                Panel {Text("Как вам блюдо?",style=MaterialTheme.typography.titleMedium)
                    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        Choice("Понравилось",recipe.id in m.state.liked) {m.update(m.state.copy(liked=m.state.liked.toggle(recipe.id),disliked=m.state.disliked-recipe.id))}
                        Choice("Не понравилось",recipe.id in m.state.disliked) {m.update(m.state.copy(disliked=m.state.disliked.toggle(recipe.id),liked=m.state.liked-recipe.id))}
                    }}
            } else if(cooking) {
                Picture(recipe.stepImageUrls.getOrNull(step),Modifier.fillMaxWidth().aspectRatio(400f/220).clip(RoundedCornerShape(10.dp)))
                Text(recipe.steps[step],fontSize=20.sp,lineHeight=29.sp,fontWeight=FontWeight.Medium)
                recipe.stepTips.getOrNull(step)?.takeIf {it.isNotBlank()}?.let {Hint(it)}
                val seconds=recipe.stepSeconds.getOrElse(step) {0};val key="${recipe.id}:$step";val timer=m.timers[key]
                if(seconds>0) Panel {
                    Column(Modifier.fillMaxWidth(),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(10.dp)) {
                        Text(timeText(timer?.remaining(now) ?: seconds),fontSize=56.sp,fontWeight=FontWeight.Bold,letterSpacing=(-1).sp,color=if(timer?.done==true) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
                        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            Button(onClick={
                                when {
                                    timer==null || timer.done -> m.startTimer(key,seconds)
                                    timer.paused==null -> m.timers[key]=timer.copy(paused=timer.remaining(now))
                                    else -> m.timers[key]=timer.copy(endAt=now+timer.paused*1000L,paused=null)
                                }
                            },shape=RoundedCornerShape(10.dp),modifier=Modifier.heightIn(min=36.dp)) {Text(if(timer?.done==true) "Ещё раз" else if(timer!=null && timer.paused==null) "Пауза" else "Старт таймера")}
                            Ghost("+1 мин",enabled=timer!=null) {if(timer!=null) m.timers[key]=timer.copy(endAt=timer.endAt+60000,paused=timer.paused?.plus(60),done=false)}
                            Ghost("Сброс",enabled=timer!=null) {m.timers.remove(key)}
                        }
                    }
                }
                TextButton(onClick={cooking=false},Modifier.align(Alignment.CenterHorizontally)) {Text("Все ингредиенты и шаги",fontWeight=FontWeight.SemiBold)}
            } else {
                Picture(recipe.imageUrl,Modifier.fillMaxWidth().aspectRatio(400f/260).clip(RoundedCornerShape(14.dp)))
                Text(recipe.name,fontFamily=DishFont.current,fontSize=24.sp,lineHeight=29.sp,fontWeight=FontWeight.SemiBold)
                FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                    Badge("${recipe.minutes} мин");Badge(servingsText(target.servings))
                    if(m.state.kcalVisible()) {Badge("${nutrition[0].roundToInt()} ккал");Badge("Б ${nutrition[1].roundToInt()} · Ж ${nutrition[2].roundToInt()} · У ${nutrition[3].roundToInt()}")}
                }
                Primary("Готовить по шагам с таймером") {cooking=true;m.track("cook_started",recipe.id)}
                Panel {
                    Text("Ингредиенты",style=MaterialTheme.typography.titleLarge)
                    recipe.ingredients.forEachIndexed {index,q -> val i=m.catalog.byIngredient.getValue(q.id)
                        if(index>0) HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
                        Row {Text(i.name,Modifier.weight(1f));Text(quantity(i,q.quantity*factor),fontWeight=FontWeight.SemiBold)}
                    }
                    if(recipe.spices.isNotEmpty()) Note("По вкусу: ${recipe.spices.joinToString()}")
                    val allergens=m.catalog.allergens(recipe).mapNotNull {allergies[it]}
                    if(allergens.isNotEmpty()) Hint("По рецепту содержит: ${allergens.joinToString()}. Состав продуктов проверяйте по упаковке.")
                }
                Text("Шаги",style=MaterialTheme.typography.titleLarge)
                recipe.steps.forEachIndexed {i,text ->
                    Surface(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable {step=i;cooking=true},shape=RoundedCornerShape(12.dp),border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant),color=MaterialTheme.colorScheme.surface) {
                        Row(Modifier.padding(12.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                            Box(Modifier.size(26.dp).clip(RoundedCornerShape(999.dp)).background(MaterialTheme.colorScheme.secondaryContainer),contentAlignment=Alignment.Center) {Text("${i+1}",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold,fontSize=13.sp)}
                            Text(text,Modifier.weight(1f))
                        }
                    }
                }
                if(target.slot!=null && slot!=null) {
                    val position=target.slot
                    Panel {Text("Как вам блюдо?",style=MaterialTheme.typography.titleMedium)
                        FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                            Choice("Понравилось",recipe.id in m.state.liked) {m.update(m.state.copy(liked=m.state.liked.toggle(recipe.id),disliked=m.state.disliked-recipe.id))}
                            Choice("Не понравилось",recipe.id in m.state.disliked) {m.update(m.state.copy(disliked=m.state.disliked.toggle(recipe.id),liked=m.state.liked-recipe.id))}
                        }}
                    Secondary(if(slot.cooked) "Приготовлено ✓" else "Отметить: приготовлено") {m.changeSlot(position.first,position.second) {it.copy(cooked=!it.cooked)};close()}
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        Ghost("Заменить блюдо",Modifier.weight(1f)) {close();m.replacement=position}
                        Ghost("Больше не предлагать",Modifier.weight(1f)) {m.update(m.state.copy(blocked=m.state.blocked+recipe.id));close();m.replacement=position}
                    }
                }
            }
        }
        if(cooking && !finished) {
            HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
            Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(horizontal=16.dp,vertical=10.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                Box(Modifier.weight(1f)) {Secondary("Назад",step>0) {step--}}
                Box(Modifier.weight(1f)) {Primary(if(step<recipe.steps.lastIndex) "Дальше" else "Готово ✓") {next()}}
            }
        } else if(finished) {
            HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
            Box(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(horizontal=16.dp,vertical=10.dp)) {Primary("Закрыть") {close()}}
        }
    }
}
@Composable internal fun ReplacementScreen(m: AppModel,position: Pair<Int,Int>) {
    val slot=m.state.plan?.days?.getOrNull(position.first)?.slots?.getOrNull(position.second) ?: return
    val choices=m.engine.pool(slot.meal,m.state).sortedByDescending {m.engine.score(it,m.state)}
    ModeScreen("Замена: ${slotName(slot.meal).lowercase()}",{m.replacement=null}) {
        Note("Выберите блюдо — список покупок пересчитается.")
        if(choices.isEmpty()) Note("Подходящих блюд нет. Ослабьте ограничения в профиле.")
        choices.forEach {r -> Panel(Modifier.clickable {m.replace(position.first,position.second,r)}) {Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            Picture(r.imageUrl,Modifier.size(width=84.dp,height=60.dp).clip(RoundedCornerShape(10.dp)));Column(Modifier.weight(1f)) {Text(r.name,fontFamily=DishFont.current,fontSize=16.sp,fontWeight=FontWeight.SemiBold);Note("${r.minutes} мин"+(if(m.state.kcalVisible()) " · ${m.catalog.nutrition(r)[0].roundToInt()} ккал" else "")+(if(m.state.premiumOn()) " · ≈${money(m.catalog.cost(r,m.state.store,m.state.profile.city))}" else ""))}
        }}}
    }
}

// ---------- Shopping ----------
internal data class ShoppingRow(val item: ShoppingItem,val toBuy: Double,val stock: Double,val covered: Boolean,val cost: Double)
internal fun shoppingRows(m: AppModel): List<ShoppingRow> = m.engine.shopping(m.state).map {item ->
    val stock=m.stock(item.ingredient.id);val i=item.ingredient
    val need=(item.amount-stock).coerceAtLeast(0.0);val buy=if(i.unit in listOf("g","ml")) need else kotlin.math.ceil(need-.001)
    ShoppingRow(item,buy,stock,buy<=0.0001,buy*price(i,m.state.store,m.state.profile.city))
}
internal fun storeUrl(i: Ingredient,store: String)=if(store=="lavka" && i.lavkaPath!=null) "https://lavka.yandex.ru${i.lavkaPath}" else if(store=="lavka") "https://lavka.yandex.ru/search?text=${i.name.encodeURLParameter()}" else "https://vkusvill.ru/search/?q=${i.name.encodeURLParameter()}"
@Composable internal fun CartScreen(m: AppModel,session: CartSession,scope: CoroutineScope) {
    val uri=LocalUriHandler.current
    val store=m.state.store;val storeName=if(store=="lavka") "Лавке" else "ВкусВилле"
    val rows=shoppingRows(m).associateBy {it.item.ingredient.id}
    val items=session.items.mapNotNull {rows[it]}
    ModeScreen("Корзина в $storeName",{m.cart=null}) {
        Progress(if(items.isEmpty()) 1f else session.index.coerceAtMost(items.size)/items.size.toFloat())
        val row=items.getOrNull(session.index)
        if(row==null) {
            Heading("Готово","Корзина собрана")
            Note("Положили ${session.added} из ${items.size}. ${if(session.home>0) "${session.home} отметили «есть дома». " else ""}Время доставки и оплату выберите в приложении магазина.")
            Primary("Открыть корзину в $storeName") {uri.openUri(if(store=="lavka") "https://lavka.yandex.ru/" else "https://vkusvill.ru/cart/")}
            Secondary("Закрыть") {m.cart=null;m.track("cart_done","${session.added}/${items.size}")}
        } else {
            val i=row.item.ingredient
            Eyebrow("Продукт ${session.index+1} из ${items.size}")
            Text(i.name,style=MaterialTheme.typography.headlineSmall)
            Text(quantity(i,row.toBuy),fontSize=34.sp,fontWeight=FontWeight.Bold,color=MaterialTheme.colorScheme.primary)
            Note("Для: ${row.item.dishes.joinToString()}")
            if(m.state.premiumOn()) Note("≈${money(row.cost)}")
            Secondary("Найти в $storeName ↗") {uri.openUri(storeUrl(i,store))}
            Note("Откроется магазин. Положите продукт в корзину, вернитесь и нажмите «Положила».")
            Primary("Положила ✓") {m.update(m.state.copy(bought=m.state.bought+i.id));m.track("item_bought");m.cart=session.copy(index=session.index+1,added=session.added+1)}
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                Ghost("Есть дома",Modifier.weight(1f).heightIn(min=46.dp)) {m.setStock(scope,i.id,row.item.amount);m.cart=session.copy(index=session.index+1,home=session.home+1)}
                Ghost("Пропустить",Modifier.weight(1f).heightIn(min=46.dp)) {m.cart=session.copy(index=session.index+1)}
            }
            if(session.index>0) TextButton(onClick={m.cart=session.copy(index=session.index-1)}) {Text("‹ Назад")}
        }
    }
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
    ModeScreen("Меню для семьи",{m.share=false}) {
        Note("Партнёр посмотрит, что сегодня на ужин, и докупит продукты по общему списку.")
        Panel {Text("Ссылкой",style=MaterialTheme.typography.titleMedium);Note("Откроется страница с меню и списком покупок, отметки «куплено» общие. Ссылки появятся вместе с семейным аккаунтом — пока можно посмотреть, как это будет выглядеть.")
            Secondary("Посмотреть, как увидит семья") {m.share=false;m.open("familyview");m.track("family_view_opened")}}
        Panel {Text("Текстом в мессенджер",style=MaterialTheme.typography.titleMedium);Note(shareText(m))
            Primary("Скопировать") {clipboard.setText(AnnotatedString(shareText(m)));m.track("share_text_copied")}}
    }
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

@Composable internal fun KcalPage(m: AppModel) {
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
