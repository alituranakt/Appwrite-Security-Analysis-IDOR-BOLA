# 06. IDOR / BOLA Vaka Calismasi

## 6.1 Odev Senaryosunu Appwrite'a Nasil Haritaliyorum?

Odevde verilen ornek:

> Yetkisiz bir kullanici, URL veya API istegindeki ID'yi degistirerek baska bir kullaniciya ait faturayi indiriyor.

Appwrite baglaminda bu senaryo tipik olarak su mimaride ortaya cikar:

- Fatura metaverisi veri katmaninda tutulur
- PDF dosyasi Appwrite Storage'da tutulur
- Uygulama istemcisi `invoiceId` veya `fileId` ile ilgili kaydi ister
- Gelistirici izinleri hatali verirse baska kullanici dosyasi okunabilir

## 6.2 BOLA Tam Olarak Nerde Dogar?

BOLA/IDOR, sadece ID tahmin edilebildigi icin dogmaz. Asil problem, sunucunun su soruyu sormamasidir:

`Bu oturumdaki kullanici bu nesneye gercekten erisebilir mi?`

Appwrite ortaminda hatali tasarim soyle olabilir:

- `invoices` tablosundaki satirlara `Role.users()` ile genis `read` izni verilir
- Storage bucket veya file tarafinda `Role.any()` ya da tum kullanicilara acik `read` izni verilir
- Istemci tarafindan gelen `invoiceId` dogrudan veri sorgusunda kullanilir
- Owner filtrelemesi veya nesne permission modeli uygulanmaz

Bu durumda Appwrite teknik olarak "yanlis" davranmaz; uygulama sahibi cok genis izin verdigi icin platform o izni uygular. Zafiyet uygulama tasarimindadir.

## 6.3 Zafiyetli Tasarim Ornegi

Asagidaki ornek kasitli olarak yanlistir:

```ts
// Yanlis fikir: sadece invoiceId degistirmek yeterli olabilir.
const invoice = await databases.getDocument({
  databaseId,
  collectionId: "invoices",
  documentId: invoiceIdFromUrl,
});

const file = await storage.getFileDownload({
  bucketId: "invoices",
  fileId: invoice.fileId,
});
```

Bu kodun problemi:

- `invoiceIdFromUrl` istemciden geliyor.
- Kod owner kontrolu yapmiyor.
- Guvenlik tamamen daha once atanmis permission'lara kalmis durumda.
- Permission yanlis ise BOLA hazir.

## 6.4 Guvenli Tasarim Modeli

Guvenli modelde iki katman birlikte kurulur:

1. Nesne olusturulurken izinler owner'a veya ilgili takima ozel atanir.
2. Sunucu, istemciden gelen `userId` benzeri degerlere guvenmez; session'daki kullaniciyi esas alir.

Sematik ornek:

```ts
// Sunucu tarafinda: faturayi olustururken owner bazli izin ver.
await databases.createDocument({
  databaseId,
  collectionId: "invoices",
  documentId: ID.unique(),
  data: {
    ownerUserId: account.$id,
    fileId,
    total,
  },
  permissions: [
    Permission.read(Role.user(account.$id)),
    Permission.update(Role.user(account.$id)),
    Permission.delete(Role.user(account.$id)),
  ],
});

// Dosya tarafinda da benzer owner bazli read izni kullan.
```

Ek savunma:

```ts
// Okurken yalnizca mevcut kullaniciya ait nesneyi kabul et.
const rows = await databases.listDocuments({
  databaseId,
  collectionId: "invoices",
  queries: [Query.equal("ownerUserId", [account.$id])],
});
```

Buradaki mantik:

- Sadece tahmin edilmesi zor ID kullanmak yetmez.
- Yetki modeli veri dogum aninda atanir.
- Okuma akisi session baglamina gore daraltilir.

## 6.5 Appwrite Ozellikleri Bu Sorunu Nasil Kapatir?

Appwrite'in sundugu temel savunmalar:

- Session tabanli erisim
- Granular permission modeli
- `Role.user(...)`, `Role.team(...)`, `Role.users(...)`, `Role.any()` gibi role primitive'leri
- Bucket-level ve file-level security
- Object bazli permission listeleri

Dogru kullanim:

- Faturayi yalniz `Role.user(ownerId)` veya uygun team role ile ac
- Storage dosyalarinda file security kullan
- API key'i istemciye verme
- Server tarafinda session/JWT dogrulamasiyla owner baglamini zorunlu kil

## 6.6 Odev Cevabi Olarak Kisa Yol Haritasi

Odevin istedigi sade ifade su sekilde yazilabilir:

1. `ID` kontrolu tek basina yeterli degil.
2. API, "bu ID var mi?" kadar "bu kullanici bu nesneyi gorebilir mi?" sorusunu sormali.
3. Appwrite'da bu kontrol object permission ve owner filtresi ile saglanir.
4. Fatura gibi hassas dosyalar asla `Role.any()` ile yayinlanmamalidir.

## 6.7 OWASP Ile Esleme

OWASP API Security Top 10, BOLA'yi API'lerde en yaygin ve yuksek etkili problemlerden biri olarak tanimlar. Temel risk, istemcinin gonderdigi object ID'ye asiri guvenmektir.

Bu tanim Appwrite senaryosuna birebir oturur:

- object: invoice row / file
- attacker action: `invoiceId` veya `fileId` degistirmek
- root cause: eksik owner kontrolu veya fazla genis permission

Kaynak:

- [OWASP API Security](https://owasp.org/API-Security/)

## 6.8 Bu Adim Icin Sonuc

Appwrite secimi, IDOR/BOLA konusunu anlatmak icin iyi bir tercihtir. Cunku platformda nesne bazli yetkilendirme icin dogru primitive'ler vardir. Bu da projede su net ayrimi kurmayi saglar:

- `cekirdek platformun savunma kapasitesi`
- `gelistiricinin yaptigi permission tasarim hatasi`

Akademik olarak en guclu cevap da budur.

## 6.9 Bu Repository'deki Kod Karsiligi

Bu proje teoriyi calisan kodla eslemek icin uc farkli katman ekler:

- `web/app.js`
  - kullanicinin kendi faturasini olusturur
  - owner-only row ve secure file yazar
  - ayni anda bilerek genis okunabilir insecure file da yazar
- `functions/insecure-invoice-proxy/src/main.js`
  - `invoiceId` parametresine guvenir
  - dynamic API key ile row ve file okur
  - ownership kontrolu yapmaz
- `functions/secure-invoice-proxy/src/main.js`
  - `x-appwrite-user-jwt` kullanir
  - Appwrite row permission modelini korur
  - `ownerUserId` alanini ayrica dogrular

Bu nedenle teslim reposu yalnizca "IDOR nasil olur?" demiyor; ayni veri modeli icin hatali ve dogru tasarimi uygulamali olarak gosteriyor.
