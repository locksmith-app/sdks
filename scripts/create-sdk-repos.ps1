#requires -Version 5.1
<#
.SYNOPSIS
  Create GitHub repos for Locksmith SDK mirrors (all except sdk-typescript).

.DESCRIPTION
  Requires GitHub CLI (gh) and `gh auth login` with org permission to create repositories.

  Env:
    GITHUB_ORG            default: locksmith-app
    SDK_REPO_VISIBILITY   public | private | internal  (default: public)
    SKIP_EXISTING         1 to skip existing repos (default: 1)
#>
$ErrorActionPreference = 'Stop'

$org = if ($env:GITHUB_ORG) { $env:GITHUB_ORG } else { 'locksmith-app' }
$vis = if ($env:SDK_REPO_VISIBILITY) { $env:SDK_REPO_VISIBILITY } else { 'public' }
$skipExisting = if ($null -ne $env:SKIP_EXISTING) { $env:SKIP_EXISTING } else { '1' }

if ($vis -notin @('public', 'private', 'internal')) {
  throw "SDK_REPO_VISIBILITY must be public, private, or internal (got: $vis)"
}

$null = Get-Command gh -ErrorAction Stop
gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  throw 'Run: gh auth login'
}

$sdks = @('python', 'go', 'rust', 'ruby', 'php', 'dotnet', 'java', 'kotlin', 'dart', 'elixir', 'swift')

foreach ($lang in $sdks) {
  $name = "sdk-$lang"
  $full = "$org/$name"
  $desc = "Locksmith authentication API client ($lang)"

  gh repo view $full 2>$null
  if ($LASTEXITCODE -eq 0) {
    if ($skipExisting -eq '1') {
      Write-Host "exists (skip): $full"
      continue
    }
    throw "Repo already exists: $full"
  }

  Write-Host "creating: $full"
  gh repo create $full "--$vis" --description "$desc"
  if ($LASTEXITCODE -ne 0) { throw "gh repo create failed for $full" }
}

Write-Host 'Done. Next: add remotes from scripts/remotes.example.txt (omit sdk-typescript if needed).'
