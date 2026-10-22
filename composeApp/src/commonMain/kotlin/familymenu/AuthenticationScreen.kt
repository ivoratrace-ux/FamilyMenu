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

@Composable internal fun AuthenticationScreen(m: AppModel) {
    val scope=rememberCoroutineScope()
    var mode by remember {mutableStateOf("choose")}
    var phone by remember {mutableStateOf("")}
    var code by remember {mutableStateOf("")}
    var codeSent by remember {mutableStateOf(false)}
    var email by remember {mutableStateOf("")}
    var password by remember {mutableStateOf("")}
    var register by remember {mutableStateOf(true)}
    var busy by remember {mutableStateOf(false)}
    var error by remember {mutableStateOf<String?>(null)}
    fun run(action: suspend ()->Unit) {
        busy=true;error=null
        scope.launch {
            try {action()}
            catch(e: CancellationException) {throw e}
            catch(e: Exception) {error=if(e is IllegalStateException) e.message else "Не удалось связаться с сервером. Повторите попытку."}
            finally {busy=false}
        }
    }
    fun masked(): String {val d=phone.filter(Char::isDigit).takeLast(10);return if(d.length<10) phone else "+7 ${d.take(3)} ***-**-${d.takeLast(2)}"}
    val via=if(mode=="max") "MAX" else "Telegram"
    Page {
        when(mode) {
            "choose" -> {
                Heading("Frigo","Вход")
                Note(if(m.state.plan!=null) "Войдите, чтобы сохранить меню, список покупок и продукты. Всё будет доступно на любом устройстве." else "Аккаунт сохранит меню, список покупок и продукты.")
                Primary("Войти через Telegram",!busy) {mode="telegram";code="";codeSent=false;error=null}
                Secondary("Войти через MAX",!busy) {mode="max";code="";codeSent=false;error=null}
                Note("Пришлём 4-значный код в мессенджер от бота «Frigo». Рекламу и рассылки без вашего согласия не отправляем.")
                TextButton(onClick={mode="email";error=null}) {Text("Войти по почте и паролю")}
                if(m.state.plan!=null) TextButton(onClick={m.update(m.state.copy(stage="ready"))}) {Text("‹ Вернуться к меню")}
                else TextButton(onClick={m.update(m.state.copy(stage="intro"))}) {Text("‹ Я здесь впервые")}
            }
            "telegram","max" -> if(!codeSent) {
                Heading("Вход через $via","Номер телефона")
                Note("Номер, на который зарегистрирован ваш $via. Код придёт туда от бота «Frigo».")
                OutlinedTextField(phone,{phone=it.filter {c -> c.isDigit() || c in "+ ()-"}.take(20)},label={Text("Номер телефона")},placeholder={Text("+7 900 000-00-00")},singleLine=true,enabled=!busy,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Phone),modifier=Modifier.fillMaxWidth())
                Primary("Получить код в $via",!busy && phone.count {it.isDigit()}>=10) {codeSent=true;code=""}
            } else {
                CodeStep(code,{code=it},busy,"Бот «Frigo» отправил 4 цифры в $via на номер ${masked()}.") {
                    run {Account.fakeMessengerLogin(mode,masked());code=""}
                }
                Note("Тестовый вход: сообщение в мессенджер пока не отправляется, подойдёт любой код из 4 цифр.")
            }
            else -> {
                Heading("Вход по почте",if(register) "Создать аккаунт" else "Войти в аккаунт")
                OutlinedTextField(email,{email=it},label={Text("Электронная почта")},singleLine=true,enabled=!busy,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email),modifier=Modifier.fillMaxWidth())
                OutlinedTextField(password,{password=it},label={Text("Пароль")},singleLine=true,enabled=!busy,visualTransformation=PasswordVisualTransformation(),keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Password),modifier=Modifier.fillMaxWidth())
                Note("Пароль от 8 до 128 символов.")
                Primary(if(register) "Зарегистрироваться" else "Войти",!busy && email.contains('@') && password.length in 8..128) {run {Account.login(email,password,register);password=""}}
                TextButton(onClick={register=!register;error=null},enabled=!busy) {Text(if(register) "Уже есть аккаунт? Войти" else "Создать новый аккаунт")}
            }
        }
        if(busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        error?.let {Text(it,color=MaterialTheme.colorScheme.error)}
        if(mode!="choose") TextButton(onClick={if(mode!="email" && codeSent) {codeSent=false;code=""} else mode="choose";error=null},enabled=!busy) {Text("‹ Назад")}
    }
}
@Composable private fun CodeStep(code: String,onCode:(String)->Unit,busy: Boolean,hint: String?,onSubmit:()->Unit) {
    hint?.let {Heading("Код из мессенджера","Введите 4 цифры");Note(it)}
    OutlinedTextField(code,{onCode(it.filter(Char::isDigit).take(4))},label={Text("Код")},singleLine=true,enabled=!busy,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.NumberPassword),modifier=Modifier.fillMaxWidth())
    Primary("Войти",!busy && code.length==4,onSubmit)
}

