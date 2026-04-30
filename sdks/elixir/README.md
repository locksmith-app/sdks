# `locksmith_ex`

Official **Elixir** client for the [Locksmith](https://getlocksmith.dev) public auth API.

- **Docs:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)

## Install

Add to `mix.exs`:

```elixir
{:locksmith_ex, "~> 0.1"}
```

```bash
mix deps.get
```

## Requirements

- **Elixir 1.15+**
- API key prefix `lsm_live_` or `lsm_sbx_`.

## Quick start

```elixir
c = Locksmith.new(System.fetch_env!("LOCKSMITH_API_KEY"))

data = Locksmith.sign_in(c, "user@example.com", "secure-password")
%{"accessToken" => at} = data

user = Locksmith.get_user(c, at)
```

## Local JWT verification

```elixir
claims = Locksmith.verify_token(access_token, public_key_pem)
```

## License

MIT
