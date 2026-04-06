# ╔═══════════════════════════════════════════════════════════════════════╗
# ║  Dockerfile — Appwrite Security Analysis (IDOR/BOLA)                  ║
# ║  Tersine Mühendislik Dersi — Vize Projesi                            ║
# ╚═══════════════════════════════════════════════════════════════════════╝
#
# KATMAN (LAYER) YAPISI:
#   Stage 1 (builder)    → Bağımlılıkları kurar, imaj boyutunu optimize eder
#   Stage 2 (production) → Sadece gerekli dosyaları kopyalar
#
# GÜVENLİK ÖNLEMLERİ:
#   1. Non-root kullanıcı (analyst) — privilege escalation riski azalır
#   2. python:3.10-slim   — minimal saldırı yüzeyi
#   3. --no-cache-dir     — gereksiz pip cache engellenir
#   4. HEALTHCHECK        — konteyner sağlık durumu izlenir
#   5. .dockerignore      — hassas dosyalar imaja dahil edilmez

# ====================================================================== #
#  STAGE 1: BUILDER — Bağımlılık Kurulumu
# ====================================================================== #
FROM python:3.10-slim AS builder

WORKDIR /build

# Sadece requirements.txt kopyala → Docker layer cache optimizasyonu
# Bağımlılıklar değişmedikçe bu katman cache'den gelir (build hızlanır)
COPY poc/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ====================================================================== #
#  STAGE 2: PRODUCTION — Çalışma Ortamı
# ====================================================================== #
FROM python:3.10-slim AS production

# Metadata
LABEL maintainer="alituranakt"
LABEL description="Appwrite Security Analysis — IDOR/BOLA PoC Environment"
LABEL version="1.0"
LABEL org.opencontainers.image.source="https://github.com/alituranakt/Appwrite-Security-Analysis-IDOR-BOLA"

# Güvenlik: Non-root kullanıcı
# Root olarak çalıştırmak konteyner escape riskini artırır
RUN groupadd -r analyst && useradd -r -g analyst -m -d /home/analyst analyst

WORKDIR /app

# Builder stage'den Python paketlerini kopyala
COPY --from=builder /install /usr/local

# Proje dosyaları (her biri ayrı COPY → granüler cache kontrolü)
COPY poc/          ./poc/
COPY tests/        ./tests/
COPY Scripts/      ./Scripts/
COPY docs/         ./docs/
COPY config/       ./config/
COPY README.md     ./README.md
COPY SECURITY.md   ./SECURITY.md

# Dizin ve izin yapılandırması
RUN mkdir -p /app/results /app/logs \
    && chmod +x Scripts/*.sh 2>/dev/null || true \
    && chown -R analyst:analyst /app

# Ortam değişkenleri (varsayılan değerler)
ENV APPWRITE_ENDPOINT="http://localhost/v1" \
    DEBUG="false" \
    OUTPUT_FORMAT="json" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Non-root kullanıcıya geç
USER analyst

# Port (bilgilendirme amaçlı — bu konteyner dinlemiyor)
# EXPOSE 8080

# Sağlık kontrolü: Python ve requests kütüphanesinin kurulu olduğunu doğrula
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; print('OK')" || exit 1

# Varsayılan komut: PoC yardım çıktısı
CMD ["python", "poc/idor-demo.py", "--help"]
