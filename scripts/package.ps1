<#
.SYNOPSIS
  Build a clean Chrome Web Store ZIP for ChronoNav.

.DESCRIPTION
  Packages ONLY the files the extension needs at runtime (manifest.json,
  content.js, inject.js, sidebar.css, popup.html, popup.js, popup.css, icons/, _locales/)
  into a ZIP whose root contains manifest.json, as required by the Chrome Web Store.
  Everything else (README*, LICENSE, .git, .github, docs, scripts, PRIVACY.md, dist)
  is excluded.

.PARAMETER OutputDir
  Directory to write the ZIP into. Defaults to "dist" in the repo root.

.EXAMPLE
  pwsh ./scripts/package.ps1
  powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1
#>

[CmdletBinding()]
param(
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

# Repo root = parent of this script's folder.
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDir) {
  $OutputDir = Join-Path $repoRoot "dist"
}

# Files / folders that ship inside the extension package.
$includeFiles = @("manifest.json", "content.js", "inject.js", "sidebar.css", "popup.html", "popup.js", "popup.css")
$includeDirs  = @("icons", "_locales")

# Verify required files exist before doing anything.
$missing = @()
foreach ($f in $includeFiles) {
  if (-not (Test-Path (Join-Path $repoRoot $f))) { $missing += $f }
}
foreach ($d in $includeDirs) {
  if (-not (Test-Path (Join-Path $repoRoot $d))) { $missing += "$d/" }
}
if ($missing.Count -gt 0) {
  throw "Missing required extension files: $($missing -join ', ')"
}

# Read version from manifest for the ZIP file name.
# Read as UTF-8 and extract via regex so a non-ASCII (e.g. Chinese) description
# can't break parsing under Windows PowerShell 5.1's default encoding.
$manifestPath = Join-Path $repoRoot "manifest.json"
$manifestText = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8)
$versionMatch = [regex]::Match($manifestText, '"version"\s*:\s*"([^"]+)"')
if ($versionMatch.Success) { $version = $versionMatch.Groups[1].Value } else { $version = "dev" }

# Prepare a clean staging directory.
if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}
$staging = Join-Path $OutputDir "_staging"
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Path $staging | Out-Null

# Copy only the whitelisted files/folders into staging.
foreach ($f in $includeFiles) {
  Copy-Item -Path (Join-Path $repoRoot $f) -Destination (Join-Path $staging $f)
}
foreach ($d in $includeDirs) {
  Copy-Item -Path (Join-Path $repoRoot $d) -Destination (Join-Path $staging $d) -Recurse
}

# Create the ZIP (manifest.json at archive root).
$zipName = "chrononav-timeline-for-gemini-v$version.zip"
$zipPath = Join-Path $OutputDir $zipName
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force

# Clean up staging.
Remove-Item -Recurse -Force $staging

Write-Host "Packaged: $zipPath" -ForegroundColor Green
Write-Host "Contents:" -ForegroundColor Cyan
foreach ($f in $includeFiles) { Write-Host "  $f" }
foreach ($d in $includeDirs)  { Write-Host "  $d/" }
