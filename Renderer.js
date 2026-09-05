let mainPlayer = null;

// Yükleme Ekranını (Splash Screen) Kapatma Mantığı
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('loader-wrapper');
        if(loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }
    }, 1500); 

    // Plyr initialization
    try {
        if (typeof Plyr !== 'undefined') {
            mainPlayer = new Plyr('#player', {
                settings: ['captions', 'quality', 'speed', 'loop'],
                speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
                controls: [
                    'play-large', 'play', 'progress', 'current-time', 'mute',
                    'volume', 'captions', 'settings', 'pip', 'fullscreen'
                ]
            });
            console.log("Plyr gelişmiş ayarlarla başlatıldı.");
        }
    } catch (e) {
        console.error("Plyr başlatma hatası:", e);
    }
});

// Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else icon = 'ℹ️';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    // Fade out after 4 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

let selectedVideoPath = null;
let selectedImagePath = null;

const setupFilePicker = (id, callback, filters) => {
    const zone = document.getElementById(id);

    zone.onclick = async () => {
        const path = await window.electronAPI.openFileDialog(filters);
        if (path) callback(path);
    };

    zone.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover'); return false; };
    zone.ondragleave = (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('dragover'); return false; };
    zone.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            callback(e.dataTransfer.files[0].path);
        }
    };
};

// Global drag and drop engellemesi (Electron'un dosyayı açmasını engellemek için)
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

setupFilePicker('drop-zone', async (path) => {
    selectedVideoPath = path;
    const baseName = path.split(/[\\/]/).pop();
    document.getElementById('video-status').innerText = "Seçildi: " + baseName;
    
    // Video kırpıcı önizleme (Her formatı desteklemek için hazırlanıyor)
    const clipperPreview = document.getElementById('video-clipper-preview');
    const clipperVideo = document.getElementById('clipper-video');
    clipperPreview.style.display = 'block';
    clipperVideo.src = `file://${path}`; // Yerel web formatları için anında yükle
    
    // Desteklenmeyen veya dönüşüm gerektiren formatlar (AVI, TS, WMV, FLV, MKV vb.) için optimize önizleme
    try {
        const res = await window.electronAPI.preparePlayableMedia(path);
        if (res && res.success && res.url) {
            clipperVideo.src = res.url;
        }
    } catch(e) {
        console.warn("Kırpıcı önizleme hazırlama:", e);
    }
}, [
    { name: 'Tüm Medya Dosyaları', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ts', '3gp', 'ogv', 'm4v', 'mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'ac3'] },
    { name: 'Video Dosyaları', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ts', '3gp', 'ogv', 'm4v'] },
    { name: 'Ses Dosyaları', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'ac3'] }
]);

document.getElementById('set-start-btn').onclick = () => {
    const video = document.getElementById('clipper-video');
    document.getElementById('start-time').value = video.currentTime.toFixed(2);
};

document.getElementById('set-end-btn').onclick = () => {
    const video = document.getElementById('clipper-video');
    document.getElementById('end-time').value = video.currentTime.toFixed(2);
};

setupFilePicker('image-drop-zone', (path) => {
    selectedImagePath = path;
    document.getElementById('preview-img').src = `file://${path}`;
    document.getElementById('image-preview').style.display = 'block';
}, [{ name: 'Resimler', extensions: ['jpg', 'png', 'webp'] }]);

document.getElementById('convert-btn').onclick = () => {
    if(!selectedVideoPath) {
        showToast("Lütfen bir dosya seçin", "error");
        return;
    }
    const mediaBox = document.getElementById('media-progress-box');
    const mediaBar = document.getElementById('media-progress-bar');
    const mediaStage = document.getElementById('media-progress-stage');
    const mediaPercent = document.getElementById('media-progress-percent');
    const mediaTime = document.getElementById('media-progress-time');
    const mediaFps = document.getElementById('media-progress-fps');
    const mediaSize = document.getElementById('media-progress-size');

    if (mediaBox) {
        mediaBox.style.display = 'block';
        mediaBar.style.width = '0%';
        mediaBar.classList.add('indeterminate');
        mediaStage.innerText = "🎬 İşlem başlatılıyor, dosya hazırlanıyor...";
        mediaPercent.innerText = "%0";
        mediaTime.innerText = "⏱️ Süre: 00:00:00";
        mediaFps.innerText = "⚡ Hız: Başlatılıyor...";
        mediaSize.innerText = "📦 Boyut: --";
    }

    const clipperVideo = document.getElementById('clipper-video');
    const totalDuration = (clipperVideo && Number.isFinite(clipperVideo.duration) && clipperVideo.duration > 0)
        ? clipperVideo.duration
        : null;

    window.electronAPI.convertMedia({
        filePath: selectedVideoPath,
        outputFormat: document.getElementById('format-select').value,
        startTime: parseFloat(document.getElementById('start-time').value) || 0,
        endTime: parseFloat(document.getElementById('end-time').value) || null,
        totalDuration: totalDuration
    });
};

let selectedLogoPath = null;
let cropper = null;

document.getElementById('crop-start-btn').onclick = () => {
    if(!selectedImagePath) {
        showToast("Lütfen önce bir resim seçin!", "error");
        return;
    }
    const imageElement = document.getElementById('preview-img');
    if (cropper) cropper.destroy();
    cropper = new Cropper(imageElement, {
        viewMode: 2,
        autoCropArea: 1,
    });
    showToast("Kırpma aracı aktif. Resim üzerinde alanı seçin.", "info");
};

const watermarkCheckbox = document.getElementById('watermark-checkbox');
const selectLogoBtn = document.getElementById('select-logo-btn');
const watermarkPositionSelect = document.getElementById('watermark-position');
watermarkCheckbox.onchange = () => {
    selectLogoBtn.style.display = watermarkCheckbox.checked ? 'inline-block' : 'none';
    watermarkPositionSelect.style.display = watermarkCheckbox.checked ? 'inline-block' : 'none';
};

selectLogoBtn.onclick = async () => {
    const path = await window.electronAPI.openFileDialog([{name: 'Logo Dosyası', extensions: ['png']}]);
    if(path) {
        selectedLogoPath = path;
        document.getElementById('logo-path-text').innerText = path.split(/[\\/]/).pop();
    }
};

document.getElementById('process-image-btn').onclick = async () => {
    if(!selectedImagePath) {
        showToast("Lütfen önce bir resim seçin!", "error");
        return;
    }
    const format = document.getElementById('image-format-select').value;
    const targetPath = await window.electronAPI.saveFileDialog(format);
    
    if (targetPath) {
        const cropData = cropper ? cropper.getData(true) : null;
        
        const result = await window.electronAPI.processImageSharp({
            filePath: selectedImagePath,
            targetPath: targetPath, 
            options: {
                format: format,
                width: document.getElementById('image-width').value,
                height: document.getElementById('image-height').value,
                grayscale: document.getElementById('grayscale-checkbox').checked,
                watermark: watermarkCheckbox.checked ? selectedLogoPath : null,
                watermarkPosition: watermarkPositionSelect.value,
                crop: cropData
            }
        });
        
        if(result.success) {
            showToast("Resim başarıyla kaydedildi: " + result.path, "success");
        } else {
            showToast("Hata: " + result.error, "error");
        }
    }
};

// Medya Oynatıcı: Herhangi bir formatı (MP4, MKV, AVI, MOV, WMV, FLV, TS, 3GP, Sesler vb.) anında oynatır
async function playMediaFile(filePath) {
    if (!filePath) return;
    const fileNameEl = document.getElementById('current-file-name');
    const baseName = filePath.split(/[\\/]/).pop();
    if (fileNameEl) fileNameEl.innerText = `⏳ Yükleniyor: ${baseName}...`;
    
    showToast(`Medya oynatıcıya hazırlanıyor: ${baseName}`, "info");

    try {
        const res = await window.electronAPI.preparePlayableMedia(filePath);
        if (res && res.success && res.url) {
            const playerEl = document.getElementById('player');
            if (mainPlayer) {
                mainPlayer.source = {
                    type: 'video',
                    title: baseName,
                    sources: [
                        {
                            src: res.url,
                            type: 'video/mp4'
                        }
                    ]
                };
                setTimeout(() => {
                    try { mainPlayer.play(); } catch(e) {}
                }, 200);
            } else if (playerEl) {
                playerEl.src = res.url;
                playerEl.play().catch(() => {});
            }
            
            const badge = res.isNative ? '⚡ Doğrudan Oynatılıyor' : '🚀 Optimize Edildi (Hızlı Oynatma)';
            if (fileNameEl) fileNameEl.innerText = `${baseName} [${badge}]`;
            showToast(`${baseName} oynatılıyor!`, "success");
        } else {
            showToast(`Medya hazırlama hatası: ${res ? res.error : 'Bilinmeyen hata'}`, "error");
            if (fileNameEl) fileNameEl.innerText = `Hata: ${baseName}`;
        }
    } catch (err) {
        console.error("playMediaFile hatası:", err);
        showToast("Oynatma hatası: " + err.message, "error");
        if (fileNameEl) fileNameEl.innerText = `Hata: ${baseName}`;
    }
}

// Medya Oynatıcı için Sürükle-Bırak Alanı
setupFilePicker('player-drop-zone', (path) => {
    playMediaFile(path);
}, [
    { name: 'Tüm Medya Dosyaları', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ts', '3gp', 'ogv', 'm4v', 'mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'ac3'] },
    { name: 'Video Dosyaları', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ts', '3gp', 'ogv', 'm4v'] },
    { name: 'Ses Dosyaları', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'ac3'] }
]);

document.getElementById('load-file-btn').onclick = async () => {
    const path = await window.electronAPI.openFileDialog([
        { name: 'Tüm Medya Dosyaları', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ts', '3gp', 'ogv', 'm4v', 'mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'ac3'] },
        { name: 'Video Dosyaları', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'ts', '3gp', 'ogv', 'm4v'] },
        { name: 'Ses Dosyaları', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'ac3'] }
    ]);
    if(path) {
        playMediaFile(path);
    }
};

let selectedUniversalDocPath = null;

const docTargetFormats = {
    'docx': [
        { value: 'pdf', label: 'PDF (Taşınabilir Belge Biçimi)' },
        { value: 'txt', label: 'TXT (Düz Metin)' },
        { value: 'html', label: 'HTML (Web Sayfası)' },
        { value: 'md', label: 'Markdown (MD Notu)' }
    ],
    'pdf': [
        { value: 'docx', label: 'Word (DOCX - Düzenlenebilir Metin)' },
        { value: 'txt', label: 'TXT (Salt Metin Çıkart)' },
        { value: 'html', label: 'HTML (Web Metni)' }
    ],
    'xlsx': [
        { value: 'pdf', label: 'PDF (Tablo Sayfası)' },
        { value: 'csv', label: 'CSV (Virgülle Ayrılmış)' },
        { value: 'json', label: 'JSON (Veri Dizisi)' },
        { value: 'html', label: 'HTML (Web Tablosu)' },
        { value: 'txt', label: 'TXT (Sekmeli Metin)' }
    ],
    'xls': [
        { value: 'pdf', label: 'PDF (Tablo Sayfası)' },
        { value: 'csv', label: 'CSV (Virgülle Ayrılmış)' },
        { value: 'json', label: 'JSON (Veri Dizisi)' },
        { value: 'html', label: 'HTML (Web Tablosu)' }
    ],
    'csv': [
        { value: 'xlsx', label: 'Excel (XLSX Tablosu)' },
        { value: 'pdf', label: 'PDF (Tablo Raporu)' },
        { value: 'json', label: 'JSON (Veri Nesneleri)' },
        { value: 'html', label: 'HTML (Web Tablosu)' },
        { value: 'txt', label: 'TXT (Düz Metin)' }
    ],
    'txt': [
        { value: 'pdf', label: 'PDF (Sayfalandırılmış Belge)' },
        { value: 'docx', label: 'Word (DOCX Belgesi)' },
        { value: 'html', label: 'HTML (Web Sayfası)' },
        { value: 'md', label: 'Markdown (MD)' }
    ],
    'md': [
        { value: 'pdf', label: 'PDF (Biçimlendirilmiş Belge)' },
        { value: 'docx', label: 'Word (DOCX)' },
        { value: 'html', label: 'HTML' },
        { value: 'txt', label: 'TXT (Düz Metin)' }
    ],
    'html': [
        { value: 'pdf', label: 'PDF (Web Sayfasından PDF)' },
        { value: 'docx', label: 'Word (DOCX Belgesi)' },
        { value: 'txt', label: 'TXT (Metin Ayıkla)' },
        { value: 'md', label: 'Markdown (MD)' }
    ],
    'htm': [
        { value: 'pdf', label: 'PDF (Web Sayfasından PDF)' },
        { value: 'docx', label: 'Word (DOCX Belgesi)' },
        { value: 'txt', label: 'TXT (Metin Ayıkla)' }
    ],
    'json': [
        { value: 'xlsx', label: 'Excel (XLSX Tablosu)' },
        { value: 'csv', label: 'CSV (Veri Dosyası)' },
        { value: 'pdf', label: 'PDF (Tablo Raporu)' },
        { value: 'html', label: 'HTML (Biçimli Görünüm)' },
        { value: 'txt', label: 'TXT (Pretty JSON)' }
    ],
    'png': [
        { value: 'pdf', label: 'PDF (Resimden PDF)' },
        { value: 'docx', label: 'Word (Resimli Belge)' }
    ],
    'jpg': [
        { value: 'pdf', label: 'PDF (Resimden PDF)' },
        { value: 'docx', label: 'Word (Resimli Belge)' }
    ],
    'jpeg': [
        { value: 'pdf', label: 'PDF (Resimden PDF)' },
        { value: 'docx', label: 'Word (Resimli Belge)' }
    ],
    'webp': [
        { value: 'pdf', label: 'PDF (Resimden PDF)' },
        { value: 'docx', label: 'Word (Resimli Belge)' }
    ],
    'bmp': [
        { value: 'pdf', label: 'PDF (Resimden PDF)' },
        { value: 'docx', label: 'Word (Resimli Belge)' }
    ]
};

setupFilePicker('universal-doc-drop-zone', (path) => {
    selectedUniversalDocPath = path;
    const fileName = path.split(/[\\/]/).pop();
    const ext = fileName.split('.').pop().toLowerCase();
    
    const infoDiv = document.getElementById('universal-doc-info');
    const controlsDiv = document.getElementById('universal-doc-controls');
    const targetSelect = document.getElementById('universal-target-format');
    
    infoDiv.innerText = `Seçilen Dosya: ${fileName} (${ext.toUpperCase()})`;
    infoDiv.style.display = 'block';
    
    const options = docTargetFormats[ext];
    if (options && options.length > 0) {
        targetSelect.innerHTML = options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
        controlsDiv.style.display = 'flex';
        controlsDiv.style.alignItems = 'center';
        controlsDiv.style.flexWrap = 'wrap';
        controlsDiv.style.gap = '10px';
    } else {
        targetSelect.innerHTML = `<option value="">Desteklenmeyen Dosya Türü</option>`;
        controlsDiv.style.display = 'none';
        showToast(`'${ext}' uzantısı için dönüştürme seçeneği bulunamadı.`, "error");
    }
}, [
    { name: 'Tüm Belgeler ve Tablolar', extensions: ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt', 'md', 'html', 'htm', 'json', 'png', 'jpg', 'jpeg', 'webp', 'bmp'] },
    { name: 'PDF Dosyaları', extensions: ['pdf'] },
    { name: 'Word Dosyaları', extensions: ['docx'] },
    { name: 'Excel ve CSV', extensions: ['xlsx', 'xls', 'csv'] },
    { name: 'Metin ve Kod', extensions: ['txt', 'md', 'html', 'json'] },
    { name: 'Resimler', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }
]);

document.getElementById('convert-universal-doc-btn').onclick = async () => {
    if (!selectedUniversalDocPath) {
        showToast("Lütfen önce bir dosya seçin!", "error");
        return;
    }
    const targetFormat = document.getElementById('universal-target-format').value;
    if (!targetFormat) return;

    const targetPath = await window.electronAPI.saveFileDialog(targetFormat);
    if (targetPath) {
        const docBox = document.getElementById('doc-progress-box');
        const docBar = document.getElementById('doc-progress-bar');
        const docStage = document.getElementById('doc-progress-stage');
        const docPercent = document.getElementById('doc-progress-percent');
        const docDetail = document.getElementById('doc-progress-detail');

        if (docBox) {
            docBox.style.display = 'block';
            docBar.style.width = '15%';
            docBar.classList.add('indeterminate');
            docStage.innerText = "📄 Belge işleniyor...";
            docPercent.innerText = "%15";
            docDetail.innerText = "Dosya belleğe yükleniyor ve ayrıştırılıyor...";
        }

        showToast("Belge dönüştürülüyor, lütfen bekleyin...", "info");
        const result = await window.electronAPI.convertDocument({
            filePath: selectedUniversalDocPath,
            targetFormat: targetFormat,
            savePath: targetPath
        });
        
        if (result.success) {
            if (docBar) {
                docBar.classList.remove('indeterminate');
                docBar.style.width = '100%';
                if (docPercent) docPercent.innerText = '%100';
                if (docStage) docStage.innerText = '✅ Belge Başarıyla Dönüştürüldü!';
                if (docDetail) docDetail.innerText = 'Dosya kaydedildi: ' + targetPath.split(/[\\/]/).pop();
                setTimeout(() => { if (docBox) docBox.style.display = 'none'; }, 3500);
            }
            showToast("Belge başarıyla dönüştürüldü ve kaydedildi:\n" + targetPath, "success");
        } else {
            if (docBox) docBox.style.display = 'none';
            showToast("Dönüştürme hatası: " + result.error, "error");
        }
    }
};

if (window.electronAPI.onDocConversionProgress) {
    window.electronAPI.onDocConversionProgress(({ percent, stage, detail }) => {
        const docBox = document.getElementById('doc-progress-box');
        const docBar = document.getElementById('doc-progress-bar');
        const docStage = document.getElementById('doc-progress-stage');
        const docPercent = document.getElementById('doc-progress-percent');
        const docDetail = document.getElementById('doc-progress-detail');

        if (!docBox) return;
        docBox.style.display = 'block';
        if (percent != null && Number.isFinite(percent)) {
            docBar.classList.remove('indeterminate');
            docBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
            if (docPercent) docPercent.innerText = `%${Math.round(percent)}`;
        }
        if (stage && docStage) docStage.innerText = `📄 ${stage}`;
        if (detail && docDetail) docDetail.innerText = detail;
    });
}

let currentPdfPath = null;

setupFilePicker('select-pdf-btn', async (path) => {
    currentPdfPath = path;
    
    // PDF Yükleme stratejisi:
    // Blob worker kullandığımız için güvenlik kısıtlamasına takılmadan
    // yerel dosyayı main process üzerinden Buffer olarak alıp Blob'a çeviriyoruz.
    try {
        const arrayBuffer = await window.electronAPI.readFileBuffer(path);
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        document.getElementById('pdf-preview-embed').src = `${blobUrl}#toolbar=0`;
        document.getElementById('pdf-preview-container').style.display = 'block';
        showToast("PDF önizlemesi yüklendi", "success");
    } catch (err) {
        showToast("Önizleme yüklenemedi: " + err.message, "error");
    }
}, [{name: 'PDF', extensions: ['pdf']}]);

document.getElementById('pdf-export-text-btn').onclick = async () => {
    if (!currentPdfPath) return;
    const targetPath = await window.electronAPI.saveFileDialog('docx');
    if (targetPath) {
        const pdfBox = document.getElementById('pdf-progress-box');
        const pdfBar = document.getElementById('pdf-progress-bar');
        const pdfStage = document.getElementById('pdf-progress-stage');
        const pdfPercent = document.getElementById('pdf-progress-percent');
        const pdfDetail = document.getElementById('pdf-progress-detail');

        if (pdfBox) {
            pdfBox.style.display = 'block';
            pdfBar.style.width = '30%';
            pdfBar.classList.add('indeterminate');
            pdfStage.innerText = "📄 PDF Metinleri Ayıklanıyor...";
            pdfPercent.innerText = "%30";
            pdfDetail.innerText = "Paragraflar Word yapısına aktarılıyor...";
        }

        showToast("PDF metinleri okunuyor, lütfen bekleyin...", "info");
        const result = await window.electronAPI.convertPdfToWord({ filePath: currentPdfPath, savePath: targetPath });
        if (result.success) {
            if (pdfBar) {
                pdfBar.classList.remove('indeterminate');
                pdfBar.style.width = '100%';
                if (pdfPercent) pdfPercent.innerText = '%100';
                if (pdfStage) pdfStage.innerText = '✅ Word Belgesi Hazırlandı!';
                setTimeout(() => { if (pdfBox) pdfBox.style.display = 'none'; }, 3000);
            }
            showToast("Word Başarıyla Kaydedildi:\n" + targetPath, "success");
        } else {
            if (pdfBox) pdfBox.style.display = 'none';
            showToast("Dönüştürme hatası: " + result.error, "error");
        }
    }
};

document.getElementById('pdf-export-image-btn').onclick = async () => {
    if (!currentPdfPath) return;
    const targetPath = await window.electronAPI.saveFileDialog('docx');
    if (targetPath) {
        try {
            window.electronAPI.logToTerminal("Export Image Butonuna Tıklandı. Hedef dosya seçildi.");
            showToast("PDF görselleştiriliyor, işlem biraz sürebilir...", "info");
            
            // Electron'un mevcut Chromium sürümünde URL.parse olmayabilir, bu yüzden polyfill ekliyoruz
            if (typeof URL.parse !== 'function') {
                window.electronAPI.logToTerminal("URL.parse polyfill ekleniyor...");
                URL.parse = function(url, base) {
                    try {
                        return new URL(url, base);
                    } catch (e) {
                        return null;
                    }
                };
            }

            // pdf.js modülünü standart <script> olarak yükle (v4 ESM sorunlarını aşmak için v3 UMD kullanıyoruz)
            if (!window.pdfjsLib) {
                window.electronAPI.logToTerminal("pdf.min.js <script> olarak yükleniyor...");
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = './node_modules/pdfjs-dist/build/pdf.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.body.appendChild(script);
                });
                window.electronAPI.logToTerminal("pdf.min.js başarıyla yüklendi.");
                
                // Electron'da lokal dosyadan Web Worker yüklemek (file://) engellendiği için,
                // Worker dosyasını IPC üzerinden okuyup Blob URL'ye dönüştürüyoruz!
                window.electronAPI.logToTerminal("Worker dosyası okunuyor (Blob Yöntemi)...");
                const workerData = await window.electronAPI.readFileBuffer('./node_modules/pdfjs-dist/build/pdf.worker.min.js');
                if (workerData.success) {
                    const workerBlob = new Blob([new Uint8Array(workerData.data)], { type: 'text/javascript' });
                    const workerUrl = URL.createObjectURL(workerBlob);
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
                    window.electronAPI.logToTerminal("workerSrc Blob URL olarak ayarlandı.");
                } else {
                    window.electronAPI.logToTerminal("Worker okunamadı! Hata: " + workerData.error);
                }
            }

            const pdfjsLib = window.pdfjsLib;
            
            window.electronAPI.logToTerminal("Dosya Backend üzerinden doğrudan RAM'e (Buffer) okunuyor...");
            const fileData = await window.electronAPI.readFileBuffer(currentPdfPath);
            if (!fileData.success) throw new Error("Dosya okunamadı: " + fileData.error);
            
            window.electronAPI.logToTerminal(`getDocument çalıştırılıyor (Buffer ile)`);
            
            // Uint8Array formatına dönüştür (IPC Buffer'ı Dizi olarak iletebilir)
            const uint8Array = new Uint8Array(fileData.data);
            
            const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
            
            loadingTask.onProgress = function (progress) {
                window.electronAPI.logToTerminal(`Yükleme: ${progress.loaded} / ${progress.total}`);
            };

            window.electronAPI.logToTerminal("PDF'in parse edilmesi bekleniyor...");
            const pdf = await loadingTask.promise;
            window.electronAPI.logToTerminal(`PDF başarıyla parse edildi! Toplam sayfa: ${pdf.numPages}`);
            
            const totalPages = pdf.numPages;
            const images = [];
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const pdfBox = document.getElementById('pdf-progress-box');
            const pdfBar = document.getElementById('pdf-progress-bar');
            const pdfStage = document.getElementById('pdf-progress-stage');
            const pdfPercent = document.getElementById('pdf-progress-percent');
            const pdfDetail = document.getElementById('pdf-progress-detail');

            if (pdfBox) {
                pdfBox.style.display = 'block';
                pdfBar.style.width = '0%';
                pdfBar.classList.remove('indeterminate');
                pdfStage.innerText = `📄 Sayfalar Görselleştiriliyor (Toplam: ${totalPages})`;
                pdfPercent.innerText = "%0";
                pdfDetail.innerText = `Sayfa: 0 / ${totalPages}`;
            }
            
            window.electronAPI.logToTerminal(`Görsel dönüştürme başlatıldı. Toplam Sayfa: ${totalPages}`);
            
            for (let i = 1; i <= totalPages; i++) {
                const currentPct = Math.round((i / totalPages) * 100);
                if (pdfBar) pdfBar.style.width = `${currentPct}%`;
                if (pdfPercent) pdfPercent.innerText = `%${currentPct}`;
                if (pdfDetail) pdfDetail.innerText = `İşleniyor: Sayfa ${i} / ${totalPages} (%${currentPct})`;
                
                showToast(`Sayfa işleniyor: ${i} / ${totalPages}`, "info");
                window.electronAPI.logToTerminal(`İşleniyor: Sayfa ${i} / ${totalPages} - %${currentPct} tamamlandı.`);
                
                const page = await pdf.getPage(i);
                // Kaliteyi artırmak için ölçeği 2 yapıyoruz
                const viewport = page.getViewport({ scale: 2.0 });
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({
                    canvasContext: ctx,
                    viewport: viewport
                }).promise;
                
                // Base64 formatında resim array'ine ekle (DOCX oluşturucu için)
                images.push(canvas.toDataURL('image/png'));
                
                // UI (Arayüz) donmasını engellemek ve Progress Bar'ın çizilmesine izin vermek için çok kısa bir bekleme süresi
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Resimleri Backend'e yolla
            if (pdfStage) pdfStage.innerText = `📄 Word belgesi oluşturuluyor (${totalPages} resim)...`;
            showToast(`Görseller Word dosyasına birleştiriliyor, bekleyin...`, "info");
            window.electronAPI.logToTerminal(`Tüm sayfalar okundu. Word dosyası (${totalPages} resim) oluşturuluyor...`);
            
            const result = await window.electronAPI.convertImagesToWord({ images, savePath: targetPath });
            
            if (result.success) {
                if (pdfBar) {
                    pdfBar.style.width = '100%';
                    if (pdfPercent) pdfPercent.innerText = '%100';
                    if (pdfStage) pdfStage.innerText = '✅ Word Belgesi Oluşturuldu!';
                    setTimeout(() => { if (pdfBox) pdfBox.style.display = 'none'; }, 3000);
                }
                window.electronAPI.logToTerminal(`İşlem Başarılı! Dosya kaydedildi: ${targetPath}`);
                showToast("Word (Görsel) Başarıyla Kaydedildi:\n" + targetPath, "success");
            } else {
                if (pdfBox) pdfBox.style.display = 'none';
                window.electronAPI.logToTerminal(`İşlem Başarısız! Hata: ${result.error}`);
                showToast("Dönüştürme hatası: " + result.error, "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Görsel dönüştürme hatası: " + err.message, "error");
        }
    }
};

document.getElementById('read-word-btn').onclick = async () => {
    const path = await window.electronAPI.openFileDialog([{name: 'Word', extensions: ['docx']}]);
    if(path) {
        document.getElementById('word-content').innerHTML = await window.electronAPI.readWord(path);
        document.getElementById('word-toolbar').style.display = 'flex';
        showToast("Word dosyası başarıyla okundu.", "success");
    }
};

// Word içeriğini .docx olarak kaydet
document.getElementById('save-word-btn').onclick = async () => {
    try {
        const contentEl = document.getElementById('word-content');
        const content = contentEl ? contentEl.innerHTML : '';
        if (!content || content.includes('Lütfen düzenlemek için')) {
            showToast('Word içeriği boş.', 'error');
            return;
        }

        const savePath = await window.electronAPI.saveFileDialog('docx');
        if (!savePath) return;
        const finalSavePath = savePath.toLowerCase().endsWith('.docx') ? savePath : (savePath + '.docx');

        showToast("Word belgesi oluşturuluyor...", "info");
        const result = await window.electronAPI.saveToWord({ content, savePath: finalSavePath });
        
        if (result.success) {
            showToast('Word başarıyla kaydedildi:\n' + finalSavePath, 'success');
        } else {
            showToast('Word kaydetme hatası: ' + result.error, 'error');
        }
    } catch (err) {
        console.error('save-word error:', err);
        showToast('Word kaydetme hatası: ' + (err?.message || err), 'error');
    }
};

window.electronAPI.onConversionProgress((data) => {
    const mediaBox = document.getElementById('media-progress-box');
    const mediaBar = document.getElementById('media-progress-bar');
    const mediaStage = document.getElementById('media-progress-stage');
    const mediaPercent = document.getElementById('media-progress-percent');
    const mediaTime = document.getElementById('media-progress-time');
    const mediaFps = document.getElementById('media-progress-fps');
    const mediaSize = document.getElementById('media-progress-size');

    if (!mediaBox) return;
    mediaBox.style.display = 'block';

    let percent = null;
    let stage = 'Medya dönüştürülüyor...';
    let timemark = null;
    let fps = null;
    let size = null;

    if (typeof data === 'number') {
        percent = data;
    } else if (typeof data === 'object' && data !== null) {
        percent = data.percent;
        stage = data.stage || stage;
        timemark = data.timemark;
        fps = data.fps;
        size = data.size;
    }

    if (percent != null && Number.isFinite(percent) && percent > 0) {
        mediaBar.classList.remove('indeterminate');
        const clamped = Math.min(100, Math.max(0, percent));
        mediaBar.style.width = `${clamped.toFixed(1)}%`;
        mediaPercent.innerText = `%${clamped.toFixed(1)}`;
    } else {
        mediaBar.classList.add('indeterminate');
        mediaPercent.innerText = 'İşleniyor';
    }

    if (stage) mediaStage.innerText = `🎬 ${stage}`;
    if (timemark) mediaTime.innerText = `⏱️ Süre: ${timemark}`;
    if (fps != null) mediaFps.innerText = `⚡ Hız: ${fps} FPS`;
    else mediaFps.innerText = '⚡ Hız: Kodlanıyor...';
    if (size) mediaSize.innerText = `📦 Boyut: ${size}`;
});

window.electronAPI.onConversionDone((outPath) => {
    const mediaBox = document.getElementById('media-progress-box');
    const mediaBar = document.getElementById('media-progress-bar');
    const mediaStage = document.getElementById('media-progress-stage');
    const mediaPercent = document.getElementById('media-progress-percent');

    if (mediaBox && mediaBar) {
        mediaBar.classList.remove('indeterminate');
        mediaBar.style.width = '100%';
        if (mediaPercent) mediaPercent.innerText = '%100';
        if (mediaStage) mediaStage.innerText = '✅ Dönüştürme Başarıyla Tamamlandı!';
        
        setTimeout(() => {
            if (mediaBox) mediaBox.style.display = 'none';
        }, 3500);
    }
    showToast("Dönüştürme tamamlandı. Dosya:\n" + outPath, "success");
});

window.electronAPI.onConversionError((msg) => {
    const mediaBox = document.getElementById('media-progress-box');
    if (mediaBox) mediaBox.style.display = 'none';
    showToast("Dönüştürme hatası:\n" + (msg || "Bilinmeyen hata"), "error");
});


// --- SOSYAL MEDYA İNDİRİCİ ---
const socialFormat = document.getElementById('social-format');
const socialQualityContainer = document.getElementById('social-quality-container');
const socialOptionsPane = document.getElementById('social-options-pane');
const analyzeBtn = document.getElementById('analyze-social-btn');
const socialQualitySelect = document.getElementById('social-quality');
const socialStatus = document.getElementById('social-status');

if (socialFormat && socialQualityContainer) {
    socialFormat.onchange = () => {
        socialQualityContainer.style.display = socialFormat.value === 'mp3' ? 'none' : 'block';
    };
}

if (analyzeBtn) {
    analyzeBtn.onclick = () => {
        const url = document.getElementById('social-url').value;
        if (!url) {
            showToast("Lütfen bir URL girin.", "error");
            return;
        }
        
        socialOptionsPane.style.display = 'none';
        socialStatus.innerText = "Bağlantı analiz ediliyor, lütfen bekleyin...";
        analyzeBtn.disabled = true;
        
        window.electronAPI.analyzeUrl(url);
    };
}

window.electronAPI.onUrlAnalyzed((resolutions) => {
    analyzeBtn.disabled = false;
    socialStatus.innerText = "";
    socialOptionsPane.style.display = 'block';
    
    // Temizle
    socialQualitySelect.innerHTML = '<option value="best">En Yüksek Kalite</option>';
    
    resolutions.forEach(res => {
        let label = `${res}p`;
        if (res >= 2160) label += " (4K)";
        else if (res >= 1440) label += " (2K)";
        else if (res >= 1080) label += " (Full HD)";
        else if (res >= 720) label += " (HD)";
        
        const opt = document.createElement('option');
        opt.value = res;
        opt.innerText = label;
        socialQualitySelect.appendChild(opt);
    });
    
    showToast("Bağlantı analiz edildi.", "success");
});

window.electronAPI.onUrlAnalyzeError((err) => {
    analyzeBtn.disabled = false;
    socialStatus.innerText = "";
    showToast("Analiz hatası: " + err, "error");
});

document.getElementById('download-social-btn').onclick = async () => {
    const url = document.getElementById('social-url').value;
    const format = socialFormat ? socialFormat.value : 'mp4';
    const quality = document.getElementById('social-quality') ? document.getElementById('social-quality').value : 'best';
    
    if (!url) {
        showToast("Lütfen bir URL girin.", "error");
        return;
    }
    
    const ext = format === 'mp3' ? 'mp3' : format;
    const savePath = await window.electronAPI.saveFileDialog(ext);
    
    if (savePath) {
        const finalSavePath = savePath.toLowerCase().endsWith(`.${ext}`) ? savePath : (savePath + `.${ext}`);
        const socialBox = document.getElementById('social-progress-box');
        const socialBar = document.getElementById('social-progress-bar');
        const socialStage = document.getElementById('social-progress-stage');
        const socialPercent = document.getElementById('social-progress-percent');
        const socialSpeed = document.getElementById('social-progress-speed');
        const socialEta = document.getElementById('social-progress-eta');
        const status = document.getElementById('social-status');

        if (socialBox) {
            socialBox.style.display = 'block';
            socialBar.style.width = '0%';
            socialBar.classList.add('indeterminate');
            socialStage.innerText = "🌐 İndirme Başlatılıyor...";
            socialPercent.innerText = "%0";
            socialSpeed.innerText = "⚡ Hız: Başlatılıyor...";
            socialEta.innerText = "⏳ Kalan Süre: Hesaplanıyor...";
        }
        status.innerText = "İndirme başlatılıyor...";
        
        window.electronAPI.downloadSocialMedia({ url, format, quality, savePath: finalSavePath });
    }
};

document.getElementById('download-thumbnail-btn').onclick = async () => {
    const url = document.getElementById('social-url').value;
    if (!url) {
        showToast("Lütfen bir URL girin.", "error");
        return;
    }
    
    const savePath = await window.electronAPI.saveFileDialog('jpg');
    if (savePath) {
        const finalSavePath = savePath.toLowerCase().endsWith('.jpg') ? savePath : (savePath + '.jpg');
        const socialBox = document.getElementById('social-progress-box');
        const socialBar = document.getElementById('social-progress-bar');
        const socialStage = document.getElementById('social-progress-stage');
        const socialPercent = document.getElementById('social-progress-percent');
        const status = document.getElementById('social-status');

        if (socialBox) {
            socialBox.style.display = 'block';
            socialBar.style.width = '50%';
            socialBar.classList.add('indeterminate');
            socialStage.innerText = "🌐 Küçük Resim İndiriliyor...";
            socialPercent.innerText = "%50";
        }
        status.innerText = "Küçük resim indiriliyor...";
        
        window.electronAPI.downloadSocialMedia({ url, isThumbnail: true, savePath: finalSavePath });
    }
};

window.electronAPI.onDownloadProgress((data) => {
    const socialBox = document.getElementById('social-progress-box');
    const socialBar = document.getElementById('social-progress-bar');
    const socialStage = document.getElementById('social-progress-stage');
    const socialPercent = document.getElementById('social-progress-percent');
    const socialSpeed = document.getElementById('social-progress-speed');
    const socialEta = document.getElementById('social-progress-eta');

    if (!socialBox) return;
    socialBox.style.display = 'block';

    let pct = null;
    if (typeof data === 'number') {
        pct = data;
    } else if (typeof data === 'object' && data !== null) {
        pct = data.percent;
        if (data.speed && socialSpeed) socialSpeed.innerText = data.speed;
        if (data.eta && socialEta) socialEta.innerText = data.eta;
        if (data.stage && socialStage) socialStage.innerText = `🌐 ${data.stage}`;
    }

    if (pct != null && Number.isFinite(pct) && pct > 0) {
        socialBar.classList.remove('indeterminate');
        socialBar.style.width = `${Math.min(100, Math.max(0, pct)).toFixed(1)}%`;
        if (socialPercent) socialPercent.innerText = `%${pct.toFixed(1)}`;
    }
});

window.electronAPI.onDownloadDone((path) => {
    const socialBox = document.getElementById('social-progress-box');
    const socialBar = document.getElementById('social-progress-bar');
    const socialStage = document.getElementById('social-progress-stage');
    const socialPercent = document.getElementById('social-progress-percent');
    const status = document.getElementById('social-status');
    
    if (socialBox && socialBar) {
        socialBar.classList.remove('indeterminate');
        socialBar.style.width = '100%';
        if (socialPercent) socialPercent.innerText = '%100';
        if (socialStage) socialStage.innerText = '✅ İndirme Başarıyla Tamamlandı!';
        setTimeout(() => { if (socialBox) socialBox.style.display = 'none'; }, 3500);
    }
    status.innerText = "";
    showToast("Medya başarıyla indirildi: " + path, "success");
});

window.electronAPI.onDownloadError((err) => {
    const socialBox = document.getElementById('social-progress-box');
    const status = document.getElementById('social-status');
    if (socialBox) socialBox.style.display = 'none';
    status.innerText = "";
    showToast("İndirme hatası: " + err, "error");
});


// --- PDF Araçları (Birleştir & Böl) ---
let mergePdfFiles = [];

setupFilePicker('merge-pdf-drop-zone', (path) => {
    if (!mergePdfFiles.includes(path)) {
        mergePdfFiles.push(path);
        const listDiv = document.getElementById('merge-files-list');
        listDiv.innerHTML = mergePdfFiles.map((p, i) => `<div>${i+1}. ${p.split(/[\\/]/).pop()}</div>`).join('');
    }
}, [{ name: 'PDF', extensions: ['pdf'] }]);

document.getElementById('merge-pdf-btn').onclick = async () => {
    if (mergePdfFiles.length < 2) {
        showToast("Birleştirmek için en az 2 PDF seçmelisiniz.", "error");
        return;
    }
    const savePath = await window.electronAPI.saveFileDialog('pdf');
    if (savePath) {
        showToast("PDF'ler birleştiriliyor, lütfen bekleyin...", "info");
        const result = await window.electronAPI.mergePdfs({ filePaths: mergePdfFiles, savePath });
        if (result.success) {
            showToast("PDF'ler başarıyla birleştirildi!\n" + result.path, "success");
            mergePdfFiles = [];
            document.getElementById('merge-files-list').innerHTML = '';
        } else {
            showToast("Hata: " + result.error, "error");
        }
    }
};

let splitPdfFile = null;

setupFilePicker('split-pdf-drop-zone', (path) => {
    splitPdfFile = path;
    document.getElementById('split-file-name').innerText = "Seçilen: " + path.split(/[\\/]/).pop();
}, [{ name: 'PDF', extensions: ['pdf'] }]);

document.getElementById('split-pdf-btn').onclick = async () => {
    if (!splitPdfFile) {
        showToast("Bölmek için bir PDF seçmelisiniz.", "error");
        return;
    }
    const pageNum = parseInt(document.getElementById('split-page-number').value);
    
    // We need 2 save paths for the split
    const savePathPart1 = await window.electronAPI.saveFileDialog('pdf');
    if (!savePathPart1) return;
    showToast("İkinci bölüm için kaydetme yeri seçin...", "info");
    const savePathPart2 = await window.electronAPI.saveFileDialog('pdf');
    if (!savePathPart2) return;
    
    showToast("PDF bölünüyor, lütfen bekleyin...", "info");
    const result = await window.electronAPI.splitPdf({
        filePath: splitPdfFile,
        splitAfterPage: pageNum,
        savePathPart1,
        savePathPart2
    });
    
    if (result.success) {
        showToast("PDF başarıyla bölündü!", "success");
        splitPdfFile = null;
        document.getElementById('split-file-name').innerText = '';
    } else {
        showToast("Hata: " + result.error, "error");
    }
};


// --- ÖZEL GÖREV ÇUBUĞU BUTON KONTROLLERİ ---
document.getElementById('btn-minimize').onclick = () => window.electronAPI.windowMinimize();
document.getElementById('btn-maximize').onclick = () => window.electronAPI.windowMaximize();
document.getElementById('btn-close').onclick = () => window.electronAPI.windowClose();

window.electronAPI.onWindowMaximizedChanged((isMaximized) => {
    const btn = document.getElementById('btn-maximize');
    if (!btn) return;

    btn.innerHTML = isMaximized
        ? `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 4h10a2 2 0 0 1 2 2v10m-.584 3.412a2 2 0 0 1 -1.416 .588h-12a2 2 0 0 1 -2 -2v-12c0 -.552 .224 -1.052 .586 -1.414"/><path d="M3 3l18 18"/></svg>
        `
        : `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 -2h-14a2 2 0 0 1 -2 -2z"/></svg>
        `;
});

// --- GÖMÜLÜ EVRENSEL SÖZLÜK VE İNTERNETSİZ ÇEVİRİ MOTORU ---
const dictSourceLang = document.getElementById('dict-source-lang');
const dictTargetLang = document.getElementById('dict-target-lang');
const swapDictLangBtn = document.getElementById('swap-dict-lang-btn');
const tabDictBtn = document.getElementById('tab-dictionary-btn');
const tabTransBtn = document.getElementById('tab-translator-btn');
const dictLookupMode = document.getElementById('dict-lookup-mode');
const dictTranslatorMode = document.getElementById('dict-translator-mode');

// Dilleri Ters Çevirme (Swap)
if (swapDictLangBtn && dictSourceLang && dictTargetLang) {
    swapDictLangBtn.onclick = () => {
        const temp = dictSourceLang.value;
        dictSourceLang.value = dictTargetLang.value;
        dictTargetLang.value = temp;

        // Anlık arama yapılmışsa yeni yöne göre tekrar ara
        const currentQuery = document.getElementById('dict-search-input').value.trim();
        if (currentQuery) {
            executeDictSearch(currentQuery);
        }
        
        // Eğer çeviri metni varsa onu da takas et
        const srcText = document.getElementById('translator-source-text');
        const targetText = document.getElementById('translator-target-text');
        if (srcText && targetText && targetText.value) {
            srcText.value = targetText.value;
            targetText.value = '';
            executeOfflineTranslation();
        }
    };
}

// Sekme Geçişleri (Sözlük Arama / Metin Çeviri)
if (tabDictBtn && tabTransBtn && dictLookupMode && dictTranslatorMode) {
    tabDictBtn.onclick = () => {
        tabDictBtn.classList.add('active');
        tabDictBtn.style.background = '';
        tabDictBtn.style.color = '';
        tabTransBtn.classList.remove('active');
        tabTransBtn.style.background = 'rgba(255,255,255,0.07)';
        tabTransBtn.style.color = '#ccc';
        dictLookupMode.style.display = 'block';
        dictTranslatorMode.style.display = 'none';
    };

    tabTransBtn.onclick = () => {
        tabTransBtn.classList.add('active');
        tabTransBtn.style.background = '';
        tabTransBtn.style.color = '';
        tabDictBtn.classList.remove('active');
        tabDictBtn.style.background = 'rgba(255,255,255,0.07)';
        tabDictBtn.style.color = '#ccc';
        dictTranslatorMode.style.display = 'block';
        dictLookupMode.style.display = 'none';
    };
}

// --- GELİŞMİŞ VE AKICI SES MOTORU (VOICE MANAGER) ---
let cachedVoices = [];

function loadVoices() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        cachedVoices = window.speechSynthesis.getVoices() || [];
    }
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Dile en uygun, en akıcı ve doğal yerel sesi seçme algoritması
function getBestVoiceForLang(langCode) {
    loadVoices();
    const cleanLang = (langCode || 'en').toLowerCase().split(/[-_]/)[0];

    const voiceLangMap = {
        tr: ['tr', 'turkish', 'türkçe'],
        en: ['en', 'english'],
        de: ['de', 'german', 'deutsch'],
        fr: ['fr', 'french', 'français'],
        es: ['es', 'spanish', 'español'],
        ru: ['ru', 'russian', 'русский'],
        it: ['it', 'italian', 'italiano'],
        ar: ['ar', 'arabic', 'العربية']
    };

    const targetKeywords = voiceLangMap[cleanLang] || [cleanLang];

    // SADECE ve SADECE seçilen dile ait sesleri filtrele
    const matchingVoices = cachedVoices.filter(v => {
        const vLang = (v.lang || '').toLowerCase().replace('_', '-');
        const vName = (v.name || '').toLowerCase();
        return targetKeywords.some(kw => vLang.startsWith(kw) || vLang.includes('-' + kw) || vName.includes(kw));
    });

    if (matchingVoices.length === 0) {
        // Eğer ses listesinde bulamazsa başka dilin sesini zorlama, null dönerek tarayıcının yerel dil motoruna bırak
        return null;
    }

    // Windows'taki en kaliteli ve doğal sesleri önceliklendir (Natural, Neural, Desktop, vb.)
    const preferredNames = [
        'natural', 'neural', 'online', 'tolga', 'emel', 'sena',
        'jenny', 'zira', 'david', 'george', 'mark', 'hedda', 'stefan',
        'hortense', 'paul', 'helena', 'laura', 'irina', 'pavel', 'elsa', 'hoda'
    ];

    for (const name of preferredNames) {
        const match = matchingVoices.find(v => (v.name || '').toLowerCase().includes(name));
        if (match) return match;
    }

    return matchingVoices.find(v => !(v.name || '').toLowerCase().includes('espeak')) || matchingVoices[0];
}

let currentAudioContext = null;
let currentSourceNode = null;
let currentHtml5Audio = null;

// Web Audio API Tabanlı Düşük Gecikmeli ve Kesintisiz Ses Oynatıcı
async function playAudioFromDataUri(dataUri) {
    // Önceki çalan sesleri durdur
    if (currentSourceNode) {
        try { currentSourceNode.stop(); } catch(e){}
        currentSourceNode = null;
    }
    if (currentHtml5Audio) {
        try { currentHtml5Audio.pause(); currentHtml5Audio.currentTime = 0; } catch(e){}
        currentHtml5Audio = null;
    }

    try {
        const base64Index = dataUri.indexOf(',');
        if (base64Index === -1) throw new Error('Geçersiz Data URI formatı');
        const base64 = dataUri.substring(base64Index + 1);
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!currentAudioContext || currentAudioContext.state === 'closed') {
            currentAudioContext = new AudioCtx();
        }
        if (currentAudioContext.state === 'suspended') {
            await currentAudioContext.resume();
        }

        const audioBuffer = await currentAudioContext.decodeAudioData(bytes.buffer.slice(0));
        const source = currentAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(currentAudioContext.destination);
        currentSourceNode = source;

        return new Promise((resolve) => {
            source.onended = () => {
                if (currentSourceNode === source) {
                    currentSourceNode = null;
                }
                resolve();
            };
            source.start(0);
        });
    } catch (err) {
        console.warn('Web Audio API çalma hatası, HTML5 Audio yedeğine geçiliyor:', err);
        return new Promise((resolve, reject) => {
            const audio = new Audio(dataUri);
            currentHtml5Audio = audio;
            audio.volume = 1.0;
            audio.onended = () => {
                currentHtml5Audio = null;
                resolve();
            };
            audio.onerror = (e) => {
                currentHtml5Audio = null;
                reject(new Error("HTML5 Audio çalma hatası: " + (audio.error ? audio.error.message : 'bilinmeyen')));
            };
            const p = audio.play();
            if (p !== undefined) {
                p.then(resolve).catch(reject);
            } else {
                resolve();
            }
        });
    }
}

// Global Örnek Cümle Listeleri (Tırnak işareti ve kaçış dizisi hatalarını engellemek için)
window.dictActiveExamples = [];
window.transActiveExamples = [];

window.playSentenceAtIndex = async function(mode, index, side) {
    const list = mode === 'dict' ? window.dictActiveExamples : window.transActiveExamples;
    if (!list || !list[index]) return;
    const item = list[index];
    const text = side === 'src' ? (item.src || item.en) : (item.tgt || item.tr);
    const lang = side === 'src' 
        ? (dictSourceLang ? dictSourceLang.value : 'en') 
        : (dictTargetLang ? dictTargetLang.value : 'tr');

    if (text) {
        await window.speakWordOrText(text, lang);
    }
};

// Sesli Telaffuz ve Betimleme (Öncelik Sırası):
// 1. Evrensel TTS Motoru (Google Doğal Yerel İnsan Sesi -> Yerel Disk Önbelleği -> ESpeak-NG)
// 2. Tarayıcı Yerel SpeechSynthesis Motoru (SADECE o dilin gerçek yerel sesi varsa; ASLA Türk spiker yabancı dilde konuşmaz)
window.speakWordOrText = async function(text, lang = 'en', audioUrl = null) {
    if (!text && !audioUrl) return;

    const cleanLang = (lang || 'en').toLowerCase().split(/[-_]/)[0];

    // 1. Evrensel Doğal Ses Motorunu çağır (Rusça için Rus, Almanca için Alman, Fransızca için Fransız, vb. yerel aksanlı seslendirmenler)
    if (window.electronAPI && window.electronAPI.synthesizeSpeech) {
        try {
            const res = await window.electronAPI.synthesizeSpeech({ text, lang: cleanLang });
            if (res && res.success && res.audioData) {
                await playAudioFromDataUri(res.audioData);
                return;
            }
        } catch(err) {
            console.warn("Universal TTS motoru ses çalma hatası:", err);
        }
    }

    // 2. Doğrudan stüdyo MP3 kaydı varsa
    if (audioUrl && cleanLang === 'en') {
        try {
            await playAudioFromDataUri(audioUrl);
            return;
        } catch(e) {}
    }

    // 3. SADECE hedef dile ait yerel ses yüklüyse Windows sentezleyicisini çalıştır
    speakWithSynthesis(text, cleanLang);
};

async function updateLearnedStats() {
    try {
        if (window.electronAPI && window.electronAPI.getLearnedStats) {
            const stats = await window.electronAPI.getLearnedStats();
            const statEl = document.getElementById('learned-words-stat');
            if (statEl) {
                statEl.innerText = `🧠 ${stats.count} Kelime Öğrenildi`;
            }
        }
    } catch(e) {}
}
updateLearnedStats();

function speakWithSynthesis(text, lang = 'en') {
    if (!window.speechSynthesis || !text) return;
    try {
        window.speechSynthesis.cancel();
        const cleanLang = (lang || 'en').toLowerCase().split(/[-_]/)[0];

        // KRİTİK KORUMA: Eğer dil Türkçe değilse ve o dile ait özgün yabancı ses paketi Windows'ta yoksa,
        // sistem varsayılanı olan Türk spikerin (Tolga) yabancı dilleri Türk aksanıyla okumasına ASLA izin verme!
        const bestVoice = getBestVoiceForLang(cleanLang);
        if (cleanLang !== 'tr' && !bestVoice) {
            console.warn(`[Speech] "${cleanLang}" dili için yerel Windows sesi yüklü değil, Türk spikerin okuması engellendi.`);
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const bcp47Map = {
            tr: 'tr-TR', en: 'en-US', de: 'de-DE', fr: 'fr-FR',
            es: 'es-ES', ru: 'ru-RU', it: 'it-IT', ar: 'ar-SA'
        };
        utterance.lang = bcp47Map[cleanLang] || 'en-US';

        if (bestVoice) {
            utterance.voice = bestVoice;
            if (bestVoice.lang) utterance.lang = bestVoice.lang;
        }

        // Akıcı, anlaşılır ve insan ritmine en yakın doğal parametreler
        utterance.rate = 0.90;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
    } catch(e) {
        console.warn("Konuşma sentezleme hatası:", e);
    }
}

// Geçmiş & Favoriler Yönetimi
function getStoredHistory() {
    try {
        return JSON.parse(localStorage.getItem('dict_search_history') || '[]');
    } catch(e) {
        return [];
    }
}

function saveToHistory(word, meaning) {
    if (!word) return;
    let list = getStoredHistory();
    list = list.filter(item => item.word.toLowerCase() !== word.toLowerCase());
    list.unshift({ word, meaning });
    if (list.length > 20) list = list.slice(0, 20);
    try {
        localStorage.setItem('dict_search_history', JSON.stringify(list));
    } catch(e) {}
    renderHistoryChips();
}

function getStoredFavorites() {
    try {
        return JSON.parse(localStorage.getItem('dict_favorites') || '[]');
    } catch(e) {
        return [];
    }
}

function toggleFavorite(word, meaning, isFavNow) {
    let favs = getStoredFavorites();
    if (isFavNow) {
        favs = favs.filter(item => item.word.toLowerCase() !== word.toLowerCase());
    } else {
        favs.unshift({ word, meaning });
    }
    try {
        localStorage.setItem('dict_favorites', JSON.stringify(favs));
    } catch(e) {}
    renderHistoryChips();
}

function renderHistoryChips() {
    const chipsContainer = document.getElementById('dict-history-chips');
    if (!chipsContainer) return;
    const history = getStoredHistory().slice(0, 10);
    const favs = getStoredFavorites();
    const favSet = new Set(favs.map(f => f.word.toLowerCase()));

    if (history.length === 0 && favs.length === 0) {
        chipsContainer.innerHTML = '<span style="color: #64748b; font-size: 0.85rem;">Henüz arama yapılmadı.</span>';
        return;
    }

    let html = '';
    favs.forEach(item => {
        html += `<span class="chip-tag" style="border-color: rgba(245, 158, 11, 0.4); color: #fbbf24;" onclick="quickSearchWord('${item.word.replace(/'/g, "\\'")}')">⭐ ${item.word}</span>`;
    });
    history.forEach(item => {
        if (!favSet.has(item.word.toLowerCase())) {
            html += `<span class="chip-tag" onclick="quickSearchWord('${item.word.replace(/'/g, "\\'")}')">🔍 ${item.word}</span>`;
        }
    });
    chipsContainer.innerHTML = html;
}

window.quickSearchWord = (word) => {
    const input = document.getElementById('dict-search-input');
    if (input) {
        input.value = word;
        executeDictSearch(word);
    }
};

const clearHistoryBtn = document.getElementById('clear-dict-history-btn');
if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
        try {
            localStorage.removeItem('dict_search_history');
            localStorage.removeItem('dict_favorites');
        } catch(e) {}
        renderHistoryChips();
        showToast("Sözlük geçmişi temizlendi.", "info");
    };
}

let activeLookupResult = null;

async function executeDictSearch(query) {
    if (!query) return;
    const sourceLang = dictSourceLang ? dictSourceLang.value : 'en';
    const targetLang = dictTargetLang ? dictTargetLang.value : 'tr';
    const autoBox = document.getElementById('dict-autocomplete-box');
    if (autoBox) autoBox.style.display = 'none';

    try {
        const data = await window.electronAPI.lookupDictionary({ query, sourceLang, targetLang });
        const resultCard = document.getElementById('dict-result-card');
        if (!resultCard) return;

        if (data && data.found && data.result) {
            activeLookupResult = data.result;
            resultCard.style.display = 'block';

            // Başlık ve Fonetik
            document.getElementById('dict-word-head').innerText = data.result.word;
            document.getElementById('dict-word-ipa').innerText = data.result.ipa || '';

            const typeEl = document.getElementById('dict-word-type');
            const levelEl = document.getElementById('dict-word-level');
            const rawType = (data.result.type || '').trim();
            const rawLevel = (data.result.level || '').trim();

            if (data.result.isOnline) {
                typeEl.style.display = 'inline-block';
                typeEl.innerText = '🌐 Çevrimiçi';
            } else if (rawType && !rawType.toLowerCase().startsWith('cefr') && rawType.toLowerCase() !== rawLevel.toLowerCase() && rawType.toLowerCase() !== 'sözcük') {
                typeEl.style.display = 'inline-block';
                typeEl.innerText = rawType.toUpperCase();
            } else if (!rawLevel && rawType) {
                typeEl.style.display = 'inline-block';
                typeEl.innerText = rawType.toUpperCase();
            } else {
                typeEl.style.display = 'none';
            }

            // CEFR Seviyesi (A1, A2, B1, B2, vb.)
            if (rawLevel) {
                levelEl.style.display = 'inline-block';
                levelEl.innerText = rawLevel.toUpperCase().includes('SEVİYE') ? rawLevel : `${rawLevel} Seviye`;
            } else {
                levelEl.style.display = 'none';
            }

            // Öğrenilen Kelime Rozeti
            const learnedEl = document.getElementById('dict-word-learned-badge');
            if (learnedEl) {
                if (data.result.isLearned) {
                    learnedEl.style.display = 'inline-block';
                    learnedEl.innerText = data.result.wasLearnedNow ? '✨ Yeni Öğrenildi & Hazneye Eklendi' : '🧠 Haznede Kayıtlı (Çevrimdışı)';
                } else {
                    learnedEl.style.display = 'none';
                }
            }
            updateLearnedStats();

            // 1. Detaylı Numaralı Anlamlar Listesi
            const meaningsContainer = document.getElementById('dict-meanings-list');
            const meanings = data.result.meaningsList && data.result.meaningsList.length > 0 
                ? data.result.meaningsList 
                : (data.result.tr ? data.result.tr.split(',').map(s => s.trim()) : [query]);

            meaningsContainer.innerHTML = meanings.map((m, idx) => `
                <div class="meaning-item-row">
                    <span class="meaning-num">${idx + 1}.</span>
                    <span class="meaning-text">${m}</span>
                </div>
            `).join('');

            // 2. İngilizce Tanımlar (Varsa)
            const defsWrapper = document.getElementById('dict-definitions-wrapper');
            const defsContainer = document.getElementById('dict-definitions-list');
            if (data.result.definitions && data.result.definitions.length > 0) {
                defsWrapper.style.display = 'block';
                defsContainer.innerHTML = data.result.definitions.map(d => `
                    <div class="def-item-row">
                        ${d.pos ? `<span class="badge-tag" style="margin-right: 6px; font-size: 0.75rem;">${d.pos}</span>` : ''}
                        <span>${d.def}</span>
                    </div>
                `).join('');
            } else {
                defsWrapper.style.display = 'none';
            }

            // 3. Örnek Cümleler ve Kullanımlar (Seçilen dilde ve hatasız seslendirme)
            const exWrapper = document.getElementById('dict-example-wrapper');
            const exContainer = document.getElementById('dict-examples-container');
            const rawExamples = (data.result.examples && data.result.examples.length > 0) ? data.result.examples : [];
            window.dictActiveExamples = rawExamples;

            if (rawExamples.length > 0) {
                exWrapper.style.display = 'block';
                exContainer.innerHTML = rawExamples.map((ex, idx) => {
                    const srcText = ex.src || ex.en || '';
                    const tgtText = ex.tgt || ex.tr || '';
                    const escSrc = srcText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const escTgt = tgtText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return `
                        <div class="example-sentence-card">
                            <div class="example-content">
                                <div class="example-src">
                                    <span style="font-size: 0.75rem; background: rgba(59,130,246,0.25); color: #93c5fd; padding: 2px 6px; border-radius: 4px; margin-right: 6px; font-weight: 700;">${sourceLang.toUpperCase()}</span>
                                    "${escSrc}"
                                </div>
                                ${tgtText ? `
                                <div class="example-tr">
                                    <span style="font-size: 0.75rem; background: rgba(16,185,129,0.25); color: #6ee7b7; padding: 2px 6px; border-radius: 4px; margin-right: 6px; font-weight: 700;">${targetLang.toUpperCase()}</span>
                                    → ${escTgt}
                                </div>
                                ` : ''}
                            </div>
                            <div style="display: flex; gap: 8px; flex-shrink: 0;">
                                <button class="play-sentence-btn" title="Cümleyi Dinle (${sourceLang.toUpperCase()})" onclick="window.playSentenceAtIndex('dict', ${idx}, 'src')">
                                    🔊
                                </button>
                                ${tgtText ? `
                                <button class="play-sentence-btn" style="color: #34d399 !important; border-color: rgba(52,211,153,0.3) !important;" title="Çeviriyi Dinle (${targetLang.toUpperCase()})" onclick="window.playSentenceAtIndex('dict', ${idx}, 'tgt')">
                                    🔊
                                </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                exWrapper.style.display = 'none';
            }

            // 4. Eş Anlamlılar
            const synWrap = document.getElementById('dict-synonyms-wrapper');
            const synContainer = document.getElementById('dict-word-synonyms');
            if (data.result.syn && data.result.syn.length > 0) {
                synWrap.style.display = 'block';
                synContainer.innerHTML = data.result.syn.map(s => `<span class="chip-tag" onclick="quickSearchWord('${s.replace(/'/g, "\\'")}')">${s}</span>`).join('');
            } else {
                synWrap.style.display = 'none';
            }

            // Favori durumu
            const favs = getStoredFavorites();
            const isFav = favs.some(f => f.word.toLowerCase() === data.result.word.toLowerCase());
            const favBtn = document.getElementById('dict-fav-word-btn');
            if (favBtn) favBtn.innerHTML = isFav ? '★ Favoride' : '☆ Favori';

            // Geçmişe kaydet
            saveToHistory(data.result.word, meanings[0]);
        } else {
            resultCard.style.display = 'block';
            document.getElementById('dict-word-head').innerText = query;
            document.getElementById('dict-word-ipa').innerText = '';
            document.getElementById('dict-word-type').innerText = 'BULUNAMADI';
            document.getElementById('dict-word-level').style.display = 'none';
            document.getElementById('dict-meanings-list').innerHTML = `<div style="color: #94a3b8;">"${query}" için eşleşme bulunamadı. Lütfen "İnternetsiz Cümle / Metin Çevirici" sekmesini deneyin.</div>`;
            document.getElementById('dict-definitions-wrapper').style.display = 'none';
            document.getElementById('dict-example-wrapper').style.display = 'none';
            document.getElementById('dict-synonyms-wrapper').style.display = 'none';
        }
    } catch(err) {
        console.error("executeDictSearch hatası:", err);
    }
}

// Sesli Telaffuz Butonu (Kelime Telaffuzu)
const speakWordBtn = document.getElementById('dict-speak-word-btn');
if (speakWordBtn) {
    speakWordBtn.onclick = () => {
        if (activeLookupResult && activeLookupResult.word) {
            window.speakWordOrText(
                activeLookupResult.word, 
                dictSourceLang ? dictSourceLang.value : 'en',
                activeLookupResult.audioUrl || null
            );
        }
    };
}

// Favorilere Ekle / Çıkar Butonu
const favWordBtn = document.getElementById('dict-fav-word-btn');
if (favWordBtn) {
    favWordBtn.onclick = () => {
        if (!activeLookupResult || !activeLookupResult.word) return;
        const favs = getStoredFavorites();
        const isFav = favs.some(f => f.word.toLowerCase() === activeLookupResult.word.toLowerCase());
        const primaryMeaning = activeLookupResult.meaningsList ? activeLookupResult.meaningsList[0] : activeLookupResult.tr;
        toggleFavorite(activeLookupResult.word, primaryMeaning, isFav);
        favWordBtn.innerHTML = !isFav ? '★ Favoride' : '☆ Favori';
        showToast(!isFav ? 'Favorilere eklendi!' : 'Favorilerden çıkarıldı.', 'info');
    };
}

// Canlı Arama (Debounced Input & Autocomplete)
const searchInput = document.getElementById('dict-search-input');
const searchBtn = document.getElementById('dict-search-btn');
const autoBox = document.getElementById('dict-autocomplete-box');
let searchDebounceTimer = null;

if (searchInput) {
    searchInput.oninput = () => {
        clearTimeout(searchDebounceTimer);
        const query = searchInput.value.trim();
        if (!query) {
            if (autoBox) autoBox.style.display = 'none';
            return;
        }

        searchDebounceTimer = setTimeout(async () => {
            const sourceLang = dictSourceLang ? dictSourceLang.value : 'en';
            const targetLang = dictTargetLang ? dictTargetLang.value : 'tr';
            const data = await window.electronAPI.lookupDictionary({ query, sourceLang, targetLang });
            if (data && data.suggestions && data.suggestions.length > 0 && autoBox) {
                autoBox.style.display = 'block';
                autoBox.innerHTML = data.suggestions.map(item => `
                    <div class="autocomplete-item" onclick="quickSearchWord('${item.word.replace(/'/g, "\\'")}')">
                        <span class="word-highlight">${item.word}</span>
                        <span class="word-desc">${item.tr}</span>
                    </div>
                `).join('');
            } else if (autoBox) {
                autoBox.style.display = 'none';
            }
        }, 120);
    };

    searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            executeDictSearch(searchInput.value.trim());
        }
    };
}

if (searchBtn) {
    searchBtn.onclick = () => {
        if (searchInput) executeDictSearch(searchInput.value.trim());
    };
}

// Otomatik tamamlama kutusu dışına tıklanınca kapat
document.addEventListener('click', (e) => {
    if (autoBox && !autoBox.contains(e.target) && e.target !== searchInput) {
        autoBox.style.display = 'none';
    }
});

// --- METİN & CÜMLE ÇEVİRİCİ ---
// --- METİN & CÜMLE ÇEVİRİCİ ---
async function executeOfflineTranslation() {
    const srcInput = document.getElementById('translator-source-text');
    const targetInput = document.getElementById('translator-target-text');
    const statusEl = document.getElementById('trans-info-status');
    if (!srcInput || !targetInput) return;

    const text = srcInput.value.trim();
    if (!text) {
        targetInput.value = '';
        if (statusEl) statusEl.innerText = '⚡ %100 Çevrimdışı ve Gömülü Motor Devrede';
        return;
    }

    if (statusEl) statusEl.innerText = '⏳ Çevriliyor...';

    const sourceLang = dictSourceLang ? dictSourceLang.value : 'en';
    const targetLang = dictTargetLang ? dictTargetLang.value : 'tr';

    try {
        const result = await window.electronAPI.translateOffline({ text, sourceLang, targetLang });
        if (result && result.translatedText) {
            targetInput.value = result.translatedText;
            if (statusEl) {
                if (result.isOnline) {
                    statusEl.innerHTML = '<span style="color: #38bdf8;">🌐 Çevrimiçi Doğal Çeviri (Zengin Veritabanı)</span>';
                } else {
                    statusEl.innerHTML = '<span style="color: #4ade80;">⚡ %100 Çevrimdışı Gömülü Motor (5,746+ Kelime & Deyim)</span>';
                }
            }

            // Çevrilen kelime veya ifade için örnek cümleleri getir ve göster
            const transExWrap = document.getElementById('trans-examples-wrapper');
            const transExContainer = document.getElementById('trans-examples-container');
            if (transExWrap && transExContainer) {
                const dictLookup = await window.electronAPI.lookupDictionary({ query: text, sourceLang, targetLang });
                const exList = (dictLookup && dictLookup.result && dictLookup.result.examples && dictLookup.result.examples.length > 0)
                    ? dictLookup.result.examples
                    : [];
                window.transActiveExamples = exList;

                if (exList.length > 0) {
                    transExWrap.style.display = 'block';
                    transExContainer.innerHTML = exList.map((ex, idx) => {
                        const srcText = ex.src || ex.en || '';
                        const tgtText = ex.tgt || ex.tr || '';
                        const escSrc = srcText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        const escTgt = tgtText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        return `
                            <div class="example-sentence-card">
                                <div class="example-content">
                                    <div class="example-src">
                                        <span style="font-size: 0.75rem; background: rgba(59,130,246,0.25); color: #93c5fd; padding: 2px 6px; border-radius: 4px; margin-right: 6px; font-weight: 700;">${sourceLang.toUpperCase()}</span>
                                        "${escSrc}"
                                    </div>
                                    ${tgtText ? `
                                    <div class="example-tr">
                                        <span style="font-size: 0.75rem; background: rgba(16,185,129,0.25); color: #6ee7b7; padding: 2px 6px; border-radius: 4px; margin-right: 6px; font-weight: 700;">${targetLang.toUpperCase()}</span>
                                        → ${escTgt}
                                    </div>
                                    ` : ''}
                                </div>
                                <div style="display: flex; gap: 8px; flex-shrink: 0;">
                                    <button class="play-sentence-btn" title="Cümleyi Dinle (${sourceLang.toUpperCase()})" onclick="window.playSentenceAtIndex('trans', ${idx}, 'src')">
                                        🔊
                                    </button>
                                    ${tgtText ? `
                                    <button class="play-sentence-btn" style="color: #34d399 !important; border-color: rgba(52,211,153,0.3) !important;" title="Çeviriyi Dinle (${targetLang.toUpperCase()})" onclick="window.playSentenceAtIndex('trans', ${idx}, 'tgt')">
                                        🔊
                                    </button>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    transExWrap.style.display = 'none';
                }
            }
            updateLearnedStats();
        } else {
            targetInput.value = text;
            if (statusEl) statusEl.innerText = 'Karşılık bulunamadı.';
        }
    } catch(e) {
        console.error("translateOffline hatası:", e);
        if (statusEl) statusEl.innerText = 'Çeviri sırasında hata oluştu.';
    }
}

const doTranslateBtn = document.getElementById('do-translate-btn');
if (doTranslateBtn) {
    doTranslateBtn.onclick = () => executeOfflineTranslation();
}

const srcTextArea = document.getElementById('translator-source-text');
if (srcTextArea) {
    srcTextArea.onkeydown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || !e.shiftKey)) {
            e.preventDefault();
            executeOfflineTranslation();
        }
    };
}

const clearTransBtn = document.getElementById('clear-trans-btn');
if (clearTransBtn) {
    clearTransBtn.onclick = () => {
        const src = document.getElementById('translator-source-text');
        const tgt = document.getElementById('translator-target-text');
        const statusEl = document.getElementById('trans-info-status');
        const transExWrap = document.getElementById('trans-examples-wrapper');
        if (src) src.value = '';
        if (tgt) tgt.value = '';
        if (statusEl) statusEl.innerText = '⚡ %100 Çevrimdışı ve Gömülü Motor Devrede';
        if (transExWrap) transExWrap.style.display = 'none';
    };
}

const copyTransBtn = document.getElementById('copy-translation-btn');
if (copyTransBtn) {
    copyTransBtn.onclick = () => {
        const tgt = document.getElementById('translator-target-text');
        if (tgt && tgt.value) {
            navigator.clipboard.writeText(tgt.value);
            showToast("Çeviri panoya kopyalandı!", "success");
        }
    };
}

const speakSrcBtn = document.getElementById('dict-speak-src-btn');
if (speakSrcBtn) {
    speakSrcBtn.onclick = () => {
        const src = document.getElementById('translator-source-text');
        if (src && src.value) {
            window.speakWordOrText(src.value, dictSourceLang ? dictSourceLang.value : 'en');
        }
    };
}

const speakTargetBtn = document.getElementById('dict-speak-target-btn');
if (speakTargetBtn) {
    speakTargetBtn.onclick = () => {
        const tgt = document.getElementById('translator-target-text');
        if (tgt && tgt.value) {
            window.speakWordOrText(tgt.value, dictTargetLang ? dictTargetLang.value : 'tr');
        }
    };
}

// Sayfa yüklendiğinde geçmiş çipleri yükle
renderHistoryChips();