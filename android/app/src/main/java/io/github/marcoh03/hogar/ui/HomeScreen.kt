@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package io.github.marcoh03.hogar.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Celebration
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.NewReleases
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.marcoh03.hogar.data.D
import io.github.marcoh03.hogar.data.Store
import io.github.marcoh03.hogar.data.Sync
import io.github.marcoh03.hogar.data.Updates
import io.github.marcoh03.hogar.data.fmtCur
import io.github.marcoh03.hogar.data.fmtLongDate
import io.github.marcoh03.hogar.data.fmtMonth
import io.github.marcoh03.hogar.data.fmtQty
import io.github.marcoh03.hogar.data.listNames
import io.github.marcoh03.hogar.data.num
import io.github.marcoh03.hogar.data.str
import io.github.marcoh03.hogar.data.thisMonth
import io.github.marcoh03.hogar.data.timeAgo
import io.github.marcoh03.hogar.data.today
import io.github.marcoh03.hogar.data.long

@Composable
fun SyncAction() {
    val st by Sync.status.collectAsState()
    if (Sync.cfg == null) return
    val (icon, desc) = when (st) {
        Sync.Status.ERROR -> Icons.Outlined.Warning to "Error al sincronizar"
        Sync.Status.OFFLINE -> Icons.Outlined.CloudOff to "Sin conexión"
        Sync.Status.SYNCING -> Icons.Outlined.Sync to "Sincronizando"
        else -> Icons.Outlined.CloudDone to "Sincronizado"
    }
    IconButton(onClick = {
        if (st == Sync.Status.ERROR) Toast.show(Sync.error ?: "Error al sincronizar")
        Sync.syncNow()
    }) {
        Icon(icon, desc, tint = if (st == Sync.Status.ERROR) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun HomeScreen() {
    observeStore()
    val ctx = LocalContext.current
    val update by Updates.latest.collectAsState()
    var addSheet by remember { mutableStateOf(false) }
    val t0 = today()
    val list = D.shoppingList().sortedBy { it.str("name").lowercase() }
    val low = D.lowStock()
    val pending = D.pendingTasks()
    val me = D.meId()
    val due = D.sortTasks(pending.filter { it.str("due").isNotEmpty() && it.str("due") <= t0 })
        .sortedByDescending { it.str("assignee") == me }
    val overdue = pending.count { it.str("due").isNotEmpty() && it.str("due") < t0 }
    val unbilled = D.unbilledPurchases()
    val s = D.monthSummary(thisMonth())
    val tot = D.totals()
    val name = Store.settings().str("name").ifEmpty { "Casa" }

    TabScaffold(
        title = name,
        actions = { SyncAction() },
        fab = {
            ExtendedFloatingActionButton(
                onClick = { addSheet = true },
                icon = { Icon(Icons.Outlined.Add, null) },
                text = { Text("Añadir") },
            )
        },
    ) {
        item {
            Text(
                fmtLongDate() + (me?.let { " · Hola, ${D.memberName(it)}" } ?: ""),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
            )
        }
        update?.let { u ->
            item {
                Banner(Icons.Outlined.NewReleases, "Hay una versión nueva de Hogar", "Toca «Actualizar» para descargarla", "Actualizar", {
                    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u.url)))
                })
            }
        }
        if (unbilled.isNotEmpty()) {
            item {
                Banner(
                    Icons.AutoMirrored.Outlined.ReceiptLong, "¿Cuánto ha costado la compra?", listNames(unbilled.map { it.str("name") }), "Añadir",
                    onAction = {
                        val (cat, desc) = D.billSummary(unbilled)
                        Nav.push(Route.Txn("expense", desc = desc, categoryId = cat, purchaseIds = unbilled.map { it.str("id") }))
                    },
                    onDismiss = { D.dismissPurchases(unbilled.map { it.str("id") }) },
                )
            }
        }
        item {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    SummaryCard(Modifier.weight(1f), Icons.Outlined.ShoppingCart, "blue", "${list.size}", "Por comprar") { Nav.tab = Tab.SHOP }
                    SummaryCard(Modifier.weight(1f), Icons.Outlined.Checklist, "orange", "${pending.size}", if (overdue > 0) "Tareas · $overdue atrasadas" else "Tareas") { Nav.tab = Tab.TASKS }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    SummaryCard(Modifier.weight(1f), Icons.Outlined.Inventory2, if (low.isNotEmpty()) "red" else "teal", "${low.size}", "Queda poco") { Nav.tab = Tab.SHOP; ShoppingState.tab = 1 }
                    SummaryCard(Modifier.weight(1f), Icons.Outlined.CalendarToday, "red", "${due.size}", "Para hoy") { Nav.tab = Tab.TASKS }
                }
            }
        }
        item {
            ElevatedCard(
                onClick = { Nav.tab = Tab.MONEY },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                shape = RoundedCornerShape(24.dp),
            ) {
                Column(Modifier.padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBadge(Icons.Outlined.AccountBalanceWallet, "green", 36.dp)
                        Text(
                            if (D.accounts().size > 1) "Dinero del mes · ${D.mainAccount()?.str("name") ?: ""}" else "Dinero de la casa",
                            style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 12.dp),
                        )
                    }
                    Text(
                        fmtCur(tot.value.cup), style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.SemiBold,
                        color = if (tot.value.cup < 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                    usdWords(tot.value.cup)?.let { Text(it, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    if (s.spent.cup > 0) Text(
                        "En ${fmtMonth(s.month, false).lowercase()} se han gastado ${fmtCur(s.spent.cup)}",
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp),
                    )
                }
            }
        }
        item { SectionTitle("Para hoy") { TextButton(onClick = { Nav.tab = Tab.TASKS }) { Text("Ver todas") } } }
        item {
            GroupCard {
                if (due.isEmpty()) Item("No hay nada pendiente para hoy", leading = { Icon(Icons.Outlined.Celebration, null) })
                due.take(6).forEach { TaskRow(it) }
            }
        }
        item { SectionTitle("Lista de la compra") { if (list.size > 6) TextButton(onClick = { Nav.tab = Tab.SHOP }) { Text("Ver todo (${list.size})") } } }
        item {
            GroupCard {
                if (list.isEmpty()) Item("La lista de la compra está vacía", leading = { Icon(Icons.Outlined.ShoppingCart, null) })
                list.take(6).forEach { i ->
                    val q = i.num("listQty", 1.0)
                    Item(
                        i.str("name"),
                        supporting = if (q != 1.0 || i.str("unit", "ud") != "ud") "${fmtQty(q)} ${i.str("unit", "ud")}" else null,
                        leading = { Checkbox(checked = false, onCheckedChange = { buyNow(i) }) },
                        onClick = { Nav.push(Route.ItemEdit(i.str("id"))) },
                    )
                }
            }
        }
        val acts = D.activity(8)
        if (acts.isNotEmpty()) {
            item { SectionTitle("Actividad reciente") }
            item {
                GroupCard {
                    acts.forEach { a ->
                        val m = D.member(a.str("by"))
                        Item(
                            "${m?.str("name") ?: "Alguien"} ${a.str("text")}",
                            supporting = timeAgo(a.long("at")),
                            leading = { Avatar(m, 36.dp) },
                        )
                    }
                }
            }
        }
    }

    if (addSheet) {
        ChoiceSheet(
            title = "¿Qué quieres añadir?",
            choices = listOf(
                Choice("Algo para comprar", Icons.Outlined.ShoppingCart) { Nav.push(Route.ItemEdit(null, onList = true)) },
                Choice("Una tarea", Icons.Outlined.Checklist) { Nav.push(Route.TaskEdit(null)) },
                Choice("Un gasto", Icons.AutoMirrored.Outlined.ReceiptLong) { Nav.push(Route.Txn("expense")) },
            ),
            onDismiss = { addSheet = false },
        )
    }
}

@Composable
private fun SummaryCard(modifier: Modifier, icon: ImageVector, color: String, value: String, label: String, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconBadge(icon, color, 36.dp)
                Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f).padding(start = 8.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
            }
            Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 10.dp), maxLines = 1)
        }
    }
}

/** «unos 58 USD» (equivalencia redondeada y en palabras). */
fun usdWords(cup: Double): String? {
    val r = D.rateOf("USD")
    if (r <= 0 || cup <= 0) return null
    val usd = cup / r
    return if (usd < 1) "menos de 1 USD" else "unos ${fmtCur(Math.round(usd).toDouble(), "USD")}"
}

fun usdRounded(usd: Double?): String? = when {
    usd == null || usd <= 0 -> null
    usd < 1 -> "menos de 1 USD"
    else -> "unos ${fmtCur(Math.round(usd).toDouble(), "USD")}"
}
