#!/usr/bin/env bash
# Install Senior Dev Kit to ~/.claude/
# Usage: bash install.sh [--preset react-vite] [--detect]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${HOME}/.claude"
PRESET=""
DETECT=false
NO_HOOKS=false
# Set by backup_claude_md so the closing summary can point at the backup —
# without this, a re-install with a different preset replaces CLAUDE.md with
# only a mid-scroll warning line to show for it.
CLAUDE_MD_BACKUP=""

print_step() { echo "  → $1"; }
print_ok()   { echo "  ✓ $1"; }
print_warn() { echo "  ⚠ $1"; }

# Timestamps are second-granular: two installs in the same second would reuse
# the name — and for directories `cp -r` would then nest into the old backup
# instead of creating a fresh one. Append a counter until the name is free.
unique_backup_path() {
  local base="$1" candidate="$1" n=1
  while [[ -e "${candidate}" ]]; do
    candidate="${base}.${n}"
    n=$((n + 1))
  done
  echo "${candidate}"
}

# Backs up an existing CLAUDE.md to a timestamped file so repeated installs
# never silently clobber a previous backup.
backup_claude_md() {
  if [[ -f "${CLAUDE_DIR}/CLAUDE.md" ]]; then
    local backup
    backup="$(unique_backup_path "${CLAUDE_DIR}/CLAUDE.md.bak.$(date +%Y%m%d%H%M%S)")"
    print_warn "CLAUDE.md already exists — backing up to $(basename "${backup}")"
    if ! cp "${CLAUDE_DIR}/CLAUDE.md" "${backup}"; then
      echo "Error: failed to back up CLAUDE.md — aborting so the existing file is not overwritten" >&2
      exit 1
    fi
    CLAUDE_MD_BACKUP="${backup}"
  fi
}

# Counts files actually present in a destination dir so the install summary
# reflects what was copied, not a hardcoded number.
count_files() { find "$1" -type f | wc -l | tr -d ' '; }

# Fails the install if the destination holds fewer files than the kit ships
# (-lt because a reinstall may merge over extra user-added files), so a
# truncated or partial copy can't end in a misleading "Done".
verify_copy() {
  local src="$1" dest="$2" label="$3"
  local src_count dest_count
  src_count=$(count_files "${src}")
  dest_count=$(count_files "${dest}")
  if [[ "${dest_count}" -lt "${src_count}" ]]; then
    echo "Error: ${label}/ copy incomplete — expected at least ${src_count} files, found ${dest_count}. Re-run the installer." >&2
    exit 1
  fi
}

# Backs up an existing destination directory (if it already has files) to a
# timestamped sibling before it gets overwritten, so a repeated install never
# silently destroys customizations the user placed directly under ~/.claude/.
backup_dir_if_exists() {
  local dest="$1"
  if [[ -d "${dest}" ]] && [[ -n "$(find "${dest}" -mindepth 1 -print -quit 2>/dev/null)" ]]; then
    local backup
    backup="$(unique_backup_path "${dest}.bak.$(date +%Y%m%d%H%M%S)")"
    print_warn "$(basename "${dest}")/ already has content — backing up to $(basename "${backup}")/"
    if ! cp -r "${dest}" "${backup}"; then
      echo "Error: failed to back up $(basename "${dest}")/ — aborting so existing content is not overwritten" >&2
      exit 1
    fi
  fi
}

for arg in "$@"; do
  case $arg in
    --preset=*) PRESET="${arg#*=}" ;;
    --detect)   DETECT=true ;;
    --no-hooks) NO_HOOKS=true ;;
  esac
done

if [[ -n "${PRESET}" && ! "${PRESET}" =~ ^[a-z0-9-]+$ ]]; then
  echo "Error: invalid --preset value '${PRESET}' (use lowercase letters, digits, hyphens only)" >&2
  exit 1
fi

# Auto-detect stack from project files in current directory.
# Order below is priority-ranked, not alphabetical — first match wins, so more
# specific/framework-level dependencies (next, @nestjs/core, @remix-run, ...)
# are checked before generic ones (react, express) that they're commonly built
# on top of. Do not reorder without preserving that specific-before-generic rule.
if [[ "${DETECT}" == "true" && -z "${PRESET}" ]]; then
  print_step "Auto-detecting stack..."
  if [[ -f "package.json" ]]; then
    PKG=$(<package.json)
    if echo "$PKG" | grep -q '"next"';          then PRESET="nextjs-saas"
    elif echo "$PKG" | grep -q '"@nestjs/core"'; then PRESET="nestjs"
    elif echo "$PKG" | grep -q '"@angular/core"'; then PRESET="angular"
    elif echo "$PKG" | grep -q '"nuxt"';          then PRESET="vue-nuxt"
    elif echo "$PKG" | grep -q '"svelte"';         then PRESET="sveltekit"
    elif echo "$PKG" | grep -q '"astro"';          then PRESET="astro"
    elif echo "$PKG" | grep -q '"@remix-run"';     then PRESET="remix"
    elif echo "$PKG" | grep -q '"expo"';           then PRESET="react-native"
    elif echo "$PKG" | grep -q '"wrangler"';       then PRESET="cloudflare-workers"
    elif echo "$PKG" | grep -q '"react"';          then PRESET="react-vite"
    elif echo "$PKG" | grep -q '"express"';        then PRESET="node-express"
    # No dedicated Hono preset exists yet; node-express is the closest match
    # (minimal Node HTTP routing conventions) among the 49 shipped presets.
    elif echo "$PKG" | grep -q '"hono"';           then PRESET="node-express"
    fi
  fi
  if [[ -z "${PRESET}" ]]; then
    PY_FILES=()
    [[ -f "requirements.txt" ]] && PY_FILES+=("requirements.txt")
    [[ -f "pyproject.toml" ]] && PY_FILES+=("pyproject.toml")
    if [[ ${#PY_FILES[@]} -gt 0 ]]; then
      if grep -qi "fastapi" "${PY_FILES[@]}" 2>/dev/null;  then PRESET="fastapi"
      elif grep -qi "django" "${PY_FILES[@]}" 2>/dev/null; then PRESET="django"
      elif grep -qi "flask" "${PY_FILES[@]}" 2>/dev/null;  then PRESET="flask"
      fi
    elif [[ -f "go.mod" ]]; then  PRESET="go-api"
    elif [[ -f "Cargo.toml" ]]; then PRESET="rust-api"
    elif [[ -f "pubspec.yaml" ]]; then PRESET="flutter"
    elif [[ -f "Package.swift" ]]; then PRESET="swift-ios"
    elif compgen -G "*.xcodeproj" > /dev/null 2>&1; then PRESET="swift-ios"
    elif [[ -f "app/build.gradle" || -f "app/build.gradle.kts" ]]; then PRESET="kotlin-android"
    elif compgen -G "*.csproj" > /dev/null 2>&1; then PRESET="dotnet-api"
    elif [[ -f "pom.xml" ]]; then PRESET="java-spring"
    elif [[ -f "Gemfile" ]]; then  PRESET="rails"
    elif [[ -f "composer.json" ]]; then PRESET="laravel"
    elif [[ -f "bun.lockb" ]]; then PRESET="bun"
    elif [[ -f "deno.json" || -f "deno.jsonc" ]]; then PRESET="deno"
    elif [[ -f "wrangler.toml" ]]; then PRESET="cloudflare-workers"
    fi
  fi
  if [[ -n "${PRESET}" ]]; then
    print_ok "Detected stack: ${PRESET}"
  else
    print_warn "Could not auto-detect stack — install without preset. Use --preset=NAME to set one manually."
  fi
fi

echo ""
echo "Senior Dev Kit — Install"
echo "========================"
echo "Usage: bash install.sh [--preset=NAME] [--detect] [--no-hooks]"
echo "  --preset=NAME  Install a specific preset as CLAUDE.md (e.g. --preset=nextjs-saas)"
echo "  --detect       Auto-detect stack from package.json / requirements.txt / go.mod etc."
echo "  --no-hooks     Skip wiring the protected-paths hook into settings.json"
echo ""

# Confirm target
echo "Target: ${CLAUDE_DIR}"
echo ""
read -r -p "Continue? [y/N] " confirm
# case instead of ${confirm,,}: macOS ships bash 3.2, which lacks ,, expansion
case "$confirm" in
  [Yy]) ;;
  *)
    echo "Aborted."
    exit 0
    ;;
esac

mkdir -p "${CLAUDE_DIR}"

# --- rules ---
print_step "Copying rules..."
backup_dir_if_exists "${CLAUDE_DIR}/rules"
mkdir -p "${CLAUDE_DIR}/rules"
cp -r "${SCRIPT_DIR}/rules/." "${CLAUDE_DIR}/rules/"
verify_copy "${SCRIPT_DIR}/rules" "${CLAUDE_DIR}/rules" "rules"
print_ok "rules/ ($(count_files "${CLAUDE_DIR}/rules") files)"

# --- skills ---
print_step "Copying skills..."
backup_dir_if_exists "${CLAUDE_DIR}/skills"
mkdir -p "${CLAUDE_DIR}/skills"
cp -r "${SCRIPT_DIR}/skills/." "${CLAUDE_DIR}/skills/"
verify_copy "${SCRIPT_DIR}/skills" "${CLAUDE_DIR}/skills" "skills"
print_ok "skills/ ($(count_files "${CLAUDE_DIR}/skills") files)"

# --- commands ---
print_step "Copying commands..."
backup_dir_if_exists "${CLAUDE_DIR}/commands"
mkdir -p "${CLAUDE_DIR}/commands"
cp -r "${SCRIPT_DIR}/commands/." "${CLAUDE_DIR}/commands/"
verify_copy "${SCRIPT_DIR}/commands" "${CLAUDE_DIR}/commands" "commands"
print_ok "commands/ ($(count_files "${CLAUDE_DIR}/commands") files)"

# --- agents ---
print_step "Copying agents..."
backup_dir_if_exists "${CLAUDE_DIR}/agents"
mkdir -p "${CLAUDE_DIR}/agents"
cp -r "${SCRIPT_DIR}/agents/." "${CLAUDE_DIR}/agents/"
verify_copy "${SCRIPT_DIR}/agents" "${CLAUDE_DIR}/agents" "agents"
print_ok "agents/ ($(count_files "${CLAUDE_DIR}/agents") files)"

# --- agent_docs ---
print_step "Copying agent_docs (lazy-load reference)..."
backup_dir_if_exists "${CLAUDE_DIR}/agent_docs"
mkdir -p "${CLAUDE_DIR}/agent_docs"
cp -r "${SCRIPT_DIR}/agent_docs/." "${CLAUDE_DIR}/agent_docs/"
verify_copy "${SCRIPT_DIR}/agent_docs" "${CLAUDE_DIR}/agent_docs" "agent_docs"
print_ok "agent_docs/ ($(count_files "${CLAUDE_DIR}/agent_docs") files)"

# --- hooks (deterministic enforcement layer — see hooks/README.md) ---
print_step "Copying hooks..."
backup_dir_if_exists "${CLAUDE_DIR}/hooks"
mkdir -p "${CLAUDE_DIR}/hooks"
cp -r "${SCRIPT_DIR}/hooks/." "${CLAUDE_DIR}/hooks/"
verify_copy "${SCRIPT_DIR}/hooks" "${CLAUDE_DIR}/hooks" "hooks"
print_ok "hooks/ ($(count_files "${CLAUDE_DIR}/hooks") files)"

# --- wire protected-paths hook into settings.json (on by default; --no-hooks skips this) ---
if [[ "${NO_HOOKS}" == "true" ]]; then
  print_warn "hooks not wired (--no-hooks) — see hooks/README.md to enable manually"
elif command -v node >/dev/null 2>&1; then
  print_step "Wiring protected-paths hook into settings.json..."
  node "${SCRIPT_DIR}/scripts/wire-hook.mjs" "${CLAUDE_DIR}/settings.json" "${CLAUDE_DIR}/hooks/protected-paths.mjs"
  print_ok "settings.json — protected-paths hook active (auth/payment/DB/secrets/CI edits now prompt for guard review)"
else
  print_warn "node not found — hook not wired automatically. See hooks/README.md to enable manually."
fi

# --- global-CLAUDE.md (when no project-specific preset is requested) ---
if [[ -z "${PRESET}" ]]; then
  print_step "Copying global-CLAUDE.md..."
  backup_claude_md
  cp "${SCRIPT_DIR}/global-CLAUDE.md" "${CLAUDE_DIR}/CLAUDE.md"
  print_ok "global-CLAUDE.md installed as CLAUDE.md"
fi

# --- preset ---
if [[ -n "${PRESET}" ]]; then
  PRESET_PATH=""
  # Search across all preset categories
  for dir in "${SCRIPT_DIR}/presets"/*/; do
    # With no category dirs the glob stays literal — skip it instead of
    # probing a path containing a literal '*'.
    [[ -d "${dir}" ]] || continue
    if [[ -d "${dir}${PRESET}" ]]; then
      PRESET_PATH="${dir}${PRESET}/CLAUDE.md"
      break
    fi
  done

  if [[ -f "${PRESET_PATH}" ]]; then
    print_step "Installing preset: ${PRESET}"
    backup_claude_md
    cp "${PRESET_PATH}" "${CLAUDE_DIR}/CLAUDE.md"
    print_ok "Preset '${PRESET}' installed as CLAUDE.md"
  else
    print_warn "Preset '${PRESET}' not found. Available presets:"
    if [[ -d "${SCRIPT_DIR}/presets" ]]; then
      find "${SCRIPT_DIR}/presets" -name "CLAUDE.md" | sed "s|${SCRIPT_DIR}/presets/||;s|/CLAUDE.md||" | sort
    else
      print_warn "(presets/ directory is missing from this kit copy)"
    fi
  fi
fi

echo ""
echo "Done. Files installed to ${CLAUDE_DIR}"
if [[ -n "${CLAUDE_MD_BACKUP}" ]]; then
  print_warn "Your previous CLAUDE.md was replaced — the old copy is at: ${CLAUDE_MD_BACKUP}"
fi
echo ""
echo "Next step: open any project in Claude Code and talk normally."
echo "To bootstrap a new project: copy PROJECT-BOOTSTRAP.md to the project root"
echo "  and tell Claude: 'Read PROJECT-BOOTSTRAP.md and apply it starting from PHASE 0.'"
echo ""
