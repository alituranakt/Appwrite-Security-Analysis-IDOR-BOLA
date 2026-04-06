# 01. Kurulum ve Install Analizi

## 1.1 Repo Profili

Appwrite ana reposu `appwrite/appwrite` acik kaynak ve genel erisimli bir proje. GitHub sonucuna gore `2025-12-23` tarihli son kararli surumu `1.8.1`; yaklasik `120` release, `365` contributor ve `55K+` yildiz olceginde olgun bir repo. Lisans `BSD-3-Clause` olarak yayinlaniyor. Bu veriler repo profesyonelligi ve bakim olgunlugu acisindan olumlu sinyaller uretir.

Kaynaklar:

- [GitHub repo](https://github.com/appwrite/appwrite)
- [SECURITY.md](https://github.com/appwrite/appwrite/blob/1.9.x/SECURITY.md)

## 1.2 Kurulum Giris Noktasi

Appwrite README dosyasi self-hosting icin Docker tabanli tek komutlu bir kurulum onermektedir. PowerShell ornegi `appwrite/appwrite:1.9.0` imajini calistirip container icinde `install` entrypoint'ini tetikler. Kaynak kodda `bin/install` script'i yalnizca su isi yapar:

```sh
exec php /usr/src/code/app/cli.php install "$@"
```

Bu tasarimdan cikan sonuc:

- Kurulum, bagimsiz bir bash script degil; PHP tabanli CLI gorevine delege edilir.
- Installer mantigi container icinde calisir.
- Host'ta Appwrite klasoru ve sonrasinda compose tabanli kurulum artefaktlari olusur.

Ilgili dosyalar:

- [README.md](https://github.com/appwrite/appwrite/blob/1.9.x/README.md)
- [bin/install](https://github.com/appwrite/appwrite/blob/1.9.x/bin/install)
- [app/cli.php](https://github.com/appwrite/appwrite/blob/1.9.x/app/cli.php)

## 1.3 Installer Ne Yapiyor?

Kurulum akisi pratikte su sekilde ilerler:

1. Docker, `appwrite/appwrite` image'ini registry'den ceker.
2. Host'taki calisma klasoru container'a mount edilir.
3. Docker socket container'a mount edilir.
4. `install` gorevi calisir ve host tarafinda Appwrite compose calisma alani olusturur.
5. Sonraki yasam dongusu `docker compose` ile yonetilir.

Burada kritik guven siniri `docker.sock` mount'udur. Bu mount, container icindeki surecin host Docker daemon'u uzerinde kontrol sahibi olmasi anlamina gelir. Guvenlik perspektifinden bu, "neredeyse host-ust seviye yetki" olarak degerlendirilmelidir.

## 1.4 Dockerfile ve Compose'tan Gozlenen Dosya/Dizin Etkileri

`Dockerfile` ve `docker-compose.yml` birlikte incelendiginde Appwrite'in su kalici alanlari kullandigi gorulur:

- `appwrite-uploads`
- `appwrite-imports`
- `appwrite-cache`
- `appwrite-config`
- `appwrite-certificates`
- `appwrite-functions`
- `appwrite-sites`
- `appwrite-builds`
- `appwrite-mariadb`
- `appwrite-mongodb`
- `appwrite-postgresql`
- `appwrite-redis`
- `appwrite-models`

Ayrica development compose dosyasi kaynak kod klasorlerini bind mount ile container icine alir:

- `./app`
- `./src`
- `./docs`
- `./public`
- `./tests`
- `./dev`

Sonuc olarak kurulum sadece "bir container calisti" seviyesinde degildir; veri, fonksiyon, build ve sertifika katmanlarinda kalici artefaktlar birakir.

Kaynaklar:

- [docker-compose.yml](https://github.com/appwrite/appwrite/blob/1.9.x/docker-compose.yml)
- [Dockerfile](https://github.com/appwrite/appwrite/blob/1.9.x/Dockerfile)
- [.env](https://github.com/appwrite/appwrite/blob/1.9.x/.env)

## 1.5 Yetki ve Port Analizi

Development compose dosyasinda asagidaki dikkat cekici noktalar vardir:

- `traefik`, `appwrite`, `openruntimes-executor` gibi servislerde Docker socket mount kullanilir.
- `80`, `443`, `9500`, `3306`, `27017`, `5432`, `6379`, `11434` gibi portlar expose edilir.
- Compose dosyasinin en basinda bu dosyanin production icin uygun olmadigi acikca belirtilir.

Bu nedenle bu kurulum:

- Arastirma ve laboratuvar icin uygundur.
- Uretim ortamina dogrudan kopyalanmamali.
- Tek makine veya paylasimli workstation uzerinde dikkatsiz calistirilirsa saldiri yuzeyini ciddi bicimde buyutebilir.

## 1.6 Supply-Chain ve Guven Problemi

Hocanin kritik sorusu olan "indirdigi kaynaklara ne kadar guvenebiliriz?" icin kisa cevap: kismi guven var, fakat tam dogrulama yok.

Olumlu yonler:

- Repo olgun ve aktif bakimli.
- `composer.lock` kullaniliyor; bu, PHP bagimlilik surumlerini sabitler.
- CI tarafinda `composer audit`, OSV scanner ve Trivy image/fs taramalari var.
- Release ve security policy mevcut.

Zayif yonler:

- Kurulum komutu image'i tag ile cagiriyor; digest pinning yok.
- Compose'taki image'lar da cogu yerde digest yerine tag ile sabitlenmis.
- README kurulum akisi imza veya hash dogrulamasi gostermiyor.
- Docker Hub ve dis image registry'lerine guven zinciri soz konusu.

Guvenlik notu:

Tag pinning, rastgele "latest" kullanmaktan iyidir; ama digest pinning kadar guclu degildir.

## 1.7 Bu Adim Icin Sonuc

Appwrite kurulumu kullanisli ama yuksek yetkili bir self-host akisi sunuyor. Analiz ortaminda kontrollu bir VM veya disposable host tercih edilmeli. Arastirma acisindan bu iyi bir secimdir; cunku kurulumun kendisi bile container guveni, supply-chain ve host yetki sinirlari acisindan ciddi ders materyali saglar.
