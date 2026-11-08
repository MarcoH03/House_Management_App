package io.github.marcoh03.hogar.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.vector.ImageVector
import io.github.marcoh03.hogar.data.Rec
import io.github.marcoh03.hogar.data.str
import kotlinx.coroutines.flow.MutableSharedFlow

enum class Tab(val label: String, val icon: ImageVector) {
    HOME("Inicio", Icons.Outlined.Home),
    SHOP("Compras", Icons.Outlined.ShoppingCart),
    TASKS("Tareas", Icons.Outlined.Checklist),
    MONEY("Finanzas", Icons.Outlined.AccountBalanceWallet),
    SETTINGS("Ajustes", Icons.Outlined.Settings),
}

/** Pantallas que se abren encima de las pestañas. */
sealed interface Route {
    data class ItemEdit(val id: String?, val onList: Boolean = true) : Route
    data class Buy(val itemId: String) : Route
    data class TaskEdit(val id: String?, val assignee: String? = null) : Route
    data class Txn(
        val kind: String, val id: String? = null, val accountId: String? = null, val desc: String? = null,
        val categoryId: String? = null, val purchaseIds: List<String> = emptyList(),
    ) : Route
    data class Transfer(val id: String? = null, val from: String? = null) : Route
    data class Exchange(val id: String? = null, val accountId: String? = null) : Route
    data class Account(val id: String) : Route
    data class AccountEdit(val id: String?) : Route
    data class CategoryDetail(val id: String, val month: String) : Route
    data class Stats(val month: String) : Route
    data object Rates : Route
    data object Categories : Route
    data class CategoryEdit(val id: String?) : Route
    data object Tags : Route
    data class TagEdit(val id: String?) : Route
    data class MemberEdit(val id: String?) : Route
    data object House : Route
    data object Github : Route
    data class Join(val code: String = "") : Route
    data object Share : Route
}

object Nav {
    val stack = mutableStateListOf<Route>()
    var tab by mutableStateOf(Tab.HOME)
    var forward by mutableStateOf(true)
        private set

    fun push(r: Route) { forward = true; stack.add(r) }
    fun pop() { forward = false; if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex) }
    /** Cierra la pantalla actual y abre otra (p. ej. de una cuenta a uno de sus movimientos). */
    fun replace(r: Route) { forward = true; if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex); stack.add(r) }

    fun openTxn(t: Rec) {
        val id = t.str("id")
        push(
            when (t.str("type")) {
                "transfer" -> Route.Transfer(id = id)
                "exchange" -> Route.Exchange(id = id)
                else -> Route.Txn(kind = t.str("type"), id = id)
            },
        )
    }
}

/** Mensajes breves (Snackbar). */
object Toast {
    val messages = MutableSharedFlow<String>(extraBufferCapacity = 8)
    fun show(msg: String) { messages.tryEmit(msg) }
}
