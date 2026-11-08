package io.github.marcoh03.hogar.data

import java.text.Normalizer
import java.text.NumberFormat
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

val ES: Locale = Locale("es", "ES")

fun round2(n: Double): Double = (n * 100).roundToLong() / 100.0

/** Texto sin tildes y en minúsculas, para comparar. */
fun norm(s: String): String =
    Normalizer.normalize(s, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "").lowercase(ES).trim()

fun cap(s: String): String = s.replaceFirstChar { if (it.isLowerCase()) it.titlecase(ES) else it.toString() }

/* ---------- Números y dinero ---------- */

private fun numberFormat(decimals: Boolean): NumberFormat = NumberFormat.getNumberInstance(ES).apply {
    minimumFractionDigits = if (decimals) 2 else 0
    maximumFractionDigits = 2
    isGroupingUsed = true
}

/** «33.250 CUP», «50 USD», «12,50 EUR». */
fun fmtCur(v: Double, code: String = "CUP", sign: Boolean = false): String {
    val r = round2(v)
    val cents = (abs(r) * 100).roundToLong() % 100 != 0L
    val pre = when {
        r < 0 -> "−"
        sign && r > 0 -> "+"
        else -> ""
    }
    return pre + numberFormat(cents).format(abs(r)) + " " + code
}

/** Número para campos de texto: sin separador de miles y con coma decimal. */
fun fmtNum(v: Double): String {
    val r = round2(v)
    return if (r == r.toLong().toDouble()) r.toLong().toString() else r.toString().replace('.', ',')
}

fun fmtQty(v: Double): String = numberFormat((abs(round2(v)) * 100).roundToLong() % 100 != 0L).format(round2(v))

/** Acepta «12,50», «12.5», «1.234,56» o «1,234.56». */
fun parseAmount(text: String?): Double {
    var t = (text ?: "").replace(Regex("\\s"), "").replace(Regex("[^\\d,.-]"), "")
    t = if (t.contains(',') && t.contains('.')) {
        if (t.lastIndexOf(',') > t.lastIndexOf('.')) t.replace(".", "").replace(',', '.') else t.replace(",", "")
    } else t.replace(',', '.')
    return t.toDoubleOrNull()?.takeIf { it.isFinite() } ?: 0.0
}

/* ---------- Fechas ---------- */

fun today(): String = LocalDate.now().toString()
fun parseDate(s: String): LocalDate = runCatching { LocalDate.parse(s) }.getOrElse { LocalDate.now() }
fun addDays(s: String, n: Long): String = parseDate(s).plusDays(n).toString()
fun addMonths(s: String, n: Long): String = parseDate(s).plusMonths(n).toString()
fun monthOf(s: String): String = s.take(7)
fun shiftMonth(key: String, n: Long): String = YearMonth.parse(key).plusMonths(n).toString()
fun thisMonth(): String = YearMonth.now().toString()

fun fmtMonth(key: String, withYear: Boolean = true): String {
    val ym = runCatching { YearMonth.parse(key) }.getOrElse { YearMonth.now() }
    val m = ym.month.getDisplayName(TextStyle.FULL_STANDALONE, ES)
    return cap(if (withYear) "$m de ${ym.year}" else m)
}

fun monthShort(key: String): String {
    val ym = runCatching { YearMonth.parse(key) }.getOrElse { YearMonth.now() }
    return cap(ym.month.getDisplayName(TextStyle.SHORT_STANDALONE, ES).replace(".", ""))
}

/** Fecha relativa corta: Hoy, Mañana, Ayer, Viernes, Lun 12 nov… */
fun fmtDay(s: String?): String {
    if (s.isNullOrEmpty()) return ""
    val d = parseDate(s)
    val diff = ChronoUnit.DAYS.between(LocalDate.now(), d)
    return when {
        diff == 0L -> "Hoy"
        diff == 1L -> "Mañana"
        diff == -1L -> "Ayer"
        diff in 2..6 -> cap(d.dayOfWeek.getDisplayName(TextStyle.FULL, ES))
        else -> {
            val pattern = if (d.year != LocalDate.now().year) "EEE d MMM yyyy" else "EEE d MMM"
            cap(d.format(DateTimeFormatter.ofPattern(pattern, ES)).replace(".", ""))
        }
    }
}

fun fmtLongDate(): String = cap(LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, d 'de' MMMM", ES)))

fun timeAgo(ts: Long): String {
    val s = (System.currentTimeMillis() - ts) / 1000
    return when {
        s < 60 -> "ahora"
        s < 3600 -> "hace ${s / 60} min"
        s < 86400 -> "hace ${s / 3600} h"
        s < 2 * 86400 -> "ayer"
        s < 7 * 86400 -> "hace ${s / 86400} días"
        else -> java.time.Instant.ofEpochMilli(ts).atZone(java.time.ZoneId.systemDefault()).toLocalDate()
            .format(DateTimeFormatter.ofPattern("d MMM", ES)).replace(".", "")
    }
}

fun listNames(names: List<String>, max: Int = 3): String =
    if (names.size <= max) names.joinToString(", ") else names.take(max).joinToString(", ") + " y ${names.size - max} más"
