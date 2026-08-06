# AgentLens — Proje Web Sitesi

TOBB ETÜ Bilgisayar / Yapay Zekâ Mühendisliği · BİL 495 — YAP 495 · 2025-2026 Yaz Dönemi
Danışman: Shadi Bikas

Statik site. Derleme adımı yok, bağımlılık yok, paket kurulumu yok — klasörü olduğu
gibi yayınlamanız yeterli.

---

## Klasör yapısı

```
index.html            Ana sayfa (tasarımın tüm CSS'i bu dosyada gömülü)
css/agentlens.css     Yalnızca yeni bileşenler (demo, rapor listesi, takım, iletişim)
js/site.js            Animasyon ve etkileşim katmanı
fonts/                Web fontları
images/               Site görselleri
images/team/          Takım fotoğrafları — buraya sizin eklemeniz gerekiyor
reports/              Beş raporun PDF ve DOCX sürümleri
robots.txt
```

## Yayınlama

**GitHub Pages** — bu klasörün içeriğini deponun köküne veya `docs/` klasörüne koyup
Settings → Pages'ten kaynağı seçin.

**Vercel / Netlify** — klasörü sürükleyip bırakın. Framework: "Other",
build command boş, output directory `.`

Her iki seçenek de otomatik HTTPS sağlar.

---

## Yayına almadan önce doldurulacaklar

| Ne | Şu an | Nerede |
|---|---|---|
| Takım fotoğrafları | baş harfli daireler | `images/team/` klasörü (aşağıya bakın) |
| LinkedIn adresleri | pasif "LinkedIn" etiketi | `index.html`, takım bölümü |
| Takım e-postası | `agentlens.tobb@gmail.com` | `index.html` içinde 3 yerde geçer |

### Fotoğraf ekleme

`images/team/` içine şu adlarla kare fotoğraf koyun (en az 200×200 px, `.jpg`):

```
anil-ozisler.jpg
irem-ozdemir.jpg
yigit-yildiz.jpg
arda-gunaydin.jpg
yusuf-mert-usta.jpg
```

Dosya yoksa site otomatik olarak üyenin baş harflerini gösterir ve hata vermez.
Fotoğrafı ekleyip sayfayı yenilemek yeterli. Danışman kutusunda fotoğraf yoktur.

### LinkedIn adresi ekleme

İlgili üyenin satırındaki

```html
<span class="b-team__link t-t-3xs is-empty">LinkedIn</span>
```

satırını şununla değiştirin:

```html
<a class="b-team__link t-t-3xs" href="ADRES" target="_blank" rel="noopener">LinkedIn</a>
```

### Rapor güncelleme

`reports/` içindeki dosyaları aynı adla değiştirin; bağlantılar sabit kalır.
DOCX'ten PDF üretmek için:

```
soffice --headless --convert-to pdf reports/*.docx --outdir reports/
```

---

## Teknik notlar

**Neden ayrı bir JavaScript dosyası var.** Referans tasarım, bir Nuxt (Vue) sitesinin
dışa aktarılmış kopyasıydı ve JavaScript paketinin bir bölümü (`_payload.json`,
`C_Ten2U2.js` ve beş chunk daha) bu kopyaya dahil edilmemişti. Gerçek bir HTTP
sunucusunda sayfa hydrate olmaya çalışıp başarısız oluyor ve tüm içeriği siliyordu —
`file://` ile açıldığında tarayıcı modülleri engellediği için bu görünmüyordu.
`js/site.js` o çalışma zamanının yerini alır. Stil dosyalarına dokunulmamıştır;
mevcut CSS'in beklediği durumlar (`.is-fluid-ready`, `.is-open`, `.is-revealed`,
`.is-visible`, `--fade`, `--content-height`, sabitlenmiş kart yığını) çerçevesiz
olarak sürülür.

**Efektler.** Hero ve kapanış bölümündeki arkaplan, WebGL üzerinde çalışan bir
akışkan alanıdır: noktalı doku ve başlık bir dokuya çizilir, imleç hareketi bir hız
alanı üretir, shader dokuyu üç renk kanalından farklı kaydırmalarla örnekleyerek
kromatik ayrışmayı oluşturur. Başlığın konumu DOM'dan ölçülür, bu yüzden yazı tipi
veya ekran boyutu değişse de hizalama korunur. WebGL yoksa başlıklar normal DOM
metni olarak görünür, site çalışmaya devam eder.

**Performans.** Kare süreleri sürekli 34 ms'yi aşarsa site kendini otomatik olarak
sadeleştirir: kartlardaki dekoratif akışkan katmanlar kapanır, arkaplan alanı yarı
hızda güncellenir. Kaydırma akıcılığı süslemeden önce gelir.

**Erişilebilirlik.** `prefers-reduced-motion` açıksa yumuşak kaydırma, satır
açılımları ve döngüsel SVG animasyonları devre dışı kalır. Demo sekmeleri klavye ok
tuşlarıyla gezilebilir, modal Escape ile kapanır ve odak geri döner.
