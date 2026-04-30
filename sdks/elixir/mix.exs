defmodule Locksmith.MixProject do
  use Mix.Project

  def project do
    [
      app: :locksmith_ex,
      version: "0.1.0",
      elixir: "~> 1.15",
      description: "Official Elixir client for the Locksmith public authentication API",
      package: package(),
      deps: deps()
    ]
  end

  def application do
    [extra_applications: [:logger]]
  end

  defp package do
    [
      name: "locksmith_ex",
      licenses: ["MIT"],
      links: %{
        "Homepage" => "https://getlocksmith.dev",
        "GitHub" => "https://github.com/locksmith-app/sdks"
      }
    ]
  end

  defp deps do
    [
      {:req, "~> 0.5"},
      {:jason, "~> 1.4"},
      {:jose, "~> 1.11"},
      {:ex_doc, "~> 0.34", only: :dev, runtime: false}
    ]
  end
end
