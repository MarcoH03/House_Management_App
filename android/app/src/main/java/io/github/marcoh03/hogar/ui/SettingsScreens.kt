@file:OptIn(ExperimentalMaterial3Api::class)

package io.github.marcoh03.hogar.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Label
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Category
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.CurrencyExchange
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.NewReleases
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.Upload
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import io.github.marcoh03.hogar.BuildConfig
import io.github.marcoh03.hogar.data.APK_URL
import io.github.marcoh03.hogar.data.D
import io.github.marcoh03.hogar.data.PUBLIC_URL
import io.github.marcoh03.hogar.data.Store
import io.github.marcoh03.hogar.data.Sync
import io.github.marcoh03.hogar.data.SyncException
import io.github.marcoh03.hogar.data.Updates
import io.github.marcoh03.hogar.data.fmtCur
import io.github.marcoh03.hogar.data.rec
import io.github.marcoh03.hogar.data.str
import io.github.marcoh03.hogar.data.uid
import io.github.marcoh03.hogar.data.with
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable
fun SettingsScreen() {
    observeStore()
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val st by Sync.status.collectAsState()
    val update by Updates.latest.collectAsState()
    var who by remember { mutableStateOf(false) }
    var mainPick by remember { mutableStateOf(false) }
    var confirmDisconnect by remember { mutableStateOf(false) }
    var confirmWipe by remember { mutableStateOf(false) }
    val ms = D.members()
    val me = D.meId()
    val accs = D.accounts()

    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        uri?.let {
            runCatching { ctx.contentResolver.openOutputStream(it)?.use { os -> os.write(JSONObject(Store.exportJson()).toString(1).toByteArray()) } }
                .onSuccess { Toast.show("Copia guardada") }.onFailure { Toast.show("No se pudo guardar la copia") }
        }
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let {
            runCatching {
                val text = ctx.contentResolver.openInputStream(it)!!.bufferedReader().use { r -> r.readText() }
                val j = JSONObject(text)
                require(j.has("settings")) { "El archivo no es una copia de Hogar." }
                Store.importData(j)
            }.onSuccess { Toast.show("Copia importada") }.onFailure { e -> Toast.show(e.message ?: "No se pudo importar") }
        }
    }

    TabScaffold(title = "Ajustes") {
        item {
            Card(
                onClick = { Nav.push(Route.House) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                shape = RoundedCornerShape(28.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
            ) {
                Item(
                    Store.settings().str("name").ifEmpty { "Mi casa" },
                    supporting = "${ms.size} ${if (ms.size == 1) "miembro" else "miembros"} · Moneda principal: CUP",
                    leading = { IconBadge(Icons.Outlined.Home, "blue", 48.dp) },
                )
            }
        }
        item { SectionTitle("Miembros de la casa") }
        item {
            GroupCard {
                ms.forEach { m ->
                    Item(m.str("name") + if (m.str("id") == me) " (yo)" else "", leading = { Avatar(m) }, onClick = { Nav.push(Route.MemberEdit(m.str("id"))) })
                }
                Item("Añadir miembro", headlineColor = MaterialTheme.colorScheme.primary, leading = { Icon(Icons.Outlined.Add, null, tint = MaterialTheme.colorScheme.primary) },
                    onClick = { Nav.push(Route.MemberEdit(null)) })
            }
        }
        item {
            Row(Modifier.padding(horizontal = 24.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Hint("Este teléfono es de ${me?.let { D.memberName(it) } ?: "nadie todavía"}.")
                TextButton(onClick = { who = true }) { Text("Cambiar") }
            }
        }

        item { SectionTitle("Finanzas") }
        item {
            GroupCard {
                if (accs.size > 1) Item("Cuenta principal", supporting = D.mainAccount()?.str("name"), leading = { Icon(Icons.Outlined.Star, null) }, onClick = { mainPick = true })
                val usd = D.rateOf("USD")
                Item("Tasas de cambio", supporting = if (usd > 0) "1 USD = ${fmtCur(usd)}" else "Sin fijar", leading = { Icon(Icons.Outlined.CurrencyExchange, null) }, onClick = { Nav.push(Route.Rates) })
                Item("Categorías de gasto", supporting = "${D.categories().size}", leading = { Icon(Icons.Outlined.Category, null) }, onClick = { Nav.push(Route.Categories) })
                Item("Etiquetas", supporting = "${D.tags().size}", leading = { Icon(Icons.AutoMirrored.Outlined.Label, null) }, onClick = { Nav.push(Route.Tags) })
            }
        }

        item { SectionTitle("Sincronización") }
        item {
            GroupCard {
                if (Sync.cfg != null) {
                    Item(
                        "GitHub · ${Sync.cfg!!.owner}/${Sync.cfg!!.repo}",
                        supportingContent = { Text(Sync.statusText(), color = if (st == Sync.Status.ERROR) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant) },
                        leading = { Icon(if (st == Sync.Status.ERROR) Icons.Outlined.Warning else Icons.Outlined.CloudDone, null) },
                    )
                    Item("Sincronizar ahora", leading = { Icon(Icons.Outlined.Sync, null) }, onClick = { Sync.syncNow(); Toast.show("Sincronizando…") })
                    Item("Invitar a la casa", supporting = "Comparte el acceso con otros teléfonos", leading = { Icon(Icons.Outlined.Group, null) }, onClick = { Nav.push(Route.Share) })
                    Item("Cambiar repositorio o token", leading = { Icon(Icons.Outlined.Key, null) }, onClick = { Nav.push(Route.Github) })
                    Item("Desconectar este teléfono", headlineColor = MaterialTheme.colorScheme.error, leading = { Icon(Icons.Outlined.CloudOff, null, tint = MaterialTheme.colorScheme.error) }, onClick = { confirmDisconnect = true })
                } else {
                    Item("Sin sincronizar", supporting = "Los datos solo están en este teléfono", leading = { Icon(Icons.Outlined.CloudOff, null) })
                    Item("Unirse con un código", leading = { Icon(Icons.Outlined.Link, null) }, onClick = { Nav.push(Route.Join()) })
                    Item("Configurar con GitHub", leading = { Icon(Icons.Outlined.Key, null) }, onClick = { Nav.push(Route.Github) })
                }
            }
        }

        item { SectionTitle("Datos") }
        item {
            GroupCard {
                Item("Exportar copia de seguridad", leading = { Icon(Icons.Outlined.Download, null) }, onClick = { exportLauncher.launch("hogar-${io.github.marcoh03.hogar.data.today()}.json") })
                Item("Importar copia", leading = { Icon(Icons.Outlined.Upload, null) }, onClick = { importLauncher.launch(arrayOf("application/json", "text/plain", "*/*")) })
                Item("Borrar datos de este teléfono", headlineColor = MaterialTheme.colorScheme.error, leading = { Icon(Icons.Outlined.Delete, null, tint = MaterialTheme.colorScheme.error) }, onClick = { confirmWipe = true })
            }
        }

        item { SectionTitle("App") }
        item {
            GroupCard {
                if (update != null) Item("Descargar la versión nueva", supporting = "Toca para descargarla e instalarla", leading = { Icon(Icons.Outlined.NewReleases, null, tint = MaterialTheme.colorScheme.primary) },
                    onClick = { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(update!!.url))) })
                else Item("Buscar actualizaciones", leading = { Icon(Icons.Outlined.NewReleases, null) }, onClick = {
                    Toast.show("Buscando…")
                    scope.launch { if (Updates.check(force = true) == null) Toast.show("Ya tienes la última versión") }
                })
                Item("Versión", supporting = "${BuildConfig.VERSION_NAME} · Android", leading = { Icon(Icons.Outlined.Info, null) })
            }
        }
    }

    if (who) WhoDialog(onDismiss = { who = false })
    if (mainPick) {
        AlertDialog(
            onDismissRequest = { mainPick = false },
            title = { Text("Cuenta principal") },
            text = {
                Column {
                    Text("Es la del dinero del mes: su saldo es lo disponible y sus gastos son los que cuentan en el resumen.", style = MaterialTheme.typography.bodyMedium)
                    accs.forEach { a ->
                        Row(Modifier.fillMaxWidth().clickable { D.setMainAccount(a.str("id")); mainPick = false }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = D.isMainAccount(a.str("id")), onClick = { D.setMainAccount(a.str("id")); mainPick = false })
                            Text("${a.str("emoji")}  ${a.str("name")}")
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { mainPick = false }) { Text("Cerrar") } },
        )
    }
    if (confirmDisconnect) ConfirmDialog("¿Desconectar este teléfono?", "Los datos se quedarán aquí, pero dejarán de sincronizarse.", confirm = "Desconectar",
        onConfirm = { Sync.disconnect() }, onDismiss = { confirmDisconnect = false })
    if (confirmWipe) ConfirmDialog(
        "¿Borrar los datos de este teléfono?",
        if (Sync.cfg != null) "Se desconectará de la sincronización. Los datos en GitHub no se borran." else "Esta acción no se puede deshacer. Exporta antes una copia si la necesitas.",
        confirm = "Borrar",
        onConfirm = { Sync.disconnect(); Store.reset(); Nav.stack.clear(); Nav.tab = Tab.HOME }, onDismiss = { confirmWipe = false },
    )
}

/* ---------- ¿Quién usa este teléfono? ---------- */

private var whoDismissed by mutableStateOf(false)

@Composable
fun WhoAmIGate() {
    observeStore()
    if (!whoDismissed && Store.onboarded && D.meId() == null && D.members().isNotEmpty()) WhoDialog(onDismiss = { whoDismissed = true })
}

@Composable
fun WhoDialog(onDismiss: () -> Unit) {
    var newName by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("¿Quién eres?") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("Elige tu nombre para que la app sepa quién compra, paga o completa cada cosa desde este teléfono.", style = MaterialTheme.typography.bodyMedium)
                D.members().forEach { m ->
                    Row(Modifier.fillMaxWidth().clickable { Store.me = m.str("id"); onDismiss() }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Avatar(m, 32.dp)
                        Text(m.str("name"), Modifier.padding(start = 12.dp).weight(1f))
                        RadioButton(selected = D.meId() == m.str("id"), onClick = { Store.me = m.str("id"); onDismiss() })
                    }
                }
                OutlinedTextField(newName, { newName = it }, label = { Text("No estoy: escribe tu nombre") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words), modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (newName.isNotBlank()) { val m = D.saveMember(rec("id" to uid(), "name" to newName)); Store.me = m.str("id") }
                onDismiss()
            }) { Text(if (newName.isNotBlank()) "Añadirme" else "Más tarde") }
        },
    )
}

/* ---------- Casa y miembros ---------- */

@Composable
fun HouseEditor() {
    var name by remember { mutableStateOf(Store.settings().str("name")) }
    EditorScaffold(title = "Casa", saveEnabled = name.isNotBlank(), onSave = { Store.setSettings("name" to name.trim()); Nav.pop() }) {
        OutlinedTextField(name, { name = it }, label = { Text("Nombre de la casa") }, singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth())
        Hint("La moneda principal de la app es el peso cubano (CUP).")
    }
}

@Composable
fun MemberEditor(id: String?) {
    val prev = remember(id) { D.member(id) }
    var name by remember { mutableStateOf(prev?.str("name") ?: "") }
    var color by remember { mutableStateOf(prev?.str("color") ?: D.nextColor()) }
    var confirmDelete by remember { mutableStateOf(false) }
    val isMe = prev != null && Store.me == prev.str("id")
    EditorScaffold(
        title = if (prev == null) "Nuevo miembro" else prev.str("name"),
        saveEnabled = name.isNotBlank(),
        onSave = { D.saveMember((prev ?: rec("id" to uid())).with("name" to name, "color" to color)); Nav.pop() },
    ) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { Avatar(rec("name" to name.ifBlank { "?" }, "color" to color), 80.dp) }
        OutlinedTextField(name, { name = it }, label = { Text("Nombre") }, singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words), modifier = Modifier.fillMaxWidth())
        FieldLabel("Color")
        ColorPicker(color, D.COLORS.filter { it != "gray" }) { color = it }
        if (prev != null && !isMe) OutlinedButton(onClick = { Store.me = prev.str("id"); Toast.show("Ahora eres ${prev.str("name")} en este teléfono"); Nav.pop() }, modifier = Modifier.fillMaxWidth()) {
            Text("Soy yo (usar este teléfono como ${prev.str("name")})")
        }
        if (prev != null) TextButton(onClick = { confirmDelete = true }, modifier = Modifier.fillMaxWidth()) { Text("Eliminar miembro", color = MaterialTheme.colorScheme.error) }
    }
    if (confirmDelete && prev != null) ConfirmDialog("¿Eliminar a ${prev.str("name")}?", "Se quitará de la casa en todos los teléfonos. Sus tareas quedarán sin asignar.",
        onConfirm = { D.removeMember(prev.str("id")); Nav.pop() }, onDismiss = { confirmDelete = false })
}

/* ---------- GitHub, unirse e invitar ---------- */

@Composable
fun GithubScreen() {
    val scope = rememberCoroutineScope()
    val c = Sync.cfg
    var owner by remember { mutableStateOf(c?.owner ?: "") }
    var repo by remember { mutableStateOf(c?.repo ?: "hogar-datos") }
    var token by remember { mutableStateOf(c?.token ?: "") }
    var branch by remember { mutableStateOf(c?.branch ?: "") }
    var path by remember { mutableStateOf(c?.path ?: "hogar.json") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    EditorScaffold(
        title = "Sincronizar con GitHub",
        saveLabel = if (busy) "Conectando…" else "Conectar",
        saveEnabled = !busy && owner.isNotBlank() && token.isNotBlank(),
        onSave = {
            busy = true; error = null
            scope.launch {
                try {
                    Sync.connect(Sync.Cfg(owner, repo, token, branch, path))
                    Toast.show("Conectado con GitHub")
                    Nav.pop()
                } catch (e: SyncException) { error = e.message } finally { busy = false }
            }
        },
    ) {
        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
            Text(
                "Los datos se guardan en un repositorio privado de tu cuenta de GitHub, el mismo que usa la web app.\n\n" +
                    "1. Crea un repositorio privado (p. ej. «hogar-datos»).\n2. Crea un token «fine-grained» solo para ese repositorio con permiso Contents: Read and write.\n3. Pega aquí los datos.",
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSecondaryContainer, modifier = Modifier.padding(16.dp),
            )
        }
        OutlinedTextField(owner, { owner = it }, label = { Text("Usuario") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(repo, { repo = it }, label = { Text("Repositorio") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(token, { token = it }, label = { Text("Token") }, placeholder = { Text("github_pat_…") }, singleLine = true,
            visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        FieldLabel("Avanzado")
        OutlinedTextField(branch, { branch = it }, label = { Text("Rama") }, placeholder = { Text("la principal") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(path, { path = it }, label = { Text("Archivo") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        if (busy) CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally))
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Hint("El token solo se guarda en este teléfono y en los que invites.")
    }
}

/** Unirse a una casa con el código de otro dispositivo. onJoined se llama al terminar. */
@Composable
fun JoinForm(initial: String = "", onJoined: () -> Unit) {
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf(initial) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    Text("En un teléfono que ya use la app, ve a Ajustes → Invitar a la casa y copia el código. Pégalo aquí.", style = MaterialTheme.typography.bodyMedium)
    OutlinedTextField(code, { code = it }, label = { Text("Código o enlace de invitación") }, minLines = 4, modifier = Modifier.fillMaxWidth(),
        textStyle = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace))
    Button(
        onClick = {
            busy = true; error = null
            scope.launch {
                try {
                    Sync.connect(Sync.decodeCode(code))
                    onJoined()
                } catch (e: SyncException) { error = e.message } finally { busy = false }
            }
        },
        enabled = code.isNotBlank() && !busy,
        modifier = Modifier.fillMaxWidth(),
    ) { Text(if (busy) "Uniéndome…" else "Unirme a la casa") }
    if (busy) CircularProgressIndicator(Modifier.padding(8.dp))
    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
}

@Composable
fun JoinScreen(code: String) {
    EditorScaffold(title = "Unirse a una casa") {
        JoinForm(code) {
            Store.onboarded = true
            Toast.show("Te has unido a la casa")
            Nav.pop()
        }
    }
}

@Composable
fun ShareScreen() {
    val ctx = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val code = remember { Sync.shareCode() }
    val name = Store.settings().str("name").ifEmpty { "nuestra casa" }
    val text = "Únete a «$name» en la app Hogar.\n\n" +
        "1. Instala la app:\n• Android: $APK_URL\n• iPhone: abre $PUBLIC_URL en Safari y añádela a la pantalla de inicio.\n" +
        "2. Ábrela, elige «Unirme a una casa existente» y pega este código:\n\n$code"
    EditorScaffold(title = "Invitar a la casa", back = true) {
        Text("Envía este código a las personas de tu casa. En su teléfono deben abrir la app, elegir «Unirme a una casa existente» y pegarlo.", style = MaterialTheme.typography.bodyMedium)
        Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)) {
            SelectionContainer { Text(code, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(16.dp)) }
        }
        Button(onClick = {
            ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Invitar a la casa"))
        }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Outlined.Share, null, Modifier.size(18.dp)); Text("  Compartir…") }
        OutlinedButton(onClick = { clipboard.setText(AnnotatedString(code)); Toast.show("Código copiado") }, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Outlined.ContentCopy, null, Modifier.size(18.dp)); Text("  Copiar código")
        }
        Text(
            "El código incluye el acceso a los datos de la casa. Compártelo solo por un canal privado con quien viva contigo.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Medium,
        )
    }
}
