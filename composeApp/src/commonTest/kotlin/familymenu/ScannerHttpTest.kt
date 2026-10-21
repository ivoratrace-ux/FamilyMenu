package familymenu

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.*
import io.ktor.http.*
import kotlinx.coroutines.test.runTest
import kotlin.test.*

class ScannerHttpTest {
    @Test fun sendsExistingApiContractWithoutCredentialsAndFiltersResults() = runTest {
        var calls=0
        val client=HttpClient(MockEngine {request ->
            calls++
            assertEquals("https://vibe-coding-sc04.onrender.com/api/fridge/scan",request.url.toString())
            assertEquals(HttpMethod.Post,request.method)
            assertNull(request.headers[HttpHeaders.Authorization])
            val body=appJson.decodeFromString<ScanRequest>(request.body.toByteArray().decodeToString())
            assertEquals("/9j/AA==",body.image);assertEquals("image/jpeg",body.mimeType)
            respond("""{"products":[{"name":"Яйца","amount":"6 шт","confidence":"high","alternatives":[]},{"name":"Неизвестно","amount":"1 шт","confidence":"low","alternatives":[]}]}""",HttpStatusCode.OK,headersOf(HttpHeaders.ContentType,"application/json"))
        })
        val service=ScannerService(client)
        try {
            val result=service.scan(PhotoResult.Success("/9j/AA==","image/jpeg"))
            assertEquals(1,calls);assertEquals(listOf("Яйца"),result.map {it.name})
        } finally {service.close()}
    }
    @Test fun invalidInputDoesNotSpendApiCalls() = runTest {
        var called=false
        val service=ScannerService(HttpClient(MockEngine {called=true;respond("{}") }))
        try {
            assertFailsWith<IllegalArgumentException> {service.scan(PhotoResult.Success("x","application/pdf"))}
            assertFailsWith<IllegalArgumentException> {service.scan(PhotoResult.Success("x".repeat(5_592_409),"image/jpeg"))}
            assertFalse(called)
        } finally {service.close()}
    }
    @Test fun providerBodyIsNotShownOnFailure() = runTest {
        val service=ScannerService(HttpClient(MockEngine {respond("secret provider details",HttpStatusCode.TooManyRequests)}))
        try {
            val e=assertFailsWith<IllegalStateException> {service.scan(PhotoResult.Success("/9j/AA==","image/jpeg"))}
            assertEquals("Сервис занят. Попробуйте позже.",e.message)
        } finally {service.close()}
    }
}
