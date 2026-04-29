# frozen_string_literal: true

require_relative "locksmith/version"
require_relative "locksmith/error"
require_relative "locksmith/client"

module Locksmith
  class << self
    def environment_from_api_key(api_key)
      return :production if api_key.to_s.start_with?("lsm_live_")
      return :sandbox if api_key.to_s.start_with?("lsm_sbx_")

      raise ArgumentError, "Invalid Locksmith API key: expected lsm_live_ or lsm_sbx_ prefix"
    end
  end
end
