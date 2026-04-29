# Locksmith SDKs (organization monorepo)

Official client libraries for the [Locksmith](https://uselocksmith.app) public auth API (`/api/auth/*`).

The **dashboard / Next.js app is not in this repository**; it is developed and hosted under a separate GitHub account to keep org costs minimal.

## Layout

| Path | Language | Registry (typical) |
|------|----------|--------------------|
| `sdks/typescript` | TypeScript / Node | npm `@locksmith/sdk` |
| `sdks/python` | Python | PyPI `locksmith-py` |
| `sdks/go` | Go | `go get github.com/uselocksmith/sdk-go` |
| `sdks/rust` | Rust | crates.io `locksmith` |
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

**Prerequisite:** create empty GitHub repos, e.g. `locksmith-app/sdk-typescript`, `locksmith-app/sdk-go`, …

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

Set remotes once (HTTPS example):

```bash
git remote add sdk-typescript https://github.com/locksmith-app/sdk-typescript.git
# … repeat per scripts/remotes.example.txt
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

## License

MIT (unless noted per package).
