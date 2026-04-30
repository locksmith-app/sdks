defmodule Locksmith.Client do
  @moduledoc false

  @default_base "https://getlocksmith.dev"
  @issuer "https://getlocksmith.dev"

  defstruct [:api_key, :base_url, :environment]

  def new(api_key, opts \\ []) when is_binary(api_key) do
    base = opts |> Keyword.get(:base_url, @default_base) |> String.trim_trailing("/")
    %__MODULE__{api_key: api_key, base_url: base, environment: environment_from_api_key(api_key)}
  end

  def base_url(%__MODULE__{base_url: b}), do: b

  def environment_from_api_key(key) do
    cond do
      String.starts_with?(key, "lsm_live_") -> :production
      String.starts_with?(key, "lsm_sbx_") -> :sandbox
      true -> raise ArgumentError, "Invalid Locksmith API key."
    end
  end

  def sign_up(%__MODULE__{} = c, email, password, meta \\ nil) do
    body = %{"email" => email, "password" => password}
    body = if meta, do: Map.put(body, "meta", meta), else: body
    post(c, "/api/auth/signup", body)
  end

  def sign_in(%__MODULE__{} = c, email, password) do
    post(c, "/api/auth/login", %{"email" => email, "password" => password})
  end

  def sign_out(%__MODULE__{} = c, refresh_token) do
    _ = post(c, "/api/auth/logout", %{"refreshToken" => refresh_token})
    :ok
  end

  def refresh(%__MODULE__{} = c, refresh_token) do
    post(c, "/api/auth/refresh", %{"refreshToken" => refresh_token})
  end

  def get_user(%__MODULE__{} = c, access_token) do
    data =
      get_with_headers(c, "/api/auth/me", [
        {"authorization", "Bearer #{access_token}"}
      ])

    data["user"]
  end

  def verify_token(access_token, public_key_pem) do
    jwk = JOSE.JWK.from_pem(public_key_pem)

    case JOSE.JWT.verify_compact(access_token, jwk) do
      {true, jose_jwt, _jws} ->
        {_header, claims} = JOSE.JWT.to_map(jose_jwt)

        if claims["iss"] == @issuer do
          claims
        else
          verify_fail()
        end

      _ ->
        verify_fail()
    end
  end

  defp verify_fail, do: raise(Locksmith.Error, code: "invalid_token", message: "JWT verify failed", status: 401)

  def send_magic_link(%__MODULE__{} = c, email, opts \\ []) do
    body = %{"email" => email}

    body =
      if Keyword.has_key?(opts, :create_if_not_exists) do
        Map.put(body, "createIfNotExists", Keyword.fetch!(opts, :create_if_not_exists))
      else
        body
      end

    _ = post(c, "/api/auth/magic-link", body)
    :ok
  end

  def verify_magic_link(%__MODULE__{} = c, token, project_id) do
    q = URI.encode_query(%{"token" => token, "project" => project_id})
    url = c.base_url <> "/api/auth/magic-link/verify?" <> q

    case Req.get(url) do
      {:ok, %{status: s} = resp} when s in 200..299 ->
        parse_body(resp.body)

      {:ok, %{status: s, body: b}} ->
        raise Locksmith.Error,
          code: Map.get(b, "error", "unknown_error"),
          message: Map.get(b, "message", "Request failed"),
          status: s

      {:error, e} ->
        raise Locksmith.Error,
          code: "network_error",
          message: Exception.message(e),
          status: 0
    end
  end

  def send_password_reset(%__MODULE__{} = c, email) do
    _ = post(c, "/api/auth/password/reset", %{"email" => email})
    :ok
  end

  def update_password(%__MODULE__{} = c, token, new_password) do
    _ =
      post(c, "/api/auth/password/update", %{
        "token" => token,
        "newPassword" => new_password
      })

    :ok
  end

  def initiate_oauth(%__MODULE__{} = c, provider, opts \\ []) do
    body =
      case Keyword.get(opts, :redirect_url) do
        nil -> %{}
        u -> %{"redirectUrl" => u}
      end

    path = "/api/auth/oauth/" <> URI.encode(provider, &URI.char_unreserved?/1)
    post(c, path, body)
  end

  def exchange_oauth_code(%__MODULE__{} = c, code) do
    post(c, "/api/auth/oauth/token", %{"code" => code})
  end

  def complete_oidc_grant(%__MODULE__{} = c, request_token, approved, opts \\ []) do
    body =
      %{
        "requestToken" => request_token,
        "approved" => approved
      }
      |> put_user_id_opt(Keyword.get(opts, :user_id))
      |> put_scopes_opt(Keyword.get(opts, :scopes))

    post(c, "/api/auth/oidc/grant", body)
  end

  defp put_user_id_opt(m, nil), do: m
  defp put_user_id_opt(m, v), do: Map.put(m, "userId", v)

  defp put_scopes_opt(m, nil), do: m
  defp put_scopes_opt(m, []), do: m
  defp put_scopes_opt(m, list) when is_list(list), do: Map.put(m, "scopes", list)

  defp post(c, path, body) do
    %__MODULE__{api_key: k, base_url: base} = c
    url = base <> path

    case Req.post(url, json: body, headers: [{"x-api-key", k}]) do
      {:ok, %{status: s} = resp} when s in 200..299 -> parse_body(resp.body)
      {:ok, %{status: s, body: b}} -> api_error(s, b)
      {:error, e} -> network_error(e)
    end
  end

  defp get_with_headers(c, path, extra) do
    %__MODULE__{api_key: k, base_url: base} = c
    url = base <> path
    headers = [{"x-api-key", k} | extra]

    case Req.get(url, headers: headers) do
      {:ok, %{status: s} = resp} when s in 200..299 -> parse_body(resp.body)
      {:ok, %{status: s, body: b}} -> api_error(s, b)
      {:error, e} -> network_error(e)
    end
  end

  defp parse_body(%{"data" => data}), do: data
  defp parse_body(body) when is_map(body), do: raise(Locksmith.Error, code: "invalid_response", message: "Expected data", status: 200)

  defp api_error(s, b) when is_map(b) do
    raise Locksmith.Error,
      code: Map.get(b, "error", "unknown_error"),
      message: Map.get(b, "message", "Request failed"),
      status: s
  end

  defp api_error(s, _), do: raise(Locksmith.Error, code: "unknown_error", message: "Request failed", status: s)

  defp network_error(e) do
    raise Locksmith.Error, code: "network_error", message: Exception.message(e), status: 0
  end
end
