#requires -Version 5.1
<#
.SYNOPSIS
  Commit (optional), push the monorepo to origin, then mirror each sdks/* subtree to sdk-* remotes.

.DESCRIPTION
  1. If `sdks/` has unstaged/uncommitted changes, you must pass -CommitMessage (or set COMMIT_MESSAGE)
     so the script can `git add sdks` and commit. Otherwise it aborts.
  2. `git push` to origin on the current branch (set REMOTE / -Remote to override).
  3. Runs the same subtree split + push as scripts/subtree-push.ps1 (see TARGET_BRANCH).

  Prerequisites:
    - git remotes sdk-<lang> (see scripts/remotes.example.txt)
    - For typescript: add sdk-typescript remote manually if you use that mirror

  Env (optional):
    COMMIT_MESSAGE     Same as -CommitMessage if param omitted
    SKIP_MONOREPO=1    Only run subtree mirrors (no git push origin)
    SKIP_MIRRORS=1     Only push monorepo (no sdk-* mirrors)
    TARGET_BRANCH      Branch name on mirror repos (default: main)
    REMOTE             Upstream remote name (default: origin)
#>
param(
  [Parameter()]
  [string] $CommitMessage,
  [string] $Remote = $(if ($env:REMOTE) { $env:REMOTE } else { 'origin' }),
  [switch] $SkipMonorepo,
  [switch] $SkipMirrors
)

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

$msg = $CommitMessage
if ([string]::IsNullOrWhiteSpace($msg)) { $msg = $env:COMMIT_MESSAGE }
$skipMono = $SkipMonorepo -or ($env:SKIP_MONOREPO -eq '1')
$skipMirrors = $SkipMirrors -or ($env:SKIP_MIRRORS -eq '1')

function Test-SdksWorktreeDirty {
  $porcelain = git status --porcelain -- sdks 2>$null
  return -not [string]::IsNullOrWhiteSpace($porcelain)
}

if (Test-SdksWorktreeDirty) {
  if ([string]::IsNullOrWhiteSpace($msg)) {
    throw @"
sdks/ has uncommitted changes. Commit them first, or re-run with:
  ./scripts/push-sdks-all.ps1 -CommitMessage 'your message'
Or set COMMIT_MESSAGE in the environment.
"@
  }
  Write-Host "Committing sdks/..."
  git add sdks
  git commit -m $msg
  if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }
}

if (-not $skipMono) {
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($branch -eq 'HEAD') {
    throw 'Detached HEAD: checkout a branch before pushing the monorepo.'
  }
  Write-Host "Pushing monorepo: $Remote $branch"
  git push $Remote $branch
  if ($LASTEXITCODE -ne 0) { throw "git push $Remote $branch failed" }
}

if (-not $skipMirrors) {
  Write-Host 'Mirroring subtrees to sdk-* remotes...'
  & "$PSScriptRoot\subtree-push.ps1"
  if ($LASTEXITCODE -ne 0) { throw 'subtree-push.ps1 failed' }
}

Write-Host 'All done.'
