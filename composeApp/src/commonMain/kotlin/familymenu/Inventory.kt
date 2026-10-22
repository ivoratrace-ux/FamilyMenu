package familymenu

import io.ktor.client.*
import io.ktor.client.plugins.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.serialization.Serializable

@Serializable data class InventoryItem(val ingredientId: String,val name: String,val unit: String,val quantity: Double)
@Serializable data class InventorySnapshot(val userLogin: String,val userApplication: String="",val revision: Long,val items: List<InventoryItem>)
@Serializable data class InventoryInput(val ingredientId: String,val quantity: Double)
@Serializable data class InventoryReplace(val revision: Long,val items: List<InventoryInput>)
@Serializable data class InventoryEdit(val revision: Long,val ingredientId: String,val quantity: Double)
@Serializable data class InventoryDelete(val revision: Long,val ingredientId: String)
@Serializable data class IngredientMatch(val id: String,val name: String,val unit: String)
@Serializable data class IngredientMatches(val ingredients: List<IngredientMatch>)
class InventoryConflict : IllegalStateException("Запасы изменились на другом устройстве. Обновите список перед сохранением.")
fun inventoryQuantity(text: String): Double? {
    val cleaned=text.trim().replace(',','.')
    if(!Regex("[0-9]+(?:\\.[0-9]{1,3})?").matches(cleaned)) return null
    return cleaned.toDoubleOrNull()?.takeIf {it.isFinite() && it>0 && it<=1_000_000_000}
}
fun inventoryUnit(unit: String)=when(unit) {"g"->"г";"ml"->"мл";else->unit}
fun initialScanQuantity(amount: String,unit: String): String {
    val m=Regex("(?:около |примерно |~)?([0-9]+(?:[.,][0-9]{1,3})?)\\s*(кг|г|мл|л|шт\\.?)",RegexOption.IGNORE_CASE).matchEntire(amount.trim()) ?: return ""
    val source=m.groupValues[2].lowercase().removeSuffix(".")
    val multiplier=when {
        unit=="g" && source=="кг" -> 1000
        unit=="g" && source=="г" -> 1
        unit=="ml" && source=="л" -> 1000
        unit=="ml" && source=="мл" -> 1
        unit=="шт" && source=="шт" -> 1
        else -> return ""
    }
    val quantity=inventoryQuantity(m.groupValues[1])?.times(multiplier) ?: return ""
    return if(quantity%1.0==0.0) quantity.toLong().toString() else quantity.toString()
}
fun scanInventoryInputs(products: List<ScanProduct>,amounts: List<String>): List<InventoryInput> {
    require(products.size==amounts.size)
    return products.mapIndexed {i,p ->
        require(p.ingredientId!=null && (p.confidence!="medium" || p.confirmed)) {"Уточните все продукты перед сохранением."}
        InventoryInput(p.ingredientId,requireNotNull(inventoryQuantity(amounts[i])) {"Укажите количество каждого ингредиента."})
    }.groupBy {it.ingredientId}.map { (id,items) ->
        val total=kotlin.math.round(items.sumOf {it.quantity}*1000)/1000
        require(total<=1_000_000_000)
        InventoryInput(id,total)
    }
}
class InventoryService(private val client: HttpClient=HttpClient {install(HttpTimeout) {requestTimeoutMillis=30_000;connectTimeoutMillis=15_000}}) {
    private suspend fun body(response: HttpResponse): String {
        if(response.status.value==409) throw InventoryConflict()
        check(response.status.isSuccess()) {"Не удалось загрузить или сохранить запасы. Проверьте интернет и повторите попытку."}
        return response.bodyAsText()
    }
    private suspend fun request(method: HttpMethod,path: String,payload: String?=null): HttpResponse = authenticatedRequest {token ->
        client.request("$SCAN_API_BASE$path") {this.method=method;bearerAuth(token);if(payload!=null) {contentType(ContentType.Application.Json);setBody(payload)}}
    }
    suspend fun load()=appJson.decodeFromString<InventorySnapshot>(body(request(HttpMethod.Get,"/api/inventory")))
    suspend fun search(query: String): List<IngredientMatch> {
        require(query.trim().length in 3..80)
        return appJson.decodeFromString<IngredientMatches>(body(request(HttpMethod.Get,"/api/ingredients?q=${query.trim().encodeURLParameter()}"))).ingredients
    }
    suspend fun replace(revision: Long,items: List<InventoryInput>)=appJson.decodeFromString<InventorySnapshot>(body(request(HttpMethod.Put,"/api/inventory",appJson.encodeToString(InventoryReplace(revision,items)))))
    suspend fun edit(revision: Long,ingredientId: String,quantity: Double)=appJson.decodeFromString<InventorySnapshot>(body(request(HttpMethod.Put,"/api/inventory/item",appJson.encodeToString(InventoryEdit(revision,ingredientId,quantity)))))
    suspend fun delete(revision: Long,ingredientId: String)=appJson.decodeFromString<InventorySnapshot>(body(request(HttpMethod.Delete,"/api/inventory/item",appJson.encodeToString(InventoryDelete(revision,ingredientId)))))
    fun close()=client.close()
}
