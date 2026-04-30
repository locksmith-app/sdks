#requires -Version 5.1
<#
.SYNOPSIS
  Split each sdks/* folder and push to matching remote sdk-<name>.

.DESCRIPTION
  Prerequisite: configure remotes, e.g.
    git remote add sdk-typescript https://github.com/locksmith-app/sdk-typescript.git

  Optional env: TARGET_BRANCH (default: main)
#>
$ErrorActionPreference = 'Stop'
$targetBranch = if ($env:TARGET_BRANCH) { $env:TARGET_BRANCH } else { 'main' }

Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
$sdkRoot = Join-Path (Get-Location) 'sdks'
if (-not (Test-Path $sdkRoot)) { throw "Missing sdks/ at $sdkRoot" }
$sdks = Get-ChildItem -LiteralPath $sdkRoot -Directory | ForEach-Object { $_.Name } | Sort-Object

foreach ($dir in $sdks) {
  $remote = "sdk-$dir"
  $null = git remote get-url $remote 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Skip sdks/${dir}: remote '$remote' not configured. Example: git remote add $remote https://github.com/locksmith-app/$remote.git"
    continue
  }
  Write-Host "--- subtree split sdks/$dir -> $remote ($targetBranch) ---"
  $branch = "split/${dir}-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
  git subtree split -P "sdks/$dir" -b $branch
  if ($LASTEXITCODE -ne 0) { throw "subtree split failed for $dir" }
  git push $remote "${branch}:${targetBranch}"
  if ($LASTEXITCODE -ne 0) { throw "git push failed for $remote" }
  git branch -D $branch
}

Write-Host 'Done.'
