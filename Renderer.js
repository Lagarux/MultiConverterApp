// Yükleme Ekranını (Splash Screen) Kapatma Mantığı
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('loader-wrapper');
        if(loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }
    }, 1500); 

    // Plyr initialization (from CDN, so Plyr is global)
    try {
        if (typeof Plyr !== 'undefined') {
            new Plyr('#player', {
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

setupFilePicker('drop-zone', (path) => {
    selectedVideoPath = path;
    document.getElementById('video-status').innerText = "Seçildi: " + path.split(/[\\/]/).pop();
    
    // Video kırpıcı önizleme
    const clipperVideo = document.getElementById('clipper-video');
    clipperVideo.src = `file://${path}`;
    document.getElementById('video-clipper-preview').style.display = 'block';
}, [{ name: 'Videolar', extensions: ['mp4', 'mkv', 'avi', 'mp3'] }]);

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
    const bar = document.getElementById('progress-bar');
    bar.value = 0;
    bar.style.display = 'block';
    
    window.electronAPI.convertMedia({
        filePath: selectedVideoPath,
        outputFormat: document.getElementById('format-select').value,
        startTime: parseFloat(document.getElementById('start-time').value) || 0,
        endTime: parseFloat(document.getElementById('end-time').value) || null
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

document.getElementById('load-file-btn').onclick = async () => {
    const path = await window.electronAPI.openFileDialog([{name: 'Medya', extensions: ['mp4', 'mp3', 'wav']}]);
    if(path) {
        document.getElementById('player').src = `file://${path}`;
        document.getElementById('current-file-name').innerText = path.split(/[\\/]/).pop();
    }
};

setupFilePicker('select-excel-btn', async (path) => {
    const targetPath = await window.electronAPI.saveFileDialog('pdf');
    if (targetPath) {
        showToast("Excel işleniyor, lütfen bekleyin...", "info");
        const result = await window.electronAPI.convertExcelToPdf({ filePath: path, savePath: targetPath });
        if (result.success) {
            showToast("PDF Başarıyla Kaydedildi:\n" + targetPath, "success");
        } else {
            showToast("Dönüştürme hatası: " + result.error, "error");
        }
    }
}, [{name: 'Excel', extensions: ['xlsx']}]);

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
        showToast("PDF metinleri okunuyor, lütfen bekleyin...", "info");
        const result = await window.electronAPI.convertPdfToWord({ filePath: currentPdfPath, savePath: targetPath });
        if (result.success) {
            showToast("Word Başarıyla Kaydedildi:\n" + targetPath, "success");
        } else {
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
            
            const progressBar = document.getElementById('pdf-progress');
            progressBar.style.display = 'block';
            progressBar.value = 0;
            
            window.electronAPI.logToTerminal(`Görsel dönüştürme başlatıldı. Toplam Sayfa: ${totalPages}`);
            
            for (let i = 1; i <= totalPages; i++) {
                showToast(`Sayfa işleniyor: ${i} / ${totalPages}`, "info");
                window.electronAPI.logToTerminal(`İşleniyor: Sayfa ${i} / ${totalPages} - %${Math.round((i/totalPages)*100)} tamamlandı.`);
                
                const page = await pdf.getPage(i);
                // Kaliteyi artırmak için ölçeği 2 yapıyoruz
                const viewport = page.getViewport({ scale: 2.0 });
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({
                    canvasContext: ctx,
                    viewport: viewport
                }).promise;
                
                // JPEG formatında resme çevir
                images.push(canvas.toDataURL('image/jpeg', 0.8));
                progressBar.value = (i / totalPages) * 100;
                
                // UI (Arayüz) donmasını engellemek ve Progress Bar'ın çizilmesine izin vermek için çok kısa bir bekleme süresi
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Resimleri Backend'e yolla
            showToast(`Görseller Word dosyasına birleştiriliyor, bekleyin...`, "info");
            window.electronAPI.logToTerminal(`Tüm sayfalar okundu. Word dosyası (${totalPages} resim) oluşturuluyor...`);
            
            const result = await window.electronAPI.convertImagesToWord({ images, savePath: targetPath });
            
            progressBar.style.display = 'none';
            if (result.success) {
                window.electronAPI.logToTerminal(`İşlem Başarılı! Dosya kaydedildi: ${targetPath}`);
                showToast("Word (Görsel) Başarıyla Kaydedildi:\n" + targetPath, "success");
            } else {
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

window.electronAPI.onConversionProgress((p) => {
    const bar = document.getElementById('progress-bar');
    const n = Number(p);
    if (bar && Number.isFinite(n)) bar.value = Math.min(100, Math.max(0, n));
});

window.electronAPI.onConversionDone((outPath) => {
    const bar = document.getElementById('progress-bar');
    if (bar) { bar.value = 100; bar.style.display = 'none'; }
    showToast("Dönüştürme bitti. Dosya:\n" + outPath, "success");
});

window.electronAPI.onConversionError((msg) => {
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.display = 'none';
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
        const bar = document.getElementById('download-progress-bar');
        const status = document.getElementById('social-status');
        bar.value = 0;
        bar.style.display = 'block';
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
        const bar = document.getElementById('download-progress-bar');
        const status = document.getElementById('social-status');
        bar.value = 0;
        bar.style.display = 'block';
        status.innerText = "Küçük resim indiriliyor...";
        
        window.electronAPI.downloadSocialMedia({ url, isThumbnail: true, savePath: finalSavePath });
    }
};

window.electronAPI.onDownloadProgress((p) => {
    const bar = document.getElementById('download-progress-bar');
    const status = document.getElementById('social-status');
    const n = Number(p);
    if (bar && Number.isFinite(n)) {
        bar.value = Math.min(100, Math.max(0, n));
        status.innerText = `İndiriliyor: %${n.toFixed(2)}`;
    }
});

window.electronAPI.onDownloadDone((path) => {
    const bar = document.getElementById('download-progress-bar');
    const status = document.getElementById('social-status');
    if (bar) bar.style.display = 'none';
    status.innerText = "";
    showToast("Medya başarıyla indirildi: " + path, "success");
});

window.electronAPI.onDownloadError((err) => {
    const bar = document.getElementById('download-progress-bar');
    const status = document.getElementById('social-status');
    if (bar) bar.style.display = 'none';
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