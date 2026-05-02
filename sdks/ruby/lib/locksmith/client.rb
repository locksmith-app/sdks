# frozen_string_literal: true

require "erb"
require "json"
require "net/http"
require "uri"
require "jwt"

module Locksmith
  DEFAULT_BASE = "https://getlocksmith.dev"
  ISSUER = "https://getlocksmith.dev"

  class Client
    attr_reader :api_key, :base_url, :environment

    def initialize(api_key:, base_url: nil)
      @environment = Locksmith.environment_from_api_key(api_key)
      @api_key = api_key
      @base_url = (base_url || DEFAULT_BASE).sub(%r{/+\z}, "")
    end

    def sign_up(email:, password:, meta: nil)
      body = { "email" => email, "password" => password }
      body["meta"] = meta if meta
      post_json("/api/auth/signup", body)
    end

    def sign_in(email:, password:)
      post_json("/api/auth/login", "email" => email, "password" => password)
    end

    def sign_out(refresh_token)
      post_json("/api/auth/logout", "refreshToken" => refresh_token)
      nil
    end

    def refresh(refresh_token)
      post_json("/api/auth/refresh", "refreshToken" => refresh_token)
    end

    def get_user(access_token)
      data = request_json(:get, "/api/auth/me", nil, "Authorization" => "Bearer #{access_token}")
      data["user"]
    end

    def verify_token(access_token, public_key_pem)
      payload, = JWT.decode(
        access_token,
        OpenSSL::PKey::RSA.new(public_key_pem),
        true,
        { algorithm: "RS256", verify_iat: true, iss: ISSUER, verify_iss: true }
      )
      payload
    end

    def send_magic_link(email, create_if_not_exists: nil)
      body = { "email" => email }
      body["createIfNotExists"] = create_if_not_exists unless create_if_not_exists.nil?
      post_json("/api/auth/magic-link", body)
      nil
    end

    def verify_magic_link(token:, project_id:)
      uri = URI("#{@base_url}/api/auth/magic-link/verify")
      uri.query = URI.encode_www_form("token" => token, "project" => project_id)
      parse_envelope(get_no_key(uri))
    end

    def send_password_reset(email)
      post_json("/api/auth/password/reset", "email" => email)
      nil
    end

    def update_password(token:, new_password:)
      post_json("/api/auth/password/update", "token" => token, "newPassword" => new_password)
      nil
    end

    def initiate_oauth(provider:, redirect_url: nil)
      body = {}
      body["redirectUrl"] = redirect_url unless redirect_url.nil?
      post_json("/api/auth/oauth/#{provider}", body)
    end

    def exchange_oauth_code(code)
      post_json("/api/auth/oauth/token", "code" => code)
    end

    def complete_oidc_grant(request_token:, approved:, user_id: nil, scopes: nil)
      body = { "requestToken" => request_token, "approved" => approved }
      body["userId"] = user_id unless user_id.nil?
      body["scopes"] = scopes unless scopes.nil?
      post_json("/api/auth/oidc/grant", body)
    end

    # ── RBAC ─────────────────────────────────────────────────────────────────

    def list_roles
      parse_envelope(request_json(:get, "/api/auth/rbac/roles", nil))["roles"]
    end

    def get_role(role_id)
      parse_envelope(request_json(:get, "/api/auth/rbac/roles/#{path_esc(role_id)}", nil))["role"]
    end

    def create_role(name:, description: nil, color: nil, is_default: nil)
      body = { "name" => name }
      body["description"] = description unless description.nil?
      body["color"] = color unless color.nil?
      body["isDefault"] = is_default unless is_default.nil?
      parse_envelope(request_json(:post, "/api/auth/rbac/roles", JSON.generate(body)))["role"]
    end

    def update_role(role_id, **patch)
      body = {}
      patch.each do |k, v|
        key = k.to_s
        key = "isDefault" if key == "is_default"
        body[key] = v
      end
      path = "/api/auth/rbac/roles/#{path_esc(role_id)}"
      parse_envelope(request_json(:patch, path, JSON.generate(body)))["role"]
    end

    def delete_role(role_id)
      path = "/api/auth/rbac/roles/#{path_esc(role_id)}"
      parse_envelope(request_json(:delete, path, nil))
      nil
    end

    def set_role_permissions(role_id, permission_ids)
      path = "/api/auth/rbac/roles/#{path_esc(role_id)}/permissions"
      body = { "permissionIds" => permission_ids }
      parse_envelope(request_json(:put, path, JSON.generate(body)))["role"]
    end

    def list_permissions
      parse_envelope(request_json(:get, "/api/auth/rbac/permissions", nil))["permissions"]
    end

    def get_permission(permission_id)
      path = "/api/auth/rbac/permissions/#{path_esc(permission_id)}"
      parse_envelope(request_json(:get, path, nil))["permission"]
    end

    def create_permission(key:, name:, description: nil, category: nil)
      body = { "key" => key, "name" => name }
      body["description"] = description unless description.nil?
      body["category"] = category unless category.nil?
      parse_envelope(request_json(:post, "/api/auth/rbac/permissions", JSON.generate(body)))["permission"]
    end

    def update_permission(permission_id, **patch)
      body = {}
      patch.each { |k, v| body[k.to_s] = v }
      path = "/api/auth/rbac/permissions/#{path_esc(permission_id)}"
      parse_envelope(request_json(:patch, path, JSON.generate(body)))["permission"]
    end

    def delete_permission(permission_id)
      path = "/api/auth/rbac/permissions/#{path_esc(permission_id)}"
      parse_envelope(request_json(:delete, path, nil))
      nil
    end

    def get_user_roles(user_id)
      path = "/api/auth/rbac/users/#{path_esc(user_id)}/roles"
      parse_envelope(request_json(:get, path, nil))["assignments"]
    end

    def assign_role(user_id, role_id)
      path = "/api/auth/rbac/users/#{path_esc(user_id)}/roles/#{path_esc(role_id)}"
      parse_envelope(request_json(:post, path, nil))
      nil
    end

    def revoke_role(user_id, role_id)
      path = "/api/auth/rbac/users/#{path_esc(user_id)}/roles/#{path_esc(role_id)}"
      parse_envelope(request_json(:delete, path, nil))
      nil
    end

    def set_user_roles(user_id, role_ids)
      path = "/api/auth/rbac/users/#{path_esc(user_id)}/roles"
      body = { "roleIds" => role_ids }
      parse_envelope(request_json(:put, path, JSON.generate(body)))["roles"]
    end

    def self.token_has_role?(payload, role)
      roles = payload["roles"]
      return roles.include?(role) if roles.is_a?(Array)

      payload["role"] == role
    end

    def self.token_has_permission?(payload, permission)
      perms = payload["permissions"]
      perms.is_a?(Array) && perms.include?(permission)
    end

    private

    def path_esc(seg)
      ERB::Util.url_encode(seg.to_s).tr("+", "%20")
    end

    def url(path)
      p = path.start_with?("/") ? path : "/#{path}"
      "#{@base_url}#{p}"
    end

    def post_json(path, body)
      parse_envelope request_json(:post, path, JSON.generate(body))
    end

    def request_json(method, path, body_string = nil, extra_headers = {})
      uri = URI(url(path))
      klass = case method
              when :post then Net::HTTP::Post
              when :get then Net::HTTP::Get
              when :patch then Net::HTTP::Patch
              when :put then Net::HTTP::Put
              when :delete then Net::HTTP::Delete
              else raise ArgumentError, method.to_s
              end
      req = klass.new(uri)
      req["X-API-Key"] = @api_key
      req["Content-Type"] = "application/json" if body_string
      extra_headers.each { |k, v| req[k] = v }
      req.body = body_string if body_string

      Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == "https") do |http|
        http.request(req)
      end
    end

    def get_no_key(uri)
      req = Net::HTTP::Get.new(uri)
      Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == "https") do |http|
        http.request(req)
      end
    end

    def parse_envelope(response)
      body = response.body.to_s
      data = body.empty? ? {} : JSON.parse(body)
      unless response.is_a?(Net::HTTPSuccess)
        raise Error.new(
          data["error"] || "unknown_error",
          data["message"] || response.message,
          response.code.to_i
        )
      end
      raise Error.new("invalid_response", "Expected envelope { data }", response.code.to_i) unless data.key?("data")

      data["data"]
    end
  end
end
