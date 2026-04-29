package app.locksmith;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.security.KeyFactory;
import java.util.Base64;
import java.util.Map;

/** Client for the public Locksmith <code>/api/auth/*</code> API. */
public final class LocksmithClient implements AutoCloseable {

  public static final String DEFAULT_BASE = "https://uselocksmith.app";
  private static final String ISSUER = "https://uselocksmith.app";

  private static final ObjectMapper JSON = new ObjectMapper();

  private final HttpClient http = HttpClient.newBuilder().build();
  private final String apiKey;
  private final String baseUrl;
  public final String environment;

  public LocksmithClient(String apiKey) {
    this(apiKey, DEFAULT_BASE);
  }

  public LocksmithClient(String apiKey, String baseUrl) {
    this.apiKey = apiKey;
    this.environment = environmentFromApiKey(apiKey);
    this.baseUrl = baseUrl.replaceAll("/+$", "");
  }

  public static String environmentFromApiKey(String apiKey) {
    if (apiKey.startsWith("lsm_live_")) return "production";
    if (apiKey.startsWith("lsm_sbx_")) return "sandbox";
    throw new IllegalArgumentException("Invalid Locksmith API key: expected lsm_live_ or lsm_sbx_ prefix.");
  }

  private String url(String path) {
    String p = path.startsWith("/") ? path : "/" + path;
    return baseUrl + p;
  }

  private JsonNode post(String path, ObjectNode body) throws Exception {
    String json = JSON.writeValueAsString(body);
    var req = HttpRequest.newBuilder()
        .uri(URI.create(url(path)))
        .header("X-API-Key", apiKey)
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(json))
        .build();
    return envelope(http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)));
  }

  private JsonNode get(String path, Map<String, String> headers) throws Exception {
    var b = HttpRequest.newBuilder().uri(URI.create(url(path))).GET();
    b.header("X-API-Key", apiKey);
    headers.forEach(b::header);
    return envelope(http.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)));
  }

  private JsonNode getNoKey(String fullUrl) throws Exception {
    var req = HttpRequest.newBuilder().uri(URI.create(fullUrl)).GET().build();
    var res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    return envelope(res);
  }

  private JsonNode envelope(HttpResponse<String> res) throws LocksmithException, com.fasterxml.jackson.core.JsonProcessingException {
    JsonNode root = JSON.readTree(res.body() == null || res.body().isEmpty() ? "{}" : res.body());
    int code = res.statusCode();
    if (code < 200 || code >= 300) {
      throw new LocksmithException(
          root.path("error").asText("unknown_error"),
          root.path("message").asText("Request failed"),
          code);
    }
    if (!root.has("data")) {
      throw new LocksmithException("invalid_response", "Expected envelope { data }", code);
    }
    return root.get("data");
  }

  public JsonNode signUp(String email, String password, JsonNode meta) throws Exception {
    var o = JSON.createObjectNode().put("email", email).put("password", password);
    if (meta != null && !meta.isNull()) o.set("meta", meta);
    return post("/api/auth/signup", o);
  }

  public JsonNode signUp(String email, String password) throws Exception {
    return signUp(email, password, null);
  }

  public JsonNode signIn(String email, String password) throws Exception {
    var o = JSON.createObjectNode().put("email", email).put("password", password);
    return post("/api/auth/login", o);
  }

  public void signOut(String refreshToken) throws Exception {
    post("/api/auth/logout", JSON.createObjectNode().put("refreshToken", refreshToken));
  }

  public JsonNode refresh(String refreshToken) throws Exception {
    return post("/api/auth/refresh", JSON.createObjectNode().put("refreshToken", refreshToken));
  }

  public JsonNode getUser(String accessToken) throws Exception {
    var data = get("/api/auth/me", Map.of("Authorization", "Bearer " + accessToken));
    return data.get("user");
  }

  /** Verify RS256 access token locally with the project's PEM public key. */
  public static DecodedJWT verifyToken(String accessToken, String publicKeyPem) throws Exception {
    RSAPublicKey pub = pemToRsaPublicKey(publicKeyPem);
    Algorithm alg = Algorithm.RSA256(pub, null);
    return JWT.require(alg).withIssuer(ISSUER).build().verify(accessToken);
  }

  private static RSAPublicKey pemToRsaPublicKey(String pem) throws Exception {
    String stripped = pem
        .replace("-----BEGIN PUBLIC KEY-----", "")
        .replace("-----END PUBLIC KEY-----", "")
        .replaceAll("\\s", "");
    byte[] decoded = Base64.getDecoder().decode(stripped);
    X509EncodedKeySpec spec = new X509EncodedKeySpec(decoded);
    return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(spec);
  }

  public void sendMagicLink(String email, Boolean createIfNotExists) throws Exception {
    var o = JSON.createObjectNode().put("email", email);
    if (createIfNotExists != null) o.put("createIfNotExists", createIfNotExists);
    post("/api/auth/magic-link", o);
  }

  public JsonNode verifyMagicLink(String token, String projectId) throws Exception {
    String q = "token=" + java.net.URLEncoder.encode(token, StandardCharsets.UTF_8)
        + "&project=" + java.net.URLEncoder.encode(projectId, StandardCharsets.UTF_8);
    return getNoKey(url("/api/auth/magic-link/verify") + "?" + q);
  }

  public void sendPasswordReset(String email) throws Exception {
    post("/api/auth/password/reset", JSON.createObjectNode().put("email", email));
  }

  public void updatePassword(String token, String newPassword) throws Exception {
    post("/api/auth/password/update",
        JSON.createObjectNode().put("token", token).put("newPassword", newPassword));
  }

  @Override
  public void close() {
    // HttpClient has no close
  }
}
