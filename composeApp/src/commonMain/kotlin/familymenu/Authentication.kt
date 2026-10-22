package familymenu

import androidx.compose.runtime.*
import io.ktor.client.*
import io.ktor.client.plugins.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.datetime.Clock
import kotlinx.serialization.Serializable

@Serializable data class AccountUser(val id: String,val email: String)
@Serializable data class AccountTokens(val accessToken: String,val refreshToken: String,val expiresAt: Long,val expiresIn: Long=3600,val tokenType: String="bearer")
@Serializable data class AccountSession(val user: AccountUser,val session: AccountTokens)
@Serializable private data class PasswordInput(val email: String,val password: String)
@Serializable private data class RefreshInput(val refreshToken: String)
@Serializable private data class ApiError(val error: String="Сервис временно недоступен.")
class SignInRequired: IllegalStateException("Войдите в аккаунт ещё раз.")
object Account {
    var current by mutableStateOf<AccountSession?>(null)
        private set
    private var initialized=false
    private val lock=Mutex()
    private val client by lazy {HttpClient {install(HttpTimeout) {requestTimeoutMillis=30_000}}}
    fun initialize() {if(!initialized) {initialized=true;current=runCatching {loadAuthSession()?.let {appJson.decodeFromString<AccountSession>(it)}}.getOrNull()}}
    fun install(value: AccountSession) {saveAuthSession(appJson.encodeToString(value));current=value}
    fun clear() {current=null;runCatching {saveAuthSession(null)}}
    suspend fun login(email: String,password: String,register: Boolean) {
        val response=client.post("$SCAN_API_BASE/api/auth/${if(register) "register" else "login"}") {contentType(ContentType.Application.Json);setBody(appJson.encodeToString(PasswordInput(email.trim(),password)))}
        val text=response.bodyAsText()
        check(response.status.isSuccess()) {runCatching {appJson.decodeFromString<ApiError>(text).error}.getOrDefault("Не удалось войти. Попробуйте позже.")}
        install(appJson.decodeFromString(text))
    }
    suspend fun token(previous: String?=null): String = lock.withLock {
        val session=current ?: throw SignInRequired()
        if(session.session.expiresAt>Clock.System.now().epochSeconds+60 && (previous==null || previous!=session.session.accessToken)) return@withLock session.session.accessToken
        val r=client.post("$SCAN_API_BASE/api/auth/refresh") {contentType(ContentType.Application.Json);setBody(appJson.encodeToString(RefreshInput(session.session.refreshToken)))}
        if(r.status.value in listOf(400,401,403)) {clear();throw SignInRequired()}
        check(r.status.isSuccess()) {"Не удалось обновить сессию. Проверьте интернет."}
        val refreshed=appJson.decodeFromString<AccountSession>(r.bodyAsText());if(current?.user?.id!=session.user.id || current?.session?.refreshToken!=session.session.refreshToken) throw SignInRequired();install(refreshed);refreshed.session.accessToken
    }
    suspend fun logout() {val value=current;try {if(value!=null) client.post("$SCAN_API_BASE/api/auth/logout") {bearerAuth(value.session.accessToken)}} finally {clear()}}
}
suspend fun authenticatedRequest(request: suspend (String)->HttpResponse): HttpResponse {
    val token=Account.token()
    var response=request(token)
    if(response.status.value==401) response=request(Account.token(token))
    if(response.status.value==401) {Account.clear();throw SignInRequired()}
    return response
}
@Serializable data class UserDocument(val revision: Long,val preferences: AppState?=null,val menu: Plan?=null)
class UserDocumentConflict: IllegalStateException("Данные изменились на другом устройстве. Загрузите актуальную версию.")
class UserDocumentService(private val client: HttpClient=HttpClient {install(HttpTimeout) {requestTimeoutMillis=30_000}}) {
    private suspend fun decode(response: HttpResponse): UserDocument {
        if(response.status.value==409) throw UserDocumentConflict()
        check(response.status.isSuccess()) {"Не удалось синхронизировать личные данные. Повторите попытку."}
        return appJson.decodeFromString(response.bodyAsText())
    }
    suspend fun load()=decode(authenticatedRequest {token->client.get("$SCAN_API_BASE/api/user-state") {bearerAuth(token)}})
    suspend fun save(state: AppState,revision: Long)=decode(authenticatedRequest {token->client.put("$SCAN_API_BASE/api/user-state") {bearerAuth(token);contentType(ContentType.Application.Json);setBody(appJson.encodeToString(UserDocument(revision,state.copy(plan=null,stage="app"),state.plan)))}})
    fun close()=client.close()
}
