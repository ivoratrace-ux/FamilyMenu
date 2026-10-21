package familymenu

import androidx.compose.runtime.*
import io.ktor.client.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.client.plugins.*
import io.ktor.http.*
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.Serializable

@Serializable data class ScanRequest(val image: String, val mimeType: String)
@Serializable data class ScanProduct(val name: String, val amount: String, val confidence: String,
    val alternatives: List<String> = emptyList(), val confirmed: Boolean = false) {
    fun select(name: String): ScanProduct {
        require(confidence == "medium" && !confirmed && name in alternatives)
        return copy(name=name,alternatives=emptyList(),confirmed=true)
    }
    fun keep() = copy(alternatives=emptyList(),confirmed=true)
}
@Serializable data class ScanResponse(val products: List<ScanProduct>)
fun validateScanProducts(products: List<ScanProduct>): List<ScanProduct> {
    require(products.size <= 60)
    products.forEach { p ->
        require(p.name.isNotBlank() && p.name.length <= 120 && p.amount.isNotBlank() && p.amount.length <= 100)
        require(p.confidence in setOf("high","medium","low"))
        require(p.alternatives.size <= 3 && p.alternatives.all { it.isNotBlank() && it.length<=120 })
    }
    return products.filter { it.confidence == "high" || it.confidence == "medium" && it.alternatives.isNotEmpty() }
        .map { if(it.confidence == "high") it.copy(alternatives=emptyList()) else it.copy(alternatives=it.alternatives.distinct()) }
}
class ScannerService(private val client: HttpClient = HttpClient { install(HttpTimeout) { requestTimeoutMillis=150_000; connectTimeoutMillis=30_000 } }) {
    suspend fun scan(photo: PhotoResult.Success): List<ScanProduct> {
        require(photo.mimeType in setOf("image/jpeg","image/png","image/webp")) { "Выберите JPEG, PNG или WebP." }
        require(photo.base64.length <= 5_592_408) { "Фото должно быть не больше 4 МБ." }
        try {
            val response = client.post("$SCAN_API_BASE/api/fridge/scan") {
                contentType(ContentType.Application.Json)
                setBody(appJson.encodeToString(ScanRequest(photo.base64,photo.mimeType)))
            }
            if(!response.status.isSuccess()) error(when(response.status.value) {
                400,415 -> "Не удалось прочитать фото. Выберите JPEG, PNG или WebP до 4 МБ."
                413 -> "Фото должно быть не больше 4 МБ."
                429 -> "Сервис занят. Попробуйте позже."
                503 -> "Сервис сканирования ещё не настроен."
                404,405 -> "API сканирования пока недоступен на сервере."
                else -> "Не удалось проанализировать фото. Попробуйте позже."
            })
            val body=response.bodyAsText()
            return try {validateScanProducts(appJson.decodeFromString<ScanResponse>(body).products)}
                catch(e: Exception) {error("Сервер вернул неожиданный ответ. Попробуйте позже.")}
        } catch(e: CancellationException) { throw e }
        catch(e: HttpRequestTimeoutException) { error("Сервер не ответил вовремя. Render может запускаться после простоя — повторите попытку.") }
    }
    fun close() = client.close()
}
