@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class, androidx.compose.material3.ExperimentalMaterial3Api::class)
package familymenu

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.*

private data class Slide(val title: String,val text: String,val image: String?,val badge: String?=null)

/** Five swipeable slides with no choices; the last one states what is free and what is Premium. */
@Composable internal fun IntroScreen(m: AppModel) {
    val slides=remember {listOf(
        Slide("Меню на всю неделю","Подберём рацион для всей семьи из большой базы рецептов с картинками. Готовка по шагам с таймером — справится даже новичок.","m5"),
        Slide("Готовим из того, что есть","Отметьте, что лежит в холодильнике, — предложим основное, гарнир или суп. Докупить придётся по минимуму.","p1"),
        Slide("Уложимся в бюджет","Посчитаем стоимость меню по ценам ВкусВилла и Яндекс Лавки, подскажем акции и где корзина дешевле.","m3","Premium"),
        Slide("Калории и диета","Белковое, вегетарианское, постное и другие типы питания — бесплатно. Норма калорий и КБЖУ для каждого члена семьи — в Premium.","p11","Калории — Premium"),
        Slide("Что бесплатно, а что в Premium","Premium откроется через неделю: первые 7 дней бесплатно, дальше 299 ₽ в месяц. Без привязки карты заранее.",null))}
    var index by remember {mutableStateOf(0)}
    var drag by remember {mutableStateOf(0f)}
    fun finish() {m.update(m.state.copy(stage="auth"))}
    val slide=slides[index]
    Column(Modifier.fillMaxSize().pointerInput(Unit) {
        detectHorizontalDragGestures(onDragStart={drag=0f},onDragEnd={if(drag<-80 && index<slides.lastIndex) index++ else if(drag>80 && index>0) index--}) {_,amount -> drag+=amount}
    }.padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
            if(index>0) TextButton(onClick={index--}) {Text("‹ Назад")} else Spacer(Modifier.width(8.dp))
            TextButton(onClick={finish()}) {Text("Пропустить")}
        }
        if(slide.image!=null) Picture(m.catalog.byRecipe[slide.image]?.imageUrl,Modifier.fillMaxWidth().aspectRatio(400f/260))
        else {
            Panel {Text("Бесплатно",style=MaterialTheme.typography.titleMedium)
                listOf("Меню на неделю для всей семьи","Блюда из того, что есть дома","Список покупок и сборка корзины","Рецепты по шагам с таймером").forEach {Text("• $it")}}
            Panel(accent=Amber) {Row(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalAlignment=Alignment.CenterVertically) {Text("Premium",style=MaterialTheme.typography.titleMedium);Badge("через 7 дней",true)}
                listOf("Бюджет, акции и сравнение цен","Калории и КБЖУ для каждого").forEach {Text("• $it")}}
        }
        slide.badge?.let {Badge(it,true)}
        Text(slide.title,style=MaterialTheme.typography.headlineSmall)
        Note(slide.text)
        Spacer(Modifier.weight(1f))
        Text("${index+1} / ${slides.size}",Modifier.align(Alignment.CenterHorizontally),color=Muted)
        Primary(if(index<slides.lastIndex) "Далее" else "Начать") {if(index<slides.lastIndex) index++ else finish()}
    }
}

/** A one-time device challenge is approved inside the Telegram bot. */
@Composable internal fun AuthenticationScreen(m: AppModel) {
    val scope=rememberCoroutineScope()
    val uri=androidx.compose.ui.platform.LocalUriHandler.current
    var challenge by remember {mutableStateOf<TelegramChallenge?>(null)}
    var error by remember {mutableStateOf<String?>(null)}
    var busy by remember {mutableStateOf(false)}
    var remaining by remember {mutableStateOf(0L)}
    LaunchedEffect(challenge) {
        val current=challenge ?: return@LaunchedEffect
        val deadline=kotlinx.datetime.Clock.System.now().epochSeconds+current.expiresIn
        while(isActive && Account.current==null) {
            remaining=(deadline-kotlinx.datetime.Clock.System.now().epochSeconds).coerceAtLeast(0)
            if(remaining==0L) {error="Вход истёк. Начните ещё раз.";challenge=null;break}
            delay(2000)
            try {if(Account.pollTelegram(current)) break;error=null}
            catch(e: CancellationException) {throw e}
            catch(e: Exception) {error=e.message ?: "Не удалось проверить вход. Повторим попытку."}
        }
    }
    Page {
        Heading("Семейное меню","Вход через Telegram")
        Note("Подтвердите вход в боте. При первом входе создадим аккаунт, при следующих загрузим ваши меню, настройки и продукты.")
        val current=challenge
        if(current==null) {
            Primary(if(busy) "Подготавливаем вход…" else "Войти через Telegram",!busy) {
                busy=true;error=null
                scope.launch {
                    try {challenge=Account.startTelegram()}
                    catch(e: CancellationException) {throw e}
                    catch(e: Exception) {error=e.message ?: "Не удалось начать вход. Попробуйте ещё раз."}
                    finally {busy=false}
                }
            }
        } else {
            Panel {
                Text("Код входа: ${current.code}",style=MaterialTheme.typography.headlineSmall)
                Note("Откройте бота, нажмите «Начать», затем «Подтвердить вход». Код в боте должен совпадать с этим.")
                Primary("Открыть Telegram") {uri.openUri(current.botUrl)}
                Note("После подтверждения вернитесь сюда — вход завершится автоматически.")
                Note("Осталось ${remaining / 60}:${(remaining % 60).toString().padStart(2,'0')}")
            }
            TextButton(onClick={challenge=null;error=null}) {Text("Начать вход заново")}
        }
        error?.let {Text(it,color=MaterialTheme.colorScheme.error)}
    }
}


@Composable internal fun OnboardingScreen(m: AppModel) {
    val step=m.onboardingStep
    val titles=listOf("Кто в семье?","Рост, вес и возраст","Насколько вы активны?","Тип питания","Чего не должно быть в меню?","С чего начнём?","Меню на неделю")
    val hints=listOf("Посчитаем порции на всех. Начнём с вас.","По ним посчитаем норму калорий и размер порции каждого. Можно заполнить позже.",
        "От активности зависит, сколько калорий нужно в день.","Строгое правило для всего меню. Цель — по желанию: такие блюда будут чаще.",
        "Блюда с этими продуктами мы не предложим. Любимое укажете потом — меню подстроится под ваши оценки.","Второй вариант всегда доступен на главном экране.",
        "Последний шаг: что готовим и сколько времени есть в будни.")
    fun go(next: Int) {m.onboardingStep=next}
    Page {
        Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
            if(step>0 || m.weekFromApp) TextButton(onClick={if(m.weekFromApp && step==6) {m.weekFromApp=false;m.update(m.state.copy(stage="app"))} else go(step-1)}) {Text("‹ Назад")}
            if(step<6) LinearProgressIndicator(progress={(step+1)/6f},modifier=Modifier.weight(1f).padding(horizontal=8.dp)) else Spacer(Modifier.weight(1f))
            if(step in 1..4) TextButton(onClick={go(step+1)}) {Text("Позже")}
        }
        Heading(if(step<6) (if(step==0) "Давайте познакомимся · " else "")+"Шаг ${step+1} из 6" else "Последний шаг",titles[step])
        Note(hints[step])
        val p=m.state.profile
        fun member(i: Int,next: Member)=m.profile(m.state.profile.copy(members=m.state.profile.members.mapIndexed {j,v -> if(i==j) next else v}))
        when(step) {
            0 -> {
                p.members.forEachIndexed {i,mem -> Panel {
                    Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(mem.name,{member(i,mem.copy(name=it.take(40)))},label={Text(if(i==0) "Как вас зовут?" else "Имя")},singleLine=true,modifier=Modifier.weight(1f))
                        if(i==0) Badge("это вы") else TextButton(onClick={m.profile(p.copy(members=p.members.filterIndexed {j,_ -> j!=i}))}) {Text("×")}
                    }
                    if(i>0) FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {Choice("Взрослый",!mem.child) {member(i,mem.copy(child=false))};Choice("Ребёнок",mem.child) {member(i,mem.copy(child=true,age=if(mem.child) mem.age else 7))}}
                }}
                FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick={m.profile(p.copy(members=p.members+Member(name="")))}) {Text("+ Взрослый")}
                    OutlinedButton(onClick={m.profile(p.copy(members=p.members+Member(name="",child=true,age=7)))}) {Text("+ Ребёнок")}
                }
                Note("Готовим на ${p.portions()} ${plural(p.portions(),"порцию","порции","порций")} за приём пищи. Добавить или убрать людей можно потом в «Профиле».")
            }
            1 -> {
                p.members.forEachIndexed {i,mem -> Panel {
                    Text(mem.name.ifBlank {if(i==0) "Вы" else if(mem.child) "Ребёнок" else "Взрослый"},style=MaterialTheme.typography.titleMedium)
                    FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                        Choice(if(mem.child) "Девочка" else "Женщина",mem.sex=="f") {member(i,mem.copy(sex="f"))}
                        Choice(if(mem.child) "Мальчик" else "Мужчина",mem.sex=="m") {member(i,mem.copy(sex="m"))}
                    }
                    NumberInput("Возраст, лет",mem.age,1..100) {member(i,mem.copy(age=it))}
                    if(!mem.child) {NumberInput("Рост, см",mem.height,80..230) {member(i,mem.copy(height=it))};NumberInput("Вес, кг",mem.weight,20..300) {member(i,mem.copy(weight=it))}}
                    NormLine(mem)
                }}
                Note("Норма — по формуле Миффлина — Сан-Жеора. Это ориентир, а не медицинская рекомендация.")
            }
            2 -> {
                p.members.forEachIndexed {i,mem -> if(!mem.child) Panel {
                    Text(mem.name.ifBlank {if(i==0) "Вы" else "Взрослый"},style=MaterialTheme.typography.titleMedium)
                    listOf("low" to "Мало двигаюсь — сидячая работа, без тренировок","mid" to "Умеренно — прогулки, 1–3 тренировки в неделю","high" to "Активно — много хожу, 3–5 тренировок","sport" to "Спорт — тренировки 6+ раз в неделю").forEach {(key,label) ->
                        Choice(label,mem.activity==key) {member(i,mem.copy(activity=key))}
                    }
                    NormLine(mem)
                }}
                if(p.members.any {it.child}) Note("Для детей норму считаем по возрасту.")
            }
            3 -> {DietEditor(m);GoalsEditor(m)}
            4 -> {AllergiesEditor(m);DislikesEditor(m)}
            5 -> {
                ScenarioCard("Приготовить из того, что есть","Отметите продукты дома — подскажем основное и гарнир, суп или целое блюдо") {
                    m.track("scenario_now");m.finishOnboarding();m.open("cook");m.pantryPicker=true
                }
                ScenarioCard("Составить меню на неделю","Завтраки, супы на обед, второе на ужин — и готовый список покупок") {m.track("scenario_week");go(6)}
            }
            else -> {
                MealsEditor(m)
                Panel {
                    Text("Сколько готовить в будни",style=MaterialTheme.typography.titleMedium)
                    FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {listOf(30 to "до 30 мин",45 to "до 45 мин",60 to "до часа",120 to "не важно").forEach {(v,l) -> Choice(l,p.maxTime==v) {m.profile(p.copy(maxTime=v))}}}
                    Note("В выходные допускаем на 30 минут дольше.")
                }
                Primary("Составить меню",p.meals.isNotEmpty()) {m.weekFromApp=false;m.onboardingStep=0;m.generate()}
            }
        }
        if(step<5) Primary("Дальше") {go(step+1)}
    }
}
@Composable private fun NormLine(mem: Member) {
    if(mem.child) Note("Порция ×${mem.portionFactor()}")
    else if(mem.sex.isEmpty()) Note("Укажите пол — посчитаем норму точнее")
    else Text("≈ ${mem.calories()} ккал в день · порция ×${mem.portionFactor()}",color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.titleMedium)
}
@Composable internal fun ScenarioCard(title: String,text: String,onClick:()->Unit) {
    OutlinedCard(onClick=onClick,modifier=Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp),verticalAlignment=Alignment.CenterVertically) {
            Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {Text(title,style=MaterialTheme.typography.titleMedium);Note(text)}
            Text("›",style=MaterialTheme.typography.titleLarge,color=Muted)
        }
    }
}
/** "What we don't eat": search over the catalog's ingredients plus frequent choices. */
@Composable internal fun DislikesEditor(m: AppModel) {
    var query by remember {mutableStateOf("")}
    val p=m.state.profile
    Panel {
        Text("Что не едите",style=MaterialTheme.typography.titleMedium)
        if(p.dislikes.isNotEmpty()) FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {p.dislikes.forEach {id -> Choice("${m.catalog.byIngredient[id]?.name ?: id} ×",true) {m.profile(p.copy(dislikes=p.dislikes-id))}}}
        OutlinedTextField(query,{query=it.take(40)},label={Text("Найти продукт: например, лук")},singleLine=true,modifier=Modifier.fillMaxWidth())
        val popular=listOf("onion","mushrooms","beet","cabbage","zucchini","eggplant","bell_pepper","cottage","chicken_liver","fish_white","pumpkin","garlic")
        val shown=if(query.isBlank()) popular.mapNotNull {m.catalog.byIngredient[it]} else m.catalog.ingredients.filter {it.name.contains(query.trim(),true)}.take(8)
        FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {shown.filter {it.id !in p.dislikes}.forEach {i -> Choice(i.name,false) {m.profile(p.copy(dislikes=p.dislikes+i.id,likes=p.likes-"i:${i.id}"));query=""}}}
    }
}
