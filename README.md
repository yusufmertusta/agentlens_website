# AgentLens — Proje Web Sitesi

BİL/YAP 495 bitirme projesi tanıtım sitesi. Statik: derleme adımı, paket kurulumu veya çerçeve yok.
Harici JavaScript kütüphanesi de yok — tüm animasyonlar `requestAnimationFrame` ve `IntersectionObserver` ile yazıldı.

```
.
├── index.html
├── assets/
│   ├── css/main.css
│   ├── js/main.js
│   └── team/            # ekip fotoğrafları buraya
└── reports/             # rapor PDF ve DOCX dosyaları buraya
```

---

## 1. Yayına alma

### Vercel (önerilen)

Hesap açtıktan sonra iki yol var:

**a) Sürükle-bırak** — [vercel.com/new](https://vercel.com/new) sayfasında proje klasörünü bırakın. Framework olarak "Other" seçili kalsın, build komutu boş kalsın. Bir dakika içinde `https://<proje-adi>.vercel.app` adresinde yayına girer, HTTPS otomatik.

**b) GitHub üzerinden (tercih edin)** — depoyu push edip Vercel'de "Import Git Repository" ile bağlayın. Sonrasında her `git push` siteyi otomatik günceller; rapor eklerken tekrar yükleme yapmanız gerekmez.

```bash
git init
git add .
git commit -m "Proje web sitesi"
git branch -M main
git remote add origin https://github.com/KULLANICI-ADI/agentlens-site.git
git push -u origin main
```

### GitHub Pages (alternatif)

Aynı klasör değişiklik gerektirmeden çalışır: **Settings → Pages → Deploy from a branch → main / (root)**.
Adres `https://KULLANICI-ADI.github.io/agentlens-site/` olur.

---

## 2. Doldurulması gereken yerler

`index.html` içinde `DOLDURULACAK` aratın — 6 nokta var:

| Yer | Ne yapılacak |
|-----|--------------|
| `og:url` / `og:image` | Canlı adres ve paylaşım görseli |
| Hero'daki "Kaynak kod" düğmesi | GitHub adresi (kod kapalıysa düğmeyi silin) |
| Raporlar bölümü | Her raporun PDF + DOCX bağlantısı |
| Ekip bölümü | Fotoğraf, rol, biyografi, LinkedIn, GitHub |
| Danışman kartı | Ünvan ve iletişim |
| İletişim bölümü | Takım e-postası ve depo adresi |

**Ekip fotoğrafı eklemek:** `assets/team/` içine kare kırpılmış (~600×600) görseller koyun ve ilgili kartta yorumu açın:

```html
<div class="ava" data-initials="AÖ">
  <img src="assets/team/anil.jpg" alt="Anıl Özişler">
</div>
```

**High-Level Design raporu bitince:** o satırdaki iki `<span class="pill sm off">` öğesini `<a class="pill sm" href="...">` yapın, `class="soon"` sınıfını `<li>` üzerinden silin ve alt yazıdaki "HAZIRLANIYOR" ifadesini teslim tarihiyle değiştirin.

**Raporları hazırlama:** DOCX dosyalarını `reports/` klasörüne `index.html`'deki adlarla kopyalayın, her birinin PDF çıktısını da alın (Google Docs → İndir → PDF, ya da `soffice --headless --convert-to pdf *.docx`). Raporları Drive linki olarak vermeyin; "erişim isteme" ekranı bu maddede en sık puan kaybettiren şey.

---

## 3. Animasyonlar nerede, nasıl ayarlanır

| Bölüm | Efekt | Nerede ayarlanır |
|-------|-------|------------------|
| Arka plan | İmleci takip eden yarım ton nokta ızgarası | `main.js` → `dotGrid` (`gap`, `R` yarıçapı) |
| Hero & CTA başlığı | İmlecin geçtiği yerde kromatik sapma (mercek) | `main.js` → `lens`, `main.css` → `.lens-c/.lens-m` maske yarıçapı |
| Başlıklar | Satır satır maskeyle açılma | `main.js` → `splitLines` |
| Sayılar | Görünüme girince sayaç | `data-count`, `data-dec`, `data-prefix`, `data-suffix` |
| Trace sahnesi | Kaydırmaya kilitli inceleme; turlar sırayla açılır, T-04 işaretlenir, rapor kartı çıkar | `index.html` → `style="--track:400vh"` uzunluğu belirler |
| Mimari | Kaydırdıkça kendini çizen diyagram; kutular sırayla aydınlanır | `--track:420vh`, sıra `main.js` → `order` dizisi |
| Modüller | Dikey kaydırmayla yatay kayan şerit | `--track:340vh` |
| Teknoloji | Sonsuz kayan iki şerit | `data-speed` değeri |
| Düğmeler | İmlece yaklaşınca çekilen mıknatıs efekti | `.magnetic` sınıfı |

Bir sahneyi yavaşlatmak/hızlandırmak için tek yapmanız gereken ilgili `--track` değerini değiştirmek (`400vh` → `600vh` daha yavaş).

`prefers-reduced-motion` açık olan kullanıcılarda bütün hareket kapanır ve içerik doğrudan görünür halde sunulur. 820px altında kaydırmaya kilitli sahneler normal bölümlere dönüşür.

---

## 4. Teslim öncesi kontrol

- [ ] Site canlı ve `https://` ile açılıyor
- [ ] Beş raporun PDF + DOCX bağlantısı çalışıyor (gizli sekmede test edin)
- [ ] Ekip üyeleri fotoğraf, biyografi ve LinkedIn ile listelendi
- [ ] Mimari diyagram ve arayüz taslağı görünüyor
- [ ] Telefonda yatay taşma yok, menü açılıyor
- [ ] `DOLDURULACAK` araması sonuç vermiyor
- [ ] Yazım denetimi yapıldı, sayfa baştan sona Türkçe

---

## Teknik notlar

- Tipografi: Onest (başlık/gövde) + IBM Plex Mono (etiket/veri), Google Fonts üzerinden. İkisi de tam Türkçe karakter desteği içerir.
- Erişilebilirlik: atlama bağlantısı, görünür klavye odağı, diyagram için `title` + `desc`, hareket azaltma desteği, JavaScript kapalıyken de tüm içerik okunur.
- Renk: tek aksan (`--signal`, sinyal pembesi) yalnızca işaretlenmiş hata durumlarında kullanılır. Değiştirmek isterseniz `main.css` en üstteki değişkeni güncellemeniz yeterli.
