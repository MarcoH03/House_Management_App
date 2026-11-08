package io.github.marcoh03.hogar.ui

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightFallback = lightColorScheme(
    primary = Color(0xFF1B5FA8), onPrimary = Color.White,
    primaryContainer = Color(0xFFD5E3FF), onPrimaryContainer = Color(0xFF001B3C),
    secondary = Color(0xFF555F71), secondaryContainer = Color(0xFFD9E3F8), onSecondaryContainer = Color(0xFF121C2B),
    tertiary = Color(0xFF6E5676), tertiaryContainer = Color(0xFFF7D8FF),
    surface = Color(0xFFF9F9FF), background = Color(0xFFF9F9FF),
)
private val DarkFallback = darkColorScheme(
    primary = Color(0xFFA7C8FF), onPrimary = Color(0xFF003061),
    primaryContainer = Color(0xFF004788), onPrimaryContainer = Color(0xFFD5E3FF),
    secondary = Color(0xFFBDC7DC), secondaryContainer = Color(0xFF3E4759), onSecondaryContainer = Color(0xFFD9E3F8),
    tertiary = Color(0xFFDABDE2), tertiaryContainer = Color(0xFF553F5D),
    surface = Color(0xFF111318), background = Color(0xFF111318),
)

/** Tema Material 3. En Android 12+ usa los colores del fondo de pantalla (Material You). */
@Composable
fun HogarTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val ctx = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> if (dark) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)
        dark -> DarkFallback
        else -> LightFallback
    }
    MaterialTheme(colorScheme = scheme, content = content)
}

/**
 * Colores de miembros, categorías, cuentas y etiquetas. Se guardan por nombre
 * («green», «blue»…) en los datos compartidos con la web app.
 */
private val LIGHT = mapOf(
    "blue" to 0xFF1E6FD9, "green" to 0xFF2E8B3E, "orange" to 0xFFE07B00, "pink" to 0xFFD81B60,
    "purple" to 0xFF8E3FB5, "teal" to 0xFF00838F, "indigo" to 0xFF3F51B5, "red" to 0xFFD32F2F,
    "yellow" to 0xFFC79A00, "mint" to 0xFF00A38C, "brown" to 0xFF795548, "gray" to 0xFF757575,
)
private val DARK = mapOf(
    "blue" to 0xFF7FB2FF, "green" to 0xFF6FCF7F, "orange" to 0xFFFFB55C, "pink" to 0xFFFF7AA8,
    "purple" to 0xFFD39BF0, "teal" to 0xFF5ED0DB, "indigo" to 0xFF9FA8FF, "red" to 0xFFFF8A80,
    "yellow" to 0xFFFFD95C, "mint" to 0xFF5EE3CB, "brown" to 0xFFC4A08C, "gray" to 0xFFA0A0A0,
)

@Composable
@ReadOnlyComposable
fun keyColor(key: String?): Color {
    val dark = isSystemInDarkTheme()
    val map = if (dark) DARK else LIGHT
    return Color(map[key] ?: map["gray"]!!)
}

/** Color de fondo suave para iconos/emoji sobre un color. */
@Composable
@ReadOnlyComposable
fun keyContainer(key: String?): Color = keyColor(key).copy(alpha = if (isSystemInDarkTheme()) 0.24f else 0.16f)

val Positive @Composable @ReadOnlyComposable get() = if (isSystemInDarkTheme()) Color(0xFF6FCF7F) else Color(0xFF1E7D32)
