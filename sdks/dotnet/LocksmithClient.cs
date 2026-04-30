using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace Locksmith;

public sealed class LocksmithException : Exception
{
    public string Code { get; }
    public int Status { get; }

    public LocksmithException(string code, string message, int status) : base(message)
    {
        Code = code;
        Status = status;
    }
}

public enum LocksmithEnvironment
{
    Production,
    Sandbox,
}

public static class ApiKey
{
    public static LocksmithEnvironment EnvironmentFromKey(string apiKey)
    {
        if (apiKey.StartsWith("lsm_live_", StringComparison.Ordinal)) return LocksmithEnvironment.Production;
        if (apiKey.StartsWith("lsm_sbx_", StringComparison.Ordinal)) return LocksmithEnvironment.Sandbox;
        throw new ArgumentException("Invalid Locksmith API key: expected lsm_live_ or lsm_sbx_ prefix.", nameof(apiKey));
    }
}

public sealed class LocksmithClient : IDisposable
{
    public const string DefaultBaseUrl = "https://getlocksmith.dev";
    private const string Issuer = "https://getlocksmith.dev";

    private readonly HttpClient _http;
    private readonly string _baseUrl;
    private readonly string _apiKey;
    private readonly JsonSerializerOptions _json;
    private readonly bool _ownsClient;

    public LocksmithEnvironment Environment { get; }

    public LocksmithClient(string apiKey, string? baseUrl = null, HttpClient? httpClient = null)
    {
        Environment = ApiKey.EnvironmentFromKey(apiKey);
        _apiKey = apiKey;
        _baseUrl = (baseUrl ?? DefaultBaseUrl).TrimEnd('/');
        _json = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        if (httpClient is null)
        {
            _http = new HttpClient();
            _ownsClient = true;
        }
        else
        {
            _http = httpClient;
            _ownsClient = false;
        }
    }

    public void Dispose()
    {
        if (_ownsClient)
            _http.Dispose();
    }

    private string Url(string path)
    {
        var p = path.StartsWith('/') ? path : "/" + path;
        return _baseUrl + p;
    }

    private async Task<JsonElement> PostJsonAsync(string path, object body, CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(body, _json);
        using var req = new HttpRequestMessage(HttpMethod.Post, Url(path))
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
        };
        req.Headers.TryAddWithoutValidation("X-API-Key", _apiKey);
        return await HttpEnvelopeAsync(req, ct).ConfigureAwait(false);
    }

    private async Task<JsonElement> HttpEnvelopeAsync(HttpRequestMessage req, CancellationToken ct)
    {
        if (!req.Headers.Contains("X-API-Key"))
            req.Headers.TryAddWithoutValidation("X-API-Key", _apiKey);

        using var res = await _http.SendAsync(req, ct).ConfigureAwait(false);
        await using var stream = await res.Content.ReadAsStreamAsync(ct).ConfigureAwait(false);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct).ConfigureAwait(false);
        var root = doc.RootElement.Clone();

        if (!res.IsSuccessStatusCode)
        {
            var code = root.TryGetProperty("error", out var e) ? e.GetString() ?? "unknown_error" : "unknown_error";
            var msg = root.TryGetProperty("message", out var m)
                ? m.GetString() ?? res.ReasonPhrase ?? "error"
                : res.ReasonPhrase ?? "error";
            throw new LocksmithException(code, msg, (int)res.StatusCode);
        }

        if (!root.TryGetProperty("data", out var data))
            throw new LocksmithException("invalid_response", "Expected envelope { data }", (int)res.StatusCode);

        return data.Clone();
    }

    public Task<JsonElement> SignUpAsync(string email, string password, JsonElement? meta = null, CancellationToken ct = default)
    {
        var dict = new Dictionary<string, object?> { ["email"] = email, ["password"] = password };
        if (meta is { ValueKind: not JsonValueKind.Null and not JsonValueKind.Undefined })
            dict["meta"] = meta;
        return PostJsonAsync("/api/auth/signup", dict, ct);
    }

    public Task<JsonElement> SignInAsync(string email, string password, CancellationToken ct = default) =>
        PostJsonAsync("/api/auth/login", new { email, password }, ct);

    public async Task SignOutAsync(string refreshToken, CancellationToken ct = default)
    {
        _ = await PostJsonAsync("/api/auth/logout", new { refreshToken }, ct).ConfigureAwait(false);
    }

    public Task<JsonElement> RefreshAsync(string refreshToken, CancellationToken ct = default) =>
        PostJsonAsync("/api/auth/refresh", new { refreshToken }, ct);

    public async Task<JsonElement> GetUserAsync(string accessToken, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, Url("/api/auth/me"));
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var data = await HttpEnvelopeAsync(req, ct).ConfigureAwait(false);
        return data.GetProperty("user");
    }

    public static JwtSecurityToken VerifyToken(string accessToken, string publicKeyPem)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(publicKeyPem);
        var key = new RsaSecurityKey(rsa);

        var parms = new TokenValidationParameters
        {
            ValidIssuer = Issuer,
            ValidateIssuer = true,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
        };

        var handler = new JwtSecurityTokenHandler();
        handler.ValidateToken(accessToken, parms, out var token);
        return (JwtSecurityToken)token;
    }

    public async Task SendMagicLinkAsync(string email, bool? createIfNotExists = null, CancellationToken ct = default)
    {
        object body = createIfNotExists is null
            ? new { email }
            : new { email, createIfNotExists };
        _ = await PostJsonAsync("/api/auth/magic-link", body, ct).ConfigureAwait(false);
    }

    public async Task<JsonElement> VerifyMagicLinkAsync(string token, string projectId, CancellationToken ct = default)
    {
        var qs = $"token={Uri.EscapeDataString(token)}&project={Uri.EscapeDataString(projectId)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, Url("/api/auth/magic-link/verify") + "?" + qs);
        return await HttpEnvelopeAsync(req, ct).ConfigureAwait(false);
    }

    public async Task SendPasswordResetAsync(string email, CancellationToken ct = default)
    {
        _ = await PostJsonAsync("/api/auth/password/reset", new { email }, ct).ConfigureAwait(false);
    }

    public async Task UpdatePasswordAsync(string token, string newPassword, CancellationToken ct = default)
    {
        _ = await PostJsonAsync("/api/auth/password/update", new { token, newPassword }, ct).ConfigureAwait(false);
    }

    public Task<JsonElement> InitiateOAuthAsync(string provider, string? redirectUrl = null, CancellationToken ct = default)
    {
        var body = new Dictionary<string, object?>();
        if (!string.IsNullOrEmpty(redirectUrl))
            body["redirectUrl"] = redirectUrl;
        var enc = Uri.EscapeDataString(provider);
        return PostJsonAsync($"/api/auth/oauth/{enc}", body, ct);
    }

    public Task<JsonElement> ExchangeOAuthCodeAsync(string code, CancellationToken ct = default) =>
        PostJsonAsync("/api/auth/oauth/token", new { code }, ct);

    public Task<JsonElement> CompleteOidcGrantAsync(
        string requestToken,
        bool approved,
        string? userId = null,
        string[]? scopes = null,
        CancellationToken ct = default)
    {
        var dict = new Dictionary<string, object?> {
            ["requestToken"] = requestToken,
            ["approved"] = approved,
        };
        if (userId != null)
            dict["userId"] = userId;
        if (scopes is { Length: > 0 })
            dict["scopes"] = scopes;
        return PostJsonAsync("/api/auth/oidc/grant", dict, ct);
    }
}
