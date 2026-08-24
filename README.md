# MultiConverter Pro (Electron)

**MultiConverter Pro**, video/ses dönüştürme, resim işleme (filigran dahil) ve ofis belge (Word/Excel) formatlarını birbirine dönüştürmeye odaklanmış "hepsi bir arada" (all-in-one) bir masaüstü uygulamasıdır. İçerisinde modern bir medya oynatıcı ve özel tasarlanmış çerçevesiz (frameless) pencere barındırır. Temel amaç offline ortamda çalışması sağlanmaktadır.

## 🚀 Öne Çıkan Özellikler

- 🎬 **Video ve Ses Dönüştürme & Akıllı Kırpıcı:** `fluent-ffmpeg` entegrasyonu ile MP4, MKV, AVI, MP3 vb. formatları birbirine dönüştürme. Canlı video önizlemesi ile **Akıllı Kırpıcı (Smart Clipper)** üzerinden başlangıç/bitiş süresini tek tıkla seçme.
- 🖼️ **Gelişmiş Görüntü İşleme & Kırpma:** `sharp` ve `Cropper.js` entegrasyonu. Resimleri canlı önizleme üzerinde interaktif kırpma, format değiştirme, yeniden boyutlandırma, siyah-beyaz filtre ve **Dinamik Filigran** (istenen köşeye logo) ekleyebilme.
- 📄 **Kapsamlı PDF Araçları:** `pdf-lib` ve `pdf.js` ile PDF birleştirme (merge), belirli bir sayfadan PDF bölme (split), PDF önizleme ve PDF'leri Word'e dönüştürme (metin veya görsel olarak).
- 🌐 **Sosyal Medya İndirici:** `yt-dlp` entegrasyonu ile YouTube, Instagram, X vb. platformlardan 4K video, MP3 veya **sadece kapak fotoğrafı (thumbnail)** indirme.
- 📊 **Excel ve Word Araçları:** Excel (.xlsx) dosyalarını PDF olarak kaydetme ve Word (.docx) belgelerini uygulama içinde görüntüleyip basitçe düzenleme.
- 🎨 **Modern "Glassmorphism" Arayüz:** Native HTML5 sürükle-bırak (Drag & Drop) desteği, özel çerçevesiz (frameless) pencere, yumuşak geçişler ve karanlık tema (dark mode) odaklı şık tasarım.
- ▶️ **Entegre Medya Oynatıcı:** `plyr` kütüphanesi kullanılarak uygulama içerisinde gelişmiş medya oynatma.

## 🛠️ Kullanılan Teknolojiler 

- **Çekirdek:** Electron, Node.js, HTML/CSS/Vanilla JS
- **Medya İşleme:** `fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`, `sharp`, `plyr`
- **Belge Araçları:** `exceljs`, `jspdf`, `jspdf-autotable`, `mammoth`, `docx`
- **Paketleme:** `electron-builder`

## 📦 Kurulum ve Çalıştırma (Geliştirme Modu)

Projeyi bilgisayarınızda çalıştırmak için sisteminizde Node.js kurulu olmalıdır.

1. **Bağımlılıkları Yükleyin:**
   ```bash
   npm install
   ```

2. **Uygulamayı Başlatın:**
   ```bash
   npm start
   ```

## 🔨 Derleme ve Yayınlama (Build)

Uygulamayı bir `.exe` (ya da diğer sistemler için kurulum dosyası) haline getirmek için `electron-builder` kullanılır. Çıktılar `dist/` klasöründe oluşur.

- **Windows (.exe) için:**
  ```bash
  npm run build:win
  ```
- **macOS (.dmg) için:**
  ```bash
  npm run build:mac
  ```
- **Linux (.AppImage) için:**
  ```bash
  npm run build:linux
  ```

> Not: Windows ikonu `build/icon.ico` üzerinden okunur. İhtiyaç duyarsanız `npm run icons:win` komutu ile otomatik olarak çeşitli boyutlarda ico üretebilirsiniz.

## 🏗️ Proje Mimarisi

- `index.js` (Main Process): Pencere (BrowserWindow) oluşturulması, sistem diyaloğu (dosya seç/kaydet) yönetimi ve arka planda FFmpeg/Sharp gibi Node.js araçlarının çalıştırıldığı dosya.
- `Renderer.js` (Renderer Process): Kullanıcı arayüzü ile etkileşimi yöneten, IPC (Inter-Process Communication) ile Main Process'e istek yollayan, ve medya oynatıcıyı (`plyr`) çalıştıran önyüz (frontend) dosyası.
- `index.html`: Uygulamanın iskeleti, tasarım elementleri, "drop-zone" dosya bırakma alanları ve medya oynatıcı kodlarını içerir.
