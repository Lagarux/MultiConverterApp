# MultiConverter Pro (Electron)

**MultiConverter Pro**, video/ses dönüştürme, resim işleme (filigran dahil) ve ofis belge (Word/Excel) formatlarını birbirine dönüştürmeye odaklanmış "hepsi bir arada" (all-in-one) bir masaüstü uygulamasıdır. İçerisinde modern bir medya oynatıcı ve özel tasarlanmış çerçevesiz (frameless) pencere barındırır. Temel amaç offline ortamda çalışması sağlanmaktadır.

## 🚀 Öne Çıkan Özellikler

- 🎬 **Video ve Ses Dönüştürme:** `fluent-ffmpeg` entegrasyonu ile MP4, MKV, AVI, MP3 vb. formatları birbirine dönüştürme. Başlangıç/bitiş süresine göre video kırpma (trim) ve canlı ilerleme (progress) göstergesi.
- 🖼️ **Gelişmiş Görüntü İşleme:** `sharp` ile yüksek performanslı resim işleme. Format değiştirme (JPG, PNG, WEBP), yeniden boyutlandırma, siyah-beyaz (grayscale) filtresi ve resimlerin köşesine **Logo / Filigran** ekleyebilme.
- 📊 **Excel'den PDF'e Dönüşüm:** `exceljs` ve `jspdf-autotable` kullanılarak `.xlsx` verilerini tablo düzeninde, sayfa yapısı bozulmadan PDF olarak dışa aktarma.
- 📝 **Word (.docx) Görüntüleme ve Kaydetme:** `mammoth` ile .docx dosyalarını metin olarak önizleme ve `docx` kütüphanesi yardımıyla oluşturulan içerikleri yeniden Word dosyasına yazdırma.
- 🎨 **Özel Arayüz (Custom Titlebar):** Windows'un varsayılan başlık çubuğu yerine uygulama içine entegre edilmiş şık Kapat, Küçült ve Büyült (Minimize/Maximize/Restore) düğmeleri. Sürükle-bırak desteği.
- ▶️ **Entegre Medya Oynatıcı:** `plyr` kütüphanesi kullanılarak uygulama içerisinde gelişmiş medya oynatma (hız, kalite ve altyazı desteği).
- 📌 **Windows Görev Çubuğu:** Uygulama ikonuna sağ tıklandığında "Yeni Dönüştürücü Aç" özelliği (jumplist).

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
