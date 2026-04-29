defmodule Locksmith.MixProject do
  use Mix.Project

  def project do
    [
      app: :locksmith_ex,
      version: "0.1.0",
      elixir: "~> 1.15",
      deps: deps()
    ]
  end

  def application do
    [extra_applications: [:logger]]
  end

  defp deps do
    [
      {:req, "~> 0.5"},
      {:jason, "~> 1.4"},
      {:jose, "~> 1.11"}
    ]
  end
end
