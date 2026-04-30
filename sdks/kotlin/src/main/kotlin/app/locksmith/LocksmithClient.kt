package app.locksmith

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.module.kotlin.kotlinModule
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.security.KeyFactory
import java.security.interfaces.RSAPublicKey
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

class LocksmithException(val code: String, message: String, val status: Int) : Exception(message)

class LocksmithClient(
    private val apiKey: String,
    baseUrl: String = DEFAULT_BASE,
) {
    private val base = baseUrl.trimEnd('/')
    val environment: String = environmentFromApiKey(apiKey)

    private val http = HttpClient.newBuilder().build()
    private val json = ObjectMapper().registerModule(kotlinModule())

    companion object {
        const val DEFAULT_BASE = "https://uselocksmith.app"
        private const val ISSUER = "https://uselocksmith.app"

        fun environmentFromApiKey(key: String): String = when {
            key.startsWith("lsm_live_") -> "production"
            key.startsWith("lsm_sbx_") -> "sandbox"
            else -> throw IllegalArgumentException("Invalid Locksmith API key.")
        }

        fun verifyToken(accessToken: String, publicKeyPem: String) = JWT.require(
            Algorithm.RSA256(pemToRsa(publicKeyPem), null),
        ).withIssuer(ISSUER).build().verify(accessToken)

        private fun pemToRsa(pem: String): RSAPublicKey {
            val stripped = pem.replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replace("\\s".toRegex(), "")
            val spec = X509EncodedKeySpec(Base64.getDecoder().decode(stripped))
            return KeyFactory.getInstance("RSA").generatePublic(spec) as RSAPublicKey
        }
    }

    private fun url(path: String): String {
        val p = if (path.startsWith("/")) path else "/$path"
        return base + p
    }

    private fun envelope(res: HttpResponse<String>): JsonNode {
        val root = json.readTree(if (res.body().isNullOrEmpty()) "{}" else res.body())
        val sc = res.statusCode()
        if (sc !in 200..299) {
            throw LocksmithException(
                root.path("error").asText("unknown_error"),
                root.path("message").asText("error"),
                sc,
            )
        }
        if (!root.has("data")) throw LocksmithException("invalid_response", "Expected { data }", sc)
        return root["data"]
    }

    private fun post(path: String, node: ObjectNode): JsonNode {
        val req = HttpRequest.newBuilder(URI.create(url(path)))
            .header("X-API-Key", apiKey)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(node)))
            .build()
        return envelope(http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)))
    }

    private fun get(path: String, extra: List<Pair<String, String>> = emptyList()): JsonNode {
        val b = HttpRequest.newBuilder(URI.create(url(path)))
            .GET()
            .header("X-API-Key", apiKey)
        extra.forEach { (k, v) -> b.header(k, v) }
        return envelope(http.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)))
    }

    private fun getAbsolute(fullUrl: String): JsonNode {
        val req = HttpRequest.newBuilder(URI.create(fullUrl)).GET().build()
        return envelope(http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)))
    }

    fun signUp(email: String, password: String, meta: JsonNode? = null): JsonNode {
        val o = json.createObjectNode().put("email", email).put("password", password)
        if (meta != null && !meta.isNull) {
            o.replace("meta", meta)
        }
        return post("/api/auth/signup", o)
    }

    fun signIn(email: String, password: String): JsonNode {
        val o = json.createObjectNode().put("email", email).put("password", password)
        return post("/api/auth/login", o)
    }

    fun signOut(refreshToken: String) {
        post("/api/auth/logout", json.createObjectNode().put("refreshToken", refreshToken))
    }

    fun refresh(refreshToken: String): JsonNode =
        post("/api/auth/refresh", json.createObjectNode().put("refreshToken", refreshToken))

    fun getUser(accessToken: String): JsonNode =
        get("/api/auth/me", listOf("Authorization" to "Bearer $accessToken")).get("user")

    fun sendMagicLink(email: String, createIfNotExists: Boolean? = null) {
        val o = json.createObjectNode().put("email", email)
        createIfNotExists?.let { o.put("createIfNotExists", it) }
        post("/api/auth/magic-link", o)
    }

    fun verifyMagicLink(token: String, projectId: String): JsonNode {
        val q =
            "token=" + URLEncoder.encode(token, StandardCharsets.UTF_8) +
                "&project=" + URLEncoder.encode(projectId, StandardCharsets.UTF_8)
        return getAbsolute(url("/api/auth/magic-link/verify") + "?" + q)
    }

    fun sendPasswordReset(email: String) {
        post("/api/auth/password/reset", json.createObjectNode().put("email", email))
    }

    fun updatePassword(token: String, newPassword: String) {
        val o = json.createObjectNode().put("token", token).put("newPassword", newPassword)
        post("/api/auth/password/update", o)
    }

    fun initiateOAuth(provider: String, redirectUrl: String? = null): JsonNode {
        val o = json.createObjectNode()
        if (!redirectUrl.isNullOrBlank()) {
            o.put("redirectUrl", redirectUrl)
        }
        val enc = URLEncoder.encode(provider, StandardCharsets.UTF_8).replace("+", "%20")
        return post("/api/auth/oauth/$enc", o)
    }

    fun exchangeOAuthCode(code: String): JsonNode =
        post("/api/auth/oauth/token", json.createObjectNode().put("code", code))

    fun completeOidcGrant(
        requestToken: String,
        approved: Boolean,
        userId: String? = null,
        scopes: JsonNode? = null,
    ): JsonNode {
        val o = json.createObjectNode()
            .put("requestToken", requestToken)
            .put("approved", approved)
        if (!userId.isNullOrBlank()) {
            o.put("userId", userId)
        }
        if (scopes != null && scopes.isArray) {
            o.replace("scopes", scopes)
        }
        return post("/api/auth/oidc/grant", o)
    }
}
