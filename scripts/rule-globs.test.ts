// Rule `paths:` globs decide which rule files a session actually loads. Nothing else in the gate
// checks that they MATCH anything — `validate-skills.ts` only checks the frontmatter parses. A
// typo like `**/*.{ts,kt` or a glob that silently covers nothing looks identical to a working one
// until a user opens a Kotlin file and gets no rules. These cases are the concrete promises the
// READMEs and rule descriptions make, pinned against Node's own glob matcher.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesGlob, join } from 'node:path'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const RULES_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'rules')

function globsOf(file: string): string[] {
  const text = readFileSync(join(RULES_DIR, file), 'utf8')
  const frontmatter = text.split(/^---$/m)[1] ?? ''
  return [...frontmatter.matchAll(/^\s*-\s*"(.+)"\s*$/gm)].map(m => m[1])
}

const matches = (file: string, path: string) => globsOf(file).some(g => matchesGlob(path, g))

// [rule file, path, should this rule load for it?]
const CASES: Array<[string, string, boolean]> = [
  // 700/900 cover every language the kit claims to support, not only the JS/TS family.
  ['700-observability.md', 'src/service.kt', true],
  ['700-observability.md', 'build.gradle.kts', true],
  ['700-observability.md', 'lib/main.dart', true],
  ['700-observability.md', 'app/Http/Controllers/UserController.php', true],
  ['700-observability.md', 'Sources/App/Main.swift', true],
  ['700-observability.md', 'src/main.rs', true],
  ['700-observability.md', 'src/engine.cpp', true],
  ['700-observability.md', 'include/engine.hpp', true],
  ['700-observability.md', 'src/util.c', true],
  ['700-observability.md', 'README.md', false],
  ['700-observability.md', 'styles/app.css', false], // 900 covers CSS; 700's logging rules don't
  ['900-performance.md', 'src/service.kt', true],
  ['900-performance.md', 'lib/main.dart', true],
  ['900-performance.md', 'app/User.php', true],
  ['900-performance.md', 'src/main.rs', true],
  ['900-performance.md', 'styles/app.scss', true],
  ['900-performance.md', 'README.md', false],

  // JVM/.NET/Swift name tests by PascalCase suffix, not a `.test.` infix.
  ['300-testing.md', 'src/test/java/UserServiceTest.java', true],
  ['300-testing.md', 'UserTests.cs', true],
  ['300-testing.md', 'Tests/AppTests/UserViewModelTests.swift', true],
  ['300-testing.md', 'src/UserSpec.kt', true],
  ['300-testing.md', 'internal/user/user_test.go', true],
  ['300-testing.md', 'tests/test_user.py', true],
  ['300-testing.md', 'src/user.ts', false],

  // Laravel and ASP.NET capitalize the controller directory.
  ['200-api.md', 'app/Http/Controllers/UserController.php', true],
  ['200-api.md', 'Controllers/UsersController.cs', true],
  ['200-api.md', 'src/main/java/com/x/UserResource.java', true],
  ['200-api.md', 'api/users.ts', true],
  ['200-api.md', 'src/users/users.controller.ts', true],
  ['200-api.md', 'src/user.service.ts', false],
  // Python names neither layout `routes/` or `controllers/` — FastAPI uses `routers/`, Django
  // puts the handler in `views.py` and the routing table in `urls.py`. Both preset documents
  // name these exact paths.
  ['200-api.md', 'app/routers/users.py', true],
  ['200-api.md', 'apps/users/views.py', true],
  ['200-api.md', 'apps/users/urls.py', true],
  ['200-api.md', 'apps/users/models.py', false], // a Django model is 500's file, not 200's

  // Django's default test file is a single `tests.py` per app — no `test_` prefix, no folder.
  ['300-testing.md', 'apps/users/tests.py', true],
  ['300-testing.md', 'apps/users/conftest.py', true],

  // The lowercase, JS-shaped 500 globs missed three layouts the kit ships presets for.
  ['500-database.md', 'app/Models/User.php', true],      // Laravel capitalizes it
  ['500-database.md', 'Data/AppDbContext.cs', true],     // EF Core has no `models/` at all
  ['500-database.md', 'src/user/user.entity.ts', true],  // TypeORM
  ['500-database.md', 'src/main/resources/db/migration/V1__init.sql', true], // Flyway: `migration`,
  // singular, as a DIRECTORY — `**/*migration*` only matches a final segment, so this missed.
  ['500-database.md', 'src/components/Button.tsx', false],

  // The documented React Native gap: a plain `.tsx` screen does NOT auto-load the mobile rules.
  // If this ever flips to true, the "Known gap" note in 400-mobile.md is stale and must change.
  ['400-mobile.md', 'app/src/main/kotlin/Main.kt', true],
  ['400-mobile.md', 'lib/features/home.dart', true],
  ['400-mobile.md', 'src/screens/Home.native.tsx', true],
  ['400-mobile.md', 'src/screens/Home.tsx', false],
  // Expo's config is a root (or package-root) file. Angular v17+ names its bootstrap file
  // `src/app/app.config.ts`, and a bare `**/app.config.{js,ts}` pulled Compose/Keychain rules
  // into every Angular project — the false case below is the whole reason the glob is narrowed.
  ['400-mobile.md', 'app.config.ts', true],
  ['400-mobile.md', 'apps/mobile/app.config.ts', true],
  ['400-mobile.md', 'src/app/app.config.ts', false],
  // `.kts` is out of the glob on purpose: no Compose/SwiftUI/Keychain code lives in one, so it
  // only ever meant a Gradle build file — loading the whole mobile rule for every JVM backend
  // (Spring Boot, Ktor) at zero true positives. Nothing is lost: a build file needs none of the
  // platform guidance, and the Kotlin sources beside it still match via `**/*.kt` (pinned above).
  // Flipping this to true stales the note in 400-mobile.md.
  ['400-mobile.md', 'build.gradle.kts', false],
  ['400-mobile.md', 'app/build.gradle.kts', false],

  // 600-devops claims to fire for "K8s manifests, Helm charts". `kubernetes/` and `helm/` are the
  // rarest of the layouts in use — a chart lives in `charts/`, manifests in `k8s/`/`manifests/`.
  ['600-devops.md', 'k8s/deployment.yaml', true],
  ['600-devops.md', 'manifests/api/deploy.yaml', true],
  ['600-devops.md', 'deploy/staging/service.yaml', true],
  ['600-devops.md', 'charts/api/templates/deployment.yaml', true],
  ['600-devops.md', 'overlays/prod/kustomization.yaml', true],
  ['600-devops.md', 'infra/main.tf', true],
  ['600-devops.md', 'charts/api/values.yaml', true],
  ['600-devops.md', 'infra/prod.tfvars', true],
  ['600-devops.md', 'src/user.ts', false],
  // The reason the three new directory globs are extension-scoped: a chart component and a
  // deploy script directory full of app code must not pull in Docker/CI/IaC rules.
  ['600-devops.md', 'src/components/charts/BarChart.tsx', false],
  ['600-devops.md', 'deploy/scripts/release.ts', false],

  // The view layer of the server-rendered presets: none of these carry a web extension.
  ['100-web.md', 'resources/views/users/index.blade.php', true],
  ['100-web.md', 'app/views/users/index.html.erb', true],
  ['100-web.md', 'src/app/features/user/user.component.ts', true],
  ['100-web.md', 'src/app/user.service.ts', false],
]

// Concrete files each rule MUST match, checked as a set rather than one-by-one: the
// "at least one probe matched" assertion at the bottom of this file is satisfied by a single
// lucky glob, which is exactly how 600-devops shipped a kubernetes preset while matching no
// real manifest layout. A rule listed here has to cover every path in its list.
const MUST_COVER: Record<string, string[]> = {
  '600-devops.md': ['Dockerfile', '.github/workflows/ci.yml', 'infra/main.tf', 'k8s/deployment.yaml', 'charts/api/templates/deployment.yaml'],
  '100-web.md': ['src/App.tsx', 'components/Foo.vue', 'src/routes/+page.svelte', 'resources/views/home.blade.php', 'app/views/home.html.erb'],
  '300-testing.md': ['src/user.test.ts', 'tests/test_user.py', 'apps/users/tests.py', 'src/test/java/UserTest.java', 'UserTests.cs'],
  '200-api.md': ['api/users.ts', 'app/Http/Controllers/UserController.php', 'Controllers/UsersController.cs', 'app/routers/users.py', 'apps/users/views.py'],
  '500-database.md': [
    'prisma/schema.prisma', 'database/migrations/2024_01_01_create_users.php', 'app/Models/User.php',
    'src/main/resources/db/migration/V1__init.sql', 'Data/AppDbContext.cs',
  ],
  // All three platforms the description names must still reach the rule after `.kts` was dropped
  // from the glob — the narrowing is only allowed to cost build files, not source files.
  // Every framework named in 1000-i18n.md's FRAMEWORK MAP keeps its catalogs somewhere different;
  // a rule about message catalogs that does not load for Android's strings.xml or Rails' YAML is
  // the same defect check 18 was written for on the preset side.
  '1000-i18n.md': [
    'messages/tr.json', 'src/locales/en/common.json', 'lib/l10n/app_tr.arb',
    'app/src/main/res/values-tr/strings.xml', 'config/locales/tr.yml', 'lang/tr/validation.php',
    'Resources/SharedResource.tr.resx', 'Localizable.xcstrings', 'locale/django.po',
  ],
  '400-mobile.md': [
    'app/src/main/kotlin/Main.kt', 'Sources/App/ContentView.swift', 'lib/features/home.dart',
    'android/app/src/main/AndroidManifest.xml',
  ],
}

describe('rule paths: globs match the files their descriptions promise', () => {
  for (const [rule, path, expected] of CASES) {
    it(`${rule} ${expected ? 'loads' : 'does not load'} for ${path}`, () => {
      assert.equal(matches(rule, path), expected)
    })
  }

  for (const [rule, paths] of Object.entries(MUST_COVER)) {
    it(`${rule} covers every layout it claims (${paths.length} paths)`, () => {
      const missed = paths.filter(p => !matches(rule, p))
      assert.deepEqual(missed, [], `${rule} matches none of: ${missed.join(', ')}`)
    })
  }

  it('every glob in every rule file is syntactically valid', () => {
    const ruleFiles = readdirSync(RULES_DIR).filter(f => f.endsWith('.md'))
    assert.ok(ruleFiles.length > 0, 'no rule files found — check RULES_DIR')
    for (const file of ruleFiles) {
      for (const glob of globsOf(file)) {
        assert.doesNotThrow(() => matchesGlob('a/b/c.ts', glob), `${file}: invalid glob ${glob}`)
      }
    }
  })

  it('every path-scoped rule matches at least one plausible file', () => {
    // A glob that matches nothing is indistinguishable from a working one until a user hits it.
    const probes = [
      'src/index.ts', 'src/App.tsx', 'app/page.tsx', 'main.py', 'src/main.rs', 'src/service.kt',
      'lib/main.dart', 'app/User.php', 'Program.cs', 'src/Main.java', 'main.go', 'app.rb',
      'src/engine.cpp', 'Sources/App/Main.swift', 'styles/app.css', 'index.html',
      'migrations/001_init.sql', 'prisma/schema.prisma', 'Dockerfile', '.github/workflows/ci.yml',
      'infra/main.tf', 'k8s/deploy.yaml', 'api/users.ts', 'tests/test_user.py',
      'src/ai/prompt.ts', 'docker-compose.yml', 'messages/tr.json', 'config/locales/tr.yml',
    ]
    for (const file of readdirSync(RULES_DIR).filter(f => f.endsWith('.md'))) {
      const globs = globsOf(file)
      if (globs.length === 0) continue // 000/001 load unconditionally — no paths: field
      const hit = probes.some(p => globs.some(g => matchesGlob(p, g)))
      assert.ok(hit, `${file}'s globs matched none of the probe paths — dead glob?`)
    }
  })
})
