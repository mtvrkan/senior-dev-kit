# Install Senior Dev Kit to $env:USERPROFILE\.claude\
# Usage: .\install.ps1 [-Preset react-vite]
[CmdletBinding()]
# Write-Host is deliberate here: this is an interactive installer whose colored
# status lines are UI, not pipeline data — Write-Output would pollute the pipeline.
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '')]
param(
    [string]$Preset  = "",
    [switch]$Detect
)

# Mirror install.sh's `set -euo pipefail`: stop on the first failed copy or
# backup instead of printing errors and finishing with a misleading "Done".
$ErrorActionPreference = 'Stop'

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ClaudeDir  = Join-Path $env:USERPROFILE ".claude"

function Step($msg) { Write-Host "  → $msg" -ForegroundColor Cyan  }
function Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }

# Backs up an existing CLAUDE.md to a timestamped file so repeated installs
# never silently clobber a previous backup.
function Backup-ClaudeMd {
    $claudeMd = Join-Path $ClaudeDir "CLAUDE.md"
    if (Test-Path $claudeMd) {
        $timestamp = Get-Date -Format "yyyyMMddHHmmss"
        $backup = "$claudeMd.bak.$timestamp"
        Warn "CLAUDE.md already exists — backing up to $(Split-Path -Leaf $backup)"
        Copy-Item $claudeMd $backup -Force
    }
}

# Counts files actually present in a destination dir so the install summary
# reflects what was copied, not a hardcoded number.
function Get-FileCount($path) { @(Get-ChildItem -Path $path -File -Recurse).Count }

# Fails the install if the destination holds fewer files than the kit ships
# (-lt because a reinstall may merge over extra user-added files), so a
# truncated or partial copy can't end in a misleading "Done".
function Test-Copy($src, $dest, $label) {
    $srcCount = Get-FileCount $src
    $destCount = Get-FileCount $dest
    if ($destCount -lt $srcCount) {
        Write-Error "${label}/ copy incomplete — expected at least $srcCount files, found $destCount. Re-run the installer." -ErrorAction Continue
        exit 1
    }
}

# Backs up an existing destination directory (if it already has files) to a
# timestamped sibling before it gets overwritten, so a repeated install never
# silently destroys customizations the user placed directly under ~/.claude/.
function Backup-Dir($dest) {
    if (Test-Path $dest) {
        $hasContent = Get-ChildItem -Path $dest -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hasContent) {
            $timestamp = Get-Date -Format "yyyyMMddHHmmss"
            $backup = "$dest.bak.$timestamp"
            Warn "$(Split-Path -Leaf $dest)/ already has content — backing up to $(Split-Path -Leaf $backup)/"
            Copy-Item $dest $backup -Recurse -Force
        }
    }
}

if ($Preset -ne "" -and $Preset -notmatch '^[a-z0-9-]+$') {
    # -ErrorAction Continue keeps this a clean one-line message under the
    # script-wide $ErrorActionPreference = 'Stop' so `exit 1` is reached.
    Write-Error "Invalid -Preset value '$Preset' (use lowercase letters, digits, hyphens only)" -ErrorAction Continue
    exit 1
}

# Auto-detect stack from project files in current directory.
# Order below is priority-ranked, not alphabetical — first match wins, so more
# specific/framework-level dependencies (next, @nestjs/core, @remix-run, ...)
# are checked before generic ones (react, express) that they're commonly built
# on top of. Do not reorder without preserving that specific-before-generic rule.
# Keep in sync with the equivalent chain in install.sh.
if ($Detect -and $Preset -eq "") {
    Step "Auto-detecting stack..."
    if (Test-Path "package.json") {
        $pkg = Get-Content "package.json" -Raw
        if     ($pkg -match '"next"')           { $Preset = "nextjs-saas" }
        elseif ($pkg -match '"@nestjs/core"')   { $Preset = "nestjs" }
        elseif ($pkg -match '"@angular/core"')  { $Preset = "angular" }
        elseif ($pkg -match '"nuxt"')           { $Preset = "vue-nuxt" }
        elseif ($pkg -match '"svelte"')         { $Preset = "sveltekit" }
        elseif ($pkg -match '"astro"')          { $Preset = "astro" }
        elseif ($pkg -match '"@remix-run"')     { $Preset = "remix" }
        elseif ($pkg -match '"expo"')           { $Preset = "react-native" }
        elseif ($pkg -match '"wrangler"')       { $Preset = "cloudflare-workers" }
        elseif ($pkg -match '"react"')          { $Preset = "react-vite" }
        elseif ($pkg -match '"express"')        { $Preset = "node-express" }
        # No dedicated Hono preset exists yet; node-express is the closest match
        # (minimal Node HTTP routing conventions) among the 49 shipped presets.
        elseif ($pkg -match '"hono"')           { $Preset = "node-express" }
    }
    if ($Preset -eq "") {
        $pyFiles = @("requirements.txt", "pyproject.toml") | Where-Object { Test-Path $_ }
        if ($pyFiles) {
            # -join instead of Join-String: the latter needs PowerShell 6.2+,
            # and this script must also run on stock Windows PowerShell 5.1.
            $pyContent = ($pyFiles | ForEach-Object { Get-Content $_ -Raw }) -join " "
            if     ($pyContent -match "fastapi") { $Preset = "fastapi" }
            elseif ($pyContent -match "django")  { $Preset = "django" }
            elseif ($pyContent -match "flask")   { $Preset = "flask" }
        } elseif (Test-Path "go.mod")                                          { $Preset = "go-api" }
        elseif  (Test-Path "Cargo.toml")                                       { $Preset = "rust-api" }
        elseif  (Test-Path "pubspec.yaml")                                     { $Preset = "flutter" }
        elseif  (Test-Path "Package.swift")                                    { $Preset = "swift-ios" }
        elseif  (Get-Item "*.xcodeproj" -ErrorAction SilentlyContinue)        { $Preset = "swift-ios" }
        elseif  ((Test-Path "app\build.gradle") -or (Test-Path "app\build.gradle.kts")) { $Preset = "kotlin-android" }
        elseif  (Get-Item "*.csproj" -ErrorAction SilentlyContinue)           { $Preset = "dotnet-api" }
        elseif  (Test-Path "pom.xml")                                          { $Preset = "java-spring" }
        elseif  (Test-Path "Gemfile")                                          { $Preset = "rails" }
        elseif  (Test-Path "composer.json")                                    { $Preset = "laravel" }
        elseif  (Test-Path "bun.lockb")                                        { $Preset = "bun" }
        elseif  ((Test-Path "deno.json") -or (Test-Path "deno.jsonc"))        { $Preset = "deno" }
        elseif  (Test-Path "wrangler.toml")                                    { $Preset = "cloudflare-workers" }
    }
    if ($Preset -ne "") { Ok "Detected stack: $Preset" }
    else { Warn "Could not auto-detect stack — install without preset. Use -Preset NAME to set manually." }
}

Write-Host ""
Write-Host "Senior Dev Kit — Install" -ForegroundColor White
Write-Host "========================" -ForegroundColor White
Write-Host "Usage: .\install.ps1 [-Preset nextjs-saas] [-Detect]"
Write-Host "  -Preset NAME   Install a specific preset as CLAUDE.md"
Write-Host "  -Detect        Auto-detect stack from package.json / requirements.txt / go.mod etc."
Write-Host ""
Write-Host "Target: $ClaudeDir"
Write-Host ""
$confirm = Read-Host "Continue? [y/N]"
if ($confirm -notmatch '^[Yy]$') { Write-Host "Aborted."; exit 0 }

New-Item -ItemType Directory -Force -Path $ClaudeDir | Out-Null

# --- rules ---
Step "Copying rules..."
$dest = Join-Path $ClaudeDir "rules"
Backup-Dir $dest
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path (Join-Path $ScriptDir "rules\*") -Destination $dest -Recurse -Force
Test-Copy (Join-Path $ScriptDir "rules") $dest "rules"
Ok "rules/ ($(Get-FileCount $dest) files)"

# --- skills ---
Step "Copying skills..."
$dest = Join-Path $ClaudeDir "skills"
Backup-Dir $dest
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path (Join-Path $ScriptDir "skills\*") -Destination $dest -Recurse -Force
Test-Copy (Join-Path $ScriptDir "skills") $dest "skills"
Ok "skills/ ($(Get-FileCount $dest) files)"

# --- commands ---
Step "Copying commands..."
$dest = Join-Path $ClaudeDir "commands"
Backup-Dir $dest
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path (Join-Path $ScriptDir "commands\*") -Destination $dest -Recurse -Force
Test-Copy (Join-Path $ScriptDir "commands") $dest "commands"
Ok "commands/ ($(Get-FileCount $dest) files)"

# --- agents ---
Step "Copying agents..."
$dest = Join-Path $ClaudeDir "agents"
Backup-Dir $dest
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path (Join-Path $ScriptDir "agents\*") -Destination $dest -Recurse -Force
Test-Copy (Join-Path $ScriptDir "agents") $dest "agents"
Ok "agents/ ($(Get-FileCount $dest) files)"

# --- agent_docs ---
Step "Copying agent_docs (lazy-load reference)..."
$dest = Join-Path $ClaudeDir "agent_docs"
Backup-Dir $dest
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path (Join-Path $ScriptDir "agent_docs\*") -Destination $dest -Recurse -Force
Test-Copy (Join-Path $ScriptDir "agent_docs") $dest "agent_docs"
Ok "agent_docs/ ($(Get-FileCount $dest) files)"

# --- hooks (opt-in enforcement layer — copied but NOT activated; see hooks/README.md) ---
Step "Copying hooks (opt-in — activate via settings.json, see hooks/README.md)..."
$dest = Join-Path $ClaudeDir "hooks"
Backup-Dir $dest
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path (Join-Path $ScriptDir "hooks\*") -Destination $dest -Recurse -Force
Test-Copy (Join-Path $ScriptDir "hooks") $dest "hooks"
Ok "hooks/ ($(Get-FileCount $dest) files) — opt-in, not active until wired into settings.json"

# --- global-CLAUDE.md (when no project-specific preset is requested) ---
if ($Preset -eq "") {
    Step "Copying global-CLAUDE.md..."
    Backup-ClaudeMd
    Copy-Item (Join-Path $ScriptDir "global-CLAUDE.md") (Join-Path $ClaudeDir "CLAUDE.md") -Force
    Ok "global-CLAUDE.md installed as CLAUDE.md"
}

# --- preset ---
if ($Preset -ne "") {
    $presetPath = $null
    # Guard the whole lookup on presets/ existing: under $ErrorActionPreference
    # = 'Stop' a bare Get-ChildItem on a missing directory would abort the
    # install with a raw error (install.sh warns gracefully instead — keep parity).
    $presetsRoot = Join-Path $ScriptDir "presets"
    if (Test-Path $presetsRoot) {
        Get-ChildItem -Path $presetsRoot -Directory | ForEach-Object {
            $candidate = Join-Path $_.FullName "$Preset\CLAUDE.md"
            if (-not $presetPath -and (Test-Path $candidate)) { $presetPath = $candidate }
        }
    }

    if ($presetPath) {
        Step "Installing preset: $Preset"
        Backup-ClaudeMd
        $claudeMd = Join-Path $ClaudeDir "CLAUDE.md"
        Copy-Item $presetPath $claudeMd -Force
        Ok "Preset '$Preset' installed as CLAUDE.md"
    } elseif (Test-Path $presetsRoot) {
        Warn "Preset '$Preset' not found. Available presets:"
        Get-ChildItem -Path $presetsRoot -Recurse -Filter "CLAUDE.md" |
            ForEach-Object { $_.FullName -replace [regex]::Escape((Join-Path $ScriptDir "presets\")) -replace "\\CLAUDE.md" } |
            Sort-Object
    } else {
        Warn "Preset '$Preset' not found. (presets/ directory is missing from this kit copy)"
    }
}

Write-Host ""
Write-Host "Done. Files installed to $ClaudeDir" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: open any project in Claude Code and talk normally."
Write-Host "To bootstrap a new project: copy PROJECT-BOOTSTRAP.md to the project root"
Write-Host "  and tell Claude: 'Read PROJECT-BOOTSTRAP.md and apply it starting from PHASE 0.'"
Write-Host ""
