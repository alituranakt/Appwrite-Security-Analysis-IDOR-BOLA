#!/usr/bin/env bash
# ╔═══════════════════════════════════════════════════════════════════════╗
# ║  Appwrite Security Analysis - Kurulum & Analiz Ortamı Scripti        ║
# ║                                                                       ║
# ║  Adım 1: install.sh Analizi (Reverse Engineering)                   ║
# ║  Tersine Mühendislik Dersi - Vize Projesi                           ║
# ╚═══════════════════════════════════════════════════════════════════════╝
#
# === APPWRITE INSTALL.SH ANALİZİ ===
#
# Appwrite'ın resmi kurulum scripti (https://appwrite.io/install/sh):
#   1. Docker ve Docker Compose varlığını kontrol eder
#   2. Kullanıcıdan konfigürasyon bilgilerini alır (port, domain, secret)
#   3. docker-compose.yml dosyasını GitHub'dan indirir
#   4. .env dosyasını oluşturur
#   5. docker compose up -d ile 40+ konteyneri başlatır
#
# GÜVENLİK ANALİZİ:
#   ⚠️  Resmi Appwrite installer'ı "curl | bash" kalıbı kullanır:
#       curl -sL https://appwrite.io/install/sh | bash
#       Bu, indirilen script'in doğrulanmadan çalıştırılması demektir!
#
#   ⚠️  Hash (SHA256/GPG) doğrulaması YAPILMIYOR
#       İndirilen docker-compose.yml dosyasının bütünlüğü kontrol edilmez
#
#   ✅ Tüm iletişim HTTPS üzerinden yapılır
#   ✅ Resmi Docker Hub imajları kullanılır
#
# Bu script, analiz ortamını güvenli şekilde kurar:
#   1. Gerekli araçları kontrol eder (Docker, Python, pip)
#   2. Python bağımlılıklarını kurar (PoC scripti için)
#   3. Appwrite'ı Docker ile kurar (opsiyonel)
#   4. Analiz dizin yapısını oluşturur

set -euo pipefail

# ====================================================================== #
#  RENK TANIMLARI
# ====================================================================== #
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${PROJECT_DIR}/logs/install.log"

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[⚠]${NC} $1"; }
error(){ echo -e "${RED}[✗]${NC} $1" >&2; }
header() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# ====================================================================== #
#  ADIM 1: SİSTEM GEREKSİNİMLERİ KONTROLÜ
# ====================================================================== #
check_requirements() {
    header "Adim 1: Sistem Gereksinimleri Kontrolu"

    # Docker
    if command -v docker &> /dev/null; then
        local docker_ver
        docker_ver=$(docker --version | awk '{print $3}' | tr -d ',')
        log "Docker bulundu: ${docker_ver}"
    else
        warn "Docker bulunamadi. Appwrite kurulumu icin Docker gereklidir."
        warn "Kurulum: https://docs.docker.com/get-docker/"
    fi

    # Docker Compose
    if docker compose version &> /dev/null 2>&1; then
        local compose_ver
        compose_ver=$(docker compose version --short 2>/dev/null || echo "N/A")
        log "Docker Compose bulundu: ${compose_ver}"
    elif command -v docker-compose &> /dev/null; then
        log "Docker Compose (v1) bulundu: $(docker-compose --version | awk '{print $3}')"
        warn "Docker Compose v2 onerilir."
    else
        warn "Docker Compose bulunamadi."
    fi

    # Python
    local python_cmd=""
    for cmd in python3 python; do
        if command -v "${cmd}" &> /dev/null; then
            python_cmd="${cmd}"
            break
        fi
    done

    if [ -n "${python_cmd}" ]; then
        local py_ver
        py_ver=$("${python_cmd}" --version 2>&1)
        log "Python bulundu: ${py_ver}"
    else
        error "Python bulunamadi! PoC scripti icin Python 3.8+ gerekli."
        exit 1
    fi

    # pip
    if "${python_cmd}" -m pip --version &> /dev/null; then
        log "pip bulundu: $("${python_cmd}" -m pip --version | awk '{print $2}')"
    else
        error "pip bulunamadi!"
        exit 1
    fi

    PYTHON_CMD="${python_cmd}"
}

# ====================================================================== #
#  ADIM 2: DIZIN YAPISI OLUSTURMA
# ====================================================================== #
create_directories() {
    header "Adim 2: Dizin Yapisi Olusturma"

    local dirs=("logs" "results" "screenshots")
    for d in "${dirs[@]}"; do
        mkdir -p "${PROJECT_DIR}/${d}"
        log "Dizin: ${d}/"
    done

    mkdir -p "${PROJECT_DIR}/logs"
    echo "=== Appwrite Security Analysis - Kurulum Logu ===" > "${LOG_FILE}"
    echo "Tarih: $(date)" >> "${LOG_FILE}"
    log "Log dosyasi baslatildi: ${LOG_FILE}"
}

# ====================================================================== #
#  ADIM 3: PYTHON BAGIMLILIKLARI
# ====================================================================== #
install_python_deps() {
    header "Adim 3: Python Bagimliliklari (PoC icin)"

    local req_file="${PROJECT_DIR}/poc/requirements.txt"
    if [ -f "${req_file}" ]; then
        log "Bagimliliklar kuruluyor: ${req_file}"
        "${PYTHON_CMD}" -m pip install -r "${req_file}" --quiet 2>> "${LOG_FILE}"
        log "Python bagimliliklari kuruldu."
    else
        warn "poc/requirements.txt bulunamadi, atlaniyor."
    fi
}

# ====================================================================== #
#  ADIM 4: APPWRITE KURULUMU (OPSIYONEL)
# ====================================================================== #
install_appwrite() {
    header "Adim 4: Appwrite Kurulumu (Opsiyonel)"

    echo "  Appwrite kurulumu Docker gerektirir ve 40+ konteyner olusturur."
    echo ""
    read -rp "  Appwrite'i kurmak istiyor musunuz? (evet/hayir): " answer

    case "${answer}" in
        [eE]vet|[yY]es|[yY])
            log "Appwrite kuruluyor..."

            # === GUVENLIK NOTU ===
            # Resmi yontem: curl -sL https://appwrite.io/install/sh | bash
            # Bu "curl | bash" kalıbı GUVENLI DEGILDIR cunku:
            #   - Indirilen script dogrulanmadan calistirilir
            #   - MITM saldirisiyla degistirilmis script calisabilir
            #   - Hash/GPG dogrulamasi YOKTUR
            #
            # Daha guvenli alternatif: Scripti once indir, incele, sonra calistir
            warn "Resmi Appwrite installer 'curl | bash' kalibi kullanir."
            warn "Guvenlik icin scripti once indirip inceliyoruz..."

            # Guvenli yontem: Once indir, sonra calistir
            local install_script="${PROJECT_DIR}/logs/appwrite-install.sh"
            curl -sL https://appwrite.io/install/sh -o "${install_script}" 2>> "${LOG_FILE}"

            if [ -f "${install_script}" ]; then
                # SHA256 hash'ini logla (sonradan dogrulama icin)
                local hash
                hash=$(sha256sum "${install_script}" | awk '{print $1}')
                log "Installer indirildi. SHA256: ${hash}"
                echo "Installer SHA256: ${hash}" >> "${LOG_FILE}"

                log "Installer icerigi incelenmek uzere kaydedildi: ${install_script}"
                echo ""
                read -rp "  Scripti calistirmak istiyor musunuz? (evet/hayir): " run_answer
                case "${run_answer}" in
                    [eE]vet|[yY]es|[yY])
                        bash "${install_script}"
                        ;;
                    *)
                        log "Installer calistirilmadi. Manuel inceleme icin: ${install_script}"
                        ;;
                esac
            else
                error "Installer indirilemedi!"
            fi
            ;;
        *)
            log "Appwrite kurulumu atlandi."
            log "Manuel kurulum: docker run -it --rm appwrite/appwrite init"
            ;;
    esac
}

# ====================================================================== #
#  ADIM 5: DOGRULAMA
# ====================================================================== #
verify() {
    header "Adim 5: Kurulum Dogrulama"

    # Python modulleri
    if "${PYTHON_CMD}" -c "import requests" 2>/dev/null; then
        log "requests modulu: OK"
    else
        error "requests modulu bulunamadi!"
    fi

    # PoC scripti
    if [ -f "${PROJECT_DIR}/poc/idor-demo.py" ]; then
        log "PoC scripti mevcut: poc/idor-demo.py"
    else
        error "PoC scripti eksik!"
    fi

    # Dokumanlar
    local docs=("docs/threat-model.md" "docs/docker-security-audit.md")
    for doc in "${docs[@]}"; do
        if [ -f "${PROJECT_DIR}/${doc}" ]; then
            log "Dokuman mevcut: ${doc}"
        else
            warn "Dokuman eksik: ${doc}"
        fi
    done

    log "Kurulum tamamlandi!"
}

# ====================================================================== #
#  OZET
# ====================================================================== #
print_summary() {
    header "Kurulum Tamamlandi!"

    echo -e "  ${BLUE}Kullanim:${NC}"
    echo "  ─────────────────────────────────────────────────"
    echo "  # PoC scriptini calistir (Appwrite calisirken):"
    echo "  cd poc && python idor-demo.py"
    echo ""
    echo "  # Temizlik scripti:"
    echo "  bash Scripts/cleanup.sh"
    echo ""
    echo "  # Temizlik dogrulama:"
    echo "  bash Scripts/verify-cleanup.sh"
    echo "  ─────────────────────────────────────────────────"
}

# ====================================================================== #
#  ANA AKIS
# ====================================================================== #
main() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  Appwrite Security Analysis - Kurulum Basliyor...       ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    check_requirements
    create_directories
    install_python_deps
    install_appwrite
    verify
    print_summary
}

main "$@"
