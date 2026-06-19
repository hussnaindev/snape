plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.snape.flix"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.snape.flix"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        // Prefer the injected property/secret, but fall back to the committed
        // production mobile key so CI never ships an empty key (an unset secret
        // expands to "" and would otherwise clobber the default → LD init skipped
        // → no events). Mobile keys are not secret per LaunchDarkly's docs.
        val key = (project.findProperty("LAUNCHDARKLY_MOBILE_KEY") as String?)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: "mob-87b917f3-6572-4e30-8474-1edee58b7cfc"
        buildConfigField("String", "LAUNCHDARKLY_MOBILE_KEY", "\"$key\"")
    }

    buildTypes {
        release {
            // Non-debuggable build: ART runs the app fully optimized and the
            // Compose runtime drops its debug composition-tracking overhead, so
            // scrolling is dramatically smoother than a debug build. Minify stays
            // off to keep streaming/serialization behaviour identical for now.
            isMinifyEnabled = false
            // Sign with the auto-generated debug keystore so the release APK is
            // installable straight from CI without managing signing secrets.
            signingConfig = signingConfigs.getByName("debug")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
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
    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.02")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")
    // SVG decoder so the bundled provider logos (Netflix/Max/…) render as vectors.
    implementation("io.coil-kt:coil-svg:2.7.0")

    implementation("com.launchdarkly:launchdarkly-android-client-sdk:5.5.0")

    val media3 = "1.4.1"
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-exoplayer-dash:$media3")
    // HLS source: the BFF serves some audio variants (e.g. the un-dubbed
    // original) as HLS, not DASH — without this module ExoPlayer can't build an
    // HLS MediaSource and those variants fail to play. (MP4/progressive is
    // built into media3-exoplayer.)
    implementation("androidx.media3:media3-exoplayer-hls:$media3")
    implementation("androidx.media3:media3-ui:$media3")
    // Offline downloads: StandaloneDatabaseProvider lives in media3-database; the
    // SimpleCache / CacheDataSource / DownloadManager / DownloadService classes
    // come transitively via media3-datasource + media3-exoplayer.
    implementation("androidx.media3:media3-database:$media3")
}
