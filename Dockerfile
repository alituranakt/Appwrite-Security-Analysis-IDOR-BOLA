# ╔═══════════════════════════════════════════════════════════════════════╗
# ║  Dockerfile - Appwrite Security Analysis (IDOR/BOLA)                  ║
# ║                                                                       ║
# ║  Adım 4 Analizi: Docker Mimarisi                                     ║
# ║  Tersine Mühendislik Dersi - Vize Projesi                           ║
# ╚═══════════════════════════════════════════════════════════════════════╝
#
# === DOCKERFILE ANALİZİ ===
#
# Bu Dockerfile, güvenlik analiz ortamını konteynerize eder.
# Multi-stage build kullanılarak imaj boyutu optimize edilir.
#
# KATMAN (LAYER) YAPISI:
#   Stage 1 (builder): Bağımlılıkları kurar
#   Stage 2 (production): Sadece gerekli dosyaları kopyalar
#
# GÜVENLİK ÖNLEMLERİ:
#   1. Non-root kullanıcı (analyst) ile çalıştırılır
#   2. Minimal base imaj (python:3.10-slim)
#   3. --no-cache-dir ile gereksiz pip cache engellenir
#   4. HEALTHCHECK ile konteyner sağlık durumu izlenir
#   5. .dockerignore ile hassas dosyalar imaja dahil edilmez

# ====================================================================== #
#  STAGE 1: BUILDER - Bağımlılık Kurulumu
# ====================================================================== #
FROM python:3.10-slim AS builder

# Çalışma dizini
WORKDIR /build

# Önce sadece requirements.txt'yi kopyala (Docker cache optimizasyonu)
# Bu sayede bağımlılıklar değişmedikçe bu katman cache'den gelir
COPY poc/requirements.txt ./requirements.txt

# Python bağımlılıklarını kur
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ====================================================================== #
#  STAGE 2: PRODUCTION - Çalışma Ortamı
# ====================================================================== #
FROM python:3.10-slim AS production

# Metadata etiketleri
LABEL maintainer="alituranakt"
LABEL description="Appwrite Security Analysis - IDOR/BOLA PoC Environment"
LABEL version="1.0"

# Güvenlik: Non-root kullanıcı oluştur
# Root olarak çalıştırmak güvenlik riski oluşturur
RUN groupadd -r analyst && useradd -r -g analyst -m analyst

# Çalışma dizini
WORKDIR /app

# Builder stage'den Python paketlerini kopyala
COPY --from=builder /install /usr/local

# Proje dosyalarını kopyala
COPY poc/ ./poc/
COPY Scripts/ ./Scripts/
COPY docs/ ./docs/
COPY README.md ./

# Dizin izinlerini ayarla
RUN mkdir -p /app/results /app/logs \
    && chown -R analyst:analyst /app

# Script izinleri
RUN chmod +x Scripts/*.sh 2>/dev/null || true

# Non-root kullanıcıya geç
USER analyst

# Sağlık kontrolü: Python ve bağımlılıkların çalıştığını doğrula
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; print('OK')" || exit 1

# Varsayılan komut: PoC scriptinin yardım çıktısı
CMD ["python", "poc/idor-demo.py", "--help"]
