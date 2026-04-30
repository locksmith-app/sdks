# `sdk-go`

Official **Go** client for the [Locksmith](https://getlocksmith.dev) public auth API.

**Module path:** `github.com/locksmith-app/sdk-go` — public repo: [github.com/locksmith-app/sdk-go](https://github.com/locksmith-app/sdk-go).

- **Docs:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)

## Install

```bash
go get github.com/locksmith-app/sdk-go@latest
```

## Requirements

- Go **1.22+**
- API key prefix `lsm_live_` or `lsm_sbx_`.

## Quick start

```go
package main

import (
	"fmt"
	"os"

	locksmith "github.com/locksmith-app/sdk-go"
)

func main() {
	c, err := locksmith.NewClient(os.Getenv("LOCKSMITH_API_KEY"), "")
	if err != nil {
		panic(err)
	}
	out, err := c.SignIn("user@example.com", "secure-password")
	if err != nil {
		panic(err)
	}
	fmt.Println(out.User.Email, out.AccessToken)
}
```

## Local JWT verification

```go
claims, err := locksmith.VerifyToken(accessToken, publicKeyPEM)
```

## License

MIT
