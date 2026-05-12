const { ipcRenderer } = require('electron');

// Yükleme Ekranını (Splash Screen) Kapatma Mantığı
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('loader-wrapper');
        if(loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }
    }, 1500); 
});

// Renderer'da import('plyr') çözülmez (bare specifier); dosya URL ile yükle.
(async function initPlyr() {
    try {
        const path = require('path');
        const { pathToFileURL } = require('url');
        // plyr paketinde "package.json" erişimi exports ile engellenebiliyor.
        // Bunun yerine doğrudan dist/plyr.mjs dosyasını resolve edip file URL ile import ediyoruz.
        // Not: exports map nedeniyle require.resolve('plyr/dist/...') başarısız olabilir.
        // Bu yüzden önce main entry'yi (require.resolve('plyr')) alıp aynı klasördeki plyr.mjs'yi file URL ile import ediyoruz.
        const plyrEntry = require.resolve('plyr'); // .../node_modules/plyr/dist/plyr.js
        const plyrDir = path.dirname(plyrEntry);
        const plyrMjs = path.join(plyrDir, 'plyr.mjs');
        const PlyrModule = await import(pathToFileURL(plyrMjs).href);
        const Plyr = PlyrModule.default ?? PlyrModule;
        new Plyr('#player', {
            settings: ['captions', 'quality', 'speed', 'loop'],
            speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
            controls: [
                'play-large', 'play', 'progress', 'current-time', 'mute',
                'volume', 'captions', 'settings', 'pip', 'fullscreen'
            ]
        });
        console.log("Plyr gelişmiş ayarlarla başlatıldı.");
    } catch (e) {
        console.error("Plyr başlatma hatası:", e);
    }
})();

let selectedVideoPath = null;
let selectedImagePath = null;

const setupFilePicker = (id, callback, filters) => {
    const zone = document.getElementById(id);

    zone.onclick = async () => {
        const path = await ipcRenderer.invoke('open-file-dialog', filters);
        if (path) callback(path);
    };

    zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = "#0078d4"; return false; };
    zone.ondragleave = () => { zone.style.borderColor = "#444"; return false; };
    zone.ondrop = (e) => {
        e.preventDefault();
        zone.style.borderColor = "#444";
        if (e.dataTransfer.files.length > 0) {
            callback(e.dataTransfer.files[0].path);
        }
    };
};

setupFilePicker('drop-zone', (path) => {
    selectedVideoPath = path;
    document.getElementById('video-status').innerText = "Seçildi: " + path.split(/[\\/]/).pop();
}, [{ name: 'Videolar', extensions: ['mp4', 'mkv', 'avi', 'mp3'] }]);

setupFilePicker('image-drop-zone', (path) => {
    selectedImagePath = path;
    document.getElementById('preview-img').src = `file://${path}`;
    document.getElementById('image-preview').style.display = 'block';
}, [{ name: 'Resimler', extensions: ['jpg', 'png', 'webp'] }]);

document.getElementById('convert-btn').onclick = () => {
    if(!selectedVideoPath) return alert("Dosya seçin");
    const bar = document.getElementById('progress-bar');
    bar.value = 0;
    bar.style.display = 'block';
    ipcRenderer.send('convert-media', {
        filePath: selectedVideoPath,
        outputFormat: document.getElementById('format-select').value,
        startTime: parseFloat(document.getElementById('start-time').value) || 0,
        endTime: parseFloat(document.getElementById('end-time').value) || null
    });
};

let selectedLogoPath = null;
const watermarkCheckbox = document.getElementById('watermark-checkbox');
const selectLogoBtn = document.getElementById('select-logo-btn');

watermarkCheckbox.onchange = () => {
    selectLogoBtn.style.display = watermarkCheckbox.checked ? 'inline-block' : 'none';
};

selectLogoBtn.onclick = async () => {
    const path = await ipcRenderer.invoke('open-file-dialog', [{name: 'Logo Dosyası', extensions: ['png']}]);
    if(path) {
        selectedLogoPath = path;
        document.getElementById('logo-path-text').innerText = path.split(/[\\/]/).pop();
    }
};

document.getElementById('process-image-btn').onclick = async () => {
    if(!selectedImagePath) return alert("Lütfen önce bir resim seçin!");
    const format = document.getElementById('image-format-select').value;
    const targetPath = await ipcRenderer.invoke('save-file-dialog', format);
    
    if (targetPath) {
        const result = await ipcRenderer.invoke('process-image-sharp', {
            filePath: selectedImagePath,
            targetPath: targetPath, 
            options: {
                format: format,
                width: document.getElementById('image-width').value,
                height: document.getElementById('image-height').value,
                grayscale: document.getElementById('grayscale-checkbox').checked,
                watermark: watermarkCheckbox.checked ? selectedLogoPath : null 
            }
        });
        alert(result.success ? "Başarıyla kaydedildi: \n" + result.path : "Hata: " + result.error);
    }
};

document.getElementById('load-file-btn').onclick = async () => {
    const path = await ipcRenderer.invoke('open-file-dialog', [{name: 'Medya', extensions: ['mp4', 'mp3', 'wav']}]);
    if(path) {
        document.getElementById('player').src = `file://${path}`;
        document.getElementById('current-file-name').innerText = path.split(/[\\/]/).pop();
    }
};

document.getElementById('select-excel-btn').onclick = async () => {
    const path = await ipcRenderer.invoke('open-file-dialog', [{name: 'Excel', extensions: ['xlsx']}]);
    if(path) {
        document.getElementById('excel-status').innerText = "İşleniyor...";
        ipcRenderer.send('convert-excel-to-pdf', path);
    }
};

document.getElementById('read-word-btn').onclick = async () => {
    const path = await ipcRenderer.invoke('open-file-dialog', [{name: 'Word', extensions: ['docx']}]);
    if(path) document.getElementById('word-content').innerHTML = await ipcRenderer.invoke('read-word', path);
};

// Word içeriğini .docx olarak kaydet
document.getElementById('save-word-btn').onclick = async () => {
    try {
        const contentEl = document.getElementById('word-content');
        const content = contentEl ? (contentEl.innerText || '').trim() : '';
        if (!content) return alert('Word içeriği boş.');

        const savePath = await ipcRenderer.invoke('save-file-dialog', 'docx');
        if (!savePath) return;
        const finalSavePath = savePath.toLowerCase().endsWith('.docx') ? savePath : (savePath + '.docx');

        ipcRenderer.once('word-saved', (e, outPath) => {
            alert('Word kaydedildi:\n' + outPath);
        });
        ipcRenderer.send('save-to-word', { content, savePath: finalSavePath });
    } catch (err) {
        console.error('save-word error:', err);
        alert('Word kaydetme hatası: ' + (err?.message || err));
    }
};

ipcRenderer.on('conversion-progress', (e, p) => {
    const bar = document.getElementById('progress-bar');
    const n = Number(p);
    if (bar && Number.isFinite(n)) bar.value = Math.min(100, Math.max(0, n));
});
ipcRenderer.on('conversion-done', (e, outPath) => {
    const bar = document.getElementById('progress-bar');
    if (bar) { bar.value = 100; bar.style.display = 'none'; }
    alert("Dönüştürme bitti. Dosya:\n" + outPath);
});
ipcRenderer.on('conversion-error', (e, msg) => {
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.display = 'none';
    alert("Dönüştürme hatası:\n" + (msg || "Bilinmeyen hata"));
});
ipcRenderer.on('doc-conversion-done', (e, path) => { alert("PDF Hazır: " + path); document.getElementById('excel-status').innerText = ""; });

// --- ÖZEL GÖREV ÇUBUĞU BUTON KONTROLLERİ ---
document.getElementById('btn-minimize').onclick = () => {
    ipcRenderer.send('window-minimize');
};

document.getElementById('btn-maximize').onclick = () => {
    ipcRenderer.send('window-maximize');
};

document.getElementById('btn-close').onclick = () => {
    ipcRenderer.send('window-close');
};

// Maximize/restore ikonunu pencere durumuna göre değiştir.
ipcRenderer.on('window-maximized-changed', (e, isMaximized) => {
    const btn = document.getElementById('btn-maximize');
    if (!btn) return;

    // isMaximized = true iken restore (square-off) ikonu gösterelim.
    btn.innerHTML = isMaximized
        ? `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-square-off" aria-hidden="true">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M8 4h10a2 2 0 0 1 2 2v10m-.584 3.412a2 2 0 0 1 -1.416 .588h-12a2 2 0 0 1 -2 -2v-12c0 -.552 .224 -1.052 .586 -1.414"/>
                <path d="M3 3l18 18"/>
            </svg>
        `
        : `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-square" aria-hidden="true">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M3 3m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/>
            </svg>
        `;
});