# Locksmith SDKs (organization monorepo)

Official client libraries for the [Locksmith](https://getlocksmith.dev) public auth API (`/api/auth/*`).

The **dashboard / Next.js app is not in this repository**; it is developed and hosted under a separate GitHub account to keep org costs minimal.

## Layout

| Path | Language | Registry (typical) |
|------|----------|--------------------|
| `sdks/typescript` | TypeScript / Node | npm `@getlocksmith/sdk` |
| `sdks/python` | Python | PyPI `locksmith-py` |
| `sdks/go` | Go | `go get github.com/locksmith-app/sdk-go` |
| `sdks/rust` | Rust | crates.io `getlocksmith` |
| `sdks/ruby` | Ruby | RubyGems `locksmith-ruby` |
| `sdks/php` | PHP | Packagist `locksmith/sdk-php` |
| `sdks/dotnet` | C# / .NET | NuGet (TBD) |
| `sdks/java` | Java | Maven Central (TBD) |
| `sdks/kotlin` | Kotlin (JVM) | Maven Central (TBD) |
| `sdks/dart` | Dart | pub.dev (TBD) |
| `sdks/elixir` | Elixir | Hex (TBD) |
| `sdks/swift` | Swift | Swift Package Manager |

## Splitting into one repo per language (`git subtree`)

This monorepo is the **source of truth**. Per-language repos under `https://github.com/locksmith-app` can be updated with `git subtree split` (history for that subtree only; the child repo root matches `sdks/<lang>`).

**Prerequisite:** empty GitHub repos under `locksmith-app` (e.g. `sdk-go`, `sdk-python`, …). **`sdk-typescript` is not created** by the helper below (create it yourself or skip if you only use this monorepo for TS).

### Create org repos automatically (except `sdk-typescript`)

Requires [GitHub CLI](https://cli.github.com/) (`gh auth login` with org permission to create repositories).

```powershell
./scripts/create-sdk-repos.ps1
```

```bash
chmod +x scripts/create-sdk-repos.sh
./scripts/create-sdk-repos.sh
```

Optional: `GITHUB_ORG`, `SDK_REPO_VISIBILITY` (`public` / `private` / `internal`), `SKIP_EXISTING=0`.

### One-off push (from repo root, `main` checked out)

**Windows (PowerShell):**

```powershell
./scripts/subtree-push.ps1
```

**macOS / Linux:**

```bash
chmod +x scripts/subtree-push.sh
./scripts/subtree-push.sh
```

Set remotes once (copy from `scripts/remotes.example.txt`; add `sdk-typescript` manually if you use that mirror).

```bash
git remote add sdk-python https://github.com/locksmith-app/sdk-python.git
# … remaining remotes in scripts/remotes.example.txt
```

The scripts default org URL: `https://github.com/locksmith-app`.

### Manual split (single SDK)

```bash
git subtree split -P sdks/typescript -b split-typescript
git push sdk-typescript split-typescript:main
git branch -D split-typescript
```

Use `--force` on `git push` only if you intentionally rewrite the public SDK repo (coordinate with consumers).

### GitHub Actions

Workflow **Mirror SDK subtrees** (`.github/workflows/mirror-subtrees.yml`) runs on `workflow_dispatch`. Add an organization secret:

- **`SDK_MIRROR_TOKEN`**: GitHub PAT (classic) with `repo` scope and access to every `locksmith-app/sdk-*` repository.

Each matrix job runs `git subtree split -P sdks/<lang>` and pushes to `locksmith-app/sdk-<lang>`.

## Registry publishes (npm, crates.io, …)

Run release automation in each **`sdk-*`** repo (tests + publish on tags). Subtree mirrors only sync source; registry credentials live in the per-language repository.

**Full per-registry steps:** [sdks/PUBLISHING.md](sdks/PUBLISHING.md).

## License

MIT (unless noted per package).
