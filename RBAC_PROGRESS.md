# RBAC Implementation Progress

## Overview
Fine-grained, fully configurable Role-Based Access Control for Locksmith projects.
Roles and permissions are project-scoped, environment-aware, and automatically embedded in JWT access tokens.

## Architecture
- **Roles** — named, project-scoped role definitions (e.g. `admin`, `editor`, `viewer`)
- **Permissions** — fine-grained keys with category grouping (e.g. `posts:read`, `users:write`)
- **Role ↔ Permission** — many-to-many; roles aggregate permissions
- **User ↔ Role** — many-to-many, environment-scoped; users can hold multiple roles
- **JWT claims** — `roles[]` + `permissions[]` automatically included in access tokens
- **Default roles** — a role can be flagged `isDefault` and auto-assigned to new users

---

## Status

### ✅ Done
- [x] Progress tracking file created
- [x] Prisma schema: `Role`, `Permission`, `RolePermission`, `UserRole` models added
- [x] `User` and `Project` relations updated in schema
- [x] `AccessTokenPayload` updated to include `roles` and `permissions`
- [x] `signAccessToken` updated to accept roles/permissions
- [x] `rbac` tRPC router created (roles CRUD, permissions CRUD, user role assignment)
- [x] `rbac` router registered in `_app.ts`
- [x] Auth route helpers: `resolveUserRolesAndPermissions()` utility
- [x] `useRbac` React hooks
- [x] Roles dashboard page (`/projects/[projectId]/roles`)
- [x] Sidebar navigation entry for Roles
- [x] `rbac.*` webhook events added to event constants

### ✅ Also Done
- [x] Wired `resolveUserRolesAndPermissions` into signup, login, refresh, magic-link verify, oauth callback, oauth token routes
- [x] `assignDefaultRoles` called on signup and new OAuth users
- [x] TypeScript type-check passes (0 errors)
- [x] `prisma db push` — schema live in Neon DB, Prisma client regenerated

### 🔲 Optional Follow-up
- [ ] Update Users page table to show assigned role badges inline
- [ ] E2E smoke test via the test user flow

---

## Files Changed / Created

| File | Change |
|------|--------|
| `frontend/prisma/schema.prisma` | Added Role, Permission, RolePermission, UserRole models |
| `frontend/src/lib/tokens.ts` | Added roles/permissions to AccessTokenPayload |
| `frontend/src/lib/rbac.ts` | New — resolveUserRolesAndPermissions helper |
| `frontend/src/server/routers/rbac.ts` | New — full RBAC tRPC router |
| `frontend/src/server/routers/_app.ts` | Registered rbac router |
| `frontend/src/hooks/useRbac.ts` | New — React hooks for RBAC data |
| `frontend/src/app/(dashboard)/projects/[projectId]/roles/page.tsx` | New — Roles management page |
| `frontend/src/components/dashboard/Sidebar.tsx` | Added Roles nav item |
| `frontend/src/app/api/auth/signup/route.ts` | assignDefaultRoles + resolveUserRolesAndPermissions |
| `frontend/src/lib/userAuthSession.ts` | resolveUserRolesAndPermissions (covers login/passkey) |
| `frontend/src/app/api/auth/refresh/route.ts` | resolveUserRolesAndPermissions |
| `frontend/src/app/api/auth/magic-link/verify/route.ts` | resolveUserRolesAndPermissions |
| `frontend/src/app/api/auth/oauth/[provider]/callback/route.ts` | assignDefaultRoles + resolveUserRolesAndPermissions |
| `frontend/src/app/api/auth/oauth/token/route.ts` | resolveUserRolesAndPermissions |

---

## Public REST API (`X-API-Key`)

All under `/api/auth/rbac/…`, environment from key prefix (`lsm_live_` / `lsm_sbx_`).

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/auth/rbac/roles` | List roles (+ nested permissions, user counts) |
| POST | `/api/auth/rbac/roles` | Create role |
| GET | `/api/auth/rbac/roles/:roleId` | Get role |
| PATCH | `/api/auth/rbac/roles/:roleId` | Update role |
| DELETE | `/api/auth/rbac/roles/:roleId` | Delete role (not system) |
| PUT | `/api/auth/rbac/roles/:roleId/permissions` | Replace role’s permission ids `{ permissionIds }` |
| GET | `/api/auth/rbac/permissions` | List permissions |
| POST | `/api/auth/rbac/permissions` | Create permission |
| GET | `/api/auth/rbac/permissions/:permissionId` | Get permission |
| PATCH | `/api/auth/rbac/permissions/:permissionId` | Update permission |
| DELETE | `/api/auth/rbac/permissions/:permissionId` | Delete permission |
| GET | `/api/auth/rbac/users/:userId/roles` | `{ assignments: [{ role, assignedAt }], roles }` |
| PUT | `/api/auth/rbac/users/:userId/roles` | Replace user roles `{ roleIds }` |
| POST | `/api/auth/rbac/users/:userId/roles/:roleId` | Assign role |
| DELETE | `/api/auth/rbac/users/:userId/roles/:roleId` | Revoke role |

`GET /api/auth/me` (Bearer) includes live `roles[]` and `permissions[]` from the DB.

### SDK RBAC coverage (mirror `@locksmith/sdk`)

- **TypeScript** — full client + `hasRole` / `hasPermission` on `TokenPayload`
- **Python** — full client + token helpers
- **Go** — full client + `HasRole` / `HasPermission` on token
- **Dart** — full client + `tokenHasRole` / `tokenHasPermission`
- **Rust** — full async client (`rbac_*` methods) + `token_has_role` / `token_has_permission`
- **PHP** — RBAC CRUD + `LocksmithClient::tokenHasRole` / `tokenHasPermission` on verified claims
- **Ruby** — RBAC CRUD + `Locksmith::Client.token_has_role?` / `token_has_permission?`
- **.NET** — RBAC methods (`ListRolesAsync`, …) + `TokenHasRole` / `TokenHasPermission` on `JwtSecurityToken`
- **Java** — RBAC CRUD + `LocksmithClient.tokenHasRole` / `tokenHasPermission` on `DecodedJWT`
- **Kotlin** — RBAC CRUD + `LocksmithClient.Companion.tokenHasRole` / `tokenHasPermission`
- **Swift** — RBAC CRUD + `LocksmithClient.tokenHasRole` / `tokenHasPermission` on decoded payload map
- **Elixir** — RBAC CRUD + `token_has_role?` / `token_has_permission?` on verify_token claims
- **Next.js** (`sdks/nextjs`) — `UserMe` / `TokenPayload` types include `roles` and `permissions` (BFF does not expose public RBAC admin API)
- Legacy / minimal SDKs (**C++** README-only, etc.) — use REST directly or mirror the TypeScript client RBAC section.

---

## JWT Token Shape (after RBAC)

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "user",
  "roles": ["admin", "editor"],
  "permissions": ["posts:read", "posts:write", "users:read"],
  "environment": "production",
  "meta": {},
  "aud": "project_id",
  "iss": "https://getlocksmith.dev"
}
```

## tRPC Procedures

| Procedure | Type | Description |
|-----------|------|-------------|
| `rbac.listRoles` | query | All roles for a project |
| `rbac.getRole` | query | Single role with permissions |
| `rbac.createRole` | mutation | Create a new role |
| `rbac.updateRole` | mutation | Rename, recolor, toggle default/system |
| `rbac.deleteRole` | mutation | Delete (blocked if isSystem) |
| `rbac.listPermissions` | query | All permissions for a project |
| `rbac.createPermission` | mutation | Define a new permission key |
| `rbac.updatePermission` | mutation | Rename/re-categorize permission |
| `rbac.deletePermission` | mutation | Remove permission |
| `rbac.setRolePermissions` | mutation | Replace full permission set for a role |
| `rbac.getUserRoles` | query | All roles assigned to a user |
| `rbac.assignRole` | mutation | Add a role to a user |
| `rbac.revokeRole` | mutation | Remove a role from a user |
| `rbac.setUserRoles` | mutation | Replace full role set for a user |
