# `locksmith-py`

Official **Python 3** client for the [Locksmith](https://getlocksmith.dev) public auth API.

- **Docs:** [getlocksmith.dev/docs/api](https://getlocksmith.dev/docs/api)

## Install

```bash
pip install locksmith-py
```

## Requirements

- Python **3.10+**
- API key prefix `lsm_live_` or `lsm_sbx_` (environment is derived automatically).

## Quick start

```python
import os
from locksmith import LocksmithClient

c = LocksmithClient(api_key=os.environ["LOCKSMITH_API_KEY"])

result = c.sign_up(email="user@example.com", password="secure-password")
print(result["user"]["id"], result["accessToken"])

me = c.get_user(result["accessToken"])
```

## Local JWT verification

```python
payload = c.verify_token(access_token, public_key_pem)
```

## License

MIT
