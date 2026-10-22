@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class, androidx.compose.material3.ExperimentalMaterial3Api::class)
package familymenu

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import familymenu.resources.Res
import familymenu.resources.frigo
import familymenu.resources.frigo_logo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import org.jetbrains.compose.resources.painterResource

// ---------- Splash ----------
@Composable internal fun SplashScreen() {
    Image(painterResource(Res.drawable.frigo),contentDescription="Frigo",modifier=Modifier.fillMaxSize().background(Color(0xff7fc95a)),contentScale=ContentScale.Crop)
}

// ---------- Intro: four feature slides ----------
private data class Feature(val title: String,val text: String,val premium: Boolean=false)
private val features=listOf(
    Feature("Готовим из того, что есть","Отметьте продукты из холодильника — подберём блюда и поведём по шагам с таймером."),
    Feature("Большая база рецептов","Сотни блюд с картинками и пошаговыми фото. Пополняем каждую неделю."),
    Feature("Уложимся в бюджет","Соберём корзину на нужную сумму и подскажем, где купить дешевле.",true),
    Feature("Калории и питание","Посчитаем калории для каждого и настроим меню под вашу цель и тип питания."))

@Composable internal fun IntroScreen(m: AppModel) {
    var index by remember {mutableStateOf(0)}
    var drag by remember {mutableStateOf(0f)}
    fun next() {if(index<features.lastIndex) index++ else {m.track("intro_done");m.update(m.state.copy(stage="quiz"))}}
    val f=features[index]
    Column(Modifier.fillMaxSize().pointerInput(Unit) {
        detectHorizontalDragGestures(onDragStart={drag=0f},onDragEnd={if(drag<-80) next() else if(drag>80 && index>0) index--}) {_,amount -> drag+=amount}
    }.padding(16.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
        Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            LinearProgressIndicator(progress={(index+1)/features.size.toFloat()},modifier=Modifier.weight(1f).height(6.dp).clip(RoundedCornerShape(3.dp)))
            TextButton(onClick={m.update(m.state.copy(stage="quiz"))}) {Text("Пропустить")}
        }
        Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            Text(f.title,Modifier.weight(1f,fill=false),fontSize=24.sp,fontWeight=FontWeight.Bold,maxLines=1,overflow=TextOverflow.Ellipsis)
            if(f.premium) Badge("Premium",true)
        }
        Box(Modifier.fillMaxWidth().weight(1f),contentAlignment=Alignment.Center) {FeatureArt(m,index)}
        Text(f.text,style=MaterialTheme.typography.bodyLarge)
        Primary(if(index<features.lastIndex) "Дальше" else "Начать") {next()}
        TextButton(onClick={m.update(m.state.copy(stage="auth"))},Modifier.align(Alignment.CenterHorizontally)) {Text("Уже есть аккаунт? Войти")}
    }
}
@Composable private fun Overlay(text: String,modifier: Modifier,warn: Boolean=false) {
    Text(text,modifier.clip(RoundedCornerShape(14.dp)).background(if(warn) AmberSoft else Color.White).padding(horizontal=12.dp,vertical=6.dp),color=if(warn) Amber else Ink,fontWeight=FontWeight.SemiBold)
}
@Composable private fun FeatureArt(m: AppModel,index: Int) {
    val url={id: String -> m.catalog.byRecipe[id]?.imageUrl}
    when(index) {
        0 -> Box(Modifier.fillMaxWidth().aspectRatio(1f)) {
            Picture(url("p1"),Modifier.fillMaxSize())
            Overlay("⏱ 25:00",Modifier.align(Alignment.TopEnd).padding(12.dp))
            Overlay("Шаг 2 из 5 · обжарьте на сковороде",Modifier.align(Alignment.BottomStart).padding(12.dp))
        }
        1 -> Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
            listOf(listOf("m5","b1"),listOf("m3","p11")).forEach {row -> Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {row.forEach {Picture(url(it),Modifier.weight(1f).aspectRatio(1f))}}}
            Overlay("+ новые рецепты каждую неделю",Modifier.align(Alignment.CenterHorizontally),warn=false)
        }
        2 -> Panel {
            Text("Корзина на неделю",style=MaterialTheme.typography.titleMedium)
            Row(verticalAlignment=Alignment.Bottom) {Text("3 480 ₽",fontSize=30.sp,fontWeight=FontWeight.Bold);Text("  из 4 000 ₽",color=Muted)}
            LinearProgressIndicator(progress={.87f},modifier=Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)))
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {Badge("ВкусВилл · 3 480 ₽");Badge("Лавка · 3 910 ₽",true)}
            Note("Дешевле во ВкусВилле на 430 ₽")
        }
        else -> Panel {
            Text("Сегодня",style=MaterialTheme.typography.titleMedium)
            Row(verticalAlignment=Alignment.Bottom) {Text("1 640",fontSize=30.sp,fontWeight=FontWeight.Bold);Text("  из 2 100 ккал",color=Muted)}
            listOf("Белки" to .7f,"Жиры" to .55f,"Углеводы" to .8f).forEach {(label,v) -> Text(label,style=MaterialTheme.typography.labelMedium);LinearProgressIndicator(progress={v},modifier=Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)))}
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {Badge("Похудение");Badge("Без свинины")}
        }
    }
}

// ---------- Getting to know: five steps, every one needs an answer ----------
private val goalOptions=linkedMapOf("lose" to "Похудение","mass" to "Набор массы","pp" to "Правильное питание","protein" to "Больше белка","lowcarb" to "Меньше углеводов","none" to "Просто вкусно и разнообразно")
private val stepTitles=listOf("Какая у вас цель?","Какой у вас тип питания?","Чего не должно быть в меню?","Что уже есть в холодильнике?","Ещё немного деталей")

@Composable internal fun OnboardingScreen(m: AppModel,scope: CoroutineScope) {
    val step=m.onboardingStep.coerceIn(0,4)
    val p=m.state.profile
    var goal by remember {mutableStateOf(if(m.state.onboarded) (p.goals.firstOrNull() ?: "none") else null)}
    var diet by remember {mutableStateOf(if(m.state.onboarded) p.diet else null)}
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(horizontal=8.dp,vertical=6.dp),verticalAlignment=Alignment.CenterVertically) {
            TextButton(onClick={if(step>0) m.onboardingStep=step-1 else m.update(m.state.copy(stage=if(m.state.plan!=null) "app" else "intro"))}) {Text("‹ Назад")}
            LinearProgressIndicator(progress={(step+1)/5f},modifier=Modifier.weight(1f).padding(horizontal=8.dp).height(6.dp).clip(RoundedCornerShape(3.dp)))
            Text("${step+1}/5",color=Muted,style=MaterialTheme.typography.labelMedium)
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal=16.dp,vertical=8.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
            Text(stepTitles[step],fontSize=24.sp,fontWeight=FontWeight.Bold)
            when(step) {
                0 -> {
                    Note("Под цель подберём блюда и посчитаем порции.")
                    goalOptions.forEach {(key,label) -> AnswerRow(label,goal==key) {
                        goal=key
                        val memberGoal=when(key) {"lose" -> "lose";"mass" -> "gain";else -> "keep"}
                        m.profile(p.copy(goals=if(key=="none") emptySet() else setOf(key),members=p.members.mapIndexed {i,v -> if(i==0) v.copy(goal=memberGoal) else v}))
                    }}
                }
                1 -> {
                    Note("Это строгое правило: другие блюда в меню не попадут.")
                    diets.forEach {(key,label) -> AnswerRow(label,diet==key) {diet=key;m.profile(p.copy(diet=key))}}
                }
                2 -> {
                    Panel {
                        Text("Аллергии",style=MaterialTheme.typography.titleMedium)
                        CollapsingChips(allergies.toList(),p.allergies) {m.profile(m.state.profile.copy(allergies=m.state.profile.allergies.toggle(it)))}
                    }
                    Panel {
                        Text("Не нравится",style=MaterialTheme.typography.titleMedium)
                        val items=remember {m.catalog.ingredients.filter {it.id !in pantryStaples}.sortedBy {it.name}.map {it.id to it.name}}
                        CollapsingChips(items,p.dislikes) {m.profile(m.state.profile.copy(dislikes=m.state.profile.dislikes.toggle(it)))}
                    }
                }
                3 -> PantryBlock(m,scope)
                else -> DetailsEditor(m)
            }
        }
        Column(Modifier.padding(16.dp)) {
            when(step) {
                0 -> Primary("Дальше",goal!=null) {m.onboardingStep=1}
                1 -> Primary("Дальше",diet!=null) {m.onboardingStep=2}
                2 -> Primary(if(p.allergies.isEmpty() && p.dislikes.isEmpty()) "Ограничений нет — дальше" else "Дальше") {m.onboardingStep=3}
                3 -> Primary(if(m.have().isEmpty() && m.scannerPhotos.isEmpty()) "Холодильник пуст — дальше" else "Дальше") {m.onboardingStep=4}
                else -> Primary("Составить меню",p.mealSetup.values.any {it!="none"}) {m.track("onboarding_done","${p.days} дн.");m.update(m.state.copy(stage="loading"))}
            }
        }
    }
}
@Composable private fun AnswerRow(label: String,selected: Boolean,onClick:()->Unit) {
    Surface(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable(onClick=onClick),shape=RoundedCornerShape(14.dp),
        border=BorderStroke(if(selected) 2.dp else 1.dp,if(selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant),
        color=if(selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface) {
        Row(Modifier.padding(16.dp),verticalAlignment=Alignment.CenterVertically) {
            Text(label,Modifier.weight(1f),style=MaterialTheme.typography.titleMedium)
            RadioButton(selected,onClick=onClick)
        }
    }
}

/** Chips limited to four rows; the rest hides behind «Ещё», which sits on the fourth row. */
@Composable internal fun CollapsingChips(items: List<Pair<String,String>>,selected: Set<String>,maxRows: Int=4,onToggle:(String)->Unit) {
    var expanded by remember {mutableStateOf(false)}
    Layout(content={
        items.forEach {(key,label) -> FilterChip(selected=key in selected,onClick={onToggle(key)},label={Text(label)},shape=RoundedCornerShape(24.dp))}
        AssistChip(onClick={expanded=!expanded},label={Text(if(expanded) "Свернуть" else "Ещё",color=MaterialTheme.colorScheme.primary)},shape=RoundedCornerShape(24.dp))
    }) {measurables,constraints ->
        val gap=6.dp.roundToPx();val loose=constraints.copy(minWidth=0,minHeight=0)
        val placeables=measurables.map {it.measure(loose)}
        val more=placeables.last();val chips=placeables.dropLast(1);val width=constraints.maxWidth
        fun rows(list: List<Int>,reserveLast: Int=0): List<MutableList<Int>> {
            val result=mutableListOf(mutableListOf<Int>());var x=0
            list.forEach {i -> val w=chips[i].width
                if(result.last().isNotEmpty() && x+gap+w>width) {result+=mutableListOf<Int>();x=0}
                x+=(if(result.last().isEmpty()) 0 else gap)+w;result.last()+=i}
            return result
        }
        val all=rows(chips.indices.toList())
        val needMore=all.size>maxRows
        // Rows of chip indices; -1 stands for the «Ещё»/«Свернуть» chip.
        val lines: List<List<Int>> = if(!needMore) all else if(expanded) {
            val l=all.map {it.toMutableList()}.toMutableList();val last=l.last()
            val used=last.sumOf {chips[it].width}+gap*(last.size)
            if(used+more.width<=width) last+=-1 else l+=mutableListOf(-1);l
        } else {
            val head=all.take(maxRows-1).map {it.toList()}.toMutableList()
            val rest=all.drop(maxRows-1).flatten();val line=mutableListOf<Int>();var x=0
            for(i in rest) {val w=chips[i].width;val next=x+(if(line.isEmpty()) 0 else gap)+w;if(next+gap+more.width>width) break;line+=i;x=next}
            line+=-1;head+=line;head
        }
        val heights=lines.map {line -> line.maxOfOrNull {if(it<0) more.height else chips[it].height} ?: 0}
        val total=heights.sum()+gap*(lines.size-1).coerceAtLeast(0)
        layout(width,total) {
            var y=0
            lines.forEachIndexed {li,line -> var x=0
                line.forEach {i -> val pl=if(i<0) more else chips[i];pl.placeRelative(x,y+(heights[li]-pl.height)/2);x+=pl.width+gap}
                y+=heights[li]+gap}
        }
    }
}

/** Search, two photo tiles and expandable categories: used on the fridge step and on the «Дома» tab. */
@Composable internal fun PantryBlock(m: AppModel,scope: CoroutineScope) {
    var query by remember {mutableStateOf("")}
    var open by remember {mutableStateOf(setOf<String>())}
    val have=m.have()
    val picker=rememberPhotoPicker {result -> when(result) {
        is PhotoResult.Success -> runCatching {m.scannerPhotos=appendScanPhotos(m.scannerPhotos,listOf(result))}
        is PhotoResult.Batch -> runCatching {m.scannerPhotos=appendScanPhotos(m.scannerPhotos,result.photos)}
        else -> Unit
    }}
    OutlinedTextField(query,{query=it.take(40)},placeholder={Text("Найти продукт: курица, рис, сыр…")},singleLine=true,
        shape=RoundedCornerShape(16.dp),textStyle=MaterialTheme.typography.titleMedium,modifier=Modifier.fillMaxWidth().heightIn(min=60.dp))
    if(query.isNotBlank()) {
        val found=m.catalog.ingredients.filter {it.name.contains(query.trim(),true)}.take(12)
        if(found.isEmpty()) Note("Ничего не нашли. Попробуйте по-другому.")
        FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) {found.forEach {i -> Choice((if(i.id in have) "✓ " else "+ ")+i.name,i.id in have) {m.togglePantry(scope,i.id)}}}
    }
    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
        (0..1).forEach {slot ->
            val photo=m.scannerPhotos.getOrNull(slot)
            Box(Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(16.dp)).background(MaterialTheme.colorScheme.secondaryContainer)
                .border(1.dp,MaterialTheme.colorScheme.outlineVariant,RoundedCornerShape(16.dp)).clickable {if(photo==null) picker.launch(supportsPhotoCamera)},contentAlignment=Alignment.Center) {
                if(photo!=null) {
                    val bitmap=remember(photo) {runCatching {decodePhotoPreview(photo.base64)}.getOrNull()}
                    bitmap?.let {Image(it,null,Modifier.fillMaxSize(),contentScale=ContentScale.Crop)}
                    Text("×",Modifier.align(Alignment.TopEnd).padding(6.dp).clip(RoundedCornerShape(12.dp)).background(Color.White).clickable {m.scannerPhotos=m.scannerPhotos.filterIndexed {i,_ -> i!=slot}}.padding(horizontal=8.dp),fontWeight=FontWeight.Bold)
                } else Column(horizontalAlignment=Alignment.CenterHorizontally) {
                    Text("+",fontSize=34.sp,color=MaterialTheme.colorScheme.primary)
                    Text(if(slot==0) "Фото холодильника" else "Фото полок",style=MaterialTheme.typography.labelMedium,color=Muted)
                }
            }
        }
    }
    if(m.scannerPhotos.size>2) Note("Ещё фото: ${m.scannerPhotos.size-2}")
    if(m.scannerPhotos.isNotEmpty()) {
        if(Account.current!=null && m.inventory!=null) Primary("Распознать продукты (${m.scannerPhotos.size})",!m.inventoryBusy) {m.open("home");m.scanningFridge=true}
        else Note("Распознаем продукты на фото после того, как вы сохраните меню.")
    } else Note("Сфотографируйте холодильник — распознаем продукты сами. Или отметьте вручную ниже.")
    m.inventoryError?.let {Note(it)}
    val groups=remember {m.catalog.ingredients.filter {it.id !in pantryStaples}.groupBy {it.category}.toSortedMap()}
    Surface(shape=RoundedCornerShape(16.dp),border=BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
        Column {
            groups.entries.forEachIndexed {gi,(category,list) ->
                if(gi>0) HorizontalDivider(color=MaterialTheme.colorScheme.outlineVariant)
                val count=list.count {it.id in have};val isOpen=category in open
                Row(Modifier.fillMaxWidth().clickable {open=open.toggle(category)}.padding(horizontal=14.dp,vertical=12.dp),verticalAlignment=Alignment.CenterVertically) {
                    Text(category,Modifier.weight(1f),style=MaterialTheme.typography.titleMedium)
                    if(count>0) Badge("$count")
                    Text(if(isOpen) "−" else "+",Modifier.padding(start=10.dp),fontSize=24.sp,color=MaterialTheme.colorScheme.primary)
                }
                if(isOpen) FlowRow(Modifier.padding(start=14.dp,end=14.dp,bottom=12.dp),horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                    list.sortedBy {it.name}.forEach {i -> Choice(i.name,i.id in have) {m.togglePantry(scope,i.id)}}
                }
            }
        }
    }
}

/** Days, people and what to cook for each meal. Also used in the profile. */
@Composable internal fun DetailsEditor(m: AppModel) {
    val p=m.state.profile
    Panel {
        Text("На сколько дней составить меню",style=MaterialTheme.typography.titleMedium)
        Counter("${p.days} ${plural(p.days,"день","дня","дней")}",p.days>1,p.days<7,{m.profile(p.copy(days=p.days-1))}) {m.profile(p.copy(days=p.days+1))}
        Note("Максимум — неделя.")
    }
    Panel {
        Text("Сколько человек едят",style=MaterialTheme.typography.titleMedium)
        val adults=p.members.count {!it.child};val kids=p.members.count {it.child}
        Row(verticalAlignment=Alignment.CenterVertically) {Text("Взрослые",Modifier.weight(1f))
            Counter("$adults",adults>1,adults<8,{val i=p.members.indexOfLast {!it.child};m.profile(p.copy(members=p.members.filterIndexed {j,_ -> j!=i}))}) {m.profile(p.copy(members=p.members+Member(name="",goal=p.members.first().goal)))}}
        Row(verticalAlignment=Alignment.CenterVertically) {Text("Дети",Modifier.weight(1f))
            Counter("$kids",kids>0,kids<6,{val i=p.members.indexOfLast {it.child};m.profile(p.copy(members=p.members.filterIndexed {j,_ -> j!=i}))}) {m.profile(p.copy(members=p.members+Member(name="",child=true,age=7)))}}
    }
    Panel {
        Text("Что готовим",style=MaterialTheme.typography.titleMedium)
        slotLabels.forEach {(slot,label) ->
            val current=p.mealSetup[slot] ?: defaultMealSetup.getValue(slot)
            var open by remember {mutableStateOf(false)}
            Row(verticalAlignment=Alignment.CenterVertically) {
                Text(label,Modifier.width(92.dp),style=MaterialTheme.typography.titleMedium)
                Box(Modifier.weight(1f)) {
                    OutlinedButton(onClick={open=true},Modifier.fillMaxWidth(),shape=RoundedCornerShape(12.dp)) {
                        Text(kindLabels.getValue(current),Modifier.weight(1f),maxLines=1,overflow=TextOverflow.Ellipsis,color=if(current=="none") Muted else MaterialTheme.colorScheme.onSurface);Text(" ▾")
                    }
                    DropdownMenu(open,{open=false}) {
                        kindOptions.getValue(slot).forEach {kind -> DropdownMenuItem(text={Text(kindLabels.getValue(kind))},onClick={open=false;m.profile(p.copy(mealSetup=p.mealSetup+(slot to kind)))})}
                    }
                }
            }
        }
        if(p.mealSetup.values.none {it!="none"}) Text("Выберите хотя бы один приём пищи",color=MaterialTheme.colorScheme.error)
    }
}
@Composable internal fun Counter(value: String,canMinus: Boolean,canPlus: Boolean,minus:()->Unit,plus:()->Unit) {
    Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(6.dp)) {
        OutlinedButton(onClick=minus,enabled=canMinus,shape=RoundedCornerShape(12.dp),contentPadding=PaddingValues(0.dp),modifier=Modifier.size(44.dp)) {Text("−",fontSize=20.sp)}
        Text(value,Modifier.widthIn(min=72.dp),style=MaterialTheme.typography.titleMedium,textAlign=androidx.compose.ui.text.style.TextAlign.Center)
        OutlinedButton(onClick=plus,enabled=canPlus,shape=RoundedCornerShape(12.dp),contentPadding=PaddingValues(0.dp),modifier=Modifier.size(44.dp)) {Text("+",fontSize=20.sp)}
    }
}

// ---------- Fake loader, then the first menu ----------
@Composable internal fun LoadingScreen(m: AppModel) {
    val progress=remember {Animatable(0f)}
    val texts=listOf("Учитываем цель и ограничения…","Смотрим, что есть в холодильнике…","Подбираем блюда…")
    LaunchedEffect(Unit) {
        progress.animateTo(1f,tween(2000,easing=LinearEasing))
        m.generate(nextStage=if(Account.current!=null) "app" else "ready")
    }
    Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.spacedBy(20.dp,Alignment.CenterVertically),horizontalAlignment=Alignment.CenterHorizontally) {
        Image(painterResource(Res.drawable.frigo_logo),contentDescription="Frigo",modifier=Modifier.fillMaxWidth(.8f).aspectRatio(720f/666).clip(RoundedCornerShape(28.dp)),contentScale=ContentScale.Crop)
        LinearProgressIndicator(progress={progress.value},modifier=Modifier.fillMaxWidth(.8f).height(8.dp).clip(RoundedCornerShape(4.dp)))
        Text(texts[(progress.value*texts.size).toInt().coerceAtMost(texts.lastIndex)],style=MaterialTheme.typography.titleMedium)
    }
}
@Composable internal fun ReadyScreen(m: AppModel) {
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f)) {MenuScreen(m,preview=true)}
        Column(Modifier.background(MaterialTheme.colorScheme.surface).padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
            Primary("Сохранить меню") {m.track("save_menu_tapped");m.update(m.state.copy(stage="auth"))}
            Note("Войдите, чтобы сохранить меню, список покупок и продукты.")
        }
    }
}
