use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const DEFAULT_BASE: &str = "https://uselocksmith.app";
const ISSUER: &str = "https://uselocksmith.app";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Production,
    Sandbox,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("locksmith: {code} ({status}): {message}")]
    Api {
        code: String,
        message: String,
        status: u16,
    },
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("invalid API key: must start with lsm_live_ or lsm_sbx_")]
    InvalidApiKey,
    #[error("invalid response: {0}")]
    InvalidResponse(String),
    #[error("jwt: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
}

pub type Result<T> = std::result::Result<T, Error>;

pub fn environment_from_api_key(api_key: &str) -> Result<Environment> {
    if api_key.starts_with("lsm_live_") {
        Ok(Environment::Production)
    } else if api_key.starts_with("lsm_sbx_") {
        Ok(Environment::Sandbox)
    } else {
        Err(Error::InvalidApiKey)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserBase {
    pub id: String,
    pub email: String,
    pub role: String,
    pub meta: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSignup {
    #[serde(flatten)]
    pub base: UserBase,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserLogin {
    #[serde(flatten)]
    pub base: UserBase,
    pub last_login_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserMe {
    #[serde(flatten)]
    pub base: UserBase,
    pub email_verified: bool,
    pub created_at: String,
    pub last_login_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignUpResult {
    pub user: UserSignup,
    #[serde(flatten)]
    pub tokens: AuthTokens,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInResult {
    pub user: UserLogin,
    #[serde(flatten)]
    pub tokens: AuthTokens,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MagicLinkVerifyResult {
    pub user: UserSignup,
    #[serde(flatten)]
    pub tokens: AuthTokens,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenPayload {
    pub sub: String,
    pub email: String,
    pub role: String,
    pub environment: Environment,
    pub meta: HashMap<String, serde_json::Value>,
    pub aud: String,
    pub iss: String,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Deserialize)]
struct Envelope<T> {
    data: T,
}

#[derive(Deserialize)]
struct ApiErrBody {
    error: Option<String>,
    message: Option<String>,
}

/// Async HTTP client for the Locksmith `/api/auth/*` API.
pub struct LocksmithClient {
    api_key: String,
    base_url: String,
    http: reqwest::Client,
    pub environment: Environment,
}

impl LocksmithClient {
    pub fn new(api_key: impl Into<String>, base_url: Option<&str>) -> Result<Self> {
        let api_key = api_key.into();
        let environment = environment_from_api_key(&api_key)?;
        let base = base_url
            .unwrap_or(DEFAULT_BASE)
            .trim_end_matches('/')
            .to_string();
        Ok(Self {
            api_key,
            base_url: base,
            http: reqwest::Client::builder()
                .use_rustls_tls()
                .build()?,
            environment,
        })
    }

    fn url(&self, path: &str) -> String {
        let p = if path.starts_with('/') {
            path.to_string()
        } else {
            format!("/{path}")
        };
        format!("{}{p}", self.base_url)
    }

    async fn request_json<T: DeserializeOwned>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
        extra_headers: Option<Vec<(&str, String)>>,
    ) -> Result<T> {
        let mut req = self
            .http
            .request(method, self.url(path))
            .header("X-API-Key", &self.api_key);
        if let Some(h) = extra_headers {
            for (k, v) in h {
                req = req.header(k, v);
            }
        }
        if let Some(b) = body {
            req = req
                .header("Content-Type", "application/json")
                .json(&b);
        }
        let res = req.send().await?;
        self.parse_envelope(res).await
    }

    async fn parse_envelope<T: DeserializeOwned>(&self, res: reqwest::Response) -> Result<T> {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        let v: serde_json::Value = serde_json::from_str(&text).unwrap_or(serde_json::json!({}));
        if !status.is_success() {
            let err: ApiErrBody = serde_json::from_value(v.clone()).unwrap_or(ApiErrBody {
                error: None,
                message: None,
            });
            return Err(Error::Api {
                code: err.error.unwrap_or_else(|| "unknown_error".into()),
                message: err
                    .message
                    .unwrap_or_else(|| status.canonical_reason().unwrap_or("error").into()),
                status: status.as_u16(),
            });
        }
        let envelope: Envelope<T> =
            serde_json::from_value(v).map_err(|e| Error::InvalidResponse(e.to_string()))?;
        Ok(envelope.data)
    }

    pub async fn sign_up(
        &self,
        email: &str,
        password: &str,
        meta: Option<serde_json::Value>,
    ) -> Result<SignUpResult> {
        let mut body = serde_json::json!({ "email": email, "password": password });
        if let Some(m) = meta {
            body["meta"] = m;
        }
        self.request_json(reqwest::Method::POST, "/api/auth/signup", Some(body), None)
            .await
    }

    pub async fn sign_in(&self, email: &str, password: &str) -> Result<SignInResult> {
        let body = serde_json::json!({ "email": email, "password": password });
        self.request_json(reqwest::Method::POST, "/api/auth/login", Some(body), None)
            .await
    }

    pub async fn sign_out(&self, refresh_token: &str) -> Result<()> {
        let body = serde_json::json!({ "refreshToken": refresh_token });
        let _v: serde_json::Value = self
            .request_json(reqwest::Method::POST, "/api/auth/logout", Some(body), None)
            .await?;
        Ok(())
    }

    pub async fn refresh(&self, refresh_token: &str) -> Result<AuthTokens> {
        let body = serde_json::json!({ "refreshToken": refresh_token });
        self.request_json(reqwest::Method::POST, "/api/auth/refresh", Some(body), None)
            .await
    }

    pub async fn get_user(&self, access_token: &str) -> Result<UserMe> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Me {
            user: UserMe,
        }
        let me: Me = self
            .request_json(
                reqwest::Method::GET,
                "/api/auth/me",
                None,
                Some(vec![(
                    "Authorization",
                    format!("Bearer {access_token}"),
                )]),
            )
            .await?;
        Ok(me.user)
    }

    pub fn verify_token(access_token: &str, public_key_pem: &str) -> Result<TokenPayload> {
        let key = DecodingKey::from_rsa_pem(public_key_pem.as_bytes())?;
        let mut val = Validation::new(Algorithm::RS256);
        val.set_issuer(&[ISSUER]);
        let t = decode::<TokenPayload>(access_token, &key, &val)?;
        Ok(t.claims)
    }

    pub async fn send_magic_link(
        &self,
        email: &str,
        create_if_not_exists: Option<bool>,
    ) -> Result<()> {
        let mut body = serde_json::json!({ "email": email });
        if let Some(b) = create_if_not_exists {
            body["createIfNotExists"] = serde_json::json!(b);
        }
        let _v: serde_json::Value = self
            .request_json(
                reqwest::Method::POST,
                "/api/auth/magic-link",
                Some(body),
                None,
            )
            .await?;
        Ok(())
    }

    pub async fn verify_magic_link(
        &self,
        token: &str,
        project_id: &str,
    ) -> Result<MagicLinkVerifyResult> {
        let res = self
            .http
            .get(self.url("/api/auth/magic-link/verify"))
            .query(&[("token", token), ("project", project_id)])
            .send()
            .await?;
        self.parse_envelope(res).await
    }

    pub async fn send_password_reset(&self, email: &str) -> Result<()> {
        let body = serde_json::json!({ "email": email });
        let _v: serde_json::Value = self
            .request_json(
                reqwest::Method::POST,
                "/api/auth/password/reset",
                Some(body),
                None,
            )
            .await?;
        Ok(())
    }

    pub async fn update_password(&self, token: &str, new_password: &str) -> Result<()> {
        let body = serde_json::json!({ "token": token, "newPassword": new_password });
        let _v: serde_json::Value = self
            .request_json(
                reqwest::Method::POST,
                "/api/auth/password/update",
                Some(body),
                None,
            )
            .await?;
        Ok(())
    }
}
