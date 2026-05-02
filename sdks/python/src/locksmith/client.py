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
    Permission,
    Role,
    SignInResult,
    SignUpResult,
    TokenPayload,
    UserMe,
    environment_from_api_key,
)
from typing import Any, cast


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

    # ── RBAC: Roles ──────────────────────────────────────────────────────────

    def list_roles(self) -> list[dict]:
        return self._request_json("GET", "/api/auth/rbac/roles")["roles"]

    def get_role(self, role_id: str) -> dict:
        return self._request_json("GET", f"/api/auth/rbac/roles/{role_id}")["role"]

    def create_role(
        self,
        *,
        name: str,
        description: str | None = None,
        color: str | None = None,
        is_default: bool = False,
    ) -> dict:
        body: dict = {"name": name, "isDefault": is_default}
        if description is not None:
            body["description"] = description
        if color is not None:
            body["color"] = color
        return self._request_json("POST", "/api/auth/rbac/roles", json_body=body)["role"]

    def update_role(
        self,
        role_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        color: str | None = None,
        is_default: bool | None = None,
    ) -> dict:
        patch: dict = {}
        if name is not None:
            patch["name"] = name
        if description is not None:
            patch["description"] = description
        if color is not None:
            patch["color"] = color
        if is_default is not None:
            patch["isDefault"] = is_default
        return self._request_json("PATCH", f"/api/auth/rbac/roles/{role_id}", json_body=patch)["role"]

    def delete_role(self, role_id: str) -> None:
        self._request_json("DELETE", f"/api/auth/rbac/roles/{role_id}")

    def set_role_permissions(self, role_id: str, permission_ids: list[str]) -> dict:
        return self._request_json(
            "PUT",
            f"/api/auth/rbac/roles/{role_id}/permissions",
            json_body={"permissionIds": permission_ids},
        )["role"]

    # ── RBAC: Permissions ────────────────────────────────────────────────────

    def list_permissions(self) -> list[dict]:
        return self._request_json("GET", "/api/auth/rbac/permissions")["permissions"]

    def get_permission(self, permission_id: str) -> dict:
        return self._request_json("GET", f"/api/auth/rbac/permissions/{permission_id}")["permission"]

    def create_permission(
        self,
        *,
        key: str,
        name: str,
        description: str | None = None,
        category: str | None = None,
    ) -> dict:
        body: dict = {"key": key, "name": name}
        if description is not None:
            body["description"] = description
        if category is not None:
            body["category"] = category
        return self._request_json("POST", "/api/auth/rbac/permissions", json_body=body)["permission"]

    def update_permission(
        self,
        permission_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        category: str | None = None,
    ) -> dict:
        patch: dict = {}
        if name is not None:
            patch["name"] = name
        if description is not None:
            patch["description"] = description
        if category is not None:
            patch["category"] = category
        return self._request_json(
            "PATCH", f"/api/auth/rbac/permissions/{permission_id}", json_body=patch
        )["permission"]

    def delete_permission(self, permission_id: str) -> None:
        self._request_json("DELETE", f"/api/auth/rbac/permissions/{permission_id}")

    # ── RBAC: User-role assignment ───────────────────────────────────────────

    def get_user_roles(self, user_id: str) -> list[dict]:
        data = self._request_json("GET", f"/api/auth/rbac/users/{user_id}/roles")
        raw = data.get("assignments")
        if isinstance(raw, list):
            return raw
        # Older API shape
        roles = data.get("roles")
        if isinstance(roles, list):
            return [{"role": r, "assignedAt": ""} for r in roles]
        return []

    def get_user_role_objects(self, user_id: str) -> list[dict[str, Any]]:
        """Return only role objects (no assignedAt)."""
        return [a["role"] for a in self.get_user_roles(user_id) if isinstance(a.get("role"), dict)]

    def assign_role(self, user_id: str, role_id: str) -> None:
        self._request_json(
            "POST",
            f"/api/auth/rbac/users/{user_id}/roles/{role_id}",
            json_body={},
        )

    def revoke_role(self, user_id: str, role_id: str) -> None:
        self._request_json("DELETE", f"/api/auth/rbac/users/{user_id}/roles/{role_id}")

    def set_user_roles(self, user_id: str, role_ids: list[str]) -> list[dict]:
        return self._request_json(
            "PUT",
            f"/api/auth/rbac/users/{user_id}/roles",
            json_body={"roleIds": role_ids},
        )["roles"]

    # ── RBAC: Local token helpers ────────────────────────────────────────────

    @staticmethod
    def has_role(token: TokenPayload, role: str) -> bool:
        """Return True if the decoded token payload includes the given role name."""
        return role in (token.get("roles") or [])

    @staticmethod
    def has_permission(token: TokenPayload, permission: str) -> bool:
        """Return True if the decoded token payload includes the given permission key."""
        return permission in (token.get("permissions") or [])
