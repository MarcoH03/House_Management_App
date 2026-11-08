package io.github.marcoh03.hogar.data

import org.json.JSONArray
import kotlin.math.abs
import kotlin.math.max

/**
 * Lógica de negocio: miembros, compras/despensa, tareas y finanzas.
 * Es una traducción directa de js/domain.js para que la web app y la app de
 * Android calculen exactamente lo mismo sobre los mismos datos.
 */
object D {

    /* ---------- Catálogos ---------- */

    val COLORS = listOf("blue", "green", "orange", "pink", "purple", "teal", "indigo", "red", "yellow", "mint", "brown", "gray")
    /** Para categorías y etiquetas: el gris queda para «Sin categoría» y «Sin etiqueta». */
    val CHART_COLORS = listOf("green", "blue", "orange", "teal", "purple", "red", "indigo", "pink", "yellow", "mint", "brown")

    data class ShopCat(val id: String, val name: String, val emoji: String)

    val SHOP_CATS = listOf(
        ShopCat("fruta", "Frutas y verduras", "🥦"),
        ShopCat("carne", "Carne y pescado", "🥩"),
        ShopCat("lacteos", "Lácteos y huevos", "🥛"),
        ShopCat("pan", "Panadería", "🥖"),
        ShopCat("despensa", "Despensa", "🥫"),
        ShopCat("congelados", "Congelados", "🧊"),
        ShopCat("bebidas", "Bebidas", "🧃"),
        ShopCat("limpieza", "Limpieza", "🧽"),
        ShopCat("higiene", "Higiene personal", "🧴"),
        ShopCat("hogar", "Hogar", "🏠"),
        ShopCat("mascotas", "Mascotas", "🐾"),
        ShopCat("otros", "Otros", "📦"),
    )
    fun shopCat(id: String?): ShopCat = SHOP_CATS.firstOrNull { it.id == id } ?: SHOP_CATS.last()

    private val KEYWORDS: Map<String, List<String>> = linkedMapOf(
        "fruta" to listOf("manzana", "platano", "banana", "naranja", "mandarina", "limon", "tomate", "lechuga", "cebolla", "ajo", "patata", "papa", "zanahoria", "pimiento", "fruta", "verdura", "fresa", "uva", "pera", "aguacate", "pepino", "calabacin", "espinaca", "brocoli", "melon", "sandia", "kiwi", "champinon", "seta", "puerro", "berenjena", "perejil", "cilantro"),
        "carne" to listOf("pollo", "carne", "ternera", "cerdo", "pescado", "salmon", "merluza", "gamba", "jamon", "chorizo", "pavo", "hamburguesa", "salchicha", "lomo", "filete", "bacon", "pechuga", "costilla"),
        "lacteos" to listOf("leche", "yogur", "queso", "mantequilla", "nata", "huevo", "kefir"),
        "pan" to listOf("pan", "baguette", "barra", "bolleria", "croissant", "tostada", "magdalena", "bizcocho"),
        "despensa" to listOf("arroz", "pasta", "macarron", "espagueti", "harina", "azucar", "sal", "aceite", "vinagre", "atun", "lenteja", "garbanzo", "alubia", "frijol", "cafe", "infusion", "cereal", "galleta", "chocolate", "miel", "mermelada", "especia", "conserva", "caldo", "salsa", "tomate frito", "avena", "legumbre"),
        "congelados" to listOf("congelad", "helado", "pizza", "hielo"),
        "bebidas" to listOf("agua", "refresco", "cerveza", "vino", "zumo", "jugo", "cola", "soda", "tonica"),
        "limpieza" to listOf("detergente", "lejia", "cloro", "suavizante", "friegasuelos", "lavavajillas", "fregona", "estropajo", "bayeta", "bolsas de basura", "bolsa de basura", "limpiador", "lavaplatos", "ambientador", "quitagrasas", "pastillas lavavajillas"),
        "higiene" to listOf("champu", "gel", "pasta de dientes", "dentifrico", "cepillo de dientes", "desodorante", "papel higienico", "compresa", "tampon", "maquinilla", "colonia", "jabon", "toallitas", "algodon", "panal", "crema", "acondicionador", "enjuague"),
        "hogar" to listOf("bombilla", "pila", "servilleta", "papel de cocina", "papel de aluminio", "film", "vela", "cinta", "mechero"),
        "mascotas" to listOf("pienso", "comida de gato", "comida de perro", "arena", "snack perro", "snack gato"),
    )

    fun guessCategory(name: String): String {
        val n = " " + norm(name)
        for ((cat, words) in KEYWORDS) for (w in words) if (n.contains(" " + norm(w))) return cat
        return "otros"
    }

    val UNITS = listOf("ud" to "unidades", "kg" to "kilos", "g" to "gramos", "L" to "litros", "ml" to "mililitros",
        "paq" to "paquetes", "bote" to "botes", "rollo" to "rollos", "caja" to "cajas", "bolsa" to "bolsas")

    val REPEATS = listOf("none" to "Nunca", "daily" to "Cada día", "weekly" to "Cada semana", "biweekly" to "Cada 2 semanas", "monthly" to "Cada mes")
    fun repeatLabel(r: String?): String = REPEATS.firstOrNull { it.first == r }?.second ?: "Nunca"

    const val BASE = "CUP"
    data class CurrencyInfo(val code: String, val name: String, val flag: String)
    val CURRENCY_CATALOG = listOf(
        CurrencyInfo("CUP", "Peso cubano", "🇨🇺"),
        CurrencyInfo("USD", "Dólar estadounidense", "🇺🇸"),
        CurrencyInfo("EUR", "Euro", "🇪🇺"),
        CurrencyInfo("MLC", "Moneda libremente convertible", "💳"),
        CurrencyInfo("USDT", "Tether (USDT)", "🪙"),
        CurrencyInfo("CAD", "Dólar canadiense", "🇨🇦"),
        CurrencyInfo("MXN", "Peso mexicano", "🇲🇽"),
        CurrencyInfo("BRL", "Real brasileño", "🇧🇷"),
        CurrencyInfo("GBP", "Libra esterlina", "🇬🇧"),
        CurrencyInfo("CHF", "Franco suizo", "🇨🇭"),
    )
    fun curInfo(code: String): CurrencyInfo = CURRENCY_CATALOG.firstOrNull { it.code == code } ?: CurrencyInfo(code, code, "💱")
    private fun curOrder(code: String): Int = CURRENCY_CATALOG.indexOfFirst { it.code == code }.let { if (it < 0) 99 else it }
    fun sortCurrencies(list: Collection<String>): List<String> = list.toSet().sortedWith(compareBy({ curOrder(it) }, { it }))
    fun allCurrencies(): List<String> = sortCurrencies(CURRENCY_CATALOG.map { it.code } + currenciesInUse())

    val BUDGET_EMOJIS = listOf("🛒", "🧽", "💡", "🔧", "📦", "🍿", "🚗", "🐾", "🎁", "💊", "📺", "🏠", "🌱", "👶", "🍽️", "✈️", "🧾", "👕")
    val ACCOUNT_EMOJIS = listOf("🏠", "💵", "🏦", "💳", "🐷", "👛", "🧳", "🎯", "🛒", "🚗", "🎓", "🩺", "🎁", "✈️", "🔧", "📱")

    private data class Seed(val id: String, val name: String, val emoji: String, val color: String)
    private val DEFAULT_BUDGETS = listOf(
        Seed("b-super", "Supermercado", "🛒", "green"),
        Seed("b-limpieza", "Limpieza y hogar", "🧽", "blue"),
        Seed("b-servicios", "Facturas y servicios", "💡", "orange"),
        Seed("b-mant", "Mantenimiento", "🔧", "teal"),
        Seed("b-otros", "Otros", "📦", "purple"),
    )

    /* ---------- Miembros ---------- */

    fun members(): List<Rec> = Store.list("members").sortedBy { it.long("createdAt") }
    fun member(id: String?): Rec? = Store.get("members", id)
    fun meId(): String? = Store.me?.takeIf { member(it) != null }
    fun memberName(id: String?): String = member(id)?.str("name") ?: "Alguien"

    fun nextColor(): String {
        val used = members().map { it.str("color") }.toSet()
        return COLORS.firstOrNull { it !in used && it != "gray" } ?: COLORS[members().size % COLORS.size]
    }

    fun saveMember(m: Rec): Rec {
        val r = m.with("name" to m.str("name").trim())
        if (r.str("color").isEmpty()) r.put("color", nextColor())
        return Store.put("members", r)
    }

    fun removeMember(id: String) {
        Store.batch {
            for (t in tasks()) if (t.str("assignee") == id) Store.patch("tasks", t.str("id"), "assignee" to null)
            Store.remove("members", id)
        }
        if (Store.me == id) Store.me = null
    }

    /* ---------- Actividad ---------- */

    fun log(text: String, kind: String = "info") {
        Store.put("activity", rec("id" to uid(), "kind" to kind, "text" to text, "by" to meId(), "at" to System.currentTimeMillis()))
    }

    fun activity(limit: Int = 8): List<Rec> = Store.list("activity").sortedByDescending { it.long("at") }.take(limit)

    /* ---------- Alta de la casa ---------- */

    fun seedBudgets() {
        DEFAULT_BUDGETS.forEachIndexed { i, b ->
            if (!Store.exists("budgets", b.id)) {
                Store.put("budgets", rec("id" to b.id, "name" to b.name, "emoji" to b.emoji, "color" to b.color, "amounts" to emptyMap<String, Any>(), "order" to i))
            }
        }
    }

    fun seedAccounts() {
        if (Store.data.getJSONObject("accounts").length() == 0) {
            Store.put("accounts", rec("id" to "acc-casa", "name" to "Casa", "emoji" to "🏠", "color" to "blue", "currencies" to listOf(BASE, "USD"), "order" to 0))
        }
    }

    fun createHousehold(name: String, myName: String, others: List<String>) {
        var meRec: Rec? = null
        Store.batch {
            Store.setSettings("name" to name.trim().ifEmpty { "Mi casa" }, "currency" to BASE)
            meRec = Store.put("members", rec("id" to uid(), "name" to myName.trim(), "color" to "blue"))
            others.filter { it.isNotBlank() }.forEach { saveMember(rec("id" to uid(), "name" to it)) }
            seedBudgets()
            seedAccounts()
        }
        Store.me = meRec?.str("id")
        Store.onboarded = true
    }

    /* ---------- Compras y despensa ---------- */

    fun items(): List<Rec> = Store.list("items")
    fun shoppingList(): List<Rec> = items().filter { it.bool("onList") }
    fun isLow(i: Rec): Boolean = i.num("min") > 0 && i.num("stock") <= i.num("min")
    fun lowStock(): List<Rec> = items().filter { isLow(it) }
    fun findItem(name: String): Rec? = items().firstOrNull { norm(it.str("name")) == norm(name) }

    fun newItem(name: String = "", onList: Boolean = false): Rec = rec(
        "id" to uid(), "name" to name, "category" to (if (name.isNotBlank()) guessCategory(name) else "otros"),
        "stock" to 0, "unit" to "ud", "min" to 0, "autoAdd" to true, "onList" to onList, "listQty" to 1,
        "note" to "", "addedBy" to meId(),
    )

    enum class AddStatus { NEW, ADDED, ALREADY }

    fun addToList(name: String): Pair<Rec, AddStatus>? {
        val clean = name.trim()
        if (clean.isEmpty()) return null
        val ex = findItem(clean)
        if (ex != null && ex.bool("onList")) return ex to AddStatus.ALREADY
        return Store.batch {
            val item = if (ex != null) {
                Store.patch("items", ex.str("id"), "onList" to true, "listQty" to max(ex.num("listQty"), 1.0), "addedBy" to meId())!!
            } else Store.put("items", newItem(clean, onList = true))
            log("añadió ${item.str("name")} a la lista", "list")
            item to (if (ex != null) AddStatus.ADDED else AddStatus.NEW)
        }
    }

    fun saveItem(it: Rec): Rec {
        val prev = Store.get("items", it.strOrNull("id"))
        return Store.batch {
            val saved = Store.put("items", it)
            if (prev == null && saved.bool("onList")) log("añadió ${saved.str("name")} a la lista", "list")
            saved
        }
    }

    fun toggleOnList(id: String): Boolean {
        val it = Store.get("items", id) ?: return false
        val on = !it.bool("onList")
        Store.batch {
            Store.patch("items", id, "onList" to on, "listQty" to max(it.num("listQty"), 1.0))
            if (on) log("añadió ${it.str("name")} a la lista", "list")
        }
        return on
    }

    /** Cambia lo que queda. Devuelve true si se añadió solo a la lista. */
    fun adjustStock(id: String, delta: Double): Boolean {
        val it = Store.get("items", id) ?: return false
        val stock = max(0.0, round2(it.num("stock") + delta))
        val autoAdd = delta < 0 && it.bool("autoAdd") && it.num("min") > 0 && stock <= it.num("min") && !it.bool("onList")
        Store.batch {
            if (autoAdd) {
                Store.patch("items", id, "stock" to stock, "onList" to true, "listQty" to max(it.num("listQty"), 1.0))
                log("${it.str("name")} se está acabando: añadido a la lista", "list")
            } else Store.patch("items", id, "stock" to stock)
        }
        return autoAdd
    }

    fun markBought(
        id: String, qty: Double = 0.0, amount: Double = 0.0, currency: String = BASE, rate: Double = 0.0,
        accountId: String? = null, categoryId: String? = null, by: String? = meId(), tagIds: List<String> = emptyList(),
    ): Rec? {
        val it = Store.get("items", id) ?: return null
        val q = if (qty > 0) qty else max(it.num("listQty"), 1.0)
        return Store.batch {
            val p = Store.put("purchases", rec(
                "id" to uid(), "itemId" to id, "name" to it.str("name"), "qty" to q, "unit" to it.str("unit", "ud"),
                "by" to by, "at" to System.currentTimeMillis(), "date" to today(), "billed" to false, "expenseId" to null,
            ))
            Store.patch("items", id, "stock" to round2(it.num("stock") + q), "onList" to false, "listQty" to 1)
            if (amount > 0) {
                val e = saveTxn(rec(
                    "type" to "expense", "amount" to amount, "currency" to currency, "rate" to rate,
                    "accountId" to (accountId ?: defaultAccountId()), "categoryId" to (categoryId ?: defaultBudgetFor(it.str("category"))),
                    "desc" to it.str("name"), "by" to by, "date" to today(), "purchaseIds" to listOf(p.str("id")), "tagIds" to tagIds,
                ))
                addCurrencyToAccount(e.str("accountId"), currency)
                Store.patch("purchases", p.str("id"), "billed" to true, "expenseId" to e.str("id"))
            }
            log("compró ${it.str("name")}", "buy")
            p
        }
    }

    fun unbilledPurchases(): List<Rec> {
        val me = meId()
        val since = System.currentTimeMillis() - 3 * 86_400_000L
        return Store.list("purchases")
            .filter { !it.bool("billed") && it.long("at") > since && (me == null || it.strOrNull("by") == null || it.str("by") == me) }
            .sortedBy { it.long("at") }
    }

    fun dismissPurchases(ids: List<String>) = Store.batch { ids.forEach { Store.patch("purchases", it, "billed" to true) } }

    fun purchases(limit: Int = 150): List<Rec> = Store.list("purchases").sortedByDescending { it.long("at") }.take(limit)

    fun defaultBudgetFor(category: String?): String {
        val b = budgets()
        val want = if (category in listOf("limpieza", "higiene", "hogar")) "b-limpieza" else "b-super"
        return (b.firstOrNull { it.str("id") == want } ?: b.firstOrNull { it.str("id") == "b-super" } ?: b.firstOrNull())?.str("id") ?: ""
    }

    fun billSummary(ps: List<Rec>): Pair<String, String> {
        val votes = mutableMapOf<String, Int>()
        for (p in ps) {
            val b = defaultBudgetFor(Store.get("items", p.str("itemId"))?.str("category") ?: "otros")
            votes[b] = (votes[b] ?: 0) + 1
        }
        val categoryId = votes.maxByOrNull { it.value }?.key ?: ""
        return categoryId to "Compra: " + listNames(ps.map { it.str("name") }, 4)
    }

    /* ---------- Tareas ---------- */

    fun tasks(): List<Rec> = Store.list("tasks")
    fun pendingTasks(): List<Rec> = tasks().filter { !it.bool("done") }
    fun sortTasks(list: List<Rec>): List<Rec> =
        list.sortedWith(compareBy<Rec>({ it.strOrNull("due") ?: "9999" }, { it.long("createdAt") }))

    fun nextDue(date: String, repeat: String): String = when (repeat) {
        "daily" -> addDays(date, 1)
        "weekly" -> addDays(date, 7)
        "biweekly" -> addDays(date, 14)
        "monthly" -> addMonths(date, 1)
        else -> date
    }

    fun saveTask(t: Rec): Rec {
        val isNew = Store.get("tasks", t.strOrNull("id")) == null
        return Store.batch {
            val saved = Store.put("tasks", t)
            if (isNew) log("creó la tarea «${saved.str("title")}»", "task")
            saved
        }
    }

    data class Completed(val repeat: Boolean, val next: String? = null, val assignee: String? = null)

    /** Completa una tarea. Si se repite, la reprograma (y rota el responsable si procede). */
    fun completeTask(id: String): Completed? {
        val t = Store.get("tasks", id) ?: return null
        return Store.batch {
            log("completó «${t.str("title")}»", "done")
            val repeat = t.str("repeat", "none")
            if (repeat != "none") {
                val now = today()
                var next = t.strOrNull("due") ?: now
                var guard = 0
                do { next = nextDue(next, repeat) } while (next <= now && guard++ < 1000)
                var assignee = t.strOrNull("assignee")
                if (t.bool("rotate")) {
                    val ms = members()
                    if (ms.isNotEmpty()) {
                        val idx = ms.indexOfFirst { it.str("id") == assignee }
                        assignee = ms[(idx + 1) % ms.size].str("id")
                    }
                }
                Store.patch("tasks", id, "due" to next, "assignee" to assignee, "lastDoneAt" to System.currentTimeMillis(), "lastDoneBy" to meId())
                Completed(true, next, assignee)
            } else {
                Store.patch("tasks", id, "done" to true, "doneAt" to System.currentTimeMillis(), "doneBy" to meId())
                Completed(false)
            }
        }
    }

    fun uncompleteTask(id: String) { Store.patch("tasks", id, "done" to false, "doneAt" to null, "doneBy" to null) }

    fun clearDoneTasks() = Store.batch { tasks().filter { it.bool("done") }.forEach { Store.remove("tasks", it.str("id")) } }

    /* ---------- Categorías de gasto ---------- */

    fun budgets(): List<Rec> = Store.list("budgets").sortedWith(compareBy<Rec>({ if (it.has2("order")) it.num("order") else 99.0 }, { it.long("createdAt") }))
    fun categories(): List<Rec> = budgets()
    fun category(id: String?): Rec? = Store.get("budgets", id)
    fun saveCategory(c: Rec): Rec = Store.put("budgets", c.also { if (!it.has2("order")) it.put("order", budgets().size) })

    /* ---------- Tasas de cambio ---------- */

    fun fx(): Rec = Store.get("fx", "current") ?: rec("id" to "current", "rates" to emptyMap<String, Any>(), "auto" to true, "source" to "", "asOf" to "")
    fun rates(): Map<String, Double> {
        val o = fx().optJSONObject("rates") ?: return emptyMap()
        return o.keys().asSequence().associateWith { o.optDouble(it, 0.0) }.filterValues { it > 0 }
    }
    fun rateOf(code: String): Double = if (code == BASE) 1.0 else rates()[code] ?: 0.0
    fun autoRates(): Boolean = !fx().has2("auto") || fx().bool("auto")

    fun setRates(rates: Map<String, Double>, source: String = "manual", asOf: String = java.time.Instant.now().toString(), auto: Boolean? = null): Rec {
        val clean = rates.filter { it.key != BASE && it.value > 0 }.mapValues { round2(it.value) }
        return Store.put("fx", fx().with("id" to "current", "rates" to clean, "source" to source, "asOf" to asOf, "auto" to (auto ?: autoRates())))
    }

    fun setAutoRates(on: Boolean) { Store.put("fx", fx().with("auto" to on)) }

    fun convert(amount: Double, from: String, to: String): Double {
        val a = rateOf(from); val b = rateOf(to)
        return if (a > 0 && b > 0) round2(amount * a / b) else 0.0
    }

    fun currenciesInUse(): List<String> {
        val list = mutableListOf(BASE)
        list += rates().keys
        for (a in accounts()) list += a.strList("currencies")
        return sortCurrencies(list)
    }

    /* ---------- Cuentas ---------- */

    fun accounts(): List<Rec> = Store.list("accounts").sortedWith(compareBy<Rec>({ if (it.has2("order")) it.num("order") else 99.0 }, { it.long("createdAt") }))
    fun account(id: String?): Rec? = Store.get("accounts", id)

    /** Cuenta principal: la del dinero del mes (ver js/domain.js). */
    fun mainAccountId(): String {
        val id = Store.settings().strOrNull("mainAccountId")
        return if (id != null && account(id) != null) id else accounts().firstOrNull()?.str("id") ?: ""
    }
    fun mainAccount(): Rec? = account(mainAccountId())
    fun isMainAccount(id: String?): Boolean = !id.isNullOrEmpty() && id == mainAccountId()
    fun setMainAccount(id: String) = Store.setSettings("mainAccountId" to id)
    fun defaultAccountId(): String = mainAccountId()

    fun saveAccount(a: Rec): Rec {
        val curs = sortCurrencies(a.strList("currencies").ifEmpty { listOf(BASE) })
        return Store.put("accounts", a.with("name" to a.str("name").trim(), "currencies" to curs).also { if (!it.has2("order")) it.put("order", accounts().size) })
    }

    fun addCurrencyToAccount(id: String?, code: String) {
        val a = account(id) ?: return
        val curs = a.strList("currencies")
        if (code !in curs) Store.patch("accounts", id, "currencies" to sortCurrencies(curs + code))
    }

    fun txns(): List<Rec> = Store.list("txns")

    /** Saldos: cuenta → (moneda → importe). */
    fun ledger(): Map<String, Map<String, Double>> {
        val bal = mutableMapOf<String, MutableMap<String, Double>>()
        fun add(acc: String?, cur: String?, v: Double) {
            if (acc.isNullOrEmpty() || cur.isNullOrEmpty()) return
            val m = bal.getOrPut(acc) { mutableMapOf() }
            m[cur] = round2((m[cur] ?: 0.0) + v)
        }
        for (t in txns()) {
            val amt = t.num("amount")
            when (t.str("type")) {
                "income" -> add(t.str("accountId"), t.str("currency"), amt)
                "expense" -> add(t.str("accountId"), t.str("currency"), -amt)
                "transfer" -> { add(t.str("accountId"), t.str("currency"), -amt); add(t.str("toAccountId"), t.str("currency"), amt) }
                "exchange" -> { add(t.str("accountId"), t.str("currency"), -amt); add(t.str("accountId"), t.str("toCurrency"), t.num("toAmount")) }
            }
        }
        return bal
    }

    /** Saldos por moneda de una cuenta (incluye las monedas añadidas aunque estén a 0). */
    fun accountBalances(a: Rec, led: Map<String, Map<String, Double>> = ledger()): Map<String, Double> {
        val b = led[a.str("id")] ?: emptyMap()
        val curs = a.strList("currencies")
        return sortCurrencies(curs + b.keys).mapNotNull { c ->
            val v = b[c] ?: 0.0
            if (v != 0.0 || c in curs) c to v else null
        }.toMap()
    }

    data class Valuation(val cup: Double, val usd: Double?, val missing: List<String>)

    fun valuation(byCur: Map<String, Double>): Valuation {
        var cup = 0.0
        val missing = mutableListOf<String>()
        for ((c, v) in byCur) {
            if (v == 0.0) continue
            val r = rateOf(c)
            if (r > 0) cup += v * r else missing += c
        }
        val usdRate = rateOf("USD")
        return Valuation(round2(cup), if (usdRate > 0) round2(cup / usdRate) else null, missing)
    }

    data class Totals(val byCur: Map<String, Double>, val value: Valuation)

    /** Saldos sumados por moneda. Por defecto, solo los de la cuenta principal. */
    fun totals(all: Boolean = false): Totals {
        val led = ledger()
        val known = if (all) accounts().map { it.str("id") }.toSet() else setOf(mainAccountId())
        val byCur = mutableMapOf<String, Double>()
        for ((acc, b) in led) {
            if (acc !in known) continue
            for ((c, v) in b) byCur[c] = round2((byCur[c] ?: 0.0) + v)
        }
        val sorted = sortCurrencies(byCur.keys).associateWith { byCur[it]!! }
        return Totals(sorted, valuation(sorted))
    }

    /* ---------- Movimientos ---------- */

    private val TXN_LOG = mapOf("income" to "anotó una entrada", "expense" to "anotó un gasto", "transfer" to "hizo una transferencia", "exchange" to "cambió moneda")

    fun saveTxn(t: Rec): Rec {
        val prev = Store.get("txns", t.strOrNull("id"))
        val amount = round2(abs(t.num("amount")))
        val r = t.copyRec()
        if (!r.has("by")) r.putAny("by", meId())
        if (r.str("date").isEmpty()) r.put("date", today())
        if (!r.has2("desc")) r.put("desc", "")
        r.put("amount", amount)
        val type = r.str("type")
        if (type == "income" || type == "expense" || type == "transfer") {
            // La tasa se fija al anotar el movimiento y no se recalcula después.
            val cur = r.str("currency", BASE)
            val rate = if (cur == BASE) 1.0 else r.num("rate").takeIf { it > 0 } ?: prev?.num("rate")?.takeIf { it > 0 } ?: rateOf(cur)
            r.put("rate", rate)
            val usdRate = r.num("usdRate").takeIf { it > 0 } ?: prev?.num("usdRate")?.takeIf { it > 0 }
                ?: rateOf("USD").takeIf { it > 0 } ?: (if (cur == "USD") rate else 0.0)
            r.put("usdRate", usdRate)
            r.put("cup", round2(amount * rate))
        }
        if (type == "expense") r.put("tagIds", JSONArray(r.strList("tagIds").distinct())) else r.remove("tagIds")
        if (type == "exchange") {
            val to = round2(abs(r.num("toAmount")))
            r.put("toAmount", to)
            r.put("rate", if (amount > 0) to / amount else 0.0)
        }
        return Store.batch {
            val saved = Store.put("txns", r)
            if (prev == null) {
                val what = if (type == "exchange") "${r.str("currency")} → ${r.str("toCurrency")}" else r.str("desc")
                log("${TXN_LOG[type] ?: "anotó un movimiento"}${if (what.isNotEmpty()) ": $what" else ""}", type)
            }
            saved
        }
    }

    /** Valor en CUP con la tasa de su día (las transferencias antiguas no la guardaban). */
    fun txnCup(t: Rec): Double = if (t.has2("cup")) t.num("cup") else round2(t.num("amount") * rateOf(t.str("currency", BASE)))

    fun txnsIn(month: String): List<Rec> = txns().filter { monthOf(it.str("date")) == month }
        .sortedWith(compareByDescending<Rec> { it.str("date") }.thenByDescending { it.long("createdAt") })

    data class Money(val cup: Double, val usd: Double?)
    data class MonthSummary(
        val month: String, val list: List<Rec>, val income: Money, val spent: Money,
        val byCat: Map<String, Double>, val byMember: Map<String, Double>,
    )

    /** Resumen del mes de la cuenta principal (entradas incluyen lo que se pasa desde otras cuentas). */
    fun monthSummary(month: String): MonthSummary {
        val main = mainAccountId()
        val list = txnsIn(month).filter { it.str("accountId") == main || it.str("toAccountId") == main }
        fun sum(arr: List<Rec>): Money {
            var cup = 0.0; var usd = 0.0; var ok = true
            for (t in arr) {
                val c = txnCup(t)
                cup += c
                val u = when {
                    t.str("currency") == "USD" -> t.num("amount")
                    t.num("usdRate") > 0 -> c / t.num("usdRate")
                    rateOf("USD") > 0 -> c / rateOf("USD")
                    else -> null
                }
                if (u == null) ok = false else usd += u
            }
            return Money(round2(cup), if (ok) round2(usd) else null)
        }
        val expenses = list.filter { it.str("type") == "expense" && it.str("accountId") == main }
        val incomes = list.filter {
            (it.str("type") == "income" && it.str("accountId") == main) ||
                (it.str("type") == "transfer" && it.str("toAccountId") == main && it.str("accountId") != main)
        }
        val byCat = mutableMapOf<String, Double>()
        val byMember = mutableMapOf<String, Double>()
        for (t in expenses) {
            val k = if (category(t.strOrNull("categoryId")) != null) t.str("categoryId") else ""
            byCat[k] = round2((byCat[k] ?: 0.0) + t.num("cup"))
            val m = t.str("by")
            byMember[m] = round2((byMember[m] ?: 0.0) + t.num("cup"))
        }
        return MonthSummary(month, list, sum(incomes), sum(expenses), byCat, byMember)
    }

    fun accountTxns(id: String, limit: Int = 40): List<Rec> = txns()
        .filter { it.str("accountId") == id || it.str("toAccountId") == id }
        .sortedWith(compareByDescending<Rec> { it.str("date") }.thenByDescending { it.long("createdAt") })
        .take(limit)

    /* ---------- Etiquetas y estadísticas ---------- */

    fun tags(): List<Rec> = Store.list("tags").sortedBy { norm(it.str("name")) }
    fun tag(id: String?): Rec? = Store.get("tags", id)

    fun saveTag(t: Rec): Rec? {
        val name = t.str("name").trim().removePrefix("#")
        if (name.isEmpty()) return null
        val dup = tags().firstOrNull { norm(it.str("name")) == norm(name) && it.str("id") != t.str("id") }
        if (dup != null && t.strOrNull("id") == null) return dup
        val used = tags().map { it.str("color") }.toSet()
        val color = t.strOrNull("color") ?: CHART_COLORS.firstOrNull { it !in used } ?: CHART_COLORS[tags().size % CHART_COLORS.size]
        return Store.put("tags", t.with("name" to name, "color" to color))
    }

    fun removeTag(id: String) = Store.batch {
        for (t in txns()) if (id in t.strList("tagIds")) Store.patch("txns", t.str("id"), "tagIds" to t.strList("tagIds") - id)
        Store.remove("tags", id)
    }

    fun tagUsage(id: String): Int = txns().count { id in it.strList("tagIds") }

    /** Etiquetas ordenadas: primero las más usadas en esa categoría. */
    fun tagsForCategory(catId: String?): List<Rec> {
        val count = mutableMapOf<String, Int>()
        for (t in txns()) {
            if (t.str("type") != "expense") continue
            for (id in t.strList("tagIds")) count[id] = (count[id] ?: 0) + (if (t.str("categoryId") == catId) 1000 else 1)
        }
        return tags().sortedWith(compareByDescending<Rec> { count[it.str("id")] ?: 0 }.thenBy { norm(it.str("name")) })
    }

    private fun catKey(t: Rec): String = if (category(t.strOrNull("categoryId")) != null) t.str("categoryId") else ""

    /** Gastos del mes de la cuenta principal (opcionalmente de una categoría: "" = sin categoría). */
    fun expensesIn(month: String, catId: String? = null): List<Rec> {
        val main = mainAccountId()
        return txns().filter {
            it.str("type") == "expense" && monthOf(it.str("date")) == month && it.str("accountId") == main && (catId == null || catKey(it) == catId)
        }
    }

    fun spentIn(month: String, catId: String? = null): Double = round2(expensesIn(month, catId).sumOf { it.num("cup") })

    data class Point(val month: String, val cup: Double)
    fun spendSeries(month: String, n: Int = 6, catId: String? = null): List<Point> =
        (n - 1 downTo 0).map { i -> shiftMonth(month, -i.toLong()).let { Point(it, spentIn(it, catId)) } }

    fun prevMonth(key: String): String = shiftMonth(key, -1)

    data class CatRow(val id: String, val cat: Rec?, val cup: Double, val pct: Double, val count: Int, val delta: Double?)
    data class CatBreakdown(val total: Double, val rows: List<CatRow>)

    fun categoryBreakdown(month: String): CatBreakdown {
        val prev = prevMonth(month)
        val total = spentIn(month)
        val list = expensesIn(month)
        val ids = list.map { catKey(it) }.toSet()
        val rows = ids.map { id ->
            val cup = spentIn(month, id)
            val before = spentIn(prev, id)
            CatRow(id, category(id), cup, if (total > 0) cup / total * 100 else 0.0, list.count { catKey(it) == id },
                if (before > 0) (cup - before) / before * 100 else null)
        }.sortedByDescending { it.cup }
        return CatBreakdown(total, rows)
    }

    data class TagRow(val id: String, val tag: Rec?, val cup: Double, val count: Int, val pct: Double)
    data class TagBreakdown(val list: List<Rec>, val total: Double, val rows: List<TagRow>, val overlap: Boolean)

    /** Desglose de una categoría por etiquetas. Un gasto con varias etiquetas cuenta en cada una. */
    fun tagBreakdown(month: String, catId: String): TagBreakdown {
        val list = expensesIn(month, catId).sortedWith(compareByDescending<Rec> { it.str("date") }.thenByDescending { it.long("createdAt") })
        val total = round2(list.sumOf { it.num("cup") })
        val sums = linkedMapOf<String, Double>()
        val counts = mutableMapOf<String, Int>()
        var overlap = false
        for (t in list) {
            val ids = t.strList("tagIds").filter { tag(it) != null }
            if (ids.size > 1) overlap = true
            for (id in ids.ifEmpty { listOf("") }) {
                sums[id] = round2((sums[id] ?: 0.0) + t.num("cup"))
                counts[id] = (counts[id] ?: 0) + 1
            }
        }
        val rows = sums.map { (id, cup) -> TagRow(id, tag(id), cup, counts[id] ?: 0, if (total > 0) cup / total * 100 else 0.0) }
            .sortedWith(compareBy<TagRow> { it.id.isEmpty() }.thenByDescending { it.cup })
        return TagBreakdown(list, total, rows, overlap)
    }

    data class MonthStats(val total: Double, val count: Int, val biggest: Rec?, val avgDaily: Double, val projection: Double?, val daysLeft: Int)

    fun monthStats(month: String): MonthStats {
        val list = expensesIn(month)
        val total = round2(list.sumOf { it.num("cup") })
        val ym = java.time.YearMonth.parse(month)
        val days = ym.lengthOfMonth()
        val cur = thisMonth()
        val elapsed = when {
            month == cur -> java.time.LocalDate.now().dayOfMonth
            month < cur -> days
            else -> 0
        }
        return MonthStats(
            total, list.size, list.maxByOrNull { it.num("cup") },
            if (elapsed > 0) round2(total / elapsed) else 0.0,
            if (month == cur && elapsed > 0) round2(total / elapsed * days) else null,
            if (month == cur) days - elapsed else 0,
        )
    }
}
