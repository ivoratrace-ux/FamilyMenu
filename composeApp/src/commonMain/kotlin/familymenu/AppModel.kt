package familymenu

import androidx.compose.runtime.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.datetime.Clock
import kotlin.random.Random

/** A recipe opened for cooking: from a menu slot (slot != null) or from "cook from what you have". */
data class CookTarget(val recipe: Recipe, val servings: Int, val slot: Pair<Int, Int>? = null)
data class CartSession(val items: List<String>, val index: Int = 0, val added: Int = 0, val home: Int = 0)

class AppModel(val catalog: Catalog) {
    val engine = MenuEngine(catalog)
    var persistenceError by mutableStateOf<String?>(null)
    var state by mutableStateOf(runCatching { loadState()?.let { appJson.decodeFromString<AppState>(it) } }.getOrNull() ?: AppState())
        private set
    var loadedAccountId by mutableStateOf<String?>(null)
    var accountReady by mutableStateOf(false)
    var remoteRevision by mutableStateOf(0L)
    var changeNumber by mutableStateOf(0L)
    var savedNumber by mutableStateOf(0L)
    var syncConflict by mutableStateOf(false)
    init { syncRecipes() }
    private fun syncRecipes() { catalog.byRecipe.extra = state.myRecipes.associateBy { it.id } }
    fun applyDocument(document: UserDocument) {
        val prefs = document.preferences
        val local = state
        // A new account takes over the menu and answers made before signing in.
        val adopt = prefs == null && document.menu == null && local.onboarded
        state = if (adopt) local.copy(stage = "app") else prefs?.copy(plan = document.menu, stage = if (prefs.onboarded || document.menu != null) "app" else "quiz", pantryDraft = local.pantryDraft) ?: AppState(stage = "quiz", pantryDraft = local.pantryDraft)
        syncRecipes()
        loadedAccountId = Account.current?.user?.id; remoteRevision = document.revision; changeNumber = if (adopt) 1 else 0; savedNumber = 0; accountReady = true; syncConflict = false; persistenceError = null
    }
    fun resetAccount() {
        state = AppState(stage = "auth"); syncRecipes(); accountReady = false; loadedAccountId = null; changeNumber = 0; savedNumber = 0; persistenceError = null
        tab = "menu"; menuDay = 0; page = null; scannerPhotos = emptyList(); scannerProducts = emptyList(); timers.clear(); inventory = null; saveState("")
    }

    // Navigation: five tabs; a page is a sub-screen opened over its tab with a back arrow.
    var tab by mutableStateOf("menu")
    var menuDay by mutableStateOf(0)
    var page by mutableStateOf<String?>(null)
    var pageParent by mutableStateOf<String?>(null)
    fun open(target: String) { if (target in setOf("menu", "shop", "home", "profile")) { tab = target; page = null } else { pageParent = tab; page = target }; track("screen", target) }
    fun back() { page = null }

    // Overlays
    var selectedSlot by mutableStateOf<Pair<Int, Int>?>(null)
    var replacement by mutableStateOf<Pair<Int, Int>?>(null)
    var swapSource by mutableStateOf<Pair<Int, Int>?>(null)
    var cooking by mutableStateOf<CookTarget?>(null)
    var nowRecipe by mutableStateOf<Recipe?>(null)
    var nowMain by mutableStateOf<String?>(null)
    var nowServings by mutableStateOf(0)
    var pantryPicker by mutableStateOf(false)
    var cart by mutableStateOf<CartSession?>(null)
    var share by mutableStateOf(false)
    var scanningFridge by mutableStateOf(false)
    var onboardingStep by mutableStateOf(0)
    var weekFromApp by mutableStateOf(false)
    var editRecipe by mutableStateOf<String?>(null)

    // Scanner (unchanged from the fridge scanner flow)
    var scannerPhotos by mutableStateOf<List<PhotoResult.Success>>(emptyList())
    var scannerProducts by mutableStateOf<List<ScanProduct>>(emptyList())
    var scanning by mutableStateOf(false)
    var scanMessage by mutableStateOf("Сфотографируйте холодильник — найдём продукты и оценим количество.")
    val timers = mutableStateMapOf<String, CookingTimer>()

    // Stock at home lives on the server per account; the client keeps the last snapshot.
    val inventoryService = InventoryService()
    var inventory by mutableStateOf<InventorySnapshot?>(null)
    var inventoryBusy by mutableStateOf(false)
    var inventoryError by mutableStateOf<String?>(null)
    private val inventoryLock = Mutex()
    fun have(): Set<String> = inventory?.items?.map { it.ingredientId }?.toSet() ?: state.pantryDraft
    fun stock(id: String): Double = inventory?.items?.firstOrNull { it.ingredientId == id }?.quantity ?: 0.0
    private fun inventoryJob(scope: CoroutineScope, action: suspend () -> Unit) {
        scope.launch {
            inventoryLock.withLock {
                inventoryBusy = true
                try { action(); inventoryError = null }
                catch (e: CancellationException) { throw e }
                catch (e: InventoryConflict) { inventoryError = e.message; runCatching { inventory = inventoryService.load() } }
                catch (e: SignInRequired) { resetAccount() }
                catch (e: Exception) { inventoryError = "Не удалось обновить «Что есть дома». Проверьте интернет и повторите." }
                finally { inventoryBusy = false }
            }
        }
    }
    fun loadInventory(scope: CoroutineScope) = inventoryJob(scope) { inventory = inventoryService.load() }
    /** Products marked before signing in; saved to the account's stock right after sign-in. */
    fun flushDraft(scope: CoroutineScope) {
        val draft = state.pantryDraft; if (draft.isEmpty()) return
        inventoryJob(scope) {
            var current = inventory ?: inventoryService.load()
            draft.filter { id -> current.items.none { it.ingredientId == id } && id in catalog.byIngredient }.forEach { current = inventoryService.edit(current.revision, it, defaultStock(it)) }
            inventory = current; update(state.copy(pantryDraft = emptySet()))
        }
    }
    fun togglePantry(scope: CoroutineScope, id: String) { if (Account.current == null) update(state.copy(pantryDraft = state.pantryDraft.toggle(id))) else togglePantryRemote(scope, id) }
    private fun togglePantryRemote(scope: CoroutineScope, id: String) = inventoryJob(scope) {
        val current = inventory ?: inventoryService.load()
        inventory = if (current.items.any { it.ingredientId == id }) inventoryService.delete(current.revision, id)
        else inventoryService.edit(current.revision, id, defaultStock(id))
    }
    fun setStock(scope: CoroutineScope, id: String, quantity: Double) = inventoryJob(scope) {
        val current = inventory ?: inventoryService.load()
        inventory = if (quantity <= 0) inventoryService.delete(current.revision, id) else inventoryService.edit(current.revision, id, quantity)
    }
    /** After cooking from what you have: subtract what the dish used from the stock. */
    fun useUp(scope: CoroutineScope, recipe: Recipe, servings: Int) = inventoryJob(scope) {
        var current = inventory ?: inventoryService.load()
        recipe.ingredients.forEach { q ->
            val left = current.items.firstOrNull { it.ingredientId == q.id }?.quantity ?: return@forEach
            val rest = kotlin.math.round((left - q.quantity * servings / recipe.servings) * 1000) / 1000
            current = if (rest <= 0) inventoryService.delete(current.revision, q.id) else inventoryService.edit(current.revision, q.id, rest)
        }
        inventory = current
        update(state.copy(extraBuy = state.extraBuy - recipe.ingredients.map { it.id }.toSet()))
        track("now_used_up", recipe.id)
    }
    fun defaultStock(id: String): Double {
        val i = catalog.byIngredient[id] ?: return 1.0
        return when {
            id == "potato" -> 2000.0
            i.unit !in listOf("g", "ml") -> if (id == "eggs") 10.0 else 1.0
            i.category == "Мясо и рыба" -> 1000.0
            i.unit == "ml" -> 1000.0
            else -> 800.0
        }
    }

    fun update(next: AppState) {
        val recipesChanged = next.myRecipes !== state.myRecipes
        state = next
        if (recipesChanged) syncRecipes()
        if (Account.current != null) { if (accountReady) changeNumber++; return }
        runCatching { saveState(appJson.encodeToString(next)) }.onFailure { persistenceError = "Не удалось сохранить данные на устройстве. Они доступны до закрытия приложения." }
    }
    fun track(name: String, detail: String = "") {
        val event = AppEvent(Clock.System.now().toString(), name, detail.take(80))
        state = state.copy(events = (state.events + event).takeLast(300))
        if (Account.current != null && accountReady) changeNumber++
    }
    fun profile(profile: Profile) = update(state.copy(profile = profile))
    fun finishOnboarding() {
        if (!state.onboarded || state.premiumStart == null) {
            update(state.copy(onboarded = true, stage = "app"))
            track("onboarding_done", "${state.profile.members.size} чел.")
        } else update(state.copy(stage = "app"))
    }
    fun generate(nextStage: String = "app") {
        update(state.copy(onboarded = true, stage = nextStage, plan = engine.generate(state, state.today()), bought = emptySet(), eaten = emptySet()))
        track("menu_built", "${state.profile.days} дн.")
        tab = "menu"; page = null; menuDay = 0
    }
    fun recipePosition(day: Int, index: Int): Pair<Int, Int> {
        val plan = state.plan ?: return day to index
        val slot = plan.days[day].slots[index]
        if (slot.leftover && day > 0) {
            val source = plan.days[day - 1].slots.indexOfFirst { it.meal == slot.meal }
            if (source >= 0) return day - 1 to source
        }
        return day to index
    }
    fun changeSlot(day: Int, index: Int, change: (Slot) -> Slot) {
        val plan = state.plan ?: return
        update(state.copy(plan = plan.copy(days = plan.days.mapIndexed { d, v -> if (d == day) v.copy(slots = v.slots.mapIndexed { i, s -> if (i == index) change(s) else s }) else v })))
    }
    fun replace(day: Int, index: Int, recipe: Recipe) {
        val plan = state.plan ?: return
        val old = plan.days[day].slots[index]
        val keep = old.meal == "l" && state.profile.soupBatch && day % 2 == 0 && day < 6 && recipe.meal == "m" && "salad" !in recipe.tags
        val days = plan.days.mapIndexed { di, d ->
            when {
                di == day -> d.copy(slots = d.slots.mapIndexed { si, s -> if (si == index) s.copy(recipeId = recipe.id, servings = state.profile.portions() * if (keep) 2 else 1, leftover = false, cooked = false) else s })
                di == day + 1 && !old.leftover -> d.copy(slots = d.slots.map { s ->
                    if (s.meal == old.meal && s.leftover) {
                        if (keep) s.copy(recipeId = recipe.id, cooked = false)
                        else s.copy(recipeId = engine.pick(s.meal, state, mutableMapOf(), false, Random.Default)?.id, leftover = false, cooked = false)
                    } else s
                })
                else -> d
            }
        }
        update(state.copy(plan = plan.copy(days = days, approved = false), eaten = emptySet()))
        track("dish_replaced", recipe.id)
        replacement = null
    }
    fun swap(target: Pair<Int, Int>) {
        val source = swapSource ?: return; val plan = state.plan ?: return
        val a = plan.days[source.first].slots[source.second]; val b = plan.days[target.first].slots[target.second]
        // Leftovers depend on their source meal and cannot be moved independently.
        if (a.leftover || b.leftover || a.servings > state.profile.portions() || b.servings > state.profile.portions()) { swapSource = null; return }
        update(state.copy(plan = plan.copy(approved = false, days = plan.days.mapIndexed { di, d -> d.copy(slots = d.slots.mapIndexed { si, s ->
            when (di to si) { source -> s.copy(recipeId = b.recipeId, cooked = false); target -> s.copy(recipeId = a.recipeId, cooked = false); else -> s }
        }) }), eaten = emptySet()))
        swapSource = null
    }
    fun eatKey(day: Int, index: Int) = "${state.plan!!.days[day].date}:${state.plan!!.days[day].slots[index].meal}"
    fun toggleEat(day: Int, index: Int) = update(state.copy(eaten = state.eaten.toggle(eatKey(day, index))))
    fun startTimer(key: String, seconds: Int) { timers[key] = CookingTimer(seconds, Clock.System.now().toEpochMilliseconds() + seconds * 1000L) }
    fun portionsNow() = if (nowServings > 0) nowServings else state.profile.portions()
}
fun <T> Set<T>.toggle(value: T) = if (value in this) this - value else this + value
data class CookingTimer(val total: Int, val endAt: Long, val paused: Int? = null, val done: Boolean = false) {
    fun remaining(now: Long) = (paused ?: ((endAt - now + 999) / 1000).toInt()).coerceAtLeast(0)
}
