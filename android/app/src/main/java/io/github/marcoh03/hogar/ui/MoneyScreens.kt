@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package io.github.marcoh03.hogar.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.CurrencyExchange
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.marcoh03.hogar.data.D
import io.github.marcoh03.hogar.data.Rec
import io.github.marcoh03.hogar.data.Store
import io.github.marcoh03.hogar.data.fmtCur
import io.github.marcoh03.hogar.data.fmtDay
import io.github.marcoh03.hogar.data.fmtMonth
import io.github.marcoh03.hogar.data.fmtNum
import io.github.marcoh03.hogar.data.num
import io.github.marcoh03.hogar.data.shiftMonth
import io.github.marcoh03.hogar.data.str
import io.github.marcoh03.hogar.data.strList
import io.github.marcoh03.hogar.data.thisMonth

object MoneyState {
    var month by mutableStateOf(thisMonth())
}

private fun oneAccount() = D.accounts().size <= 1

fun balanceText(bal: Map<String, Double>): String =
    bal.filterValues { it != 0.0 }.map { (c, v) -> fmtCur(v, c) }.joinToString(" · ").ifEmpty { "Vacía" }

@Composable
fun RateChip() {
    val r = D.rateOf("USD")
    AssistChip(
        onClick = { Nav.push(Route.Rates) },
        label = { Text(if (r > 0) "1 USD = ${fmtNum(r)} CUP" else "Fijar tasa USD") },
        leadingIcon = { Icon(Icons.Outlined.CurrencyExchange, null, Modifier.size(18.dp)) },
        modifier = Modifier.padding(end = 8.dp),
    )
}

@Composable
fun MovementSheet(accountId: String? = null, onDismiss: () -> Unit) {
    ChoiceSheet(
        title = "Nuevo movimiento",
        choices = listOfNotNull(
            Choice("Gasto", Icons.Outlined.ArrowUpward, "Dinero que sale") { Nav.push(Route.Txn("expense", accountId = accountId)) },
            Choice("Entrada de dinero", Icons.Outlined.ArrowDownward, "Salario, remesa…") { Nav.push(Route.Txn("income", accountId = accountId)) },
            if (oneAccount()) null else Choice("Pasar dinero entre cuentas", Icons.Outlined.SwapHoriz) { Nav.push(Route.Transfer(from = accountId)) },
            Choice("Cambiar moneda", Icons.Outlined.CurrencyExchange, "Por ejemplo, dólares a pesos") { Nav.push(Route.Exchange(accountId = accountId)) },
        ),
        onDismiss = onDismiss,
    )
}

@Composable
private fun ActionButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, color: String, onClick: () -> Unit) {
    Column(
        Modifier.clip(RoundedCornerShape(16.dp)).clickable(onClick = onClick).padding(8.dp).width(76.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.size(56.dp).clip(RoundedCornerShape(18.dp)).background(keyContainer(color)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = keyColor(color))
        }
        Text(label, style = MaterialTheme.typography.labelMedium, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp))
    }
}

@Composable
fun MoneyActions(accountId: String? = null) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
        ActionButton(Icons.Outlined.ArrowUpward, "Gasto", "red") { Nav.push(Route.Txn("expense", accountId = accountId)) }
        ActionButton(Icons.Outlined.ArrowDownward, "Entrada", "green") { Nav.push(Route.Txn("income", accountId = accountId)) }
        if (!oneAccount()) ActionButton(Icons.Outlined.SwapHoriz, "Pasar", "blue") { Nav.push(Route.Transfer(from = accountId)) }
        ActionButton(Icons.Outlined.CurrencyExchange, "Cambiar moneda", "orange") { Nav.push(Route.Exchange(accountId = accountId)) }
    }
}

/** Movimiento en una lista. ctxAccount: cuenta desde cuyo punto de vista se muestra. */
@Composable
fun TxnRow(t: Rec, ctxAccount: String? = null) {
    val acc = D.account(t.str("accountId"))
    val to = D.account(t.str("toAccountId"))
    val cat = D.category(t.str("categoryId"))
    val accName = if (!oneAccount()) acc?.str("name") else null
    val cur = t.str("currency", D.BASE)
    when (t.str("type")) {
        "expense" -> {
            val tags = t.strList("tagIds").mapNotNull { D.tag(it) }
            Item(
                t.str("desc").ifEmpty { cat?.str("name") ?: "Gasto" },
                supportingContent = {
                    Column {
                        val sub = listOfNotNull(if (t.str("desc").isNotEmpty()) cat?.str("name") else null, accName).joinToString(" · ")
                        if (sub.isNotEmpty()) Text(sub)
                        if (tags.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 2.dp)) {
                            tags.forEach { SmallLabel(it.str("name"), it.str("color")) }
                        }
                    }
                },
                leading = { if (cat != null) EmojiBadge(cat.str("emoji"), cat.str("color")) else IconBadge(Icons.Outlined.ArrowUpward, "red") },
                trailing = { Text(fmtCur(-t.num("amount"), cur), style = MaterialTheme.typography.bodyLarge) },
                onClick = { Nav.openTxn(t) },
            )
        }
        "income" -> Item(
            t.str("desc").ifEmpty { "Entrada de dinero" },
            supporting = accName ?: D.member(t.str("by"))?.let { "Recibido por ${it.str("name")}" },
            leading = { IconBadge(Icons.Outlined.ArrowDownward, "green") },
            trailing = { Text(fmtCur(t.num("amount"), cur, sign = true), color = Positive, style = MaterialTheme.typography.bodyLarge) },
            onClick = { Nav.openTxn(t) },
        )
        "transfer" -> {
            val sign = when (ctxAccount) { null -> 0; t.str("toAccountId") -> 1; else -> -1 }
            Item(
                t.str("desc").ifEmpty { "Paso entre cuentas" },
                supporting = "${acc?.str("name") ?: "?"} → ${to?.str("name") ?: "?"}",
                leading = { IconBadge(Icons.Outlined.SwapHoriz, "blue") },
                trailing = {
                    Text(
                        fmtCur(if (sign != 0) sign * t.num("amount") else t.num("amount"), cur, sign = sign > 0),
                        color = if (sign > 0) Positive else MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodyLarge,
                    )
                },
                onClick = { Nav.openTxn(t) },
            )
        }
        else -> Item(
            t.str("desc").ifEmpty { "Cambio de moneda" },
            supporting = "${fmtCur(t.num("amount"), cur)} → ${fmtCur(t.num("toAmount"), t.str("toCurrency"))}",
            leading = { IconBadge(Icons.Outlined.CurrencyExchange, "orange") },
            onClick = { Nav.openTxn(t) },
        )
    }
}

/** Tarjeta de «Disponible» (cuenta principal). */
@Composable
fun AvailableCard(onClick: (() -> Unit)? = null) {
    val tot = D.totals()
    val main = D.mainAccount()
    val held = tot.byCur.filterValues { it != 0.0 }
    val foreign = held.keys.any { it != D.BASE }
    val content: @Composable () -> Unit = {
        Column(Modifier.padding(20.dp)) {
            Text(
                if (!oneAccount() && main != null) "Disponible en ${main.str("emoji")} ${main.str("name")}" else "Disponible",
                style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Text(
                fmtCur(tot.value.cup), style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.SemiBold,
                color = if (tot.value.cup < 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.padding(top = 4.dp),
            )
            usdWords(tot.value.cup)?.let { Text(it, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.75f)) }
            if (foreign) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 12.dp)) {
                    Text("Tienes", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.align(Alignment.CenterVertically))
                    held.forEach { (c, v) -> SuggestionChip(onClick = {}, label = { Text("${D.curInfo(c).flag} ${fmtCur(v, c)}") }) }
                }
            }
            if (tot.value.missing.isNotEmpty()) Text(
                "Falta la tasa de ${tot.value.missing.joinToString(", ")}: tócala arriba para ponerla.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
    val colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    val mod = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
    if (onClick != null) Card(onClick = onClick, modifier = mod, shape = RoundedCornerShape(28.dp), colors = colors) { content() }
    else Card(modifier = mod, shape = RoundedCornerShape(28.dp), colors = colors) { content() }
}

@Composable
fun MoneyScreen() {
    observeStore()
    var sheet by remember { mutableStateOf(false) }
    val month = MoneyState.month
    val s = D.monthSummary(month)
    val accs = D.accounts()
    val main = D.mainAccountId()
    val led = D.ledger()
    val isCurrent = month == thisMonth()
    val br = D.categoryBreakdown(month)

    TabScaffold(
        title = "Finanzas",
        actions = { RateChip() },
        fab = { FloatingActionButton(onClick = { sheet = true }) { Icon(Icons.Outlined.Add, "Nuevo movimiento") } },
    ) {
        item { AvailableCard() }
        item { MoneyActions() }
        item { SectionTitle("Cuentas") }
        item {
            GroupCard {
                accs.sortedByDescending { it.str("id") == main }.forEach { a ->
                    Item(
                        a.str("name"),
                        supporting = balanceText(D.accountBalances(a, led)),
                        leading = { EmojiBadge(a.str("emoji"), a.str("color")) },
                        trailing = if (accs.size > 1 && a.str("id") == main) ({ SmallLabel("Principal", "yellow") }) else null,
                        onClick = { Nav.push(Route.Account(a.str("id"))) },
                    )
                }
                Item("Nueva cuenta", headlineColor = MaterialTheme.colorScheme.primary, leading = { Icon(Icons.Outlined.Add, null, tint = MaterialTheme.colorScheme.primary) }, onClick = { Nav.push(Route.AccountEdit(null)) })
            }
        }
        if (accs.size > 1) item { Box(Modifier.padding(horizontal = 24.dp, vertical = 6.dp)) { Hint("El resumen del mes solo tiene en cuenta la cuenta principal.") } }

        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { MoneyState.month = shiftMonth(month, -1) }) { Icon(Icons.Outlined.ChevronLeft, "Mes anterior") }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(fmtMonth(month), style = MaterialTheme.typography.titleMedium)
                    if (!isCurrent) TextButton(onClick = { MoneyState.month = thisMonth() }) { Text("Volver a este mes") }
                }
                IconButton(onClick = { MoneyState.month = shiftMonth(month, 1) }) { Icon(Icons.Outlined.ChevronRight, "Mes siguiente") }
            }
        }
        item {
            Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatCard(Modifier.weight(1f), "Entradas", s.income, positive = true)
                StatCard(Modifier.weight(1f), "Gastado", s.spent, positive = false)
            }
        }
        if (br.rows.isNotEmpty()) {
            item { SectionTitle("Gastos por categoría") { Text(fmtCur(br.total), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
            item { CategoryBreakdownCard(br, month) }
            item {
                Card(
                    onClick = { Nav.push(Route.Stats(month)) },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                ) {
                    Item("Ver estadísticas del mes", supporting = "Media por día, previsión y meses anteriores",
                        leading = { IconBadge(Icons.Outlined.BarChart, "indigo") }, trailing = { Icon(Icons.Outlined.ChevronRight, null) })
                }
            }
        }
        item { SectionTitle(if (!oneAccount()) "Movimientos de ${D.mainAccount()?.str("name") ?: ""}" else "Movimientos") }
        if (s.list.isEmpty()) {
            item { EmptyState(Icons.AutoMirrored.Outlined.ReceiptLong, "Sin movimientos este mes", "Anota las entradas de dinero, los gastos y los cambios de moneda para saber cuánto queda.") }
        } else {
            s.list.groupBy { it.str("date") }.forEach { (date, arr) ->
                item { Text(fmtDay(date), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 24.dp, top = 12.dp, bottom = 6.dp)) }
                item { GroupCard { arr.forEach { TxnRow(it, main) } } }
            }
            if (!oneAccount()) item { Box(Modifier.padding(horizontal = 24.dp, vertical = 8.dp)) { Hint("Los movimientos de las otras cuentas están dentro de cada cuenta.") } }
        }
    }
    if (sheet) MovementSheet(onDismiss = { sheet = false })
}

@Composable
private fun StatCard(modifier: Modifier, label: String, v: D.Money, positive: Boolean) {
    Card(modifier = modifier, shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(16.dp)) {
            Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(fmtCur(v.cup), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold,
                color = if (positive && v.cup > 0) Positive else MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(top = 4.dp))
            Text(usdRounded(v.usd).takeIf { v.cup > 0 } ?: " ", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun CategoryBreakdownCard(br: D.CatBreakdown, month: String) {
    GroupCard {
        val parts = br.rows.map { it.cup to keyColor(it.cat?.str("color") ?: "gray") }
        SplitBar(parts, Modifier.padding(horizontal = 16.dp, vertical = 12.dp))
        br.rows.forEach { r ->
            Item(
                r.cat?.str("name") ?: "Sin categoría",
                supporting = "${r.count} ${if (r.count == 1) "gasto" else "gastos"}",
                leading = { if (r.cat != null) EmojiBadge(r.cat.str("emoji"), r.cat.str("color")) else EmojiBadge("🧾", "gray") },
                trailing = {
                    Column(horizontalAlignment = Alignment.End) {
                        Text(fmtCur(r.cup), style = MaterialTheme.typography.bodyLarge)
                        Text("${Math.round(r.pct)} %", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                onClick = { Nav.push(Route.CategoryDetail(r.id, month)) },
            )
        }
    }
    Box(Modifier.padding(horizontal = 24.dp, vertical = 6.dp)) {
        Hint("Toca una categoría para ver el desglose por etiquetas." + if (!oneAccount()) " Solo cuentan los gastos de la cuenta principal." else "")
    }
}

/* ---------- Detalle de cuenta ---------- */

@Composable
fun AccountScreen(id: String) {
    observeStore()
    val a = D.account(id)
    if (a == null) { androidx.compose.runtime.LaunchedEffect(Unit) { Nav.pop() }; return }
    var menu by remember { mutableStateOf(false) }
    var addCur by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    val bal = D.accountBalances(a)
    val isMain = D.isMainAccount(id)
    EditorScaffold(
        title = a.str("name"),
        back = true,
        actions = {
            Box {
                IconButton(onClick = { menu = true }) { Icon(Icons.Outlined.MoreVert, "Más opciones") }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(text = { Text("Editar cuenta") }, leadingIcon = { Icon(Icons.Outlined.Edit, null) }, onClick = { menu = false; Nav.push(Route.AccountEdit(id)) })
                    DropdownMenuItem(text = { Text("Eliminar cuenta") }, leadingIcon = { Icon(Icons.Outlined.Delete, null) }, onClick = { menu = false; confirmDelete = true })
                }
            }
        },
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            EmojiBadge(a.str("emoji"), a.str("color"), 72.dp)
            Spacer(Modifier.height(12.dp))
            bal.forEach { (c, v) ->
                Text("${D.curInfo(c).flag}  ${fmtCur(v, c)}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold,
                    color = if (v < 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
            }
            Box {
                TextButton(onClick = { addCur = true }) { Icon(Icons.Outlined.Add, null); Text(" Añadir otra moneda") }
                DropdownMenu(expanded = addCur, onDismissRequest = { addCur = false }) {
                    D.allCurrencies().filter { it !in a.strList("currencies") }.forEach { c ->
                        DropdownMenuItem(text = { Text("${D.curInfo(c).flag}  $c · ${D.curInfo(c).name}") }, onClick = { D.addCurrencyToAccount(id, c); addCur = false })
                    }
                }
            }
        }
        if (isMain && !oneAccount()) {
            Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
                    Icon(Icons.Outlined.Star, null, tint = MaterialTheme.colorScheme.onTertiaryContainer)
                    Text(
                        "Cuenta principal. Es el dinero del mes: su saldo es lo disponible y sus gastos son los que cuentan en el resumen.",
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onTertiaryContainer, modifier = Modifier.padding(start = 12.dp),
                    )
                }
            }
        }
        MoneyActions(id)
        if (!isMain) {
            OutlinedButton(onClick = { D.setMainAccount(id); Toast.show("«${a.str("name")}» es ahora la cuenta principal") }, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Outlined.Star, null); Text("  Usar como cuenta principal")
            }
            Hint("La cuenta principal es la del dinero del mes. Las demás (reserva, ahorro…) se pueden usar igual, pero no cuentan en lo disponible ni en las estadísticas.")
        }
        val list = D.accountTxns(id, 30)
        if (list.isNotEmpty()) {
            FieldLabel("Últimos movimientos")
            GroupCard(padded = false) { list.forEach { TxnRow(it, id) } }
        }
    }
    if (confirmDelete) ConfirmDialog(
        "¿Eliminar «${a.str("name")}»?",
        if (bal.values.any { it != 0.0 }) "Todavía tiene ${balanceText(bal)}. Los movimientos se conservarán en el historial." else "Los movimientos se conservarán en el historial.",
        onConfirm = { Store.remove("accounts", id); Nav.pop() }, onDismiss = { confirmDelete = false },
    )
}

/* ---------- Detalle de categoría ---------- */

@Composable
fun CategoryScreen(catId: String, startMonth: String) {
    observeStore()
    var m by remember { mutableStateOf(startMonth) }
    var filter by remember { mutableStateOf<String?>(null) }
    val cat = D.category(catId)
    val color = cat?.str("color") ?: "gray"
    val br = D.tagBreakdown(m, catId)
    val monthTotal = D.spentIn(m)
    val prevKey = D.prevMonth(m)
    val prev = D.spentIn(prevKey, catId)
    val delta = if (prev > 0) (br.total - prev) / prev * 100 else null
    EditorScaffold(
        title = cat?.str("name") ?: "Sin categoría",
        back = true,
        actions = { if (cat != null) IconButton(onClick = { Nav.push(Route.CategoryEdit(catId)) }) { Icon(Icons.Outlined.Edit, "Editar categoría") } },
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            EmojiBadge(cat?.str("emoji") ?: "🧾", color, 72.dp)
            Text(fmtCur(br.total), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 12.dp))
            Text(
                if (br.total > 0 && monthTotal > 0) "${Math.round(br.total / monthTotal * 100)} % de lo gastado en ${fmtMonth(m, false).lowercase()}" else fmtMonth(m),
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            DeltaText(delta, fmtMonth(prevKey, false).lowercase())
        }
        if (br.list.isNotEmpty()) {
            FieldLabel("Por etiqueta")
            GroupCard(padded = false) {
                SplitBar(br.rows.map { it.cup to keyColor(it.tag?.str("color") ?: "gray") }, Modifier.padding(horizontal = 16.dp, vertical = 12.dp))
                br.rows.forEach { r ->
                    val on = filter == r.id
                    val dim = filter != null && !on
                    Item(
                        r.tag?.str("name") ?: "Sin etiqueta",
                        supportingContent = {
                            Column {
                                LinearProgressIndicator(
                                    progress = { (r.pct / 100).toFloat().coerceIn(0f, 1f) },
                                    color = keyColor(r.tag?.str("color") ?: "gray"),
                                    strokeCap = StrokeCap.Round, gapSize = 0.dp, drawStopIndicator = {},
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                )
                                Text("${r.count} ${if (r.count == 1) "gasto" else "gastos"}")
                            }
                        },
                        leading = { Swatch(r.tag?.str("color") ?: "gray", 14.dp) },
                        trailing = {
                            Column(horizontalAlignment = Alignment.End) {
                                Text(fmtCur(r.cup))
                                Text("${Math.round(r.pct)} %", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        },
                        modifier = Modifier.background(if (on) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceContainerLow.copy(alpha = 0f))
                            .let { if (dim) it.padding(0.dp) else it },
                        headlineColor = if (dim) MaterialTheme.colorScheme.onSurfaceVariant else androidx.compose.ui.graphics.Color.Unspecified,
                        onClick = { filter = if (on) null else r.id },
                    )
                }
            }
            Hint((if (br.overlap) "Un gasto con varias etiquetas cuenta en cada una, por eso los porcentajes pueden sumar más de 100 %. " else "") + "Toca una etiqueta para ver solo sus gastos.")
        }
        FieldLabel("Últimos 6 meses")
        GroupCard(padded = false) { ColumnChart(D.spendSeries(m, 6, catId), keyColor(color), m) { m = it; filter = null } }
        val list = br.list.filter { t ->
            when (filter) {
                null -> true
                "" -> t.strList("tagIds").none { D.tag(it) != null }
                else -> filter in t.strList("tagIds")
            }
        }
        FieldLabel(if (filter == null) "Gastos de ${fmtMonth(m, false).lowercase()}" else "Gastos: ${D.tag(filter)?.str("name") ?: "sin etiqueta"}")
        if (list.isEmpty()) Hint("No hay gastos en este mes. Toca otro mes en el gráfico.")
        else GroupCard(padded = false) { list.forEach { TxnRow(it) } }
    }
}

/* ---------- Estadísticas ---------- */

@Composable
fun StatsScreen(startMonth: String) {
    observeStore()
    var m by remember { mutableStateOf(startMonth) }
    val st = D.monthStats(m)
    val prevKey = D.prevMonth(m)
    val prev = D.spentIn(prevKey)
    val delta = if (prev > 0) (st.total - prev) / prev * 100 else null
    val series = D.spendSeries(m, 6)
    val nonZero = series.filter { it.cup > 0 }
    val avg = if (nonZero.isNotEmpty()) nonZero.sumOf { it.cup } / nonZero.size else 0.0
    val s = D.monthSummary(m)
    EditorScaffold(title = "Estadísticas", back = true) {
        FieldLabel("Lo gastado cada mes" + if (avg > 0) " · media ${fmtCur(Math.round(avg).toDouble())}" else "")
        GroupCard(padded = false) { ColumnChart(series, MaterialTheme.colorScheme.primary, m) { m = it } }
        Hint("Toca un mes para ver sus cifras." + if (!oneAccount()) " Solo cuentan los gastos de «${D.mainAccount()?.str("name") ?: ""}», la cuenta principal." else "")
        FieldLabel(fmtMonth(m))
        if (st.count == 0) Hint("Sin gastos este mes.")
        else GroupCard(padded = false) {
            Item("Gastado en total", trailing = { Text(fmtCur(st.total)) })
            Item("Gasto medio por día", trailing = { Text(fmtCur(st.avgDaily)) })
            st.projection?.let { p -> Item("Si se sigue gastando así", supporting = "Lo que se habrá gastado a fin de mes", trailing = { Text(fmtCur(p)) }) }
            st.biggest?.let { b ->
                Item("El gasto más grande", supporting = b.str("desc").ifEmpty { D.category(b.str("categoryId"))?.str("name") ?: "Gasto" }, trailing = { Text(fmtCur(b.num("cup"))) })
            }
            if (delta != null) Item("Comparado con ${fmtMonth(prevKey, false).lowercase()}", trailing = { DeltaText(delta, fmtMonth(prevKey, false).lowercase()) })
        }
        val people = s.byMember.filterValues { it > 0 }.toList().sortedByDescending { it.second }
        if (people.isNotEmpty() && D.members().size > 1) {
            FieldLabel("Quién ha pagado")
            GroupCard(padded = false) {
                people.forEach { (id, v) ->
                    val mem = D.member(id)
                    Item(mem?.str("name") ?: "Sin indicar", leading = { Avatar(mem, 36.dp) }, trailing = { Text(fmtCur(v)) })
                }
            }
        }
    }
}
