package io.github.marcoh03.hogar

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import io.github.marcoh03.hogar.data.Rates
import io.github.marcoh03.hogar.data.Store
import io.github.marcoh03.hogar.data.Sync
import io.github.marcoh03.hogar.data.Updates
import io.github.marcoh03.hogar.data.WebMigration
import io.github.marcoh03.hogar.ui.HogarApp
import io.github.marcoh03.hogar.ui.HogarTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var ready by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        App.init(this)
        // Una sola vez: recuperar los datos de la versión anterior (web app en un WebView).
        WebMigration.run(this) { migrated ->
            ready = true
            if (migrated) Sync.syncNow()
        }
        setContent {
            HogarTheme {
                if (ready) HogarApp() else Box(Modifier.fillMaxSize())
            }
        }
    }

    override fun onStart() {
        super.onStart()
        Sync.foreground(true)
        lifecycleScope.launch {
            Rates.refresh()
            Updates.check()
        }
    }

    override fun onStop() {
        super.onStop()
        Sync.foreground(false)
    }
}

/** Inicialización única (sobrevive a giros de pantalla). */
object App {
    private var done = false
    fun init(activity: ComponentActivity) {
        if (done) return
        done = true
        val ctx = activity.applicationContext
        Store.init(ctx)
        Sync.init(ctx)
    }
}
