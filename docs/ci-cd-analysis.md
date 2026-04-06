# Adım 3: CI/CD Pipeline Analizi - Appwrite Security Analysis

## 3.1 Pipeline Genel Bakış

Bu projede GitHub Actions kullanılarak 5 aşamalı bir CI/CD pipeline oluşturulmuştur. Pipeline, kod kalitesi kontrolünden Docker build sürecine kadar tüm aşamaları otomatize eder.

### Webhook Mekanizması

GitHub Webhook, bir repository'de belirli bir olay gerçekleştiğinde (push, pull request, issue vb.) GitHub'ın belirlenen URL'ye HTTP POST isteği göndermesidir. CI/CD bağlamında süreç şu şekilde işler:

1. Geliştirici kodu push eder
2. GitHub webhook tetiklenir ve Actions runner'a sinyal gönderir
3. Runner, tanımlanan pipeline adımlarını sırasıyla çalıştırır
4. Sonuç GitHub'a geri bildirilir (commit status check)

### Pipeline Akış Şeması

```
push/PR → [lint] → [docs]
              ↓
          [security] → [poc-test] → [docker]
```

## 3.2 Tetikleme Kuralları (Triggers)

Pipeline şu durumlarda otomatik tetiklenir:

**Push olayı:** `main` ve `develop` branch'lerine yapılan push'larda çalışır. `screenshots/` dizini ve `LICENSE` dosyasındaki değişiklikler pipeline'ı tetiklemez (`paths-ignore`).

**Pull Request olayı:** `main` branch'ine açılan PR'larda çalışır. `opened`, `synchronize` ve `reopened` event type'larında tetiklenir.

**Manuel tetikleme:** GitHub UI üzerinden "Run workflow" butonu ile elle başlatılabilir. Güvenlik taraması bu modda devre dışı bırakılabilir.

## 3.3 Pipeline Aşamaları (Jobs)

### Job 1: Kod Kalite Kontrolü (Lint)

PoC Python scriptlerinin kod kalitesi `flake8` aracıyla kontrol edilir. İki aşamalı kontrol uygulanır: ilk aşamada söz dizimi hataları ve tanımsız isimler (E9, F63, F7, F82) kontrol edilir ve pipeline durdurulur; ikinci aşamada stil uyarıları bilgilendirme amaçlı raporlanır ancak pipeline durdurulmaz.

### Job 2: Dokümantasyon Doğrulama

Projenin tüm gerekli dokümantasyon dosyalarının (README.md, threat-model.md, docker-security-audit.md, ci-cd-analysis.md) mevcut olduğu doğrulanır. Eksik dokümantasyon dosyası varsa pipeline başarısız olur. Bu, tersine mühendislik analizinin bütünlüğünü garanti eder.

### Job 3: Güvenlik Taraması

Üç farklı güvenlik kontrolü yapılır:

**Bandit:** Python kaynak kodunu statik olarak analiz eder. SQL injection, XSS, hardcoded password gibi yaygın güvenlik açıklarını tarar. Sonuçlar JSON formatında artifact olarak saklanır.

**pip-audit:** Kullanılan Python paketlerindeki bilinen güvenlik açıklarını kontrol eder. CVE veritabanıyla karşılaştırma yapar.

**Shell Script Analizi:** Bash scriptlerinde `set -euo pipefail` (strict mode) varlığını ve tehlikeli `curl | bash` kalıplarını kontrol eder.

### Job 4: PoC Script Testi

IDOR/BOLA PoC scriptinin söz dizimi doğruluğu `py_compile` modülü ile kontrol edilir. Bu, PoC scriptinin en azından import edilebilir ve çalıştırılabilir durumda olduğunu garanti eder.

### Job 5: Docker Build ve Test

Docker imajı multi-stage build ile oluşturulur. Konteyner içinde PoC scriptinin söz dizimi doğrulanır. İmaj boyutu kontrol edilir ve 500MB'ı aşarsa uyarı verilir.

## 3.4 Appwrite'ın Kendi CI/CD Pipeline Analizi

Appwrite açık kaynak projesi, kendi GitHub Actions pipeline'ında şu adımları uygular:

**Kod Kalitesi:** PHP (Appwrite'ın backend'i PHP ile yazılmıştır) için PHPStan statik analiz aracı kullanılır. SDK'lar için dile özel linter'lar çalıştırılır.

**Test Süiti:** Birim testleri (unit tests) ve entegrasyon testleri (integration tests) çalıştırılır. Her SDK (Web, Flutter, Android, iOS, Python, Node.js, vb.) için ayrı test pipeline'ları mevcuttur.

**Docker Build:** Resmi Docker imajları multi-platform (linux/amd64, linux/arm64) olarak build edilir. Docker Hub'a otomatik push yapılır.

**Güvenlik Açıkları:**

- Appwrite'ın installer scripti `curl -sL https://appwrite.io/install/sh | bash` kalıbı kullanır. Bu pattern, indirilen scriptin doğrulanmadan çalıştırılması anlamına gelir.
- İndirilen `docker-compose.yml` dosyasının SHA256 hash kontrolü yapılmaz.
- HTTPS kullanılması MITM riskini azaltır ancak tamamen ortadan kaldırmaz.

## 3.5 Pipeline Bağımlılıkları (Dependencies)

Jobs arasındaki bağımlılık ilişkisi `needs` anahtar kelimesi ile tanımlanır:

- `lint` → Bağımlılığı yok, hemen başlar
- `docs` → Bağımlılığı yok, `lint` ile paralel çalışır
- `security` → `lint` başarılı olduktan sonra başlar
- `poc-test` → `lint` başarılı olduktan sonra başlar
- `docker` → Hem `lint` hem `poc-test` başarılı olduktan sonra başlar

Bu yapı, gereksiz kaynak kullanımını önler: lint başarısız olursa güvenlik taraması ve Docker build çalıştırılmaz.

## 3.6 Ortam Değişkenleri ve Güvenlik

Pipeline'da iki global ortam değişkeni tanımlıdır: `PYTHON_DEFAULT_VERSION: '3.10'` ve `DOCKER_IMAGE_NAME: appwrite-security-analysis`. Hassas bilgiler (API key, secret) pipeline'da hardcode edilmemiştir. Gerçek bir deploy senaryosunda bu bilgiler GitHub Secrets üzerinden yönetilmelidir.

## 3.7 Artifact Yönetimi

Güvenlik taraması sonuçları (bandit-report.json) GitHub Actions artifact olarak saklanır. 30 gün boyunca erişilebilir (`retention-days: 30`). Bu, geçmiş tarama sonuçlarının karşılaştırılmasına olanak tanır.

## 3.8 Sonuç ve Öneriler

Bu CI/CD pipeline, bir güvenlik analiz projesinin sürekli entegrasyonunu sağlamak için tasarlanmıştır. Pipeline, kod kalitesi kontrolünden Docker build sürecine kadar tüm kritik aşamaları kapsar. İyileştirme önerileri olarak şunlar düşünülebilir: SAST (Static Application Security Testing) araçlarının genişletilmesi, DAST (Dynamic Application Security Testing) entegrasyonu, ve otomatik IDOR/BOLA testlerinin pipeline'a eklenmesi.
