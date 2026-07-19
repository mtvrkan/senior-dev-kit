// Lint config for the kit's own tooling under scripts/ — the rest of the repo
// is markdown/shell/PowerShell and is covered by markdownlint, ShellCheck and
// PSScriptAnalyzer in CI.
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules/'] },
  {
    files: ['scripts/**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // The validators intentionally narrow unknown JSON with `as` casts and
      // catch-and-report loops; keep the ruleset pragmatic, not ceremonial.
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'off',
    },
  }
)
