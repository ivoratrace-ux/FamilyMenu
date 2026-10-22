package familymenu

import kotlinx.coroutines.runBlocking
import kotlinx.datetime.LocalDate
import kotlin.random.Random
import kotlin.test.*

class MenuIntegrationTest {
    private val catalog = runBlocking {appJson.decodeFromString<Catalog>(javaClass.getResourceAsStream("/catalog.seed.json")!!.bufferedReader().use { it.readText() })}
    private val engine = MenuEngine(catalog)
    @Test fun originalCatalogIsCompleteAndAllReferencesResolve() {
        assertEquals(175,catalog.recipes.size)
        assertEquals(86,catalog.ingredients.size)
        assertEquals(175,catalog.recipes.map {it.id}.toSet().size)
        catalog.recipes.forEach {r ->
            assertTrue(r.steps.isNotEmpty());assertEquals(r.steps.size,r.stepSeconds.size)
            assertEquals(r.steps.size,r.stepTips.size)
            assertTrue(r.ingredients.all {it.id in catalog.byIngredient && it.quantity>0})
            assertTrue(catalog.nutrition(r).all {it>=0 && it.isFinite()})
            assertTrue(java.io.File("../backend/public/art/${r.id}.png").length()>100)
        }
    }
    @Test fun weeklyMenuHonorsHardExclusionsAcrossSeeds() {
        val state=AppState(profile=Profile(diet="vegan",allergies=setOf("nuts","soy"),dislikes=setOf("mushrooms"),days=7,mealSetup=mapOf("b" to "breakfast","l" to "soup","s" to "dessert","d" to "pair")))
        repeat(12) {seed ->
            val plan=engine.generate(state,LocalDate(2026,10,21),Random(seed))
            assertEquals(7,plan.days.size)
            plan.days.flatMap {it.slots}.mapNotNull {catalog.byRecipe[it.recipeId]}.forEach {r ->
                assertTrue(engine.allowed(r,state))
                assertTrue(catalog.flags(r).none {it in setOf("meat","fish","seafood","dairy","egg","honey")})
            }
        }
    }
    @Test fun unavailableRecipesDoNotSilentlyIgnoreAllergies() {
        val state=AppState(profile=Profile(allergies=allergies.keys,dislikes=catalog.ingredients.map {it.id}.toSet(),meals=setOf("b","l","d")))
        val plan=engine.generate(state,LocalDate(2026,10,21),Random(3))
        assertTrue(plan.days.flatMap {it.slots}.all {it.recipeId==null && !it.leftover})
    }
    @Test fun shoppingAggregatesBatchOnceAndUsesServings() {
        val recipe=catalog.byRecipe.getValue("b2")
        val state=AppState(plan=Plan(listOf(Day("2026-10-21",listOf(Slot("b",recipe.id,8))),Day("2026-10-22",listOf(Slot("b",recipe.id,4,true))))))
        val shopping=engine.shopping(state)
        assertEquals(recipe.ingredients.size,shopping.size)
        recipe.ingredients.forEach {q ->
            val item=shopping.single {it.ingredient.id==q.id}
            assertEquals(q.quantity*2,item.amount,.001)
        }
    }
    @Test fun dinnerPairsMainWithSideAndDaysFollowProfile() {
        val state=AppState(profile=Profile(days=3,mealSetup=mapOf("b" to "none","l" to "soup","s" to "none","d" to "pair")))
        val plan=engine.generate(state,LocalDate(2026,10,21),Random(7))
        assertEquals(3,plan.days.size)
        plan.days.forEach {day ->
            assertEquals(listOf("l","d"),day.slots.map {it.meal})
            assertTrue("soup" in catalog.byRecipe.getValue(day.slots[0].recipeId!!).tags)
            val dinner=day.slots[1].recipeId!!
            assertTrue(dinner.startsWith("c:"),dinner)
            val combo=catalog.byRecipe.getValue(dinner)
            assertTrue(combo.steps.first().startsWith("Гарнир."))
            assertTrue(engine.shopping(AppState(plan=Plan(listOf(day)))).isNotEmpty())
        }
    }
    @Test fun userRecipesJoinThePool() {
        val mine=Recipe(id="u-test",name="Бабушкин борщ",meal="m",minutes=60,tags=listOf("soup","mine"),ingredients=listOf(Quantity("potato",300.0)),spices=emptyList(),steps=listOf("Сварить"))
        val state=AppState(myRecipes=listOf(mine))
        assertTrue(engine.poolKind("soup",state).any {it.id=="u-test"})
        assertFalse(engine.poolKind("soup",state.copy(profile=Profile(dislikes=setOf("potato")))).any {it.id=="u-test"})
    }
    @Test fun storesAndCitiesChangeCostsWithoutChangingAmounts() {
        val plan=engine.generate(AppState(),LocalDate(2026,10,21),Random(2))
        val state=AppState(plan=plan)
        val moscow=engine.shopping(state)
        val kazan=engine.shopping(state.copy(profile=state.profile.copy(city="kzn")))
        assertEquals(moscow.map {it.amount},kazan.map {it.amount})
        assertEquals(moscow.sumOf {it.cost}*.74,kazan.sumOf {it.cost},.001)
    }
    @Test fun userStateRoundTripsWithoutScannerData() {
        val state=AppState(stage="app",profile=Profile(diet="veg"),plan=engine.generate(AppState(),LocalDate(2026,10,21),Random(5)),bought=setOf("milk"),theme="dark")
        val json=appJson.encodeToString(state)
        assertEquals(state,appJson.decodeFromString<AppState>(json))
        assertFalse("base64" in json);assertFalse("scannerProducts" in json)
    }
    @Test fun localFoodDictionaryRecognizesAmounts() {
        assertEquals(107,catalog.parseFood("1 банан"))
        assertEquals(89,catalog.parseFood("100 г банана"))
        assertEquals(250,catalog.parseFood("250 ккал"))
        assertNull(catalog.parseFood("неизвестный продукт"))
    }
}
