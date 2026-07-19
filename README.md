# Senior Dev Kit

Claude Code'u kıdemli bir mühendislik takımı gibi davranan bir asistana dönüştüren kişisel
konfigürasyon kiti: **7 agent, 24 skill, 11 rule, 3 komut, 9 preset**.

Bu repo dağıtım veya marketplace için değil — kendi günlük kullanımım için tutuluyor ve
fiilen kullandığım stack'lerle sınırlı tutularak kırpılmış durumda.

---

## Bu kit ne sağlar?

- **Koruma ajanları (guard'lar):** Veritabanı şeması, auth/ödeme, CI/CD gibi riskli alanlara
  dokunan her iş önce ilgili guard ajanına gider; guard plan üretir, onay almadan kod yazılmaz.
- **Otomatik tetiklenen skill'ler:** "bug düzelt", "yeni sayfa ekle", "migration incele" gibi
  görev kalıplarının her biri için adım adım disiplin tanımlı — Claude doğaçlama yapmaz,
  skill'i izler.
- **Lazy yüklenen kurallar:** Yalnızca 2 kural dosyası her oturumda yüklenir; geri kalan 9'u
  dosya türüne göre (`paths:` glob) otomatik devreye girer. Context bütçesi her turda korunur.
- **Guardrail deny listesi:** `settings-template.json` içinde ~400 kural; secret dosyalarının
  okunmasını, tehlikeli shell komutlarını ve zero-prompt paket çalıştırıcılarını engeller.
- **Kendi kendini denetleyen yapı:** Kit'in iddiaları (sayılar, çapraz referanslar, bütçeler)
  elle değil, `npm run check` altındaki script'lerle doğrulanır.

---

## Kurulum

**Gereksinim:** Node.js 24+ (script'ler `--experimental-strip-types` kullanır).

### Global kurulum (`~/.claude/`) — tüm projelere uygulanır

Komutları `senior-dev-kit/` klasörünün **yanından** çalıştırın (klasörün içinden değil) —
kaynak yollar `senior-dev-kit/...` bunu varsayar.

```bash
mkdir -p ~/.claude/agents ~/.claude/skills ~/.claude/commands ~/.claude/rules ~/.claude/agent_docs
cp senior-dev-kit/agents/* ~/.claude/agents/
cp -r senior-dev-kit/skills/* ~/.claude/skills/
cp senior-dev-kit/commands/* ~/.claude/commands/
cp senior-dev-kit/rules/* ~/.claude/rules/
cp senior-dev-kit/agent_docs/* ~/.claude/agent_docs/
cp senior-dev-kit/settings-template.json ~/.claude/settings.json  # deny listesi — ihtiyaca göre düzenlenebilir, bkz. SECURITY.md
cp senior-dev-kit/global-CLAUDE.md ~/.claude/CLAUDE.md
```

```powershell
New-Item -ItemType Directory -Force ~/.claude/agents, ~/.claude/skills, ~/.claude/commands, ~/.claude/rules, ~/.claude/agent_docs
Copy-Item senior-dev-kit\agents\* ~/.claude/agents/
Copy-Item -Recurse senior-dev-kit\skills\* ~/.claude/skills/
Copy-Item senior-dev-kit\commands\* ~/.claude/commands/
Copy-Item senior-dev-kit\rules\* ~/.claude/rules/
Copy-Item senior-dev-kit\agent_docs\* ~/.claude/agent_docs/
Copy-Item senior-dev-kit\settings-template.json ~/.claude/settings.json  # deny listesi — ihtiyaca göre düzenlenebilir, bkz. SECURITY.md
Copy-Item senior-dev-kit\global-CLAUDE.md ~/.claude/CLAUDE.md
```

### Tek projeye preset kurulumu

Proje kökünde `presets/<kategori>/<stack>/CLAUDE.md`'yi `CLAUDE.md` olarak kopyalayın.
Birden fazla stack kullanan projede ilgili `compact.md` dosyalarını tek `CLAUDE.md` altında
birleştirin — yapı detayı: `presets/README.md`.

### Sıfırdan proje

Yeni/boş bir projede, kitin hazır ajanları yerine projeye özel `.claude/` üreten yalın bir
takım isteniyorsa: `PROJECT-BOOTSTRAP.md`'yi proje köküne koyup Claude Code'a okutun —
adımlar dosyanın kendisinde.

---

## Kullanım

Kurulumdan sonra ekstra hiçbir şey gerekmez — normal konuşursunuz, yönlendirme otomatiktir:

```text
"login sayfasındaki linki düzelt"      → bug-hunter
"yeni bir ayarlar sayfası ekle"        → senior-engineer
"ödeme akışını yeniden tasarla"        → feature-plan (plan mode) + security-guard
"Docker CI'a SBOM ekle"                → devops-guard
"users tablosuna kolon ekle"           → db-guard (plan üretir, onaysız migration yok)
```

Hangi isteğin nereye gittiğinin tam karar ağacı: `agents/ROUTING.md`.
Kurulu ajan ve skill'lerin listesi oturum içinden: `/agents-guide` ve `/skills-guide`.

---

## İçerik

| | Sayı | Notlar |
| --- | --- | --- |
| Agent | 7 | `agents/*.md` — 4'ü guard (db, security, devops, performance), yönlendirme: `agents/ROUTING.md` |
| Skill | 24 | çoğu otomatik tetiklenir, bir kısmı yalnızca `/skill-adı` ile |
| Rule | 11 | `000`/`001` her oturumda yüklenir; kalan 9'u `paths:` glob'una göre lazy-load |
| Komut | 3 | `/agents-guide`, `/skills-guide`, `/seo-check` |
| Preset | 9 | web: nextjs-saas, react-vite · backend: node-express, nestjs, fastapi · orm: prisma · db: postgres · infra: docker · generic: fallback |
| agent_docs | 16 | talep üzerine okunan lazy-load referans dokümanları |

Kısaca: 7 agent, 24 skill, 11 rule, 3 komut, 9 preset.

---

## Nasıl çalışır?

1. **Her oturumda** yalnızca `global-CLAUDE.md` + `rules/000-security.md` +
   `rules/001-conventions.md` yüklenir (toplam satır bütçesi script'le denetlenir).
2. **Dosya okundukça** o dosya türüne uyan rule'lar (ör. `*.tsx` → `100-web`) kendiliğinden
   devreye girer.
3. **Görev kalıbı eşleşince** ilgili skill tetiklenir; riskli alan sinyali varsa iş guard
   ajanına eskale edilir — guard'lar salt-okunur plan modunda çalışır.

---

## Doğrulama

Tüm kapı tek komutta:

```bash
npm run check   # test + validate + link-check + consistency-check + routing-eval + typecheck + lint + markdown-lint
```

Şu an: 181/181 test geçiyor (39 suites). `routing-eval` yönlendirme tablosunu 26 gerçekçi
isteği ile sabitler; `consistency-check` bu README'deki sayılar dahil elle yazılmış her iddiayı
diskteki gerçek durumla karşılaştırır.

---

## Daha fazlası

- Güvenlik modeli, deny listesi kapsamı ve bilinen boşluklar: `SECURITY.md`
- Kitin kendisini geliştirirken geçerli komutlar ve kurallar: `CLAUDE.md`
- Preset yapısı ve compact.md birleştirme: `presets/README.md`
