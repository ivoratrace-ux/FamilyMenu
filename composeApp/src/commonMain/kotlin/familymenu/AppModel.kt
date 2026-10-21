package familymenu

import androidx.compose.runtime.*
import kotlinx.datetime.Clock
import kotlin.random.Random

class AppModel(val catalog: Catalog) {
    val engine = MenuEngine(catalog)
    var persistenceError by mutableStateOf<String?>(null)
    var state by mutableStateOf(runCatching { loadState()?.let { appJson.decodeFromString<AppState>(it) } }.getOrNull() ?: AppState())
        private set
    var tab by mutableStateOf("today")
    var page by mutableStateOf<String?>(null)
    var selectedSlot by mutableStateOf<Pair<Int,Int>?>(null)
    var replacement by mutableStateOf<Pair<Int,Int>?>(null)
    var swapSource by mutableStateOf<Pair<Int,Int>?>(null)
    var scannerProducts by mutableStateOf<List<ScanProduct>>(emptyList())
    var scanning by mutableStateOf(false)
    var scanMessage by mutableStateOf("Сфотографируйте холодильник — найдём продукты и оценим количество.")
    val timers = mutableStateMapOf<String, CookingTimer>()
    fun update(next: AppState) {
        state = next
        runCatching { saveState(appJson.encodeToString(next)) }.onFailure { persistenceError = "Не удалось сохранить данные на устройстве. Они доступны до закрытия приложения." }
    }
    fun profile(profile: Profile) = update(state.copy(profile=profile))
    fun generate() {
        update(state.copy(stage="app",plan=engine.generate(state),bought=emptySet(),eaten=emptySet()))
        tab="menu"; page=null
    }
    fun demo() {
        profile(Profile(members=listOf(Member("Маша",sex="f",age=34,weight=62,height=166,goal="lose"),Member("Дима",sex="m",age=37,weight=84,height=182,activity="high"),Member("Соня",true,"f",8),Member("Лёва",true,"m",4)),budget=12000,meals=setOf("b","l","s","d","k"),likes=setOf("t:kids","t:quick","t:soup","i:chicken_fillet","i:buckwheat"),dislikes=setOf("mushrooms"),goals=setOf("pp")))
        generate()
    }
    fun recipePosition(day: Int,index: Int): Pair<Int,Int> {
        val plan=state.plan ?: return day to index
        val slot=plan.days[day].slots[index]
        if(slot.leftover && day>0) {
            val source=plan.days[day-1].slots.indexOfFirst {it.meal==slot.meal}
            if(source>=0) return day-1 to source
        }
        return day to index
    }
    fun changeSlot(day: Int, index: Int, change: (Slot)->Slot) {
        val plan=state.plan ?: return
        update(state.copy(plan=plan.copy(days=plan.days.mapIndexed { d, v -> if(d==day) v.copy(slots=v.slots.mapIndexed { i,s -> if(i==index) change(s) else s }) else v })))
    }
    fun replace(day: Int,index: Int,recipe: Recipe) {
        val plan=state.plan ?: return
        val old=plan.days[day].slots[index]
        val keep=old.meal=="l" && state.profile.soupBatch && day%2==0 && day<6 && recipe.meal=="m" && "salad" !in recipe.tags
        val days=plan.days.mapIndexed { di,d ->
            when {
                di==day -> d.copy(slots=d.slots.mapIndexed { si,s -> if(si==index) s.copy(recipeId=recipe.id,servings=state.profile.portions() * if(keep) 2 else 1,leftover=false,cooked=false) else s })
                di==day+1 && !old.leftover -> d.copy(slots=d.slots.map { s ->
                    if(s.meal==old.meal && s.leftover) {
                        if(keep) s.copy(recipeId=recipe.id,cooked=false)
                        else s.copy(recipeId=engine.pick(s.meal,state,mutableMapOf(),false,Random.Default)?.id,leftover=false,cooked=false)
                    } else s
                })
                else -> d
            }
        }
        update(state.copy(plan=plan.copy(days=days,approved=false),eaten=emptySet()))
        replacement=null
    }
    fun swap(target: Pair<Int,Int>) {
        val source=swapSource ?: return; val plan=state.plan ?: return
        val a=plan.days[source.first].slots[source.second];val b=plan.days[target.first].slots[target.second]
        // Leftovers depend on their source meal and cannot be moved independently.
        if(a.leftover || b.leftover || a.servings>state.profile.portions() || b.servings>state.profile.portions()) { swapSource=null; return }
        update(state.copy(plan=plan.copy(approved=false,days=plan.days.mapIndexed { di,d -> d.copy(slots=d.slots.mapIndexed { si,s ->
            when(di to si) {source -> s.copy(recipeId=b.recipeId,cooked=false); target -> s.copy(recipeId=a.recipeId,cooked=false); else -> s}
        }) }),eaten=emptySet()))
        swapSource=null
    }
    fun eatKey(day: Int,index: Int) = "${state.plan!!.days[day].date}:${state.plan!!.days[day].slots[index].meal}"
    fun toggleEat(day: Int,index: Int) = update(state.copy(eaten=state.eaten.toggle(eatKey(day,index))))
    fun startTimer(key: String,seconds: Int) { timers[key]=CookingTimer(seconds,Clock.System.now().toEpochMilliseconds()+seconds*1000L) }
}
fun <T> Set<T>.toggle(value: T) = if(value in this) this-value else this+value
data class CookingTimer(val total: Int, val endAt: Long, val paused: Int? = null, val done: Boolean = false) {
    fun remaining(now: Long) = (paused ?: ((endAt-now+999)/1000).toInt()).coerceAtLeast(0)
}
