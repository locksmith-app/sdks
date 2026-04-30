# `locksmith/sdk-php`

Official **PHP 8.2+** client for the [Locksmith](https://getlocksmith.dev) public auth API.

- **Docs:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)

## Install

```bash
composer require locksmith/sdk-php
```

## Requirements

- PHP **8.2+** with `ext-json`
- API key prefix `lsm_live_` or `lsm_sbx_`.

## Quick start

```php
<?php

use Locksmith\LocksmithClient;

$client = new LocksmithClient(getenv('LOCKSMITH_API_KEY'));

$data = $client->signIn('user@example.com', 'secure-password');
echo $data['user']['email'], "\n";

$user = $client->getUser($data['accessToken']);
```

Methods return the inner **`data`** object from Locksmith’s JSON envelope.

## Local JWT verification

```php
$payload = $client->verifyTokenLocal($accessToken, $publicKeyPem);
```

## License

MIT
