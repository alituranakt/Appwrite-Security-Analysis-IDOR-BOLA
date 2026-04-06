# Rubric Eslestirme

## Adim 1: Kurulum ve install.sh Analizi

- Ana dokuman: [`../01-kurulum-ve-install-analizi.md`](../01-kurulum-ve-install-analizi.md)
- Karsilanan basliklar:
  - kurulum komutu
  - install entrypoint
  - olusan dizin/volume etkisi
  - gerekli yetkiler
  - supply-chain guveni

## Adim 2: Izolasyon ve Iz Birakmadan Temizlik

- Ana dokuman: [`../02-izolasyon-ve-temizlik.md`](../02-izolasyon-ve-temizlik.md)
- Karsilanan basliklar:
  - lab/VM onerisi
  - kalintilar
  - temizleme komutlari
  - temizlik dogrulama adimlari

## Adim 3: Is Akislari ve CI/CD Pipeline Analizi

- Ana dokuman: [`../03-is-akislari-ve-cicd-pipeline-analizi.md`](../03-is-akislari-ve-cicd-pipeline-analizi.md)
- Karsilanan basliklar:
  - secilen GitHub Actions workflow
  - step-by-step analiz
  - webhook kavrami
  - PR/CI etkisi

## Adim 4: Docker Mimarisi ve Konteyner Guvenligi

- Ana dokuman: [`../04-docker-mimarisi-ve-konteyner-guvenligi.md`](../04-docker-mimarisi-ve-konteyner-guvenligi.md)
- Karsilanan basliklar:
  - servis topolojisi
  - container yetki/risk noktasi
  - Docker, Kubernetes ve VM farki

## Adim 5: Kaynak Kod ve Akis Analizi

- Ana dokuman: [`../05-kaynak-kod-ve-akis-analizi.md`](../05-kaynak-kod-ve-akis-analizi.md)
- Ek vaka: [`../06-idor-bola-vaka-calismasi.md`](../06-idor-bola-vaka-calismasi.md)
- Canli lab kodu:
  - [`../../web/app.js`](../../web/app.js)
  - [`../../functions/insecure-invoice-proxy/src/main.js`](../../functions/insecure-invoice-proxy/src/main.js)
  - [`../../functions/secure-invoice-proxy/src/main.js`](../../functions/secure-invoice-proxy/src/main.js)
- Karsilanan basliklar:
  - entrypoint
  - authentication/session/JWT
  - object authorization mantigi
  - ownership kontrolu
  - IDOR/BOLA kapatma modeli
