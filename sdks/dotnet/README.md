# `Locksmith.Sdk` (.NET)

Official **.NET 8** client for the [Locksmith](https://getlocksmith.dev) public auth API.

- **Docs:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)

## Install

```bash
dotnet add package Locksmith.Sdk
```

(Package ID and NuGet publication are configured in your release pipeline.)

## Requirements

- **.NET 8.0**
- API key prefix `lsm_live_` or `lsm_sbx_`.

## Quick start

```csharp
using System.Text.Json;
using Locksmith;

await using var client = new LocksmithClient(Environment.GetEnvironmentVariable("LOCKSMITH_API_KEY")!);

JsonElement bundle = await client.SignInAsync("user@example.com", "secure-password");
string access = bundle.GetProperty("accessToken").GetString()!;

JsonElement user = await client.GetUserAsync(access);
```

Responses are **`JsonElement`** subtrees matching the API’s camelCase JSON.

## Local JWT verification

```csharp
var jwt = LocksmithClient.VerifyToken(accessToken, publicKeyPem);
```

## License

MIT
