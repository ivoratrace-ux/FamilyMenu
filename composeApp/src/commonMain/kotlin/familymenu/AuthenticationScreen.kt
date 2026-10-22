@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class, androidx.compose.material3.ExperimentalMaterial3Api::class)
package familymenu

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.*

/** A one-time device challenge is approved inside the Telegram bot. */
@Composable internal fun AuthenticationScreen(m: AppModel) {
    val scope=rememberCoroutineScope()
    val uri=androidx.compose.ui.platform.LocalUriHandler.current
    var challenge by remember {mutableStateOf<TelegramChallenge?>(null)}
    var error by remember {mutableStateOf<String?>(null)}
    var busy by remember {mutableStateOf(false)}
    var remaining by remember {mutableStateOf(0L)}
    LaunchedEffect(challenge) {
        val current=challenge ?: return@LaunchedEffect
        val deadline=kotlinx.datetime.Clock.System.now().epochSeconds+current.expiresIn
        while(isActive && Account.current==null) {
            remaining=(deadline-kotlinx.datetime.Clock.System.now().epochSeconds).coerceAtLeast(0)
            if(remaining==0L) {error="Вход истёк. Начните ещё раз.";challenge=null;break}
            delay(2000)
            try {if(Account.pollTelegram(current)) break;error=null}
            catch(e: CancellationException) {throw e}
            catch(e: Exception) {error=e.message ?: "Не удалось проверить вход. Повторим попытку."}
        }
    }
    Page {
        Heading("Frigo","Вход через Telegram")
        Note("Подтвердите вход в боте. При первом входе создадим аккаунт, при следующих загрузим ваши меню, настройки и продукты.")
        val current=challenge
        if(current==null) {
            Primary(if(busy) "Подготавливаем вход…" else "Войти через Telegram",!busy) {
                busy=true;error=null
                scope.launch {
                    try {challenge=Account.startTelegram()}
                    catch(e: CancellationException) {throw e}
                    catch(e: Exception) {error=e.message ?: "Не удалось начать вход. Попробуйте ещё раз."}
                    finally {busy=false}
                }
            }
        } else {
            Panel {
                Text("Код входа: ${current.code}",style=MaterialTheme.typography.headlineSmall)
                Note("Откройте бота, нажмите «Начать», затем «Подтвердить вход». Код в боте должен совпадать с этим.")
                Primary("Открыть Telegram") {uri.openUri(current.botUrl)}
                Note("После подтверждения вернитесь сюда — вход завершится автоматически.")
                Note("Осталось ${remaining / 60}:${(remaining % 60).toString().padStart(2,'0')}")
            }
            TextButton(onClick={challenge=null;error=null}) {Text("Начать вход заново")}
        }
        error?.let {Text(it,color=MaterialTheme.colorScheme.error)}
    }
}
