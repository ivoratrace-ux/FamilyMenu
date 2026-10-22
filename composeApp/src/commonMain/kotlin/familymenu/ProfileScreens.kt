@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package familymenu

import androidx.compose.foundation.layout.*
import io.ktor.http.encodeURLParameter
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions

@Composable internal fun MembersEditor(m: AppModel) {
    val p=m.state.profile
    Panel {
        Text("Кого кормим?",style=MaterialTheme.typography.titleMedium)
        p.members.forEachIndexed {i,member ->
            fun change(next: Member) = m.profile(m.state.profile.copy(members=m.state.profile.members.mapIndexed {j,v -> if(i==j) next else v}))
            var expanded by remember(i) {mutableStateOf(false)}
            Row(verticalAlignment=Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {Text(member.name.ifBlank {if(i==0) "Вы" else "Без имени"});Note("${if(member.child) "Ребёнок" else "Взрослый"} · ≈${member.calories()} ккал")}
                TextButton(onClick={expanded=!expanded}) {Text(if(expanded) "Свернуть" else "Настроить")}
                if(p.members.size>1) TextButton(onClick={m.profile(p.copy(members=p.members.filterIndexed {j,_ -> i!=j}))}) {Text("×")}
            }
            if(expanded) {
                OutlinedTextField(member.name,{change(member.copy(name=it.take(40)))},label={Text("Имя")},modifier=Modifier.fillMaxWidth())
                FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {listOf("" to "Не указан","f" to "Женский","m" to "Мужской").forEach { (key,label) -> Choice(label,member.sex==key) {change(member.copy(sex=key))} }}
                NumberInput("Возраст",member.age,1..100) {change(member.copy(age=it))}
                if(!member.child) {NumberInput("Вес, кг",member.weight,20..300) {change(member.copy(weight=it))};NumberInput("Рост, см",member.height,80..230) {change(member.copy(height=it))}}
                FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {listOf("low" to "Мало движения","mid" to "Умеренно","high" to "Активно","sport" to "Спорт").forEach {(key,label) -> Choice(label,member.activity==key) {change(member.copy(activity=key))}}}
                if(!member.child) FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {listOf("keep" to "Поддержание","lose" to "Похудение","gain" to "Набор массы").forEach {(key,label) -> Choice(label,member.goal==key) {change(member.copy(goal=key))}}}
                NumberInput("Своя норма ккал (0 — расчёт)",member.customCalories,0..6000) {change(member.copy(customCalories=it))}
            }
        }
        FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            TextButton(onClick={m.profile(p.copy(members=p.members+Member("Взрослый ${p.members.count {!it.child}+1}")))}) {Text("+ Взрослый")}
            TextButton(onClick={m.profile(p.copy(members=p.members+Member("Ребёнок ${p.members.count {it.child}+1}",true,age=7)))}) {Text("+ Ребёнок")}
        }
        Note("Готовим на ${p.portions()} стандартных порций за приём пищи. Нормы калорий приблизительные.")
    }
}
@Composable internal fun AllergiesEditor(m: AppModel) {Panel {
    Text("Аллергии и ограничения",style=MaterialTheme.typography.titleMedium)
    FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {allergies.forEach { (key,label) -> Choice(label,key in m.state.profile.allergies) {m.profile(m.state.profile.copy(allergies=m.state.profile.allergies.toggle(key)))} }}
    Note("Блюда с отмеченными аллергенами исключаются из подбора.")
}}
@Composable internal fun DietEditor(m: AppModel) {Panel {Text("Как вы питаетесь?",style=MaterialTheme.typography.titleMedium);FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {diets.forEach {(key,label) -> Choice(label,m.state.profile.diet==key) {m.profile(m.state.profile.copy(diet=key))}}}}}
@Composable internal fun GoalsEditor(m: AppModel) {Panel {Text("Цели питания",style=MaterialTheme.typography.titleMedium);FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {goals.forEach {(key,label) -> Choice(label,key in m.state.profile.goals) {m.profile(m.state.profile.copy(goals=m.state.profile.goals.toggle(key)))}}}}}
@Composable internal fun MealsEditor(m: AppModel) {Panel {
    Text("Что планируем?",style=MaterialTheme.typography.titleMedium)
    FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {mealLabels.forEach {(key,label) -> Choice(label,key in m.state.profile.meals) {val next=m.state.profile.meals.toggle(key);if(next.isNotEmpty()) m.profile(m.state.profile.copy(meals=next))}}}
    Row(verticalAlignment=Alignment.CenterVertically) {Text("Суп варить на два дня",Modifier.weight(1f));Switch(m.state.profile.soupBatch,{m.profile(m.state.profile.copy(soupBatch=it))})}
}}
@Composable internal fun TastesEditor(m: AppModel) {
    var query by remember {mutableStateOf("")}
    Panel {
        Text("Вкусы семьи",style=MaterialTheme.typography.titleMedium)
        FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
            listOf("kids" to "Любят дети","quick" to "Быстро","soup" to "Супы","baked" to "В духовке","ru" to "Домашнее","asia" to "Азиатское","it" to "Итальянское").forEach {(key,label) -> Choice(label,"t:$key" in m.state.profile.likes) {m.profile(m.state.profile.copy(likes=m.state.profile.likes.toggle("t:$key")))}}
        }
        OutlinedTextField(query,{query=it},label={Text("Любимые и нелюбимые продукты")},modifier=Modifier.fillMaxWidth())
        m.catalog.ingredients.filter { (query.isNotBlank() && it.name.contains(query,true)) || it.id in m.state.profile.dislikes || "i:${it.id}" in m.state.profile.likes }.take(15).forEach {i ->
            Text(i.name)
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                Choice("Любим","i:${i.id}" in m.state.profile.likes) {m.profile(m.state.profile.copy(likes=m.state.profile.likes.toggle("i:${i.id}"),dislikes=m.state.profile.dislikes-i.id))}
                Choice("Не едим",i.id in m.state.profile.dislikes) {m.profile(m.state.profile.copy(dislikes=m.state.profile.dislikes.toggle(i.id),likes=m.state.profile.likes-"i:${i.id}"))}
            }
        }
    }
}
@Composable internal fun WeekEditor(m: AppModel) {Panel {
    Text("Неделя и бюджет",style=MaterialTheme.typography.titleMedium)
    Text("Время в будни: ${m.state.profile.maxTime} мин")
    Slider(m.state.profile.maxTime.toFloat(),{m.profile(m.state.profile.copy(maxTime=it.toInt()))},valueRange=10f..120f,steps=21)
    Note("В выходные допускается на 30 минут больше. Если быстрых блюд нет, выбираем из доступных.")
    if(m.state.premiumOn()) {
        NumberInput("Бюджет на неделю, ₽",m.state.profile.budget,500..200000) {m.profile(m.state.profile.copy(budget=it,budgetSet=true))}
        Note("Бюджет влияет на подбор, но не гарантирует точную итоговую сумму.")
    } else NavRow("Бюджет на неделю","Автосборка корзины с бюджетом",locked=true,badge="Premium") {m.open("sub")}
    FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {cityNames.forEach {(key,label) -> Choice(label,m.state.profile.city==key) {m.profile(m.state.profile.copy(city=key))}}}
}}
@Composable internal fun NumberInput(label: String,value: Int,range: IntRange,onChange:(Int)->Unit) {
    var text by remember(value) {mutableStateOf(value.toString())}
    OutlinedTextField(text,{next -> if(next.all(Char::isDigit) && next.length<=6) {text=next;next.toIntOrNull()?.takeIf {it in range}?.let(onChange)}},label={Text(label)},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number),singleLine=true,modifier=Modifier.fillMaxWidth())
}
@Composable internal fun PromoScreen(m: AppModel) {
    val uri=androidx.compose.ui.platform.LocalUriHandler.current
    Page {
        Heading("Акции и цены","ВкусВилл и Яндекс Лавка")
        Note("Снимок цен: Москва, 20–21.10.2026. Актуальную цену и наличие проверяйте в магазине.")
        Panel {Text("Сравнение корзины",style=MaterialTheme.typography.titleMedium);listOf("vv" to "ВкусВилл","lavka" to "Яндекс Лавка").forEach {(key,label) -> val state=m.state.copy(store=key);Text("$label: ≈${money(m.engine.shopping(state).filter {it.ingredient.id !in state.bought}.sumOf {it.cost})}")}}
        m.catalog.promos.forEach {promo -> Panel {
            Text(promo.name,style=MaterialTheme.typography.titleMedium)
            Text("${promo.price} ₽ · обычно ${promo.regularPrice} ₽")
            Note("${promo.condition} · до ${promo.until}")
            TextButton(onClick={uri.openUri("https://vkusvill.ru/search/?q=${promo.name.encodeURLParameter()}")}) {Text("Открыть во ВкусВилле ↗")}
        }}
    }
}
