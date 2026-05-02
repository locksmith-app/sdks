package locksmith

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const defaultBase = "https://getlocksmith.dev"
const issuer = "https://getlocksmith.dev"

// Environment is implied by the API key prefix (lsm_live_ / lsm_sbx_).
type Environment string

const (
	Production Environment = "production"
	Sandbox    Environment = "sandbox"
)

// User is the common user shape returned by the API.
type User struct {
	ID    string                 `json:"id"`
	Email string                 `json:"email"`
	Role  string                 `json:"role"`
	Meta  map[string]interface{} `json:"meta"`
}

type UserMe struct {
	User
	EmailVerified    bool     `json:"emailVerified"`
	TwoFactorEnabled bool     `json:"twoFactorEnabled"`
	PasskeyCount     int      `json:"passkeyCount"`
	Roles            []string `json:"roles"`
	Permissions      []string `json:"permissions"`
	CreatedAt        string   `json:"createdAt"`
	LastLoginAt      *string  `json:"lastLoginAt"`
}

// AuthTokens holds JWT access token, rotated refresh token, and access TTL seconds.
type AuthTokens struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int    `json:"expiresIn"`
}

type envelope[T any] struct {
	Data T `json:"data"`
}

type apiErr struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// Role is a named group of permissions defined for a project.
type Role struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	IsDefault   bool   `json:"isDefault"`
	IsSystem    bool   `json:"isSystem"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// Permission is a discrete capability key defined for a project.
type Permission struct {
	ID          string `json:"id"`
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// TokenPayload is a verified RS256 access token (local verification).
type TokenPayload struct {
	Email       string                 `json:"email"`
	Role        string                 `json:"role"`        // legacy single-role string
	Roles       []string               `json:"roles"`       // all RBAC role names
	Permissions []string               `json:"permissions"` // resolved permission keys
	Environment Environment            `json:"environment"`
	Meta        map[string]interface{} `json:"meta"`
	jwt.RegisteredClaims
}

// HasRole returns true if the token payload contains the given role name.
func HasRole(t *TokenPayload, role string) bool {
	for _, r := range t.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// HasPermission returns true if the token payload contains the given permission key.
func HasPermission(t *TokenPayload, permission string) bool {
	for _, p := range t.Permissions {
		if p == permission {
			return true
		}
	}
	return false
}

// LocksmithClient calls the public Locksmith REST API.
type LocksmithClient struct {
	APIKey      string
	BaseURL     string
	Environment Environment
	httpClient  *http.Client
}

// NewClient validates the API key prefix and returns a client. Environment is derived from the key.
func NewClient(apiKey string, baseURL string) (*LocksmithClient, error) {
	env, err := environmentFromAPIKey(apiKey)
	if err != nil {
		return nil, err
	}
	b := strings.TrimSuffix(strings.TrimSpace(baseURL), "/")
	if b == "" {
		b = defaultBase
	}
	return &LocksmithClient{
		APIKey:      apiKey,
		BaseURL:     b,
		Environment: env,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
	}, nil
}

func environmentFromAPIKey(apiKey string) (Environment, error) {
	if strings.HasPrefix(apiKey, "lsm_live_") {
		return Production, nil
	}
	if strings.HasPrefix(apiKey, "lsm_sbx_") {
		return Sandbox, nil
	}
	return "", fmt.Errorf("invalid Locksmith API key: expected prefix lsm_live_ or lsm_sbx_")
}

func (c *LocksmithClient) url(p string) string {
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return c.BaseURL + p
}

func (c *LocksmithClient) doJSON(method, path string, body io.Reader, extraHeaders map[string]string, out any) error {
	req, err := http.NewRequest(method, c.url(path), body)
	if err != nil {
		return err
	}
	req.Header.Set("X-API-Key", c.APIKey)
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}
	if body != nil {
		if req.Header.Get("Content-Type") == "" {
			req.Header.Set("Content-Type", "application/json")
		}
	}
	res, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		var ae apiErr
		_ = json.Unmarshal(raw, &ae)
		code := ae.Error
		if code == "" {
			code = "unknown_error"
		}
		msg := ae.Message
		if msg == "" {
			msg = res.Status
		}
		return newLocksmithError(code, msg, res.StatusCode)
	}
	var wrap envelope[json.RawMessage]
	if err := json.Unmarshal(raw, &wrap); err != nil {
		return newLocksmithError("invalid_response", "Expected envelope { data }", res.StatusCode)
	}
	if len(wrap.Data) == 0 {
		return newLocksmithError("invalid_response", "Missing data", res.StatusCode)
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(wrap.Data, out); err != nil {
		return newLocksmithError("invalid_response", err.Error(), res.StatusCode)
	}
	return nil
}

// SignUp creates a user and returns tokens.
func (c *LocksmithClient) SignUp(email, password string, meta map[string]interface{}) (*struct {
	User         User       `json:"user"`
	AuthTokens
}, error) {
	payload := map[string]interface{}{"email": email, "password": password}
	if meta != nil {
		payload["meta"] = meta
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	var result struct {
		User         User `json:"user"`
		AuthTokens
	}
	if err := c.doJSON(http.MethodPost, "/api/auth/signup", strings.NewReader(string(b)), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// SignIn authenticates and returns tokens.
func (c *LocksmithClient) SignIn(email, password string) (*struct {
	User User `json:"user"`
	AuthTokens
}, error) {
	b, _ := json.Marshal(map[string]string{"email": email, "password": password})
	var result struct {
		User User `json:"user"`
		AuthTokens
	}
	if err := c.doJSON(http.MethodPost, "/api/auth/login", strings.NewReader(string(b)), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// SignOut revokes the refresh token session when found.
func (c *LocksmithClient) SignOut(refreshToken string) error {
	b, _ := json.Marshal(map[string]string{"refreshToken": refreshToken})
	return c.doJSON(http.MethodPost, "/api/auth/logout", strings.NewReader(string(b)), nil, &struct{}{})
}

// Refresh exchanges a refresh token for new tokens.
func (c *LocksmithClient) Refresh(refreshToken string) (*AuthTokens, error) {
	b, _ := json.Marshal(map[string]string{"refreshToken": refreshToken})
	var t AuthTokens
	if err := c.doJSON(http.MethodPost, "/api/auth/refresh", strings.NewReader(string(b)), nil, &t); err != nil {
		return nil, err
	}
	return &t, nil
}

// GetUser loads the current user via Bearer access token.
func (c *LocksmithClient) GetUser(accessToken string) (*UserMe, error) {
	h := map[string]string{"Authorization": "Bearer " + accessToken}
	var inner struct {
		User UserMe `json:"user"`
	}
	if err := c.doJSON(http.MethodGet, "/api/auth/me", nil, h, &inner); err != nil {
		return nil, err
	}
	return &inner.User, nil
}

// VerifyToken parses and validates an access token locally with the project public key PEM.
func VerifyToken(accessToken, publicKeyPEM string) (*TokenPayload, error) {
	pem := []byte(publicKeyPEM)
	key, err := jwt.ParseRSAPublicKeyFromPEM(pem)
	if err != nil {
		return nil, err
	}
	claims := &TokenPayload{}
	tok, err := jwt.ParseWithClaims(
		accessToken,
		claims,
		func(t *jwt.Token) (interface{}, error) {
			if t.Method.Alg() != jwt.SigningMethodRS256.Alg() {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return key, nil
		},
		jwt.WithIssuer(issuer),
		jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Name}),
	)
	if err != nil {
		return nil, err
	}
	p, ok := tok.Claims.(*TokenPayload)
	if !ok || !tok.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return p, nil
}

// SendMagicLink requests a magic link email.
func (c *LocksmithClient) SendMagicLink(email string, createIfNotExists *bool) error {
	body := map[string]interface{}{"email": email}
	if createIfNotExists != nil {
		body["createIfNotExists"] = *createIfNotExists
	}
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	return c.doJSON(http.MethodPost, "/api/auth/magic-link", strings.NewReader(string(b)), nil, &struct {
		Success bool `json:"success"`
	}{})
}

// VerifyMagicLink exchanges the email token query for session tokens (no API key on this request).
func (c *LocksmithClient) VerifyMagicLink(token, projectID string) (*struct {
	User User `json:"user"`
	AuthTokens
}, error) {
	q := url.Values{}
	q.Set("token", token)
	q.Set("project", projectID)
	req, err := http.NewRequest(http.MethodGet, c.url("/api/auth/magic-link/verify")+"?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		var ae apiErr
		_ = json.Unmarshal(raw, &ae)
		code := ae.Error
		if code == "" {
			code = "unknown_error"
		}
		msg := ae.Message
		if msg == "" {
			msg = res.Status
		}
		return nil, newLocksmithError(code, msg, res.StatusCode)
	}
	var wrap envelope[json.RawMessage]
	if err := json.Unmarshal(raw, &wrap); err != nil {
		return nil, newLocksmithError("invalid_response", "Expected envelope { data }", res.StatusCode)
	}
	var result struct {
		User User `json:"user"`
		AuthTokens
	}
	if err := json.Unmarshal(wrap.Data, &result); err != nil {
		return nil, newLocksmithError("invalid_response", err.Error(), res.StatusCode)
	}
	return &result, nil
}

// SendPasswordReset requests a password reset email.
func (c *LocksmithClient) SendPasswordReset(email string) error {
	b, _ := json.Marshal(map[string]string{"email": email})
	return c.doJSON(http.MethodPost, "/api/auth/password/reset", strings.NewReader(string(b)), nil, &struct {
		Success bool `json:"success"`
	}{})
}

// UpdatePassword completes a reset using the token from email.
func (c *LocksmithClient) UpdatePassword(token, newPassword string) error {
	b, _ := json.Marshal(map[string]string{"token": token, "newPassword": newPassword})
	return c.doJSON(http.MethodPost, "/api/auth/password/update", strings.NewReader(string(b)), nil, &struct {
		Success bool `json:"success"`
	}{})
}

// InitiateOAuth returns the provider authorization URL; redirect the user's browser there.
func (c *LocksmithClient) InitiateOAuth(provider string, redirectURL *string) (*struct {
	Provider           string `json:"provider"`
	AuthorizationURL   string `json:"authorizationUrl"`
}, error) {
	body := map[string]interface{}{}
	if redirectURL != nil && *redirectURL != "" {
		body["redirectUrl"] = *redirectURL
	}
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	var result struct {
		Provider           string `json:"provider"`
		AuthorizationURL   string `json:"authorizationUrl"`
	}
	path := "/api/auth/oauth/" + url.PathEscape(provider)
	if err := c.doJSON(http.MethodPost, path, strings.NewReader(string(b)), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ExchangeOAuthCode redeems the OAuth exchange code for Locksmith tokens (server-side).
func (c *LocksmithClient) ExchangeOAuthCode(code string) (*struct {
	User         User `json:"user"`
	AuthTokens
	Provider string `json:"provider"`
}, error) {
	b, _ := json.Marshal(map[string]string{"code": code})
	var result struct {
		User     User   `json:"user"`
		AuthTokens
		Provider string `json:"provider"`
	}
	if err := c.doJSON(http.MethodPost, "/api/auth/oauth/token", strings.NewReader(string(b)), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CompleteOidcGrant completes hosted OIDC after login/consent (Pro). Returns the browser redirect URL.
func (c *LocksmithClient) CompleteOidcGrant(requestToken string, approved bool, userID *string, scopes []string) (*struct {
	RedirectURL string `json:"redirectUrl"`
}, error) {
	body := map[string]interface{}{
		"requestToken": requestToken,
		"approved":     approved,
	}
	if userID != nil {
		body["userId"] = *userID
	}
	if len(scopes) > 0 {
		body["scopes"] = scopes
	}
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	var result struct {
		RedirectURL string `json:"redirectUrl"`
	}
	if err := c.doJSON(http.MethodPost, "/api/auth/oidc/grant", strings.NewReader(string(b)), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ── RBAC (public REST: X-API-Key + JSON bodies) ──────────────────────────────

// RoleAssignment is one entry from GET .../rbac/users/:id/roles
type RoleAssignment struct {
	Role       map[string]interface{} `json:"role"`
	AssignedAt string                 `json:"assignedAt"`
}

// ListRoles returns all project roles (with nested permissions).
func (c *LocksmithClient) ListRoles() ([]map[string]interface{}, error) {
	var out struct {
		Roles []map[string]interface{} `json:"roles"`
	}
	if err := c.doJSON(http.MethodGet, "/api/auth/rbac/roles", nil, nil, &out); err != nil {
		return nil, err
	}
	return out.Roles, nil
}

// GetRole fetches one role by id.
func (c *LocksmithClient) GetRole(roleID string) (map[string]interface{}, error) {
	var out struct {
		Role map[string]interface{} `json:"role"`
	}
	path := "/api/auth/rbac/roles/" + url.PathEscape(roleID)
	if err := c.doJSON(http.MethodGet, path, nil, nil, &out); err != nil {
		return nil, err
	}
	return out.Role, nil
}

// CreateRole creates a role; body fields match the REST API.
func (c *LocksmithClient) CreateRole(body map[string]interface{}) (map[string]interface{}, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	var out struct {
		Role map[string]interface{} `json:"role"`
	}
	if err := c.doJSON(http.MethodPost, "/api/auth/rbac/roles", strings.NewReader(string(b)), nil, &out); err != nil {
		return nil, err
	}
	return out.Role, nil
}

// UpdateRole PATCHes a role.
func (c *LocksmithClient) UpdateRole(roleID string, patch map[string]interface{}) (map[string]interface{}, error) {
	b, err := json.Marshal(patch)
	if err != nil {
		return nil, err
	}
	var out struct {
		Role map[string]interface{} `json:"role"`
	}
	path := "/api/auth/rbac/roles/" + url.PathEscape(roleID)
	if err := c.doJSON(http.MethodPatch, path, strings.NewReader(string(b)), nil, &out); err != nil {
		return nil, err
	}
	return out.Role, nil
}

// DeleteRole removes a non-system role.
func (c *LocksmithClient) DeleteRole(roleID string) error {
	path := "/api/auth/rbac/roles/" + url.PathEscape(roleID)
	return c.doJSON(http.MethodDelete, path, nil, nil, &struct{}{})
}

// SetRolePermissions replaces permission ids on a role.
func (c *LocksmithClient) SetRolePermissions(roleID string, permissionIDs []string) (map[string]interface{}, error) {
	b, _ := json.Marshal(map[string]interface{}{"permissionIds": permissionIDs})
	var out struct {
		Role map[string]interface{} `json:"role"`
	}
	path := fmt.Sprintf("/api/auth/rbac/roles/%s/permissions", url.PathEscape(roleID))
	if err := c.doJSON(http.MethodPut, path, strings.NewReader(string(b)), nil, &out); err != nil {
		return nil, err
	}
	return out.Role, nil
}

// ListPermissions returns all permission definitions.
func (c *LocksmithClient) ListPermissions() ([]map[string]interface{}, error) {
	var out struct {
		Permissions []map[string]interface{} `json:"permissions"`
	}
	if err := c.doJSON(http.MethodGet, "/api/auth/rbac/permissions", nil, nil, &out); err != nil {
		return nil, err
	}
	return out.Permissions, nil
}

// GetPermission fetches one permission by id.
func (c *LocksmithClient) GetPermission(permissionID string) (map[string]interface{}, error) {
	var out struct {
		Permission map[string]interface{} `json:"permission"`
	}
	path := "/api/auth/rbac/permissions/" + url.PathEscape(permissionID)
	if err := c.doJSON(http.MethodGet, path, nil, nil, &out); err != nil {
		return nil, err
	}
	return out.Permission, nil
}

// CreatePermission creates a permission key.
func (c *LocksmithClient) CreatePermission(body map[string]interface{}) (map[string]interface{}, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	var out struct {
		Permission map[string]interface{} `json:"permission"`
	}
	if err := c.doJSON(http.MethodPost, "/api/auth/rbac/permissions", strings.NewReader(string(b)), nil, &out); err != nil {
		return nil, err
	}
	return out.Permission, nil
}

// UpdatePermission PATCHes a permission.
func (c *LocksmithClient) UpdatePermission(permissionID string, patch map[string]interface{}) (map[string]interface{}, error) {
	b, err := json.Marshal(patch)
	if err != nil {
		return nil, err
	}
	var out struct {
		Permission map[string]interface{} `json:"permission"`
	}
	path := "/api/auth/rbac/permissions/" + url.PathEscape(permissionID)
	if err := c.doJSON(http.MethodPatch, path, strings.NewReader(string(b)), nil, &out); err != nil {
		return nil, err
	}
	return out.Permission, nil
}

// DeletePermission removes a permission.
func (c *LocksmithClient) DeletePermission(permissionID string) error {
	path := "/api/auth/rbac/permissions/" + url.PathEscape(permissionID)
	return c.doJSON(http.MethodDelete, path, nil, nil, &struct{}{})
}

// GetUserRoles returns role assignments (with assignedAt) for a user.
func (c *LocksmithClient) GetUserRoles(userID string) ([]RoleAssignment, error) {
	var out struct {
		Assignments []RoleAssignment `json:"assignments"`
	}
	path := fmt.Sprintf("/api/auth/rbac/users/%s/roles", url.PathEscape(userID))
	if err := c.doJSON(http.MethodGet, path, nil, nil, &out); err != nil {
		return nil, err
	}
	return out.Assignments, nil
}

// AssignRole adds one role to a user.
func (c *LocksmithClient) AssignRole(userID, roleID string) error {
	path := fmt.Sprintf("/api/auth/rbac/users/%s/roles/%s", url.PathEscape(userID), url.PathEscape(roleID))
	return c.doJSON(http.MethodPost, path, nil, nil, &struct{}{})
}

// RevokeRole removes one role from a user.
func (c *LocksmithClient) RevokeRole(userID, roleID string) error {
	path := fmt.Sprintf("/api/auth/rbac/users/%s/roles/%s", url.PathEscape(userID), url.PathEscape(roleID))
	return c.doJSON(http.MethodDelete, path, nil, nil, &struct{}{})
}

// SetUserRoles replaces all roles for a user.
func (c *LocksmithClient) SetUserRoles(userID string, roleIDs []string) ([]map[string]interface{}, error) {
	b, _ := json.Marshal(map[string]interface{}{"roleIds": roleIDs})
	var out struct {
		Roles []map[string]interface{} `json:"roles"`
	}
	path := fmt.Sprintf("/api/auth/rbac/users/%s/roles", url.PathEscape(userID))
	if err := c.doJSON(http.MethodPut, path, strings.NewReader(string(b)), nil, &out); err != nil {
		return nil, err
	}
	return out.Roles, nil
}
