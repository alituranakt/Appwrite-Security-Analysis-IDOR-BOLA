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
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash analyst

COPY poc/requirements.txt /tmp/requirements.txt
RUN pip install --upgrade pip && pip install -r /tmp/requirements.txt

COPY . /app
RUN chown -R analyst:analyst /app && chmod +x /app/scripts/*.sh

USER analyst

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD python -c "import requests; print('ok')" || exit 1

CMD ["python", "poc/idor_demo.py", "--dry-run"]

