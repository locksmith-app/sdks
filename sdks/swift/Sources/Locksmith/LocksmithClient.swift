import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public enum LocksmithEnvironment: String, Sendable {
    case production
    case sandbox
}

public struct LocksmithError: Error, Sendable {
    public let code: String
    public let message: String
    public let status: Int
}

/// HTTP client for the Locksmith `/api/auth/*` API.
public final class LocksmithClient: @unchecked Sendable {
    public static let defaultBaseURL = "https://getlocksmith.dev"
    private static let issuer = "https://getlocksmith.dev"

    public let apiKey: String
    private let baseString: String
    public let environment: LocksmithEnvironment
    private let session: URLSession

    public init(apiKey: String, baseURL: String = LocksmithClient.defaultBaseURL) throws {
        self.apiKey = apiKey
        if apiKey.hasPrefix("lsm_live_") {
            environment = .production
        } else if apiKey.hasPrefix("lsm_sbx_") {
            environment = .sandbox
        } else {
            throw LocksmithError(code: "invalid_api_key", message: "Expected lsm_live_ or lsm_sbx_ prefix", status: 401)
        }
        baseString = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        session = URLSession.shared
    }

    private func fullURL(path: String) -> URL {
        let p = path.hasPrefix("/") ? path : "/" + path
        guard let u = URL(string: baseString + p) else {
            fatalError("bad url")
        }
        return u
    }

    /// Linux `URLSession` does not implement async `data(for:)`; use the completion-handler API.
    private func sessionData(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await withCheckedThrowingContinuation { continuation in
            session.dataTask(with: request) { data, response, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let data, let response else {
                    continuation.resume(throwing: URLError(.badServerResponse))
                    return
                }
                continuation.resume(returning: (data, response))
            }.resume()
        }
    }

    private func send(_ req: URLRequest, withApiKey: Bool) async throws -> Any {
        var r = req
        if withApiKey {
            r.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }
        let (data, res) = try await sessionData(for: r)
        let http = res as? HTTPURLResponse
        let status = http?.statusCode ?? 0
        let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard (200 ..< 300).contains(status) else {
            throw LocksmithError(
                code: obj["error"] as? String ?? "unknown_error",
                message: obj["message"] as? String ?? HTTPURLResponse.localizedString(forStatusCode: status),
                status: status
            )
        }
        guard let inner = obj["data"] else {
            throw LocksmithError(code: "invalid_response", message: "Expected data", status: status)
        }
        return inner
    }

    private func post(path: String, body: [String: Any], withApiKey: Bool = true) async throws -> Any {
        var req = URLRequest(url: fullURL(path: path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(req, withApiKey: withApiKey)
    }

    private func get(path: String, headers: [(String, String)] = [], withApiKey: Bool = true) async throws -> Any {
        var req = URLRequest(url: fullURL(path: path))
        req.httpMethod = "GET"
        headers.forEach { req.setValue($0.1, forHTTPHeaderField: $0.0) }
        return try await send(req, withApiKey: withApiKey)
    }

    public func signUp(email: String, password: String, meta: [String: Any]? = nil) async throws -> [String: Any] {
        var body: [String: Any] = ["email": email, "password": password]
        meta.map { body["meta"] = $0 }
        return try await post(path: "/api/auth/signup", body: body) as! [String: Any]
    }

    public func signIn(email: String, password: String) async throws -> [String: Any] {
        try await post(path: "/api/auth/login", body: ["email": email, "password": password]) as! [String: Any]
    }

    public func signOut(refreshToken: String) async throws {
        _ = try await post(path: "/api/auth/logout", body: ["refreshToken": refreshToken])
    }

    public func refresh(refreshToken: String) async throws -> [String: Any] {
        try await post(path: "/api/auth/refresh", body: ["refreshToken": refreshToken]) as! [String: Any]
    }

    public func getUser(accessToken: String) async throws -> [String: Any] {
        let data = try await get(path: "/api/auth/me", headers: [("Authorization", "Bearer \(accessToken)")]) as! [String: Any]
        return data["user"] as! [String: Any]
    }

    /// Decodes JWT payload and checks `iss`. Does **not** verify RS256 signature (add JOSE / Security when hardening).
    public static func decodeTokenPayload(_ jwt: String) throws -> [String: Any] {
        let parts = jwt.split(separator: ".")
        guard parts.count == 3 else {
            throw LocksmithError(code: "invalid_token", message: "Malformed JWT", status: 401)
        }
        var payloadB64 = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let pad = (4 - payloadB64.count % 4) % 4
        payloadB64 += String(repeating: "=", count: pad)
        guard let payloadData = Data(base64Encoded: payloadB64),
              let json = try JSONSerialization.jsonObject(with: payloadData) as? [String: Any]
        else {
            throw LocksmithError(code: "invalid_token", message: "Bad payload", status: 401)
        }
        guard json["iss"] as? String == issuer else {
            throw LocksmithError(code: "invalid_token", message: "Issuer mismatch", status: 401)
        }
        return json
    }

    public func sendMagicLink(email: String, createIfNotExists: Bool? = nil) async throws {
        var body: [String: Any] = ["email": email]
        createIfNotExists.map { body["createIfNotExists"] = $0 }
        _ = try await post(path: "/api/auth/magic-link", body: body)
    }

    public func verifyMagicLink(token: String, projectId: String) async throws -> [String: Any] {
        var c = URLComponents(string: baseString + "/api/auth/magic-link/verify")!
        c.queryItems = [
            URLQueryItem(name: "token", value: token),
            URLQueryItem(name: "project", value: projectId),
        ]
        var req = URLRequest(url: c.url!)
        req.httpMethod = "GET"
        return try await send(req, withApiKey: false) as! [String: Any]
    }

    public func sendPasswordReset(email: String) async throws {
        _ = try await post(path: "/api/auth/password/reset", body: ["email": email])
    }

    public func updatePassword(token: String, newPassword: String) async throws {
        _ = try await post(path: "/api/auth/password/update", body: ["token": token, "newPassword": newPassword])
    }

    public func initiateOAuth(provider: String, redirectUrl: String? = nil) async throws -> [String: Any] {
        var body: [String: Any] = [:]
        redirectUrl.map { body["redirectUrl"] = $0 }
        let enc = provider.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? provider
        return try await post(path: "/api/auth/oauth/\(enc)", body: body) as! [String: Any]
    }

    public func exchangeOAuthCode(_ code: String) async throws -> [String: Any] {
        try await post(path: "/api/auth/oauth/token", body: ["code": code]) as! [String: Any]
    }

    public func completeOidcGrant(
        requestToken: String,
        approved: Bool,
        userId: String? = nil,
        scopes: [String]? = nil
    ) async throws -> [String: Any] {
        var body: [String: Any] = ["requestToken": requestToken, "approved": approved]
        userId.map { body["userId"] = $0 }
        if let s = scopes, !s.isEmpty { body["scopes"] = s }
        return try await post(path: "/api/auth/oidc/grant", body: body) as! [String: Any]
    }
}
