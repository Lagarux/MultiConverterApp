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

    // Akıllı Medya Bilgi Kartı (Media Inspector)
    try {
        const meta = await window.electronAPI.getMediaMetadata(path);
        const infoCard = document.getElementById('media-info-card');
        if (meta && meta.success && infoCard) {
            infoCard.style.display = 'flex';
            const resEl = document.getElementById('media-info-res');
            const durEl = document.getElementById('media-info-dur');
            const codecEl = document.getElementById('media-info-codec');
            const sizeEl = document.getElementById('media-info-size');

            if (resEl) {
                if (meta.video && meta.video.width) {
                    resEl.innerText = `📐 ${meta.video.width}x${meta.video.height}${meta.video.fps ? ' @ ' + meta.video.fps + 'fps' : ''}`;
                    resEl.style.display = 'inline-block';
                } else {
                    resEl.style.display = 'none';
                }
            }

            if (durEl) {
                if (meta.duration) {
                    const m = Math.floor(meta.duration / 60);
                    const s = Math.floor(meta.duration % 60);
                    durEl.innerText = `⏱️ ${m}:${s < 10 ? '0' : ''}${s}`;
                    durEl.style.display = 'inline-block';
                } else {
                    durEl.style.display = 'none';
                }
            }

            if (codecEl) {
                const codecName = meta.video ? meta.video.codec : (meta.audio ? meta.audio.codec : meta.ext);
                codecEl.innerText = `🎬 ${codecName ? codecName.toUpperCase() : 'MEDYA'}`;
            }

            if (sizeEl) {
                sizeEl.innerText = `💾 ${meta.size ? (meta.size / (1024 * 1024)).toFixed(1) + ' MB' : '--'}`;
            }
        }
    } catch(e) {
        console.warn('Metadata okuma:', e);
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

// Tek Tıkla Videodan MP3 Çıkarıcı Buton
const quickMp3Btn = document.getElementById('quick-extract-audio-btn');
if (quickMp3Btn) {
    quickMp3Btn.onclick = () => {
        if (!selectedVideoPath) {
            showToast("Lütfen önce bir video dosyası seçin!", "error");
            return;
        }
        document.getElementById('format-select').value = 'mp3';
        document.getElementById('start-time').value = '0';
        document.getElementById('end-time').value = '';
        showToast("⚡ Yüksek kaliteli (320kbps) MP3 çıkarma işlemi başlatıldı!", "info");
        document.getElementById('convert-btn').click();
    };
}

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

// Kalite Kaydırıcısı Dinleyicisi
const qualitySlider = document.getElementById('image-quality-slider');
const qualityVal = document.getElementById('image-quality-val');
if (qualitySlider && qualityVal) {
    qualitySlider.oninput = () => {
        qualityVal.innerText = `%${qualitySlider.value}`;
    };
}

document.getElementById('process-image-btn').onclick = async () => {
    if(!selectedImagePath) {
        showToast("Lütfen önce bir resim seçin!", "error");
        return;
    }
    const format = document.getElementById('image-format-select').value;
    const targetPath = await window.electronAPI.saveFileDialog(format);
    
    if (targetPath) {
        const cropData = cropper ? cropper.getData(true) : null;
        const qVal = qualitySlider ? (parseInt(qualitySlider.value) || 85) : 85;
        
        const result = await window.electronAPI.processImageSharp({
            filePath: selectedImagePath,
            targetPath: targetPath, 
            options: {
                format: format,
                quality: qVal,
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
            addRecentConversion(result.path, 'image');
            
            const resBox = document.getElementById('image-result-box');
            if (resBox && result.size && result.origSize) {
                resBox.style.display = 'block';
                const origMb = (result.origSize / (1024 * 1024)).toFixed(2);
                const newMb = (result.size / (1024 * 1024)).toFixed(2);
                const diff = Math.round((1 - (result.size / result.origSize)) * 100);
                const savingText = diff > 0 ? `(%${diff} Tasarruf Sağlandı)` : '(Kayıpsız / Orijinal Boyut)';
                resBox.innerHTML = `✅ <b>İşlem Tamamlandı:</b> ${origMb} MB ➔ <b>${newMb} MB</b> ${savingText}<br><span style="font-size:0.8rem; color:#94a3b8; word-break:break-all;">${result.path}</span>`;
            }
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
            addRecentConversion(targetPath, 'document');
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
    addRecentConversion(outPath, 'video');
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
    addRecentConversion(path, 'download');
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
            addRecentConversion(result.path, 'document');
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
        if (result.paths) {
            result.paths.forEach(p => addRecentConversion(p, 'document'));
        }
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

const exportCsvBtn = document.getElementById('export-learned-csv-btn');
if (exportCsvBtn) {
    exportCsvBtn.onclick = async () => {
        showToast("Kelime listesi Excel / CSV olarak hazırlanıyor...", "info");
        const res = await window.electronAPI.exportLearnedWords({ format: 'csv' });
        if (res && res.success) {
            showToast(`Kelimeler başarıyla dışa aktarıldı:\n${res.filePath}`, "success");
            addRecentConversion(res.filePath, 'document');
        } else if (res && !res.canceled) {
            showToast(res.error || "Dışa aktarma başarısız oldu.", "error");
        }
    };
}

const exportJsonBtn = document.getElementById('export-learned-json-btn');
if (exportJsonBtn) {
    exportJsonBtn.onclick = async () => {
        showToast("Kelime listesi JSON olarak hazırlanıyor...", "info");
        const res = await window.electronAPI.exportLearnedWords({ format: 'json' });
        if (res && res.success) {
            showToast(`Kelimeler başarıyla dışa aktarıldı:\n${res.filePath}`, "success");
            addRecentConversion(res.filePath, 'document');
        } else if (res && !res.canceled) {
            showToast(res.error || "Dışa aktarma başarısız oldu.", "error");
        }
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

// ==================== SON DÖNÜŞTÜRÜLEN DOSYALAR YÖNETİCİSİ ====================
const RECENT_STORAGE_KEY = 'multiconverter_recent_conversions';

function getRecentConversions() {
    try {
        const raw = localStorage.getItem(RECENT_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveRecentConversions(list) {
    try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list.slice(0, 15)));
    } catch (e) {}
}

function addRecentConversion(filePath, type = 'file') {
    if (!filePath) return;
    let list = getRecentConversions();
    list = list.filter(item => item.path !== filePath);
    const fileName = filePath.split(/[\\/]/).pop();
    const ext = fileName.includes('.') ? fileName.split('.').pop().toUpperCase() : 'DOSYA';
    list.unshift({
        path: filePath,
        name: fileName,
        ext: ext,
        type: type,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    saveRecentConversions(list);
    renderRecentConversions();
}

function renderRecentConversions() {
    const listEl = document.getElementById('recent-files-list');
    const badgeEl = document.getElementById('recent-count-badge');
    if (!listEl) return;

    const list = getRecentConversions();
    if (badgeEl) {
        badgeEl.innerText = list.length;
        badgeEl.style.display = list.length > 0 ? 'inline-block' : 'none';
    }

    if (list.length === 0) {
        listEl.innerHTML = '<div style="color: #64748b; font-size: 0.85rem; font-style: italic; padding: 6px 0;">Henüz tamamlanmış bir dönüştürme işlemi bulunmuyor.</div>';
        return;
    }

    listEl.innerHTML = '';
    list.forEach(item => {
        const row = document.createElement('div');
        row.className = 'recent-item';

        let typeIcon = '📁';
        if (item.type === 'video') typeIcon = '🎬';
        else if (item.type === 'image') typeIcon = '🖼️';
        else if (item.type === 'document') typeIcon = '📄';
        else if (item.type === 'download') typeIcon = '🌐';

        row.innerHTML = `
            <div class="recent-item-info">
                <span class="recent-item-name" title="${item.path}">${typeIcon} ${item.name}</span>
                <span class="recent-item-meta">${item.ext} • Saat ${item.timestamp}</span>
            </div>
            <div class="recent-item-actions">
                <button class="recent-btn recent-btn-folder" title="Dosyanın bulunduğu klasörü Windows Gezgini'nde açar">📂 Klasörde Göster</button>
                <button class="recent-btn recent-btn-open" title="Dosyayı doğrudan varsayılan uygulamasıyla açar">▶️ Aç</button>
            </div>
        `;

        const folderBtn = row.querySelector('.recent-btn-folder');
        if (folderBtn) {
            folderBtn.onclick = async () => {
                const res = await window.electronAPI.showItemInFolder(item.path);
                if (!res || !res.success) showToast(res ? res.error : "Klasör açılamadı", "error");
            };
        }

        const openBtn = row.querySelector('.recent-btn-open');
        if (openBtn) {
            openBtn.onclick = async () => {
                const res = await window.electronAPI.openPath(item.path);
                if (!res || !res.success) showToast(res ? res.error : "Dosya açılamadı", "error");
            };
        }

        listEl.appendChild(row);
    });
}

const clearRecentBtn = document.getElementById('clear-recent-conversions-btn');
if (clearRecentBtn) {
    clearRecentBtn.onclick = () => {
        try {
            localStorage.removeItem(RECENT_STORAGE_KEY);
        } catch(e) {}
        renderRecentConversions();
        showToast("Dönüştürme geçmişi temizlendi.", "info");
    };
}

// Başlangıçta son dönüştürülenleri çiz
renderRecentConversions();

// =========================================================================
// 🎨 YENİ ÖZELLİK 1: GÖRSEL & FOTOĞRAF STÜDYOSU (Photoshop & Gemini AI)
// =========================================================================

let psMainCanvas = null;
let psMainCtx = null;
let psOverlayCanvas = null;
let psOverlayCtx = null;
let psOriginalImage = null;
let psLoadedFilePath = null;
let psActiveTool = 'select'; // select, brush, retouch, eraser, text, shape, crop, sticker
let psUndoStack = [];
let psRedoStack = [];
let psZoom = 1.0;
let psStickerImg = null;

let psFilters = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
    blur: 0,
    sharpen: false,
    grayscale: false,
    sepia: false,
    invert: false
};

// Çizim ve Tuval Durumları
let psIsDrawing = false;
let psStartX = 0;
let psStartY = 0;
let psLastX = 0;
let psLastY = 0;
let psCropRect = null; // { x, y, w, h }

function initPhotoStudio() {
    psMainCanvas = document.getElementById('ps-main-canvas');
    psOverlayCanvas = document.getElementById('ps-overlay-canvas');
    if (!psMainCanvas || !psOverlayCanvas) return;

    psMainCtx = psMainCanvas.getContext('2d', { willReadFrequently: true });
    psOverlayCtx = psOverlayCanvas.getContext('2d');

    // Dosya Seçimi & Sürükle Bırak
    setupFilePicker('ps-dropzone', (filePath) => loadPhotoIntoStudio(filePath), [
        { name: 'Görseller', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff', 'svg'] }
    ]);

    const openBtn = document.getElementById('ps-open-btn');
    if (openBtn) {
        openBtn.onclick = async () => {
            const path = await window.electronAPI.openFileDialog([
                { name: 'Görseller', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }
            ]);
            if (path) loadPhotoIntoStudio(path);
        };
    }

    // Araç Çubuğu Butonları
    const toolBtns = document.querySelectorAll('.studio-tool-btn');
    toolBtns.forEach(btn => {
        btn.onclick = () => {
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            psActiveTool = btn.dataset.tool;
            updateStudioSubbar();
            clearOverlay();
        };
    });

    // Subbar Slider Değer Göstergeleri
    const brushSize = document.getElementById('ps-brush-size');
    const brushSizeVal = document.getElementById('ps-brush-size-val');
    if (brushSize && brushSizeVal) {
        brushSize.oninput = () => brushSizeVal.innerText = `${brushSize.value}px`;
    }

    const brushOpacity = document.getElementById('ps-brush-opacity');
    const brushOpacityVal = document.getElementById('ps-brush-opacity-val');
    if (brushOpacity && brushOpacityVal) {
        brushOpacity.oninput = () => brushOpacityVal.innerText = `%${brushOpacity.value}`;
    }

    const shapeWidth = document.getElementById('ps-shape-width');
    const shapeWidthVal = document.getElementById('ps-shape-width-val');
    if (shapeWidth && shapeWidthVal) {
        shapeWidth.oninput = () => shapeWidthVal.innerText = `${shapeWidth.value}px`;
    }

    const stickerScale = document.getElementById('ps-sticker-scale');
    const stickerScaleVal = document.getElementById('ps-sticker-scale-val');
    if (stickerScale && stickerScaleVal) {
        stickerScale.oninput = () => stickerScaleVal.innerText = `%${stickerScale.value}`;
    }

    // Çıkartma / Logo Seçme
    const pickStickerBtn = document.getElementById('ps-pick-sticker-btn');
    if (pickStickerBtn) {
        pickStickerBtn.onclick = async () => {
            const path = await window.electronAPI.openFileDialog([
                { name: 'Logo / Çıkartma', extensions: ['png', 'webp', 'jpg', 'svg'] }
            ]);
            if (path) {
                const img = new Image();
                img.onload = () => {
                    psStickerImg = img;
                    document.getElementById('ps-sticker-name').innerText = path.split(/[\\/]/).pop();
                    showToast("Logo yüklendi. Tuvalde yerleştirmek istediğiniz yere tıklayın.", "info");
                };
                img.src = `file://${path}`;
            }
        };
    }

    // Tuval Olayları
    const viewport = document.getElementById('ps-viewport');
    psOverlayCanvas.onmousedown = onCanvasMouseDown;
    window.addEventListener('mousemove', onCanvasMouseMove);
    window.addEventListener('mouseup', onCanvasMouseUp);

    // Kırpma Butonları
    const execCropBtn = document.getElementById('ps-execute-crop-btn');
    if (execCropBtn) execCropBtn.onclick = executePhotoCrop;

    const cancelCropBtn = document.getElementById('ps-cancel-crop-btn');
    if (cancelCropBtn) {
        cancelCropBtn.onclick = () => {
            psCropRect = null;
            clearOverlay();
            showToast("Kırpma iptal edildi.", "info");
        };
    }

    // Metin Yerleştirme Butonu
    const applyTextBtn = document.getElementById('ps-apply-text-btn');
    if (applyTextBtn) {
        applyTextBtn.onclick = () => {
            if (!psOriginalImage) return;
            const text = document.getElementById('ps-text-input').value.trim();
            if (!text) {
                showToast("Lütfen eklenecek bir metin yazın!", "error");
                return;
            }
            saveStudioHistory();
            // Ortaya varsayılan yerleştir
            renderStudioText(text, psMainCanvas.width / 2, psMainCanvas.height / 2);
            showToast("Metin tuvale eklendi. Konumlandırmak için tuvale tıklayabilirsiniz.", "success");
        };
    }

    // Canlı Filtre Kaydırıcıları Dinleyicileri
    setupFilterSlider('ps-brightness-slider', 'ps-bright-val', (v) => { psFilters.brightness = parseInt(v); updateCanvasFilters(); });
    setupFilterSlider('ps-contrast-slider', 'ps-contrast-val', (v) => { psFilters.contrast = parseInt(v); updateCanvasFilters(); });
    setupFilterSlider('ps-saturation-slider', 'ps-saturate-val', (v) => { psFilters.saturation = parseInt(v); updateCanvasFilters(); });
    setupFilterSlider('ps-warmth-slider', 'ps-warmth-val', (v) => { psFilters.warmth = parseInt(v); updateCanvasFilters(); });
    setupFilterSlider('ps-blur-slider', 'ps-blur-val', (v) => { psFilters.blur = parseInt(v); updateCanvasFilters(); }, 'px');

    const sharpenToggle = document.getElementById('ps-sharpen-toggle');
    if (sharpenToggle) {
        sharpenToggle.onchange = () => {
            psFilters.sharpen = sharpenToggle.checked;
            updateCanvasFilters();
        };
    }

    // Geri Al / İleri Al / Sıfırla
    const undoBtn = document.getElementById('ps-undo-btn');
    if (undoBtn) undoBtn.onclick = undoPhotoStudio;

    const redoBtn = document.getElementById('ps-redo-btn');
    if (redoBtn) redoBtn.onclick = redoPhotoStudio;

    const resetBtn = document.getElementById('ps-reset-btn');
    if (resetBtn) resetBtn.onclick = resetPhotoStudio;

    // Zoom Kontrolleri
    const zoomIn = document.getElementById('ps-zoom-in');
    const zoomOut = document.getElementById('ps-zoom-out');
    const zoomFit = document.getElementById('ps-zoom-fit');
    if (zoomIn) zoomIn.onclick = () => setStudioZoom(psZoom + 0.15);
    if (zoomOut) zoomOut.onclick = () => setStudioZoom(Math.max(0.2, psZoom - 0.15));
    if (zoomFit) zoomFit.onclick = fitStudioZoom;

    // Dışa Aktarma Modalı ve Kaydetme
    const exportBtn = document.getElementById('ps-export-btn');
    if (exportBtn) exportBtn.onclick = openPhotoExportModal;

    const exportQualitySlider = document.getElementById('ps-export-quality');
    const exportQualityVal = document.getElementById('ps-export-quality-val');
    if (exportQualitySlider && exportQualityVal) {
        exportQualitySlider.oninput = () => exportQualityVal.innerText = `%${exportQualitySlider.value}`;
    }

    const confirmExportBtn = document.getElementById('ps-confirm-export-btn');
    if (confirmExportBtn) confirmExportBtn.onclick = executePhotoExport;

    // Gemini AI Butonları
    initGeminiAiStudio();
}

function updateStudioSubbar() {
    document.getElementById('opt-brush-group').style.display = (psActiveTool === 'brush' || psActiveTool === 'retouch' || psActiveTool === 'eraser') ? 'flex' : 'none';
    document.getElementById('opt-text-group').style.display = psActiveTool === 'text' ? 'flex' : 'none';
    document.getElementById('opt-shape-group').style.display = psActiveTool === 'shape' ? 'flex' : 'none';
    document.getElementById('opt-crop-group').style.display = psActiveTool === 'crop' ? 'flex' : 'none';
    document.getElementById('opt-sticker-group').style.display = psActiveTool === 'sticker' ? 'flex' : 'none';
}

function loadPhotoIntoStudio(filePath) {
    if (!filePath) return;
    psLoadedFilePath = filePath;
    const img = new Image();
    img.onload = () => {
        psOriginalImage = img;
        psMainCanvas.width = img.naturalWidth || img.width;
        psMainCanvas.height = img.naturalHeight || img.height;
        psOverlayCanvas.width = psMainCanvas.width;
        psOverlayCanvas.height = psMainCanvas.height;

        psMainCtx.clearRect(0, 0, psMainCanvas.width, psMainCanvas.height);
        psMainCtx.drawImage(img, 0, 0);

        document.getElementById('ps-dropzone').style.display = 'none';
        document.getElementById('ps-canvas-wrapper').style.display = 'block';
        document.getElementById('ps-image-dims').innerText = `Boyut: ${psMainCanvas.width} x ${psMainCanvas.height}`;

        psUndoStack = [];
        psRedoStack = [];
        saveStudioHistory();
        resetPhotoFilters();
        fitStudioZoom();
        showToast("Fotoğraf stüdyoya yüklendi.", "success");
    };
    img.src = `file://${filePath}`;
}

function getCanvasCoords(e) {
    const rect = psOverlayCanvas.getBoundingClientRect();
    const scaleX = psMainCanvas.width / rect.width;
    const scaleY = psMainCanvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function onCanvasMouseDown(e) {
    if (!psOriginalImage) return;
    const { x, y } = getCanvasCoords(e);
    psIsDrawing = true;
    psStartX = x;
    psStartY = y;
    psLastX = x;
    psLastY = y;

    if (psActiveTool === 'brush' || psActiveTool === 'eraser' || psActiveTool === 'retouch') {
        saveStudioHistory();
        drawBrushPoint(x, y);
    } else if (psActiveTool === 'text') {
        const text = document.getElementById('ps-text-input').value.trim();
        if (text) {
            saveStudioHistory();
            renderStudioText(text, x, y);
        }
    } else if (psActiveTool === 'sticker') {
        if (psStickerImg) {
            saveStudioHistory();
            renderStudioSticker(x, y);
        } else {
            showToast("Lütfen önce üst çubuktan bir logo/çıkartma seçin!", "info");
        }
    }
}

function onCanvasMouseMove(e) {
    if (!psOriginalImage) return;
    const { x, y } = getCanvasCoords(e);
    document.getElementById('ps-cursor-pos').innerText = `İmleç: ${Math.round(x)}, ${Math.round(y)}`;

    if (!psIsDrawing) return;

    if (psActiveTool === 'brush' || psActiveTool === 'eraser') {
        drawBrushLine(psLastX, psLastY, x, y);
        psLastX = x;
        psLastY = y;
    } else if (psActiveTool === 'retouch') {
        applyRetouchSpot(x, y);
        psLastX = x;
        psLastY = y;
    } else if (psActiveTool === 'shape') {
        drawShapePreview(psStartX, psStartY, x, y);
    } else if (psActiveTool === 'crop') {
        drawCropPreview(psStartX, psStartY, x, y);
    }
}

function onCanvasMouseUp(e) {
    if (!psIsDrawing) return;
    psIsDrawing = false;
    const { x, y } = getCanvasCoords(e);

    if (psActiveTool === 'shape') {
        saveStudioHistory();
        commitShape(psStartX, psStartY, x, y);
        clearOverlay();
    }
}

function drawBrushPoint(x, y) {
    const size = parseInt(document.getElementById('ps-brush-size').value) || 18;
    const opacity = (parseInt(document.getElementById('ps-brush-opacity').value) || 100) / 100;
    const color = document.getElementById('ps-color-picker').value;

    psMainCtx.save();
    psMainCtx.globalAlpha = opacity;
    if (psActiveTool === 'eraser') {
        psMainCtx.globalCompositeOperation = 'destination-out';
    } else {
        psMainCtx.globalCompositeOperation = 'source-over';
        psMainCtx.fillStyle = color;
    }
    psMainCtx.beginPath();
    psMainCtx.arc(x, y, size / 2, 0, Math.PI * 2);
    psMainCtx.fill();
    psMainCtx.restore();
}

function drawBrushLine(x1, y1, x2, y2) {
    const size = parseInt(document.getElementById('ps-brush-size').value) || 18;
    const opacity = (parseInt(document.getElementById('ps-brush-opacity').value) || 100) / 100;
    const color = document.getElementById('ps-color-picker').value;

    psMainCtx.save();
    psMainCtx.globalAlpha = opacity;
    psMainCtx.lineWidth = size;
    psMainCtx.lineCap = 'round';
    psMainCtx.lineJoin = 'round';

    if (psActiveTool === 'eraser') {
        psMainCtx.globalCompositeOperation = 'destination-out';
    } else {
        psMainCtx.globalCompositeOperation = 'source-over';
        psMainCtx.strokeStyle = color;
    }

    psMainCtx.beginPath();
    psMainCtx.moveTo(x1, y1);
    psMainCtx.lineTo(x2, y2);
    psMainCtx.stroke();
    psMainCtx.restore();
}

// Leke & Yumuşatma Rötuş Aracı (Spot Retouch & Soft Blur)
function applyRetouchSpot(x, y) {
    const size = parseInt(document.getElementById('ps-brush-size').value) || 24;
    const radius = Math.max(4, Math.round(size / 2));
    const startX = Math.max(0, Math.round(x - radius));
    const startY = Math.max(0, Math.round(y - radius));
    const w = Math.min(radius * 2, psMainCanvas.width - startX);
    const h = Math.min(radius * 2, psMainCanvas.height - startY);

    if (w <= 2 || h <= 2) return;

    try {
        const imgData = psMainCtx.getImageData(startX, startY, w, h);
        const d = imgData.data;

        // Yumuşatma / Ortalama Blur Algoritması
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let i = 0; i < d.length; i += 4) {
            rSum += d[i];
            gSum += d[i + 1];
            bSum += d[i + 2];
            count++;
        }
        const avgR = rSum / count;
        const avgG = gSum / count;
        const avgB = bSum / count;

        // Dairesel yumuşak geçişli leke harmanlama
        for (let py = 0; py < h; py++) {
            for (let px = 0; px < w; px++) {
                const dist = Math.hypot(px - radius, py - radius);
                if (dist <= radius) {
                    const idx = (py * w + px) * 4;
                    const factor = Math.cos((dist / radius) * (Math.PI / 2)) * 0.35; // Yumuşak merkez harmanı
                    d[idx] = d[idx] * (1 - factor) + avgR * factor;
                    d[idx + 1] = d[idx + 1] * (1 - factor) + avgG * factor;
                    d[idx + 2] = d[idx + 2] * (1 - factor) + avgB * factor;
                }
            }
        }
        psMainCtx.putImageData(imgData, startX, startY);
    } catch(e) {}
}

function renderStudioText(text, x, y) {
    const font = document.getElementById('ps-font-family').value;
    const size = parseInt(document.getElementById('ps-font-size').value) || 36;
    const color = document.getElementById('ps-font-color').value;
    const hasBg = document.getElementById('ps-text-bg-check').checked;

    psMainCtx.save();
    psMainCtx.font = `bold ${size}px ${font}`;
    psMainCtx.textBaseline = 'middle';
    psMainCtx.textAlign = 'center';

    const metrics = psMainCtx.measureText(text);
    const textWidth = metrics.width;
    const padX = 14;
    const padY = 8;

    if (hasBg) {
        psMainCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        const boxX = x - (textWidth / 2) - padX;
        const boxY = y - (size / 2) - padY;
        const boxW = textWidth + (padX * 2);
        const boxH = size + (padY * 2);
        roundRect(psMainCtx, boxX, boxY, boxW, boxH, 8, true, false);
    }

    // İnce gölge
    psMainCtx.shadowColor = 'rgba(0,0,0,0.8)';
    psMainCtx.shadowBlur = 4;
    psMainCtx.fillStyle = color;
    psMainCtx.fillText(text, x, y);
    psMainCtx.restore();
}

function renderStudioSticker(x, y) {
    const scale = (parseInt(document.getElementById('ps-sticker-scale').value) || 50) / 100;
    const opacity = (parseInt(document.getElementById('ps-sticker-opacity').value) || 100) / 100;
    const w = psStickerImg.width * scale;
    const h = psStickerImg.height * scale;

    psMainCtx.save();
    psMainCtx.globalAlpha = opacity;
    psMainCtx.drawImage(psStickerImg, x - (w / 2), y - (h / 2), w, h);
    psMainCtx.restore();
}

function drawShapePreview(x1, y1, x2, y2) {
    clearOverlay();
    const type = document.getElementById('ps-shape-type').value;
    const color = document.getElementById('ps-color-picker').value;
    const width = parseInt(document.getElementById('ps-shape-width').value) || 4;

    psOverlayCtx.save();
    psOverlayCtx.strokeStyle = color;
    psOverlayCtx.fillStyle = color;
    psOverlayCtx.lineWidth = width;

    if (type === 'rect') {
        psOverlayCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (type === 'rect-fill') {
        psOverlayCtx.globalAlpha = 0.8;
        psOverlayCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
    } else if (type === 'circle') {
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        psOverlayCtx.beginPath();
        psOverlayCtx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        psOverlayCtx.stroke();
    } else if (type === 'line') {
        psOverlayCtx.beginPath();
        psOverlayCtx.moveTo(x1, y1);
        psOverlayCtx.lineTo(x2, y2);
        psOverlayCtx.stroke();
    } else if (type === 'arrow') {
        drawArrow(psOverlayCtx, x1, y1, x2, y2, width);
    }
    psOverlayCtx.restore();
}

function commitShape(x1, y1, x2, y2) {
    const type = document.getElementById('ps-shape-type').value;
    const color = document.getElementById('ps-color-picker').value;
    const width = parseInt(document.getElementById('ps-shape-width').value) || 4;

    psMainCtx.save();
    psMainCtx.strokeStyle = color;
    psMainCtx.fillStyle = color;
    psMainCtx.lineWidth = width;

    if (type === 'rect') {
        psMainCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    } else if (type === 'rect-fill') {
        psMainCtx.globalAlpha = 0.85;
        psMainCtx.fillRect(x1, y1, x2 - x1, y2 - y1);
    } else if (type === 'circle') {
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        psMainCtx.beginPath();
        psMainCtx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        psMainCtx.stroke();
    } else if (type === 'line') {
        psMainCtx.beginPath();
        psMainCtx.moveTo(x1, y1);
        psMainCtx.lineTo(x2, y2);
        psMainCtx.stroke();
    } else if (type === 'arrow') {
        drawArrow(psMainCtx, x1, y1, x2, y2, width);
    }
    psMainCtx.restore();
}

function drawArrow(ctx, fromx, fromy, tox, toy, lineWidth) {
    const headlen = Math.max(12, lineWidth * 4);
    const angle = Math.atan2(toy - fromy, tox - fromx);
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

function drawCropPreview(x1, y1, x2, y2) {
    clearOverlay();
    const ratio = document.getElementById('ps-crop-ratio').value;
    let w = x2 - x1;
    let h = y2 - y1;

    if (ratio === '1:1') {
        const size = Math.max(Math.abs(w), Math.abs(h));
        w = w >= 0 ? size : -size;
        h = h >= 0 ? size : -size;
    } else if (ratio === '16:9') {
        const targetH = Math.abs(w) * (9 / 16);
        h = h >= 0 ? targetH : -targetH;
    } else if (ratio === '4:3') {
        const targetH = Math.abs(w) * (3 / 4);
        h = h >= 0 ? targetH : -targetH;
    } else if (ratio === '9:16') {
        const targetH = Math.abs(w) * (16 / 9);
        h = h >= 0 ? targetH : -targetH;
    }

    const rx = w >= 0 ? x1 : x1 + w;
    const ry = h >= 0 ? y1 : y1 + h;
    const rw = Math.abs(w);
    const rh = Math.abs(h);

    psCropRect = { x: rx, y: ry, w: rw, h: rh };

    // Karartma maskesi
    psOverlayCtx.save();
    psOverlayCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    psOverlayCtx.fillRect(0, 0, psOverlayCanvas.width, psOverlayCanvas.height);

    // Kırpma alanını şeffaf bırak
    psOverlayCtx.clearRect(rx, ry, rw, rh);

    // Kırpma çerçevesi ve kılavuz çizgileri
    psOverlayCtx.strokeStyle = '#38bdf8';
    psOverlayCtx.lineWidth = 2;
    psOverlayCtx.strokeRect(rx, ry, rw, rh);

    // Üçte bir kuralı kılavuzları
    psOverlayCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    psOverlayCtx.lineWidth = 1;
    psOverlayCtx.beginPath();
    psOverlayCtx.moveTo(rx + rw / 3, ry);
    psOverlayCtx.lineTo(rx + rw / 3, ry + rh);
    psOverlayCtx.moveTo(rx + (rw * 2) / 3, ry);
    psOverlayCtx.lineTo(rx + (rw * 2) / 3, ry + rh);
    psOverlayCtx.moveTo(rx, ry + rh / 3);
    psOverlayCtx.lineTo(rx + rw, ry + rh / 3);
    psOverlayCtx.moveTo(rx, ry + (rh * 2) / 3);
    psOverlayCtx.lineTo(rx + rw, ry + (rh * 2) / 3);
    psOverlayCtx.stroke();
    psOverlayCtx.restore();
}

function executePhotoCrop() {
    if (!psCropRect || psCropRect.w < 10 || psCropRect.h < 10) {
        showToast("Lütfen önce tuval üzerinde kırpmak istediğiniz alanı seçin.", "error");
        return;
    }
    saveStudioHistory();

    const croppedData = psMainCtx.getImageData(psCropRect.x, psCropRect.y, psCropRect.w, psCropRect.h);
    psMainCanvas.width = psCropRect.w;
    psMainCanvas.height = psCropRect.h;
    psOverlayCanvas.width = psCropRect.w;
    psOverlayCanvas.height = psCropRect.h;

    psMainCtx.putImageData(croppedData, 0, 0);
    clearOverlay();
    psCropRect = null;
    document.getElementById('ps-image-dims').innerText = `Boyut: ${psMainCanvas.width} x ${psMainCanvas.height}`;
    fitStudioZoom();
    showToast("Görsel başarıyla kırpıldı.", "success");
}

function clearOverlay() {
    if (psOverlayCtx && psOverlayCanvas) {
        psOverlayCtx.clearRect(0, 0, psOverlayCanvas.width, psOverlayCanvas.height);
    }
}

// Canlı Filtreler ve Görsel İşleme
function updateCanvasFilters() {
    const b = 1 + (psFilters.brightness / 100);
    const c = 1 + (psFilters.contrast / 100);
    const s = 1 + (psFilters.saturation / 100);
    const blur = psFilters.blur;
    const gs = psFilters.grayscale ? 100 : 0;
    const sep = psFilters.sepia ? 100 : 0;
    const inv = psFilters.invert ? 100 : 0;

    let filterStr = `brightness(${b}) contrast(${c}) saturate(${s}) blur(${blur}px) grayscale(${gs}%) sepia(${sep}%) invert(${inv}%)`;
    if (psFilters.warmth !== 0) {
        const hue = psFilters.warmth > 0 ? (psFilters.warmth * 0.15) : (psFilters.warmth * 0.2);
        filterStr += ` hue-rotate(${hue}deg)`;
    }

    psMainCanvas.style.filter = filterStr;
}

function setupFilterSlider(id, valId, callback, suffix = '') {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    if (el && valEl) {
        el.oninput = () => {
            valEl.innerText = `${el.value}${suffix}`;
            callback(el.value);
        };
    }
}

window.applyPhotoPreset = function(name) {
    if (name === 'normal') {
        resetPhotoFilters();
    } else if (name === 'bw') {
        psFilters.grayscale = true;
        psFilters.sepia = false;
        psFilters.contrast = 20;
    } else if (name === 'sepia') {
        psFilters.sepia = true;
        psFilters.grayscale = false;
        psFilters.warmth = 20;
    } else if (name === 'vintage') {
        psFilters.sepia = true;
        psFilters.contrast = 15;
        psFilters.saturation = -20;
        psFilters.brightness = 5;
    } else if (name === 'vivid') {
        psFilters.saturation = 35;
        psFilters.contrast = 15;
        psFilters.brightness = 5;
    } else if (name === 'cool') {
        psFilters.warmth = -30;
        psFilters.contrast = 10;
    } else if (name === 'warm') {
        psFilters.warmth = 30;
        psFilters.saturation = 15;
    } else if (name === 'invert') {
        psFilters.invert = !psFilters.invert;
    }

    syncFilterSlidersToState();
    updateCanvasFilters();
    showToast(`"${name}" filtresi uygulandı.`, "info");
};

function resetPhotoFilters() {
    psFilters = {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        warmth: 0,
        blur: 0,
        sharpen: false,
        grayscale: false,
        sepia: false,
        invert: false
    };
    syncFilterSlidersToState();
    updateCanvasFilters();
}

function syncFilterSlidersToState() {
    setSlider('ps-brightness-slider', 'ps-bright-val', psFilters.brightness);
    setSlider('ps-contrast-slider', 'ps-contrast-val', psFilters.contrast);
    setSlider('ps-saturation-slider', 'ps-saturate-val', psFilters.saturation);
    setSlider('ps-warmth-slider', 'ps-warmth-val', psFilters.warmth);
    setSlider('ps-blur-slider', 'ps-blur-val', psFilters.blur, 'px');
    const sharp = document.getElementById('ps-sharpen-toggle');
    if (sharp) sharp.checked = psFilters.sharpen;
}

function setSlider(id, valId, value, suffix = '') {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    if (el) el.value = value;
    if (valEl) valEl.innerText = `${value}${suffix}`;
}

window.rotatePhotoCanvas = function(deg) {
    if (!psOriginalImage) return;
    saveStudioHistory();

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const is90or270 = Math.abs(deg) === 90 || Math.abs(deg) === 270;

    tempCanvas.width = is90or270 ? psMainCanvas.height : psMainCanvas.width;
    tempCanvas.height = is90or270 ? psMainCanvas.width : psMainCanvas.height;

    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate((deg * Math.PI) / 180);
    tempCtx.drawImage(psMainCanvas, -psMainCanvas.width / 2, -psMainCanvas.height / 2);

    psMainCanvas.width = tempCanvas.width;
    psMainCanvas.height = tempCanvas.height;
    psOverlayCanvas.width = tempCanvas.width;
    psOverlayCanvas.height = tempCanvas.height;

    psMainCtx.clearRect(0, 0, psMainCanvas.width, psMainCanvas.height);
    psMainCtx.drawImage(tempCanvas, 0, 0);

    document.getElementById('ps-image-dims').innerText = `Boyut: ${psMainCanvas.width} x ${psMainCanvas.height}`;
    fitStudioZoom();
    showToast(`Tuval ${deg}° döndürüldü.`, "info");
};

window.flipPhotoCanvas = function(axis) {
    if (!psOriginalImage) return;
    saveStudioHistory();

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = psMainCanvas.width;
    tempCanvas.height = psMainCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.translate(axis === 'h' ? tempCanvas.width : 0, axis === 'v' ? tempCanvas.height : 0);
    tempCtx.scale(axis === 'h' ? -1 : 1, axis === 'v' ? -1 : 1);
    tempCtx.drawImage(psMainCanvas, 0, 0);

    psMainCtx.clearRect(0, 0, psMainCanvas.width, psMainCanvas.height);
    psMainCtx.drawImage(tempCanvas, 0, 0);
    showToast(`Görsel ${axis === 'h' ? 'yatay' : 'dikey'} çevrildi.`, "info");
};

function saveStudioHistory() {
    if (!psMainCanvas) return;
    psUndoStack.push(psMainCanvas.toDataURL('image/png'));
    if (psUndoStack.length > 25) psUndoStack.shift();
    psRedoStack = [];
}

function undoPhotoStudio() {
    if (psUndoStack.length <= 1) {
        showToast("Geri alınacak başka adım yok.", "info");
        return;
    }
    const current = psUndoStack.pop();
    psRedoStack.push(current);
    const prevDataUrl = psUndoStack[psUndoStack.length - 1];
    restoreCanvasFromDataUrl(prevDataUrl);
    showToast("Son işlem geri alındı.", "info");
}

function redoPhotoStudio() {
    if (psRedoStack.length === 0) {
        showToast("İleri alınacak adım yok.", "info");
        return;
    }
    const nextDataUrl = psRedoStack.pop();
    psUndoStack.push(nextDataUrl);
    restoreCanvasFromDataUrl(nextDataUrl);
    showToast("İşlem yinelendi.", "info");
}

function resetPhotoStudio() {
    if (!psOriginalImage) return;
    saveStudioHistory();
    psMainCanvas.width = psOriginalImage.naturalWidth || psOriginalImage.width;
    psMainCanvas.height = psOriginalImage.naturalHeight || psOriginalImage.height;
    psOverlayCanvas.width = psMainCanvas.width;
    psOverlayCanvas.height = psMainCanvas.height;
    psMainCtx.clearRect(0, 0, psMainCanvas.width, psMainCanvas.height);
    psMainCtx.drawImage(psOriginalImage, 0, 0);
    resetPhotoFilters();
    fitStudioZoom();
    showToast("Görsel orijinal haline sıfırlandı.", "info");
}

function restoreCanvasFromDataUrl(dataUrl) {
    const img = new Image();
    img.onload = () => {
        psMainCanvas.width = img.width;
        psMainCanvas.height = img.height;
        psOverlayCanvas.width = img.width;
        psOverlayCanvas.height = img.height;
        psMainCtx.clearRect(0, 0, psMainCanvas.width, psMainCanvas.height);
        psMainCtx.drawImage(img, 0, 0);
        document.getElementById('ps-image-dims').innerText = `Boyut: ${img.width} x ${img.height}`;
    };
    img.src = dataUrl;
}

function setStudioZoom(z) {
    psZoom = Math.max(0.1, Math.min(4.0, z));
    const wrapper = document.getElementById('ps-canvas-wrapper');
    if (wrapper) {
        wrapper.style.transform = `scale(${psZoom})`;
        wrapper.style.transformOrigin = 'center center';
    }
    document.getElementById('ps-zoom-val').innerText = `%${Math.round(psZoom * 100)}`;
}

function fitStudioZoom() {
    if (!psMainCanvas) return;
    const viewport = document.getElementById('ps-viewport');
    const availW = viewport.clientWidth - 40;
    const availH = viewport.clientHeight - 40;
    const scaleW = availW / psMainCanvas.width;
    const scaleH = availH / psMainCanvas.height;
    const fitScale = Math.min(1.0, Math.min(scaleW, scaleH));
    setStudioZoom(fitScale);
}

// Dışa Aktarma Modalı
window.openPhotoExportModal = function() {
    if (!psOriginalImage) {
        showToast("Lütfen önce düzenlenecek bir görsel açın!", "error");
        return;
    }
    document.getElementById('ps-export-modal').style.display = 'flex';
};

window.closePhotoExportModal = function() {
    document.getElementById('ps-export-modal').style.display = 'none';
};

async function executePhotoExport() {
    try {
        const format = document.getElementById('ps-export-format').value;
        const quality = parseInt(document.getElementById('ps-export-quality').value) || 90;

        closePhotoExportModal();

        // Filtreleri kalıcı piksellere işleyerek render et
        const renderCanvas = document.createElement('canvas');
        renderCanvas.width = psMainCanvas.width;
        renderCanvas.height = psMainCanvas.height;
        const rCtx = renderCanvas.getContext('2d');

        rCtx.filter = psMainCanvas.style.filter || 'none';
        rCtx.drawImage(psMainCanvas, 0, 0);

        const mime = format === 'jpeg' ? 'image/jpeg' : (format === 'webp' ? 'image/webp' : 'image/png');
        const dataUrl = renderCanvas.toDataURL(mime, quality / 100);

        const res = await window.electronAPI.saveEditedImage({
            base64Data: dataUrl,
            format: format,
            quality: quality
        });

        if (res && res.success) {
            showToast(`Fotoğraf kaydedildi: ${res.path.split(/[\\/]/).pop()}`, "success");
            addRecentConversion(res.path, 'image');
        } else if (res && !res.canceled) {
            showToast(`Kaydetme hatası: ${res.error}`, "error");
        }
    } catch(err) {
        showToast(`Hata: ${err.message}`, "error");
    }
}

// Inspector Sekme Geçişi
window.switchStudioTab = function(tab) {
    document.querySelectorAll('.inspector-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.inspector-content').forEach(c => c.classList.remove('active'));

    const tabBtn = document.getElementById(`tab-btn-${tab}`);
    const tabContent = document.getElementById(`inspector-tab-${tab}`);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
};

// =========================================================================
// ✨ GEMINI VISION YAPAY ZEKA AKILLI RÖTUŞ MODÜLÜ
// =========================================================================

const GEMINI_API_STORAGE_KEY = 'multiconverter_gemini_api_key';

function initGeminiAiStudio() {
    const keyInput = document.getElementById('gemini-api-key-input');
    const saveKeyBtn = document.getElementById('save-gemini-key-btn');
    const keyBadge = document.getElementById('ai-key-badge');

    // Kayıtlı anahtarı yükle
    const savedKey = localStorage.getItem(GEMINI_API_STORAGE_KEY);
    if (savedKey) {
        keyInput.value = savedKey;
        keyBadge.innerText = 'Anahtar Hazır';
        keyBadge.style.background = 'rgba(16,185,129,0.2)';
        keyBadge.style.color = '#34d399';
    }

    if (saveKeyBtn) {
        saveKeyBtn.onclick = () => {
            const key = keyInput.value.trim();
            if (key) {
                localStorage.setItem(GEMINI_API_STORAGE_KEY, key);
                keyBadge.innerText = 'Anahtar Hazır';
                keyBadge.style.background = 'rgba(16,185,129,0.2)';
                keyBadge.style.color = '#34d399';
                showToast("Gemini API anahtarı güvenle kaydedildi!", "success");
            } else {
                localStorage.removeItem(GEMINI_API_STORAGE_KEY);
                keyBadge.innerText = 'Anahtar Yok';
                keyBadge.style.background = 'rgba(239,68,68,0.2)';
                keyBadge.style.color = '#f87171';
                showToast("API anahtarı temizlendi.", "info");
            }
        };
    }

    // AI Otomatik İyileştir Butonu
    const autoEnhanceBtn = document.getElementById('ai-auto-enhance-btn');
    if (autoEnhanceBtn) {
        autoEnhanceBtn.onclick = () => executeAiRetouch('auto_enhance');
    }

    // AI Özel Prompt Butonu
    const customPromptBtn = document.getElementById('ai-custom-prompt-btn');
    if (customPromptBtn) {
        customPromptBtn.onclick = () => {
            const prompt = document.getElementById('ai-custom-prompt-input').value.trim();
            if (!prompt) {
                showToast("Lütfen fotoğrafa uygulanacak rötuş talimatını yazın!", "error");
                return;
            }
            executeAiRetouch('custom_prompt', prompt);
        };
    }

    // AI Başlık / Altyazı Üretme
    const genCaptionsBtn = document.getElementById('ai-gen-captions-btn');
    if (genCaptionsBtn) {
        genCaptionsBtn.onclick = executeAiCaptionGenerator;
    }
}

function getGeminiApiKey() {
    return localStorage.getItem(GEMINI_API_STORAGE_KEY) || document.getElementById('gemini-api-key-input').value.trim();
}

async function executeAiRetouch(mode, promptText = '') {
    if (!psOriginalImage) {
        showToast("Lütfen önce bir fotoğraf yükleyin!", "error");
        return;
    }
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        showToast("Lütfen önce Google Gemini API anahtarınızı girin!", "error");
        switchStudioTab('ai');
        document.getElementById('gemini-api-key-input').focus();
        return;
    }

    showToast("Gemini AI fotoğrafı inceliyor ve en uygun rötuş parametrelerini hesaplıyor...", "info");

    try {
        // İletim boyutunu hafifletmek için geçici küçük canvas oluştur
        const thumbCanvas = document.createElement('canvas');
        const maxDim = 1200;
        const scale = Math.min(1, maxDim / Math.max(psMainCanvas.width, psMainCanvas.height));
        thumbCanvas.width = Math.round(psMainCanvas.width * scale);
        thumbCanvas.height = Math.round(psMainCanvas.height * scale);
        const tCtx = thumbCanvas.getContext('2d');
        tCtx.drawImage(psMainCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        const imageBase64 = thumbCanvas.toDataURL('image/jpeg', 0.85);

        const res = await window.electronAPI.geminiAiRetouch({
            apiKey,
            imageBase64,
            mode,
            customPrompt: promptText
        });

        if (!res || !res.success) {
            showToast(`Gemini AI Hatası: ${res ? res.error : 'Bağlantı kurulamadı'}`, "error");
            return;
        }

        const data = res.data;
        if (typeof data.brightness === 'number') psFilters.brightness = data.brightness;
        if (typeof data.contrast === 'number') psFilters.contrast = data.contrast;
        if (typeof data.saturation === 'number') psFilters.saturation = data.saturation;
        if (typeof data.warmth === 'number') psFilters.warmth = data.warmth;
        if (typeof data.blur === 'number') psFilters.blur = data.blur;
        if (typeof data.grayscale === 'boolean') psFilters.grayscale = data.grayscale;
        if (typeof data.sepia === 'boolean') psFilters.sepia = data.sepia;
        if (typeof data.invert === 'boolean') psFilters.invert = data.invert;
        if (typeof data.sharpen === 'boolean') psFilters.sharpen = data.sharpen;

        syncFilterSlidersToState();
        updateCanvasFilters();

        // Açıklama kutusu
        const feedbackBox = document.getElementById('ai-feedback-box');
        const feedbackText = document.getElementById('ai-feedback-text');
        if (feedbackBox && feedbackText && data.explanation) {
            feedbackBox.style.display = 'block';
            feedbackText.innerText = data.explanation;
        }

        showToast("✨ Gemini AI akıllı rötuş başarıyla uygulandı!", "success");
    } catch(err) {
        showToast(`AI İşlem Hatası: ${err.message}`, "error");
    }
}

window.executeAiRetouchPrompt = function(presetPrompt) {
    document.getElementById('ai-custom-prompt-input').value = presetPrompt;
    executeAiRetouch('custom_prompt', presetPrompt);
};

async function executeAiCaptionGenerator() {
    if (!psOriginalImage) {
        showToast("Lütfen önce bir fotoğraf yükleyin!", "error");
        return;
    }
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        showToast("Lütfen Gemini API anahtarınızı girin!", "error");
        return;
    }

    showToast("Gemini görsel için yaratıcı başlıklar ve tipografiler üretiyor...", "info");

    try {
        const thumbCanvas = document.createElement('canvas');
        const maxDim = 800;
        const scale = Math.min(1, maxDim / Math.max(psMainCanvas.width, psMainCanvas.height));
        thumbCanvas.width = Math.round(psMainCanvas.width * scale);
        thumbCanvas.height = Math.round(psMainCanvas.height * scale);
        const tCtx = thumbCanvas.getContext('2d');
        tCtx.drawImage(psMainCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        const imageBase64 = thumbCanvas.toDataURL('image/jpeg', 0.8);

        const res = await window.electronAPI.geminiAiRetouch({
            apiKey,
            imageBase64,
            mode: 'creative_caption'
        });

        if (!res || !res.success || !res.data) {
            showToast(`Başlık üretilemedi: ${res ? res.error : ''}`, "error");
            return;
        }

        const container = document.getElementById('ai-captions-container');
        container.innerHTML = '';

        if (res.data.suggestions && Array.isArray(res.data.suggestions)) {
            res.data.suggestions.forEach(item => {
                const btn = document.createElement('button');
                btn.className = 'ai-style-pill';
                btn.style.borderColor = 'rgba(56,189,248,0.4)';
                btn.innerHTML = `<b>"${item.title}"</b><br><span style="font-size:0.75rem; color:#94a3b8;">${item.subtitle || ''}</span>`;
                btn.onclick = () => {
                    // Seçilen başlığı tuvale ekle
                    saveStudioHistory();
                    document.getElementById('ps-text-input').value = item.title;
                    if (item.font) document.getElementById('ps-font-family').value = item.font;
                    if (item.color) document.getElementById('ps-font-color').value = item.color;
                    renderStudioText(item.title, psMainCanvas.width / 2, psMainCanvas.height * 0.85);
                    showToast(`"${item.title}" başlığı fotoğrafa yerleştirildi!`, "success");
                };
                container.appendChild(btn);
            });
        }

        if (res.data.photoInsight) {
            const feedbackBox = document.getElementById('ai-feedback-box');
            const feedbackText = document.getElementById('ai-feedback-text');
            if (feedbackBox && feedbackText) {
                feedbackBox.style.display = 'block';
                feedbackText.innerText = `💡 Kompozisyon Notu: ${res.data.photoInsight}`;
            }
        }

        showToast("3 farklı yaratıcı başlık önerildi! Eklemek için birine tıklayın.", "success");
    } catch(err) {
        showToast(`AI Başlık Hatası: ${err.message}`, "error");
    }
}

// Yardımcı Yuvarlatılmış Dikdörtgen Çizici
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof radius === 'number') {
        radius = { tl: radius, tr: radius, br: radius, bl: radius };
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

// =========================================================================
// ✂️ YENİ ÖZELLİK 2: VİDEO & SES STÜDYOSU (Timeline Editor & Lab)
// =========================================================================

let vsSelectedVideoPath = null;
let asSelectedAudioPath = null;
let vsSecondaryMusicPath = null;
let asSecondaryAudioPath = null;
let vsVideoDuration = 0;
let vsRotation = 0;
let vsFlipH = false;

function initMediaStudio() {
    // 1. Video Düzenleyici Başlatma
    const videoDropzone = document.getElementById('vs-video-dropzone');
    if (videoDropzone) {
        setupFilePicker('vs-video-dropzone', (filePath) => loadVideoIntoStudio(filePath), [
            { name: 'Video Dosyaları', extensions: ['mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv', 'ts', 'ogv', '3gp'] }
        ]);
    }

    const videoEl = document.getElementById('vs-video-element');
    if (videoEl) {
        videoEl.ontimeupdate = () => {
            const cur = formatTimecode(videoEl.currentTime);
            const dur = formatTimecode(videoEl.duration || 0);
            document.getElementById('vs-current-timecode').innerText = `${cur} / ${dur}`;
        };
        videoEl.onloadedmetadata = () => {
            vsVideoDuration = videoEl.duration || 0;
            document.getElementById('vs-trim-end-input').placeholder = vsVideoDuration.toFixed(1);
        };
    }

    // Video Kırpma Butonları
    const setStartBtn = document.getElementById('vs-set-start-btn');
    if (setStartBtn) {
        setStartBtn.onclick = () => {
            if (!videoEl) return;
            document.getElementById('vs-trim-start-input').value = videoEl.currentTime.toFixed(1);
            showToast(`Kırpma başlangıcı ayarlandı: ${videoEl.currentTime.toFixed(1)} sn`, "info");
        };
    }

    const setEndBtn = document.getElementById('vs-set-end-btn');
    if (setEndBtn) {
        setEndBtn.onclick = () => {
            if (!videoEl) return;
            document.getElementById('vs-trim-end-input').value = videoEl.currentTime.toFixed(1);
            showToast(`Kırpma bitişi ayarlandı: ${videoEl.currentTime.toFixed(1)} sn`, "info");
        };
    }

    const previewTrimBtn = document.getElementById('vs-preview-trim-btn');
    if (previewTrimBtn) {
        previewTrimBtn.onclick = () => {
            if (!videoEl) return;
            const start = parseFloat(document.getElementById('vs-trim-start-input').value) || 0;
            videoEl.currentTime = start;
            videoEl.play();
        };
    }

    // Video Efektleri Slider Dinleyicileri (Canlı Video Önizlemesi)
    setupFilterSlider('vs-bright-slider', 'vs-bright-val', () => updateLiveVideoFilter());
    setupFilterSlider('vs-contrast-slider', 'vs-contrast-val', () => updateLiveVideoFilter());
    setupFilterSlider('vs-saturate-slider', 'vs-saturate-val', () => updateLiveVideoFilter());

    const gsCheck = document.getElementById('vs-filter-grayscale');
    if (gsCheck) gsCheck.onchange = () => updateLiveVideoFilter();

    const sepCheck = document.getElementById('vs-filter-sepia');
    if (sepCheck) sepCheck.onchange = () => updateLiveVideoFilter();

    const speedSelect = document.getElementById('vs-speed-select');
    if (speedSelect) {
        speedSelect.onchange = () => {
            if (videoEl) videoEl.playbackRate = parseFloat(speedSelect.value) || 1.0;
        };
    }

    // Döndürme & Aynalama
    const rotBtn = document.getElementById('vs-rot-90-btn');
    if (rotBtn) {
        rotBtn.onclick = () => {
            vsRotation = (vsRotation + 90) % 360;
            updateLiveVideoFilter();
            showToast(`Video ${vsRotation}° döndürüldü.`, "info");
        };
    }

    const flipBtn = document.getElementById('vs-flip-h-btn');
    if (flipBtn) {
        flipBtn.onclick = () => {
            vsFlipH = !vsFlipH;
            updateLiveVideoFilter();
            showToast(`Aynalama ${vsFlipH ? 'aktif' : 'kapalı'}.`, "info");
        };
    }

    // Ses Seçenekleri
    const audioModeSelect = document.getElementById('vs-audio-mode');
    const secAudioGroup = document.getElementById('vs-secondary-audio-group');
    if (audioModeSelect && secAudioGroup) {
        audioModeSelect.onchange = () => {
            const m = audioModeSelect.value;
            secAudioGroup.style.display = (m === 'replace' || m === 'mix') ? 'block' : 'none';
        };
    }

    const pickMusicBtn = document.getElementById('vs-pick-music-btn');
    if (pickMusicBtn) {
        pickMusicBtn.onclick = async () => {
            const path = await window.electronAPI.openFileDialog([
                { name: 'Ses / Müzik', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'] }
            ]);
            if (path) {
                vsSecondaryMusicPath = path;
                document.getElementById('vs-music-file-name').innerText = path.split(/[\\/]/).pop();
                showToast("Arka plan müziği eklendi.", "info");
            }
        };
    }

    const musicVolSlider = document.getElementById('vs-music-vol-slider');
    const musicVolVal = document.getElementById('vs-music-vol-val');
    if (musicVolSlider && musicVolVal) {
        musicVolSlider.oninput = () => musicVolVal.innerText = `%${musicVolSlider.value}`;
    }

    // Gemini AI Video Karesi Analizi
    const geminiFrameBtn = document.getElementById('vs-gemini-analyze-frame-btn');
    if (geminiFrameBtn) {
        geminiFrameBtn.onclick = analyzeVideoFrameWithGemini;
    }

    // Videoyu İşle ve Dışa Aktar Butonu
    const renderVideoBtn = document.getElementById('vs-render-video-btn');
    if (renderVideoBtn) {
        renderVideoBtn.onclick = executeVideoRender;
    }

    // IPC Dinleyicileri
    window.electronAPI.onVideoEditProgress((p) => {
        const pBox = document.getElementById('vs-progress-box');
        const pBar = document.getElementById('vs-progress-bar');
        const pStage = document.getElementById('vs-progress-stage');
        const pPercent = document.getElementById('vs-progress-percent');
        const pTime = document.getElementById('vs-progress-timemark');
        const pFps = document.getElementById('vs-progress-fps');

        if (pBox) pBox.style.display = 'block';
        if (pBar && p.percent != null) pBar.style.width = `${p.percent}%`;
        if (pPercent && p.percent != null) pPercent.innerText = `%${Math.round(p.percent)}`;
        if (pStage && p.stage) pStage.innerText = p.stage;
        if (pTime && p.timemark) pTime.innerText = `⏱️ Süre: ${p.timemark}`;
        if (pFps && p.fps) pFps.innerText = `⚡ FPS: ${p.fps}`;
    });

    window.electronAPI.onVideoEditDone((outPath) => {
        document.getElementById('vs-progress-box').style.display = 'none';
        showToast(`Video başarıyla düzenlendi ve kaydedildi: ${outPath.split(/[\\/]/).pop()}`, "success");
        addRecentConversion(outPath, 'video');
    });

    window.electronAPI.onVideoEditError((err) => {
        document.getElementById('vs-progress-box').style.display = 'none';
        showToast(`Video işleme hatası: ${err}`, "error");
    });

    // 2. Ses Düzenleyici Başlatma
    initAudioLab();
}

function updateLiveVideoFilter() {
    const videoEl = document.getElementById('vs-video-element');
    if (!videoEl) return;

    const b = 1 + ((parseFloat(document.getElementById('vs-bright-slider').value) || 0) / 100);
    const c = 1 + ((parseFloat(document.getElementById('vs-contrast-slider').value) || 0) / 100);
    const s = 1 + ((parseFloat(document.getElementById('vs-saturate-slider').value) || 0) / 100);
    const gs = document.getElementById('vs-filter-grayscale').checked ? 100 : 0;
    const sep = document.getElementById('vs-filter-sepia').checked ? 100 : 0;

    videoEl.style.filter = `brightness(${b}) contrast(${c}) saturate(${s}) grayscale(${gs}%) sepia(${sep}%)`;
    videoEl.style.transform = `rotate(${vsRotation}deg) scaleX(${vsFlipH ? -1 : 1})`;
}

async function loadVideoIntoStudio(filePath) {
    if (!filePath) return;
    vsSelectedVideoPath = filePath;
    const baseName = filePath.split(/[\\/]/).pop();

    const infoEl = document.getElementById('vs-video-info');
    infoEl.style.display = 'block';
    infoEl.innerText = `Seçilen Video: ${baseName}`;

    const playerContainer = document.getElementById('vs-player-container');
    const controlsContainer = document.getElementById('vs-controls-container');
    const videoEl = document.getElementById('vs-video-element');

    playerContainer.style.display = 'block';
    controlsContainer.style.display = 'grid';

    videoEl.src = `file://${filePath}`;

    // Chromium'un doğrudan oynatamadığı formatlar için önbellek hazırlığı
    try {
        const res = await window.electronAPI.preparePlayableMedia(filePath);
        if (res && res.success && res.url) {
            videoEl.src = res.url;
        }
    } catch(e) {}

    showToast("Video stüdyoya yüklendi.", "success");
}

async function analyzeVideoFrameWithGemini() {
    if (!vsSelectedVideoPath) {
        showToast("Lütfen önce bir video yükleyin!", "error");
        return;
    }
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        showToast("Lütfen önce Gemini API anahtarınızı girin!", "error");
        switchStudioTab('ai');
        return;
    }

    const videoEl = document.getElementById('vs-video-element');
    const timestamp = videoEl ? videoEl.currentTime : 1;

    showToast("O anki video karesi yakalanıyor ve Gemini AI tarafından analiz ediliyor...", "info");

    try {
        const thumbRes = await window.electronAPI.extractVideoThumbnail({
            filePath: vsSelectedVideoPath,
            timestamp: timestamp
        });

        if (!thumbRes || !thumbRes.success) {
            showToast("Video karesi yakalanamadı.", "error");
            return;
        }

        const aiRes = await window.electronAPI.geminiAiRetouch({
            apiKey,
            imageBase64: thumbRes.base64,
            mode: 'auto_enhance'
        });

        if (!aiRes || !aiRes.success || !aiRes.data) {
            showToast(`AI Analiz hatası: ${aiRes ? aiRes.error : ''}`, "error");
            return;
        }

        const d = aiRes.data;
        if (typeof d.brightness === 'number') document.getElementById('vs-bright-slider').value = Math.max(-50, Math.min(50, d.brightness));
        if (typeof d.contrast === 'number') document.getElementById('vs-contrast-slider').value = Math.max(-50, Math.min(50, d.contrast));
        if (typeof d.saturation === 'number') document.getElementById('vs-saturate-slider').value = Math.max(-50, Math.min(50, d.saturation));

        document.getElementById('vs-bright-val').innerText = document.getElementById('vs-bright-slider').value;
        document.getElementById('vs-contrast-val').innerText = document.getElementById('vs-contrast-slider').value;
        document.getElementById('vs-saturate-val').innerText = document.getElementById('vs-saturate-slider').value;

        updateLiveVideoFilter();

        const resultBox = document.getElementById('vs-gemini-frame-result');
        if (resultBox) {
            resultBox.style.display = 'block';
            resultBox.innerHTML = `✅ <b>Gemini Tavsiyesi:</b> ${d.explanation || 'Optimum parlaklık ve kontrast dengelendi.'}`;
        }

        showToast("✨ Video karesi analiz edildi ve renk ayarları uygulandı!", "success");
    } catch(err) {
        showToast(`Hata: ${err.message}`, "error");
    }
}

async function executeVideoRender() {
    if (!vsSelectedVideoPath) {
        showToast("Lütfen önce bir video seçin!", "error");
        return;
    }

    const format = document.getElementById('vs-output-format').value;
    const targetPath = await window.electronAPI.saveFileDialog(format);
    if (!targetPath) return;

    // Overlay Metin Tuvali Oluştur
    const text = document.getElementById('vs-overlay-text').value.trim();
    let overlayPngBase64 = null;

    if (text) {
        const videoEl = document.getElementById('vs-video-element');
        const vW = videoEl.videoWidth || 1920;
        const vH = videoEl.videoHeight || 1080;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = vW;
        offCanvas.height = vH;
        const oCtx = offCanvas.getContext('2d');

        const fontSize = parseInt(document.getElementById('vs-overlay-font-size').value) || 36;
        const fontColor = document.getElementById('vs-overlay-color').value || '#ffffff';
        const position = document.getElementById('vs-overlay-position').value;

        oCtx.font = `bold ${fontSize}px 'Segoe UI', Inter, sans-serif`;
        oCtx.textBaseline = 'middle';
        oCtx.textAlign = 'center';

        let posX = vW / 2;
        let posY = vH - (fontSize * 2);

        if (position === 'top-center') {
            posY = fontSize * 2;
        } else if (position === 'top-left') {
            oCtx.textAlign = 'left';
            posX = fontSize * 1.5;
            posY = fontSize * 2;
        } else if (position === 'bottom-right') {
            oCtx.textAlign = 'right';
            posX = vW - (fontSize * 1.5);
            posY = vH - (fontSize * 2);
        } else if (position === 'center') {
            posY = vH / 2;
        }

        const metrics = oCtx.measureText(text);
        const padX = fontSize * 0.4;
        const padY = fontSize * 0.25;

        // Yarı saydam şık altyazı kutusu
        oCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        let boxX = posX - (metrics.width / 2) - padX;
        if (oCtx.textAlign === 'left') boxX = posX - padX;
        if (oCtx.textAlign === 'right') boxX = posX - metrics.width - padX;

        roundRect(oCtx, boxX, posY - (fontSize / 2) - padY, metrics.width + (padX * 2), fontSize + (padY * 2), 8, true, false);

        oCtx.shadowColor = 'rgba(0,0,0,0.8)';
        oCtx.shadowBlur = 4;
        oCtx.fillStyle = fontColor;
        oCtx.fillText(text, posX, posY);

        overlayPngBase64 = offCanvas.toDataURL('image/png');
    }

    const startVal = parseFloat(document.getElementById('vs-trim-start-input').value) || 0;
    const endInputVal = document.getElementById('vs-trim-end-input').value;
    const endVal = endInputVal ? parseFloat(endInputVal) : null;

    const audioMode = document.getElementById('vs-audio-mode').value;
    const musicVol = (parseInt(document.getElementById('vs-music-vol-slider').value) || 60) / 100;

    window.electronAPI.editVideoAdvanced({
        filePath: vsSelectedVideoPath,
        targetPath: targetPath,
        outputFormat: format,
        trim: { start: startVal, end: endVal },
        filters: {
            brightness: parseFloat(document.getElementById('vs-bright-slider').value) || 0,
            contrast: parseFloat(document.getElementById('vs-contrast-slider').value) || 0,
            saturation: parseFloat(document.getElementById('vs-saturate-slider').value) || 0,
            grayscale: document.getElementById('vs-filter-grayscale').checked,
            sepia: document.getElementById('vs-filter-sepia').checked,
            speed: parseFloat(document.getElementById('vs-speed-select').value) || 1.0,
            rotate: vsRotation,
            flipH: vsFlipH,
            flipV: false
        },
        overlayPngBase64: overlayPngBase64,
        audioOption: {
            mode: audioMode,
            secondaryAudioPath: vsSecondaryMusicPath,
            secondaryVolume: musicVol,
            originalVolume: 1.0
        }
    });

    showToast("Video işleme başlatıldı, lütfen bekleyin...", "info");
}

// 2. Ses Düzenleyici (Audio Lab)
function initAudioLab() {
    const audioDropzone = document.getElementById('as-audio-dropzone');
    if (audioDropzone) {
        setupFilePicker('as-audio-dropzone', (filePath) => loadAudioIntoStudio(filePath), [
            { name: 'Ses Dosyaları', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma'] }
        ]);
    }

    const audioPlayer = document.getElementById('as-audio-player');
    const setStartBtn = document.getElementById('as-set-start-btn');
    if (setStartBtn) {
        setStartBtn.onclick = () => {
            if (!audioPlayer) return;
            document.getElementById('as-trim-start').value = audioPlayer.currentTime.toFixed(1);
            showToast(`Başlangıç: ${audioPlayer.currentTime.toFixed(1)} sn`, "info");
        };
    }

    const setEndBtn = document.getElementById('as-set-end-btn');
    if (setEndBtn) {
        setEndBtn.onclick = () => {
            if (!audioPlayer) return;
            document.getElementById('as-trim-end').value = audioPlayer.currentTime.toFixed(1);
            showToast(`Bitiş: ${audioPlayer.currentTime.toFixed(1)} sn`, "info");
        };
    }

    const volBoostSlider = document.getElementById('as-volume-boost-slider');
    const volBoostVal = document.getElementById('as-volume-boost-val');
    if (volBoostSlider && volBoostVal) {
        volBoostSlider.oninput = () => {
            const v = volBoostSlider.value;
            let label = `%${v}`;
            if (v == 100) label += ' (Normal)';
            else if (v > 100) label += ` (+%${v - 100} Yükseltme)`;
            else label += ' (Kısık)';
            volBoostVal.innerText = label;
        };
    }

    const speedSlider = document.getElementById('as-speed-slider');
    const speedVal = document.getElementById('as-speed-val');
    if (speedSlider && speedVal) {
        speedSlider.oninput = () => {
            speedVal.innerText = `${speedSlider.value}x`;
            if (audioPlayer) audioPlayer.playbackRate = parseFloat(speedSlider.value) || 1.0;
        };
    }

    const pickSecBtn = document.getElementById('as-pick-secondary-btn');
    if (pickSecBtn) {
        pickSecBtn.onclick = async () => {
            const path = await window.electronAPI.openFileDialog([
                { name: 'Arka Plan Sesi', extensions: ['mp3', 'wav', 'flac', 'm4a', 'ogg'] }
            ]);
            if (path) {
                asSecondaryAudioPath = path;
                document.getElementById('as-secondary-name').innerText = path.split(/[\\/]/).pop();
                showToast("Arka plan sesi eklendi.", "info");
            }
        };
    }

    const secVolSlider = document.getElementById('as-secondary-vol');
    const secVolVal = document.getElementById('as-secondary-vol-val');
    if (secVolSlider && secVolVal) {
        secVolSlider.oninput = () => secVolVal.innerText = `%${secVolSlider.value}`;
    }

    const renderAudioBtn = document.getElementById('as-render-audio-btn');
    if (renderAudioBtn) {
        renderAudioBtn.onclick = executeAudioRender;
    }

    window.electronAPI.onAudioEditProgress((p) => {
        const pBox = document.getElementById('as-progress-box');
        const pBar = document.getElementById('as-progress-bar');
        const pStage = document.getElementById('as-progress-stage');
        const pPercent = document.getElementById('as-progress-percent');

        if (pBox) pBox.style.display = 'block';
        if (pBar && p.percent != null) pBar.style.width = `${p.percent}%`;
        if (pPercent && p.percent != null) pPercent.innerText = `%${Math.round(p.percent)}`;
        if (pStage && p.stage) pStage.innerText = p.stage;
    });

    window.electronAPI.onAudioEditDone((outPath) => {
        document.getElementById('as-progress-box').style.display = 'none';
        showToast(`Ses başarıyla düzenlendi ve kaydedildi: ${outPath.split(/[\\/]/).pop()}`, "success");
        addRecentConversion(outPath, 'audio');
    });

    window.electronAPI.onAudioEditError((err) => {
        document.getElementById('as-progress-box').style.display = 'none';
        showToast(`Ses işleme hatası: ${err}`, "error");
    });
}

function loadAudioIntoStudio(filePath) {
    if (!filePath) return;
    asSelectedAudioPath = filePath;
    const baseName = filePath.split(/[\\/]/).pop();

    const infoEl = document.getElementById('as-audio-info');
    infoEl.style.display = 'block';
    infoEl.innerText = `Seçilen Ses: ${baseName}`;

    const controlsContainer = document.getElementById('as-controls-container');
    controlsContainer.style.display = 'block';

    const player = document.getElementById('as-audio-player');
    player.src = `file://${filePath}`;

    showToast("Ses stüdyoya yüklendi.", "success");
}

async function executeAudioRender() {
    if (!asSelectedAudioPath) {
        showToast("Lütfen önce bir ses dosyası seçin!", "error");
        return;
    }

    const format = document.getElementById('as-output-format').value;
    const targetPath = await window.electronAPI.saveFileDialog(format);
    if (!targetPath) return;

    const startVal = parseFloat(document.getElementById('as-trim-start').value) || 0;
    const endInputVal = document.getElementById('as-trim-end').value;
    const endVal = endInputVal ? parseFloat(endInputVal) : null;

    window.electronAPI.editAudioAdvanced({
        filePath: asSelectedAudioPath,
        targetPath: targetPath,
        outputFormat: format,
        trim: { start: startVal, end: endVal },
        volumeBoost: parseFloat(document.getElementById('as-volume-boost-slider').value) || 100,
        fadeIn: parseFloat(document.getElementById('as-fade-in-input').value) || 0,
        fadeOut: parseFloat(document.getElementById('as-fade-out-input').value) || 0,
        speed: parseFloat(document.getElementById('as-speed-slider').value) || 1.0,
        secondaryAudioPath: asSecondaryAudioPath,
        secondaryVolume: parseFloat(document.getElementById('as-secondary-vol').value) || 40
    });

    showToast("Ses işleme başlatıldı...", "info");
}

window.switchMediaStudioMode = function(mode) {
    const videoBtn = document.getElementById('ms-mode-video-btn');
    const audioBtn = document.getElementById('ms-mode-audio-btn');
    const videoWs = document.getElementById('ms-video-workspace');
    const audioWs = document.getElementById('ms-audio-workspace');

    if (mode === 'video') {
        videoBtn.classList.add('active');
        audioBtn.classList.remove('active');
        videoWs.style.display = 'block';
        audioWs.style.display = 'none';
    } else {
        audioBtn.classList.add('active');
        videoBtn.classList.remove('active');
        audioWs.style.display = 'block';
        videoWs.style.display = 'none';
    }
};

function formatTimecode(secs) {
    if (isNaN(secs) || secs < 0) return '00:00.00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

// Stüdyo modüllerini yükle
window.addEventListener('DOMContentLoaded', () => {
    initPhotoStudio();
    initMediaStudio();
});