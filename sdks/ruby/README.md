# `locksmith-ruby`

Official **Ruby** client for the [Locksmith](https://getlocksmith.dev) public auth API.

- **Docs:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)

## Install

Add to your `Gemfile`:

```ruby
gem "locksmith-ruby"
```

Then:

```bash
bundle install
```

## Requirements

- Ruby **3.1+**
- API key prefix `lsm_live_` or `lsm_sbx_`.

## Quick start

```ruby
require "locksmith"

c = Locksmith::Client.new(api_key: ENV.fetch("LOCKSMITH_API_KEY"))
data = c.sign_in(email: "user@example.com", password: "secure-password")
puts data["user"]["email"], data["accessToken"]

u = c.get_user(data["accessToken"])
```

## Local JWT verification

```ruby
payload = c.verify_token(access_token, public_key_pem)
```

## License

MIT
