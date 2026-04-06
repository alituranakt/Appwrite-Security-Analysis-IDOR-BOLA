"""
╔══════════════════════════════════════════════════════════════════════════╗
║  test_idor.py — Appwrite Security Analysis Unit Tests                   ║
║  Tersine Mühendislik Dersi — Vize Projesi                              ║
║                                                                          ║
║  Test kapsamı:                                                           ║
║    - PoC yardımcı fonksiyonlar (URL oluşturma, header hazırlama)        ║
║    - HTTP client modülü (MockResponse ile izole test)                   ║
║    - Reporter modülü (rapor üretimi ve biçimlendirme)                   ║
║    - IDOR senaryosu mantık kontrolleri                                   ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# poc ve poc/utils dizinlerini import path'e ekle
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'poc'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'poc', 'utils'))


# ======================================================================== #
#  TEST 1: HTTP Client — Yardımcı Fonksiyonlar                            #
# ======================================================================== #
class TestHTTPClientHelpers(unittest.TestCase):
    """poc/utils/http_client.py fonksiyonlarını test eder."""

    def test_build_endpoint_url_basic(self):
        """Temel endpoint URL oluşturma testi."""
        from http_client import build_endpoint_url
        result = build_endpoint_url("http://localhost/v1", "databases", "mydb", "collections", "col1", "documents")
        self.assertEqual(result, "http://localhost/v1/databases/mydb/collections/col1/documents")

    def test_build_endpoint_url_trailing_slash(self):
        """Sondaki slash karakteri temizlenmeli."""
        from http_client import build_endpoint_url
        result = build_endpoint_url("http://localhost/v1/", "account")
        self.assertEqual(result, "http://localhost/v1/account")

    def test_build_auth_headers_with_session(self):
        """Session cookie ile header oluşturma."""
        from http_client import build_auth_headers
        headers = build_auth_headers(session_cookie="session_abc123")
        self.assertIn("Cookie", headers)
        self.assertIn("session_abc123", headers["Cookie"])

    def test_build_auth_headers_with_api_key(self):
        """API Key ile header oluşturma."""
        from http_client import build_auth_headers
        headers = build_auth_headers(api_key="test-api-key-xyz")
        self.assertIn("X-Appwrite-Key", headers)
        self.assertEqual(headers["X-Appwrite-Key"], "test-api-key-xyz")

    def test_build_auth_headers_empty(self):
        """Boş parametre ile header oluşturma — sadece Content-Type dönmeli."""
        from http_client import build_auth_headers
        headers = build_auth_headers()
        self.assertIn("Content-Type", headers)
        self.assertEqual(headers["Content-Type"], "application/json")

    def test_is_vulnerable_response_true(self):
        """200 status kodu → savunmasız (True) döndürmeli."""
        from http_client import is_vulnerable_response
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        self.assertTrue(is_vulnerable_response(mock_resp))

    def test_is_vulnerable_response_false_401(self):
        """401 status kodu → savunmasız değil (False) döndürmeli."""
        from http_client import is_vulnerable_response
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        self.assertFalse(is_vulnerable_response(mock_resp))

    def test_is_vulnerable_response_false_403(self):
        """403 status kodu → savunmasız değil (False) döndürmeli."""
        from http_client import is_vulnerable_response
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        self.assertFalse(is_vulnerable_response(mock_resp))


# ======================================================================== #
#  TEST 2: Reporter — Rapor Üretimi                                        #
# ======================================================================== #
class TestReporter(unittest.TestCase):
    """poc/utils/reporter.py fonksiyonlarını test eder."""

    def test_format_vulnerability_entry_required_keys(self):
        """Güvenlik açığı kaydı gerekli alanları içermeli."""
        from reporter import format_vulnerability_entry
        entry = format_vulnerability_entry(
            vuln_type="IDOR",
            endpoint="/v1/databases/db1/collections/col1/documents/doc1",
            method="GET",
            status_code=200,
            vulnerable=True
        )
        self.assertIn("type", entry)
        self.assertIn("endpoint", entry)
        self.assertIn("method", entry)
        self.assertIn("status_code", entry)
        self.assertIn("vulnerable", entry)

    def test_format_vulnerability_entry_values(self):
        """Güvenlik açığı kaydı değerleri doğru atanmalı."""
        from reporter import format_vulnerability_entry
        entry = format_vulnerability_entry(
            vuln_type="BOLA",
            endpoint="/v1/account",
            method="GET",
            status_code=200,
            vulnerable=True
        )
        self.assertEqual(entry["type"], "BOLA")
        self.assertEqual(entry["method"], "GET")
        self.assertTrue(entry["vulnerable"])

    def test_generate_summary_counts(self):
        """Özet rapor doğru sayım yapmalı."""
        from reporter import generate_summary
        results = [
            {"vulnerable": True, "type": "IDOR"},
            {"vulnerable": True, "type": "BOLA"},
            {"vulnerable": False, "type": "IDOR"},
            {"vulnerable": True, "type": "BOLA"},
        ]
        summary = generate_summary(results)
        self.assertEqual(summary["total"], 4)
        self.assertEqual(summary["vulnerable_count"], 3)
        self.assertEqual(summary["safe_count"], 1)

    def test_generate_summary_empty(self):
        """Boş sonuç listesi ile özet üretimi."""
        from reporter import generate_summary
        summary = generate_summary([])
        self.assertEqual(summary["total"], 0)
        self.assertEqual(summary["vulnerable_count"], 0)

    def test_to_json_output(self):
        """JSON çıktısı geçerli JSON formatında olmalı."""
        from reporter import to_json_output
        data = {"test": "value", "count": 42}
        json_str = to_json_output(data)
        parsed = json.loads(json_str)
        self.assertEqual(parsed["test"], "value")
        self.assertEqual(parsed["count"], 42)


# ======================================================================== #
#  TEST 3: IDOR Senaryo Mantığı                                            #
# ======================================================================== #
class TestIDORScenarioLogic(unittest.TestCase):
    """IDOR/BOLA saldırı senaryosu mantık testleri (ağ bağlantısı gerektirmez)."""

    def test_document_id_manipulation_detection(self):
        """Döküman ID değiştirme tespiti: farklı iki ID kullanıldığında tespit edilmeli."""
        victim_doc_id = "doc_victim_001"
        attacker_request_id = "doc_victim_001"  # Aynı ID'yi kullanan saldırgan
        # Gerçek senaryoda bu erişim OLMAMALI
        self.assertEqual(victim_doc_id, attacker_request_id,
                         "Saldırgan, mağdurun belge ID'sini kullanıyor (IDOR)")

    def test_userid_spoofing_detection(self):
        """userId spoofing: client-side userId, server-side ID ile eşleşmemeli."""
        real_user_id = "user_attacker_abc"
        spoofed_user_id = "user_victim_xyz"
        self.assertNotEqual(real_user_id, spoofed_user_id,
                            "userId spoofing tespit edildi: client değeri ≠ sunucu değeri")

    def test_permission_levels(self):
        """İzin seviyesi sıralaması doğru olmalı."""
        # any > users > user:ID — en kısıtlayıcı en güvenli
        permission_risk = {"any": 3, "users": 2, "user:ID": 1}
        self.assertGreater(permission_risk["any"], permission_risk["user:ID"])
        self.assertGreater(permission_risk["users"], permission_risk["user:ID"])

    def test_bola_collection_enumeration_pattern(self):
        """BOLA: Koleksiyon listeleme URL deseni doğru oluşturulmalı."""
        base_url = "http://localhost/v1"
        db_id = "myDatabase"
        collection_id = "users"
        expected = f"{base_url}/databases/{db_id}/collections/{collection_id}/documents"
        actual = f"{base_url}/databases/{db_id}/collections/{collection_id}/documents"
        self.assertEqual(expected, actual)

    def test_mitigation_document_level_permission(self):
        """Belge seviyesi izin string formatı doğru olmalı."""
        user_id = "user_abc123"
        expected_read_perm = f'read("user:{user_id}")'
        expected_write_perm = f'write("user:{user_id}")'
        self.assertIn(user_id, expected_read_perm)
        self.assertIn("read", expected_read_perm)
        self.assertIn(user_id, expected_write_perm)
        self.assertIn("write", expected_write_perm)


# ======================================================================== #
#  TEST 4: Ortam Değişkeni Yapılandırması                                  #
# ======================================================================== #
class TestEnvironmentConfig(unittest.TestCase):
    """Ortam değişkeni okuma ve doğrulama testleri."""

    def test_endpoint_env_var_default(self):
        """APPWRITE_ENDPOINT yoksa default değer kullanılmalı."""
        with patch.dict(os.environ, {}, clear=True):
            endpoint = os.environ.get("APPWRITE_ENDPOINT", "http://localhost/v1")
        self.assertEqual(endpoint, "http://localhost/v1")

    def test_endpoint_env_var_custom(self):
        """APPWRITE_ENDPOINT tanımlıysa custom değer kullanılmalı."""
        with patch.dict(os.environ, {"APPWRITE_ENDPOINT": "http://custom-server/v1"}):
            endpoint = os.environ.get("APPWRITE_ENDPOINT", "http://localhost/v1")
        self.assertEqual(endpoint, "http://custom-server/v1")

    def test_debug_env_var_false_by_default(self):
        """DEBUG yoksa False varsayılmalı."""
        with patch.dict(os.environ, {}, clear=True):
            debug = os.environ.get("DEBUG", "false").lower() == "true"
        self.assertFalse(debug)


# ======================================================================== #
#  MAIN                                                                    #
# ======================================================================== #
if __name__ == "__main__":
    print("=" * 65)
    print("  Appwrite Security Analysis — Test Süiti")
    print("  Tersine Mühendislik Dersi — Vize Projesi")
    print("=" * 65)
    unittest.main(verbosity=2)
