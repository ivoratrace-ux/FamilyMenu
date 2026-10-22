package familymenu

import androidx.compose.runtime.*
import io.ktor.client.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.client.plugins.*
import io.ktor.http.*
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.Serializable

const val MAX_SCAN_PHOTOS = 5
@Serializable data class ScanImage(val image: String, val mimeType: String)
@Serializable data class ScanRequest(val images: List<ScanImage>)
@Serializable data class ScanAlternative(val name: String, val ingredientId: String? = null)
@Serializable data class ScanProduct(val name: String, val amount: String, val confidence: String,
    val alternatives: List<ScanAlternative> = emptyList(), val ingredientId: String? = null, val confirmed: Boolean = false) {
    fun select(alternative: ScanAlternative): ScanProduct {
        require(confidence == "medium" && !confirmed && alternative in alternatives)
        return copy(name=alternative.name,ingredientId=alternative.ingredientId,alternatives=emptyList(),confirmed=true)
    }
}
@Serializable data class ScanResponse(val products: List<ScanProduct>)
fun validateScanProducts(products: List<ScanProduct>): List<ScanProduct> {
    require(products.size <= 60)
    products.forEach { p ->
        require(p.name.isNotBlank() && p.name.length <= 120 && p.amount.isNotBlank() && p.amount.length <= 100)
        require(p.ingredientId == null || p.ingredientId.isNotBlank())
        require(p.confidence in setOf("high","medium","low"))
        require(p.alternatives.size <= 3 && p.alternatives.all { it.name.isNotBlank() && it.name.length<=120 && (it.ingredientId == null || it.ingredientId.isNotBlank()) })
    }
    return products.filter { it.confidence == "high" || it.confidence == "medium" && it.alternatives.isNotEmpty() }
        .map { if(it.confidence == "high") it.copy(alternatives=emptyList()) else it.copy(alternatives=it.alternatives.distinct()) }
}
fun appendScanPhotos(current: List<PhotoResult.Success>, added: List<PhotoResult.Success>): List<PhotoResult.Success> {
    require(current.size + added.size <= MAX_SCAN_PHOTOS) { "Можно выбрать не больше 5 фото." }
    return current + added
}
class ScannerService(private val client: HttpClient = HttpClient { install(HttpTimeout) { requestTimeoutMillis=150_000; connectTimeoutMillis=30_000 } }) {
    suspend fun scan(photos: List<PhotoResult.Success>): List<ScanProduct> {
        require(photos.size in 1..MAX_SCAN_PHOTOS) { "Выберите от 1 до 5 фото." }
        photos.forEach { photo ->
            require(photo.mimeType in setOf("image/jpeg","image/png","image/webp")) { "Выберите JPEG, PNG или WebP." }
            require(photo.base64.isNotEmpty()) { "Не удалось прочитать фото." }
            require(photo.base64.length <= 5_592_408) { "Фото должно быть не больше 4 МБ." }
        }
        try {
            val response = client.post("$SCAN_API_BASE/api/fridge/scan") {
                contentType(ContentType.Application.Json)
                setBody(appJson.encodeToString(ScanRequest(photos.map { ScanImage(it.base64,it.mimeType) })))
            }
            if(!response.status.isSuccess()) error(when(response.status.value) {
                400,415 -> "Выберите от 1 до 5 фото JPEG, PNG или WebP, каждое до 4 МБ."
                413 -> "Фото должно быть не больше 4 МБ."
                429 -> "Сервис занят. Попробуйте позже."
                503 -> "Сервис сканирования или справочник ингредиентов временно недоступен."
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
