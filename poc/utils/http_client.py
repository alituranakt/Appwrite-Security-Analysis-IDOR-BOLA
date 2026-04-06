"""
http_client.py — Appwrite API HTTP Yardımcı Fonksiyonları
Tersine Mühendislik Dersi — Vize Projesi

Bu modül, Appwrite REST API ile iletişim için
yeniden kullanılabilir yardımcı fonksiyonlar sağlar.
"""

from typing import Optional


def build_endpoint_url(base: str, *parts: str) -> str:
    """
    Appwrite REST API endpoint URL'si oluşturur.

    Args:
        base: Temel URL (ör. "http://localhost/v1")
        *parts: Yol parçaları (ör. "databases", "mydb", "collections")

    Returns:
        Tam URL string'i

    Örnek:
        build_endpoint_url("http://localhost/v1", "databases", "db1", "collections")
        → "http://localhost/v1/databases/db1/collections"
    """
    base = base.rstrip("/")
    path = "/".join(str(p).strip("/") for p in parts)
    return f"{base}/{path}"


def build_auth_headers(
    session_cookie: Optional[str] = None,
    api_key: Optional[str] = None,
    project_id: Optional[str] = None,
) -> dict:
    """
    Appwrite API isteği için kimlik doğrulama header'ları oluşturur.

    Appwrite üç farklı kimlik doğrulama yöntemi destekler:
      1. Session Cookie  → Web uygulamaları için (tarayıcı oturumu)
      2. API Key         → Sunucu taraflı erişim için
      3. JWT Token       → Kullanıcı adına sunucu erişimi için

    Args:
        session_cookie: Appwrite oturum token'ı
        api_key: Appwrite API anahtarı
        project_id: Appwrite proje ID'si

    Returns:
        HTTP header dict'i
    """
    headers = {
        "Content-Type": "application/json",
    }

    if project_id:
        headers["X-Appwrite-Project"] = project_id

    if session_cookie:
        headers["Cookie"] = f"a_session_={'*' * 8}{session_cookie}"

    if api_key:
        headers["X-Appwrite-Key"] = api_key

    return headers


def is_vulnerable_response(response) -> bool:
    """
    HTTP yanıtının IDOR/BOLA açığına işaret edip etmediğini kontrol eder.

    Savunmasız: 200 OK → Erişim OLMAMASI gerekirken gerçekleşti
    Güvenli:    401 Unauthorized / 403 Forbidden → Erişim reddedildi

    Args:
        response: requests.Response benzeri nesne (status_code attribute'u olmalı)

    Returns:
        True  → Savunmasız (yetkisiz erişim başarılı)
        False → Güvenli (erişim reddedildi)
    """
    return response.status_code == 200


def parse_document_id(response_json: dict) -> Optional[str]:
    """
    Appwrite API yanıtından belge ID'sini çıkarır.

    Args:
        response_json: Appwrite API JSON yanıtı

    Returns:
        Belge ID string'i veya None
    """
    return response_json.get("$id")


def parse_collection_document_ids(response_json: dict) -> list:
    """
    Appwrite koleksiyon listeleme yanıtından tüm belge ID'lerini çıkarır.
    BOLA saldırısında kullanılır: koleksiyon listelenerek tüm belgeler keşfedilir.

    Args:
        response_json: Appwrite /documents endpoint JSON yanıtı

    Returns:
        Belge ID listesi
    """
    documents = response_json.get("documents", [])
    return [doc.get("$id") for doc in documents if doc.get("$id")]
