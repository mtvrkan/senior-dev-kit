# Senior Dev Kit

[![CI](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml/badge.svg)](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Claude Code'u hevesli bir junior yerine kıdemli bir mühendislik takımı gibi davrandıran
konfigürasyon kiti: **7 agent, 25 skill, 11 rule, 3 komut, 28 preset**.

🇬🇧 [English README](README.md) — kanonik sürüm; bu dosya onun çevirisidir.

---

## Çözdüğü problem

Varsayılan hâliyle Claude Code, bir CSS hatasını düzeltirken auth middleware'ini yeniden yazar,
bir kolonu düşürür ve yol üstünde alakasız üç dosyayı refactor eder. Etki alanı (blast radius)
duygusu, ev kuralları ve dün ne karar verdiğinin hafızası yoktur.

Bu kit, kıdemli bir takım arkadaşında olan ama modelde olmayan üç şeyi ekler:

- **Etki alanı farkındalığı.** Auth, ödeme, veritabanı şeması, CI/CD veya secret'lara dokunan
  her iş önce salt-okunur bir *guard* ajanına gider. Guard bir plan yazar ve durur. Siz
  onaylamadan tek satır kod yazılmaz.
- **Her iş tipi için bir prosedür.** "Şu bug'ı düzelt", "sayfa ekle", "bu migration'ı incele" —
  her birinin doğaçlama yerine izlenen yazılı bir disiplini var. Toplam 25 tane.
- **Context bütçesi.** Her turda yalnızca üç dosya yükleniyor (500 satır üst sınır, script'le
  denetleniyor). Geri kalan her şey — 11 rule dosyası, 16 referans doküman — eşleşen bir dosya
  okununca veya bir skill gerçekten ihtiyaç duyunca lazy yükleniyor.

Kitin kendisi hakkındaki her iddia elle değil, `npm run check` ile doğrulanır.

---

## Kurulum

Üç satır, hepsi Claude Code içinden:

```text
/plugin marketplace add mtvrkan/senior-dev-kit
/plugin install senior-dev-kit@senior-dev-kit
/kit-setup
```

Üçüncü satır tek seferliktir ve yapısal bir nedenle vardır: Claude Code, dosya türüne göre
yüklenen rule'ları ve izin kurallarını yalnızca ayar dizininizden okur; bir plugin oraya yazamaz.
`/kit-setup` ne yapacağını önce gösterir, onayınızı bekler ve dokunduğu her şeyi yedekler. Sonra
Claude Code'u yeniden başlatıp `/kit-doctor` ile doğrulayın.

Kurulumun tamamı bu. Güncellemeler `/plugin marketplace update` ile gelir.

Dosyaları kendi ayar dizininizde ister veya düzenlemek isterseniz — **Node.js 18+** gerekir,
bağımlılık yok:

```bash
git clone https://github.com/mtvrkan/senior-dev-kit.git
cd senior-dev-kit
node scripts/install.mjs --dry-run   # tam olarak neyin değişeceğini göster
node scripts/install.mjs             # sonra uygula
```

Mevcut hiçbir şeyiniz yok edilmez: `~/.claude/CLAUDE.md` protokolü işaretler arasında alır,
`settings.json`'a deny kuralları birleştirilir, üzerine yazılan her dosya önce yedeklenir.
**İkisini birden yapmayın** — bu konu, bayraklar, tek-proje kurulumu ve kaldırma:
[`docs/install.md`](docs/install.md).

---

## Kullanım

Kurulumdan sonra akılda tutulacak bir şey yok. İşi anlatırsınız, yönlendirme otomatiktir:

```text
"login sayfasındaki kırık linki düzelt"   → bug-hunter
"bir ayarlar sayfası ekle"                → senior-engineer
"ödeme akışını yeniden tasarla"           → feature-plan (plan mode) + security-guard
"Docker CI'a SBOM üretimi ekle"           → devops-guard
"users tablosuna kolon ekle"              → db-guard — plan üretir, onaysız migration yok
```

Çakışan sinyaller arasındaki önceliklendirme dahil tam karar ağacı:
[`agents/ROUTING.md`](agents/ROUTING.md). Oturum içinden `/agents-guide` ve `/skills-guide` kurulu
olanları listeler, `/kit-doctor` bozuk kurulumu teşhis eder.

Bir iş gününde fiilen ne değişiyor — etki alanı seviyeleri, guard'lara neden güvenilebileceği,
yazabileceğiniz komutlar — [`docs/usage.md`](docs/usage.md) içinde.

---

## İçerik

| | Sayı | Notlar |
| --- | --- | --- |
| Agent | 7 | 4'ü salt-okunur guard (db, security, devops, performance) |
| Skill | 25 | Çoğu iş tipine göre otomatik tetiklenir; birkaçı yalnızca slash komutuyla |
| Rule | 11 | `000`/`001` her oturumda yüklenir; kalan 9'u `paths:` glob eşleşmesiyle |
| Komut | 3 | `/agents-guide`, `/skills-guide`, `/seo-check` |
| Preset | 28 | web: nextjs-saas, react-vite, nuxt, sveltekit, astro, angular · backend: node-express, nestjs, fastapi, django, laravel, rails, spring-boot, dotnet, go-api, rust-axum · mobile: flutter, react-native, swiftui · orm: prisma, drizzle · db: postgres, mongodb, supabase · infra: docker, kubernetes, terraform · generic: fallback |
| agent_docs | 16 | Talep üzerine okunan derin referans sayfaları |

Kısaca: 7 agent, 25 skill, 11 rule, 3 komut, 28 preset.

Ayrıca bir guardrail katmanı: `settings-template.json` içinde ~400 deny kuralı — secret dosya
okumalarını, yıkıcı shell komutlarını ve onaysız uzak paket çalıştırıcılarını engeller. Kapsam ve
bilinen boşluklar [`SECURITY.md`](SECURITY.md) içinde dürüstçe belgelenmiştir — **engellemediği**
şeyler dahil.

---

## Nasıl çalışır?

1. **Her oturumda** yalnızca `global-CLAUDE.md`, `rules/000-security.md` ve
   `rules/001-conventions.md` yüklenir. Toplam satır sayıları script'le sınırlıdır; çünkü bu,
   her turda, her projede, sonsuza kadar ödenen maliyettir.
2. **Dosyalar okundukça** türüne uyan rule'lar devreye girer — bir `.tsx` açılınca `100-web`, bir
   migration açılınca `500-database` yüklenir.
3. **İş tipi eşleşince** ilgili skill tetiklenir. İstek korumalı bir alana dokunuyorsa guard
   ajanına eskale edilir; guard'lar teamül gereği değil, tool grant'ı gereği salt-okunurdur.

---

## Doğrulama

Bu README'deki her sayı, her çapraz referans ve her iddia test paketi tarafından diskten yeniden
türetilir. Tek komut:

```bash
npm run check
```

Şu an: 346/346 test geçiyor (55 suites). `routing-eval` yönlendirme tablosunu 26 gerçekçi isteği
ile sabitler, `check-consistency` bu dosyadaki elle yazılmış her sayıyı yeniden türetir,
`check-plugin` ise plugin manifestlerinin diskteki bileşenlerle hâlâ eşleştiğini doğrular.

**Bunun kanıtladığı ve kanıtlamadığı şey.** Açık olalım: bu 346 test *iç tutarlılık* testidir.
Dokümantasyonun diskteki dosyalarla eşleştiğini kanıtlar — hiçbir sayının bayat, hiçbir yolun ölü,
hiçbir kuralın bir yerde iddia edilip başka yerde eksik olmadığını. **Kitin modelin çıktısını
iyileştirip iyileştirmediğini ölçmezler.** CI'da yeşil geçen hiçbir şey bunu ölçmüyor.

Tek davranışsal ölçüm `routing-eval`'in canlı kolu ve API kredisi harcadığı için opt-in:

```bash
RUN_ROUTING_EVAL=1 npm run routing-eval
```

26 golden prompt üzerinde bir A/B çalıştırır — prompt başına iki CLI çağrısı, toplam 52: yalnızca
agent frontmatter açıklamalarıyla bir **kontrol** kolu (bu kitin yönlendirme dokümanı olmadan
Claude Code'un elindeki bilgi) ve `agents/ROUTING.md` eklenmiş bir **tedavi** kolu; sonra ikisi
arasındaki doğruluk farkını raporlar. Üç şekilde başarısız olur: tedavi kolu mutlak eşiğin altına
düşerse; tedavi kolu kontrolü geçemezse (`ROUTING.md` her oturumda context'e yükleniyor, bunu hak
etmek zorunda); ya da düz açıklamaların doğru yönlendirdiği bir prompt'u `ROUTING.md` bozarsa —
bu, net lift'ten ayrı kontrol edilir, aksi hâlde bozulma iyileşmeyle sadeleşip görünmez olurdu.

**Ölçülen sonuç, 2026-08-11:** kontrol 22/26 (%85), tedavi 26/26 (%100) — +15,4 puanlık bir lift
ve düz açıklamaların doğru yönlendirdiği hiçbir prompt bozulmadı. Tablonun taşıdığı dört prompt,
cümledeki fiilin korumalı alan ismine yenildiği durumlardı (`login formundaki CSS'i düzelt` →
`ui-fixer` değil `security-guard`). Bu tam sayılar `eval/golden-prompts.json` içinde duruyor ve
`check-consistency`, bu paragraf o dosyada olmayan bir skor iddia ederse kapıyı kırmızıya
çeviriyor. Tek model sürümünde tek koşu; taze istiyorsan kendin çalıştır.

Bu, birkaç bileşenden yalnızca birini — yönlendirmeyi — kapsıyor. Kuralların, skill'lerin ve
preset'lerin arkasında A/B yok, kod kalitesinde öncesi/sonrası ölçümü yok; onlar ölçüme değil
muhakemeye dayanıyor. Bu kiti benimseyip benimsememeye karar veriyorsan buna göre tart.

---

## Dokümantasyon

- [`docs/install.md`](docs/install.md) — tüm kurulum yolları, bayraklar, kaldırma
- [`docs/usage.md`](docs/usage.md) — yönlendirme, seviyeler, context bütçesi, yazılabilecek komutlar
- [`docs/reference.md`](docs/reference.md) — her agent, skill, rule ve komut; diskten üretilir
- [`docs/troubleshooting.md`](docs/troubleshooting.md) — kuruldu ama beklendiği gibi çalışmıyorsa

## Daha fazlası

- [`SECURITY.md`](SECURITY.md) — tehdit modeli, deny kuralı kapsamı, bilinen boşluklar, açıklama süreci
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — doğrulama kapısı, bütçeler, yeni bileşen ekleme
- [`CHANGELOG.md`](CHANGELOG.md) — ne, ne zaman değişti
- [`CLAUDE.md`](CLAUDE.md) — kitin kendisi üzerinde çalışırken geçerli kurallar
- [`presets/README.md`](presets/README.md) — preset yapısı ve stack birleştirme

## Lisans

[MIT](LICENSE) © Mehmet Türkan
