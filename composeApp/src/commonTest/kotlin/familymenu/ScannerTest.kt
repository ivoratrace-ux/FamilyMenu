package familymenu
import kotlin.test.*

class ScannerTest {
    @Test fun filtersLowAndUnusableMediumConfidence() {
        val items=listOf(ScanProduct("Яйца","6 шт","high",listOf(ScanAlternative("Сыр","cheese"))),ScanProduct("Контейнер","1 шт","low"),ScanProduct("Соус","100 мл","medium"),ScanProduct("Овощ","1 шт","medium",listOf(ScanAlternative("Кабачок","zucchini"),ScanAlternative("Огурец","cucumber"),ScanAlternative("Огурец","cucumber"))))
        val result=validateScanProducts(items)
        assertEquals(listOf("Яйца","Овощ"),result.map {it.name})
        assertTrue(result[0].alternatives.isEmpty())
        assertEquals(listOf("Кабачок","Огурец"),result[1].alternatives.map {it.name})
    }
    @Test fun selectionPreservesQuantityAndRequiresSuggestedAlternative() {
        val item=ScanProduct("Овощ","около 300 г","medium",listOf(ScanAlternative("Кабачок","zucchini"),ScanAlternative("Огурец","cucumber")))
        val confirmed=item.select(ScanAlternative("Огурец","cucumber"))
        assertEquals("Огурец",confirmed.name);assertEquals(item.amount,confirmed.amount)
        assertTrue(confirmed.confirmed);assertTrue(confirmed.alternatives.isEmpty())
        assertFailsWith<IllegalArgumentException> {item.select(ScanAlternative("Помидор","tomato"))}
        assertEquals("cucumber",confirmed.ingredientId)
    }
    @Test fun malformedProviderResponsesAreRejected() {
        assertFailsWith<IllegalArgumentException> {validateScanProducts(listOf(ScanProduct("","1 шт","high")))}
        assertFailsWith<IllegalArgumentException> {validateScanProducts(listOf(ScanProduct("Сыр","100 г","certain")))}
        assertFailsWith<IllegalArgumentException> {validateScanProducts(List(61) {ScanProduct("Сыр","100 г","high")})}
    }
    @Test fun photoQueueIsBoundedAndDoesNotReplaceExistingSelection() {
        val photo=PhotoResult.Success("/9j/AA==","image/jpeg")
        val first=appendScanPhotos(emptyList(),listOf(photo,photo))
        assertEquals(5,appendScanPhotos(first,List(3){photo}).size)
        assertFailsWith<IllegalArgumentException> {appendScanPhotos(first,List(4){photo})}
        assertEquals(2,first.size)
    }
    @Test fun timersUseWallClockAcrossBackgroundingAndPause() {
        val timer=CookingTimer(60,160000)
        assertEquals(60,timer.remaining(100000));assertEquals(0,timer.remaining(200000))
        assertEquals(35,timer.copy(paused=35).remaining(500000))
    }
}
