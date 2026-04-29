# frozen_string_literal: true

module Locksmith
  class Error < StandardError
    attr_reader :code, :status

    def initialize(code, message, status)
      super(message)
      @code = code
      @status = status
    end
  end
end
