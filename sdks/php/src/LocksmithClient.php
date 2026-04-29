<?php

declare(strict_types=1);

namespace Locksmith;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use stdClass;

final class LocksmithClient
{
    private const DEFAULT_BASE = 'https://uselocksmith.app';
    private const ISSUER = 'https://uselocksmith.app';

    public readonly string $environment;

    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl = self::DEFAULT_BASE,
    ) {
        $this->environment = self::environmentFromApiKey($apiKey);
    }

    /** @return 'production'|'sandbox' */
    public static function environmentFromApiKey(string $apiKey): string
    {
        if (str_starts_with($apiKey, 'lsm_live_')) {
            return 'production';
        }
        if (str_starts_with($apiKey, 'lsm_sbx_')) {
            return 'sandbox';
        }
        throw new \InvalidArgumentException('Invalid Locksmith API key: expected lsm_live_ or lsm_sbx_ prefix.');
    }

    /** @param array<string, mixed>|null $meta */
    public function signUp(string $email, string $password, ?array $meta = null): array
    {
        $body = ['email' => $email, 'password' => $password];
        if ($meta !== null) {
            $body['meta'] = $meta;
        }
        return $this->post('/api/auth/signup', $body);
    }

    public function signIn(string $email, string $password): array
    {
        return $this->post('/api/auth/login', ['email' => $email, 'password' => $password]);
    }

    public function signOut(string $refreshToken): void
    {
        $this->post('/api/auth/logout', ['refreshToken' => $refreshToken]);
    }

    public function refresh(string $refreshToken): array
    {
        return $this->post('/api/auth/refresh', ['refreshToken' => $refreshToken]);
    }

    /** @return array<string, mixed> */
    public function getUser(string $accessToken): array
    {
        [$st, $raw] = $this->request('GET', '/api/auth/me', null, [
            'Authorization' => 'Bearer ' . $accessToken,
        ]);
        $data = $this->parseBody($st, $raw);

        /** @var array<string, mixed> */
        return $data['user'];
    }

    /** @return array<string, mixed> */
    public function verifyTokenLocal(string $accessToken, string $publicKeyPem): array
    {
        $obj = JWT::decode($accessToken, new Key($publicKeyPem, 'RS256'));
        if (! $obj instanceof stdClass) {
            throw new \RuntimeException('Invalid JWT payload');
        }
        if (($obj->iss ?? null) !== self::ISSUER) {
            throw new \RuntimeException('Invalid issuer');
        }

        /** @var array<string, mixed> */
        return json_decode(json_encode($obj, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
    }

    public function sendMagicLink(string $email, ?bool $createIfNotExists = null): void
    {
        $body = ['email' => $email];
        if ($createIfNotExists !== null) {
            $body['createIfNotExists'] = $createIfNotExists;
        }
        $this->post('/api/auth/magic-link', $body);
    }

    public function verifyMagicLink(string $token, string $projectId): array
    {
        $q = http_build_query(['token' => $token, 'project' => $projectId]);
        [$st, $raw] = $this->sendRaw('GET', $this->url('/api/auth/magic-link/verify') . '?' . $q, null, []);

        return $this->parseBody($st, $raw);
    }

    public function sendPasswordReset(string $email): void
    {
        $this->post('/api/auth/password/reset', ['email' => $email]);
    }

    public function updatePassword(string $token, string $newPassword): void
    {
        $this->post('/api/auth/password/update', [
            'token' => $token,
            'newPassword' => $newPassword,
        ]);
    }

    /** @param array<string, mixed> $body */
    private function post(string $path, array $body): array
    {
        [$st, $raw] = $this->request('POST', $path, $body);

        return $this->parseBody($st, $raw);
    }

    private function url(string $path): string
    {
        $base = rtrim($this->baseUrl, '/');
        $p = str_starts_with($path, '/') ? $path : '/' . $path;

        return $base . $p;
    }

    /**
     * @param array<string, mixed>|null $json
     * @param array<string, string>      $headers
     * @return array{int, string}
     */
    private function request(string $method, string $path, ?array $json, array $headers = []): array
    {
        return $this->sendRaw($method, $this->url($path), $json, array_merge([
            'X-API-Key' => $this->apiKey,
        ], $headers));
    }

    /**
     * @param array<string, mixed>|null $json
     * @param array<string, string>      $headers
     * @return array{int, string}
     */
    private function sendRaw(string $method, string $url, ?array $json, array $headers): array
    {
        $headerLines = [];
        foreach ($headers as $k => $v) {
            $headerLines[] = $k . ': ' . $v;
        }
        if ($json !== null) {
            $headerLines[] = 'Content-Type: application/json';
        }

        $opts = [
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $headerLines),
                'content' => $json !== null ? json_encode($json, JSON_THROW_ON_ERROR) : '',
                'timeout' => 30,
                'ignore_errors' => true,
            ],
        ];
        $ctx = stream_context_create($opts);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) {
            throw new LocksmithError('network_error', 'Request failed', 0);
        }

        $status = 0;
        if (isset($http_response_header[0]) && preg_match('#HTTP/\S+\s+(\d+)#', $http_response_header[0], $m)) {
            $status = (int) $m[1];
        }

        return [$status, $raw];
    }

    /** @return array<string, mixed> */
    private function parseBody(int $status, string $body): array
    {
        $data = json_decode($body, true);
        if (! is_array($data)) {
            $data = [];
        }

        if ($status < 200 || $status >= 300) {
            throw new LocksmithError(
                (string) ($data['error'] ?? 'unknown_error'),
                (string) ($data['message'] ?? 'Request failed'),
                $status,
            );
        }
        if (! array_key_exists('data', $data)) {
            throw new LocksmithError('invalid_response', 'Expected envelope { data }', $status);
        }
        /** @var array<string, mixed> */
        return $data['data'];
    }
}
