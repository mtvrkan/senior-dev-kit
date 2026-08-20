# Senior Dev Kit

[![CI](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml/badge.svg)](https://github.com/mtvrkan/senior-dev-kit/actions/workflows/repo-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Claude Code'u hevesli bir junior yerine kıdemli bir mühendislik takımı gibi davrandıran
konfigürasyon kiti: **8 agent, 25 skill, 12 rule, 6 komut, 28 preset**.

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
  denetleniyor). Geri kalan her şey — 12 rule dosyası, 17 referans doküman — eşleşen bir dosya
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
| Agent | 8 | 4'ü salt-okunur guard (db, security, devops, performance) |
| Skill | 25 | Çoğu iş tipine göre otomatik tetiklenir; birkaçı yalnızca slash komutuyla |
| Rule | 12 | `000`/`001` her oturumda yüklenir; kalan 10'u `paths:` glob eşleşmesiyle |
| Komut | 6 | `/agents-guide`, `/skills-guide`, `/seo-check`, `/design-check`, `/arch-check`, `/a11y-check` |
| Preset | 28 | web: nextjs-saas, react-vite, nuxt, sveltekit, astro, angular · backend: node-express, nestjs, fastapi, django, laravel, rails, spring-boot, dotnet, go-api, rust-axum · mobile: flutter, react-native, swiftui · orm: prisma, drizzle · db: postgres, mongodb, supabase · infra: docker, kubernetes, terraform · generic: fallback |
| agent_docs | 17 | Talep üzerine okunan derin referans sayfaları |

Kısaca: 8 agent, 25 skill, 12 rule, 6 komut, 28 preset.

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

Şu an: 393/393 test geçiyor (61 suites). `routing-eval` yönlendirme tablosunu 31 gerçekçi isteği
ile sabitler, `check-consistency` bu dosyadaki elle yazılmış her sayıyı yeniden türetir,
`check-plugin` ise plugin manifestlerinin diskteki bileşenlerle hâlâ eşleştiğini doğrular.

**Bunun kanıtladığı ve kanıtlamadığı şey.** Açık olalım: bu 393 test *iç tutarlılık* testidir.
Dokümantasyonun diskteki dosyalarla eşleştiğini kanıtlar — hiçbir sayının bayat, hiçbir yolun ölü,
hiçbir kuralın bir yerde iddia edilip başka yerde eksik olmadığını. **Kitin modelin çıktısını
iyileştirip iyileştirmediğini ölçmezler.** CI'da yeşil geçen hiçbir şey bunu ölçmüyor.

Davranışı ölçen iki adım var ve ikisi de API kredisi harcadığı için opt-in:

```bash
RUN_ROUTING_EVAL=1 npm run routing-eval     # bash
$env:RUN_ROUTING_EVAL=1; npm run routing-eval   # PowerShell — satır içi ön ek yok
```

Golden prompt'lar üzerinde bir A/B çalıştırır — prompt başına iki CLI çağrısı: yalnızca
agent frontmatter açıklamalarıyla bir **kontrol** kolu (bu kitin yönlendirme dokümanı olmadan
Claude Code'un elindeki bilgi) ve `agents/ROUTING.md` eklenmiş bir **tedavi** kolu; sonra ikisi
arasındaki doğruluk farkını raporlar. Üç şekilde başarısız olur: tedavi kolu mutlak eşiğin altına
düşerse; `ROUTING.md`, düz açıklamaların yanlış yönlendirdiği rotaların yarısından azını
düzeltirse (her oturumda context'e yükleniyor, bunu hak etmek zorunda); ya da düz açıklamaların
doğru yönlendirdiği bir prompt'u `ROUTING.md` bozarsa — bu ayrı kontrol edilir, aksi hâlde bozulma
iyileşmeyle sadeleşip görünmez olurdu.

Prompt'ların dördü `none` bekliyor — kimseye devretme, doğrudan hallet. Bunlar olmadan süit, bir
yönlendirme dokümanının gerçekte bozulduğu şekilde bozulamıyordu: eskiden her prompt *bir* ajan
beklediği için, her şeyi devreden bir `ROUTING.md` de 100% alırdı. Eval yanlış ajanı ve eksik
devri görebiliyor, gereksiz devri göremiyordu. Pahalı olan o — bir subagent, tek kelimeyi
değiştirmek için projeyi sıfırdan okuyan yeni bir context penceresi — ve devretmeyi savunan bir
dokümanın en olası hatası da o.

**Ölçülen sonuç, 2026-08-14:** kontrol 25/31 (%81), tedavi 31/31 (%100) — açıklamaların yanlış
yönlendirdiği altı rotanın hepsi düzeltildi, doğru yönlendirdiklerinden hiçbiri bozulmadı. Arayı
açan şey negatif vakalar oldu: düz ajan açıklamalarının "ne zaman devretme" hakkında söyleyecek
hiçbir şeyi yok, o yüzden `src/pages/About.tsx'te 'Kurumsal' başlığını 'Hakkımızda' yap` yalnızca
"metin" kelimesine bakıp `ui-fixer`'a gidiyor; tedavi kolu ise `ROUTING.md`'nin Adım 3.5'ine ulaşıp
`none` diyor. Taşıdığı diğer rotalar, cümledeki ismin fiile iki yönde de üstün gelmesi gereken
durumlar (`login formundaki CSS'i düzelt` → `ui-fixer` değil `security-guard`; ama ödeme kodu
*için* test → guard değil `senior-engineer`). Tedavi kolu kayıtlı her koşuda kusursuz, örneklenen
taraf kontrol kolu — baraj bu yüzden puan değil, hata düzeltme oranı. Bu tam sayılar
`eval/golden-prompts.json` içinde duruyor ve `check-consistency`, bu paragraf o dosyada olmayan bir
skor iddia ederse — ya da kayıtlı koşu diskteki süiti tarif etmeyi bırakırsa — kapıyı kırmızıya
çeviriyor. Önceki sayı tam böyle bayatlamıştı: bir prompt eklenmeden önce ölçülmüştü ve arayı
kapatan yeni koşu, güncellenmiş tablonun bozduğu iki rotayı ortaya çıkardı. Tek model sürümünde tek
koşu; taze istiyorsan kendin çalıştır.

İkinci ölçüm, kuralların kendisi için: `behavior-eval`, zorunlu-seçim biçiminde yirmi karar
sorar (korumalı alanda escalate ediyor mu, PII logluyor mu, yön kaydı yokken soruyor mu, testi mi
siliyor kodu mu düzeltiyor) ve aynı A/B'yi kurar — **kontrol** hiç kit bağlamı yok, **tedavi** o
kararı üretmesi gereken kural dosyaları eklenmiş. Her kural dosyasının en az bir prompt tarafından
anılması zorunlu, anılmayan varsa kapı kırılıyor: dördü iki tur boyunca hiç ölçülmeden yayınlandı
ve süit temiz skor verdi, çünkü "var olan prompt'ların hepsi geçiyor" ile "yayınlanan kuralların
hepsi ölçülüyor" farklı iddialar ve yalnızca birincisinin kontrolü vardı.

```bash
RUN_BEHAVIOR_EVAL=1 npm run behavior-eval          # bash
$env:RUN_BEHAVIOR_EVAL=1; npm run behavior-eval    # PowerShell
```

**Ölçülen sonuç, 2026-08-20:** kontrol 20/20 (%100), tedavi 20/20 (%100) — lift yok, regresyon da
yok. Bunu olduğu gibi oku: bu süit bir regresyon dedektörüdür, kuralların faydasının kanıtı değil.
Cevap uzayı iki token olduğunda ve biri bir disiplinin adını taşıdığında (escalate / plan / flag /
refuse) temel model onu yardımsız seçiyor; süite girmeden önce sekiz aday prompt daha pilotlandı ve
kontrol sekizini de doğru bildi. Bu yüzden her iki süit de mutlak lift puanına değil, **temel
modelin yaptığı hataların ne kadarını kitin düzelttiğine** bağlandı: iki örneklenmiş kol arasındaki
fark, modeller iyileştikçe sıfıra yaklaşır ve puan barajı, kit hâlâ işini yaparken bile
aşılamaz hâle gelir. Burada kontrol hiç hata yapmıyor, dolayısıyla o baraj boşta — ve bunu açıkça
söylüyor.

Bu süitin kanıtlayabildiği şeyi artık iki kez kanıtladı ve asıl öğretici olan ikincisi. `global-CLAUDE.md`
ile `rules/500-database.md` tek başlarına doğru escalate üretiyor; birlikte yüklendiğinde, modelin
hiç kit bağlamı yokken reddettiği `DROP COLUMN` migration'ını yazdırıyorlar. Bu bir kez bulunup
always-loaded protokolde yamandı — ve **geri geldi**, 3 örneğin 3'ünde, çünkü yama yanlış dosyadaydı.
İkisi birlikte context'teyken *prosedürel* olan daha spesifik olandır ve `500-database.md`,
zero-downtime deseni, backup protokolü ve örnek DROP SQL'iyle birlikte, bunları onay-sonrasına
kilitleyen hiçbir cümle taşımıyordu. Bir dosyada "escalate", diğerinde "migration şöyle yazılır"
okuyan model, isteği cevaplayanı takip ediyor. Nitelendirme artık prosedürlerin yanında: hem o
dosyada hem de aynı şekle sahip olup bunun için hiç ölçülmemiş `600-devops.md`'de. `check-consistency`
bu zorunluluğu, bir kural dosyasında `ESCALATE TO:` geçmesinden türetiyor. Yukarıdaki kayıt ise
daha da sonraki bir yeniden koşu: always-loaded protokol, bu süitin okuduğu bir kural kazandı.

Her iki kayıt da bir `context_digest` taşıyor: tedavi kolunun tam olarak neyi okuduğunun parmak
izi — bir süitte `ROUTING.md` ve ajan açıklamaları, diğerinde prompt'lar ve kural dosyaları.
Bunlardan biri değişirse A/B yeniden koşulana kadar `check-consistency` kırmızıya döner; çünkü
sonradan yeniden yazılmış bir dokümana karşı ölçülmüş puan, daha zayıf bir sayı değil, yanlış bir
sayıdır. İki süit de haftalık olarak canlı koşuyor
([`.github/workflows/live-evals.yml`](.github/workflows/live-evals.yml)) — regresyon, kimse
bakmayı hatırlamadan da yüzeye çıkıyor.

Skill'lerin ve preset'lerin arkasında hâlâ A/B yok, kod kalitesinde öncesi/sonrası ölçümü yok. Bu
kiti benimseyip benimsememeye karar veriyorsan buna göre tart.

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
- [`PROJECT-BOOTSTRAP.md`](PROJECT-BOOTSTRAP.md) — bağımsız, ayrı bir şablon: boş bir repoda Claude
  Code'a verirsin, projeye özel bir `.claude/` kurulumunu kendi yalın ajan kadrosuyla üretir. Bu kiti
  kurmaz, bu kit de onu kurmaz; ikisi birlikte kullanılabilir. Kapının "yazılan komut gerçekten var
  mı" kontrolünün dışındadır, çünkü içindeki komutlar bu repoyu değil ürettiği projeyi anlatır.

## Lisans

[MIT](LICENSE) © Mehmet Türkan
