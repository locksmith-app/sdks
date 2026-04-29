# frozen_string_literal: true

require "json"
require "net/http"
require "uri"
require "jwt"

module Locksmith
  DEFAULT_BASE = "https://uselocksmith.app"
  ISSUER = "https://uselocksmith.app"

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

    private

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
