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
        const val DEFAULT_BASE = "https://getlocksmith.dev"
        private const val ISSUER = "https://getlocksmith.dev"

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

        fun tokenHasRole(jwt: com.auth0.jwt.interfaces.DecodedJWT, role: String): Boolean {
            val claim = jwt.getClaim("roles")
            if (!claim.isNull) {
                val list = claim.asList(String::class.java)
                if (list != null && list.contains(role)) return true
            }
            val legacy = jwt.getClaim("role").asString()
            return role == legacy
        }

        fun tokenHasPermission(jwt: com.auth0.jwt.interfaces.DecodedJWT, permission: String): Boolean {
            val claim = jwt.getClaim("permissions")
            if (claim.isNull) return false
            val list = claim.asList(String::class.java)
            return list != null && list.contains(permission)
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

    private fun patch(path: String, node: ObjectNode): JsonNode {
        val req = HttpRequest.newBuilder(URI.create(url(path)))
            .header("X-API-Key", apiKey)
            .header("Content-Type", "application/json")
            .method("PATCH", HttpRequest.BodyPublishers.ofString(json.writeValueAsString(node)))
            .build()
        return envelope(http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)))
    }

    private fun put(path: String, node: ObjectNode): JsonNode {
        val req = HttpRequest.newBuilder(URI.create(url(path)))
            .header("X-API-Key", apiKey)
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(node)))
            .build()
        return envelope(http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)))
    }

    private fun deleteReq(path: String): JsonNode {
        val req = HttpRequest.newBuilder(URI.create(url(path)))
            .header("X-API-Key", apiKey)
            .DELETE()
            .build()
        return envelope(http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)))
    }

    private fun postEmpty(path: String): JsonNode {
        val req = HttpRequest.newBuilder(URI.create(url(path)))
            .header("X-API-Key", apiKey)
            .POST(HttpRequest.BodyPublishers.noBody())
            .build()
        return envelope(http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)))
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

    fun listRoles(): JsonNode = get("/api/auth/rbac/roles").get("roles")

    fun getRole(roleId: String): JsonNode {
        val enc = URLEncoder.encode(roleId, StandardCharsets.UTF_8).replace("+", "%20")
        return get("/api/auth/rbac/roles/$enc").get("role")
    }

    fun createRole(
        name: String,
        description: String? = null,
        color: String? = null,
        isDefault: Boolean? = null,
    ): JsonNode {
        val o = json.createObjectNode().put("name", name)
        description?.let { o.put("description", it) }
        color?.let { o.put("color", it) }
        isDefault?.let { o.put("isDefault", it) }
        return post("/api/auth/rbac/roles", o).get("role")
    }

    fun updateRole(roleId: String, patch: ObjectNode): JsonNode {
        val enc = URLEncoder.encode(roleId, StandardCharsets.UTF_8).replace("+", "%20")
        return patch("/api/auth/rbac/roles/$enc", patch).get("role")
    }

    fun deleteRole(roleId: String) {
        val enc = URLEncoder.encode(roleId, StandardCharsets.UTF_8).replace("+", "%20")
        deleteReq("/api/auth/rbac/roles/$enc")
    }

    fun setRolePermissions(roleId: String, permissionIds: List<String>): JsonNode {
        val enc = URLEncoder.encode(roleId, StandardCharsets.UTF_8).replace("+", "%20")
        val arr = json.createArrayNode()
        permissionIds.forEach { arr.add(it) }
        val o = json.createObjectNode()
        o.set("permissionIds", arr)
        return put("/api/auth/rbac/roles/$enc/permissions", o).get("role")
    }

    fun listPermissions(): JsonNode = get("/api/auth/rbac/permissions").get("permissions")

    fun getPermission(permissionId: String): JsonNode {
        val enc = URLEncoder.encode(permissionId, StandardCharsets.UTF_8).replace("+", "%20")
        return get("/api/auth/rbac/permissions/$enc").get("permission")
    }

    fun createPermission(
        key: String,
        name: String,
        description: String? = null,
        category: String? = null,
    ): JsonNode {
        val o = json.createObjectNode().put("key", key).put("name", name)
        description?.let { o.put("description", it) }
        category?.let { o.put("category", it) }
        return post("/api/auth/rbac/permissions", o).get("permission")
    }

    fun updatePermission(permissionId: String, patch: ObjectNode): JsonNode {
        val enc = URLEncoder.encode(permissionId, StandardCharsets.UTF_8).replace("+", "%20")
        return patch("/api/auth/rbac/permissions/$enc", patch).get("permission")
    }

    fun deletePermission(permissionId: String) {
        val enc = URLEncoder.encode(permissionId, StandardCharsets.UTF_8).replace("+", "%20")
        deleteReq("/api/auth/rbac/permissions/$enc")
    }

    fun getUserRoles(userId: String): JsonNode {
        val enc = URLEncoder.encode(userId, StandardCharsets.UTF_8).replace("+", "%20")
        return get("/api/auth/rbac/users/$enc/roles").get("assignments")
    }

    fun assignRole(userId: String, roleId: String) {
        val u = URLEncoder.encode(userId, StandardCharsets.UTF_8).replace("+", "%20")
        val r = URLEncoder.encode(roleId, StandardCharsets.UTF_8).replace("+", "%20")
        postEmpty("/api/auth/rbac/users/$u/roles/$r")
    }

    fun revokeRole(userId: String, roleId: String) {
        val u = URLEncoder.encode(userId, StandardCharsets.UTF_8).replace("+", "%20")
        val r = URLEncoder.encode(roleId, StandardCharsets.UTF_8).replace("+", "%20")
        deleteReq("/api/auth/rbac/users/$u/roles/$r")
    }

    fun setUserRoles(userId: String, roleIds: List<String>): JsonNode {
        val enc = URLEncoder.encode(userId, StandardCharsets.UTF_8).replace("+", "%20")
        val arr = json.createArrayNode()
        roleIds.forEach { arr.add(it) }
        val o = json.createObjectNode()
        o.set("roleIds", arr)
        return put("/api/auth/rbac/users/$enc/roles", o).get("roles")
    }
}
