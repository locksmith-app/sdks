# GitHub Actions secrets — SDK publishing

Add these in **GitHub → your repo → Settings → Secrets and variables → Actions → New repository secret**.

Jobs **skip** when their secret is empty, so you can enable registries incrementally.

### Version (no secret)

The workflow **resolve-version** job picks a single semver for every SDK: **GitHub Release** tag, manual **sdk_version**, or **max(published registries + `sdks/SDK_VERSION`) + bump**. See `scripts/sdk-version.mjs` and the **Publish SDKs** workflow `workflow_dispatch` inputs.

| Secret | Registry | How to obtain |
|--------|----------|----------------|
| `NPM_TOKEN` | [npm](https://www.npmjs.com/) — `@getlocksmith/sdk` | npm → Access Tokens → **Granular Access Token** (Automation), permission **Publish** on that package (or org). |
| `PYPI_API_TOKEN` | [PyPI](https://pypi.org/) — `locksmith-py` | PyPI → Account settings → API tokens → token scoped to `locksmith-py` (or whole account for first publish). The action uses trusted upload-style token (`pypi-…`). |
| `CRATES_IO_TOKEN` | [crates.io](https://crates.io/) — `getlocksmith` | crates.io → Account Settings → API Token. |
| `NUGET_API_KEY` | [NuGet](https://www.nuget.org/) — `Locksmith.Sdk` | nuget.org → Account → API keys → push scoped to `Locksmith.Sdk`. |
| `PUB_CREDENTIALS_JSON` | [pub.dev](https://pub.dev/) — `locksmith_dart` | **Not** a GCP service account. OAuth token file from **`dart pub login`** (browser): **Windows** → `%APPDATA%\dart\pub-credentials.json` (`C:\Users\<you>\AppData\Roaming\dart\…`); **macOS** → `~/Library/Application Support/dart/pub-credentials.json`; **Linux** → `~/.config/dart/pub-credentials.json`. Paste the **whole file** into the secret. **Preferred:** [Automated publishing](https://dart.dev/tools/pub/automated-publishing) (GitHub OIDC, no long-lived JSON). **GCP:** same doc describes `gcloud auth print-identity-token` + `dart pub token add` for Cloud Build. |
| `HEX_API_KEY` | [Hex.pm](https://hex.pm/) — `locksmith_ex` | Locally: `mix hex.user auth` / API key from Hex dashboard → use the key Hex shows for automation. |
| `PACKAGIST_USERNAME` | [Packagist](https://packagist.org/) | Your Packagist **username** (same as profile URL). |
| `PACKAGIST_API_TOKEN` | Packagist | Packagist → Profile → Show API token. Used to **trigger an update** so Composer sees new tags on your `sdk-php` Git repo. |

### Packagist “not auto-updated” / GitHub hook

If [your package](https://packagist.org/packages/locksmith/sdk-php) says **“This package is not auto-updated”**, Packagist is not receiving webhooks when you push or tag the **GitHub repo that Packagist tracks** (for example `github.com/locksmith-app/sdk-php`).

Do one of the following:

1. **GitHub integration (preferred)** — On Packagist, open the package → **Settings** → connect **GitHub** and grant access so Packagist can register a webhook on that repo. After that, pushes and new tags refresh the package automatically. See [How to update packages](https://packagist.org/about#how-to-update-packages) on Packagist.
2. **This workflow** — Keep `PACKAGIST_USERNAME` and `PACKAGIST_API_TOKEN` set so the **Refresh Packagist** job calls the Packagist **update-package** API after a release (same effect as clicking “Update” on the package page).

The API token refresh does **not** replace the webhook long-term; it only triggers one update per workflow run.

### Optional repository variable

| Variable | Purpose |
|----------|---------|
| `PACKAGIST_REPOSITORY_URL` | Overrides the default `https://github.com/locksmith-app/sdk-php` used in the Packagist refresh job. |

### Not automated in this workflow

- **Go** — Modules are published by **Git tags** on `github.com/locksmith-app/sdk-go` (see `sdks/PUBLISHING.md`). The workflow only runs `go test` for sanity.
- **RubyGems** — **`locksmith-ruby`** is **not** published by this workflow. Build locally with `gem build` / `gem push` (or add your own job); see `sdks/PUBLISHING.md`.
- **Java / Kotlin (Maven Central)** — Needs Sonatype namespace, GPG signing, and `distributionManagement` / Gradle `maven-publish`. The workflow only **build-verifies** those SDKs until you extend it.
- **Swift** — Distributed via **Git + semver tags** on your Swift mirror repo, not a binary registry. The workflow runs `swift build` only.

### Where workflows run

Publishing workflows can live in a **private** clone used only for CI (so registry secrets stay off the public monorepo). Add a second remote locally (Git allows only one `origin` — use another name, e.g. `sdks-actions`):

```bash
git remote add sdks-actions https://github.com/CoyoteCodesAlot/locksmith-sdks-actions.git
git push sdks-actions main
```

Authenticate with a **fine-grained PAT** or `gh auth login`; store **registry** tokens (`NPM_TOKEN`, `PYPI_API_TOKEN`, etc.) only under that repo’s **Settings → Secrets and variables → Actions**. **Never commit PATs or embed them in remote URLs** in tracked files.

If a PAT was ever pasted into chat or committed, **revoke it** in GitHub → Settings → Developer settings → Tokens and create a new one.

### Before each release

1. Bump the version in each SDK you are shipping (`package.json`, `pyproject.toml`, `Cargo.toml`, `version.rb`, `pubspec.yaml`, `.csproj`, `mix.exs`, and Composer tags as applicable).
2. For PHP, tag the **`sdk-php`** repository; then either rely on the Packagist GitHub hook or run this workflow so **Refresh Packagist** picks up the tag.
3. Run **Actions → Publish SDKs → Run workflow**, or publish a **GitHub Release** (same workflow listens for `release: published`).
