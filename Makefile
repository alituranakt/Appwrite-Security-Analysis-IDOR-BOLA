# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Makefile — Appwrite Security Analysis                              ║
# ║  Tersine Mühendislik Dersi — Vize Projesi                         ║
# ║                                                                     ║
# ║  Kullanım: make <hedef>                                            ║
# ║    make install    → Bağımlılıkları kur                           ║
# ║    make test       → Test süitini çalıştır                        ║
# ║    make lint       → Kod kalitesi kontrolü                        ║
# ║    make security   → Güvenlik taraması                            ║
# ║    make docker     → Docker imajı oluştur                         ║
# ║    make run        → PoC scriptini çalıştır                      ║
# ║    make clean      → Geçici dosyaları temizle                     ║
# ╚══════════════════════════════════════════════════════════════════════╝

.PHONY: all install test lint security docker run clean help

# Değişkenler
PYTHON     := python3
PIP        := pip3
VENV       := .venv
POC_SCRIPT := poc/idor-demo.py
IMAGE_NAME := appwrite-security-analysis
IMAGE_TAG  := latest

# ANSI Renkleri
GREEN  := \033[0;32m
YELLOW := \033[1;33m
BLUE   := \033[0;34m
RED    := \033[0;31m
RESET  := \033[0m

## help: Kullanılabilir komutları listele (varsayılan)
help:
	@echo ""
	@echo "$(BLUE)╔══════════════════════════════════════════════════════════╗$(RESET)"
	@echo "$(BLUE)║  Appwrite Security Analysis — Makefile Komutları        ║$(RESET)"
	@echo "$(BLUE)╚══════════════════════════════════════════════════════════╝$(RESET)"
	@grep -E '^## ' Makefile | sed 's/## /  /'
	@echo ""

all: install lint test

## install: Python bağımlılıklarını sanal ortama kur
install:
	@echo "$(YELLOW)>>> Bağımlılıklar kuruluyor...$(RESET)"
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install --upgrade pip
	$(VENV)/bin/pip install -r poc/requirements.txt
	$(VENV)/bin/pip install flake8 bandit pip-audit pytest pytest-cov
	@echo "$(GREEN)>>> Kurulum tamamlandı.$(RESET)"

## test: Tüm unit testleri çalıştır
test:
	@echo "$(YELLOW)>>> Testler çalıştırılıyor...$(RESET)"
	$(PYTHON) -m pytest tests/ -v --tb=short \
		--cov=poc/utils \
		--cov-report=term-missing \
		--cov-report=html:htmlcov
	@echo "$(GREEN)>>> Testler tamamlandı.$(RESET)"

## test-quick: Hızlı test (coverage olmadan)
test-quick:
	@echo "$(YELLOW)>>> Hızlı testler çalıştırılıyor...$(RESET)"
	$(PYTHON) -m pytest tests/ -v --tb=short

## lint: flake8 ile kod kalitesi kontrolü
lint:
	@echo "$(YELLOW)>>> Lint kontrolü yapılıyor...$(RESET)"
	flake8 poc/ tests/ \
		--max-line-length=120 \
		--exclude=__pycache__,.venv \
		--statistics
	@echo "$(GREEN)>>> Lint tamamlandı.$(RESET)"

## security: Bandit + pip-audit güvenlik taraması
security:
	@echo "$(YELLOW)>>> Güvenlik taraması yapılıyor...$(RESET)"
	bandit -r poc/ -f screen --exit-zero
	@echo ""
	pip-audit || true
	@echo "$(GREEN)>>> Güvenlik taraması tamamlandı.$(RESET)"

## docker: Docker imajını oluştur
docker:
	@echo "$(YELLOW)>>> Docker imajı oluşturuluyor...$(RESET)"
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .
	@echo "$(GREEN)>>> Docker build tamamlandı: $(IMAGE_NAME):$(IMAGE_TAG)$(RESET)"

## docker-up: Docker Compose ile tam ortamı başlat (Appwrite + MariaDB + PoC)
docker-up:
	@echo "$(YELLOW)>>> Docker Compose başlatılıyor...$(RESET)"
	docker-compose up -d appwrite mariadb
	@echo "$(GREEN)>>> Servisler başlatıldı. http://localhost:8080$(RESET)"

## docker-down: Docker Compose ortamını durdur
docker-down:
	docker-compose down
	@echo "$(GREEN)>>> Servisler durduruldu.$(RESET)"

## run: PoC scriptini çalıştır (önce .env dosyası gerekli)
run:
	@echo "$(YELLOW)>>> PoC scripti çalıştırılıyor...$(RESET)"
	@if [ ! -f .env ]; then \
		echo "$(RED)HATA: .env dosyası bulunamadı! .env.example'dan kopyalayın.$(RESET)"; \
		echo "  cp .env.example .env"; \
		exit 1; \
	fi
	$(PYTHON) $(POC_SCRIPT)

## clean: Geçici dosyaları ve cache'i temizle
clean:
	@echo "$(YELLOW)>>> Temizleniyor...$(RESET)"
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	find . -name "*.pyo" -delete 2>/dev/null || true
	rm -rf htmlcov/ .coverage .pytest_cache/ bandit-report.json
	@echo "$(GREEN)>>> Temizlik tamamlandı.$(RESET)"

## cleanup-appwrite: Appwrite'ı sistemden tamamen kaldır
cleanup-appwrite:
	@echo "$(RED)>>> Appwrite kaldırılıyor...$(RESET)"
	bash Scripts/cleanup.sh
	bash Scripts/verify-cleanup.sh

## docs-check: Dokümantasyon bütünlük kontrolü
docs-check:
	@echo "$(YELLOW)>>> Dokümantasyon kontrolü...$(RESET)"
	@for f in README.md docs/threat-model.md docs/docker-security-audit.md docs/ci-cd-analysis.md docs/source-code-analysis.md SECURITY.md; do \
		if [ -f "$$f" ]; then echo "  $(GREEN)✓$(RESET) $$f"; \
		else echo "  $(RED)✗ EKSIK: $$f$(RESET)"; fi; \
	done
