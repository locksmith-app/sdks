# GitHub Actions secrets — SDK publishing

Add these in **GitHub → your repo → Settings → Secrets and variables → Actions → New repository secret**.

Jobs **skip** when their secret is empty, so you can enable registries incrementally.

| Secret | Registry | How to obtain |
|--------|----------|----------------|
| `NPM_TOKEN` | [npm](https://www.npmjs.com/) — `@getlocksmith/sdk` | npm → Access Tokens → **Granular Access Token** (Automation), permission **Publish** on that package (or org). |
| `PYPI_API_TOKEN` | [PyPI](https://pypi.org/) — `locksmith-py` | PyPI → Account settings → API tokens → token scoped to `locksmith-py` (or whole account for first publish). The action uses trusted upload-style token (`pypi-…`). |
| `CRATES_IO_TOKEN` | [crates.io](https://crates.io/) — `getlocksmith` | crates.io → Account Settings → API Token. |
| `RUBYGEMS_API_KEY` | [RubyGems](https://rubygems.org/) — `locksmith-ruby` | RubyGems → Edit profile → API Access. CI sets **`GEM_HOST_API_KEY`** from this value. |
| `NUGET_API_KEY` | [NuGet](https://www.nuget.org/) — `Locksmith.Sdk` | nuget.org → Account → API keys → push scoped to `Locksmith.Sdk`. |
| `PUB_CREDENTIALS_JSON` | [pub.dev](https://pub.dev/) — `locksmith_dart` | On a machine with Dart: `dart pub login`, then copy **`~/.config/dart/pub-credentials.json`** (entire file) as one secret. Ensure `LICENSE` and pub checklist are satisfied before first publish. |
| `HEX_API_KEY` | [Hex.pm](https://hex.pm/) — `locksmith_ex` | Locally: `mix hex.user auth` / API key from Hex dashboard → use the key Hex shows for automation. |
| `PACKAGIST_USERNAME` | [Packagist](https://packagist.org/) | Your Packagist **username** (same as profile URL). |
| `PACKAGIST_API_TOKEN` | Packagist | Packagist → Profile → Show API token. Used to **trigger an update** so Composer sees new tags on your `sdk-php` Git repo. |

### Optional repository variable

| Variable | Purpose |
|----------|---------|
| `PACKAGIST_REPOSITORY_URL` | Overrides the default `https://github.com/locksmith-app/sdk-php` used in the Packagist refresh job. |

### Not automated in this workflow

- **Go** — Modules are published by **Git tags** on `github.com/locksmith-app/sdk-go` (see `sdks/PUBLISHING.md`). The workflow only runs `go test` for sanity.
- **Java / Kotlin (Maven Central)** — Needs Sonatype namespace, GPG signing, and `distributionManagement` / Gradle `maven-publish`. The workflow only **build-verifies** those SDKs until you extend it.
- **Swift** — Distributed via **Git + semver tags** on your Swift mirror repo, not a binary registry. The workflow runs `swift build` only.

### Before each release

1. Bump the version in each SDK you are shipping (`package.json`, `pyproject.toml`, `Cargo.toml`, `version.rb`, `pubspec.yaml`, `.csproj`, `mix.exs`, and Composer tags as applicable).
2. For PHP, tag the **`sdk-php`** repository; then either rely on the Packagist GitHub hook or run this workflow so **Refresh Packagist** picks up the tag.
3. Run **Actions → Publish SDKs → Run workflow**, or publish a **GitHub Release** (same workflow listens for `release: published`).
