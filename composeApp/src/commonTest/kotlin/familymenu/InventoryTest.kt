package familymenu

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.http.*
import kotlinx.coroutines.test.runTest
import kotlin.test.*

class InventoryTest {
    @BeforeTest fun signIn() {Account.install(AccountSession(AccountUser("user-a","user@example.com"),AccountTokens("test-token","test-refresh",4_000_000_000L)))}
    @AfterTest fun signOut() {Account.clear()}
    @Test fun quantitiesAreExplicitPositiveAndRespectUnits() {
        assertEquals(1.25,inventoryQuantity("1,25"))
        listOf("","0","-2","NaN","2 шт","1.1234","1e3").forEach {assertNull(inventoryQuantity(it))}
        assertEquals("500",initialScanQuantity("около 0,5 кг","g"))
        assertEquals("6",initialScanQuantity("6 шт","шт"))
        assertEquals("",initialScanQuantity("200–300 г","g"))
        assertEquals("",initialScanQuantity("2 упаковки","g"))
    }
    @Test fun scannerCannotPersistUnknownOrUnconfirmedIngredients() {
        val high=ScanProduct("Молоко","500 мл","high",ingredientId="milk")
        val unknown=ScanProduct("Соус","1 банка","high")
        assertFailsWith<IllegalArgumentException> {scanInventoryInputs(listOf(unknown),listOf("1"))}
        assertFailsWith<IllegalArgumentException> {scanInventoryInputs(listOf(high),listOf(""))}
        val ambiguous=ScanProduct("Напиток","1 шт","medium",listOf(ScanAlternative("Молоко","milk")))
        assertFailsWith<IllegalArgumentException> {scanInventoryInputs(listOf(ambiguous),listOf("100"))}
        assertEquals(listOf(InventoryInput("milk",300.0)),scanInventoryInputs(listOf(high,high),listOf("100","200")))
        assertEquals(listOf(InventoryInput("milk",0.3)),scanInventoryInputs(listOf(high,high),listOf("0.1","0.2")))
    }
    @Test fun inventoryWritesCarryRevisionAndNoArbitraryUserIdentity() = runTest {
        val calls=mutableListOf<HttpMethod>()
        val service=InventoryService(HttpClient(MockEngine {request ->
            calls+=request.method
            assertEquals("Bearer test-token",request.headers[HttpHeaders.Authorization])
            val text=request.body.toByteArray().decodeToString()
            assertFalse(text.contains("userId"))
            if(request.method==HttpMethod.Put) {
                val replace=appJson.decodeFromString<InventoryReplace>(text)
                assertEquals(7,replace.revision);assertEquals(listOf(InventoryInput("milk",250.0)),replace.items)
            }
            respond("""{"userEmail":"user@example.com","revision":8,"items":[{"ingredientId":"milk","name":"Молоко","unit":"ml","quantity":250}]}""",HttpStatusCode.OK,headersOf(HttpHeaders.ContentType,"application/json"))
        }))
        try {assertEquals(250.0,service.replace(7,listOf(InventoryInput("milk",250.0))).items.single().quantity)} finally {service.close()}
        assertEquals(listOf(HttpMethod.Put),calls)
    }
    @Test fun searchStartsAtThreeCharactersAndVersionConflictsAreDistinct() = runTest {
        var calls=0
        val service=InventoryService(HttpClient(MockEngine {calls++;respond("{}",HttpStatusCode.Conflict)}))
        try {
            assertFailsWith<IllegalArgumentException> {service.search("мо")}
            assertEquals(0,calls)
            assertFailsWith<InventoryConflict> {service.replace(1,emptyList())}
        } finally {service.close()}
    }
}
