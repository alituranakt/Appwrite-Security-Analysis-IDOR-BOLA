"""
reporter.py — Güvenlik Analizi Rapor Üretici
Tersine Mühendislik Dersi — Vize Projesi

Bu modül, IDOR/BOLA analiz sonuçlarını yapılandırılmış formatlarda
(JSON, terminal çıktısı) raporlamak için fonksiyonlar sağlar.
"""

import json
from datetime import datetime
from typing import List, Optional


def format_vulnerability_entry(
    vuln_type: str,
    endpoint: str,
    method: str,
    status_code: int,
    vulnerable: bool,
    details: Optional[str] = None,
) -> dict:
    """
    Tek bir güvenlik açığı kaydı oluşturur.

    Args:
        vuln_type: Açık türü ("IDOR", "BOLA", "userId_Spoofing" vb.)
        endpoint: Test edilen API endpoint'i
        method: HTTP metodu ("GET", "POST", "DELETE" vb.)
        status_code: Alınan HTTP yanıt kodu
        vulnerable: True → Savunmasız, False → Güvenli
        details: Opsiyonel açıklama metni

    Returns:
        Yapılandırılmış güvenlik açığı kaydı dict'i
    """
    return {
        "type": vuln_type,
        "endpoint": endpoint,
        "method": method,
        "status_code": status_code,
        "vulnerable": vulnerable,
        "risk": _calculate_risk(vuln_type, vulnerable),
        "details": details or "",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


def _calculate_risk(vuln_type: str, vulnerable: bool) -> str:
    """İç fonksiyon: Güvenlik açığı türüne göre risk seviyesini belirler."""
    if not vulnerable:
        return "NONE"
    risk_map = {
        "IDOR": "HIGH",
        "BOLA": "HIGH",
        "userId_Spoofing": "CRITICAL",
        "Enumeration": "MEDIUM",
        "Information_Disclosure": "MEDIUM",
    }
    return risk_map.get(vuln_type, "HIGH")


def generate_summary(results: List[dict]) -> dict:
    """
    Tüm test sonuçlarından özet istatistik üretir.

    Args:
        results: format_vulnerability_entry() ile oluşturulmuş kayıt listesi

    Returns:
        Özet istatistik dict'i
    """
    total = len(results)
    vulnerable_count = sum(1 for r in results if r.get("vulnerable"))
    safe_count = total - vulnerable_count

    risk_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "NONE": 0}
    for r in results:
        risk = r.get("risk", "NONE")
        if risk in risk_counts:
            risk_counts[risk] += 1

    return {
        "total": total,
        "vulnerable_count": vulnerable_count,
        "safe_count": safe_count,
        "risk_breakdown": risk_counts,
        "vulnerability_rate": f"{(vulnerable_count / total * 100):.1f}%" if total > 0 else "0%",
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


def to_json_output(data: dict, indent: int = 2) -> str:
    """
    Dict verisini formatlı JSON string'ine dönüştürür.

    Args:
        data: Serialize edilecek dict
        indent: JSON girinti miktarı (varsayılan: 2)

    Returns:
        Formatlı JSON string
    """
    return json.dumps(data, ensure_ascii=False, indent=indent)


def print_terminal_report(results: List[dict], summary: dict) -> None:
    """
    Analiz sonuçlarını renkli terminal çıktısı olarak yazdırır.

    Renk kodları (ANSI):
        KIRMIZI  → Savunmasız (açık bulundu)
        YEŞİL    → Güvenli (erişim reddedildi)
        SARI     → Uyarı
        MAVİ     → Bilgi
    """
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"

    print(f"\n{BOLD}{'=' * 65}{RESET}")
    print(f"{BOLD}  Appwrite IDOR/BOLA Analiz Raporu{RESET}")
    print(f"{'=' * 65}")

    for i, r in enumerate(results, 1):
        status = f"{RED}[SAVUNMASIZ]{RESET}" if r["vulnerable"] else f"{GREEN}[GÜVENLİ]{RESET}"
        print(f"\n  {BOLD}Test #{i}: {r['type']}{RESET}")
        print(f"    Endpoint   : {BLUE}{r['endpoint']}{RESET}")
        print(f"    Method     : {r['method']}")
        print(f"    Status     : {r['status_code']}")
        print(f"    Sonuç      : {status}")
        print(f"    Risk       : {YELLOW}{r['risk']}{RESET}")
        if r["details"]:
            print(f"    Detay      : {r['details']}")

    print(f"\n{BOLD}{'=' * 65}{RESET}")
    print(f"{BOLD}  ÖZET{RESET}")
    print(f"{'=' * 65}")
    print(f"  Toplam test     : {summary['total']}")
    vuln_color = RED if summary['vulnerable_count'] > 0 else GREEN
    print(f"  Savunmasız      : {vuln_color}{summary['vulnerable_count']}{RESET}")
    print(f"  Güvenli         : {GREEN}{summary['safe_count']}{RESET}")
    print(f"  Açık oranı      : {summary['vulnerability_rate']}")
    print(f"{'=' * 65}\n")
