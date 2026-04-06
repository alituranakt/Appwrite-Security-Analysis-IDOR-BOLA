# 02. Izolasyon ve Birakmadan Temizlik

## 2.1 Neden Izolasyon Gerekli?

Appwrite development compose'unda:

- Docker socket mount edilir.
- Birden fazla veritabani ve yardimci servis acilir.
- Kalici volume'ler olusur.
- Cok sayida port host'a acilir.

Bu nedenle ayni makinede "kur, incele, kaldir" yaklasimi ancak kontrollu bir ortamda guvenlidir. En dogru secim ayri bir VM veya tek amacli lab host'tur.

## 2.2 Sistemde Neler Kalabilir?

Eger kaldirma dogru yapilmazsa su artefaktlar sistemde kalabilir:

- Duran veya yetim container'lar
- Named volume'ler
- User-defined Docker network'leri
- Cekilmis image'lar
- Host tarafinda olusmus `appwrite/` calisma dizini
- Log ve test artefaktlari
- Exposed port kullanan servisler

## 2.3 Appwrite Ozelinde Beklenen Kalintilar

`docker-compose.yml` dosyasina gore temizlikte ozellikle sunlar kontrol edilmelidir:

- `appwrite`, `appwrite-console`, `appwrite-realtime`
- `appwrite-worker-*` servisleri
- `openruntimes-executor`
- `mariadb`, `mongodb`, `postgresql`, `redis`, `traefik`, `coredns`, `ollama`
- `appwrite-*` isimli volume'ler
- `appwrite`, `gateway`, `runtimes` network'leri

## 2.4 Guvenli Temizlik Akisi

Arastirma bittiginde temel temizlik akisi:

```powershell
docker compose down -v
docker volume ls --filter name=appwrite
docker network ls --filter name=appwrite
docker ps -a
docker image ls
```

Eger ortam tamamen disposable bir VM ise ve baska projeler etkilenmeyecekse daha agresif temizlik de uygulanabilir:

```powershell
docker system prune -a --volumes
```

Bu ikinci komut paylasimli makinede onerilmez.

## 2.5 Temizligin Dogrulanmasi

Temizlik sonrasinda dogrulama icin su sorular cevaplanmalidir:

1. `docker ps -a` cikisinda Appwrite ile iliskili container kaldi mi?
2. `docker volume ls --filter name=appwrite` cikisinda volume kaldi mi?
3. `docker network ls --filter name=appwrite` cikisinda network kaldi mi?
4. Host'taki calisma klasorunde gereksiz bind-mount dosyalari kaldi mi?
5. `80`, `443`, `3306`, `27017`, `5432`, `6379`, `11434`, `9500+` portlari bosaldi mi?

## 2.6 Resmi Dokumanlardan Cikan Yardimci Noktalar

Docker Docs'a gore:

- `docker network ls` ile user-defined network'ler listelenebilir ve filtrelenebilir.
- `docker volume ls` ile volume kalintilari izlenebilir.
- `docker compose` ailesi konteynerli uygulamanin yasam dongusunu merkezi yonetir.

Appwrite tarafinda da konfigurasyon degisikliklerinden sonra compose yeniden olusturmanin beklendigi dokumante edilmis durumda. Bu da sistemin yasam dongusunun compose merkezli oldugunu gosterir.

Kaynaklar:

- [Docker CLI reference: docker network ls](https://docs.docker.com/reference/cli/docker/network/ls/)
- [Docker CLI reference: docker compose](https://docs.docker.com/reference/cli/docker/compose/)
- [Appwrite self-hosting storage/config docs](https://appwrite.io/docs/advanced/self-hosting/configuration/storage)

## 2.7 Hocanin Kritik Sorusu Icin Net Cevap

Tam temizligin garantisi, "uygulama kapandi" demekle olmaz. Appwrite gibi cok servisli bir stack'te container, volume, network, image ve host dizini katmanlarinin hepsi kontrol edilmelidir. Bu yuzden islem disposable VM'de yapilirsa kanitlamak daha kolaydir; VM silindiginde kalinti riski pratikte kapanir.
