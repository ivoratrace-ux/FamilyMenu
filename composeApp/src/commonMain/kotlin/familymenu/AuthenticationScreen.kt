package familymenu

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.*
import kotlinx.coroutines.*

@Composable internal fun AuthenticationScreen(m: AppModel) {
    val scope=rememberCoroutineScope()
    var register by remember {mutableStateOf(true)}
    var email by remember {mutableStateOf("")}
    var password by remember {mutableStateOf("")}
    var busy by remember {mutableStateOf(false)}
    var error by remember {mutableStateOf<String?>(null)}
    Page {
        Heading("Семейное меню",if(register) "Создать аккаунт" else "Войти в аккаунт")
        Note("Войдите, чтобы сохранить меню, предпочтения семьи и запасы. Подтверждение почты пока не требуется.")
        OutlinedTextField(email,{email=it},label={Text("Электронная почта")},singleLine=true,enabled=!busy,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email),modifier=Modifier.fillMaxWidth())
        OutlinedTextField(password,{password=it},label={Text("Пароль")},singleLine=true,enabled=!busy,visualTransformation=PasswordVisualTransformation(),keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Password),modifier=Modifier.fillMaxWidth())
        Note("Пароль от 8 до 128 символов.")
        error?.let {Text(it,color=MaterialTheme.colorScheme.error)}
        if(busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        Primary(if(register) "Зарегистрироваться" else "Войти",!busy && email.contains('@') && password.length in 8..128) {
            busy=true;error=null
            scope.launch {
                try {Account.login(email,password,register);password=""}
                catch(e: CancellationException) {throw e}
                catch(e: Exception) {error=if(e is IllegalStateException) e.message else "Не удалось связаться с сервером. Повторите попытку."}
                finally {busy=false}
            }
        }
        TextButton(onClick={register=!register;error=null},enabled=!busy) {Text(if(register) "Уже есть аккаунт? Войти" else "Создать новый аккаунт")}
    }
}
@Composable internal fun MenuPreview(m: AppModel) {
    Page {
        Heading("Меню готово","Ваша неделя")
        Note("Посмотрите меню. Чтобы сохранить его и пользоваться приложением, нажмите «Далее» и войдите или зарегистрируйтесь.")
        m.state.plan?.days?.forEach {day -> Panel {
            Text(day.date,style=MaterialTheme.typography.titleMedium)
            day.slots.forEach {slot -> m.catalog.byRecipe[slot.recipeId]?.let {recipe -> Text("${mealLabels[slot.meal] ?: slot.meal}: ${recipe.name}")}}
        }}
        Primary("Далее") {m.update(m.state.copy(stage="auth"))}
        TextButton(onClick={m.update(m.state.copy(stage="quiz"))}) {Text("Изменить настройки")}
    }
}
