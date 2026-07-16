# Stack Commands — exact test / lint / build / type-check per stack

Lazy-load reference for BOOT SEQUENCE and AUTO-TEST + VERIFICATION in the global protocol.
Read this the first time a TEST_CMD / LINT_CMD / BUILD_CMD is actually needed — not at boot.
`[f]` = targeted file or pattern — always run the narrowest test that covers the change,
never the full suite for a 1-file change.

| Stack | Test | Lint | Build | Type-check |
| --- | --- | --- | --- | --- |
| Next.js/TS | vitest run [f] or jest [f] --no-coverage | next lint | next build | tsc --noEmit |
| NestJS | jest [f].spec.ts --no-coverage | eslint src/ | nest build | tsc --noEmit |
| Vite+React | vitest run [f] | eslint src/ | vite build | tsc --noEmit |
| Nuxt 3 | vitest run [f] | nuxt lint | nuxt build | nuxt typecheck |
| SvelteKit | vitest run [f] | eslint src/ | vite build | svelte-check |
| Node/Bun | bun test [f] or jest [f] --no-coverage | eslint src/ | tsc | tsc --noEmit |
| Deno | deno test --allow-* [f] | deno lint | — | deno check [f] |
| FastAPI | pytest [f] -x -q | ruff check . | — | mypy [f] |
| Django | python manage.py test [m] | ruff check . | — | mypy [f] |
| Go | go test ./[pkg]/... -run TestName -v | golangci-lint run | go build ./... | — |
| Rust | cargo test [name] | cargo clippy | cargo build | — |
| Flutter | flutter test [f] | flutter analyze | flutter build apk | — |
| Spring Boot | ./gradlew test --tests "*.Class" | — | ./gradlew build | — |
| Laravel | php artisan test --filter Name | phpcs | — | phpstan analyse |
| Rails | bundle exec rspec spec/[f]_spec.rb | rubocop | — | srb tc |
| .NET | dotnet test --filter "~ClassName" | — | dotnet build | — |
| Android | ./gradlew test --tests "*.Class" | ./gradlew lint | ./gradlew assembleDebug | — |
| iOS/Swift | xcodebuild test -scheme [n] -only-testing:[C/m] | swiftlint | xcodebuild build | — |

Fuller targeted-test syntax per framework (flags, filters): `rules/300-testing.md`
TARGETED TEST COMMAND section — loads automatically when a test file is read.
