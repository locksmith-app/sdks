from __future__ import annotations

import httpx
import jwt

from locksmith.errors import LocksmithError
from locksmith.types import (
    DEFAULT_BASE,
    ISSUER,
    AuthTokens,
    Environment,
    MagicLinkVerifyResult,
    SignInResult,
    SignUpResult,
    TokenPayload,
    UserMe,
    environment_from_api_key,
)
from typing import cast


class LocksmithClient:
    def __init__(self, *, api_key: str, base_url: str | None = None) -> None:
        environment_from_api_key(api_key)
        self.api_key = api_key
        self.base_url = (base_url or DEFAULT_BASE).rstrip("/")
        self.environment: Environment = environment_from_api_key(api_key)

    def _url(self, path: str) -> str:
        p = path if path.startswith("/") else f"/{path}"
        return f"{self.base_url}{p}"

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        json_body: dict | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> dict:
        headers: dict[str, str] = {"X-API-Key": self.api_key}
        if extra_headers:
            headers.update(extra_headers)
        if json_body is not None:
            headers.setdefault("Content-Type", "application/json")

        with httpx.Client(timeout=30.0) as client:
            r = client.request(method, self._url(path), headers=headers, json=json_body)

        try:
            body: dict = r.json() if r.content else {}
        except Exception:
            body = {}

        if not r.is_success:
            code = str(body.get("error", "unknown_error"))
            msg = str(body.get("message", r.reason_phrase or "Request failed"))
            raise LocksmithError(code, msg, r.status_code)

        if "data" not in body:
            raise LocksmithError("invalid_response", "Expected envelope { data }", r.status_code)
        data = body["data"]
        if not isinstance(data, dict):
            raise LocksmithError("invalid_response", "Expected data object", r.status_code)
        return data

    def sign_up(self, *, email: str, password: str, meta: dict | None = None) -> SignUpResult:
        payload: dict = {"email": email, "password": password}
        if meta is not None:
            payload["meta"] = meta
        data = self._request_json("POST", "/api/auth/signup", json_body=payload)
        return cast(SignUpResult, data)

    def sign_in(self, *, email: str, password: str) -> SignInResult:
        data = self._request_json(
            "POST",
            "/api/auth/login",
            json_body={"email": email, "password": password},
        )
        return cast(SignInResult, data)

    def sign_out(self, refresh_token: str) -> None:
        self._request_json("POST", "/api/auth/logout", json_body={"refreshToken": refresh_token})

    def refresh(self, refresh_token: str) -> AuthTokens:
        data = self._request_json(
            "POST",
            "/api/auth/refresh",
            json_body={"refreshToken": refresh_token},
        )
        return cast(AuthTokens, data)

    def get_user(self, access_token: str) -> UserMe:
        data = self._request_json(
            "GET",
            "/api/auth/me",
            extra_headers={"Authorization": f"Bearer {access_token}"},
        )
        user = data.get("user")
        if not isinstance(user, dict):
            raise LocksmithError("invalid_response", "Missing user in response", 200)
        return cast(UserMe, user)

    def verify_token(self, access_token: str, public_key_pem: str) -> TokenPayload:
        decoded = jwt.decode(
            access_token,
            public_key_pem,
            algorithms=["RS256"],
            issuer=ISSUER,
        )
        if not isinstance(decoded, dict):
            raise LocksmithError("invalid_token", "Invalid JWT payload", 401)
        return cast(TokenPayload, decoded)

    def send_magic_link(self, email: str, *, create_if_not_exists: bool | None = None) -> None:
        body: dict = {"email": email}
        if create_if_not_exists is not None:
            body["createIfNotExists"] = create_if_not_exists
        self._request_json("POST", "/api/auth/magic-link", json_body=body)

    def verify_magic_link(self, *, token: str, project_id: str) -> MagicLinkVerifyResult:
        params = {"token": token, "project": project_id}
        with httpx.Client(timeout=30.0) as client:
            r = client.get(f"{self.base_url}/api/auth/magic-link/verify", params=params)
        try:
            body: dict = r.json() if r.content else {}
        except Exception:
            body = {}
        if not r.is_success:
            code = str(body.get("error", "unknown_error"))
            msg = str(body.get("message", r.reason_phrase or "Request failed"))
            raise LocksmithError(code, msg, r.status_code)
        if "data" not in body or not isinstance(body["data"], dict):
            raise LocksmithError("invalid_response", "Expected envelope { data }", r.status_code)
        return cast(MagicLinkVerifyResult, body["data"])

    def send_password_reset(self, email: str) -> None:
        self._request_json("POST", "/api/auth/password/reset", json_body={"email": email})

    def update_password(self, *, token: str, new_password: str) -> None:
        self._request_json(
            "POST",
            "/api/auth/password/update",
            json_body={"token": token, "newPassword": new_password},
        )

    def initiate_oauth(self, *, provider: str, redirect_url: str | None = None) -> dict:
        body: dict = {}
        if redirect_url is not None:
            body["redirectUrl"] = redirect_url
        return self._request_json("POST", f"/api/auth/oauth/{provider}", json_body=body)

    def exchange_oauth_code(self, code: str) -> dict:
        return self._request_json("POST", "/api/auth/oauth/token", json_body={"code": code})

    def complete_oidc_grant(
        self,
        *,
        request_token: str,
        approved: bool,
        user_id: str | None = None,
        scopes: list[str] | None = None,
    ) -> dict:
        body: dict = {"requestToken": request_token, "approved": approved}
        if user_id is not None:
            body["userId"] = user_id
        if scopes is not None:
            body["scopes"] = scopes
        return self._request_json("POST", "/api/auth/oidc/grant", json_body=body)
