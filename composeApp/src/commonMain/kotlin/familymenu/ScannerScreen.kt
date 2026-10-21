package familymenu

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.*

@Composable internal fun ScannerScreen(m: AppModel,scope: CoroutineScope,service: ScannerService) {
    var sourceDialog by remember {mutableStateOf(false)}
    val picker=rememberPhotoPicker { result ->
        when(result) {
            is PhotoResult.Success -> {
                if(!m.scanning) {
                    m.scanning=true;m.scannerProducts=emptyList()
                    m.scanMessage="Анализируем фото… Первый запрос может занять до двух минут."
                    scope.launch {
                        try {
                            m.scannerProducts=service.scan(result)
                            m.scanMessage=if(m.scannerProducts.isEmpty()) "Продукты не найдены. Попробуйте более чёткое фото." else "Количество приблизительное. Проверьте найденные продукты."
                        } catch(e: CancellationException) {throw e}
                        catch(e: Exception) {m.scanMessage=if(e is IllegalStateException || e is IllegalArgumentException) e.message ?: "Не удалось прочитать ответ сервера." else "Не удалось проанализировать фото. Проверьте интернет и повторите попытку."}
                        finally {m.scanning=false}
                    }
                }
            }
            is PhotoResult.Error -> m.scanMessage=result.message
            PhotoResult.Cancelled -> Unit
        }
    }
    Page {
        Heading("Продукты дома","Мой холодильник")
        Text("Фото → продукты",color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.titleMedium)
        Note(m.scanMessage)
        Primary(if(m.scanning) "Анализируем фото…" else if(m.scannerProducts.isEmpty()) "Сканировать" else "Сканировать заново",!m.scanning) {sourceDialog=true}
        if(sourceDialog) Panel {
            Text("Сканировать холодильник",style=MaterialTheme.typography.titleMedium)
            Note("Сделайте снимок или выберите готовую фотографию.")
            Primary("Камера") {sourceDialog=false;picker.launch(true)}
            OutlinedButton(onClick={sourceDialog=false;picker.launch(false)},modifier=Modifier.fillMaxWidth()) {Text("Выбрать фото")}
            TextButton(onClick={sourceDialog=false}) {Text("Отмена")}
        }
        Note("Фото отправляется на сервер и в OpenAI для анализа. Новый снимок заменит список. Результаты не добавляются в запасы, список покупок или Supabase и не сохраняются после закрытия приложения.")
        if(m.scanning) LinearProgressIndicator(Modifier.fillMaxWidth())
        if(m.scannerProducts.isNotEmpty()) Text("Найдено: ${m.scannerProducts.size}",style=MaterialTheme.typography.titleMedium)
        m.scannerProducts.forEachIndexed { index,product ->
            Panel {
                Row(verticalAlignment=Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {Text(product.name,style=MaterialTheme.typography.titleMedium);Note(product.amount)}
                    TextButton(onClick={m.scannerProducts=m.scannerProducts.filterIndexed {i,_ -> i!=index}}) {Text("Удалить")}
                }
                if(product.confidence=="medium" && !product.confirmed && product.alternatives.isNotEmpty()) {
                    Note("AI предполагает несколько вариантов. Выберите продукт:")
                    OutlinedButton(onClick={m.scannerProducts=m.scannerProducts.mapIndexed {i,p -> if(i==index) p.keep() else p}},modifier=Modifier.fillMaxWidth()) {Text("Оставить как есть")}
                    product.alternatives.forEach {alternative -> OutlinedButton(onClick={m.scannerProducts=m.scannerProducts.mapIndexed {i,p -> if(i==index) p.select(alternative) else p}},modifier=Modifier.fillMaxWidth()) {Text(alternative)} }
                } else if(product.confirmed) Note("Подтверждено")
            }
        }
    }
}
