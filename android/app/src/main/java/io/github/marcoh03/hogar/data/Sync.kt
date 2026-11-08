package io.github.marcoh03.hogar.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Base64

class SyncException(message: String, val offline: Boolean = false) : Exception(message)

/**
 * Sincronización con un archivo JSON en un repositorio PRIVADO de GitHub.
 * Mismo protocolo y formato que js/sync.js: descargar, fusionar por registro y
 * subir; si otro dispositivo escribió entre medias (409), se repite.
 */
object Sync {
    data class Cfg(val owner: String, val repo: String, val token: String, val branch: String = "", val path: String = "hogar.json")

    enum class Status { OFF, IDLE, SYNCING, ERROR, OFFLINE }

    private const val API = "https://api.github.com"
    private const val POLL_MS = 20_000L

    private lateinit var prefs: SharedPreferences
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    var cfg: Cfg? = null
        private set
    val status = MutableStateFlow(Status.OFF)
    var error: String? = null
        private set
    var lastSync: Long = 0
        private set

    private var etag: String? = null
    private var sha: String? = null
    private var busy = false
    private var again = false
    private var pollJob: Job? = null
    private var debounceJob: Job? = null

    fun init(ctx: Context) {
        prefs = ctx.getSharedPreferences("hogar-sync", Context.MODE_PRIVATE)
        cfg = loadCfg()
        lastSync = prefs.getLong("lastSync", 0)
        if (cfg != null) status.value = Status.IDLE
        scope.launch { Store.localChanges.collect { schedule() } }
    }

    private fun loadCfg(): Cfg? {
        val raw = prefs.getString("cfg", null) ?: return null
        return runCatching {
            val o = JSONObject(raw)
            Cfg(o.getString("owner"), o.getString("repo"), o.getString("token"), o.optString("branch"), o.optString("path", "hogar.json").ifEmpty { "hogar.json" })
        }.getOrNull()
    }

    private fun saveCfg(c: Cfg?) {
        if (c == null) prefs.edit().remove("cfg").apply()
        else prefs.edit().putString("cfg", JSONObject().put("owner", c.owner).put("repo", c.repo).put("token", c.token).put("branch", c.branch).put("path", c.path).toString()).apply()
    }

    /** Guarda una configuración ya validada (migración desde la versión anterior). */
    fun restore(c: Cfg) { cfg = c; saveCfg(c); status.value = Status.IDLE }

    /* ---------- Ciclo de vida ---------- */

    fun foreground(on: Boolean) {
        pollJob?.cancel()
        if (on) {
            pollJob = scope.launch { while (isActive) { if (cfg != null) runSync(); delay(POLL_MS) } }
        } else if (Store.dirty && cfg != null) {
            scope.launch { runSync() }
        }
    }

    fun schedule(ms: Long = 1200) {
        if (cfg == null) return
        debounceJob?.cancel()
        debounceJob = scope.launch { delay(ms); runSync() }
    }

    fun syncNow() { scope.launch { runSync() } }

    /* ---------- Red ---------- */

    private class Resp(val code: Int, val body: String, val etag: String?, val rateRemaining: String?)

    private suspend fun api(method: String, path: String, body: JSONObject? = null, headers: Map<String, String> = emptyMap(), c: Cfg? = cfg): Resp =
        withContext(Dispatchers.IO) {
            val conf = c ?: throw SyncException("Sin configurar")
            try {
                val conn = (URL(API + path).openConnection() as HttpURLConnection).apply {
                    requestMethod = method
                    connectTimeout = 15_000
                    readTimeout = 30_000
                    useCaches = false
                    setRequestProperty("Accept", "application/vnd.github+json")
                    setRequestProperty("Authorization", "Bearer ${conf.token}")
                    setRequestProperty("X-GitHub-Api-Version", "2022-11-28")
                    setRequestProperty("User-Agent", "Hogar-Android")
                    headers.forEach { (k, v) -> setRequestProperty(k, v) }
                    if (body != null) {
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                        outputStream.use { it.write(body.toString().toByteArray()) }
                    }
                }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
                Resp(code, text, conn.getHeaderField("ETag"), conn.getHeaderField("x-ratelimit-remaining")).also { conn.disconnect() }
            } catch (e: SyncException) {
                throw e
            } catch (e: Exception) {
                throw SyncException("Sin conexión con GitHub.", offline = true)
            }
        }

    private fun httpError(r: Resp, context: String = ""): SyncException = when (r.code) {
        401 -> SyncException("El token no es válido o ha caducado. Crea uno nuevo y vuelve a conectar.")
        403, 429 -> if (r.rateRemaining == "0" || r.code == 429) SyncException("GitHub ha limitado las peticiones. Se reintentará en unos minutos.")
            else SyncException("El token no tiene permiso para escribir en el repositorio (Contents: Read and write).")
        404 -> SyncException("No se encuentra el repositorio$context. Comprueba el nombre y que el token tenga acceso.")
        else -> SyncException("Error de GitHub (${r.code})")
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")
    private fun contentsPath(c: Cfg) = "/repos/${enc(c.owner)}/${enc(c.repo)}/contents/" + c.path.split('/').joinToString("/") { enc(it) }

    private class Pulled(val unchanged: Boolean = false, val missing: Boolean = false, val data: JSONObject? = null)

    private suspend fun pull(c: Cfg): Pulled {
        val q = if (c.branch.isNotEmpty()) "?ref=${enc(c.branch)}" else ""
        val headers = if (etag != null && sha != null) mapOf("If-None-Match" to etag!!) else emptyMap()
        val r = api("GET", contentsPath(c) + q, headers = headers)
        if (r.code == 304) return Pulled(unchanged = true)
        if (r.code == 404) { sha = null; etag = null; return Pulled(missing = true) }
        if (r.code !in 200..299) throw httpError(r)
        val j = JSONObject(r.body)
        var content = j.optString("content")
        if (content.isEmpty() && j.optLong("size") > 0) {
            val b = api("GET", "/repos/${enc(c.owner)}/${enc(c.repo)}/git/blobs/${j.getString("sha")}")
            if (b.code !in 200..299) throw httpError(b)
            content = JSONObject(b.body).optString("content")
        }
        sha = j.optString("sha")
        etag = r.etag
        val text = if (content.isNotEmpty()) String(Base64.getMimeDecoder().decode(content), Charsets.UTF_8) else ""
        val data = if (text.isNotBlank()) runCatching { JSONObject(text) }.getOrElse { throw SyncException("El archivo de datos en GitHub está dañado.") } else null
        return Pulled(data = data)
    }

    /** Devuelve false si hubo conflicto (otro dispositivo escribió antes). */
    private suspend fun push(c: Cfg): Boolean {
        val who = D.member(Store.me)?.str("name")
        val body = JSONObject()
            .put("message", "Actualizar datos" + (if (who != null) " ($who, Android)" else " (Android)"))
            .put("content", Base64.getEncoder().encodeToString(Store.exportJson().toByteArray(Charsets.UTF_8)))
        sha?.let { body.put("sha", it) }
        if (c.branch.isNotEmpty()) body.put("branch", c.branch)
        val r = api("PUT", contentsPath(c), body)
        if (r.code == 409 || r.code == 422) return false
        if (r.code !in 200..299) throw httpError(r)
        sha = JSONObject(r.body).optJSONObject("content")?.optString("sha")
        etag = null
        return true
    }

    private suspend fun runSync() {
        val c = cfg ?: return
        if (busy) { again = true; return }
        busy = true
        status.value = Status.SYNCING
        try {
            var done = false
            var attempt = 0
            while (attempt < 4 && !done) {
                attempt++
                val remote = pull(c)
                var needPush = Store.dirty || remote.missing
                if (remote.data != null) needPush = Store.merge(remote.data) || needPush
                if (!needPush) { done = true; break }
                val rev = Store.rev
                if (push(c)) {
                    if (Store.rev == rev) Store.dirty = false
                    done = true
                } else etag = null
            }
            if (!done) throw SyncException("Otro dispositivo está guardando a la vez. Se reintentará enseguida.")
            lastSync = System.currentTimeMillis()
            prefs.edit().putLong("lastSync", lastSync).apply()
            error = null
            status.value = Status.IDLE
        } catch (e: SyncException) {
            error = e.message
            status.value = if (e.offline) Status.OFFLINE else Status.ERROR
        } catch (e: Exception) {
            error = e.message ?: e.toString()
            status.value = Status.ERROR
        } finally {
            busy = false
            if (again) { again = false; scope.launch { runSync() } }
        }
    }

    /* ---------- Conectar, unirse, desconectar ---------- */

    fun parseRepo(owner: String, repo: String): Pair<String, String> {
        var o = owner.trim(); var r = repo.trim()
        val m = Regex("github\\.com/([^/\\s]+)/([^/\\s#?]+)", RegexOption.IGNORE_CASE).find(o)
        if (m != null) { o = m.groupValues[1]; if (r.isEmpty()) r = m.groupValues[2] }
        else if (o.contains('/') && r.isEmpty()) { val p = o.split('/'); o = p[0]; r = p.getOrElse(1) { "" } }
        return o.removePrefix("@") to r.removeSuffix(".git")
    }

    /** Comprueba el acceso y guarda la configuración. Lanza errores legibles. */
    suspend fun connect(raw: Cfg) {
        val (o, r) = parseRepo(raw.owner, raw.repo)
        val c = Cfg(o, r, raw.token.trim(), raw.branch.trim(), raw.path.trim().trimStart('/').ifEmpty { "hogar.json" })
        if (c.owner.isEmpty() || c.repo.isEmpty()) throw SyncException("Indica el usuario y el nombre del repositorio.")
        if (c.token.isEmpty()) throw SyncException("Falta el token de acceso.")
        val res = api("GET", "/repos/${enc(c.owner)}/${enc(c.repo)}", c = c)
        if (res.code !in 200..299) throw httpError(res, " «${c.owner}/${c.repo}»")
        if (!JSONObject(res.body).optBoolean("private")) {
            throw SyncException("Ese repositorio es público y cualquiera podría ver los datos de tu casa. Usa un repositorio privado.")
        }
        cfg = c
        etag = null; sha = null
        saveCfg(c)
        Store.dirty = true
        runSync()
        if (status.value == Status.ERROR) throw SyncException(error ?: "Error de sincronización")
    }

    fun disconnect() {
        cfg = null; etag = null; sha = null
        saveCfg(null)
        status.value = Status.OFF
    }

    /** Código para que otro dispositivo se una (mismo formato que la web app). */
    fun shareCode(): String {
        val c = cfg ?: return ""
        val p = JSONObject().put("v", 1).put("o", c.owner).put("r", c.repo).put("t", c.token)
        if (c.branch.isNotEmpty()) p.put("b", c.branch)
        if (c.path != "hogar.json") p.put("p", c.path)
        return Base64.getEncoder().encodeToString(p.toString().toByteArray()).replace('+', '-').replace('/', '_').trimEnd('=')
    }

    fun decodeCode(code: String): Cfg {
        var s = code.trim()
        Regex("join=([A-Za-z0-9_\\-+/=%]+)").find(s)?.let { s = java.net.URLDecoder.decode(it.groupValues[1], "UTF-8") }
        s = s.replace(Regex("\\s"), "").replace('-', '+').replace('_', '/')
        while (s.length % 4 != 0) s += "="
        return try {
            val p = JSONObject(String(Base64.getDecoder().decode(s), Charsets.UTF_8))
            Cfg(p.getString("o"), p.getString("r"), p.getString("t"), p.optString("b"), p.optString("p", "hogar.json").ifEmpty { "hogar.json" })
        } catch (e: Exception) {
            throw SyncException("El código no es válido. Cópialo de nuevo desde Ajustes en otro dispositivo de la casa.")
        }
    }

    fun statusText(): String {
        if (cfg == null) return "Solo en este dispositivo"
        return when (status.value) {
            Status.SYNCING -> "Sincronizando…"
            Status.ERROR -> error ?: "Error de sincronización"
            Status.OFFLINE -> "Sin conexión: se sincronizará al volver"
            else -> if (lastSync > 0) "Sincronizado ${timeAgo(lastSync)}" else "Conectado"
        }
    }
}
