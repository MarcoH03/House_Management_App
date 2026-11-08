plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// El workflow de GitHub pasa BUILD_NUMBER: cada APK tiene un número mayor y Android
// lo instala encima del anterior conservando los datos.
val buildNumber = (System.getenv("BUILD_NUMBER") ?: "1").toInt()

// Firma: el workflow descifra la llave con el secreto HOGAR_SIGNING_PASSWORD y pasa
// su ruta en HOGAR_KEYSTORE_FILE. Sin ellas (compilación local) se usa la de depuración.
val keystoreFile: String? = System.getenv("HOGAR_KEYSTORE_FILE")
val signingPassword: String? = System.getenv("HOGAR_SIGNING_PASSWORD")
val hasReleaseKey = !keystoreFile.isNullOrBlank() && !signingPassword.isNullOrBlank()

android {
    namespace = "io.github.marcoh03.hogar"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.marcoh03.hogar"
        minSdk = 26
        targetSdk = 35
        versionCode = buildNumber
        versionName = "2.0.$buildNumber"
        buildConfigField("int", "BUILD_NUMBER", "$buildNumber")
    }

    signingConfigs {
        create("release") {
            if (hasReleaseKey) {
                storeFile = file(keystoreFile!!)
                storePassword = signingPassword
                keyAlias = "hogar"
                keyPassword = signingPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName(if (hasReleaseKey) "release" else "debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            all { it.maxHeapSize = "3g" }
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // Pruebas en el ordenador (Robolectric): navegan por la app con datos de ejemplo
    // y guardan capturas de pantalla en app/build/screenshots.
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.14.1")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
