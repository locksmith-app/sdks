# frozen_string_literal: true

lib = File.expand_path("lib", __dir__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require "locksmith/version"

Gem::Specification.new do |s|
  s.name = "locksmith-ruby"
  s.version = Locksmith::VERSION
  s.summary = "Ruby client for the Locksmith public auth API"
  s.authors = ["Locksmith"]
  s.license = "MIT"
  s.required_ruby_version = ">= 3.1.0"
  s.files = Dir["lib/**/*.rb"]
  s.require_paths = ["lib"]

  s.add_dependency "jwt", "~> 2.8"
end
