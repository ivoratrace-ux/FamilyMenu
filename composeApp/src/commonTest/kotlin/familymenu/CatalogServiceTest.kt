package familymenu

import io.ktor.client.*
import io.ktor.client.engine.mock.*
import io.ktor.http.*
import kotlinx.coroutines.test.runTest
import kotlin.test.*

class CatalogServiceTest {
    private fun document(id: String = "database-only") = Catalog(
        listOf(Ingredient("i","Ingredient","Test","g",1.0,emptyList(),emptyList(),listOf(100.0,1.0,1.0,1.0))),
        listOf(Recipe(id,"From database","b",10,emptyList(),listOf(Quantity("i",100.0)),emptyList(),listOf("Cook"),listOf(30),listOf("Tip"),imageUrl="https://example.com/dish.png",stepImageUrls=listOf(null))),
        emptyList(),emptyList())
    @Test fun loadsServerCatalogIncludingOptionalStepImage() = runTest {
        val expected=document()
        val service=CatalogService(HttpClient(MockEngine { request ->
            assertEquals("/api/catalog",request.url.encodedPath)
            assertEquals(HttpMethod.Get,request.method)
            respond(appJson.encodeToString(expected),HttpStatusCode.OK,headersOf(HttpHeaders.ContentType,"application/json"))
        }))
        try {
            val result=service.load()
            assertEquals("database-only",result.recipes.single().id)
            assertEquals(listOf(null),result.recipes.single().stepImageUrls)
            assertEquals(expected.ingredients,result.ingredients)
        } finally {service.close()}
    }
    @Test fun failureDoesNotSilentlyUseLocalRecipes() = runTest {
        val service=CatalogService(HttpClient(MockEngine {respond("{}",HttpStatusCode.ServiceUnavailable)}))
        try {assertFailsWith<IllegalStateException> {service.load()}} finally {service.close()}
    }
    @Test fun rejectsBrokenIngredientReferences() = runTest {
        val invalid=document().let {it.copy(ingredients=it.ingredients.map {i->i.copy(id="other")})}
        val service=CatalogService(HttpClient(MockEngine {respond(appJson.encodeToString(invalid),HttpStatusCode.OK)}))
        try {assertFailsWith<IllegalArgumentException> {service.load()}} finally {service.close()}
    }
}
