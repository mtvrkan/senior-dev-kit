import { existsSync } from 'fs'
import { join as pathJoin, sep } from 'path'

// The repo ships two plugins side by side: the Claude Code one under `claude/` and the generated
// Codex one under `codex/`. The checks in scripts/ were written against repo-root-relative kit
// paths (`skills/…`, `rules/…`, `global-CLAUDE.md`), and their fixtures still build trees in that
// shape. `join` here keeps both working: a path that does not exist where it was asked for but
// does exist under `claude/` resolves there. Anything that exists at the given location wins, so
// root-level files (README, docs/, package.json, the marketplace manifest) are never redirected.
export const KIT_DIR = 'claude'

export function join(base: string, ...parts: string[]): string {
  const direct = pathJoin(base, ...parts)
  if (parts.length === 0 || existsSync(direct)) return direct
  const segments = direct.split(sep)
  for (let cut = segments.length - 1; cut >= 1; cut -= 1) {
    const prefix = segments.slice(0, cut).join(sep) || sep
    if (!existsSync(pathJoin(prefix, KIT_DIR))) continue
    const nested = pathJoin(prefix, KIT_DIR, ...segments.slice(cut))
    if (existsSync(nested)) return nested
  }
  return direct
}
