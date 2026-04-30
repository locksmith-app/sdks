# `locksmith_dart`

Official **Dart** client for the [Locksmith](https://getlocksmith.dev) public auth API.

- **Docs:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)

## Install

```yaml
dependencies:
  locksmith_dart: ^0.1.0
```

```bash
dart pub get
```

## Requirements

- **Dart 3.5+**
- API key prefix `lsm_live_` or `lsm_sbx_`.

## Quick start

```dart
import 'dart:io';

import 'package:locksmith_dart/locksmith.dart';

final c = LocksmithClient(apiKey: Platform.environment['LOCKSMITH_API_KEY']!);

final data = await c.signIn('user@example.com', 'secure-password');
final me = await c.getUser(data['accessToken'] as String);
```

## Local JWT verification

```dart
final payload = c.verifyToken(accessToken, publicKeyPem);
```

## License

MIT
