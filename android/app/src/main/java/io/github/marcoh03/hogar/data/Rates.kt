package io.github.marcoh03.hogar.data

import org.json.JSONObject
import java.time.Instant

/**
 * Tasas del mercado informal (elTOque) que publica la web app en rates.json
 * (las genera un GitHub Action). Se aplican si son más recientes que las guardadas.
 */
object Rates {
    enum class Result { UPDATED, SAME, OLDER, OFF, UNAVAILABLE }

    val SOURCE_LABEL = mapOf("eltoque-api" to "elTOque", "eltoque-telegram" to "elTOque (Telegram)", "manual" to "Manual")

    private var last = 0L

    suspend fun fetchPublished(): JSONObject? {
        val text = httpGet("${PUBLIC_URL}rates.json?t=${System.currentTimeMillis()}") ?: return null
        val j = runCatching { JSONObject(text) }.getOrNull() ?: return null
        return if ((j.optJSONObject("rates")?.optDouble("USD", 0.0) ?: 0.0) > 0) j else null
    }

    suspend fun refresh(force: Boolean = false): Pair<Result, JSONObject?> {
        if (!Store.onboarded) return Result.OFF to null
        if (!force && System.currentTimeMillis() - last < 30 * 60_000) return Result.SAME to null
        val data = fetchPublished()
        last = System.currentTimeMillis()
        if (data == null) return Result.UNAVAILABLE to null
        val cur = D.fx()
        if (!force && !D.autoRates()) return Result.OFF to data
        val asOf = runCatching { Instant.parse(data.optString("asOf")).toString() }.getOrElse { Instant.now().toString() }
        val curAsOf = cur.str("asOf")
        if (!force && curAsOf.isNotEmpty() && asOf <= curAsOf) {
            return (if (cur.str("source") == "manual") Result.OLDER else Result.SAME) to data
        }
        val rates = D.rates().toMutableMap()
        val r = data.getJSONObject("rates")
        r.keys().forEach { k -> r.optDouble(k, 0.0).takeIf { it > 0 }?.let { rates[k] = it } }
        D.setRates(rates, source = data.optString("source", "eltoque-api"), asOf = asOf)
        return Result.UPDATED to data
    }

    fun sourceText(): String {
        val f = D.fx()
        val asOf = f.str("asOf")
        if (asOf.isEmpty()) return "Sin tasas todavía"
        val ts = runCatching { Instant.parse(asOf).toEpochMilli() }.getOrElse { 0L }
        val label = SOURCE_LABEL[f.str("source")] ?: f.str("source").ifEmpty { "Manual" }
        return "$label · ${timeAgo(ts)}"
    }
}
