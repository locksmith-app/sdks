#!/usr/bin/env bash
# Commit (optional), push monorepo to origin, then mirror each sdks/* subtree to sdk-* remotes.
#
# Usage (from repo root):
#   chmod +x scripts/push-sdks-all.sh
#   COMMIT_MSG='chore(sdks): sync' ./scripts/push-sdks-all.sh
#
# Env:
#   COMMIT_MSG       If sdks/ is dirty, required — commits only sdks/
#   SKIP_MONOREPO=1  Only subtree mirrors
#   SKIP_MIRRORS=1   Only git push origin
#   TARGET_BRANCH    Mirror branch (default: main)
#   REMOTE           Upstream (default: origin)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REMOTE="${REMOTE:-origin}"
SKIP_MONOREPO="${SKIP_MONOREPO:-0}"
SKIP_MIRRORS="${SKIP_MIRRORS:-0}"
COMMIT_MSG="${COMMIT_MSG:-}"

sdks_dirty() {
  [[ -n "$(git status --porcelain -- sdks 2>/dev/null || true)" ]]
}

if sdks_dirty; then
  if [[ -z "${COMMIT_MSG}" ]]; then
    echo "sdks/ has uncommitted changes. Set COMMIT_MSG or commit manually." >&2
    echo "  COMMIT_MSG='chore(sdks): ...' $0" >&2
    exit 1
  fi
  echo "Committing sdks/..."
  git add sdks
  git commit -m "${COMMIT_MSG}"
fi

if [[ "${SKIP_MONOREPO}" != "1" ]]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "${branch}" == "HEAD" ]]; then
    echo "Detached HEAD: checkout a branch before pushing." >&2
    exit 1
  fi
  echo "Pushing monorepo: ${REMOTE} ${branch}"
  git push "${REMOTE}" "${branch}"
fi

if [[ "${SKIP_MIRRORS}" != "1" ]]; then
  echo "Mirroring subtrees to sdk-* remotes..."
  "$(dirname "$0")/subtree-push.sh"
fi

echo "All done."
