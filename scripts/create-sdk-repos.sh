#!/usr/bin/env bash
# Create empty GitHub repos for Locksmith SDK mirrors (all except sdk-typescript).
#
# Prerequisites:
#   - GitHub CLI: https://cli.github.com/ (`brew install gh` / winget install GitHub.cli)
#   - `gh auth login` with permission to create repos in the org (owner or admin).
#
# Usage:
#   ./scripts/create-sdk-repos.sh
#
# Optional env:
#   GITHUB_ORG=locksmith-app          (default)
#   SDK_REPO_VISIBILITY=public        | private | internal
#   SKIP_EXISTING=1                   (default) skip if repo already exists
#

set -euo pipefail

ORG="${GITHUB_ORG:-locksmith-app}"
VIS="${SDK_REPO_VISIBILITY:-public}"
SKIP_EXISTING="${SKIP_EXISTING:-1}"

if ! command -v gh &>/dev/null; then
  echo "Install GitHub CLI: https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "Run: gh auth login" >&2
  exit 1
fi

VIS_FLAG=(--"$VIS")
if [[ "$VIS" != "public" && "$VIS" != "private" && "$VIS" != "internal" ]]; then
  echo "SDK_REPO_VISIBILITY must be public, private, or internal (got: $VIS)" >&2
  exit 1
fi

# Same languages as subtree-push, minus typescript.
SDKS=(python go rust ruby php dotnet java kotlin dart elixir swift)

for lang in "${SDKS[@]}"; do
  name="sdk-${lang}"
  full="${ORG}/${name}"
  desc="Locksmith authentication API client (${lang})"

  if gh repo view "$full" &>/dev/null; then
    if [[ "$SKIP_EXISTING" == "1" ]]; then
      echo "exists (skip): $full"
      continue
    fi
    echo "exists: $full — set SKIP_EXISTING=0 to still attempt create (will fail)" >&2
    exit 1
  fi

  echo "creating: $full"
  gh repo create "$full" "${VIS_FLAG[@]}" --description "$desc"
done

echo "Done. Next: add remotes from scripts/remotes.example.txt (skip sdk-typescript line if you manage it elsewhere)."
