# Publishing Locksmith SDKs

Step-by-step checklist to get **public GitHub mirrors** wired to **public package registries**. This repo (`sdks/*`) is the source of truth; per-language repos (e.g. `github.com/locksmith-app/sdk-go`) are usually updated with `git subtree split` (see repo root `scripts/push-sdks-all.ps1` / `.sh` and `README.md`).

**Versioning:** Use **semver** and keep versions aligned across SDKs when you ship the same API surface. Bump each manifest (`package.json`, `Cargo.toml`, etc.), tag the **language repo** with `v0.2.0` (or tag the monorepo — pick one workflow and document it for your team).

**Before anything:** Ensure license files exist in each SDK root (`MIT` is assumed below) and that repository / homepage URLs in manifests point at the **actual** public GitHub repo users will clone.

---

## 0. Public GitHub repos (all languages)

1. Create or use org repos: `sdk-typescript`, `sdk-python`, `sdk-go`, … (see `scripts/create-sdk-repos.ps1` / `remotes.example.txt`).
2. Make each repo **Public** (GitHub → Settings → General → Danger zone is not required; visibility is under Settings).
3. From the **monorepo root**, add `git remote` entries and run:

   ```bash
   ./scripts/push-sdks-all.sh    # or push-sdks-all.ps1 on Windows
   ```

   Or mirror only: `./scripts/subtree-push.sh`.

4. Confirm `main` on each child repo has the same sources as `sdks/<lang>` here.

---

## 1. TypeScript / JavaScript — npm (`@locksmith/sdk`)

| Item | Value in this repo |
|------|-------------------|
| Package name | `@locksmith/sdk` (`sdks/typescript/package.json`) |
| Registry | https://www.npmjs.com/ |

### One-time setup

1. Create an **npm** account and enable **2FA** (required for publishes).
2. Create an npm **organization** named `locksmith` (required for the scoped name `@locksmith/sdk`), *or* change the package name to an unscoped name you own (e.g. `locksmith-sdk`) and update `package.json` + imports in docs.
3. Log in locally: `npm login` (or use a CI **Granular Access Token** / **Automation** token with publish rights to that package).

### Build & publish (manual)

```bash
cd sdks/typescript
npm ci
npm run build   # produces dist/
npm publish --access public
```

Use `--access public` the first time a scoped package is published.

### CI (recommended)

- GitHub Actions: on `release` or tag `v*`, run `npm ci`, `npm run build`, `npm publish` with `NPM_TOKEN` in secrets (`NODE_AUTH_TOKEN` for `actions/setup-node` with `registry-url: https://registry.npmjs.org`).

### Gotchas

- **Peer deps:** `next` and `@trpc/server` are optional peers; fine for npm metadata.
- Bump **`version`** in `package.json` before each publish.

---

## 2. Python — PyPI (`locksmith-py`)

| Item | Value in this repo |
|------|-------------------|
| Project name | `locksmith-py` (`sdks/python/pyproject.toml`) |
| Registry | https://pypi.org/ |

### One-time setup

1. Register at [PyPI](https://pypi.org/account/register/) (and [TestPyPI](https://test.pypi.org/) optional for dry runs).
2. Create an **API token** (scoped to project once the name exists, or whole account for first upload).
3. Optional: [trusted publishing](https://docs.pypi.org/trusted-publishers/) (OIDC from GitHub Actions — preferred long term).

### Build & publish (manual)

```bash
cd sdks/python
python -m pip install -U build twine
python -m build        # sdist + wheel in dist/
twine upload dist/*
```

Set `TWINE_USERNAME=__token__` and `TWINE_PASSWORD=pypi-...`.

### CI

- Upload from Actions with PyPI trusted publisher or `TWINE_PASSWORD` secret.

### Gotchas

- Package **import** path may be `locksmith` under `src/`; distribution name is `locksmith-py` — document `pip install locksmith-py` vs `import locksmith` clearly in README.

---

## 3. Go — module proxy (`github.com/locksmith-app/sdk-go`)

| Item | Value in this repo |
|------|-------------------|
| Module path | `github.com/locksmith-app/sdk-go` (`sdks/go/go.mod`) |
| Public repo | [github.com/locksmith-app/sdk-go](https://github.com/locksmith-app/sdk-go) |
| “Registry” | [pkg.go.dev](https://pkg.go.dev) indexes from **public Git tags** + proxy.sum.golang.org |

### One-time setup

**Module path in `go.mod` must match** the repo users clone and `go get` from — here, `github.com/locksmith-app/sdk-go`.

### Publish workflow

There is no separate “upload”: you **tag Git** on `sdk-go`.

```bash
cd /path/to/sdk-go   # mirrored repo root
git tag v0.1.0
git push origin v0.1.0
```

Consumers:

```bash
go get github.com/locksmith-app/sdk-go@v0.1.0
```

After a few minutes, refresh [pkg.go.dev/github.com/locksmith-app/sdk-go](https://pkg.go.dev/github.com/locksmith-app/sdk-go) (may need `go get` on the module once to trigger indexing).

### Gotchas

- Use **semantic-version tags** `vMAJOR.MINOR.PATCH`.
- Breaking changes → major version bump in module path (`/v2` suffix) per [Go module rules](https://go.dev/blog/v2-go-modules).

---

## 4. Rust — crates.io (`locksmith`)

| Item | Value in this repo |
|------|-------------------|
| Crate name | `locksmith` (`sdks/rust/Cargo.toml`) |
| Registry | https://crates.io |

### One-time setup

1. Create [crates.io](https://crates.io) account (GitHub login).
2. Run `cargo login` with an API token from account settings.
3. Check name availability: `locksmith` may already be taken — if so, rename in `Cargo.toml` (e.g. `locksmith-sdk`) and update docs.

4. Fill in `Cargo.toml` metadata for publishing:

   - `license = "MIT"` (already present)
   - Add `documentation`, `homepage`, `repository` URLs pointing to your **public** Rust repo
   - Consider `readme = "README.md"` and add a minimal README in `sdks/rust/`

### Publish (manual)

```bash
cd sdks/rust
cargo publish --dry-run   # sanity check
cargo publish
```

### Gotchas

- **Edition / MSRV** — document minimum Rust version if relevant.
- **repository** field currently points at a generic URL; crates.io expects the **exact** repo for this crate.

---

## 5. Ruby — RubyGems (`locksmith-ruby`)

| Item | Value in this repo |
|------|-------------------|
| Gem name | `locksmith-ruby` (`sdks/ruby/locksmith-ruby.gemspec`) |
| Registry | https://rubygems.org |

### One-time setup

1. Sign up at [rubygems.org](https://rubygems.org/sign_up).
2. `gem signin` (API key with MFA if enabled).

### Build & publish (manual)

```bash
cd sdks/ruby
gem build locksmith-ruby.gemspec
gem push locksmith-ruby-0.1.0.gem
```

### Gotchas

- Bump version in `lib/locksmith/version.rb` (referenced by the gemspec).
- Add `homepage`, `metadata["source_code_uri"]` in gemspec for better RubyGems listing.

---

## 6. PHP — Packagist (`locksmith/sdk-php`)

| Item | Value in this repo |
|------|-------------------|
| Package name | `locksmith/sdk-php` (`sdks/php/composer.json`) |
| Registry | https://packagist.org |

### One-time setup

1. Sign in to [Packagist](https://packagist.org) (GitHub OAuth).
2. **Submit** the public GitHub repository for `sdk-php`.
3. Enable the GitHub hook so new tags auto-update Packagist (recommended).

### Versioning

Composer uses **Git tags** (e.g. `v0.1.0` or `0.1.0`). Ensure:

```json
{
  "name": "locksmith/sdk-php",
  // ...
}
```

matches Packagist naming.

### Gotchas

- No `version` field required in `composer.json` when using VCS; tags drive versions.
- Add `autoload`, `license`, and a `README.md` in `sdks/php/` before first submit.

---

## 7. .NET — NuGet (`Locksmith.Sdk`)

| Item | Value in this repo |
|------|-------------------|
| Package id | Defaults from `AssemblyName`: `Locksmith.Sdk` (`sdks/dotnet/Locksmith.Sdk.csproj`) |
| Registry | https://www.nuget.org |

### One-time setup

1. Create account at [nuget.org](https://www.nuget.org/).
2. Create an **API key** (scoped to publish a specific package ID once created).
3. Add NuGet metadata to the csproj (recommended):

   - `PackageId`, `Authors`, `Description`, `PackageLicenseExpression` (or `PackageLicenseFile`), `PackageProjectUrl`, `RepositoryUrl`, `RepositoryType`, `PackageTags`

4. Enable packing:

   ```xml
   <PropertyGroup>
     <GeneratePackageOnBuild>false</GeneratePackageOnBuild>
     <!-- or true for local packs -->
   </PropertyGroup>
   ```

   Or use `dotnet pack` explicitly.

### Build & publish (manual)

```bash
cd sdks/dotnet
dotnet pack -c Release -o dist
dotnet nuget push dist/Locksmith.Sdk.0.1.0.nupkg -k YOUR_API_KEY -s https://api.nuget.org/v3/index.json
```

### CI

- Store `NUGET_API_KEY` in GitHub secrets; `dotnet nuget push` from Actions on tag.

### Gotchas

- Reserve the package **ID** on NuGet early (first push claims it).
- **Symbol packages** (`.snupkg`) optional for debug symbols.

---

## 8. Java — Maven Central (`app.locksmith:locksmith-java`)

| Item | Value in this repo |
|------|-------------------|
| Coordinates | `app.locksmith:locksmith-java:0.1.0` (`sdks/java/pom.xml`) |
| Registry | Maven Central via [Central Portal / OSSRH](https://central.sonatype.org/) |

### One-time setup (high level)

1. Register a **groupId** (e.g. `app.locksmith`) with Sonatype / Central Portal; prove domain ownership for `getlocksmith.dev` or use `io.github.<username>` reverse-DNS style if easier.
2. Generate a **GPG** key; distribute public key to keyserver; use **signing plugin** in Maven.
3. Add **`distributionManagement`** + **`maven-publish` or `nexus-staging`** flow (modern Central Portal uses new publisher API — follow current Sonatype docs).

### Minimal `pom.xml` additions (you must implement)

- `<packaging>jar</packaging>`
- License, developer, SCM, URL metadata (Central requirements)
- `maven-source-plugin`, `maven-javadoc-plugin` (for Central)
- `maven-gpg-plugin` (sign artifacts)
- Central publishing / staging plugin per current guide

This repo’s POM is **not yet release-ready**; treat Java as **extra config + infra** before first deploy.

### Publish (after setup)

```bash
cd sdks/java
mvn clean deploy -P release    # exact profile name depends on your pom
```

### Gotchas

- Longest path of all ecosystems; budget time for Sonatype ticket / namespace verification.

---

## 9. Kotlin (JVM) — Maven Central (`app.locksmith` — Gradle)

| Item | Value in this repo |
|------|-------------------|
| Group | `app.locksmith` (`sdks/kotlin/build.gradle.kts`) |
| Registry | Maven Central (same namespace story as Java) |

### One-time setup

1. Same **groupId / Sonatype / GPG** story as Java.
2. Add **`maven-publish`** + **`signing`** plugins in `build.gradle.kts`.
3. Configure publications (artifactId, version, sources jar, javadoc jar).

### Publish (typical)

```bash
cd sdks/kotlin
./gradlew publishToSonatype closeAndReleaseSonatypeStagingRepository
# exact tasks depend on nexus-publish plugin setup
```

### Gotchas

- Mirror Kotlin repo separately (`sdk-kotlin`); consumers use Gradle/Maven coordinates you define in the publication.

---

## 10. Dart / Flutter — pub.dev (`locksmith_dart`)

| Item | Value in this repo |
|------|-------------------|
| Package name | `locksmith_dart` (`sdks/dart/pubspec.yaml`) |
| Registry | https://pub.dev |

### One-time setup

1. Google account → sign in at [pub.dev](https://pub.dev).
2. **Verify** package name ownership (first publish claims `locksmith_dart` if free).

### Dry run & publish

```bash
cd sdks/dart
dart pub publish --dry-run
dart pub publish
```

### Gotchas

- Add `repository`, `homepage` in `pubspec.yaml` for points on pub.dev.
- Follow [pub.dev publishing checklist](https://dart.dev/tools/pub/publishing) (LICENSE, CHANGELOG, etc.).

---

## 11. Elixir — Hex (`locksmith_ex`)

| Item | Value in this repo |
|------|-------------------|
| App / package | `:locksmith_ex` (`sdks/elixir/mix.exs`) |
| Registry | https://hex.pm |

### One-time setup

1. `mix hex.user register` / login.
2. In `mix.exs`, add **`package`** metadata:

   ```elixir
   package: [
     name: "locksmith_ex",
     licenses: ["MIT"],
     links: %{"GitHub" => "https://github.com/..."}
   ]
   ```

   (Exact fields required by Hex — see Hex docs.)

### Publish

```bash
cd sdks/elixir
mix deps.get
mix hex.publish
```

### Gotchas

- Hex package name vs OTP app name can differ; document `{:locksmith_ex, "~> 0.1"}` in README.

---

## 12. Swift — Swift Package Manager (no separate store)

| Item | Value in this repo |
|------|-------------------|
| Product | `Locksmith` (`sdks/swift/Package.swift`) |
| Indexing | Xcode + SPM resolve from **Git URL + semvers** |

### One-time setup

1. Public Git repo for Swift sources (`sdk-swift`).
2. Tag releases: `git tag 0.1.0` (SPM often uses **no** `v` prefix — be consistent; many use `1.0.0` style).

### Consumer

```swift
.package(url: "https://github.com/<org>/sdk-swift.git", from: "0.1.0")
```

### Optional

- [Apple Swift Package Index](https://swiftpackageindex.com) — add repo for discoverability (separate process).

### Gotchas

- If you use binary targets or resources later, update `Package.swift` accordingly.

---

## 13. C++ (`sdks/cpp`)

No `CMakeLists.txt` / packaging was present in the tree at the time of writing. Pick a distribution model first:

- **vcpkg** port, **Conan**, or **fetchContent** + CMake install — then document version tags on a public repo.

Defer registry steps until a build system and ABI story exist.

---

## 14. Frontend app (separate repo)

The dashboard lives in **`frontend/`** (often `github.com/.../locksmith-app`). This is an **application**, not a library:

- Deploy (e.g. **Vercel**) and manage env vars; no npm “package publish” required unless you later extract shared packages.

---

## Suggested order (by friction)

1. **Go** — tag [sdk-go](https://github.com/locksmith-app/sdk-go) (`v*` semver tags).
2. **Swift SPM** — public repo + tags.
3. **npm** — org + token + one publish.
4. **PyPI** — token + `twine` / trusted publishing.
5. **RubyGems, NuGet, pub.dev, Hex, crates.io** — account + metadata polish + publish.
6. **Maven Central (Java + Kotlin)** — namespace + GPG + staging (do last).

---

## Release checklist (copy-paste)

- [ ] Bump versions in each SDK you are releasing.
- [ ] Update changelogs / READMEs.
- [ ] Push / mirror to public `sdk-*` repos.
- [ ] Tag each language repo (`v0.x.y` or ecosystem-appropriate).
- [ ] Run registry-specific publish (or trigger GitHub Action).
- [ ] Smoke-test install in a clean project per language.
- [ ] Verify docs site / OpenAPI references new version if applicable.
