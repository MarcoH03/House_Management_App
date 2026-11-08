@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package io.github.marcoh03.hogar.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.marcoh03.hogar.data.D
import io.github.marcoh03.hogar.data.Rec
import io.github.marcoh03.hogar.data.Store
import io.github.marcoh03.hogar.data.fmtCur
import io.github.marcoh03.hogar.data.fmtDay
import io.github.marcoh03.hogar.data.fmtQty
import io.github.marcoh03.hogar.data.monthShort
import io.github.marcoh03.hogar.data.rec
import io.github.marcoh03.hogar.data.str
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlin.math.max

/** Se vuelve a pintar cuando cambian los datos. */
@Composable
fun observeStore(): Int {
    val v by Store.version.collectAsState()
    return v
}

val NoInsets = WindowInsets(0, 0, 0, 0)

/* ---------- Estructura de pantallas ---------- */

/** Pantalla de pestaña: barra superior grande que se contrae al desplazar. */
@Composable
fun TabScaffold(
    title: String,
    actions: @Composable RowScope.() -> Unit = {},
    fab: @Composable () -> Unit = {},
    content: LazyListScope.() -> Unit,
) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Scaffold(
        modifier = Modifier.nestedScroll(scroll.nestedScrollConnection),
        contentWindowInsets = NoInsets,
        topBar = { LargeTopAppBar(title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) }, actions = actions, scrollBehavior = scroll) },
        floatingActionButton = fab,
    ) { pad ->
        LazyColumn(
            contentPadding = PaddingValues(top = pad.calculateTopPadding(), bottom = 104.dp),
            modifier = Modifier.fillMaxSize(),
            content = content,
        )
    }
}

/** Pantalla completa para crear/editar (Close + «Guardar») o ver un detalle (flecha atrás). */
@Composable
fun EditorScaffold(
    title: String,
    onSave: (() -> Unit)? = null,
    saveLabel: String = "Guardar",
    saveEnabled: Boolean = true,
    back: Boolean = false,
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable ColumnScope.() -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    IconButton(onClick = { Nav.pop() }) {
                        Icon(if (back) Icons.AutoMirrored.Filled.ArrowBack else Icons.Outlined.Close, contentDescription = if (back) "Atrás" else "Cerrar")
                    }
                },
                actions = {
                    actions()
                    if (onSave != null) TextButton(onClick = onSave, enabled = saveEnabled) { Text(saveLabel, fontWeight = FontWeight.SemiBold) }
                },
            )
        },
    ) { pad ->
        Column(
            Modifier
                .padding(pad)
                .fillMaxSize()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

@Composable
fun SectionTitle(text: String, trailing: (@Composable () -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 20.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary, modifier = Modifier.weight(1f))
        trailing?.invoke()
    }
}

@Composable
fun GroupCard(modifier: Modifier = Modifier, padded: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = modifier.fillMaxWidth().padding(horizontal = if (padded) 16.dp else 0.dp),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) { Column(Modifier.padding(vertical = 4.dp), content = content) }
}

@Composable
fun Item(
    headline: String,
    modifier: Modifier = Modifier,
    supporting: String? = null,
    supportingContent: (@Composable () -> Unit)? = null,
    overline: String? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    headlineColor: Color = Color.Unspecified,
    onClick: (() -> Unit)? = null,
) {
    ListItem(
        headlineContent = { Text(headline, color = headlineColor, maxLines = 2, overflow = TextOverflow.Ellipsis) },
        supportingContent = supportingContent ?: supporting?.let { s -> { Text(s, maxLines = 2, overflow = TextOverflow.Ellipsis) } },
        overlineContent = overline?.let { o -> { Text(o) } },
        leadingContent = leading,
        trailingContent = trailing,
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        modifier = if (onClick != null) modifier.clickable(onClick = onClick) else modifier,
    )
}

@Composable
fun EmptyState(icon: ImageVector, title: String, text: String = "", action: (@Composable () -> Unit)? = null) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            Modifier.size(72.dp).clip(CircleShape).background(MaterialTheme.colorScheme.secondaryContainer),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, null, Modifier.size(34.dp), tint = MaterialTheme.colorScheme.onSecondaryContainer) }
        Text(title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        if (text.isNotEmpty()) Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        action?.invoke()
    }
}

/** Aviso destacado con acción (versión nueva, compras sin importe…). */
@Composable
fun Banner(icon: ImageVector, title: String, text: String, actionLabel: String, onAction: () -> Unit, onDismiss: (() -> Unit)? = null) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
    ) {
        Row(Modifier.padding(start = 16.dp, top = 12.dp, bottom = 12.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.onSecondaryContainer)
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(title, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSecondaryContainer)
                Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSecondaryContainer, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            TextButton(onClick = onAction) { Text(actionLabel) }
            if (onDismiss != null) IconButton(onClick = onDismiss) { Icon(Icons.Outlined.Close, "Descartar", tint = MaterialTheme.colorScheme.onSecondaryContainer) }
        }
    }
}

/* ---------- Iconos, avatares y emoji ---------- */

@Composable
fun EmojiBadge(emoji: String, colorKey: String?, size: Dp = 40.dp) {
    Box(Modifier.size(size).clip(CircleShape).background(keyContainer(colorKey)), contentAlignment = Alignment.Center) {
        Text(emoji, fontSize = (size.value * 0.48f).sp)
    }
}

@Composable
fun IconBadge(icon: ImageVector, colorKey: String?, size: Dp = 40.dp) {
    Box(Modifier.size(size).clip(CircleShape).background(keyContainer(colorKey)), contentAlignment = Alignment.Center) {
        Icon(icon, null, tint = keyColor(colorKey), modifier = Modifier.size(size * 0.55f))
    }
}

@Composable
fun Avatar(member: Rec?, size: Dp = 40.dp) {
    val name = member?.str("name") ?: "?"
    val initials = name.trim().split(Regex("\\s+")).take(2).mapNotNull { it.firstOrNull()?.uppercase() }.joinToString("").ifEmpty { "?" }
    Box(Modifier.size(size).clip(CircleShape).background(keyColor(member?.str("color") ?: "gray")), contentAlignment = Alignment.Center) {
        Text(initials, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = (size.value * 0.38f).sp)
    }
}

@Composable
fun Swatch(colorKey: String?, size: Dp = 12.dp) {
    Box(Modifier.size(size).clip(CircleShape).background(keyColor(colorKey)))
}

/* ---------- Gráficos ---------- */

/** Barra segmentada fina: el reparto de un total (las cifras van en la lista). */
@Composable
fun SplitBar(parts: List<Pair<Double, Color>>, modifier: Modifier = Modifier) {
    val visible = parts.filter { it.first > 0 }
    if (visible.isEmpty()) return
    Row(modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp)), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        visible.forEach { (v, c) -> Box(Modifier.weight(v.toFloat()).fillMaxHeight().background(c)) }
    }
}

/** Columnas por mes. El mes elegido en color; el resto en gris. Tocar una columna la elige. */
@Composable
fun ColumnChart(points: List<D.Point>, color: Color, selected: String, onSelect: (String) -> Unit) {
    val max = points.maxOfOrNull { it.cup } ?: 0.0
    if (max <= 0) {
        Text("Aún no hay gastos en estos meses.", Modifier.fillMaxWidth().padding(24.dp), textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    Row(Modifier.fillMaxWidth().height(180.dp).padding(horizontal = 12.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        points.forEach { p ->
            val on = p.month == selected
            Column(
                Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(10.dp)).clickable { onSelect(p.month) },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    if (on || p.cup == max) fmtCur(p.cup).removeSuffix(" CUP") else "",
                    style = MaterialTheme.typography.labelSmall, maxLines = 1, fontWeight = FontWeight.SemiBold,
                )
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
                    if (p.cup > 0) Box(
                        Modifier.fillMaxWidth(0.72f).fillMaxHeight((p.cup / max).toFloat().coerceAtLeast(0.03f))
                            .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                            .background(if (on) color else MaterialTheme.colorScheme.surfaceVariant),
                    )
                }
                HorizontalDivider()
                Text(monthShort(p.month), style = MaterialTheme.typography.labelMedium, fontWeight = if (on) FontWeight.Bold else FontWeight.Normal, modifier = Modifier.padding(top = 4.dp))
            }
        }
    }
}

/** Variación respecto al mes anterior: flecha + palabras (nunca solo color). */
@Composable
fun DeltaText(delta: Double?, prevMonthName: String) {
    if (delta == null || delta.isNaN()) return
    val r = Math.round(delta)
    val (txt, col) = when {
        r == 0L -> "Igual que en $prevMonthName" to MaterialTheme.colorScheme.onSurfaceVariant
        r > 0 -> "▲ $r % más que en $prevMonthName" to MaterialTheme.colorScheme.error
        else -> "▼ ${-r} % menos que en $prevMonthName" to Positive
    }
    Text(txt, color = col, style = MaterialTheme.typography.bodySmall)
}

/* ---------- Campos de formulario ---------- */

@Composable
fun DropdownField(
    label: String,
    value: String,
    options: List<Pair<String, String>>,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    leading: ImageVector? = null,
) {
    var open by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = open, onExpandedChange = { open = it }, modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = options.firstOrNull { it.first == value }?.second ?: "",
            onValueChange = {},
            readOnly = true,
            singleLine = true,
            label = { Text(label) },
            leadingIcon = leading?.let { ic -> { Icon(ic, null) } },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = open) },
            modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
        )
        ExposedDropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { (k, l) -> DropdownMenuItem(text = { Text(l) }, onClick = { onChange(k); open = false }) }
        }
    }
}

@Composable
fun DateField(label: String, value: String?, onChange: (String?) -> Unit, clearable: Boolean = true) {
    var open by remember { mutableStateOf(false) }
    val src = remember { MutableInteractionSource() }
    LaunchedEffect(src) { src.interactions.collect { if (it is PressInteraction.Release) open = true } }
    OutlinedTextField(
        value = value?.let { v -> "${fmtDay(v)} · ${LocalDate.parse(v).let { "%02d/%02d/%d".format(it.dayOfMonth, it.monthValue, it.year) }}" } ?: "",
        onValueChange = {},
        readOnly = true,
        singleLine = true,
        label = { Text(label) },
        placeholder = { Text("Sin fecha") },
        leadingIcon = { Icon(Icons.Outlined.CalendarToday, null) },
        trailingIcon = if (clearable && value != null) ({ IconButton(onClick = { onChange(null) }) { Icon(Icons.Outlined.Close, "Quitar fecha") } }) else null,
        interactionSource = src,
        modifier = Modifier.fillMaxWidth(),
    )
    if (open) {
        val st = rememberDatePickerState(
            initialSelectedDateMillis = (value?.let { LocalDate.parse(it) } ?: LocalDate.now()).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    st.selectedDateMillis?.let { onChange(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString()) }
                    open = false
                }) { Text("Aceptar") }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text("Cancelar") } },
        ) { DatePicker(state = st) }
    }
}

@Composable
fun StepperRow(label: String, value: Double, onChange: (Double) -> Unit, min: Double = 0.0, unit: String = "") {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
        FilledTonalIconButton(onClick = { onChange(max(min, value - 1)) }) { Icon(Icons.Outlined.Remove, "Menos") }
        Text(
            fmtQty(value) + if (unit.isNotEmpty()) " $unit" else "",
            Modifier.widthIn(min = 64.dp), textAlign = TextAlign.Center, style = MaterialTheme.typography.titleMedium,
        )
        FilledTonalIconButton(onClick = { onChange(value + 1) }) { Icon(Icons.Outlined.Add, "Más") }
    }
}

@Composable
fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit, supporting: String? = null) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { onChange(!checked) }.padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodyLarge)
            if (supporting != null) Text(supporting, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
fun FieldLabel(text: String) {
    Text(text, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp))
}

@Composable
fun Hint(text: String, color: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = color)
}

@Composable
fun ColorPicker(value: String, options: List<String>, onChange: (String) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        options.forEach { c ->
            val on = c == value
            Box(
                Modifier.size(44.dp).clip(CircleShape).background(keyColor(c))
                    .then(if (on) Modifier.border(3.dp, MaterialTheme.colorScheme.onSurface, CircleShape) else Modifier)
                    .clickable { onChange(c) },
                contentAlignment = Alignment.Center,
            ) { if (on) Icon(Icons.Filled.Check, null, tint = Color.White) }
        }
    }
}

@Composable
fun EmojiPicker(value: String, options: List<String>, onChange: (String) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { e ->
            val on = e == value
            Box(
                Modifier.size(48.dp).clip(RoundedCornerShape(14.dp))
                    .background(if (on) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerHigh)
                    .clickable { onChange(e) },
                contentAlignment = Alignment.Center,
            ) { Text(e, fontSize = 24.sp) }
        }
    }
}

/** Importe grande con la moneda debajo (como las apps de pagos de Android). */
@Composable
fun AmountInput(
    label: String,
    text: String,
    onText: (String) -> Unit,
    currency: String,
    onCurrency: (String) -> Unit,
    currencies: List<String> = D.allCurrencies(),
    autoFocus: Boolean = false,
) {
    val fr = remember { FocusRequester() }
    var open by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        BasicTextField(
            value = text,
            onValueChange = { v -> onText(v.filter { it.isDigit() || it == ',' || it == '.' }) },
            singleLine = true,
            textStyle = MaterialTheme.typography.displayMedium.copy(textAlign = TextAlign.Center, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            modifier = Modifier.fillMaxWidth().focusRequester(fr),
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxWidth()) {
                    if (text.isEmpty()) Text("0", style = MaterialTheme.typography.displayMedium, color = MaterialTheme.colorScheme.outlineVariant, fontWeight = FontWeight.SemiBold)
                    inner()
                }
            },
        )
        Box {
            AssistChip(
                onClick = { open = true },
                label = { Text("${D.curInfo(currency).flag}  $currency", fontWeight = FontWeight.SemiBold) },
                trailingIcon = { Icon(Icons.Filled.ArrowDropDown, null) },
            )
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                currencies.forEach { c ->
                    DropdownMenuItem(
                        text = { Text("${D.curInfo(c).flag}  $c · ${D.curInfo(c).name}") },
                        onClick = { onCurrency(c); open = false },
                    )
                }
            }
        }
    }
    LaunchedEffect(Unit) { if (autoFocus) runCatching { fr.requestFocus() } }
}

/** Selector de etiquetas (varias por gasto) con creación en el momento. */
@Composable
fun TagPicker(selected: List<String>, catId: String?, onChange: (List<String>) -> Unit) {
    observeStore()
    var newOpen by remember { mutableStateOf(false) }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        D.tagsForCategory(catId).forEach { t ->
            val id = t.str("id")
            val on = id in selected
            FilterChip(
                selected = on,
                onClick = { onChange(if (on) selected - id else selected + id) },
                label = { Text(t.str("name")) },
                leadingIcon = { if (on) Icon(Icons.Filled.Check, null, Modifier.size(18.dp)) else Swatch(t.str("color"), 10.dp) },
            )
        }
        AssistChip(onClick = { newOpen = true }, label = { Text("Nueva") }, leadingIcon = { Icon(Icons.Outlined.Add, null, Modifier.size(18.dp)) })
    }
    if (newOpen) {
        TextInputDialog(title = "Nueva etiqueta", label = "Nombre (p. ej. Carne, Aseo…)", onDismiss = { newOpen = false }) { name ->
            D.saveTag(rec("name" to name))?.let { onChange(selected + it.str("id")) }
            newOpen = false
        }
    }
}

/* ---------- Diálogos y hojas ---------- */

@Composable
fun ConfirmDialog(title: String, text: String = "", confirm: String = "Eliminar", destructive: Boolean = true, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = if (text.isNotEmpty()) ({ Text(text) }) else null,
        confirmButton = {
            TextButton(onClick = { onConfirm(); onDismiss() }) {
                Text(confirm, color = if (destructive) MaterialTheme.colorScheme.error else Color.Unspecified)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}

@Composable
fun TextInputDialog(title: String, label: String, initial: String = "", onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var v by remember { mutableStateOf(initial) }
    val fr = remember { FocusRequester() }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { OutlinedTextField(v, { v = it }, label = { Text(label) }, singleLine = true, modifier = Modifier.fillMaxWidth().focusRequester(fr)) },
        confirmButton = { TextButton(onClick = { if (v.isNotBlank()) onConfirm(v.trim()) }, enabled = v.isNotBlank()) { Text("Aceptar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
    LaunchedEffect(Unit) { runCatching { fr.requestFocus() } }
}

data class Choice(val label: String, val icon: ImageVector? = null, val supporting: String? = null, val action: () -> Unit)

/** Menú que sube desde abajo (bottom sheet) con opciones. */
@Composable
fun ChoiceSheet(title: String? = null, choices: List<Choice>, onDismiss: () -> Unit) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = state) {
        if (title != null) Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp))
        choices.forEach { c ->
            Item(
                headline = c.label,
                supporting = c.supporting,
                leading = c.icon?.let { ic -> { Icon(ic, null) } },
                onClick = { onDismiss(); c.action() },
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
fun SmallLabel(text: String, colorKey: String) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.Bold,
        color = keyColor(colorKey),
        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(keyContainer(colorKey)).padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

@Composable
fun Gap(h: Dp = 8.dp) = Spacer(Modifier.height(h))

@Composable
fun HGap(w: Dp = 8.dp) = Spacer(Modifier.width(w))
