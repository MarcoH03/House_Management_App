package io.github.marcoh03.hogar.data

import org.json.JSONArray
import org.json.JSONObject

/**
 * Los registros se guardan como objetos JSON, igual que en la web app. Así se
 * conservan todos los campos (también los que añada la web en el futuro) y los
 * datos se sincronizan sin conversiones entre el iPhone y Android.
 */
typealias Rec = JSONObject

fun Rec.has2(k: String): Boolean = has(k) && !isNull(k)

fun Rec.str(k: String, d: String = ""): String = if (has2(k)) optString(k, d) else d

fun Rec.strOrNull(k: String): String? = if (has2(k)) optString(k).takeIf { it.isNotEmpty() } else null

fun Rec.num(k: String, d: Double = 0.0): Double =
    if (has2(k)) optDouble(k, d).let { if (it.isNaN() || it.isInfinite()) d else it } else d

fun Rec.long(k: String, d: Long = 0L): Long = if (has2(k)) optLong(k, d) else d

fun Rec.bool(k: String): Boolean = has2(k) && optBoolean(k, false)

fun Rec.strList(k: String): List<String> = optJSONArray(k)?.let { a ->
    (0 until a.length()).mapNotNull { i -> a.optString(i).takeIf { it.isNotEmpty() } }
} ?: emptyList()

fun Rec.copyRec(): Rec = JSONObject(toString())

fun Rec.putAny(k: String, v: Any?): Rec {
    when (v) {
        null -> put(k, JSONObject.NULL)
        is Double -> put(k, if (v.isNaN() || v.isInfinite()) 0.0 else v)
        is List<*> -> put(k, JSONArray(v))
        is Map<*, *> -> put(k, JSONObject(v))
        else -> put(k, v)
    }
    return this
}

/** Copia del registro con los campos indicados cambiados. */
fun Rec.with(vararg pairs: Pair<String, Any?>): Rec = copyRec().apply { pairs.forEach { (k, v) -> putAny(k, v) } }

fun rec(vararg pairs: Pair<String, Any?>): Rec = JSONObject().apply { pairs.forEach { (k, v) -> putAny(k, v) } }

/** Valores de un objeto JSON que son a su vez objetos (las colecciones del almacén). */
fun JSONObject.recs(): List<Rec> = keys().asSequence().mapNotNull { optJSONObject(it) }.toList()

/** Identificador con el mismo formato que la web app. */
fun uid(): String {
    val t = java.lang.Long.toString(System.currentTimeMillis(), 36)
    val r = (1..6).map { "0123456789abcdefghijklmnopqrstuvwxyz".random() }.joinToString("")
    return t + r
}
