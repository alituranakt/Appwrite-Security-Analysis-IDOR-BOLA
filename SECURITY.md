# Güvenlik Politikası / Security Policy

## Bu Proje Hakkında

Bu depo, **eğitim amaçlı** bir tersine mühendislik analizidir. Appwrite açık kaynak projesindeki IDOR/BOLA güvenlik açıklarını incelemek ve belgelemek amacıyla oluşturulmuştur.

> **Uyarı:** Bu repodaki PoC scriptleri yalnızca kendi kurduğunuz ve sahibi olduğunuz Appwrite ortamlarında çalıştırılmalıdır. Üçüncü taraf sistemlere karşı kullanımı yasa dışıdır.

## Desteklenen Sürümler / Supported Versions

| Analiz Edilen Sürüm | Durum          |
|---------------------|----------------|
| Appwrite 1.5.x      | ✅ Analiz edildi |
| Appwrite 1.4.x      | ✅ Analiz edildi |
| Appwrite < 1.4      | ❌ Kapsam dışı  |

## Güvenlik Açığı Bildirimi / Reporting a Vulnerability

Bu analizde hata, yanlışlık veya eksik bulduysanız aşağıdaki yollarla bildirebilirsiniz:

1. **GitHub Issues** — Depo issue tracker'ını kullanın
2. **GitHub Security Advisories** — "Security" sekmesinden gizli bildirim yapın

Bildirilen sorunlara **7 iş günü** içinde yanıt verilmeye çalışılacaktır.

## Etik Kullanım / Ethical Use

Bu projedeki tüm PoC scriptleri:

- Yalnızca lokal veya izinli test ortamlarında çalıştırılmalıdır
- Appwrite geliştiricileri ile paylaşılmış ve [public issue tracker](https://github.com/appwrite/appwrite/issues)'da raporlanmıştır
- OWASP etik test kılavuzlarına uygun olarak hazırlanmıştır

## Sorumlu Açıklama / Responsible Disclosure

Bu analizde tespit edilen güvenlik açıkları:
- Önce Appwrite güvenlik ekibine bildirilmiştir
- Gerekli düzeltme süreleri beklendikten sonra yayımlanmıştır
- [CVE-2023-27159](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2023-27159) ve [CVE-2021-23682](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2021-23682) referansları dahil edilmiştir

## Sorumluluk Reddi / Disclaimer

Bu proje bir **akademik çalışmadır**. Buradaki bilgilerin kötüye kullanımından doğabilecek yasal sorumluluk kullanıcıya aittir. Yazar, bu bilgilerin kötüye kullanımından sorumlu tutulamaz.
