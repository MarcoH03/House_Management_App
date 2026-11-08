@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package io.github.marcoh03.hogar.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.ArrowUpward
import androidx.compose.material.icons.outlined.CurrencyExchange
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.SwapVert
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.marcoh03.hogar.data.D
import io.github.marcoh03.hogar.data.Rates
import io.github.marcoh03.hogar.data.Rec
import io.github.marcoh03.hogar.data.Store
import io.github.marcoh03.hogar.data.fmtCur
import io.github.marcoh03.hogar.data.fmtNum
import io.github.marcoh03.hogar.data.num
import io.github.marcoh03.hogar.data.parseAmount
import io.github.marcoh03.hogar.data.rec
import io.github.marcoh03.hogar.data.round2
import io.github.marcoh03.hogar.data.str
import io.github.marcoh03.hogar.data.strList
import io.github.marcoh03.hogar.data.strOrNull
import io.github.marcoh03.hogar.data.today
import io.github.marcoh03.hogar.data.with
import kotlinx.coroutines.launch

/* ---------- Estado de un pago (gasto, entrada o compra) ---------- */

class PaymentState(val kind: String, val prev: Rec?, accountId: String?, categoryId: String?, desc: String?) {
    var amountText by mutableStateOf(prev?.num("amount")?.takeIf { it > 0 }?.let { fmtNum(it) } ?: "")
    var currency by mutableStateOf(prev?.str("currency", D.BASE) ?: D.BASE)
        private set
    var accountId by mutableStateOf(prev?.str("accountId") ?: accountId ?: D.defaultAccountId())
    var categoryId by mutableStateOf(prev?.str("categoryId") ?: categoryId ?: "")
    var tagIds by mutableStateOf(prev?.strList("tagIds") ?: emptyList())
    var date by mutableStateOf(prev?.str("date")?.ifEmpty { null } ?: today())
    var by by mutableStateOf(prev?.strOrNull("by") ?: D.meId() ?: "")
    var desc by mutableStateOf(prev?.str("desc") ?: desc ?: "")
    var rateText by mutableStateOf(if (prev != null && prev.str("currency") != D.BASE) fmtNum(prev.num("rate")) else "")
    var showRate by mutableStateOf(false)
    val isNew = prev == null

    fun updateCurrency(c: String) {
        if (c == currency) return
        currency = c
        rateText = when {
            c == D.BASE -> ""
            prev != null && prev.str("currency") == c -> fmtNum(prev.num("rate"))
            D.rateOf(c) > 0 -> fmtNum(D.rateOf(c))
            else -> ""
        }
    }

    fun rate(): Double = if (currency == D.BASE) 1.0 else parseAmount(rateText)
    fun amount(): Double = parseAmount(amountText)

    data class Paid(val amount: Double, val currency: String, val rate: Double)

    /** Valida y devuelve el importe; avisa si falta algo. */
    fun read(optional: Boolean = false): Paid? {
        val a = amount()
        if (a <= 0) {
            if (optional) return Paid(0.0, currency, rate())
            Toast.show("Escribe el importe")
            return null
        }
        val r = rate()
        if (r <= 0) {
            showRate = true
            Toast.show("Escribe a cuánto está el cambio")
            return null
        }
        return Paid(a, currency, r)
    }
}

@Composable
fun rememberPayment(kind: String, prev: Rec? = null, accountId: String? = null, categoryId: String? = null, desc: String? = null): PaymentState =
    remember { PaymentState(kind, prev, accountId, categoryId, desc) }

@Composable
fun PaymentFields(pay: PaymentState, amountLabel: String, showDesc: Boolean = true) {
    observeStore()
    val isExp = pay.kind == "expense"
    val foreign = pay.currency != D.BASE
    val amt = pay.amount()
    val r = pay.rate()
    AmountInput(amountLabel, pay.amountText, { pay.amountText = it }, pay.currency, { pay.updateCurrency(it) }, autoFocus = pay.isNew && showDesc)

    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        if (foreign) {
            if (r > 0) Row(verticalAlignment = Alignment.CenterVertically) {
                if (amt > 0) Text("Son ${fmtCur(amt * r)} · ", style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = { pay.showRate = true }) { Text("1 ${pay.currency} = ${fmtCur(r)}") }
            } else Text("Escribe abajo a cuánto está el cambio", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
        }
        if (isExp && pay.accountId.isNotEmpty()) {
            val prev = pay.prev
            val have = (D.ledger()[pay.accountId]?.get(pay.currency) ?: 0.0) +
                (if (prev != null && prev.str("accountId") == pay.accountId && prev.str("currency") == pay.currency) prev.num("amount") else 0.0)
            val where = if (D.accounts().size > 1) " en ${D.account(pay.accountId)?.str("name") ?: "la cuenta"}" else ""
            Text(
                if (amt > have) "Solo hay ${fmtCur(have, pay.currency)}$where" else "Hay ${fmtCur(have, pay.currency)}$where",
                style = MaterialTheme.typography.bodyMedium,
                color = if (amt > have) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (D.accounts().size > 1 && pay.accountId.isNotEmpty() && !D.isMainAccount(pay.accountId)) {
            Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Info, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    " No sale de la cuenta principal: no contará en ${if (isExp) "lo gastado" else "las entradas"} del mes.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }

    if (showDesc) OutlinedTextField(
        pay.desc, { pay.desc = it },
        label = { Text(if (isExp) "¿En qué?" else "¿De dónde?") },
        placeholder = { Text(if (isExp) "p. ej. Factura de la luz" else "p. ej. Salario, remesa…") },
        singleLine = true, keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
        modifier = Modifier.fillMaxWidth(),
    )
    if (D.accounts().size > 1) DropdownField(if (isExp) "Pagar desde" else "Guardar en", pay.accountId, accountOptions(), { pay.accountId = it }, leading = Icons.Outlined.AccountBalance)
    if (isExp) {
        DropdownField("Categoría", pay.categoryId, listOf("" to "Sin categoría") + D.categories().map { it.str("id") to "${it.str("emoji")}  ${it.str("name")}" }, { pay.categoryId = it })
        FieldLabel("Etiquetas (opcional)")
        TagPicker(pay.tagIds, pay.categoryId, { pay.tagIds = it })
    }
    DateField("Fecha", pay.date, { pay.date = it ?: today() }, clearable = false)
    DropdownField(if (isExp) "Pagado por" else "Recibido por", pay.by, listOf("" to "—") + D.members().map { it.str("id") to it.str("name") }, { pay.by = it })
    if (foreign && (pay.showRate || r <= 0)) {
        OutlinedTextField(
            pay.rateText, { pay.rateText = it },
            label = { Text("Tasa: 1 ${pay.currency} =") },
            suffix = { Text("CUP") },
            singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            supportingText = { Text("Cambiarla solo afecta a este movimiento.") },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

fun accountOptions(): List<Pair<String, String>> {
    val many = D.accounts().size > 1
    return D.accounts().map { it.str("id") to "${it.str("emoji")}  ${it.str("name")}" + if (many && D.isMainAccount(it.str("id"))) " (principal)" else "" }
}

/* ---------- Gasto / entrada ---------- */

@Composable
fun TxnEditor(r: Route.Txn) {
    val prev = remember(r) { Store.get("txns", r.id) }
    val pay = rememberPayment(r.kind, prev, r.accountId, r.categoryId, r.desc)
    val isExp = r.kind == "expense"
    var confirmDelete by remember { mutableStateOf(false) }
    EditorScaffold(
        title = if (prev != null) (if (isExp) "Gasto" else "Entrada de dinero") else (if (isExp) "Nuevo gasto" else "Entrada de dinero"),
        onSave = save@{
            val p = pay.read() ?: return@save
            if (pay.accountId.isEmpty()) { Toast.show("Crea primero una cuenta en Finanzas"); return@save }
            Store.batch {
                val base = prev ?: rec("type" to r.kind)
                val saved = D.saveTxn(base.with(
                    "type" to r.kind, "amount" to p.amount, "currency" to p.currency, "rate" to p.rate,
                    "desc" to pay.desc.trim(), "accountId" to pay.accountId, "date" to pay.date, "by" to pay.by.ifEmpty { null },
                ).also {
                    if (isExp) { it.put("categoryId", pay.categoryId); it.put("tagIds", org.json.JSONArray(pay.tagIds)) }
                })
                D.addCurrencyToAccount(pay.accountId, p.currency)
                r.purchaseIds.forEach { pid -> Store.patch("purchases", pid, "billed" to true, "expenseId" to saved.str("id")) }
            }
            if (prev == null) Toast.show("${if (isExp) "Gasto" else "Entrada"} de ${fmtCur(p.amount, p.currency)} anotado")
            Nav.pop()
        },
    ) {
        PaymentFields(pay, if (isExp) "¿Cuánto costó?" else "¿Cuánto dinero entró?")
        if (prev != null) TextButton(onClick = { confirmDelete = true }, modifier = Modifier.fillMaxWidth()) {
            Text(if (isExp) "Eliminar gasto" else "Eliminar entrada", color = MaterialTheme.colorScheme.error)
        }
    }
    if (confirmDelete && prev != null) ConfirmDialog("¿Eliminar este movimiento?", "${prev.str("desc").ifEmpty { if (isExp) "Gasto" else "Entrada" }} · ${fmtCur(prev.num("amount"), prev.str("currency"))}",
        onConfirm = { Store.remove("txns", prev.str("id")); Nav.pop() }, onDismiss = { confirmDelete = false })
}

/* ---------- Pasar dinero entre cuentas ---------- */

@Composable
fun TransferEditor(id: String?, from: String?) {
    val prev = remember(id) { Store.get("txns", id) }
    val accs = D.accounts()
    val main = D.mainAccountId()
    val defFrom = from ?: accs.firstOrNull { it.str("id") != main }?.str("id") ?: accs.firstOrNull()?.str("id") ?: ""
    var amountText by remember { mutableStateOf(prev?.num("amount")?.let { fmtNum(it) } ?: "") }
    var currency by remember { mutableStateOf(prev?.str("currency", D.BASE) ?: D.BASE) }
    var fromId by remember { mutableStateOf(prev?.str("accountId") ?: defFrom) }
    var toId by remember { mutableStateOf(prev?.str("toAccountId") ?: (if (defFrom == main) accs.firstOrNull { it.str("id") != main }?.str("id") else main) ?: "") }
    var date by remember { mutableStateOf(prev?.str("date") ?: today()) }
    var desc by remember { mutableStateOf(prev?.str("desc") ?: "") }
    var confirmDelete by remember { mutableStateOf(false) }

    if (accs.size < 2 && prev == null) {
        EditorScaffold(title = "Pasar dinero") {
            EmptyState(Icons.Outlined.AccountBalance, "Necesitas dos cuentas", "Crea otra cuenta en Finanzas (por ejemplo «Reserva» o «Ahorro») para poder pasar dinero de una a otra.")
        }
        return
    }
    val amt = parseAmount(amountText)
    val have = (D.ledger()[fromId]?.get(currency) ?: 0.0) +
        (if (prev != null && prev.str("accountId") == fromId && prev.str("currency") == currency) prev.num("amount") else 0.0)
    EditorScaffold(
        title = "Pasar dinero",
        onSave = save@{
            if (amt <= 0) { Toast.show("Escribe la cantidad"); return@save }
            if (fromId == toId) { Toast.show("Elige dos cuentas distintas"); return@save }
            Store.batch {
                D.saveTxn((prev ?: rec()).with("type" to "transfer", "amount" to amt, "currency" to currency, "accountId" to fromId, "toAccountId" to toId, "date" to date, "desc" to desc.trim()))
                D.addCurrencyToAccount(toId, currency)
            }
            if (prev == null) Toast.show("${fmtCur(amt, currency)} pasados")
            Nav.pop()
        },
    ) {
        AmountInput("¿Cuánto quieres pasar?", amountText, { amountText = it }, currency, { currency = it }, autoFocus = prev == null)
        Text(
            (if (amt > have) "Solo hay " else "Hay ") + "${fmtCur(have, currency)} en ${D.account(fromId)?.str("name") ?: "la cuenta"}",
            color = if (amt > have) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
        )
        DropdownField("Desde", fromId, accountOptions(), { fromId = it }, leading = Icons.Outlined.ArrowUpward)
        DropdownField("Hacia", toId, accountOptions(), { toId = it }, leading = Icons.Outlined.ArrowDownward)
        DateField("Fecha", date, { date = it ?: today() }, clearable = false)
        OutlinedTextField(desc, { desc = it }, label = { Text("Nota (opcional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        if (prev != null) TextButton(onClick = { confirmDelete = true }, modifier = Modifier.fillMaxWidth()) { Text("Eliminar", color = MaterialTheme.colorScheme.error) }
    }
    if (confirmDelete && prev != null) ConfirmDialog("¿Eliminar este movimiento?", onConfirm = { Store.remove("txns", prev.str("id")); Nav.pop() }, onDismiss = { confirmDelete = false })
}

/* ---------- Cambiar moneda ---------- */

@Composable
private fun CurrencyMenuChip(code: String, onChange: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        AssistChip(onClick = { open = true }, label = { Text("${D.curInfo(code).flag}  $code", fontWeight = FontWeight.SemiBold) }, trailingIcon = { Icon(Icons.Filled.ArrowDropDown, null) })
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            D.allCurrencies().forEach { c -> DropdownMenuItem(text = { Text("${D.curInfo(c).flag}  $c · ${D.curInfo(c).name}") }, onClick = { onChange(c); open = false }) }
        }
    }
}

@Composable
fun ExchangeEditor(id: String?, accountId: String?) {
    val prev = remember(id) { Store.get("txns", id) }
    var accId by remember { mutableStateOf(prev?.str("accountId") ?: accountId ?: D.defaultAccountId()) }
    var amountText by remember { mutableStateOf(prev?.num("amount")?.let { fmtNum(it) } ?: "") }
    var currency by remember { mutableStateOf(prev?.str("currency") ?: "USD") }
    var toText by remember { mutableStateOf(prev?.num("toAmount")?.let { fmtNum(it) } ?: "") }
    var toCurrency by remember { mutableStateOf(prev?.str("toCurrency") ?: D.BASE) }
    var touched by remember { mutableStateOf(prev != null) }
    var date by remember { mutableStateOf(prev?.str("date") ?: today()) }
    var desc by remember { mutableStateOf(prev?.str("desc") ?: "") }
    var confirmDelete by remember { mutableStateOf(false) }
    val amt = parseAmount(amountText)

    LaunchedEffect(amountText, currency, toCurrency) {
        if (!touched) toText = D.convert(amt, currency, toCurrency).takeIf { it > 0 }?.let { fmtNum(it) } ?: ""
    }
    val got = parseAmount(toText)
    val have = (D.ledger()[accId]?.get(currency) ?: 0.0) +
        (if (prev != null && prev.str("accountId") == accId && prev.str("currency") == currency) prev.num("amount") else 0.0)
    val rateText = when {
        amt > 0 && got > 0 && currency != toCurrency -> when {
            toCurrency == D.BASE -> "1 $currency = ${fmtCur(round2(got / amt))}"
            currency == D.BASE -> "1 $toCurrency = ${fmtCur(round2(amt / got))}"
            else -> "1 $currency = ${fmtCur(round2(got / amt), toCurrency)}"
        }
        D.rateOf(currency) <= 0 || D.rateOf(toCurrency) <= 0 -> "Escribe cuánto te dan"
        else -> ""
    }

    EditorScaffold(
        title = "Cambiar moneda",
        onSave = save@{
            if (currency == toCurrency) { Toast.show("Elige dos monedas distintas"); return@save }
            if (amt <= 0 || got <= 0) { Toast.show("Escribe las dos cantidades"); return@save }
            if (accId.isEmpty()) { Toast.show("Crea primero una cuenta en Finanzas"); return@save }
            Store.batch {
                D.saveTxn((prev ?: rec()).with("type" to "exchange", "amount" to amt, "currency" to currency, "toAmount" to got, "toCurrency" to toCurrency, "accountId" to accId, "date" to date, "desc" to desc.trim()))
                D.addCurrencyToAccount(accId, toCurrency)
            }
            if (prev == null) Toast.show("${fmtCur(amt, currency)} → ${fmtCur(got, toCurrency)}")
            Nav.pop()
        },
    ) {
        if (D.accounts().size > 1) DropdownField("Cuenta", accId, accountOptions(), { accId = it }, leading = Icons.Outlined.AccountBalance)
        Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
            Column(Modifier.padding(16.dp)) {
                Text("Cambio", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(amountText, { amountText = it.filter { c -> c.isDigit() || c == ',' || c == '.' } }, singleLine = true,
                        textStyle = MaterialTheme.typography.headlineSmall, placeholder = { Text("0") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.weight(1f))
                    CurrencyMenuChip(currency) { currency = it; touched = false }
                }
                Text(if (amt > have) "Solo hay ${fmtCur(have, currency)}" else "Hay ${fmtCur(have, currency)}",
                    style = MaterialTheme.typography.bodySmall, color = if (amt > have) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    FilledTonalIconButton(onClick = { val c = currency; currency = toCurrency; toCurrency = c; touched = false }) { Icon(Icons.Outlined.SwapVert, "Intercambiar monedas") }
                }
                Text("Me dan", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(toText, { toText = it.filter { c -> c.isDigit() || c == ',' || c == '.' }; touched = true }, singleLine = true,
                        textStyle = MaterialTheme.typography.headlineSmall, placeholder = { Text("0") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.weight(1f))
                    CurrencyMenuChip(toCurrency) { toCurrency = it; touched = false }
                }
                if (rateText.isNotEmpty()) Text(rateText, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
            }
        }
        Hint("La cantidad que te dan se calcula sola con la tasa del día. Si te dieron otra, escríbela.")
        DateField("Fecha", date, { date = it ?: today() }, clearable = false)
        OutlinedTextField(desc, { desc = it }, label = { Text("Nota (opcional)") }, placeholder = { Text("p. ej. con quién") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        if (prev != null) TextButton(onClick = { confirmDelete = true }, modifier = Modifier.fillMaxWidth()) { Text("Eliminar cambio", color = MaterialTheme.colorScheme.error) }
    }
    if (confirmDelete && prev != null) ConfirmDialog("¿Eliminar este cambio?", onConfirm = { Store.remove("txns", prev.str("id")); Nav.pop() }, onDismiss = { confirmDelete = false })
}

/* ---------- Cuenta ---------- */

@Composable
fun AccountEditor(id: String?) {
    val prev = remember(id) { D.account(id) }
    val n = D.accounts().size
    var name by remember { mutableStateOf(prev?.str("name") ?: "") }
    var emoji by remember { mutableStateOf(prev?.str("emoji") ?: if (n == 0) "🏠" else "💵") }
    var color by remember { mutableStateOf(prev?.str("color") ?: D.COLORS[n % D.COLORS.size]) }
    var curs by remember { mutableStateOf(prev?.strList("currencies") ?: listOf(D.BASE, "USD")) }
    EditorScaffold(
        title = if (prev == null) "Nueva cuenta" else "Editar cuenta",
        saveEnabled = name.isNotBlank(),
        onSave = {
            D.saveAccount((prev ?: rec()).with("name" to name, "emoji" to emoji, "color" to color, "currencies" to curs.ifEmpty { listOf(D.BASE) }))
            Nav.pop()
        },
    ) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { EmojiBadge(emoji, color, 72.dp) }
        OutlinedTextField(name, { name = it }, label = { Text("Nombre") }, placeholder = { Text("p. ej. Reserva, Ahorro, Remesas") }, singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth())
        if (prev == null) {
            FieldLabel("Monedas")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                D.CURRENCY_CATALOG.take(6).forEach { c ->
                    val on = c.code in curs
                    FilterChip(selected = on, onClick = { curs = if (on) curs - c.code else curs + c.code },
                        label = { Text("${c.flag} ${c.code}") }, leadingIcon = if (on) ({ Icon(Icons.Filled.Check, null, Modifier.size(18.dp)) }) else null)
                }
            }
            Hint("Podrás añadir más monedas en cualquier momento.")
        }
        FieldLabel("Icono")
        EmojiPicker(emoji, D.ACCOUNT_EMOJIS) { emoji = it }
        FieldLabel("Color")
        ColorPicker(color, D.COLORS) { color = it }
    }
}

/* ---------- Tasas de cambio ---------- */

@Composable
fun RatesScreen() {
    val scope = rememberCoroutineScope()
    val initial = remember {
        val codes = (D.currenciesInUse() - D.BASE).toMutableList()
        if ("USD" !in codes) codes.add(0, "USD")
        codes
    }
    val values = remember { mutableStateMapOf<String, String>().apply { initial.forEach { put(it, D.rateOf(it).takeIf { r -> r > 0 }?.let { r -> fmtNum(r) } ?: "") } } }
    var codes by remember { mutableStateOf(initial.toList()) }
    var auto by remember { mutableStateOf(D.autoRates()) }
    var addOpen by remember { mutableStateOf(false) }
    var source by remember { mutableStateOf(Rates.sourceText()) }
    var loading by remember { mutableStateOf(false) }

    EditorScaffold(
        title = "Tasas de cambio",
        onSave = {
            val rates = codes.associateWith { parseAmount(values[it]) }.filterValues { it > 0 }
            val changed = codes.any { round2(parseAmount(values[it])) != round2(D.rateOf(it)) }
            if (changed) {
                D.setRates(rates, source = "manual", auto = auto)
                rates["USD"]?.let { Toast.show("Tasas guardadas: 1 USD = ${fmtCur(it)}") }
            } else if (auto != D.autoRates()) D.setAutoRates(auto)
            Nav.pop()
        },
    ) {
        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
            Text(
                "Cuántos CUP vale cada moneda en el mercado informal. Se usan para valorar los saldos y como propuesta al anotar gastos y cambios. " +
                    "Los movimientos ya anotados conservan su tasa: cambiarla aquí no altera el pasado.",
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSecondaryContainer, modifier = Modifier.padding(16.dp),
            )
        }
        Text(source, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        codes.forEach { c ->
            OutlinedTextField(
                values[c] ?: "", { values[c] = it },
                label = { Text("${D.curInfo(c).flag}  1 $c =") }, suffix = { Text("CUP") }, placeholder = { Text("—") },
                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth(),
            )
        }
        Box {
            TextButton(onClick = { addOpen = true }) { Icon(Icons.Outlined.Add, null); Text(" Añadir moneda") }
            DropdownMenu(expanded = addOpen, onDismissRequest = { addOpen = false }) {
                D.CURRENCY_CATALOG.map { it.code }.filter { it != D.BASE && it !in codes }.forEach { c ->
                    DropdownMenuItem(text = { Text("${D.curInfo(c).flag}  $c · ${D.curInfo(c).name}") }, onClick = { codes = codes + c; values[c] = ""; addOpen = false })
                }
            }
        }
        HorizontalDivider()
        SwitchRow("Actualizar desde elTOque", auto, { auto = it },
            supporting = "Si cambias una tasa a mano, se mantiene hasta que elTOque publique una más reciente (o siempre, si lo desactivas).")
        OutlinedButton(
            onClick = {
                loading = true
                scope.launch {
                    val (res, data) = Rates.refresh(force = true)
                    loading = false
                    if (res == Rates.Result.UNAVAILABLE || data == null) {
                        Toast.show("No se pudo descargar la tasa de elTOque")
                    } else {
                        val r = data.getJSONObject("rates")
                        r.keys().forEach { k -> r.optDouble(k, 0.0).takeIf { it > 0 }?.let { v -> if (k !in codes) codes = codes + k; values[k] = fmtNum(v) } }
                        source = Rates.sourceText()
                        Toast.show("Tasas de elTOque: 1 USD = ${fmtCur(r.optDouble("USD", 0.0))}")
                    }
                }
            },
            enabled = !loading,
            modifier = Modifier.fillMaxWidth(),
        ) { Icon(Icons.Outlined.Sync, null); Text(if (loading) "  Buscando…" else "  Buscar tasas de elTOque ahora") }
    }
}

/* ---------- Categorías y etiquetas ---------- */

@Composable
fun CategoriesScreen() {
    observeStore()
    EditorScaffold(title = "Categorías de gasto", back = true) {
        Hint("Sirven para ver en qué se va el dinero de la casa cada mes.")
        GroupCard(padded = false) {
            D.categories().forEach { c ->
                Item(c.str("name"), leading = { EmojiBadge(c.str("emoji"), c.str("color")) }, onClick = { Nav.push(Route.CategoryEdit(c.str("id"))) })
            }
            Item("Nueva categoría", headlineColor = MaterialTheme.colorScheme.primary, leading = { Icon(Icons.Outlined.Add, null, tint = MaterialTheme.colorScheme.primary) },
                onClick = { Nav.push(Route.CategoryEdit(null)) })
        }
    }
}

@Composable
fun CategoryEditor(id: String?) {
    val prev = remember(id) { D.category(id) }
    var name by remember { mutableStateOf(prev?.str("name") ?: "") }
    var emoji by remember { mutableStateOf(prev?.str("emoji") ?: "🛒") }
    var color by remember { mutableStateOf(prev?.str("color") ?: "green") }
    var confirmDelete by remember { mutableStateOf(false) }
    EditorScaffold(
        title = if (prev == null) "Nueva categoría" else "Categoría",
        saveEnabled = name.isNotBlank(),
        onSave = { D.saveCategory((prev ?: rec()).with("name" to name.trim(), "emoji" to emoji, "color" to color)); Nav.pop() },
    ) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { EmojiBadge(emoji, color, 72.dp) }
        OutlinedTextField(name, { name = it }, label = { Text("Nombre") }, singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth())
        FieldLabel("Icono")
        EmojiPicker(emoji, D.BUDGET_EMOJIS) { emoji = it }
        FieldLabel("Color")
        ColorPicker(color, D.CHART_COLORS) { color = it }
        if (prev != null) TextButton(onClick = { confirmDelete = true }, modifier = Modifier.fillMaxWidth()) { Text("Eliminar categoría", color = MaterialTheme.colorScheme.error) }
    }
    if (confirmDelete && prev != null) ConfirmDialog("¿Eliminar «${prev.str("name")}»?", "Sus gastos quedarán como «Sin categoría».",
        onConfirm = { Store.remove("budgets", prev.str("id")); Nav.pop() }, onDismiss = { confirmDelete = false })
}

@Composable
fun TagsScreen() {
    observeStore()
    EditorScaffold(title = "Etiquetas", back = true) {
        Hint("Agrupan los gastos dentro de cada categoría (p. ej. «Carne», «Aseo», «Cumpleaños»). También puedes crearlas al anotar un gasto.")
        GroupCard(padded = false) {
            D.tags().forEach { t ->
                val uses = D.tagUsage(t.str("id"))
                Item(t.str("name"), supporting = "$uses ${if (uses == 1) "gasto" else "gastos"}", leading = { Swatch(t.str("color"), 16.dp) },
                    onClick = { Nav.push(Route.TagEdit(t.str("id"))) })
            }
            Item("Nueva etiqueta", headlineColor = MaterialTheme.colorScheme.primary, leading = { Icon(Icons.Outlined.Add, null, tint = MaterialTheme.colorScheme.primary) },
                onClick = { Nav.push(Route.TagEdit(null)) })
        }
    }
}

@Composable
fun TagEditor(id: String?) {
    val prev = remember(id) { D.tag(id) }
    var name by remember { mutableStateOf(prev?.str("name") ?: "") }
    var color by remember { mutableStateOf(prev?.str("color") ?: D.CHART_COLORS[D.tags().size % D.CHART_COLORS.size]) }
    var confirmDelete by remember { mutableStateOf(false) }
    val uses = prev?.let { D.tagUsage(it.str("id")) } ?: 0
    EditorScaffold(
        title = if (prev == null) "Nueva etiqueta" else "Etiqueta",
        saveEnabled = name.isNotBlank(),
        onSave = { D.saveTag((prev ?: rec()).with("name" to name, "color" to color)); Nav.pop() },
    ) {
        OutlinedTextField(name, { name = it }, label = { Text("Nombre") }, placeholder = { Text("p. ej. Carne, Cumpleaños") }, singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth())
        FieldLabel("Color")
        ColorPicker(color, D.CHART_COLORS) { color = it }
        if (prev != null) TextButton(onClick = { confirmDelete = true }, modifier = Modifier.fillMaxWidth()) { Text("Eliminar etiqueta", color = MaterialTheme.colorScheme.error) }
    }
    if (confirmDelete && prev != null) ConfirmDialog("¿Eliminar «${prev.str("name")}»?",
        if (uses > 0) "Se quitará de $uses ${if (uses == 1) "gasto" else "gastos"}; los gastos no se borran." else "",
        onConfirm = { D.removeTag(prev.str("id")); Nav.pop() }, onDismiss = { confirmDelete = false })
}
