package io.github.marcoh03.hogar

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import io.github.marcoh03.hogar.data.D
import io.github.marcoh03.hogar.data.Store
import io.github.marcoh03.hogar.data.Sync
import io.github.marcoh03.hogar.data.rec
import io.github.marcoh03.hogar.data.str
import io.github.marcoh03.hogar.data.thisMonth
import io.github.marcoh03.hogar.data.today
import io.github.marcoh03.hogar.data.addDays
import io.github.marcoh03.hogar.data.uid
import io.github.marcoh03.hogar.ui.HogarApp
import io.github.marcoh03.hogar.ui.HogarTheme
import io.github.marcoh03.hogar.ui.Nav
import io.github.marcoh03.hogar.ui.Route
import io.github.marcoh03.hogar.ui.Tab
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.time.LocalDate

/**
 * Recorre la app con datos de ejemplo, comprueba los cálculos principales y guarda
 * capturas en app/build/screenshots (sirve para revisar el diseño sin un móvil).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xxhdpi")
class ScreensTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()

    private val dir = File("build/screenshots").apply { mkdirs() }

    private fun shot(name: String) {
        rule.waitForIdle()
        rule.mainClock.advanceTimeBy(1000)
        rule.waitForIdle()
        val bmp = rule.onRoot().captureToImage().asAndroidBitmap()
        File(dir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun ui(block: () -> Unit) { rule.runOnUiThread(block); rule.waitForIdle() }

    private fun scroll() {
        rule.onAllNodes(hasScrollAction()).onFirst().performTouchInput { swipeUp(durationMillis = 300) }
        rule.waitForIdle()
    }

    private fun seed() {
        val ctx = rule.activity.applicationContext
        Store.init(ctx)
        Store.reset()
        Sync.init(ctx)
        D.createHousehold("Casa", "Mamá", listOf("Marco"))
        val marco = D.members().first { it.str("name") == "Marco" }.str("id")
        val reserva = D.saveAccount(rec("name" to "Reserva", "emoji" to "🐷", "color" to "pink", "currencies" to listOf("CUP", "USD"))).str("id")
        D.setRates(mapOf("USD" to 667.0, "EUR" to 765.0, "MLC" to 422.0), source = "eltoque-telegram")
        val t = today()
        val lastMonth = LocalDate.now().minusMonths(1).withDayOfMonth(12).toString()
        val carne = D.saveTag(rec("name" to "Carne"))!!.str("id")
        val granos = D.saveTag(rec("name" to "Granos"))!!.str("id")
        val cumple = D.saveTag(rec("name" to "Cumpleaños"))!!.str("id")
        fun tx(vararg p: Pair<String, Any?>) = D.saveTxn(rec(*p))
        tx("type" to "income", "amount" to 30000, "currency" to "CUP", "accountId" to "acc-casa", "desc" to "Salario", "date" to t)
        tx("type" to "income", "amount" to 50, "currency" to "USD", "accountId" to "acc-casa", "desc" to "Remesa", "date" to t)
        tx("type" to "income", "amount" to 40000, "currency" to "CUP", "accountId" to reserva, "desc" to "Para diciembre", "date" to t)
        tx("type" to "transfer", "amount" to 10000, "currency" to "CUP", "accountId" to reserva, "toAccountId" to "acc-casa", "date" to t)
        tx("type" to "exchange", "amount" to 20, "currency" to "USD", "toAmount" to 13340, "toCurrency" to "CUP", "accountId" to "acc-casa", "date" to t)
        tx("type" to "expense", "amount" to 5200, "currency" to "CUP", "accountId" to "acc-casa", "categoryId" to "b-super", "desc" to "Carne de res", "tagIds" to listOf(carne), "date" to t)
        tx("type" to "expense", "amount" to 2100, "currency" to "CUP", "accountId" to "acc-casa", "categoryId" to "b-super", "desc" to "Arroz y frijoles", "tagIds" to listOf(granos), "date" to t)
        tx("type" to "expense", "amount" to 3000, "currency" to "CUP", "accountId" to "acc-casa", "categoryId" to "b-super", "desc" to "Refrescos y cake", "tagIds" to listOf(cumple, granos), "date" to t)
        tx("type" to "expense", "amount" to 4100, "currency" to "CUP", "accountId" to "acc-casa", "categoryId" to "b-servicios", "desc" to "Factura de la luz", "date" to t, "by" to marco)
        tx("type" to "expense", "amount" to 5, "currency" to "USD", "accountId" to "acc-casa", "categoryId" to "b-otros", "desc" to "Recarga del móvil", "date" to t)
        tx("type" to "expense", "amount" to 4200, "currency" to "CUP", "accountId" to "acc-casa", "categoryId" to "b-super", "desc" to "Pollo", "tagIds" to listOf(carne), "date" to lastMonth)
        tx("type" to "expense", "amount" to 3500, "currency" to "CUP", "accountId" to "acc-casa", "categoryId" to "b-servicios", "desc" to "Factura de la luz", "date" to lastMonth)
        tx("type" to "expense", "amount" to 8000, "currency" to "CUP", "accountId" to reserva, "categoryId" to "b-mant", "desc" to "Arreglo del techo", "date" to t)
        D.addToList("Leche"); D.addToList("Pan de molde"); D.addToList("Papel higiénico")
        D.saveItem(D.newItem("Detergente").apply { put("stock", 1); put("min", 2) })
        D.saveItem(D.newItem("Arroz").apply { put("stock", 3); put("unit", "kg") })
        D.saveTask(rec("id" to uid(), "title" to "Sacar la basura", "assignee" to marco, "due" to t, "repeat" to "daily", "rotate" to true))
        D.saveTask(rec("id" to uid(), "title" to "Limpiar el baño", "assignee" to D.meId(), "due" to addDays(t, -1), "repeat" to "weekly"))
        D.saveTask(rec("id" to uid(), "title" to "Regar las plantas", "due" to addDays(t, 3)))
    }

    @Test
    fun recorrido() {
        ui { seed() }

        // Cálculos (cuenta principal «Casa»): 30.000 + 50·667 + 10.000 (de Reserva) entran;
        // gastos 5.200 + 2.100 + 3.000 + 4.100 + 5·667 = 17.735. El techo (Reserva) no cuenta.
        val s = D.monthSummary(thisMonth())
        assertEquals(30000.0 + 50 * 667 + 10000, s.income.cup, 0.01)
        assertEquals(5200.0 + 2100 + 3000 + 4100 + 5 * 667, s.spent.cup, 0.01)
        val casa = D.ledger()["acc-casa"]!!
        assertEquals(30000.0 + 10000 + 13340 - 5200 - 2100 - 3000 - 4100, casa["CUP"]!!, 0.01)
        assertEquals(50.0 - 20 - 5, casa["USD"]!!, 0.01)
        val tb = D.tagBreakdown(thisMonth(), "b-super")
        assertEquals(true, tb.overlap)

        rule.setContent { HogarTheme { HogarApp() } }
        shot("01-inicio")
        scroll(); shot("02-inicio-abajo")

        ui { Nav.tab = Tab.SHOP }; shot("03-compras-lista")
        ui { io.github.marcoh03.hogar.ui.ShoppingState.tab = 1 }; shot("04-compras-despensa")
        ui { io.github.marcoh03.hogar.ui.ShoppingState.tab = 2 }; shot("05-compras-historial")

        ui { Nav.tab = Tab.TASKS }; shot("06-tareas")
        rule.onAllNodesWithText("Limpiar el baño").onFirst().performClick(); shot("07-tarea-editor")
        ui { Nav.pop() }

        ui { Nav.tab = Tab.MONEY }; shot("08-finanzas")
        scroll(); shot("09-finanzas-2")
        scroll(); shot("10-finanzas-3")

        ui { Nav.push(Route.Account("acc-casa")) }; shot("11-cuenta")
        ui { Nav.pop(); Nav.push(Route.CategoryDetail("b-super", thisMonth())) }; shot("12-categoria")
        scroll(); shot("13-categoria-2")
        ui { Nav.pop(); Nav.push(Route.Stats(thisMonth())) }; shot("14-estadisticas")
        ui { Nav.pop(); Nav.push(Route.Txn("expense")) }; shot("15-nuevo-gasto")
        ui { Nav.pop(); Nav.push(Route.Exchange()) }; shot("16-cambio")
        ui { Nav.pop(); Nav.push(Route.Rates) }; shot("17-tasas")
        ui { Nav.pop(); Nav.push(Route.Buy(D.shoppingList().first().str("id"))) }; shot("18-comprado")
        ui { Nav.pop(); Nav.tab = Tab.SETTINGS }; shot("19-ajustes")
        scroll(); shot("20-ajustes-2")

        // Marcar algo como comprado desde la lista (casilla) suma a la despensa.
        ui { Nav.tab = Tab.SHOP; io.github.marcoh03.hogar.ui.ShoppingState.tab = 0 }
        val before = D.shoppingList().size
        ui { io.github.marcoh03.hogar.ui.buyNow(D.shoppingList().first()) }
        assertEquals(before - 1, D.shoppingList().size)
        // Completar una tarea que se repite la reprograma y la pasa al siguiente.
        val basura = D.tasks().first { it.str("title") == "Sacar la basura" }
        ui { io.github.marcoh03.hogar.ui.completeWithFeedback(basura) }
        assertEquals(addDays(today(), 1), D.tasks().first { it.str("title") == "Sacar la basura" }.str("due"))
    }

    @Test
    @Config(qualifiers = "+night")
    fun oscuro() {
        ui { seed() }
        rule.setContent { HogarTheme { HogarApp() } }
        shot("30-inicio-oscuro")
        ui { Nav.tab = Tab.MONEY }; shot("31-finanzas-oscuro")
    }

    @Test
    fun bienvenida() {
        ui {
            val ctx = rule.activity.applicationContext
            Store.init(ctx); Store.reset(); Sync.init(ctx)
        }
        rule.setContent { HogarTheme { HogarApp() } }
        shot("40-bienvenida")
        rule.onAllNodesWithText("Crear mi casa").onFirst().performClick()
        shot("41-crear-casa")
    }
}
