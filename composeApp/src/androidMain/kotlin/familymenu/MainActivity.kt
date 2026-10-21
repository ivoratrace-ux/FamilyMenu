package familymenu

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

class FamilyMenuApplication : Application() {
    override fun onCreate() {super.onCreate();appContext=this}
}
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState);enableEdgeToEdge();setContent {FamilyMenuApp()}
    }
}
