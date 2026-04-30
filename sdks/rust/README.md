# `locksmith` (Rust crate)

Official **Rust** client for the [Locksmith](https://getlocksmith.dev) public auth API (async, `reqwest`).

- **Docs:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)
- **crate name:** `locksmith` (confirm availability on [crates.io](https://crates.io) before publishing)

## Install

Add to `Cargo.toml`:

```toml
locksmith = "0.1"
```

## Requirements

- Rust **1.70+** (edition 2021)
- API key prefix `lsm_live_` or `lsm_sbx_`.

## Quick start

```rust
use locksmith::LocksmithClient;

#[tokio::main]
async fn main() -> Result<(), locksmith::Error> {
    let c = LocksmithClient::new(std::env::var("LOCKSMITH_API_KEY").unwrap(), None)?;
    let r = c.sign_in("user@example.com", "secret-here").await?;
    println!("{}", r.user.base.email);
    Ok(())
}
```

## Local JWT verification

```rust
let payload = LocksmithClient::verify_token(&access_token, public_key_pem)?;
```

## License

MIT
