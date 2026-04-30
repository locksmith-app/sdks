# frozen_string_literal: true

lib = File.expand_path("lib", __dir__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require "locksmith/version"

Gem::Specification.new do |s|
  s.name = "locksmith-ruby"
  s.version = Locksmith::VERSION
  s.summary = "Ruby client for the Locksmith public auth API"
  s.description = "Official Ruby client for the Locksmith public authentication API (sign up, sign in, JWT, OAuth, magic links)."
  s.homepage = "https://getlocksmith.dev"
  s.authors = ["Locksmith"]
  s.license = "MIT"
  s.metadata = {
    "source_code_uri" => "https://github.com/locksmith-app/sdk-ruby"
  }
  s.required_ruby_version = ">= 3.1.0"
  s.files = Dir["lib/**/*.rb"]
  s.require_paths = ["lib"]

  s.add_dependency "jwt", "~> 2.8"
end
