library locksmith_dart;

import 'dart:convert';

import 'package:dart_jsonwebtoken/dart_jsonwebtoken.dart';
import 'package:http/http.dart' as http;

const _defaultBase = 'https://getlocksmith.dev';
const _issuer = 'https://getlocksmith.dev';

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

  Future<Map<String, dynamic>> _get(String path, {Map<String, String>? extraHeaders}) async {
    final res = await http.get(_uri(path), headers: _headers(extra: extraHeaders));
    return _parseEnvelope(res);
  }

  Future<Map<String, dynamic>> _patch(String path, Map<String, dynamic> body) async {
    final res = await http.patch(
      _uri(path),
      headers: {..._headers(), 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return _parseEnvelope(res);
  }

  Future<Map<String, dynamic>> _put(String path, Map<String, dynamic> body) async {
    final res = await http.put(
      _uri(path),
      headers: {..._headers(), 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return _parseEnvelope(res);
  }

  Future<Map<String, dynamic>> _delete(String path) async {
    final res = await http.delete(_uri(path), headers: _headers());
    return _parseEnvelope(res);
  }

  /// RBAC: list roles (nested permissions).
  Future<List<dynamic>> listRoles() async {
    final d = await _get('/api/auth/rbac/roles');
    return d['roles'] as List<dynamic>;
  }

  Future<Map<String, dynamic>> getRole(String roleId) async {
    final d = await _get('/api/auth/rbac/roles/${Uri.encodeComponent(roleId)}');
    return d['role'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createRole(Map<String, dynamic> body) async {
    final d = await _post('/api/auth/rbac/roles', body);
    return d['role'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateRole(String roleId, Map<String, dynamic> patch) async {
    final d = await _patch('/api/auth/rbac/roles/${Uri.encodeComponent(roleId)}', patch);
    return d['role'] as Map<String, dynamic>;
  }

  Future<void> deleteRole(String roleId) async {
    await _delete('/api/auth/rbac/roles/${Uri.encodeComponent(roleId)}');
  }

  Future<Map<String, dynamic>> setRolePermissions(String roleId, List<String> permissionIds) async {
    final d = await _put('/api/auth/rbac/roles/${Uri.encodeComponent(roleId)}/permissions', {
      'permissionIds': permissionIds,
    });
    return d['role'] as Map<String, dynamic>;
  }

  Future<List<dynamic>> listPermissions() async {
    final d = await _get('/api/auth/rbac/permissions');
    return d['permissions'] as List<dynamic>;
  }

  Future<Map<String, dynamic>> getPermission(String permissionId) async {
    final d = await _get('/api/auth/rbac/permissions/${Uri.encodeComponent(permissionId)}');
    return d['permission'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createPermission(Map<String, dynamic> body) async {
    final d = await _post('/api/auth/rbac/permissions', body);
    return d['permission'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updatePermission(String permissionId, Map<String, dynamic> patch) async {
    final d = await _patch('/api/auth/rbac/permissions/${Uri.encodeComponent(permissionId)}', patch);
    return d['permission'] as Map<String, dynamic>;
  }

  Future<void> deletePermission(String permissionId) async {
    await _delete('/api/auth/rbac/permissions/${Uri.encodeComponent(permissionId)}');
  }

  /// Returns assignment objects: `{ role, assignedAt }`.
  Future<List<dynamic>> getUserRoles(String userId) async {
    final d = await _get('/api/auth/rbac/users/${Uri.encodeComponent(userId)}/roles');
    return d['assignments'] as List<dynamic>;
  }

  Future<void> assignRole(String userId, String roleId) async {
    await _post(
      '/api/auth/rbac/users/${Uri.encodeComponent(userId)}/roles/${Uri.encodeComponent(roleId)}',
      {},
    );
  }

  Future<void> revokeRole(String userId, String roleId) async {
    await _delete(
      '/api/auth/rbac/users/${Uri.encodeComponent(userId)}/roles/${Uri.encodeComponent(roleId)}',
    );
  }

  Future<List<dynamic>> setUserRoles(String userId, List<String> roleIds) async {
    final d = await _put('/api/auth/rbac/users/${Uri.encodeComponent(userId)}/roles', {
      'roleIds': roleIds,
    });
    return d['roles'] as List<dynamic>;
  }

  /// Local check on a verified token payload map (from [verifyToken]).
  static bool tokenHasRole(Map<String, dynamic> payload, String role) {
    final r = payload['roles'];
    if (r is List) return r.contains(role);
    return false;
  }

  static bool tokenHasPermission(Map<String, dynamic> payload, String permission) {
    final p = payload['permissions'];
    if (p is List) return p.contains(permission);
    return false;
  }
}
