package io.github.marcoh03.hogar.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

const val PUBLIC_URL = "https://marcoh03.github.io/House_Management_App/"
const val REPO = "MarcoH03/House_Management_App"
const val APK_URL = "https://github.com/$REPO/releases/latest/download/Hogar.apk"

/** GET sencillo; devuelve null si falla. */
suspend fun httpGet(url: String, accept: String = "application/json"): String? = withContext(Dispatchers.IO) {
    runCatching {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 20_000
            useCaches = false
            setRequestProperty("Accept", accept)
            setRequestProperty("User-Agent", "Hogar-Android")
        }
        val text = if (conn.responseCode in 200..299) conn.inputStream.bufferedReader().use { it.readText() } else null
        conn.disconnect()
        text
    }.getOrNull()
}
