package io.github.marcoh03.hogar.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Almacén local, equivalente a js/store.js de la web app.
 * Fusión «last-write-wins» por registro: cada registro lleva `updatedAt` y los
 * borrados se guardan como lápidas ({id, deleted:true, updatedAt}).
 */
object Store {
    val COLS = listOf("members", "items", "purchases", "tasks", "budgets", "expenses", "activity", "accounts", "txns", "fx", "tags")
    private const val ACTIVITY_TTL = 60L * 86_400_000L

    private lateinit var file: File
    private lateinit var prefs: SharedPreferences

    var data: JSONObject = blank()
        private set

    /** Cambia con cada modificación: la interfaz se vuelve a pintar al observarlo. */
    val version = MutableStateFlow(0)

    /** Avisa de cambios hechos en este dispositivo (para sincronizar). */
    val localChanges = MutableSharedFlow<Unit>(extraBufferCapacity = 16)

    fun init(ctx: Context) {
        file = File(ctx.filesDir, "hogar-data.json")
        prefs = ctx.getSharedPreferences("hogar", Context.MODE_PRIVATE)
        data = normalize(runCatching { JSONObject(file.readText()) }.getOrNull())
    }

    val hasLocalFile: Boolean get() = ::file.isInitialized && file.exists()

    /* ---------- Metadatos del dispositivo (no se sincronizan) ---------- */

    var me: String?
        get() = prefs.getString("me", null)
        set(v) { prefs.edit().putString("me", v).apply(); version.value++ }
    var onboarded: Boolean
        get() = prefs.getBoolean("onboarded", false)
        set(v) { prefs.edit().putBoolean("onboarded", v).apply(); version.value++ }
    var dirty: Boolean
        get() = prefs.getBoolean("dirty", false)
        set(v) { prefs.edit().putBoolean("dirty", v).apply() }
    var rev: Long
        get() = prefs.getLong("rev", 0)
        private set(v) { prefs.edit().putLong("rev", v).apply() }

    /* ---------- Estructura ---------- */

    fun blank(): JSONObject = JSONObject().apply {
        put("schema", 1)
        put("settings", rec("id" to "settings", "name" to "", "currency" to "CUP", "updatedAt" to 0L))
        COLS.forEach { put(it, JSONObject()) }
    }

    fun normalize(raw: JSONObject?): JSONObject {
        val d = blank()
        if (raw == null) return d
        raw.optJSONObject("settings")?.let { s ->
            val base = d.getJSONObject("settings")
            s.keys().forEach { k -> base.put(k, s.get(k)) }
        }
        val cutoff = System.currentTimeMillis() - ACTIVITY_TTL
        for (c in COLS) {
            val out = d.getJSONObject(c)
            val values = when (val src = raw.opt(c)) {
                is JSONObject -> src.recs()
                is JSONArray -> (0 until src.length()).mapNotNull { src.optJSONObject(it) }
                else -> emptyList()
            }
            for (r in values) {
                val id = r.str("id")
                if (id.isEmpty()) continue
                if (c == "activity") {
                    val at = r.long("at").takeIf { it > 0 } ?: r.long("updatedAt")
                    if (at < cutoff) continue
                }
                out.put(id, r)
            }
        }
        return d
    }

    private fun col(c: String): JSONObject = data.getJSONObject(c)

    fun list(c: String): List<Rec> = col(c).recs().filter { !it.bool("deleted") }

    fun get(c: String, id: String?): Rec? =
        id?.takeIf { it.isNotEmpty() }?.let { col(c).optJSONObject(it) }?.takeIf { !it.bool("deleted") }

    /** ¿Existe el registro (aunque sea una lápida)? */
    fun exists(c: String, id: String): Boolean = col(c).has(id)

    fun settings(): Rec = data.getJSONObject("settings")

    /* ---------- Cambios ---------- */

    private var batchDepth = 0
    private var pending = false

    private fun stamp(prev: Long): Long {
        val t = System.currentTimeMillis()
        return if (prev >= t) prev + 1 else t
    }

    fun put(c: String, record: Rec): Rec {
        val id = record.strOrNull("id") ?: uid()
        val prev = col(c).optJSONObject(id)
        val ts = stamp(prev?.long("updatedAt") ?: 0L)
        val r = record.copyRec()
        r.put("id", id)
        r.put("updatedAt", ts)
        val created = record.long("createdAt").takeIf { it > 0 } ?: prev?.long("createdAt")?.takeIf { it > 0 } ?: ts
        r.put("createdAt", created)
        col(c).put(id, r)
        changed()
        return r
    }

    fun patch(c: String, id: String?, vararg pairs: Pair<String, Any?>): Rec? {
        val prev = get(c, id) ?: return null
        return put(c, prev.with(*pairs))
    }

    fun remove(c: String, id: String) {
        val prev = col(c).optJSONObject(id) ?: return
        col(c).put(id, rec("id" to id, "deleted" to true, "updatedAt" to stamp(prev.long("updatedAt"))))
        changed()
    }

    fun setSettings(vararg pairs: Pair<String, Any?>) {
        val s = settings()
        val n = s.with(*pairs)
        n.put("updatedAt", stamp(s.long("updatedAt")))
        data.put("settings", n)
        changed()
    }

    fun <T> batch(fn: () -> T): T {
        batchDepth++
        try {
            return fn()
        } finally {
            batchDepth--
            if (batchDepth == 0 && pending) {
                pending = false
                flush()
            }
        }
    }

    private fun changed() {
        dirty = true
        rev += 1
        if (batchDepth > 0) { pending = true; return }
        flush()
    }

    private fun flush() {
        save()
        version.value++
        localChanges.tryEmit(Unit)
    }

    fun save() {
        runCatching {
            val tmp = File(file.parentFile, file.name + ".tmp")
            tmp.writeText(data.toString())
            if (!tmp.renameTo(file)) { file.writeText(data.toString()); tmp.delete() }
        }
    }

    /* ---------- Fusión con otra copia ---------- */

    private class MergeResult(val data: JSONObject, val changed: Boolean, val localNewer: Boolean)

    private fun mergeData(local: JSONObject, remote: JSONObject): MergeResult {
        val out = blank()
        var changed = false
        var localNewer = false
        fun pick(l: Rec?, r: Rec?): Rec? {
            if (l == null) { changed = true; return r }
            if (r == null) { localNewer = true; return l }
            val lt = l.long("updatedAt")
            val rt = r.long("updatedAt")
            if (rt > lt) { changed = true; return r }
            if (lt > rt) localNewer = true
            return l
        }
        out.put("settings", pick(local.getJSONObject("settings"), remote.getJSONObject("settings")))
        for (c in COLS) {
            val lc = local.getJSONObject(c)
            val rc = remote.getJSONObject(c)
            val ids = lc.keys().asSequence().toMutableSet().apply { addAll(rc.keys().asSequence()) }
            val oc = out.getJSONObject(c)
            for (id in ids) pick(lc.optJSONObject(id), rc.optJSONObject(id))?.let { oc.put(id, it) }
        }
        return MergeResult(out, changed, localNewer)
    }

    /** Fusiona datos remotos. Devuelve true si lo local tiene algo que subir. */
    fun merge(remote: JSONObject): Boolean {
        val r = mergeData(data, normalize(remote))
        if (r.changed) {
            data = r.data
            save()
            version.value++
        }
        return r.localNewer
    }

    /** Importa una copia de seguridad combinándola con los datos actuales. */
    fun importData(raw: JSONObject) {
        data = mergeData(data, normalize(raw)).data
        changed()
    }

    /** Sustituye todo (migración desde la versión anterior de la app). */
    fun replaceAll(raw: JSONObject) {
        data = normalize(raw)
        save()
        version.value++
    }

    fun exportJson(): String = data.toString()

    fun reset() {
        data = blank()
        runCatching { file.delete() }
        prefs.edit().clear().apply()
        version.value++
    }

    fun touch() { version.value++ }
}
