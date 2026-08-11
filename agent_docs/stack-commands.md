# Stack Commands — exact test / lint / build / type-check per stack

Lazy-load reference for BOOT SEQUENCE and AUTO-TEST + VERIFICATION in the global protocol.
Read this the first time a TEST_CMD / LINT_CMD / BUILD_CMD is actually needed — not at boot.
`[f]` = targeted file or pattern — always run the narrowest test that covers the change,
never the full suite for a 1-file change.

| Stack | Test | Lint | Build | Type-check |
| --- | --- | --- | --- | --- |
| Next.js/TS | vitest run [f] or jest [f] --no-coverage | eslint . | next build | tsc --noEmit |
| NestJS | jest [f].spec.ts --no-coverage | eslint src/ | nest build | tsc --noEmit |
| Vite+React | vitest run [f] | eslint src/ | vite build | tsc --noEmit |
| Nuxt 3 | vitest run [f] | eslint . | nuxt build | nuxt typecheck |
| SvelteKit | vitest run [f] | eslint src/ | vite build | svelte-check |
| Angular | ng test --include=[f] | ng lint | ng build | ng build (strictTemplates) |
| Astro | vitest run [f] | eslint . | astro build | astro check |
| Node/Bun | bun test [f] or jest [f] --no-coverage | eslint src/ | tsc | tsc --noEmit |
| Deno | deno test --allow-all [f] | deno lint | — | deno check [f] |
| FastAPI | pytest [f] -x -q | ruff check . | — | mypy [f] |
| Django | python manage.py test [m] | ruff check . | — | mypy [f] |
| Go | go test ./[pkg]/... -run TestName -v | golangci-lint run | go build ./... | — |
| Rust | cargo test [name] | cargo clippy | cargo build | — |
| Flutter | flutter test [f] | flutter analyze | flutter build apk | — |
| React Native/Expo | jest [f] -t "name" | eslint . | eas build --platform [p] | tsc --noEmit |
| Spring Boot (Maven) | ./mvnw test -Dtest=Class#method | ./mvnw spotless:check | ./mvnw package | — |
| Spring Boot (Gradle) | ./gradlew test --tests "*.Class" | ./gradlew ktlintCheck | ./gradlew build | — |
| Ktor / Kotlin JVM | ./gradlew test --tests "*.Class" | ./gradlew ktlintCheck | ./gradlew installDist | — |
| Laravel | php artisan test --filter Name | vendor/bin/pint --test | — | phpstan analyse |
| PHP (no framework) | ./vendor/bin/phpunit --filter Name | phpcs | — | phpstan analyse |
| Rails | bundle exec rspec spec/[f]_spec.rb | rubocop | — | srb tc |
| .NET | dotnet test --filter "FullyQualifiedName~ClassName" | dotnet format --verify-no-changes | dotnet build | — |
| C/C++ (CMake) | ctest -R TestName --output-on-failure | clang-tidy [f] | cmake --build build | — |
| C/C++ (Make) | make check | cppcheck --enable=warning [f] | make | — |
| Android | ./gradlew test --tests "*.Class" | ./gradlew lint | ./gradlew assembleDebug | — |
| iOS/Swift | xcodebuild test -scheme [n] -only-testing:[C/m] | swiftlint | xcodebuild build | — |

This table is the canonical targeted-test reference — `rules/300-testing.md`'s TARGETED TEST
COMMAND section points here and restates only the Go/XCTest filter syntax.
