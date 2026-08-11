// Lint config for the kit's own tooling under scripts/ — the rest of the repo
// is Markdown and YAML, covered by the markdown-lint and yaml-lint CI jobs.
// (An earlier version of this comment credited ShellCheck and PSScriptAnalyzer
// "in CI": ShellCheck runs in .pre-commit-config.yaml, not CI, PSScriptAnalyzer
// runs nowhere, and the repo ships no .sh or .ps1 files for either to lint.)
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
  },
  {
    // The installer is plain ESM JavaScript, not TypeScript, so that a new user
    // can run `node scripts/install.mjs` on whatever Node they already have
    // instead of needing this repo's Node 24 floor. It still gets linted — it
    // writes to the user's ~/.claude, which is the least forgiving code here.
    files: ['scripts/**/*.mjs'],
    extends: [eslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly', structuredClone: 'readonly' },
    },
    rules: { 'no-console': 'off' },
  }
)
