package io.github.marcoh03.hogar.data

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

/**
 * La versión anterior de la app de Android era la web app dentro de un WebView
 * (origen https://localhost). Al actualizar a la app nativa, se leen una sola vez
 * sus datos guardados en ese WebView (casa, «quién soy» y la conexión con GitHub)
 * para que no haya que volver a configurar nada.
 */
object WebMigration {
    @SuppressLint("SetJavaScriptEnabled")
    fun run(ctx: Context, done: (Boolean) -> Unit) {
        val prefs = ctx.getSharedPreferences("hogar", Context.MODE_PRIVATE)
        if (prefs.getBoolean("webMigrationDone", false) || Store.hasLocalFile || Store.onboarded) { done(false); return }
        val handler = Handler(Looper.getMainLooper())
        var finished = false
        lateinit var web: WebView
        fun finish(migrated: Boolean) {
            if (finished) return
            finished = true
            prefs.edit().putBoolean("webMigrationDone", true).apply()
            runCatching { web.destroy() }
            done(migrated)
        }
        try {
            web = WebView(ctx)
            web.settings.javaScriptEnabled = true
            web.settings.domStorageEnabled = true
            web.webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse =
                    WebResourceResponse("text/html", "utf-8", "<html><body></body></html>".byteInputStream())

                override fun onPageFinished(view: WebView, url: String) {
                    val js = "JSON.stringify({d:localStorage.getItem('hogar:data'),m:localStorage.getItem('hogar:meta'),s:localStorage.getItem('hogar:sync')})"
                    view.evaluateJavascript(js) { raw -> finish(apply(raw)) }
                }
            }
            web.loadUrl("https://localhost/")
            handler.postDelayed({ finish(false) }, 4000)
        } catch (e: Throwable) {
            finish(false)
        }
    }

    /** raw es una cadena JSON entrecomillada (lo que devuelve evaluateJavascript). */
    private fun apply(raw: String?): Boolean = runCatching {
        if (raw == null || raw == "null") return false
        val outer = JSONObject(JSONObject("{\"v\":$raw}").getString("v"))
        val data = outer.optString("d").takeIf { it.isNotEmpty() && it != "null" } ?: return false
        Store.replaceAll(JSONObject(data))
        outer.optString("m").takeIf { it.isNotEmpty() && it != "null" }?.let {
            val m = JSONObject(it)
            if (m.has2("me")) Store.me = m.optString("me")
            Store.dirty = m.optBoolean("dirty", false)
            Store.onboarded = m.optBoolean("onboarded", D.members().isNotEmpty())
        }
        outer.optString("s").takeIf { it.isNotEmpty() && it != "null" }?.let {
            val s = JSONObject(it)
            Sync.restore(Sync.Cfg(s.getString("owner"), s.getString("repo"), s.getString("token"), s.optString("branch"), s.optString("path", "hogar.json").ifEmpty { "hogar.json" }))
        }
        true
    }.getOrDefault(false)
}
