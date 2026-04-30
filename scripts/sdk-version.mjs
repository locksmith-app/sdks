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
 *
 *   For each registry we collect **all** published versions (where the API allows), not only
 *   `latest`, so an accidental 9.x release does not hide the real 1.x line. Then outliers:
 *   if the highest **major** is ≥ 5 above the next lower major (e.g. 9 vs 1), that major line
 *   is ignored. Use **sdk_version** or a **GitHub Release** tag to force an exact version.
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

async function fetchNpmVersionStrings() {
  const r = await fetch("https://registry.npmjs.org/@getlocksmith%2Fsdk");
  if (!r.ok) return [];
  const j = await r.json();
  return Object.keys(j.versions || {});
}

async function fetchCratesIoVersionStrings() {
  const r = await fetch("https://crates.io/api/v1/crates/getlocksmith/versions", {
    headers: { "User-Agent": "locksmith-sdk-publish-ci" },
  });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.versions || []).map((x) => x.num).filter(Boolean);
}

async function fetchPyPIVersionStrings() {
  const r = await fetch("https://pypi.org/pypi/locksmith-py/json");
  if (!r.ok) return [];
  const j = await r.json();
  return Object.keys(j.releases || {});
}

async function fetchRubyGemsVersionStrings() {
  const r = await fetch(
    "https://rubygems.org/api/v1/versions/locksmith-ruby.json",
    { headers: { "User-Agent": "locksmith-sdk-publish-ci" } },
  );
  if (!r.ok) return [];
  const j = await r.json();
  if (!Array.isArray(j)) return [];
  return j.map((x) => x.number).filter(Boolean);
}

async function fetchNuGetVersionStrings() {
  const r = await fetch(
    "https://api.nuget.org/v3-flatcontainer/locksmith.sdk/index.json",
  );
  if (!r.ok) return [];
  const j = await r.json();
  const versions = j.versions;
  return Array.isArray(versions) ? versions : [];
}

async function fetchPubDevVersionStrings() {
  const r = await fetch("https://pub.dev/api/packages/locksmith_dart");
  if (!r.ok) return [];
  const j = await r.json();
  const latest = j.latest?.version ? [j.latest.version] : [];
  const listed =
    Array.isArray(j.versions) ? j.versions.map((x) => x.version).filter(Boolean) : [];
  return [...new Set([...latest, ...listed])];
}

async function fetchHexVersionStrings() {
  const r = await fetch("https://hex.pm/api/packages/locksmith_ex");
  if (!r.ok) return [];
  const j = await r.json();
  const releases = j.releases;
  if (!Array.isArray(releases)) return [];
  return releases.map((x) => x.version).filter(Boolean);
}

async function fetchMavenCentralVersionStrings() {
  const url =
    "https://search.maven.org/solr/search/select?q=g:app.locksmith+AND+a:locksmith-java&rows=1&wt=json";
  const r = await fetch(url, { headers: { "User-Agent": "locksmith-sdk-publish-ci" } });
  if (!r.ok) return [];
  const j = await r.json();
  const v = j.response?.docs?.[0]?.latestVersion;
  return v ? [v] : [];
}

function semverMajor(ver) {
  return Number(ver.split(".")[0]);
}

/** Drop a runaway major line (e.g. accidental 9.x) when the next lower major is far below. */
function maxSemverTrimOutliers(versions) {
  const uniq = [...new Set(versions.map(normalizeSemver).filter(Boolean))];
  if (uniq.length === 0) return null;

  const byMajor = new Map();
  for (const v of uniq) {
    const m = semverMajor(v);
    const cur = byMajor.get(m);
    if (!cur || cmpSemver(v, cur) > 0) byMajor.set(m, v);
  }

  let majors = [...byMajor.keys()].sort((a, b) => a - b);
  while (majors.length >= 2 && majors[majors.length - 1] - majors[majors.length - 2] >= 5) {
    byMajor.delete(majors[majors.length - 1]);
    majors = [...byMajor.keys()].sort((a, b) => a - b);
  }

  let best = null;
  for (const v of byMajor.values()) {
    if (!best || cmpSemver(v, best) > 0) best = v;
  }
  return best;
}

async function collectRegistryVersions() {
  const tasks = [
    fetchNpmVersionStrings(),
    fetchCratesIoVersionStrings(),
    fetchPyPIVersionStrings(),
    fetchRubyGemsVersionStrings(),
    fetchNuGetVersionStrings(),
    fetchPubDevVersionStrings(),
    fetchHexVersionStrings(),
    fetchMavenCentralVersionStrings(),
  ];
  const results = await Promise.allSettled(tasks);
  const versions = [];
  for (const res of results) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      for (const v of res.value) {
        if (v) versions.push(v);
      }
    }
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
  const base = maxSemverTrimOutliers(candidates);
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

  const dartChangelog = resolve(SDKS, "dart/CHANGELOG.md");
  const dartBlock = `## ${version}\n\n- Automated SDK release (CI).\n\n`;
  if (!existsSync(dartChangelog)) {
    writeFileSync(dartChangelog, `# Changelog\n\n${dartBlock}`);
  } else {
    let ch = readFileSync(dartChangelog, "utf8");
    const esc = version.replace(/\./g, "\\.");
    if (new RegExp(`^## ${esc}\\s*$`, "m").test(ch)) {
      /* already documented */
    } else if (ch.startsWith("# Changelog")) {
      ch = ch.replace(/^# Changelog\s*\n/, `# Changelog\n\n${dartBlock}`);
      writeFileSync(dartChangelog, ch);
    } else {
      writeFileSync(dartChangelog, `${dartBlock}${ch}`);
    }
  }

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
