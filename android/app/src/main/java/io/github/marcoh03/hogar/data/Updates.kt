package io.github.marcoh03.hogar.data

import io.github.marcoh03.hogar.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONArray

/** Comprueba si hay un APK más nuevo publicado en GitHub Releases («android-N»). */
object Updates {
    data class Info(val build: Int, val url: String)

    val latest = MutableStateFlow<Info?>(null)
    private var lastCheck = 0L

    suspend fun check(force: Boolean = false): Info? {
        if (!force && System.currentTimeMillis() - lastCheck < 6 * 3600_000L) return latest.value
        lastCheck = System.currentTimeMillis()
        val text = httpGet("https://api.github.com/repos/$REPO/releases?per_page=10", "application/vnd.github+json") ?: return latest.value
        val list = runCatching { JSONArray(text) }.getOrNull() ?: return latest.value
        for (i in 0 until list.length()) {
            val r = list.getJSONObject(i)
            val tag = r.optString("tag_name")
            if (r.optBoolean("draft") || !Regex("^android-\\d+$").matches(tag)) continue
            val n = tag.removePrefix("android-").toInt()
            val assets = r.optJSONArray("assets") ?: JSONArray()
            var url = r.optString("html_url")
            for (j in 0 until assets.length()) {
                val a = assets.getJSONObject(j)
                if (a.optString("name").endsWith(".apk")) url = a.optString("browser_download_url")
            }
            latest.value = if (n > BuildConfig.BUILD_NUMBER) Info(n, url) else null
            break
        }
        return latest.value
    }
}
