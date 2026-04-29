defmodule Locksmith do
  @moduledoc """
  Client for the Locksmith public authentication API.
  """

  alias Locksmith.Client

  defdelegate new(api_key, opts \\ []), to: Client
  defdelegate environment_from_api_key(key), to: Client
  defdelegate sign_up(c, email, password, meta \\ nil), to: Client
  defdelegate sign_in(c, email, password), to: Client
  defdelegate sign_out(c, refresh_token), to: Client
  defdelegate refresh(c, refresh_token), to: Client
  defdelegate get_user(c, access_token), to: Client
  defdelegate verify_token(access_token, public_key_pem), to: Client
  defdelegate send_magic_link(c, email, opts \\ []), to: Client
  defdelegate verify_magic_link(c, token, project_id), to: Client
  defdelegate send_password_reset(c, email), to: Client
  defdelegate update_password(c, token, new_password), to: Client
  defdelegate base_url(c), to: Client
end
