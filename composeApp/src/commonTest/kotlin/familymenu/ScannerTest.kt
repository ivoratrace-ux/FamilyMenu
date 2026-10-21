package familymenu
import kotlin.test.*

class ScannerTest {
    @Test fun filtersLowAndUnusableMediumConfidence() {
        val items=listOf(ScanProduct("Яйца","6 шт","high",listOf("Сыр")),ScanProduct("Контейнер","1 шт","low"),ScanProduct("Соус","100 мл","medium"),ScanProduct("Овощ","1 шт","medium",listOf("Кабачок","Огурец","Огурец")))
        val result=validateScanProducts(items)
        assertEquals(listOf("Яйца","Овощ"),result.map {it.name})
        assertTrue(result[0].alternatives.isEmpty())
        assertEquals(listOf("Кабачок","Огурец"),result[1].alternatives)
    }
    @Test fun selectionPreservesQuantityAndRequiresSuggestedAlternative() {
        val item=ScanProduct("Овощ","около 300 г","medium",listOf("Кабачок","Огурец"))
        val confirmed=item.select("Огурец")
        assertEquals("Огурец",confirmed.name);assertEquals(item.amount,confirmed.amount)
        assertTrue(confirmed.confirmed);assertTrue(confirmed.alternatives.isEmpty())
        assertFailsWith<IllegalArgumentException> {item.select("Помидор")}
        assertEquals(item.name,item.keep().name)
    }
    @Test fun malformedProviderResponsesAreRejected() {
        assertFailsWith<IllegalArgumentException> {validateScanProducts(listOf(ScanProduct("","1 шт","high")))}
        assertFailsWith<IllegalArgumentException> {validateScanProducts(listOf(ScanProduct("Сыр","100 г","certain")))}
        assertFailsWith<IllegalArgumentException> {validateScanProducts(List(61) {ScanProduct("Сыр","100 г","high")})}
    }
    @Test fun timersUseWallClockAcrossBackgroundingAndPause() {
        val timer=CookingTimer(60,160000)
        assertEquals(60,timer.remaining(100000));assertEquals(0,timer.remaining(200000))
        assertEquals(35,timer.copy(paused=35).remaining(500000))
    }
}
