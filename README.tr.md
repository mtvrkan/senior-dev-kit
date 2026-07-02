[English](README.md) | **Türkçe**

# Senior Dev Kit

Claude Code'a kıdemli mühendislik takımı davranışı kazandıran agent, skill ve rule kiti.

> Bu çeviri İngilizce README ile eş tutulur; bir çelişki durumunda [README.md](README.md) esastır. Bağlantılar İngilizce dokümanlara gider.

---

## Hızlı Başlangıç

### Hangi seçenek bana göre?

Önce kapsamı seçin — **bu makinedeki tüm projeler** (global `~/.claude/`, Seçenek B) veya **tek bir proje** (o projenin `.claude/`'si, Seçenek A/C/D) — sonra satırınızı bulun:

| Durumunuz | Kullanın | Ne alırsınız |
| --- | --- | --- |
| Yepyeni proje — Claude kurup yapılandırsın | **Seçenek A** | Yalın, **üretilmiş 7 agent'lık proje takımı** (tam kit değil — alttaki nota bakın) |
| Bu makinedeki her proje kiti kullansın | **Seçenek B** | Tam kit (17 agent, 34 skill, 13 komut, 11 rule) global `~/.claude/` içinde |
| Mevcut proje, kopyalamayı siz yapacaksınız | **Seçenek C** | Tam kit o projenin `.claude/`'sinde |
| Mevcut proje, kopyalamayı Claude yapsın | **Seçenek D** | Tam kit `.claude/`'de, istenirse global kurulum da |

> **Seçenek A farklı bir takım kurar.** `PROJECT-BOOTSTRAP.md`, PHASE 0'dan başlayarak minimal 7 agent'lık kadroyu üretir (architect, security-reviewer, implementer, test-author, reviewer, debugger, researcher) — kitin hazır 17 agent'ını değil. Sonradan aynı projede tam kiti kullanmak için üzerine Seçenek B, C veya D'yi çalıştırın.

### Seçenek A — Yeni proje (önerilen)

`PROJECT-BOOTSTRAP.md`'yi proje kökünüze kopyalayın ve Claude Code'a şunu söyleyin:

```text
Read PROJECT-BOOTSTRAP.md and apply it starting from PHASE 0. Work autonomously.
```

Claude stack'inizi tespit eder, doğru preset'leri seçer ve `.claude/`'yi otomatik oluşturur.

### Seçenek B — Global `~/.claude/` kurulumu (tüm projelere uygulanır)

**Otomatik stack tespiti (önerilen):**

`--detect`, preset seçmek için stack dosyalarını (`package.json`, `requirements.txt`, `go.mod`, ...) **bulunduğunuz dizinden** okur; ama kiti her zaman **global** `~/.claude/`'ye yazar — mevcut projeye değil. Tespitin günlük çalışma şeklinize uygun preset'i seçmesi için önce temsili bir projeye `cd` yapın.

```bash
# Mac / Linux — package.json / requirements.txt / go.mod üzerinden stack tespit eder
cd /path/to/your-project && bash /path/to/senior-dev-kit/install.sh --detect

# Windows
cd C:\path\to\your-project; .\senior-dev-kit\install.ps1 -Detect
```

**Manuel preset:**

```bash
# Mac / Linux
bash install.sh --preset=nextjs-saas

# Windows
.\install.ps1 -Preset nextjs-saas
```

**Tek komutluk alternatif (Node 22.6+, clone gerekmez):** npm sarmalayıcısı platformunuza uygun installer'ı seçer ve aynı bayrakları iletir:

```bash
npx github:mtvrkan/senior-dev-kit --detect     # veya --preset=nextjs-saas
```

**Plugin alternatifi:** repo bir Claude Code plugin manifesti içerir (`.claude-plugin/`) — marketplace olarak ekleyip kurduğunuzda komutlar, agent'lar, skill'ler ve [korumalı-yol hook'u](hooks/README.md) otomatik kaydolur:

```text
/plugin marketplace add mtvrkan/senior-dev-kit
/plugin install senior-dev-kit@senior-dev-kit
```

> **Windows notu:** Dokümanlardaki örnekler forward-slash yollar kullanır (`project/.claude/`). PowerShell'de ters eğik çizgi kullanın (`project\.claude\`) ve boşluk içeren yolları tırnaklayın. Karışık eğik çizgili bir komut hata verirse [TROUBLESHOOTING.md — Paths with backslashes break scripts](TROUBLESHOOTING.md#paths-with-backslashes-break-scripts) bölümüne bakın.

### Seçenek C — Tek proje için manuel kurulum

1. Framework preset'inizi seçin (örn. `presets/web/react-vite/CLAUDE.md`).
2. Projenize `.claude/stack-rules.md` olarak kopyalayın, sonra ona referans veren kısa bir kök `CLAUDE.md` oluşturun (şablon: [INSTALL.md Step 6](INSTALL.md#6-create-claudemd-and-stack-rules)).
3. `rules/` → `.claude/rules/`
4. `skills/` → `.claude/skills/`
5. `agent_docs/` → `.claude/agent_docs/` (opsiyonel — talep üzerine lazy-load edilir)

### Seçenek D — Kurulumu Claude yapsın (shell script yok)

Seçenek B veya C'den daha kapsamlı: B (`install.sh`/`install.ps1`) yalnızca global `~/.claude/`'ye yazar; C yalnızca tek projenin `.claude/`'sini kurar. D ikisini birden yapar — proje `.claude/` kurulumu *ve* istenirse global kurulum, otomatik stack tespitiyle — her kopyalama/birleştirme adımını Claude kendisi yürütür. Bash olmayan makinelerde veya proje + global kurulumu tek seferde istediğinizde kullanışlıdır.

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

**Komut dosyaları** (13 — zengin davranış tanımları):

| Komut | Ne yapar |
| --- | --- |
| `/smart-task [task]` | Riski ölçer, doğru skill'e yönlendirir |
| `/plan-first [task]` | Önce plan sunar, onay alır, sonra uygular |
| `/safe-review` | Diff'i inceler — salt okunur, dosya değiştirmez |
| `/security-scan` | Tam pasif güvenlik taraması çalıştırır |
| `/release-gate` | Sürüm öncesi GO / NO-GO kontrol listesi |
| `/dep-check` | Bağımlılık CVE + güncellik analizi |
| `/performance-check` | Bundle, N+1, CWV performans analizi |
| `/seo-check` | SEO, AEO, Core Web Vitals denetimi |
| `/deep-research [topic]` | Çok kaynaklı araştırma, doğrulama |
| `/strategy-plan [goal]` | Yol haritası ve strateji analizi |
| `/article-write [topic]` | Blog yazısı veya teknik makale |
| `/agents-guide` | Tüm agent'ları ve yönlendirme kurallarını listeler |
| `/kit-doctor [scope]` | Kit kurulumunu teşhis eder — sayılar, settings, sürüm kayması |

**Skill kısayolları** (adıyla çağırın — her zaman kullanılabilir):
`/security-review` · `/api-design` · `/api-versioning` · `/migration-review` · `/env-audit` · `/bug-fix` · `/feature-build` · ve 34 skill'in tamamı

> **Komutlar ve Skill'ler:** Komut dosyaları (`commands/*.md`) Claude Code'un eski slash-komut formatını kullanır — `$ARGUMENTS` yer tutuculu düz markdown, çağrıldığında bağlama okunur. Skill dosyaları (`skills/*/SKILL.md`) zengin frontmatter'lı (`model`, `effort`, `allowed-tools`, `when_to_use`) yeni SKILL.md sistemini kullanır. Skill'ler eşleşen bağlam algılandığında otomatik de tetiklenebilir; komutlar yalnızca açıkça çağrıldığında çalışır.

---

## Preset seçimi

Tam tablo için [README.md — Picking a Preset](README.md#picking-a-preset) bölümüne bakın; kategoriler: web (7), backend (11), runtime (3), ORM (6), database (7), mobile (4), API (3), messaging (2), infrastructure (3), AI/LLM (1), generic (2) — toplam 49 preset, her biri `CLAUDE.md` (tam) + `compact.md` (özet) çifti.

Çok katmanlı projelerde (örn. Next.js + Prisma + PostgreSQL) en spesifik preset'in içeriğini `.claude/stack-rules.md`'ye koyun, diğerlerinin `compact.md`'lerini altına ekleyin. Kök `CLAUDE.md` kısa kalır ve yalnızca `.claude/stack-rules.md`'yi işaret eder ([SETUP.md](SETUP.md)).

---

## Kitin içinde ne var

### Skill'ler (34)

Skill'ler iki şekilde tetiklenir: çoğu, `description` alanı görevle eşleştiğinde **otomatik çağrılır** (çoğu ayrıca agent'ların `skills:` alanına bağlıdır); bazıları ise **yalnızca manueldir** — `/skill-adi` ile çağrılır ve `disable-model-invocation: true` işaretlidir (örn. `smart-task`, `plan-first`, `safe-review`, `release-gate`, `kit-doctor`). Hiçbir agent'ın referans vermediği skill yetim değildir: doğrudan çağrılmak için vardır.

**Uygulama:** `feature-build`, `feature-plan`, `bug-fix`, `refactor-safe`, `ui-change`, `new-page`, `new-screen`, `from-scratch`

**Veri ve API:** `data-modeling`, `db-change`, `api-design`, `api-versioning`, `migration-review`

**Kalite ve Güvenlik:** `code-review`, `safe-review`, `security-review`, `security-scan`, `test-writer`, `performance-check`, `code-audit`

**DevOps ve Ortam:** `release-check`, `release-gate`, `env-audit`, `dep-check`, `monorepo-task`, `kit-doctor`

**İçerik ve Araştırma:** `docs-update`, `article-write`, `academic-write`, `deep-research`, `strategy-plan`

**AI/LLM:** `llm-integration`

**Orkestrasyon:** `smart-task`, `plan-first`

### Rule'lar (11) — otomatik yüklenir

| Dosya | Kapsam |
| --- | --- |
| `000-security` | Her değişiklik — pasif güvenlik taraması, OWASP 2025 |
| `001-conventions` | Her zaman — mimari tespiti, modern teknoloji tercihleri |
| `100-web` | `*.tsx, *.jsx, *.vue, *.svelte` — tasarım token'ları, 8px grid, SEO, WCAG 2.2 |
| `200-api` | `**/api/**, **/routes/**` — REST, OpenAPI 3.1, RFC 7807 |
| `300-testing` | `*.test.*, *.spec.*` — test piramidi, mock politikası |
| `400-mobile` | `*.swift, *.kt, **/lib/**/*.dart` — platform kalıpları |
| `500-database` | `**/migrations/**, *.prisma` — şema güvenliği, N+1, RLS |
| `600-devops` | `Dockerfile*, .github/**` — non-root, SHA-pin, SBOM, OIDC |
| `700-observability` | `**/*.ts, **/*.py, **/*.go` — log seviyeleri, metrikler, tracing |
| `800-llm-safety` | `**/ai/**, **/llm/**, **/anthropic/**` — prompt injection, maliyet kontrolleri |
| `900-performance` | `**/*.ts, **/*.tsx, **/*.py, **/*.go` — CWV bütçeleri, N+1, bundle limitleri |

### Agent dokümanları (15) — lazy-load, ihtiyaç anında okunur

Bu dokümanlar her oturuma önceden yüklenmez. `global-CLAUDE.md`'deki `Lazy-load docs:` direktifi bunları listeler; bir skill veya rule birine atıf yaptığında Claude dosyayı diskten okur. Büyük referans içerikleri, gerekmedikçe bağlamı şişirmez. Tam liste: [README.md — Agent Docs](README.md#agent-docs-15--lazy-load-read-on-demand).

### Örnekler (15 adım adım anlatım)

Stack tespiti → kopyalanan dosyalar → üretilen `stack-rules.md` → 3 gerçek kullanım akışı → görev başına maliyet tahminleri. Başlangıç için en iyisi: [`examples/with-vs-without-kit.md`](examples/with-vs-without-kit.md) — aynı üç isteğin kitli ve kitsiz nasıl ele alındığı.

### Hooks (opsiyonel) — deterministik zorlama

Kitin geri kalanı prompt disiplinidir; [`hooks/`](hooks/README.md) en kritik kuralı harness garantisine çevirir. `protected-paths` PreToolUse hook'u; secrets, auth, ödeme, migration veya CI/IaC yollarına yapılan her Edit/Write'ı yakalar ve incelemesi gereken guard agent'ın adını vererek açık izin sorusuna dönüştürür — model ne karar vermiş olursa olsun. Installer `hooks/`'u kopyalar ama asla etkinleştirmez; `settings.json`'a bağlamak bilinçli bir kullanıcı adımıdır ([hooks/README.md](hooks/README.md)). Plugin olarak kurulduğunda hook otomatik kaydolur.

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

Commit öncesi doğrulayıcıyı çalıştırın:

```bash
npm run validate
```

CI bunu her push'ta otomatik çalıştırır (`.github/workflows/repo-ci.yml`).

Kitin *yönlendirme davranışı* da test altındadır: [`eval/golden-prompts.json`](eval/golden-prompts.json), 33 gerçekçi isteği (TR+EN karışık) beklenen agent'a sabitler. `npm run routing-eval` ücretsiz statik yarıyı her push'ta koşar; `RUN_ROUTING_EVAL=1 npm run routing-eval` modele her prompt'u gerçekten yönlendirtir ve %90 altı skorda başarısız olur (`.github/workflows/routing-eval.yml`).

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
- Sürüm yükseltme: **[UPGRADE.md](UPGRADE.md)** · Kurulum doğrulama: **[VERIFY.md](VERIFY.md)** · Güvenlik modeli: **[SECURITY.md](SECURITY.md)**.

## Token maliyeti referansı

Görev tipi başına tipik maliyetler (haiku ile UI düzeltmesi ~$0.001'den, opus ile mimari planlama ~$0.25'e) İngilizce README'nin [Token cost reference](README.md#token-cost-reference) tablosundadır. Maliyet düşürme: `settings.json`'daki `CLAUDE_CODE_SUBAGENT_MODEL=claude-haiku-4-5-20251001` anonim alt-görevleri haiku'ya yönlendirir (~%75 tasarruf).
