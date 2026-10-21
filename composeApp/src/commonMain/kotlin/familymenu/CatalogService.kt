package familymenu

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*

class CatalogService(private val client: HttpClient = HttpClient {
    install(HttpTimeout) { requestTimeoutMillis=150_000; connectTimeoutMillis=30_000 }
}) {
    suspend fun load(): Catalog {
        val response=client.get("$SCAN_API_BASE/api/catalog")
        check(response.status.isSuccess()) { "Каталог временно недоступен." }
        return appJson.decodeFromString<Catalog>(response.bodyAsText()).also { catalog ->
            require(catalog.recipes.isNotEmpty() && catalog.ingredients.isNotEmpty())
            require(catalog.byRecipe.size==catalog.recipes.size && catalog.byIngredient.size==catalog.ingredients.size)
            catalog.recipes.forEach { r ->
                require(r.servings>0 && r.steps.isNotEmpty() && r.steps.size==r.stepSeconds.size && r.steps.size==r.stepTips.size && r.steps.size==r.stepImageUrls.size)
                require(r.ingredients.all { it.id in catalog.byIngredient && it.quantity>0 })
            }
        }
    }
    fun close()=client.close()
}

private val imageClient by lazy { HttpClient { install(HttpTimeout) { requestTimeoutMillis=30_000 } } }
internal suspend fun loadCatalogImage(url: String): ByteArray {
    require(Url(url).protocol==URLProtocol.HTTPS)
    val response=imageClient.get(url)
    check(response.status.isSuccess())
    return response.body()
}
