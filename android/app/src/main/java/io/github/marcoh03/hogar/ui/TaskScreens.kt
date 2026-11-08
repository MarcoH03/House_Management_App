@file:OptIn(ExperimentalMaterial3Api::class)

package io.github.marcoh03.hogar.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.DeleteSweep
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.marcoh03.hogar.data.D
import io.github.marcoh03.hogar.data.Rec
import io.github.marcoh03.hogar.data.Store
import io.github.marcoh03.hogar.data.addDays
import io.github.marcoh03.hogar.data.bool
import io.github.marcoh03.hogar.data.fmtDay
import io.github.marcoh03.hogar.data.long
import io.github.marcoh03.hogar.data.rec
import io.github.marcoh03.hogar.data.str
import io.github.marcoh03.hogar.data.strOrNull
import io.github.marcoh03.hogar.data.timeAgo
import io.github.marcoh03.hogar.data.today
import io.github.marcoh03.hogar.data.uid
import io.github.marcoh03.hogar.data.with

object TasksState {
    var tab by mutableIntStateOf(0)
    var who by mutableStateOf("all")
}

fun completeWithFeedback(t: Rec) {
    val r = D.completeTask(t.str("id")) ?: return
    if (r.repeat) {
        val who = r.assignee?.let { " · le toca a ${D.memberName(it)}" } ?: ""
        Toast.show("Hecho. Próxima: ${fmtDay(r.next).lowercase()}$who")
    } else Toast.show("Tarea completada")
}

@Composable
fun TaskRow(t: Rec) {
    val m = D.member(t.strOrNull("assignee"))
    val overdue = t.str("due").isNotEmpty() && t.str("due") < today()
    Item(
        t.str("title"),
        supportingContent = {
            Column {
                if (t.str("notes").isNotEmpty()) Text(t.str("notes").lineSequence().first(), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (m != null) { Avatar(m, 18.dp); Text(m.str("name")) } else Text("Sin asignar")
                    if (t.str("due").isNotEmpty()) Text("· ${fmtDay(t.str("due"))}", color = if (overdue) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
                    if (t.str("repeat", "none") != "none") {
                        Icon(Icons.Outlined.Repeat, null, Modifier.size(14.dp))
                        Text(D.repeatLabel(t.str("repeat")))
                    }
                }
            }
        },
        leading = { Checkbox(checked = false, onCheckedChange = { completeWithFeedback(t) }) },
        onClick = { Nav.push(Route.TaskEdit(t.str("id"))) },
    )
}

@Composable
fun TasksScreen() {
    observeStore()
    if (TasksState.who !in listOf("all", "none") && D.member(TasksState.who) == null) TasksState.who = "all"
    Scaffold(
        contentWindowInsets = NoInsets,
        topBar = { TopAppBar(title = { Text("Tareas") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = {
                Nav.push(Route.TaskEdit(null, assignee = TasksState.who.takeIf { it != "all" && it != "none" }))
            }) { Icon(Icons.Outlined.Add, "Nueva tarea") }
        },
    ) { pad ->
        Column(Modifier.padding(top = pad.calculateTopPadding()).fillMaxSize()) {
            PrimaryTabRow(selectedTabIndex = TasksState.tab) {
                Tab(TasksState.tab == 0, { TasksState.tab = 0 }, text = { Text("Pendientes") })
                Tab(TasksState.tab == 1, { TasksState.tab = 1 }, text = { Text("Hechas") })
            }
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 104.dp)) {
                item { WhoChips() }
                if (TasksState.tab == 0) pendingList() else doneList()
            }
        }
    }
}

@Composable
private fun WhoChips() {
    val ms = D.members()
    if (ms.isEmpty()) return
    val me = D.meId()
    val ordered = me?.let { id -> listOfNotNull(D.member(id)) + ms.filter { it.str("id") != id } } ?: ms
    val chips = listOf("all" to "Todas") + ordered.map { it.str("id") to (it.str("name") + if (it.str("id") == me) " (yo)" else "") } + ("none" to "Sin asignar")
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(chips) { (id, label) ->
            FilterChip(
                selected = TasksState.who == id,
                onClick = { TasksState.who = id },
                label = { Text(label) },
                leadingIcon = D.member(id)?.let { m -> { Avatar(m, 20.dp) } },
            )
        }
    }
}

private fun filterFn(): (Rec) -> Boolean = when (TasksState.who) {
    "all" -> { _ -> true }
    "none" -> { t -> t.strOrNull("assignee") == null }
    else -> { t -> t.str("assignee") == TasksState.who }
}

private fun LazyListScope.pendingList() {
    item { QuickTaskField() }
    val all = D.sortTasks(D.pendingTasks().filter(filterFn()))
    if (all.isEmpty()) {
        item { EmptyState(Icons.Outlined.TaskAlt, "Todo hecho", if (TasksState.who == "all") "No hay tareas pendientes. Añade una con el botón +." else "No hay tareas pendientes con este filtro.") }
        return
    }
    val t0 = today()
    val week = addDays(t0, 7)
    val tomorrow = addDays(t0, 1)
    val buckets = listOf<Triple<String, (Rec) -> Boolean, Boolean>>(
        Triple("Atrasadas", { t -> t.str("due").isNotEmpty() && t.str("due") < t0 }, true),
        Triple("Hoy", { t -> t.str("due") == t0 }, false),
        Triple("Mañana", { t -> t.str("due") == tomorrow }, false),
        Triple("Próximos 7 días", { t -> t.str("due") > tomorrow && t.str("due") <= week }, false),
        Triple("Más adelante", { t -> t.str("due") > week }, false),
        Triple("Sin fecha", { t -> t.str("due").isEmpty() }, false),
    )
    for ((name, fn, red) in buckets) {
        val arr = all.filter(fn)
        if (arr.isEmpty()) continue
        item {
            if (red) {
                androidx.compose.foundation.layout.Box(Modifier.padding(start = 20.dp, top = 20.dp, bottom = 6.dp)) {
                    Text(name, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.error)
                }
            } else SectionTitle(name)
        }
        item { GroupCard { arr.forEach { TaskRow(it) } } }
    }
}

@Composable
private fun QuickTaskField() {
    var text by remember { mutableStateOf("") }
    fun submit() {
        val v = text.trim()
        if (v.isEmpty()) return
        val who = TasksState.who
        val assignee = when (who) { "all" -> D.meId(); "none" -> null; else -> who }
        D.saveTask(rec("id" to uid(), "title" to v, "notes" to "", "assignee" to assignee, "due" to today(), "repeat" to "none", "rotate" to false, "done" to false))
        text = ""
    }
    OutlinedTextField(
        value = text,
        onValueChange = { text = it },
        placeholder = { Text("Nueva tarea para hoy") },
        leadingIcon = { Icon(Icons.Outlined.Add, null) },
        trailingIcon = { if (text.isNotBlank()) TextButton(onClick = { submit() }) { Text("Añadir") } },
        singleLine = true,
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { submit() }),
        shape = MaterialTheme.shapes.extraLarge,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
    )
}

private fun LazyListScope.doneList() {
    val f = filterFn()
    val done = D.tasks().filter { it.bool("done") }.filter(f).sortedByDescending { it.long("doneAt") }
    val recurring = D.tasks().filter { !it.bool("done") && it.long("lastDoneAt") > 0 }.filter(f).sortedByDescending { it.long("lastDoneAt") }.take(10)
    if (done.isEmpty() && recurring.isEmpty()) {
        item { EmptyState(Icons.Outlined.Checklist, "Nada completado aún", "Las tareas que completéis aparecerán aquí.") }
        return
    }
    if (done.isNotEmpty()) {
        item { SectionTitle("Completadas") }
        item {
            GroupCard {
                done.forEach { t ->
                    Item(
                        t.str("title"),
                        supporting = "${D.memberName(t.str("doneBy"))} · ${timeAgo(t.long("doneAt"))}",
                        leading = { Checkbox(checked = true, onCheckedChange = { D.uncompleteTask(t.str("id")) }) },
                        onClick = { Nav.push(Route.TaskEdit(t.str("id"))) },
                    )
                }
            }
        }
    }
    if (recurring.isNotEmpty()) {
        item { SectionTitle("Repetitivas hechas hace poco") }
        item {
            GroupCard {
                recurring.forEach { t ->
                    Item(
                        t.str("title"),
                        supporting = "${D.memberName(t.str("lastDoneBy"))} · ${timeAgo(t.long("lastDoneAt"))}",
                        leading = { IconBadge(Icons.Outlined.Repeat, "gray", 36.dp) },
                        onClick = { Nav.push(Route.TaskEdit(t.str("id"))) },
                    )
                }
            }
        }
    }
    if (done.isNotEmpty()) item {
        var confirm by remember { mutableStateOf(false) }
        TextButton(onClick = { confirm = true }, modifier = Modifier.fillMaxWidth().padding(16.dp)) {
            Icon(Icons.Outlined.DeleteSweep, null)
            Text("  Eliminar completadas", color = MaterialTheme.colorScheme.error)
        }
        if (confirm) ConfirmDialog("¿Eliminar las tareas completadas?", "Las tareas que se repiten no se verán afectadas.",
            onConfirm = { D.clearDoneTasks() }, onDismiss = { confirm = false })
    }
}

/* ---------- Editor de tarea ---------- */

@Composable
fun TaskEditor(id: String?, assigneeDefault: String?) {
    val prev = remember(id) { Store.get("tasks", id) }
    val base = remember(id) {
        prev ?: rec("title" to "", "notes" to "", "assignee" to (assigneeDefault ?: D.meId()), "due" to today(), "repeat" to "none", "rotate" to false, "done" to false)
    }
    var title by remember { mutableStateOf(base.str("title")) }
    var notes by remember { mutableStateOf(base.str("notes")) }
    var assignee by remember { mutableStateOf(base.str("assignee")) }
    var due by remember { mutableStateOf(base.strOrNull("due")) }
    var repeat by remember { mutableStateOf(base.str("repeat", "none")) }
    var rotate by remember { mutableStateOf(base.bool("rotate")) }
    var confirmDelete by remember { mutableStateOf(false) }

    EditorScaffold(
        title = if (prev == null) "Nueva tarea" else "Tarea",
        saveEnabled = title.isNotBlank(),
        onSave = {
            D.saveTask(base.with("title" to title.trim(), "notes" to notes.trim(), "assignee" to assignee.ifEmpty { null }, "due" to due, "repeat" to repeat, "rotate" to rotate))
            Nav.pop()
        },
    ) {
        OutlinedTextField(title, { title = it }, label = { Text("Título") }, placeholder = { Text("p. ej. Sacar la basura") }, singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(notes, { notes = it }, label = { Text("Notas") }, minLines = 2, modifier = Modifier.fillMaxWidth())
        DropdownField("Responsable", assignee, listOf("" to "Sin asignar") + D.members().map { it.str("id") to it.str("name") }, { assignee = it }, leading = Icons.Outlined.Person)
        DateField("Fecha", due, { due = it })
        DropdownField("Repetir", repeat, D.REPEATS, { repeat = it }, leading = Icons.Outlined.Repeat)
        SwitchRow("Turnarse entre todos", rotate, { rotate = it }, supporting = "Al completarla, pasa al siguiente miembro de la casa")
        Hint("Las tareas que se repiten se reprograman solas al completarlas.")
        if (prev != null) {
            TextButton(onClick = { confirmDelete = true }, modifier = Modifier.fillMaxWidth()) {
                Text("Eliminar tarea", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Medium)
            }
        }
    }
    if (confirmDelete && prev != null) ConfirmDialog("¿Eliminar «${prev.str("title")}»?", onConfirm = {
        Store.remove("tasks", prev.str("id")); Nav.pop()
    }, onDismiss = { confirmDelete = false })
}
