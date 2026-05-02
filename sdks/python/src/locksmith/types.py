from __future__ import annotations

from typing import Any, Literal, TypedDict


class LocksmithError(Exception):
    def __init__(self, code: str, message: str, status: int) -> None:
        super().__init__(message)
        self.code = code
        self.status = status


Environment = Literal["production", "sandbox"]


def environment_from_api_key(api_key: str) -> Environment:
    if api_key.startswith("lsm_live_"):
        return "production"
    if api_key.startswith("lsm_sbx_"):
        return "sandbox"
    raise ValueError("Invalid Locksmith API key: expected prefix lsm_live_ or lsm_sbx_.")


class UserDict(TypedDict):
    id: str
    email: str
    role: str
    meta: dict[str, Any]


class UserWithTimestamps(UserDict):
    createdAt: str


class UserMe(UserDict):
    emailVerified: bool
    twoFactorEnabled: bool
    passkeyCount: int
    roles: list[str]
    permissions: list[str]
    createdAt: str
    lastLoginAt: str | None


class SignInUser(UserDict):
    lastLoginAt: str | None


class AuthTokens(TypedDict):
    accessToken: str
    refreshToken: str
    expiresIn: int


class SignUpResult(AuthTokens):
    user: UserWithTimestamps


class SignInResult(AuthTokens):
    user: SignInUser


class MagicLinkVerifyResult(AuthTokens):
    user: UserWithTimestamps


class Role(TypedDict):
    id: str
    name: str
    description: str | None
    color: str | None
    isDefault: bool
    isSystem: bool
    createdAt: str
    updatedAt: str


class Permission(TypedDict):
    id: str
    key: str
    name: str
    description: str | None
    category: str | None
    createdAt: str
    updatedAt: str


class TokenPayload(TypedDict, total=False):
    sub: str
    email: str
    role: str                  # legacy single-role string
    roles: list[str]           # all RBAC role names
    permissions: list[str]     # all permission keys resolved from roles
    environment: Environment
    meta: dict[str, Any]
    aud: str
    iss: str
    iat: int
    exp: int


DEFAULT_BASE = "https://getlocksmith.dev"
ISSUER = "https://getlocksmith.dev"
