plugins {
    kotlin("jvm") version "2.0.21"
    java
}

group = "app.locksmith"
version = "0.1.0"

repositories { mavenCentral() }

dependencies {
    implementation(kotlin("stdlib"))
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.17.2")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
    implementation("com.auth0:java-jwt:4.4.0")
}

java { toolchain { languageVersion.set(JavaLanguageVersion.of(17)) } }

kotlin { jvmToolchain(17) }
