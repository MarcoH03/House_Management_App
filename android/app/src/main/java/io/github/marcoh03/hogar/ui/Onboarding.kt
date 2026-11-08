@file:OptIn(ExperimentalMaterial3Api::class)

package io.github.marcoh03.hogar.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.marcoh03.hogar.data.D
import io.github.marcoh03.hogar.data.Store

@Composable
fun OnboardingScreen() {
    var step by remember { mutableStateOf("welcome") }
    BackHandler(enabled = step != "welcome") { step = "welcome" }
    Column(
        Modifier.fillMaxSize().safeDrawingPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        when (step) {
            "create" -> CreateHousehold { step = "welcome" }
            "join" -> {
                TextButton(onClick = { step = "welcome" }) { Text("‹ Atrás") }
                Text("Unirse a una casa", style = MaterialTheme.typography.headlineMedium)
                JoinForm {
                    if (D.members().isEmpty()) {
                        Toast.show("La casa está vacía: créala desde este teléfono")
                        step = "create"
                    } else {
                        Store.onboarded = true
                    }
                }
            }
            else -> Welcome(onCreate = { step = "create" }, onJoin = { step = "join" })
        }
    }
}

@Composable
private fun Welcome(onCreate: () -> Unit, onJoin: () -> Unit) {
    Spacer(Modifier.height(24.dp))
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Box(Modifier.size(96.dp).clip(RoundedCornerShape(28.dp)).background(MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
            Icon(Icons.Outlined.Home, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.onPrimaryContainer)
        }
    }
    Text("Te damos la bienvenida a Hogar", style = MaterialTheme.typography.headlineLarge, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    Feature(Icons.Outlined.ShoppingCart, "blue", "Compras y despensa", "Una lista de la compra compartida y lo que queda de cada cosa en casa.")
    Feature(Icons.Outlined.Checklist, "orange", "Tareas del hogar", "Reparte las tareas, asígnalas y turnaos las que se repiten.")
    Feature(Icons.Outlined.AccountBalanceWallet, "green", "Dinero de la casa", "Cuentas en CUP, USD y otras monedas, con las tasas de elTOque.")
    Feature(Icons.Outlined.Sync, "indigo", "Siempre sincronizado", "Todos los teléfonos de la casa ven la misma información.")
    Spacer(Modifier.height(8.dp))
    Button(onClick = onCreate, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Crear mi casa") }
    OutlinedButton(onClick = onJoin, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("Unirme a una casa existente") }
}

@Composable
private fun Feature(icon: ImageVector, color: String, title: String, text: String) {
    Row(verticalAlignment = Alignment.Top) {
        IconBadge(icon, color, 44.dp)
        Column(Modifier.padding(start = 16.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun CreateHousehold(onBack: () -> Unit) {
    var house by remember { mutableStateOf("") }
    var me by remember { mutableStateOf("") }
    val others = remember { mutableStateListOf("") }
    TextButton(onClick = onBack) { Text("‹ Atrás") }
    Text("Tu casa", style = MaterialTheme.typography.headlineMedium)
    Text("Podrás cambiar todo esto más adelante en Ajustes.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    OutlinedTextField(house, { house = it }, label = { Text("Nombre de la casa") }, placeholder = { Text("Casa") }, singleLine = true,
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth())
    OutlinedTextField(me, { me = it }, label = { Text("Tu nombre") }, singleLine = true,
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words), modifier = Modifier.fillMaxWidth())
    Text("Quién más vive contigo", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
    others.forEachIndexed { i, n ->
        OutlinedTextField(n, { others[i] = it }, label = { Text("Persona ${i + 2}") }, singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words), modifier = Modifier.fillMaxWidth())
    }
    TextButton(onClick = { others.add("") }) { Icon(Icons.Outlined.Add, null); Text(" Añadir otra persona") }
    Text("Servirá para asignar tareas y saber quién ha comprado o pagado cada cosa.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Button(
        onClick = { D.createHousehold(house, me, others.toList()) },
        enabled = me.isNotBlank(),
        modifier = Modifier.fillMaxWidth().height(52.dp),
    ) { Text("Empezar", fontWeight = FontWeight.SemiBold) }
}
