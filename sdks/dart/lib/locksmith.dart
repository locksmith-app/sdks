import 'dart:convert';

import 'package:dart_jsonwebtoken/dart_jsonwebtoken.dart';
import 'package:http/http.dart' as http;

const _defaultBase = 'https://uselocksmith.app';
const _issuer = 'https://uselocksmith.app';

class LocksmithException implements Exception {
  LocksmithException(this.code, this.message, this.status);
  final String code;
  final String message;
  final int status;

  @override
  String toString() => 'LocksmithException($code, $status): $message';
}

class LocksmithClient {
  LocksmithClient({required this.apiKey, String? baseUrl})
      : baseUrl = (baseUrl ?? _defaultBase).replaceAll(RegExp(r'/+$'), ''),
        environment = environmentFromApiKey(apiKey);

  final String apiKey;
  final String baseUrl;
  final String environment;

  static String environmentFromApiKey(String key) {
    if (key.startsWith('lsm_live_')) return 'production';
    if (key.startsWith('lsm_sbx_')) return 'sandbox';
    throw ArgumentError('Invalid Locksmith API key.');
  }

  Uri _uri(String path) {
    final p = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$baseUrl$p');
  }

  Map<String, dynamic> _parseEnvelope(http.Response res) {
    final body = res.body.isEmpty ? <String, dynamic>{} : jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw LocksmithException(
        body['error'] as String? ?? 'unknown_error',
        body['message'] as String? ?? res.reasonPhrase ?? 'error',
        res.statusCode,
      );
    }
    if (!body.containsKey('data')) {
      throw LocksmithException('invalid_response', 'Expected { data }', res.statusCode);
    }
    return body['data'] as Map<String, dynamic>;
  }

  Map<String, String> _headers({Map<String, String>? extra}) {
    return {'X-API-Key': apiKey, ...?extra};
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      _uri(path),
      headers: {..._headers(), 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return _parseEnvelope(res);
  }

  Future<Map<String, dynamic>> signUp(String email, String password, [Map<String, dynamic>? meta]) =>
      _post('/api/auth/signup', {
        'email': email,
        'password': password,
        if (meta != null) 'meta': meta,
      });

  Future<Map<String, dynamic>> signIn(String email, String password) =>
      _post('/api/auth/login', {'email': email, 'password': password});

  Future<void> signOut(String refreshToken) async {
    await _post('/api/auth/logout', {'refreshToken': refreshToken});
  }

  Future<Map<String, dynamic>> refresh(String refreshToken) =>
      _post('/api/auth/refresh', {'refreshToken': refreshToken});

  Future<Map<String, dynamic>> getUser(String accessToken) async {
    final res = await http.get(
      _uri('/api/auth/me'),
      headers: _headers(extra: {'Authorization': 'Bearer $accessToken'}),
    );
    final data = _parseEnvelope(res);
    return data['user'] as Map<String, dynamic>;
  }

  Map<String, dynamic> verifyToken(String accessToken, String publicKeyPem) {
    final jwt = JWT.verify(accessToken, RSAPublicKey(publicKeyPem));
    final p = Map<String, dynamic>.from(jwt.payload as Map);
    if (p['iss'] != _issuer) {
      throw StateError('Invalid issuer');
    }
    return p;
  }

  Future<void> sendMagicLink(String email, {bool? createIfNotExists}) async {
    await _post('/api/auth/magic-link', {
      'email': email,
      if (createIfNotExists != null) 'createIfNotExists': createIfNotExists,
    });
  }

  Future<Map<String, dynamic>> verifyMagicLink({required String token, required String projectId}) async {
    final q = Uri(queryParameters: {'token': token, 'project': projectId});
    final res = await http.get(_uri('/api/auth/magic-link/verify').replace(query: q.query));
    return _parseEnvelope(res);
  }

  Future<void> sendPasswordReset(String email) async {
    await _post('/api/auth/password/reset', {'email': email});
  }

  Future<void> updatePassword({required String token, required String newPassword}) async {
    await _post('/api/auth/password/update', {'token': token, 'newPassword': newPassword});
  }

  Future<Map<String, dynamic>> initiateOAuth(String provider, {String? redirectUrl}) async {
    final body = <String, dynamic>{};
    if (redirectUrl != null && redirectUrl.isNotEmpty) {
      body['redirectUrl'] = redirectUrl;
    }
    final enc = Uri.encodeComponent(provider);
    return _post('/api/auth/oauth/$enc', body);
  }

  Future<Map<String, dynamic>> exchangeOAuthCode(String code) =>
      _post('/api/auth/oauth/token', {'code': code});

  Future<Map<String, dynamic>> completeOidcGrant({
    required String requestToken,
    required bool approved,
    String? userId,
    List<String>? scopes,
  }) async {
    final body = <String, dynamic>{
      'requestToken': requestToken,
      'approved': approved,
    };
    if (userId != null) body['userId'] = userId;
    if (scopes != null && scopes.isNotEmpty) body['scopes'] = scopes;
    return _post('/api/auth/oidc/grant', body);
  }
}
