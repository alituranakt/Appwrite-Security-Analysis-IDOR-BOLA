# Adım 5: Kaynak Kod ve Kimlik Doğrulama Analizi

## 5.1 Genel Bakış

Bu bölümde Appwrite'ın açık kaynak PHP kaynak kodu tersine mühendislik yöntemiyle incelenerek kimlik doğrulama mekanizmaları, yetkilendirme katmanı ve IDOR/BOLA güvenlik açıklarının kod düzeyindeki kökleri analiz edilmektedir.

Analiz edilen kaynak kod: `appwrite/appwrite` GitHub deposu, `src/Appwrite/` dizini.

## 5.2 Kimlik Doğrulama Mimarisi

### JWT (JSON Web Token) Implementasyonu

Appwrite, kullanıcı kimlik doğrulaması için iki farklı token tipi kullanır.

**Session Token (Oturum Tokeni):** Kullanıcı giriş yaptığında bir oturum token'ı oluşturulur ve `a_session_{projectId}` adlı HTTP-only cookie olarak tarayıcıya gönderilir. Bu token sunucu tarafında doğrulanır ve 365 günlük ömre sahiptir. Cookie'nin `HttpOnly` bayrağı JavaScript erişimini engeller; `Secure` bayrağı ise yalnızca HTTPS üzerinden iletilmesini zorunlu kılar.

**JWT Token:** `/v1/account/jwt` endpoint'i aracılığıyla kullanıcı kendi adına kısa ömürlü bir JWT oluşturabilir. Bu JWT; header (alg: HS256), payload (userId, sessionId, iat, exp), ve HMAC-SHA256 imzasından oluşur. Varsayılan geçerlilik süresi 15 dakikadır. JWT'nin imzalanmasında kullanılan secret, `_APP_OPENSSL_KEY_V1` ortam değişkeninden okunur.

**Güvenlik Değerlendirmesi:** JWT süresinin 15 dakika ile sınırlı olması iyi bir pratiktir. Ancak JWT doğrulaması sadece imza kontrolüyle yapılır; token iptal (revocation) mekanizması mevcut değildir. Bu durum, çalınan bir JWT'nin süre dolana kadar kullanılmasına olanak tanır.

### API Key Kimlik Doğrulaması

API Key'ler `X-Appwrite-Key` header'ı ile gönderilir ve kaynak kod içinde `src/Appwrite/Auth/Auth.php` dosyasında doğrulanır. API Key'lerin scope sistemi vardır: `databases.read`, `databases.write`, `files.read` gibi granüler izinler tanımlanabilir. Ancak analizde tespit edilen kritik sorun, kötü yapılandırılmış API Key'lerin tüm projeye tam erişim sağlayabilmesidir.

## 5.3 Yetkilendirme Katmanı Analizi

### Middleware Zinciri

Appwrite'ın yetkilendirme sistemi middleware katmanlarından oluşur. Her istek şu zincirden geçer: Gelen HTTP isteği → Traefik (reverse proxy) → Appwrite PHP uygulaması → Auth middleware → Route handler → Veritabanı sorgusu.

`src/Appwrite/Auth/Auth.php` dosyasında tanımlanan `isPrivilegedUser()` ve `isAppUser()` fonksiyonları, isteğin API Key mi yoksa kullanıcı oturumu mu ile geldiğini belirler. Bu ayrım, hangi izin kurallarının uygulanacağını doğrudan etkiler.

### İzin Sistemi

Appwrite belge ve koleksiyon düzeyinde iki farklı izin tipi kullanır.

**Koleksiyon Düzey İzinler:** Tüm koleksiyona genel kurallar uygulanır. Örneğin `read("users")` kuralı, tüm kimliği doğrulanmış kullanıcıların koleksiyondaki TÜM belgeleri okumasına izin verir. Bu yapı BOLA güvenlik açığına zemin hazırlar: koleksiyona erişim yetkisi olan herhangi bir kullanıcı, başkasının belgelerini okuyabilir.

**Belge Düzey İzinler:** Her belge için bireysel kurallar tanımlanır. `read("user:userId123")` kuralı yalnızca belirli kullanıcıya okuma izni verir. Bu yaklaşım IDOR'a karşı gerçek koruma sağlar.

### Güvenlik Açığı: userId Alanı Doğrulaması

Appwrite veritabanı belgelerinde `$createdBy` ve özel `userId` alanları sunucu tarafında doğrulanmaz. Bu durum saldırganın belge oluştururken `userId` alanını başka bir kullanıcının ID'siyle doldurmasına ve sahte kayıt oluşturmasına olanak tanır. Sorun `src/Appwrite/Database/Validator/` altındaki validator sınıflarında; kullanıcı tarafından gönderilen meta alanların sunucu taraflı oturum bilgisiyle karşılaştırılmamasından kaynaklanmaktadır.

## 5.4 IDOR/BOLA Güvenlik Açıklarının Kaynak Kod Analizi

### Açık 1: Belge Düzey IDOR

`GET /v1/databases/{databaseId}/collections/{collectionId}/documents/{documentId}` endpoint'inin PHP kaynak kodunda, döndürülecek belge alınırken yalnızca koleksiyon düzey izin kontrolü yapılır. Belgenin `$read` alanındaki kullanıcı ID'si ile isteği yapan kullanıcının ID'si karşılaştırılmaz. Eğer koleksiyon `read("users")` kuralıyla yapılandırılmışsa, herhangi bir kullanıcı herhangi bir belge ID'sini doğrudan sorgulayarak erişebilir. Bu, klasik IDOR (Insecure Direct Object Reference) örüntüsüdür.

**Etkilenen kod akışı:** `DatabasesController.php` → `getDocument()` → `Database::getDocument()` → izin kontrolü → koleksiyon düzey izin yeterli → belge döndürülür.

### Açık 2: Koleksiyon Listeleme BOLA

`GET /v1/databases/{databaseId}/collections/{collectionId}/documents` endpoint'i, koleksiyonda `read("users")` kuralı tanımlıysa, kimliği doğrulanmış herhangi bir kullanıcının tüm belgeleri listelemesine izin verir. Bu BOLA (Broken Object Level Authorization) örüntüsüdür: saldırgan kendi belgelerine değil, tüm koleksiyona erişim elde eder ve diğer kullanıcıların belgelerini tek tek keşfedebilir.

### Açık 3: Kullanıcı Oluşturma (Unrestricted Account Creation)

`POST /v1/account` endpoint'i varsayılan yapılandırmada herhangi bir e-posta ile yeni hesap oluşturulmasına izin verir. `_APP_CONSOLE_WHITELIST_EMAILS` ve `_APP_CONSOLE_WHITELIST_ROOT` ortam değişkenleri yapılandırılmamışsa sınırsız kayıt mümkündür. Saldırgan çok sayıda test hesabı oluşturarak IDOR testlerini gerçekleştirebilir.

## 5.5 Güvenlik Savunma Mekanizmaları

Appwrite'ın kaynak kodunda aşağıdaki savunma mekanizmaları tespit edilmiştir.

**Rate Limiting:** Appwrite, Redis tabanlı rate limiting uygular. Giriş endpoint'i (`/v1/account/sessions/email`) için dakikada 10 istek sınırı vardır. Bu mekanizma brute-force saldırılarını zorlaştırır ancak IDOR saldırılarını engellemez.

**Argon2 Parola Hashleme:** Kullanıcı parolaları Argon2id algoritmasıyla hashlenir. Bu, rainbow table ve brute-force saldırılarına karşı etkili bir korumadır.

**Webhook İmzalama:** Webhook bildirimleri HMAC-SHA1 imzasıyla doğrulanır. `X-Appwrite-Webhook-Signature` header'ı, gönderilen payload'ın bütünlüğünü garanti eder.

**HTTPS Zorunluluğu:** Traefik üzerinden otomatik SSL/TLS sertifika yönetimi yapılır. Tüm HTTP istekleri HTTPS'e yönlendirilir.

## 5.6 İyileştirme Önerileri

Analiz sonucunda şu iyileştirmeler önerilmektedir.

Belge düzey izinler zorunlu hale getirilmelidir: `read("user:$userId")` ve `write("user:$userId")` kullanımı varsayılan yapılandırma olarak tanımlanmalıdır. Koleksiyon düzey `read("users")` ve `read("any")` kuralları yalnızca genel içerik için kullanılmalıdır.

Appwrite Functions ile sunucu taraflı doğrulama yapılmalıdır: kullanıcı tarafından gönderilen `userId` alanları, oturum token'ından elde edilen gerçek kullanıcı ID'siyle Function içinde karşılaştırılmalıdır.

API Key kapsamları minimum yetki ilkesine göre yapılandırılmalıdır: yalnızca gerekli `scope` değerleri verilmeli, `*` (tam erişim) kuralından kaçınılmalıdır.

`_APP_CONSOLE_WHITELIST_EMAILS` ve `_APP_CONSOLE_WHITELIST_ROOT` değişkenleri production ortamında mutlaka yapılandırılmalıdır.

JWT için token revocation mekanizması planlanmalıdır: mevcut oturum listesinden çıkarılan bir JWT, süre dolmadan geçersiz sayılabilecek bir kara liste mekanizmasıyla desteklenmelidir.

## 5.7 Referanslar

Bu analizde başvurulan kaynaklar: OWASP API Security Top 10 (2023) — API1:2023 Broken Object Level Authorization, CVE-2023-27159 (Appwrite IDOR), CVE-2021-23682 (Appwrite yetkilendirme bypass), Appwrite güvenlik açığı raporları (GitHub Issues #4489, #5123, #6671), ve `appwrite/appwrite` kaynak kodu (`src/Appwrite/Auth/`, `src/Appwrite/Database/`).
