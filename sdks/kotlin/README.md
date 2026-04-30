# `locksmith-kotlin`

Official **Kotlin (JVM)** client for the [Locksmith](https://getlocksmith.dev) public auth API.

Group: `app.locksmith` (aligns with Maven Central publishing).

- **Docs:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)

## Install

Gradle:

```kotlin
dependencies {
    implementation("app.locksmith:locksmith-kotlin:0.1.0")
}
```

(Adjust artifact ID to match your published coordinates.)

## Requirements

- **JVM 17+**
- API key prefix `lsm_live_` or `lsm_sbx_`.

## Quick start

```kotlin
import app.locksmith.LocksmithClient
import com.fasterxml.jackson.databind.JsonNode

val c = LocksmithClient(System.getenv("LOCKSMITH_API_KEY")!!)
val data: JsonNode = c.signIn("user@example.com", "secure-password")
val access = data["accessToken"].asText()
val user = c.getUser(access)
```

## Local JWT verification

```kotlin
val jwt = LocksmithClient.verifyToken(accessToken, publicKeyPem)
```

## License

MIT
