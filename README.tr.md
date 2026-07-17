[English](README.md) | **Türkçe**

# Senior Dev Kit

[![CI](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml/badge.svg)](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml)
[![Routing eval](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/routing-eval.yml/badge.svg)](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/routing-eval.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6.0-brightgreen)](package.json)

Claude Code'a kıdemli mühendislik takımı davranışı kazandıran agent, skill ve rule kiti.

> Bu çeviri İngilizce README ile eş tutulur; bir çelişki durumunda [README.md](README.md) esastır. Bağlantılar İngilizce dokümanlara gider.

> **Ölçülmüş, sadece iddia edilmemiş:** 144/144 test geçiyor · 0 kırık doküman linki · %97 (29/30) canlı yönlendirme doğruluğu · %0,18 deny-list yanlış-pozitif oranı. Tam döküm, komutlar ve yöntem aşağıda [Validation](README.md#validation) bölümünde (İngilizce README).

---

## Hızlı Başlangıç

### Hangi seçenek bana göre?

Önce kapsamı seçin — **bu makinedeki tüm projeler** (global `~/.claude/`, Seçenek B) veya **tek bir proje** (o projenin `.claude/`'si, Seçenek A/C/D) — sonra satırınızı bulun:

| Durumunuz | Kullanın | Ne alırsınız |
| --- | --- | --- |
| Yepyeni proje — Claude kurup yapılandırsın | **Seçenek A** | Yalın, **üretilmiş 7 agent'lık proje takımı** (tam kit değil — alttaki nota bakın) |
| Bu makinedeki her proje kiti kullansın | **Seçenek B** | Tam kit (12 agent, 25 skill, 2 komut, 11 rule) global `~/.claude/` içinde |
| Mevcut proje, kopyalamayı siz yapacaksınız | **Seçenek C** | Tam kit o projenin `.claude/`'sinde |
| Mevcut proje, kopyalamayı Claude yapsın | **Seçenek D** | Tam kit `.claude/`'de, istenirse global kurulum da |

> **Seçenek A farklı bir takım kurar.** `PROJECT-BOOTSTRAP.md`, PHASE 0'dan başlayarak minimal 7 agent'lık kadroyu üretir (architect, security-reviewer, implementer, test-author, reviewer, debugger, researcher) — kitin hazır 12 agent'ını değil. Sonradan aynı projede tam kiti kullanmak için üzerine Seçenek B, C veya D'yi çalıştırın.

### Seçenek A — Yeni proje (önerilen)

`PROJECT-BOOTSTRAP.md`'yi proje kökünüze kopyalayın ve Claude Code'a şunu söyleyin:

```text
Read PROJECT-BOOTSTRAP.md and apply it starting from PHASE 0. Work autonomously.
```

Claude stack'inizi tespit eder, doğru preset'leri seçer ve `.claude/`'yi otomatik oluşturur.

### Seçenek B — Global `~/.claude/` kurulumu (tüm projelere uygulanır)

**Plugin (en hızlısı — agent'lar, skill'ler, komutlar):**

```text
/plugin marketplace add mtvrkan/senior-dev-kit
/plugin install senior-dev-kit@senior-dev-kit
```

Bu, agent'ları, skill'leri ve komutları otomatik olarak kaydeder. `rules/`, `agent_docs/` veya
`global-CLAUDE.md`'yi **kurmaz** — plugin formatı
yol-kapsamlı rule'ları veya global bir CLAUDE.md'yi kapsamaz. Tam kit için (token
verimliliğinin büyük kısmını sağlayan lazy-load rule katmanı) ayrıca şunu çalıştırın:

```text
Read SETUP.md and apply Step 5 (global setup) only. Work autonomously.
```

**Tek seferde her şey (plugin yok, kopyalamayı Claude yapar):** plugin adımını atlayıp
yukarıdaki komutu doğrudan tam `SETUP.md`'ye (Step 1'den itibaren) karşı çalıştırın — aşağıdaki
Seçenek D'ye bakın.

> **Windows notu:** Dokümanlardaki örnekler forward-slash yollar kullanır (`project/.claude/`). PowerShell'de ters eğik çizgi kullanın (`project\.claude\`) ve boşluk içeren yolları tırnaklayın. Karışık eğik çizgili bir komut hata verirse [TROUBLESHOOTING.md — Paths with backslashes break scripts](TROUBLESHOOTING.md#paths-with-backslashes-break-scripts) bölümüne bakın.

### Seçenek C — Tek proje için manuel kurulum

1. `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/rules/`, `.claude/agent_docs/` dizinlerini oluşturun.
2. `agents/`, `skills/`, `commands/`, `rules/`, `agent_docs/` klasörlerini bu dizinlere, `settings-template.json`'ı da `.claude/settings.json` olarak kopyalayın.
3. `global-CLAUDE.md`'yi proje kökünüze `CLAUDE.md` olarak kopyalayın, sonra proje açıklaması, stack preset'leri ve doğrulama komutları ekleyin (tam şablon için [SETUP.md Step 4](SETUP.md#step-4--create-root-claudemd)'e bakın).
4. Framework preset'inizi/preset'lerinizi seçin (örn. `presets/web/react-vite/compact.md`) ve `compact.md` dosyalarını `.claude/stack-rules.md`'de birleştirin.

```bash
# Mac / Linux
mkdir -p .claude/agents .claude/skills .claude/commands .claude/rules .claude/agent_docs
cp senior-dev-kit/agents/* .claude/agents/
cp -r senior-dev-kit/skills/* .claude/skills/
cp senior-dev-kit/commands/* .claude/commands/
cp senior-dev-kit/rules/* .claude/rules/
cp senior-dev-kit/agent_docs/* .claude/agent_docs/
cp senior-dev-kit/settings-template.json .claude/settings.json
cp senior-dev-kit/global-CLAUDE.md CLAUDE.md
cat senior-dev-kit/presets/web/react-vite/compact.md >> .claude/stack-rules.md
```

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force .claude/agents, .claude/skills, .claude/commands, .claude/rules, .claude/agent_docs
Copy-Item senior-dev-kit\agents\* .claude\agents\
Copy-Item -Recurse senior-dev-kit\skills\* .claude\skills\
Copy-Item senior-dev-kit\commands\* .claude\commands\
Copy-Item senior-dev-kit\rules\* .claude\rules\
Copy-Item senior-dev-kit\agent_docs\* .claude\agent_docs\
Copy-Item senior-dev-kit\settings-template.json .claude\settings.json
Copy-Item senior-dev-kit\global-CLAUDE.md CLAUDE.md
Get-Content senior-dev-kit\presets\web\react-vite\compact.md | Add-Content .claude\stack-rules.md
```

### Seçenek D — Kurulumu Claude yapsın (shell script yok)

Seçenek B veya C'den daha kapsamlı: B (plugin / `SETUP.md` Step 5) yalnızca global `~/.claude/`'ye yazar; C yalnızca tek projenin `.claude/`'sini kurar. D ikisini birden yapar — proje `.claude/` kurulumu *ve* istenirse global kurulum, otomatik stack tespitiyle — her kopyalama/birleştirme adımını Claude kendisi yürütür. Bash olmayan makinelerde veya proje + global kurulumu tek seferde istediğinizde kullanışlıdır.

```text
Read SETUP.md and apply it starting from Step 1. Work autonomously.
```

> **A ile D arasında seçim:** Seçenek A (`PROJECT-BOOTSTRAP.md`) yepyeni projeler içindir — kit kurulumunun ötesinde planlama/mimari fazları içerir. Seçenek D (`SETUP.md`) saf kit kurulumudur; `.claude/`'si doldurulacak mevcut projeler içindir.

---

## Kurulumdan sonra kullanım

Kurulumdan sonra Claude Code'u **sadece normal konuşarak** kullanırsınız — yönlendirme otomatiktir.

```text
User: login sayfasındaki "Şifremi Unuttum" linki çalışmıyor, düzelt
→ Claude: bug-hunter'a yönlendirir, doğrudan düzeltir

User: kullanıcı profili için yeni bir ayarlar sayfası ekle
→ Claude: senior-engineer'a yönlendirir, plan sunar

User: ödeme akışını yeniden tasarla
→ Claude: architect plan sunar, security-guard denetler, onay bekler

User: Docker CI pipeline'ına SBOM ekle
→ Claude: devops-guard'a yönlendirir, plan sunar, onay ister
```

### Slash komutları

**Komut dosyaları** (2 — zengin davranış tanımları):

| Komut | Ne yapar |
| --- | --- |
| `/agents-guide` | Tüm agent'ları ve yönlendirme kurallarını listeler |
| `/seo-check` | SEO, AEO, Core Web Vitals denetimi |

**Skill kısayolları** (adıyla çağırın — her zaman kullanılabilir):
`/security-review` · `/api-design` · `/migration-review` · `/env-audit` · `/bug-fix` · `/feature-build` · ve 25 skill'in tamamı

> **Komutlar ve Skill'ler:** Komut dosyaları (`commands/*.md`) Claude Code'un eski slash-komut formatını kullanır — `$ARGUMENTS` yer tutuculu düz markdown, çağrıldığında bağlama okunur. Skill dosyaları (`skills/*/SKILL.md`) zengin frontmatter'lı (`model`, `effort`, `allowed-tools`, `when_to_use`) yeni SKILL.md sistemini kullanır. Skill'ler eşleşen bağlam algılandığında otomatik de tetiklenebilir; komutlar yalnızca açıkça çağrıldığında çalışır. Kit eskiden skill karşılığı olan her skill için ayrı bir komut sunuyordu (`/dep-check`, `/smart-task`, ...) — bunlar kaldırıldı, yetenekleri artık doğrudan aynı isimli skill'de yaşıyor (örn. `/security-scan` doğrudan `security-scan` skill'ini tetikler). Skill karşılığı olmayan yalnızca 2 komut kaldı.

---

## Preset seçimi

Tam tablo için [README.md — Picking a Preset](README.md#picking-a-preset) bölümüne bakın; kategoriler: web (7), backend (11), runtime (3), ORM (6), database (7), mobile (4), API (3), messaging (2), infrastructure (3), AI/LLM (1), generic (2) — toplam 49 preset, her biri `CLAUDE.md` (tam) + `compact.md` (özet) çifti.

Çok katmanlı projelerde (örn. Next.js + Prisma + PostgreSQL) en spesifik preset'in içeriğini `.claude/stack-rules.md`'ye koyun, diğerlerinin `compact.md`'lerini altına ekleyin. Kök `CLAUDE.md` kısa kalır ve yalnızca `.claude/stack-rules.md`'yi işaret eder ([SETUP.md](SETUP.md)).

---

## Kitin içinde ne var

### Skill'ler (25)

Skill'ler iki şekilde tetiklenir: çoğu, `description` alanı görevle eşleştiğinde **otomatik çağrılır** (çoğu ayrıca agent'ların `skills:` alanına bağlıdır); bazıları ise **yalnızca manueldir** — `/skill-adi` ile çağrılır ve `disable-model-invocation: true` işaretlidir (`code-audit`, `deep-research`, `env-audit`, `kit-doctor`). Hiçbir agent'ın referans vermediği skill yetim değildir: doğrudan çağrılmak için vardır.

**Uygulama:** `feature-build`, `feature-plan`, `bug-fix`, `refactor-safe`, `ui-change`, `new-page`, `new-screen`, `from-scratch`

**Veri ve API:** `db-change`, `api-design`, `migration-review`

**Kalite ve Güvenlik:** `code-review`, `security-review`, `security-scan`, `test-writer`, `performance-check`, `code-audit`

**DevOps ve Ortam:** `release-gate`, `env-audit`, `kit-doctor`, `incident-response`

**İçerik ve Araştırma:** `docs-update`, `deep-research`, `codebase-overview`, `project-memory`

### Rule'lar (11) — otomatik yüklenir

| Dosya | Kapsam |
| --- | --- |
| `000-security` | Her değişiklik — pasif güvenlik taraması, OWASP 2025 |
| `001-conventions` | Her zaman — mimari tespiti, modern teknoloji tercihleri |
| `100-web` | `*.tsx, *.jsx, *.vue, *.svelte` — tasarım token'ları, 8px grid, SEO, WCAG 2.2 |
| `200-api` | `**/api/**, **/routes/**` — REST, OpenAPI 3.2, RFC 9457 |
| `300-testing` | `*.test.*, *.spec.*` — test piramidi, mock politikası |
| `400-mobile` | `*.swift, *.kt, **/lib/**/*.dart` — platform kalıpları |
| `500-database` | `**/migrations/**, *.prisma` — şema güvenliği, N+1, RLS |
| `600-devops` | `Dockerfile*, .github/**` — non-root, SHA-pin, SBOM, OIDC |
| `700-observability` | `**/*.ts, **/*.py, **/*.go` — log seviyeleri, metrikler, tracing |
| `800-llm-safety` | `**/ai/**, **/llm/**, **/anthropic/**` — prompt injection, maliyet kontrolleri |
| `900-performance` | `**/*.ts, **/*.tsx, **/*.py, **/*.go` — CWV bütçeleri, N+1, bundle limitleri |

### Agent dokümanları (16) — lazy-load, ihtiyaç anında okunur

Bu dokümanlar her oturuma önceden yüklenmez. `global-CLAUDE.md`'deki `Lazy-load docs:` direktifi bunları listeler; bir skill veya rule birine atıf yaptığında Claude dosyayı diskten okur. Büyük referans içerikleri, gerekmedikçe bağlamı şişirmez. Tam liste: [README.md — Agent Docs](README.md#agent-docs-16--lazy-load-read-on-demand).

### Örnekler (4 dosya: 3 adım adım anlatım + bir karşılaştırma)

Stack tespiti → kopyalanan dosyalar → üretilen `stack-rules.md` → 3 gerçek kullanım akışı → görev başına maliyet tahminleri. Platform sınıfı başına bir temsili anlatım (web: `nextjs-prisma-postgres`, backend: `go-postgres`, mobil: `flutter-supabase`) — stack'e özel rehberlik `presets/` altındadır (her preset'in `CLAUDE.md`'si o stack'in esas kural dosyasıdır). Başlangıç için en iyisi: [`examples/with-vs-without-kit.md`](examples/with-vs-without-kit.md) — aynı üç isteğin kitli ve kitsiz nasıl ele alındığı.

---

## Rule önceliği

Rule'lar çakıştığında sıralama (en üstteki kazanır):

```text
1. 000-security.md           ← her zaman aktif, geçersiz kılınamaz
2. Proje CLAUDE.md / .claude/stack-rules.md ← projeye özel kararlar
3. Stack preset (presets/*/CLAUDE.md) ← framework konvansiyonları
4. Alan rule'u (100/200/300/400/500/600) ← daha spesifik glob kazanır
5. 001-conventions.md        ← genel fallback
```

---

## Doğrulama

Aşağıdaki hiçbir sayı hafızadan iddia edilmiyor — her biri yanındaki komutla yeniden üretilebilir.

| Kontrol | Komut | Sonuç |
| --- | --- | --- |
| Unit + entegrasyon testleri | `npm test` | **144/144 geçiyor** (33 suite — skill/agent/rule frontmatter doğrulama, orphan-skill tespiti, guard-agent zorunluluğu, deny-rule eşleştirme) |
| Skill/agent/command/preset frontmatter | `npm run validate` | 25 skill · 12 agent · 2 command · 49 preset — 0 hata; hand-off zinciri bütünlüğünü (`db-change` → `migration-review` vb.) ve guard-agent `permissionMode: plan` zorunluluğunu içerir |
| Dahili doküman linkleri | `npm run link-check` | 190 markdown dosyası, 0 kırık link/anchor |
| Bakım tablosu tazeliği | `npm run stale-check` | 5 bakım tablosunun tamamında 0 bayat/öksüz kayıt |
| Type check / lint | `npm run typecheck` · `npm run lint` | temiz |
| Yönlendirme doğruluğu (canlı) | `RUN_ROUTING_EVAL=1 npm run routing-eval` | güncel 30-prompt'luk sette **29/30 (%97)** (2026-07-16) — aşağıya bakın |
| Deny listesi yanlış-pozitif maliyeti | `npm run deny-cost` | gerçek komutların **%0,18**'i — aşağıya bakın |

Tüm setini tek seferde çalıştırmak için `npm run check` — CI'nin her push'ta koştuğu dizinin aynısı (`.github/workflows/repo-ci.yml`).

Kitin *yönlendirme davranışı* da test altındadır: [`eval/golden-prompts.json`](eval/golden-prompts.json), 30 gerçekçi isteği (TR+EN karışık) beklenen agent'a sabitler. `npm run routing-eval` ücretsiz statik yarıyı her push'ta koşar; `RUN_ROUTING_EVAL=1 npm run routing-eval` modele her prompt'u gerçekten yönlendirtir ve %90 altı skorda başarısız olur (`.github/workflows/routing-eval.yml`). Ölçülmüş, varsayılmamış: ilk canlı koşu 28/33 (%85) ile `agents/ROUTING.md`'deki gerçek boşlukları ortaya çıkardı; kapatıldıktan sonra iki ardışık canlı koşu, o zamanki 33-prompt'luk sette 32/33 (%97) aldı. Set daha sonra 30 prompt'a indirildi ve 2.0 ajan birleştirmesi için 4 beklenti güncellendi; güncel sete karşı yeni bir canlı koşu 29/30 (%97) aldı — tek kaçırılan "login page 'Forgot Password' link doesn't work, fix it" prompt'unu `security-guard` yerine `ui-fixer`'a yönlendirdi (bir öncelik durumu: `agents/ROUTING.md`'ye göre guard-alanı ismi "fix" fiilinden önce gelmeli) — yine de %90 eşiğinin rahatça üzerinde. Bazı golden prompt'lar isteğe bağlı bir `expectedSkill` de taşır — ücretsiz statik bir lint (API maliyeti yok), yalnızca bir prompt ile beklenen skill'in `description`/`when_to_use`'u sıfır ortak anlamlı kelime paylaşırsa başarısız olur; skill auto-invocation Anthropic'in kendi platform algoritmasıyla eşleştiği için (agent routing'in aksine, o kitin kendi router'ı) bu bilinçli olarak bir sapma lint'idir, davranışsal bir kanıt değil.

Deny listesinin kullanım maliyeti de tahmin değil, ölçümdür: `npm run deny-cost`, makinenizdeki Claude Code transcript geçmişindeki her Bash ve PowerShell komutunu kitin deny kurallarına karşı yeniden oynatır ve nelerin engellenmiş olacağını raporlar — geliştirme makinesindeki sayılar için [SECURITY.md](SECURITY.md) "Measured cost" notuna bakın.

Yerelde ayrıca gizli-anahtar taraması, markdown lint ve shellcheck için pre-commit kurabilirsiniz:

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files
```

> Kiti *kullanan* bir projeye kopyalanacak pre-commit şablonu: `security/.pre-commit-config.yaml` (farklı hook seti — [SETUP.md](SETUP.md)).

---

## Sorun giderme ve genişletme

- Kurulum sonrası bir şey çalışmıyorsa: **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** — veya `/kit-doctor` çalıştırın.
- Kendi agent/skill/rule/preset'lerinizi eklemek için: **[EXTENDING.md](EXTENDING.md)** ve **[CONTRIBUTING.md](CONTRIBUTING.md)**.
- Sürüm yükseltme: **[UPGRADE.md](UPGRADE.md)** · Kurulum doğrulama: **[SETUP.md — Step 6](SETUP.md#step-6--verify-installation)** · Güvenlik modeli: **[SECURITY.md](SECURITY.md)**.

## Token maliyeti referansı

Görev tipi başına tipik maliyetler (haiku ile UI düzeltmesi ~$0.001'den, opus ile mimari planlama ~$0.25'e) İngilizce README'nin [Token cost reference](README.md#token-cost-reference) tablosundadır — bu rakamlar **tahmini**, yukarıdaki routing-eval/deny-cost sayıları gibi ölçülmüş değil. Maliyet düşürme: `CLAUDE_CODE_SUBAGENT_MODEL`'i global olarak **ayarlamayın** — her subagent'ın modelini ezer, isimli agent'ların kendi `model:` frontmatter'ı dahil (Claude Code'un model çözümleme sırasında ondan daha yüksek önceliğe sahip), opus seviyesi guard agent'larını sessizce düşürür. Gerçekten isimsiz araştırma/salt-okunur alt-görevlerde maliyet kontrolü için `Agent()` çağrısında `model: 'haiku'`'yu doğrudan belirtin.
