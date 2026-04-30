#!/usr/bin/env node
/**
 * Unified SDK semver for CI: resolve next version, optionally apply to all manifests.
 *
 * resolve — print one line: x.y.z (or write to --github-output file)
 * apply   — read SDK_PUBLISH_VERSION from env, rewrite SDK manifests (no network)
 *
 * Resolve order:
 *   1) GITHUB_EVENT_NAME=release → version from RELEASE_TAG (strip leading v)
 *   2) SDK_VERSION_INPUT env non-empty → use as-is
 *   3) max(registry latest versions, sdks/SDK_VERSION) then bump (SDK_BUMP: patch|minor|major)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SDKS = resolve(REPO_ROOT, "sdks");

function parseArgs(argv) {
  const out = { cmd: null, githubOutput: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--github-output" && argv[i + 1]) {
      out.githubOutput = argv[++i];
      continue;
    }
    if (!out.cmd && (argv[i] === "resolve" || argv[i] === "apply")) {
      out.cmd = argv[i];
    }
  }
  return out;
}

function normalizeSemver(v) {
  if (!v || typeof v !== "string") return null;
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(v.trim());
  if (!m) return null;
  return `${m[1]}.${m[2]}.${m[3]}`;
}

function cmpSemver(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function maxSemver(versions) {
  const norm = versions.map(normalizeSemver).filter(Boolean);
  if (norm.length === 0) return null;
  return norm.reduce((m, v) => (cmpSemver(v, m) > 0 ? v : m));
}

function bumpSemver(ver, kind) {
  const [x, y, z] = ver.split(".").map(Number);
  if (kind === "major") return `${x + 1}.0.0`;
  if (kind === "minor") return `${x}.${y + 1}.0`;
  return `${x}.${y}.${z + 1}`;
}

function readCanonicalFile() {
  const p = resolve(SDKS, "SDK_VERSION");
  if (!existsSync(p)) return "0.1.0";
  const line = readFileSync(p, "utf8").trim().split(/\r?\n/)[0] || "0.1.0";
  return normalizeSemver(line) ?? "0.1.0";
}

async function fetchLatestNpm() {
  const r = await fetch("https://registry.npmjs.org/@getlocksmith%2Fsdk");
  if (!r.ok) return null;
  const j = await r.json();
  return j["dist-tags"]?.latest ?? null;
}

async function fetchLatestCratesIo() {
  const r = await fetch("https://crates.io/api/v1/crates/getlocksmith", {
    headers: { "User-Agent": "locksmith-sdk-publish-ci" },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.crate?.max_stable_version ?? null;
}

async function fetchLatestPyPI() {
  const r = await fetch("https://pypi.org/pypi/locksmith-py/json");
  if (!r.ok) return null;
  const j = await r.json();
  return j.info?.version ?? null;
}

async function fetchLatestRubyGems() {
  const r = await fetch("https://rubygems.org/api/v1/gems/locksmith-ruby.json", {
    headers: { "User-Agent": "locksmith-sdk-publish-ci" },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.version ?? null;
}

async function fetchLatestNuGet() {
  const r = await fetch(
    "https://api.nuget.org/v3-flatcontainer/locksmith.sdk/index.json",
  );
  if (!r.ok) return null;
  const j = await r.json();
  const versions = j.versions;
  if (!Array.isArray(versions) || versions.length === 0) return null;
  return maxSemver(versions);
}

async function fetchLatestPubDev() {
  const r = await fetch("https://pub.dev/api/packages/locksmith_dart");
  if (!r.ok) return null;
  const j = await r.json();
  return j.latest?.version ?? null;
}

async function fetchLatestHex() {
  const r = await fetch("https://hex.pm/api/packages/locksmith_ex");
  if (!r.ok) return null;
  const j = await r.json();
  const releases = j.releases;
  if (!Array.isArray(releases) || releases.length === 0) return null;
  return maxSemver(releases.map((x) => x.version));
}

async function fetchLatestMavenCentral() {
  const url =
    "https://search.maven.org/solr/search/select?q=g:app.locksmith+AND+a:locksmith-java&rows=1&wt=json";
  const r = await fetch(url, { headers: { "User-Agent": "locksmith-sdk-publish-ci" } });
  if (!r.ok) return null;
  const j = await r.json();
  const v = j.response?.docs?.[0]?.latestVersion;
  return v ?? null;
}

async function collectRegistryVersions() {
  const tasks = [
    fetchLatestNpm(),
    fetchLatestCratesIo(),
    fetchLatestPyPI(),
    fetchLatestRubyGems(),
    fetchLatestNuGet(),
    fetchLatestPubDev(),
    fetchLatestHex(),
    fetchLatestMavenCentral(),
  ];
  const results = await Promise.allSettled(tasks);
  const versions = [];
  for (const res of results) {
    if (res.status === "fulfilled" && res.value) versions.push(res.value);
  }
  return versions;
}

async function resolveVersion() {
  const eventName = process.env.GITHUB_EVENT_NAME ?? "";
  const releaseTag = process.env.RELEASE_TAG ?? "";
  const inputVersion = (process.env.SDK_VERSION_INPUT ?? "").trim();
  const bump = process.env.SDK_BUMP ?? "patch";

  if (eventName === "release" && releaseTag) {
    const v = normalizeSemver(releaseTag.replace(/^refs\/tags\//, ""));
    if (!v) throw new Error(`Invalid release tag semver: ${releaseTag}`);
    return v;
  }

  if (inputVersion) {
    const v = normalizeSemver(inputVersion);
    if (!v) throw new Error(`Invalid sdk_version input: ${inputVersion}`);
    return v;
  }

  const registry = await collectRegistryVersions();
  const canonical = readCanonicalFile();
  const candidates = [...registry, canonical];
  const base = maxSemver(candidates);
  if (!base) throw new Error("Could not resolve a base semver");

  if (bump !== "patch" && bump !== "minor" && bump !== "major") {
    throw new Error(`Invalid SDK_BUMP: ${bump}`);
  }

  return bumpSemver(base, bump);
}

function applyVersion(version) {
  if (!normalizeSemver(version)) {
    throw new Error(`Refusing to apply invalid version: ${version}`);
  }

  const rustToml = resolve(SDKS, "rust/Cargo.toml");
  writeFileSync(
    rustToml,
    readFileSync(rustToml, "utf8").replace(
      /^version = "[^"]*"/m,
      `version = "${version}"`,
    ),
  );

  const pyToml = resolve(SDKS, "python/pyproject.toml");
  writeFileSync(
    pyToml,
    readFileSync(pyToml, "utf8").replace(
      /^version = "[^"]*"/m,
      `version = "${version}"`,
    ),
  );

  const rubyV = resolve(SDKS, "ruby/lib/locksmith/version.rb");
  writeFileSync(
    rubyV,
    readFileSync(rubyV, "utf8").replace(
      /VERSION = "[^"]*"/,
      `VERSION = "${version}"`,
    ),
  );

  const kotlin = resolve(SDKS, "kotlin/build.gradle.kts");
  writeFileSync(
    kotlin,
    readFileSync(kotlin, "utf8").replace(
      /^version = "[^"]*"/m,
      `version = "${version}"`,
    ),
  );

  const pom = resolve(SDKS, "java/pom.xml");
  writeFileSync(
    pom,
    readFileSync(pom, "utf8").replace(
      /(<artifactId>locksmith-java<\/artifactId>\s*<version>)[^<]+(<\/version>)/,
      `$1${version}$2`,
    ),
  );

  const csproj = resolve(SDKS, "dotnet/Locksmith.Sdk.csproj");
  writeFileSync(
    csproj,
    readFileSync(csproj, "utf8").replace(
      /<Version>[^<]*<\/Version>/,
      `<Version>${version}</Version>`,
    ),
  );

  const pubspec = resolve(SDKS, "dart/pubspec.yaml");
  writeFileSync(
    pubspec,
    readFileSync(pubspec, "utf8").replace(
      /^version: .+$/m,
      `version: ${version}`,
    ),
  );

  const mix = resolve(SDKS, "elixir/mix.exs");
  writeFileSync(
    mix,
    readFileSync(mix, "utf8").replace(
      /version: "\d+\.\d+\.\d+"/,
      `version: "${version}"`,
    ),
  );

  const pkgPath = resolve(SDKS, "typescript/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.version = version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const lockPath = resolve(SDKS, "typescript/package-lock.json");
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.version = version;
    if (lock.packages?.[""]) lock.packages[""].version = version;
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  }

  const cargoLock = resolve(SDKS, "rust/Cargo.lock");
  if (existsSync(cargoLock)) {
    writeFileSync(
      cargoLock,
      readFileSync(cargoLock, "utf8").replace(
        /name = "getlocksmith"\nversion = "[^"]+"/,
        `name = "getlocksmith"\nversion = "${version}"`,
      ),
    );
  }

  const canon = resolve(SDKS, "SDK_VERSION");
  writeFileSync(canon, `${version}\n`);
}

async function main() {
  const { cmd, githubOutput } = parseArgs(process.argv);
  if (!cmd) {
    console.error("Usage: sdk-version.mjs resolve|apply [--github-output path]");
    process.exit(2);
  }

  if (cmd === "resolve") {
    const v = await resolveVersion();
    process.stdout.write(`${v}\n`);
    if (githubOutput) {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(githubOutput, `version=${v}\n`);
    }
    return;
  }

  if (cmd === "apply") {
    const v = process.env.SDK_PUBLISH_VERSION ?? "";
    if (!v.trim()) {
      console.error("Missing SDK_PUBLISH_VERSION");
      process.exit(1);
    }
    applyVersion(v.trim());
    return;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
