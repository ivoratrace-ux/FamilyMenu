import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl

plugins {
    kotlin("multiplatform")
    kotlin("plugin.serialization")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.compose")
    id("com.android.application")
}

kotlin {
    androidTarget { compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
    jvm("desktop") { compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
    listOf(iosArm64(), iosSimulatorArm64(), iosX64()).forEach {
        it.binaries.framework { baseName = "FamilyMenu"; isStatic = true }
    }
    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        browser { commonWebpackConfig { outputFileName = "family-menu.js" } }
        binaries.executable()
    }
    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.components.resources)
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
            // Compose resources 1.9.1 still reference the pre-0.7 Clock/Instant ABI.
            // Ktor 3.3 resolves datetime 0.7.1; use its supported compatibility build on all targets.
            implementation("org.jetbrains.kotlinx:kotlinx-datetime") {
                version { strictly("0.7.1-0.6.x-compat") }
            }
            implementation("io.ktor:ktor-client-core:3.3.0")
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
            implementation("io.ktor:ktor-client-mock:3.3.0")
        }
        androidMain.dependencies {
            implementation("androidx.activity:activity-compose:1.10.1")
            implementation("androidx.exifinterface:exifinterface:1.4.1")
            implementation("io.ktor:ktor-client-okhttp:3.3.0")
        }
        iosMain.dependencies { implementation("io.ktor:ktor-client-darwin:3.3.0") }
        wasmJsMain.dependencies { implementation("io.ktor:ktor-client-js:3.3.0") }
        val desktopTest by getting { resources.srcDir("../backend/data") }
        val desktopMain by getting {
            dependencies {
                implementation(compose.desktop.currentOs)
                implementation("io.ktor:ktor-client-cio:3.3.0")
            }
        }
    }
}
android {
    namespace = "com.familymenu.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.familymenu.app"
        minSdk = 26
        targetSdk = 35
        versionCode = providers.gradleProperty("buildNumber").orElse(providers.environmentVariable("GITHUB_RUN_NUMBER")).orElse("1").get().toInt()
        versionName = "0.2.0"
    }
    signingConfigs {
        getByName("debug") {
            // Public development key from the scanner project; never use for release builds.
            storeFile = file("signing/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
compose.resources { publicResClass = true; packageOfResClass = "familymenu.resources" }

tasks.withType<JavaCompile>().configureEach {
    sourceCompatibility = "17"
    targetCompatibility = "17"
}
