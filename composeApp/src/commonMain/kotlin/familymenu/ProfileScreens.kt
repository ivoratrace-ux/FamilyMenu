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

@Composable internal fun Welcome(m: AppModel) {
    var slide by remember { mutableStateOf(0) }
    var quizStep by remember { mutableStateOf(0) }
    var phone by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var codeStage by remember { mutableStateOf(false) }
    Page {
        when(m.state.stage) {
            "intro" -> {
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.End) {TextButton(onClick={m.update(m.state.copy(stage="auth"))}) {Text("Пропустить")}}
                Spacer(Modifier.height(24.dp))
                Picture(listOf("m5","b1","m2")[slide],Modifier.fillMaxWidth().aspectRatio(1.25f))
                Heading("Семейное меню",listOf("Меню на неделю для всей семьи","Список покупок соберётся сам","Готовьте по шагам с таймером")[slide])
                Note(listOf("Учитываем вкусы, аллергии и нормы калорий каждого. Суп на обед, второе на ужин — как привыкли.","Одинаковые продукты объединены, а цены сравниваются между ВкусВиллом и Яндекс Лавкой.","Картинки и граммовки на каждом шаге, таймеры и подсчёт калорий.")[slide])
                Text("${slide+1} / 3")
                Primary(if(slide<2) "Далее" else "Начать") {if(slide<2) slide++ else m.update(m.state.copy(stage="auth"))}
            }
            "auth" -> {
                Heading("Семейное меню",if(codeStage) "Код из СМС" else "Вход")
                Note("Прототип: СМС не отправляется. Данные сохраняются только на этом устройстве.")
                if(!codeStage) {
                    OutlinedTextField(phone,{phone=it.filter(Char::isDigit).take(11)},label={Text("Номер телефона")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Phone),modifier=Modifier.fillMaxWidth())
                    Primary("Получить демо-код",phone.length in 10..11) {codeStage=true}
                } else {
                    Note("Подойдёт любой код из четырёх цифр.")
                    OutlinedTextField(code,{code=it.filter(Char::isDigit).take(4)},label={Text("Код")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number),modifier=Modifier.fillMaxWidth())
                    Primary("Войти",code.length==4) {m.update(m.state.copy(stage="quiz"));quizStep=0}
                    TextButton(onClick={codeStage=false;code=""}) {Text("Изменить номер")}
                }
                Primary("Посмотреть без входа (демо-семья)") {m.demo()}
                OutlinedButton(onClick={m.update(m.state.copy(stage="quiz"));quizStep=0},modifier=Modifier.fillMaxWidth()) {Text("Настроить свою семью без входа")}
            }
            else -> {
                val headings=listOf("Для кого готовим?","Есть ли аллергии?","Как вы питаетесь?","Что планируем?","Вкусы семьи","Цели питания","Время, бюджет и город")
                Heading("Настройка · ${quizStep+1} / ${headings.size}",headings[quizStep])
                when(quizStep) {
                    0 -> MembersEditor(m)
                    1 -> AllergiesEditor(m)
                    2 -> DietEditor(m)
                    3 -> MealsEditor(m)
                    4 -> TastesEditor(m)
                    5 -> GoalsEditor(m)
                    else -> WeekEditor(m)
                }
                Primary(if(quizStep==headings.lastIndex) "Составить меню" else "Дальше",m.state.profile.members.isNotEmpty() && m.state.profile.meals.isNotEmpty()) {if(quizStep<headings.lastIndex) quizStep++ else m.generate()}
                TextButton(onClick={if(quizStep>0) quizStep-- else m.update(m.state.copy(stage="auth"))}) {Text("Назад")}
            }
        }
    }
}

@Composable internal fun ProfileScreen(m: AppModel) {
    var reset by remember {mutableStateOf(false)}
    Page {
        Heading("Профиль семьи","Семья и настройки")
        MembersEditor(m);TastesEditor(m);AllergiesEditor(m);DietEditor(m);GoalsEditor(m);MealsEditor(m);WeekEditor(m)
        Panel {
            Text("Оформление",style=MaterialTheme.typography.titleMedium)
            FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {listOf("system" to "Системное","light" to "Светлое","dark" to "Тёмное").forEach { (key,label) -> Choice(label,m.state.theme==key) {m.update(m.state.copy(theme=key))} }}
            Row(verticalAlignment=Alignment.CenterVertically) {Text("Напоминание накануне",Modifier.weight(1f));Switch(m.state.profile.reminder,{m.profile(m.state.profile.copy(reminder=it))})}
            if(m.state.profile.reminder) {
                FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {listOf("18:00","19:00","20:00","21:00","22:00").forEach {t -> Choice(t,m.state.profile.reminderTime==t) {m.profile(m.state.profile.copy(reminderTime=t))} }}
                Note("Напоминание отображается, пока приложение открыто.")
            }
        }
        if(m.state.blocked.isNotEmpty()) Panel {Text("Скрытые блюда");m.state.blocked.forEach {id -> Row(verticalAlignment=Alignment.CenterVertically) {Text(m.catalog.byRecipe[id]?.name ?: id,Modifier.weight(1f));TextButton(onClick={m.update(m.state.copy(blocked=m.state.blocked-id))}) {Text("Вернуть")}}}}
        Primary("Сохранить и пересобрать меню",m.state.profile.meals.isNotEmpty()) {m.generate()}
        OutlinedButton(onClick={reset=true},modifier=Modifier.fillMaxWidth()) {Text("Сбросить данные прототипа")}
    }
    if(reset) AlertDialog(onDismissRequest={reset=false},title={Text("Сбросить данные?")},text={Text("Меню, настройки и отметки покупок будут удалены с этого устройства.")},confirmButton={TextButton(onClick={m.update(AppState());m.page=null;m.scannerProducts=emptyList();m.timers.clear();reset=false}) {Text("Сбросить")}},dismissButton={TextButton(onClick={reset=false}) {Text("Отмена")}})
}

@Composable private fun MembersEditor(m: AppModel) {
    val p=m.state.profile
    Panel {
        Text("Кого кормим?",style=MaterialTheme.typography.titleMedium)
        p.members.forEachIndexed {i,member ->
            fun change(next: Member) = m.profile(m.state.profile.copy(members=m.state.profile.members.mapIndexed {j,v -> if(i==j) next else v}))
            var expanded by remember(i) {mutableStateOf(false)}
            Row(verticalAlignment=Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {Text(member.name);Note("${if(member.child) "Ребёнок" else "Взрослый"} · ≈${member.calories()} ккал")}
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
@Composable private fun AllergiesEditor(m: AppModel) {Panel {
    Text("Аллергии и ограничения",style=MaterialTheme.typography.titleMedium)
    FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {allergies.forEach { (key,label) -> Choice(label,key in m.state.profile.allergies) {m.profile(m.state.profile.copy(allergies=m.state.profile.allergies.toggle(key)))} }}
    Note("Блюда с отмеченными аллергенами исключаются из подбора.")
}}
@Composable private fun DietEditor(m: AppModel) {Panel {Text("Как вы питаетесь?",style=MaterialTheme.typography.titleMedium);FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {diets.forEach {(key,label) -> Choice(label,m.state.profile.diet==key) {m.profile(m.state.profile.copy(diet=key))}}}}}
@Composable private fun GoalsEditor(m: AppModel) {Panel {Text("Цели питания",style=MaterialTheme.typography.titleMedium);FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {goals.forEach {(key,label) -> Choice(label,key in m.state.profile.goals) {m.profile(m.state.profile.copy(goals=m.state.profile.goals.toggle(key)))}}}}}
@Composable private fun MealsEditor(m: AppModel) {Panel {
    Text("Что планируем?",style=MaterialTheme.typography.titleMedium)
    FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {mealLabels.forEach {(key,label) -> Choice(label,key in m.state.profile.meals) {val next=m.state.profile.meals.toggle(key);if(next.isNotEmpty()) m.profile(m.state.profile.copy(meals=next))}}}
    Row(verticalAlignment=Alignment.CenterVertically) {Text("Суп варить на два дня",Modifier.weight(1f));Switch(m.state.profile.soupBatch,{m.profile(m.state.profile.copy(soupBatch=it))})}
}}
@Composable private fun TastesEditor(m: AppModel) {
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
@Composable private fun WeekEditor(m: AppModel) {Panel {
    Text("Неделя и бюджет",style=MaterialTheme.typography.titleMedium)
    Text("Время в будни: ${m.state.profile.maxTime} мин")
    Slider(m.state.profile.maxTime.toFloat(),{m.profile(m.state.profile.copy(maxTime=it.toInt()))},valueRange=10f..120f,steps=21)
    Note("В выходные допускается на 30 минут больше. Если быстрых блюд нет, выбираем из доступных.")
    NumberInput("Бюджет на неделю, ₽",m.state.profile.budget,500..200000) {m.profile(m.state.profile.copy(budget=it))}
    Note("Бюджет влияет на подбор, но не гарантирует точную итоговую сумму.")
    FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {cityNames.forEach {(key,label) -> Choice(label,m.state.profile.city==key) {m.profile(m.state.profile.copy(city=key))}}}
}}
@Composable private fun NumberInput(label: String,value: Int,range: IntRange,onChange:(Int)->Unit) {
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
