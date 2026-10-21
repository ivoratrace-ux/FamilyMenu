package familymenu

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.datetime.*
import kotlin.math.*
import kotlin.random.Random

val appJson = Json { ignoreUnknownKeys = true; encodeDefaults = true }

@Serializable data class Ingredient(val id: String, val name: String, val category: String, val unit: String,
    val price: Double, val allergens: List<String>, val flags: List<String>, val nutrition: List<Double>,
    val lavkaPrice: Double? = null, val lavkaPath: String? = null, val description: String = "")
@Serializable data class Quantity(val id: String, val quantity: Double)
@Serializable data class Recipe(val id: String, val name: String, val meal: String, val minutes: Int,
    val tags: List<String>, val ingredients: List<Quantity>, val spices: List<String>, val steps: List<String>,
    val stepSeconds: List<Int> = emptyList(), val stepTips: List<String> = emptyList(),
    val description: String = "", val imageUrl: String? = null, val stepImageUrls: List<String?> = emptyList(), val servings: Int = 4)
@Serializable data class Promo(val name: String, val price: Int, val regularPrice: Int, val condition: String, val until: String)
@Serializable data class Food(val stems: List<String>, val kcal: Double, val piece: Double, val portion: Double)
@Serializable data class Catalog(val ingredients: List<Ingredient>, val recipes: List<Recipe>, val promos: List<Promo>, val foods: List<Food>) {
    val byIngredient by lazy { ingredients.associateBy { it.id } }
    val byRecipe by lazy { recipes.associateBy { it.id } }
    fun flags(r: Recipe) = r.ingredients.flatMap { byIngredient.getValue(it.id).flags }.toSet()
    fun allergens(r: Recipe) = r.ingredients.flatMap { byIngredient.getValue(it.id).allergens }.toSet()
    fun nutrition(r: Recipe): List<Double> = (0..3).map { n -> r.ingredients.sumOf {
        val i = byIngredient.getValue(it.id)
        i.nutrition[n] * it.quantity / (if (i.unit in listOf("g", "ml")) 100 else 1) / r.servings
    } }
    fun cost(r: Recipe, store: String, city: String) = r.ingredients.sumOf { price(byIngredient.getValue(it.id), store, city) * it.quantity } / r.servings
    fun protein(r: Recipe) = r.ingredients.firstOrNull { q -> byIngredient.getValue(q.id).flags.any { it in listOf("meat", "fish", "seafood") } }?.id
    fun parseFood(raw: String): Int? {
        val text = raw.lowercase().replace('ё', 'е').trim()
        if (Regex("^\\d+(?:[.,]\\d+)?\\s*(?:ккал)?$").matches(text)) return text.substringBefore(' ').replace(',', '.').toDoubleOrNull()?.roundToInt()
        val food = foods.flatMap { f -> f.stems.map { it to f } }.filter { (stem, _) -> Regex("(^|[^а-яa-z])${Regex.escape(stem.replace('ё','е'))}").containsMatchIn(text) }.maxByOrNull { it.first.length }?.second ?: return null
        val amount = Regex("^([0-9]+(?:[.,][0-9]+)?)").find(text)?.groupValues?.get(1)?.replace(',', '.')?.toDoubleOrNull() ?: 1.0
        val grams = when {
            Regex("\\d\\s*кг").containsMatchIn(text) -> amount * 1000
            Regex("\\d\\s*(грамм(?:а|ов)?|гр|г|мл)(?=\\s|$|[.,])").containsMatchIn(text) -> amount
            Regex("\\d\\s*л(?=\\s|$|[.,])").containsMatchIn(text) -> amount * 1000
            else -> amount * (food.piece.takeIf { it > 0 } ?: food.portion)
        }
        return (food.kcal * grams / 100).roundToInt().takeIf { it >= 0 }
    }
}

val allergies = linkedMapOf("gluten" to "Глютен", "milk" to "Белок молока", "lactose" to "Лактоза", "egg" to "Яйца", "fish" to "Рыба", "crustacean" to "Креветки", "mollusc" to "Моллюски", "peanut" to "Арахис", "nuts" to "Орехи", "soy" to "Соя", "sesame" to "Кунжут", "mustard" to "Горчица", "celery" to "Сельдерей", "citrus" to "Цитрусовые", "honey" to "Мёд")
val diets = linkedMapOf("all" to "Обычное", "halal" to "Без свинины", "pesc" to "Без мяса", "veg" to "Вегетарианское", "vegan" to "Веганское", "lent" to "Постное")
val goals = linkedMapOf("pp" to "Правильное питание", "protein" to "Белковое", "lose" to "Похудение", "mass" to "Набор массы", "lowcarb" to "Меньше углеводов")
val mealLabels = linkedMapOf("b" to "Завтрак", "l" to "Обед", "s" to "Перекус", "d" to "Ужин", "z" to "Десерт", "k" to "Напиток")
val cityNames = linkedMapOf("msk" to "Москва", "mo" to "Московская область", "spb" to "Санкт-Петербург", "kgd" to "Калининград", "kzn" to "Казань", "khv" to "Хабаровск", "oms" to "Омск", "sar" to "Саратов", "other" to "Другой город")
val cityCoefficients = mapOf("msk" to 1.0, "mo" to .92, "spb" to .97, "kgd" to .985, "kzn" to .74, "khv" to 1.12, "oms" to .725, "sar" to .71, "other" to .845)
fun price(i: Ingredient, store: String, city: String) = (if (store == "lavka") i.lavkaPrice ?: i.price else i.price) * (cityCoefficients[city] ?: 1.0)
fun today(): LocalDate = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault()).date
fun dateLabel(date: String): String {
    val d = LocalDate.parse(date)
    val days = listOf("Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье")
    val months = listOf("янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек")
    return "${days[d.dayOfWeek.ordinal]}, ${d.dayOfMonth} ${months[d.monthNumber-1]}"
}
fun money(v: Double) = "${v.roundToInt()} ₽"
fun quantity(i: Ingredient, amount: Double): String = when {
    i.unit == "g" && amount >= 1000 -> "${(amount / 100).roundToInt() / 10.0} кг"
    i.unit == "ml" && amount >= 1000 -> "${(amount / 100).roundToInt() / 10.0} л"
    i.unit == "g" -> "${amount.roundToInt()} г"
    i.unit == "ml" -> "${amount.roundToInt()} мл"
    else -> "${ceil(amount).toInt()} ${i.unit}"
}

@Serializable data class Member(val name: String = "Я", val child: Boolean = false, val sex: String = "", val age: Int = 30,
    val weight: Int = 65, val height: Int = 170, val activity: String = "mid", val goal: String = "keep", val customCalories: Int = 0) {
    fun calories(): Int {
        if (customCalories > 0) return customCalories
        val activityFactor = mapOf("low" to 1.2, "mid" to 1.375, "high" to 1.55, "sport" to 1.725)[activity] ?: 1.375
        val base = if (child) when { age <= 3 -> 1200.0; age <= 6 -> 1600.0; age <= 10 -> 1900.0; age <= 14 -> if (sex == "m") 2400.0 else 2200.0; else -> if (sex == "m") 2800.0 else 2300.0 } * activityFactor / 1.375
        else if (sex.isNotEmpty()) (10 * weight + 6.25 * height - 5 * age + if (sex == "m") 5 else -161) * activityFactor * when(goal) {"lose" -> .85; "gain" -> 1.15; else -> 1.0}
        else 2200.0 * activityFactor / 1.375
        return ((base / 50).roundToInt() * 50).coerceAtLeast(500)
    }
    fun portionFactor() = ((calories() / 2200.0 * 10).roundToInt() / 10.0).coerceIn(.4,1.6)
}
@Serializable data class Profile(val members: List<Member> = listOf(Member(), Member("Партнёр"), Member("Ребёнок", true, age=7)),
    val allergies: Set<String> = emptySet(), val diet: String = "all", val likes: Set<String> = setOf("t:kids", "i:chicken_fillet"),
    val dislikes: Set<String> = emptySet(), val goals: Set<String> = emptySet(), val budget: Int = 8000,
    val city: String = "msk", val maxTime: Int = 45, val meals: Set<String> = setOf("l","d"), val soupBatch: Boolean = true,
    val reminder: Boolean = true, val reminderTime: String = "20:00") {
    fun portions() = ceil(members.sumOf { it.portionFactor() } - .05).toInt().coerceAtLeast(1)
}
@Serializable data class Slot(val meal: String, val recipeId: String? = null, val servings: Int = 1, val leftover: Boolean = false, val cooked: Boolean = false)
@Serializable data class Day(val date: String, val slots: List<Slot>)
@Serializable data class Plan(val days: List<Day>, val approved: Boolean = false)
@Serializable data class ExtraFood(val label: String, val calories: Int)
@Serializable data class AppState(val stage: String = "intro", val profile: Profile = Profile(), val plan: Plan? = null,
    val bought: Set<String> = emptySet(), val eaten: Set<String> = emptySet(), val liked: Set<String> = emptySet(),
    val disliked: Set<String> = emptySet(), val blocked: Set<String> = emptySet(), val extra: Map<String, List<ExtraFood>> = emptyMap(),
    val store: String = "vv", val theme: String = "system", val reminderShown: String = "")
data class ShoppingItem(val ingredient: Ingredient, val amount: Double, val dishes: Set<String>, val cost: Double)

class MenuEngine(val catalog: Catalog) {
    fun allowed(r: Recipe, state: AppState): Boolean {
        val p = state.profile; val flags = catalog.flags(r)
        val forbidden = when (p.diet) {
            "halal" -> setOf("pork"); "pesc" -> setOf("meat"); "veg" -> setOf("meat","fish","seafood")
            "vegan" -> setOf("meat","fish","seafood","dairy","egg","honey"); "lent" -> setOf("meat","dairy","egg"); else -> emptySet()
        }
        return catalog.allergens(r).none { it in p.allergies } && flags.none { it in forbidden } &&
            r.ingredients.none { it.id in p.dislikes } && r.id !in state.blocked
    }
    fun pool(meal: String, state: AppState): List<Recipe> {
        val type = if (meal in listOf("l","d")) "m" else meal
        val all = catalog.recipes.filter { it.meal == type && allowed(it,state) }
        return if (meal in listOf("l","d")) all.filter { ("soup" in it.tags) == (meal == "l") }.ifEmpty { all } else all
    }
    fun score(r: Recipe, state: AppState, previousProtein: String? = null, meal: String? = null): Double {
        val p = state.profile; val n = catalog.nutrition(r); val factor = if(r.meal == "b") .7 else 1.0
        var score = p.likes.count { if(it.startsWith("i:")) r.ingredients.any { q -> q.id == it.drop(2) } else it.drop(2) in r.tags } * 2.0
        if(r.id in state.liked) score += 1.5
        if(r.id in state.disliked) score -= 3
        if("protein" in p.goals) score += if(n[1]>=30*factor) 3 else if(n[1]<15*factor) -2 else 0
        if("lowcarb" in p.goals) score += if(n[3]<=25*factor) 3 else if(n[3]>60*factor) -3 else 0
        if("lose" in p.goals) score += if(n[0]<=450*factor) 3 else if(n[0]>650*factor) -3 else 0
        if("mass" in p.goals) score += (if(n[0]>=600*factor) 2 else if(n[0]<400*factor) -2 else 0) + (if(n[1]>=30*factor) 1 else 0)
        val veg = r.ingredients.filter { catalog.byIngredient.getValue(it.id).category == "Овощи и зелень" && catalog.byIngredient.getValue(it.id).unit == "g" }.sumOf { it.quantity } / r.servings
        if("pp" in p.goals) score += (if(n[0] in 300*factor..650*factor && n[2]<=25*factor) 1 else 0) + (if(veg>=100) 1 else 0) - (if(n[2]>35) 1 else 0)
        val meals = p.meals.sumOf { when(it) {"l" -> if(p.soupBatch) .5 else 1.0; "s","z" -> .3; "k" -> .2; else -> 1.0} }.coerceAtLeast(1.0)
        val target = p.budget / (7 * meals * p.portions())
        val cost = catalog.cost(r,state.store,p.city) * if(r.meal in listOf("b","m")) 1 else 3
        if(cost>target) score -= min(4.0,(cost-target)/target*3)
        if(previousProtein != null && catalog.protein(r) == previousProtein) score -= 2
        if(meal=="d" && catalog.protein(r)!=null && "salad" !in r.tags) score += 1.5
        return score
    }
    fun pick(meal: String, state: AppState, used: MutableMap<String,Int>, weekend: Boolean, random: Random, previousProtein: String? = null): Recipe? {
        var candidates = pool(meal,state)
        if(candidates.isEmpty()) return null
        val timed = candidates.filter { it.minutes <= state.profile.maxTime + if(weekend) 30 else 0 }
        if(timed.isNotEmpty()) candidates = timed
        val minimum = candidates.minOf { used[it.id] ?: 0 }
        val top = candidates.filter { (used[it.id] ?: 0) == minimum }.map { it to (score(it,state,previousProtein,meal) + random.nextDouble()*1.6) }.sortedByDescending {it.second}.take(3).map {it.first}
        val chosen = top.random(random); used[chosen.id] = (used[chosen.id] ?: 0)+1
        return chosen
    }
    fun generate(state: AppState, start: LocalDate = today(), random: Random = Random.Default): Plan {
        val used = mutableMapOf<String,Int>(); var previousProtein: String? = null
        val days = mutableListOf<Day>(); val p = state.profile
        repeat(7) { index ->
            val date = start.plus(index, DateTimeUnit.DAY)
            val slots = mealLabels.keys.filter { it in p.meals }.map { meal ->
                val previous = days.lastOrNull()?.slots?.find { it.meal == "l" }
                val previousRecipe = previous?.recipeId?.let { catalog.byRecipe[it] }
                val keep = meal == "l" && p.soupBatch && index % 2 == 1 && previousRecipe?.meal == "m" && "salad" !in previousRecipe.tags
                if(keep) Slot(meal, previous!!.recipeId,p.portions(),true)
                else {
                    val recipe = pick(meal,state,used,date.dayOfWeek in listOf(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY),random,if(meal=="d") previousProtein else null)
                    if(meal=="d") previousProtein = recipe?.let(catalog::protein)
                    val batch = meal=="l" && p.soupBatch && index%2==0 && index<6 && recipe?.meal=="m" && "salad" !in recipe.tags
                    Slot(meal,recipe?.id,p.portions() * if(batch) 2 else 1)
                }
            }
            days += Day(date.toString(),slots)
        }
        return Plan(days)
    }
    fun shopping(state: AppState): List<ShoppingItem> {
        val amounts = mutableMapOf<String,Double>(); val dishes = mutableMapOf<String,MutableSet<String>>()
        state.plan?.days?.flatMap { it.slots }?.filter { !it.leftover }?.forEach { slot ->
            catalog.byRecipe[slot.recipeId]?.let { r -> r.ingredients.forEach { q ->
                amounts[q.id] = (amounts[q.id] ?: 0.0) + q.quantity * slot.servings / r.servings
                dishes.getOrPut(q.id) { mutableSetOf() }.add(r.name)
            } }
        }
        return amounts.map { (id,amount) ->
            val i = catalog.byIngredient.getValue(id); val buy = if(i.unit in listOf("g","ml")) amount else ceil(amount-.001)
            ShoppingItem(i,buy,dishes.getValue(id),buy*price(i,state.store,state.profile.city))
        }.sortedWith(compareBy({it.ingredient.category},{it.ingredient.name}))
    }
}
