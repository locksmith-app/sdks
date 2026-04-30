# `locksmith-java`

Official **Java 17** client for the [Locksmith](https://getlocksmith.dev) public auth API.

Maven coordinates (once published): `app.locksmith:locksmith-java:0.1.0`.

- **Docs:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)

## Install

```xml
<dependency>
  <groupId>app.locksmith</groupId>
  <artifactId>locksmith-java</artifactId>
  <version>0.1.0</version>
</dependency>
```

## Requirements

- **Java 17+**
- API key prefix `lsm_live_` or `lsm_sbx_`.

## Quick start

```java
import app.locksmith.LocksmithClient;
import com.fasterxml.jackson.databind.JsonNode;

try (var c = new LocksmithClient(System.getenv("LOCKSMITH_API_KEY"))) {
    JsonNode data = c.signIn("user@example.com", "secure-password");
    String access = data.get("accessToken").asText();
    JsonNode user = c.getUser(access);
}
```

## Local JWT verification

Use `LocksmithClient` helpers to verify RS256 tokens with your project public PEM (see source / API docs).

## License

MIT
