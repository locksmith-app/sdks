#!/usr/bin/env bash
# Push each sdks/* subtree to git remote sdk-<name>.
# Prerequisite: git remote add sdk-typescript https://github.com/locksmith-app/sdk-typescript.git (etc.)
# Run from monorepo root.

set -euo pipefail

TARGET_BRANCH="${TARGET_BRANCH:-main}"
shopt -s nullglob
_sdk_dirs=(sdks/*/)
SDKS=()
for _d in "${_sdk_dirs[@]}"; do
  SDKS+=("$(basename "${_d%/}")")
done
IFS=$'\n' SDKS=($(printf '%s\n' "${SDKS[@]}" | sort))
unset IFS
if [[ ${#SDKS[@]} -eq 0 ]]; then
  echo "No subdirectories under sdks/" >&2
  exit 1
fi

for dir in "${SDKS[@]}"; do
  remote="sdk-$dir"
  if ! git remote get-url "$remote" &>/dev/null; then
    echo "Skip sdks/$dir: remote '$remote' not configured." >&2
    echo "  git remote add $remote https://github.com/locksmith-app/$remote.git" >&2
    continue
  fi
  echo "--- subtree split sdks/$dir -> $remote ($TARGET_BRANCH) ---"
  branch="split/${dir}-$(date +%s)"
  git subtree split -P "sdks/$dir" -b "$branch"
  git push "$remote" "$branch:$TARGET_BRANCH"
  git branch -D "$branch"
done

echo "Done."
