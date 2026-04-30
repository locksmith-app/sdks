# `Locksmith` (Swift Package)

Official **Swift** client for the [Locksmith](https://getlocksmith.dev) public auth API.

- **Docs:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)

## Install (Swift Package Manager)

In `Package.swift` or Xcode:

```swift
.package(url: "https://github.com/<org>/sdk-swift.git", from: "0.1.0")
```

Product: `Locksmith`.

## Requirements

- Swift **5.9+**
- Platforms: iOS 16+, macOS 13+, tvOS 16+, watchOS 9+ (see `Package.swift`)
- API key prefix `lsm_live_` or `lsm_sbx_`.

## Quick start

```swift
import Locksmith

let client = try LocksmithClient(apiKey: ProcessInfo.processInfo.environment["LOCKSMITH_API_KEY"]!)

let bundle = try await client.signIn(email: "user@example.com", password: "secure-password")
let access = bundle["accessToken"] as! String
let me = try await client.getUser(accessToken: access)
```

## Token payload (issuer check)

`LocksmithClient.decodeTokenPayload` validates issuer from the JWT payload; for full RS256 verification in production, wire a JOSE library or Security.framework (see inline SDK notes).

## License

MIT
