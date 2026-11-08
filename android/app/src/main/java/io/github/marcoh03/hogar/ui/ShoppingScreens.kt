@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package io.github.marcoh03.hogar.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AddShoppingCart
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.RemoveShoppingCart
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.marcoh03.hogar.data.D
import io.github.marcoh03.hogar.data.Rec
import io.github.marcoh03.hogar.data.Store
import io.github.marcoh03.hogar.data.bool
import io.github.marcoh03.hogar.data.fmtDay
import io.github.marcoh03.hogar.data.fmtQty
import io.github.marcoh03.hogar.data.listNames
import io.github.marcoh03.hogar.data.num
import io.github.marcoh03.hogar.data.parseAmount
import io.github.marcoh03.hogar.data.str
import io.github.marcoh03.hogar.data.strOrNull
import io.github.marcoh03.hogar.data.with

object ShoppingState {
    var tab by mutableIntStateOf(0)
    var query by mutableStateOf("")
}

/** Marca como comprado al tocar la casilla (sin importe). */
fun buyNow(i: Rec) {
    D.markBought(i.str("id"))
    Toast.show("${i.str("name")}: comprado y sumado a la despensa")
}

@Composable
fun ShoppingScreen() {
    observeStore()
    val list = D.shoppingList()
    Scaffold(
        contentWindowInsets = NoInsets,
        topBar = { TopAppBar(title = { Text("Compras") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { Nav.push(Route.ItemEdit(null, onList = ShoppingState.tab == 0)) }) { Icon(Icons.Outlined.Add, "Añadir artículo") }
        },
    ) { pad ->
        Column(Modifier.padding(top = pad.calculateTopPadding()).fillMaxSize()) {
            PrimaryTabRow(selectedTabIndex = ShoppingState.tab) {
                Tab(ShoppingState.tab == 0, { ShoppingState.tab = 0 }, text = { Text(if (list.isEmpty()) "Lista" else "Lista (${list.size})") })
                Tab(ShoppingState.tab == 1, { ShoppingState.tab = 1 }, text = { Text("Despensa") })
                Tab(ShoppingState.tab == 2, { ShoppingState.tab = 2 }, text = { Text("Historial") })
            }
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 104.dp, top = 8.dp)) {
                when (ShoppingState.tab) {
                    0 -> listTab(list)
                    1 -> pantryTab()
                    else -> historyTab()
                }
            }
        }
    }
}

private fun LazyListScope.listTab(list: List<Rec>) {
    item { QuickAddField() }
    val unbilled = D.unbilledPurchases()
    if (unbilled.isNotEmpty()) item {
        Banner(
            Icons.AutoMirrored.Outlined.ReceiptLong, "¿Cuánto ha costado la compra?", listNames(unbilled.map { it.str("name") }), "Añadir",
            onAction = {
                val (cat, desc) = D.billSummary(unbilled)
                Nav.push(Route.Txn("expense", desc = desc, categoryId = cat, purchaseIds = unbilled.map { it.str("id") }))
            },
            onDismiss = { D.dismissPurchases(unbilled.map { it.str("id") }) },
        )
    }
    val low = D.lowStock().filter { !it.bool("onList") }
    if (low.isNotEmpty()) item {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
            Text("Se está acabando:", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                low.take(8).forEach { i ->
                    AssistChip(onClick = { D.toggleOnList(i.str("id")); Toast.show("${i.str("name")} añadido a la lista") },
                        label = { Text(i.str("name")) }, leadingIcon = { Icon(Icons.Outlined.Add, null, Modifier.size(18.dp)) })
                }
            }
        }
    }
    if (list.isEmpty()) {
        item { EmptyState(Icons.Outlined.ShoppingCart, "No falta nada", "Escribe arriba lo que haya que comprar. Al marcarlo pasará a la despensa.") }
        return
    }
    val byCat = list.groupBy { it.str("category", "otros") }
    D.SHOP_CATS.filter { byCat.containsKey(it.id) }.forEach { c ->
        item { SectionTitle("${c.emoji}  ${c.name}") }
        item {
            GroupCard {
                byCat[c.id]!!.sortedBy { it.str("name").lowercase() }.forEach { i ->
                    val q = i.num("listQty", 1.0)
                    val parts = mutableListOf<String>()
                    if (q != 1.0 || i.str("unit", "ud") != "ud") parts += "${fmtQty(q)} ${i.str("unit", "ud")}"
                    if (i.str("note").isNotEmpty()) parts += i.str("note")
                    if (i.num("min") > 0 || i.num("stock") > 0) parts += "Quedan ${fmtQty(i.num("stock"))}"
                    Item(
                        i.str("name"),
                        supporting = parts.joinToString(" · ").ifEmpty { null },
                        leading = { Checkbox(checked = false, onCheckedChange = { buyNow(i) }) },
                        onClick = { Nav.push(Route.ItemEdit(i.str("id"))) },
                    )
                }
            }
        }
    }
    item { Column(Modifier.padding(horizontal = 24.dp, vertical = 8.dp)) { Hint("Marca la casilla cuando lo compres: se sumará a la despensa.") } }
}

@Composable
private fun QuickAddField() {
    var text by remember { mutableStateOf("") }
    fun submit() {
        val r = D.addToList(text) ?: return
        if (r.second == D.AddStatus.ALREADY) Toast.show("${r.first.str("name")} ya está en la lista")
        text = ""
    }
    OutlinedTextField(
        value = text,
        onValueChange = { text = it },
        placeholder = { Text("Añadir a la lista") },
        leadingIcon = { Icon(Icons.Outlined.Add, null) },
        trailingIcon = { if (text.isNotBlank()) TextButton(onClick = { submit() }) { Text("Añadir") } },
        singleLine = true,
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { submit() }),
        shape = MaterialTheme.shapes.extraLarge,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
    )
}

private fun LazyListScope.pantryTab() {
    item {
        OutlinedTextField(
            value = ShoppingState.query,
            onValueChange = { ShoppingState.query = it },
            placeholder = { Text("Buscar en la despensa") },
            leadingIcon = { Icon(Icons.Outlined.Search, null) },
            singleLine = true,
            shape = MaterialTheme.shapes.extraLarge,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        )
    }
    val low = D.lowStock().filter { !it.bool("onList") }
    if (low.isNotEmpty()) item {
        Banner(Icons.Outlined.Warning, if (low.size == 1) "Un artículo se está acabando" else "${low.size} artículos se están acabando",
            listNames(low.map { it.str("name") }), "A la lista", {
                Store.batch { low.forEach { D.toggleOnList(it.str("id")) } }
                Toast.show(if (low.size == 1) "Añadido a la lista" else "${low.size} artículos añadidos a la lista")
            })
    }
    val q = ShoppingState.query.trim().lowercase()
    val all = D.items().filter { q.isEmpty() || it.str("name").lowercase().contains(q) }
    if (all.isEmpty()) {
        item {
            if (q.isNotEmpty()) EmptyState(Icons.Outlined.Search, "Sin resultados", "No hay nada que coincida con «${ShoppingState.query}».")
            else EmptyState(Icons.Outlined.Inventory2, "La despensa está vacía", "Lo que compres aparecerá aquí para que sepáis cuánto queda de cada cosa.")
        }
        return
    }
    val byCat = all.groupBy { it.str("category", "otros") }
    D.SHOP_CATS.filter { byCat.containsKey(it.id) }.forEach { c ->
        item { SectionTitle("${c.emoji}  ${c.name}") }
        item {
            GroupCard {
                byCat[c.id]!!.sortedBy { it.str("name").lowercase() }.forEach { i -> PantryRow(i) }
            }
        }
    }
}

@Composable
private fun PantryRow(i: Rec) {
    val st = i.num("stock")
    val status = when {
        st <= 0 && (i.num("min") > 0 || i.bool("onList")) -> "Agotado" to MaterialTheme.colorScheme.error
        D.isLow(i) -> "Queda poco" to keyColor("orange")
        i.num("min") > 0 -> "Mínimo ${fmtQty(i.num("min"))}" to MaterialTheme.colorScheme.onSurfaceVariant
        else -> null
    }
    Item(
        i.str("name"),
        supportingContent = status?.let { (t, c) -> { Text(t, color = c, fontWeight = FontWeight.Medium) } },
        onClick = { Nav.push(Route.ItemEdit(i.str("id"), onList = false)) },
        trailing = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = {
                    val on = D.toggleOnList(i.str("id"))
                    Toast.show(if (on) "${i.str("name")} añadido a la lista" else "${i.str("name")} quitado de la lista")
                }) {
                    Icon(
                        if (i.bool("onList")) Icons.Outlined.RemoveShoppingCart else Icons.Outlined.AddShoppingCart,
                        if (i.bool("onList")) "Quitar de la lista" else "Añadir a la lista",
                        tint = if (i.bool("onList")) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                FilledTonalIconButton(onClick = {
                    if (D.adjustStock(i.str("id"), -1.0)) Toast.show("Queda poco ${i.str("name")}: añadido a la lista")
                }, modifier = Modifier.size(36.dp)) { Icon(Icons.Outlined.Remove, "Gastar uno", Modifier.size(18.dp)) }
                Text("${fmtQty(st)} ${i.str("unit", "ud")}", Modifier.padding(horizontal = 6.dp), style = MaterialTheme.typography.titleSmall, textAlign = TextAlign.Center)
                FilledTonalIconButton(onClick = { D.adjustStock(i.str("id"), 1.0) }, modifier = Modifier.size(36.dp)) {
                    Icon(Icons.Outlined.Add, "Añadir uno", Modifier.size(18.dp))
                }
            }
        },
    )
}

private fun LazyListScope.historyTab() {
    val ps = D.purchases()
    if (ps.isEmpty()) {
        item { EmptyState(Icons.Outlined.History, "Sin compras todavía", "Aquí verás lo que se ha ido comprando y quién lo compró.") }
        return
    }
    ps.groupBy { it.str("date") }.forEach { (date, arr) ->
        item { SectionTitle(fmtDay(date)) }
        item {
            GroupCard {
                arr.forEach { p ->
                    val m = D.member(p.str("by"))
                    val billed = p.strOrNull("expenseId")?.let { Store.get("txns", it) ?: Store.get("txns", "mig-$it") } != null
                    Item(
                        p.str("name"),
                        supporting = "${fmtQty(p.num("qty"))} ${p.str("unit", "ud")} · ${m?.str("name") ?: "Alguien"}",
                        leading = { Avatar(m, 36.dp) },
                        trailing = if (billed) ({ Icon(Icons.AutoMirrored.Outlined.ReceiptLong, "Con gasto anotado", tint = MaterialTheme.colorScheme.onSurfaceVariant) }) else null,
                        onClick = Store.get("items", p.str("itemId"))?.let { { Nav.push(Route.ItemEdit(p.str("itemId"), onList = false)) } },
                    )
                }
            }
        }
    }
}

/* ---------- Editor de artículo ---------- */

@Composable
fun ItemEditor(id: String?, onListDefault: Boolean) {
    val prev = remember(id) { Store.get("items", id) }
    val base = remember(id) { prev ?: D.newItem(onList = onListDefault) }
    var name by remember { mutableStateOf(base.str("name")) }
    var category by remember { mutableStateOf(base.str("category", "otros")) }
    var catTouched by remember { mutableStateOf(prev != null) }
    var onList by remember { mutableStateOf(base.bool("onList")) }
    var listQty by remember { mutableStateOf(base.num("listQty", 1.0)) }
    var note by remember { mutableStateOf(base.str("note")) }
    var stock by remember { mutableStateOf(base.num("stock")) }
    var unit by remember { mutableStateOf(base.str("unit", "ud")) }
    var min by remember { mutableStateOf(base.num("min")) }
    var autoAdd by remember { mutableStateOf(!base.has("autoAdd") || base.bool("autoAdd")) }
    var confirmDelete by remember { mutableStateOf(false) }

    fun build(): Rec = base.with(
        "name" to name.trim(), "category" to category, "onList" to onList, "listQty" to maxOf(listQty, 1.0),
        "note" to note.trim(), "stock" to maxOf(0.0, stock), "unit" to unit, "min" to maxOf(0.0, min), "autoAdd" to autoAdd,
    )

    EditorScaffold(
        title = if (prev == null) "Nuevo artículo" else "Artículo",
        saveEnabled = name.isNotBlank(),
        onSave = {
            val dup = if (prev == null) D.findItem(name) else null
            if (dup != null) {
                D.saveItem(dup.with("onList" to (dup.bool("onList") || onList)))
                Toast.show("${dup.str("name")} ya existía; se ha actualizado")
            } else D.saveItem(build())
            Nav.pop()
        },
    ) {
        OutlinedTextField(
            name, { name = it; if (!catTouched) category = D.guessCategory(it) },
            label = { Text("Nombre") }, placeholder = { Text("p. ej. Leche") }, singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            modifier = Modifier.fillMaxWidth(),
        )
        DropdownField("Categoría", category, D.SHOP_CATS.map { it.id to "${it.emoji}  ${it.name}" }, { category = it; catTouched = true })

        FieldLabel("Lista de la compra")
        SwitchRow("Pendiente de comprar", onList, { onList = it })
        StepperRow("Cantidad a comprar", listQty, { listQty = it }, min = 1.0)
        OutlinedTextField(note, { note = it }, label = { Text("Nota") }, placeholder = { Text("Marca, tamaño…") }, singleLine = true, modifier = Modifier.fillMaxWidth())

        FieldLabel("Despensa")
        StepperRow("Quedan", stock, { stock = it }, unit = unit)
        DropdownField("Unidad", unit, D.UNITS, { unit = it })
        StepperRow("Mínimo", min, { min = it })
        SwitchRow("Añadir a la lista al llegar al mínimo", autoAdd, { autoAdd = it })
        Hint("Cuando lo que queda llegue al mínimo, se añadirá solo a la lista de la compra.")

        if (prev != null) {
            OutlinedButton(onClick = { D.saveItem(build()); Nav.replace(Route.Buy(prev.str("id"))) }, modifier = Modifier.fillMaxWidth()) {
                Text("Marcar como comprado…")
            }
            TextButton(onClick = { confirmDelete = true }, modifier = Modifier.fillMaxWidth()) {
                Text("Eliminar artículo", color = MaterialTheme.colorScheme.error)
            }
        }
    }
    if (confirmDelete && prev != null) ConfirmDialog("¿Eliminar «${prev.str("name")}»?", "Se quitará de la lista y de la despensa.", onConfirm = {
        Store.remove("items", prev.str("id")); Nav.pop()
    }, onDismiss = { confirmDelete = false })
}

/* ---------- Comprado (con importe opcional) ---------- */

@Composable
fun BuyEditor(itemId: String) {
    val item = remember(itemId) { Store.get("items", itemId) }
    if (item == null) { LaunchedEffect(Unit) { Nav.pop() }; return }
    var qty by remember { mutableStateOf(maxOf(item.num("listQty", 1.0), 1.0)) }
    val pay = rememberPayment(kind = "expense", categoryId = D.defaultBudgetFor(item.str("category")), desc = item.str("name"))
    EditorScaffold(
        title = item.str("name"),
        saveLabel = "Comprado",
        onSave = {
            val p = pay.read(optional = true) ?: return@EditorScaffold
            D.markBought(itemId, qty = qty, amount = p.amount, currency = p.currency, rate = p.rate, accountId = pay.accountId,
                categoryId = pay.categoryId, by = pay.by, tagIds = pay.tagIds)
            Toast.show("${item.str("name")}: comprado")
            Nav.pop()
        },
    ) {
        StepperRow("Cantidad comprada", qty, { v -> qty = v }, min = 1.0, unit = item.str("unit", "ud"))
        PaymentFields(pay, amountLabel = "Importe (opcional)", showDesc = false)
        Hint("Lo comprado se suma a la despensa. Si indicas un importe, se descuenta de la cuenta elegida y se anota como gasto en Finanzas.")
    }
}
