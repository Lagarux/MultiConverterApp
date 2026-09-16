const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { jsPDF } = require('jspdf');
const { Document, Packer, Paragraph, TextRun } = require("docx");
const mammoth = require("mammoth");
const dictionaryEngine = require('./dictionaryEngine');
require('jspdf-autotable');

function getFfmpegPath() {
    const installed = ffmpegInstaller.path;
    if (!app.isPackaged) return installed;
    const unpacked = installed.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    return fs.existsSync(unpacked) ? unpacked : installed;
}
ffmpeg.setFfmpegPath(getFfmpegPath());

function getYtDlpBinaryPath() {
    const defaultPath = require('yt-dlp-exec/src/constants').YOUTUBE_DL_PATH;
    if (!app.isPackaged) return defaultPath;
    const unpacked = defaultPath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    if (fs.existsSync(unpacked)) return unpacked;
    if (process.resourcesPath) {
        const directUnpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');
        if (fs.existsSync(directUnpacked)) return directUnpacked;
    }
    return defaultPath;
}

function getYtDlp() {
    const ytDlpExec = require('yt-dlp-exec');
    return ytDlpExec.create(getYtDlpBinaryPath());
}

function getTaskbarIconPath() {
    // Windows jumplist/task icons: electron-builder doesn't package `build/*` automatically for runtime,
    // so we copy required icons via `extraResources` into `process.resourcesPath`.
    if (!app.isPackaged) {
        const devIco = path.join(__dirname, 'build', 'icon.ico');
        return fs.existsSync(devIco) ? devIco : process.execPath;
    }
    const ico = path.join(process.resourcesPath, 'taskbar-icons', 'app.ico');
    return fs.existsSync(ico) ? ico : process.execPath;
}

// Windows GPU disk önbelleği kilitlenme ve "cache_util_win.cc: Unable to move the cache" (Access Denied 0x5) hatalarını engeller
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

let mainWindow = null;
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

function createWindow() {
    const winOpts = {
        width: 1100,
        height: 750,
        backgroundColor: '#121212',
        frame: false, // Windows çerçevesini kapatır (custom title bar görünsün)
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            autoplayPolicy: 'no-user-gesture-required',
            preload: path.join(__dirname, 'preload.js')
        }
    };

    if (process.platform === 'win32') {
        const ico = path.join(__dirname, 'build', 'icon.ico');
        if (fs.existsSync(ico)) winOpts.icon = ico;
    } else if (process.platform === 'linux') {
        const png = path.join(__dirname, 'build', 'icon.png');
        if (fs.existsSync(png)) winOpts.icon = png;
    }
    const win = new BrowserWindow(winOpts);
    mainWindow = win;
    win.loadFile('index.html');

    // Maximize/restore ikonunu gerçek pencere durumuna göre güncelle.
    win.on('maximize', () => win.webContents.send('window-maximized-changed', true));
    win.on('unmaximize', () => win.webContents.send('window-maximized-changed', false));
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('window-maximized-changed', win.isMaximized());
    });
    
}

// Geçici medya oynatma önbelleği temizleyicisi (24 saatten eski dosyaları temizler)
function cleanPlaybackCache() {
    try {
        const cacheDir = path.join(app.getPath('temp'), 'multiconverter_playback_cache');
        if (fs.existsSync(cacheDir)) {
            const files = fs.readdirSync(cacheDir);
            const now = Date.now();
            const MAX_AGE_MS = 24 * 60 * 60 * 1000;
            for (const file of files) {
                try {
                    const filePath = path.join(cacheDir, file);
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > MAX_AGE_MS) {
                        fs.unlinkSync(filePath);
                    }
                } catch(e) {}
            }
        }
    } catch(e) {
        console.warn('Playback cache temizleme hatası:', e);
    }
}

// Global Pencere Kontrol Kanalları (Bellek sızıntısını önlemek için tekil tanımlanır)
ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
});
ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    if (win) {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    }
});
ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    if (win) win.close();
});

// Windows Görev Çubuğu Özelleştirmesi
app.whenReady().then(() => {
    cleanPlaybackCache();
    if (process.platform === 'win32') {
        app.setUserTasks([
            {
                program: process.execPath,
                arguments: '--new-window',
                iconPath: getTaskbarIconPath(),
                iconIndex: 0,
                title: 'Yeni Dönüştürücü Aç',
                description: 'MultiTool uygulamasının yeni bir penceresini açar'
            }
        ]);
    }
    dictionaryEngine.initLearnedVocabulary(app.getPath('userData'));
    createWindow();
});

app.on('before-quit', () => {
    cleanPlaybackCache();
});

function parseTimemarkToSeconds(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.split(':');
    if (parts.length === 3) {
        const h = parseFloat(parts[0]);
        const m = parseFloat(parts[1]);
        const s = parseFloat(parts[2]);
        if (!Number.isNaN(h) && !Number.isNaN(m) && !Number.isNaN(s)) {
            return h * 3600 + m * 60 + s;
        }
    }
    return null;
}

// Medya Dönüştürme
ipcMain.on('convert-media', (event, { filePath, outputFormat, startTime, endTime, totalDuration }) => {
    const parsed = path.parse(filePath);
    const outputPath = path.join(parsed.dir, `${parsed.name}_islenmis.${outputFormat}`);
    const start = Number(startTime) || 0;
    const end = endTime != null && !Number.isNaN(Number(endTime)) ? Number(endTime) : null;

    let estimatedDuration = (totalDuration && Number(totalDuration) > 0) ? Number(totalDuration) : null;
    if (end != null && end > start) {
        estimatedDuration = end - start;
    } else if (estimatedDuration != null && start > 0) {
        estimatedDuration = Math.max(0.1, estimatedDuration - start);
    }

    let command = ffmpeg(filePath).setStartTime(start);
    if (end != null && end > start) command.duration(end - start);

    // Başlangıç bildirimi
    event.reply('conversion-progress', {
        percent: 0,
        timemark: '00:00:00',
        stage: 'FFmpeg motoru başlatıldı, dosya analiz ediliyor...'
    });

    command.on('codecData', (data) => {
        if (!estimatedDuration && data && data.duration) {
            const secs = parseTimemarkToSeconds(data.duration);
            if (secs != null && secs > 0) estimatedDuration = Math.max(0.1, secs - start);
        }
        event.reply('conversion-progress', {
            percent: 2,
            timemark: '00:00:00',
            stage: 'Medya akışları çözümlendi, dönüştürme başladı...'
        });
    });

    const fmt = (outputFormat || '').toLowerCase();
    const audioFormats = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wma', 'aiff', 'ac3'];

    if (audioFormats.includes(fmt)) {
        command.noVideo();
        if (fmt === 'mp3') {
            command.audioCodec('libmp3lame').audioBitrate(320);
        } else if (fmt === 'wav') {
            command.audioCodec('pcm_s16le');
        } else if (fmt === 'flac') {
            command.audioCodec('flac');
        } else if (fmt === 'm4a' || fmt === 'aac') {
            command.audioCodec('aac').audioBitrate(256);
        } else if (fmt === 'ogg') {
            command.audioCodec('libvorbis').outputOptions(['-q:a', '6']);
        } else if (fmt === 'opus') {
            command.audioCodec('libopus').audioBitrate(192);
        } else if (fmt === 'wma') {
            command.audioCodec('wmav2').audioBitrate(192);
        } else if (fmt === 'aiff') {
            command.audioCodec('pcm_s16be');
        } else if (fmt === 'ac3') {
            command.audioCodec('ac3').audioBitrate(384);
        }
    } else {
        // Video Formatları
        if (fmt === 'mp4') {
            command.videoCodec('libx264').audioCodec('aac').outputOptions(['-pix_fmt', 'yuv420p', '-movflags', '+faststart']);
        } else if (fmt === 'mkv') {
            command.videoCodec('libx264').audioCodec('aac');
        } else if (fmt === 'webm') {
            command.videoCodec('libvpx-vp9').audioCodec('libopus');
        } else if (fmt === 'avi') {
            command.videoCodec('mpeg4').audioCodec('libmp3lame').outputOptions(['-vtag', 'xvid']);
        } else if (fmt === 'mov') {
            command.videoCodec('libx264').audioCodec('aac');
        } else if (fmt === 'wmv') {
            command.videoCodec('wmv2').audioCodec('wmav2');
        } else if (fmt === 'flv') {
            command.videoCodec('flv').audioCodec('libmp3lame');
        } else if (fmt === 'gif') {
            command.outputOptions([
                '-vf', 'fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
                '-loop', '0'
            ]);
        } else if (fmt === 'ts') {
            command.videoCodec('libx264').audioCodec('aac');
        } else if (fmt === 'ogv') {
            command.videoCodec('libtheora').audioCodec('libvorbis');
        } else if (fmt === '3gp') {
            command.videoCodec('h263').audioCodec('aac').outputOptions(['-s', '352x288']);
        }
    }

    // Format belirleme (FFmpeg muxer adları bazı uzantılardan farklıdır)
    const formatMap = {
        'ts': 'mpegts',
        'mkv': 'matroska',
        'wmv': 'asf',
        'm4a': 'ipod',
        'ogv': 'ogg',
        'aac': 'adts'
    };
    const targetMuxer = formatMap[fmt] || fmt;
    command.toFormat(targetMuxer);

    command
        .outputOptions('-y')
        .on('progress', (p) => {
            let pct = null;
            if (typeof p.percent === 'number' && Number.isFinite(p.percent) && p.percent > 0) {
                pct = p.percent;
            } else if (estimatedDuration && p.timemark) {
                const currentSec = parseTimemarkToSeconds(p.timemark);
                if (currentSec != null && currentSec > 0) {
                    pct = (currentSec / estimatedDuration) * 100;
                }
            }

            let stageDesc = 'Medya kareleri dönüştürülüyor ve kodlanıyor...';
            if (pct != null) {
                if (pct < 25) stageDesc = 'Kareler çözümleniyor ve akış başlatılıyor...';
                else if (pct < 65) stageDesc = 'Görüntü ve ses akışları kodlanıyor...';
                else if (pct < 90) stageDesc = 'Akışlar senkronize ediliyor ve optimize ediliyor...';
                else stageDesc = 'Son kareler paketleniyor ve dosya mühürleniyor...';
            }

            event.reply('conversion-progress', {
                percent: pct != null ? Math.min(99.6, Math.max(0.5, pct)) : null,
                timemark: p.timemark || '00:00:00',
                fps: p.currentFps ? Math.round(p.currentFps) : null,
                kbps: p.currentKbps ? Math.round(p.currentKbps) : null,
                size: p.targetSize ? (p.targetSize >= 1024 ? `${(p.targetSize / 1024).toFixed(1)} MB` : `${p.targetSize} KB`) : null,
                frames: p.frames || null,
                stage: stageDesc
            });
        })
        .on('end', () => {
            event.reply('conversion-progress', {
                percent: 100,
                stage: 'Dönüştürme başarıyla tamamlandı!'
            });
            event.reply('conversion-done', outputPath);
        })
        .on('error', (err) => {
            console.error('ffmpeg:', err.message);
            event.reply('conversion-error', err.message);
        })
        .save(outputPath);
});

// Medya Oynatma Yardımcısı: Herhangi bir medya formatını Chromium ve Plyr'ın oynatabileceği formata anında hazırlar
ipcMain.handle('prepare-playable-media', async (event, filePath) => {
    try {
        if (!filePath || !fs.existsSync(filePath)) {
            return { success: false, error: 'Dosya bulunamadı.' };
        }

        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        // Chromium'un doğrudan oynatabildiği yerel web video ve ses formatları
        const nativeFormats = ['mp4', 'webm', 'ogg', 'wav', 'mp3'];
        if (nativeFormats.includes(ext)) {
            return { success: true, url: `file://${filePath.replace(/\\/g, '/')}`, isNative: true };
        }

        // Chromium'un doğrudan desteklemediği formatlar:
        // mkv, avi, mov, wmv, flv, ts, 3gp, ogv, m4v, flac, m4a, aac, opus, wma, aiff, ac3 vb.
        const cacheDir = path.join(app.getPath('temp'), 'multiconverter_playback_cache');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        const stats = fs.statSync(filePath);
        const hash = crypto.createHash('md5').update(`${filePath}_${stats.mtimeMs}_${stats.size}`).digest('hex').slice(0, 12);
        const cacheFile = path.join(cacheDir, `${path.parse(filePath).name}_${hash}.mp4`);

        // Önbellekte zaten hazır varsa doğrudan kullan
        if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 0) {
            return { success: true, url: `file://${cacheFile.replace(/\\/g, '/')}`, isNative: false };
        }

        // 1. Adım: Hızlı Kapsayıcı Dönüştürme (Remux - -c copy). Desteklenen H264/AAC akışlarında 0.1 saniye sürer!
        const tryRemux = () => new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .outputOptions(['-c', 'copy', '-movflags', '+faststart', '-y'])
                .toFormat('mp4')
                .on('end', () => resolve(true))
                .on('error', (err) => reject(err))
                .save(cacheFile);
        });

        // 2. Adım: Süper Hızlı Kodlama (Ultrafast Transcode - MPEG4/Xvid, WMV2 vb. için anında web standardına çevirir)
        const tryTranscode = () => new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions([
                    '-preset', 'ultrafast',
                    '-tune', 'fastdecode',
                    '-movflags', '+faststart',
                    '-y'
                ])
                .toFormat('mp4')
                .on('end', () => resolve(true))
                .on('error', (err) => reject(err))
                .save(cacheFile);
        });

        try {
            await tryRemux();
        } catch (remuxErr) {
            if (fs.existsSync(cacheFile)) {
                try { fs.unlinkSync(cacheFile); } catch(e) {}
            }
            await tryTranscode();
        }

        return { success: true, url: `file://${cacheFile.replace(/\\/g, '/')}`, isNative: false };
    } catch (err) {
        console.error('prepare-playable-media hatası:', err);
        return { success: false, error: err.message };
    }
});

// Gömülü Evrensel Sözlük & Çeviri İşleyicileri
ipcMain.handle('lookup-dictionary', async (event, { query, sourceLang, targetLang }) => {
    try {
        return dictionaryEngine.lookupWord(query, sourceLang, targetLang);
    } catch (err) {
        console.error('lookup-dictionary hatası:', err);
        return { found: false, error: err.message };
    }
});

ipcMain.handle('translate-text-offline', async (event, { text, sourceLang, targetLang }) => {
    try {
        return dictionaryEngine.translateTextOffline(text, sourceLang, targetLang);
    } catch (err) {
        console.error('translate-text-offline hatası:', err);
        return { originalText: text, translatedText: text, error: err.message };
    }
});

// Evrensel Seslendirme (TTS) İşleyicisi (Hem Çevrimiçi Hem %100 Çevrimdışı Tüm Diller)
ipcMain.handle('synthesize-speech', async (event, { text, lang }) => {
    try {
        return await dictionaryEngine.synthesizeSpeech({
            text,
            lang,
            userDataDir: app.getPath('userData')
        });
    } catch (err) {
        console.error('synthesize-speech hatası:', err);
        return { success: false, error: err.message };
    }
});

// Öğrenilen Kelime Haznesi İstatistikleri
ipcMain.handle('get-learned-stats', async () => {
    try {
        return dictionaryEngine.getLearnedStats();
    } catch (err) {
        return { count: 0, items: [] };
    }
});

// Dosya Seçme Diyaloğu (Okuma)
ipcMain.handle('open-file-dialog', async (event, filters) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: filters || [{ name: 'Hepsi', extensions: ['*'] }]
        });
        return canceled ? null : filePaths[0];
    } catch (err) {
        console.error("Diyalog hatası:", err);
        return null;
    }
});

// Dosya Kaydetme Diyaloğu (Farklı Kaydet)
ipcMain.handle('save-file-dialog', async (event, extension) => {
    const { filePath } = await dialog.showSaveDialog({
        title: 'İşlenmiş Dosyayı Kaydet',
        buttonLabel: 'Buraya Kaydet',
        filters: [{ name: `İşlenmiş Dosya (${extension})`, extensions: [extension] }]
    });
    return filePath;
});

// Resim İşleme (Hedef yol, kırpma, yeniden boyutlandırma, kalite ayarı ve filigran)
ipcMain.handle('process-image-sharp', async (event, { filePath, targetPath, options }) => {
    try {
        const parsed = path.parse(filePath);
        const format = (options.format || 'png').toLowerCase();
        const outPath = targetPath || path.join(parsed.dir, `${parsed.name}_islenmis.${format}`);
        
        let img = sharp(filePath);
        
        // 1. Kırpma işlemi (öncelikli)
        if (options.crop) {
            img = img.extract({
                left: Math.max(0, Math.round(options.crop.x)),
                top: Math.max(0, Math.round(options.crop.y)),
                width: Math.max(1, Math.round(options.crop.width)),
                height: Math.max(1, Math.round(options.crop.height))
            });
        }
        
        // 2. Boyutlandırma işlemi
        if (options.width || options.height) {
            img = img.resize(parseInt(options.width) || null, parseInt(options.height) || null);
        }
        
        // 3. Renk / Gri tonlama
        if (options.grayscale) {
            img = img.grayscale();
        }
        
        // 4. Filigran (Watermark) işlemi - En son uygulanmalı ve ana görselden büyük olmamalıdır
        if (options.watermark) {
            const mainBuffer = await img.toBuffer({ resolveWithObject: true });
            const mainWidth = mainBuffer.info.width;
            const mainHeight = mainBuffer.info.height;
            
            const watermarkMeta = await sharp(options.watermark).metadata();
            let watermarkInput = options.watermark;
            
            // Eğer filigran ana görselden büyükse, ana görsele sığacak şekilde otomatik küçült
            if (watermarkMeta.width > mainWidth || watermarkMeta.height > mainHeight) {
                watermarkInput = await sharp(options.watermark)
                    .resize({
                        width: Math.min(watermarkMeta.width, mainWidth),
                        height: Math.min(watermarkMeta.height, mainHeight),
                        fit: 'inside'
                    })
                    .toBuffer();
            }
            
            img = sharp(mainBuffer.data).composite([{
                input: watermarkInput,
                gravity: options.watermarkPosition || 'southeast',
                blend: 'over'
            }]);
        }

        // 5. Kalite ve Format Kodlama
        const quality = Math.max(1, Math.min(100, parseInt(options.quality) || 85));
        if (format === 'jpeg' || format === 'jpg') {
            img = img.jpeg({ quality, mozjpeg: true });
        } else if (format === 'webp') {
            img = img.webp({ quality });
        } else if (format === 'png') {
            const compLevel = Math.max(1, Math.min(9, Math.round((100 - quality) / 11)));
            img = img.png({ compressionLevel: compLevel });
        } else {
            img = img.toFormat(format);
        }
        
        await img.toFile(outPath);
        const stats = fs.statSync(outPath);
        const origStats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
        return {
            success: true,
            path: outPath,
            size: stats.size,
            origSize: origStats ? origStats.size : null
        };
    } catch (err) { return { success: false, error: err.message }; }
});

// Tablo HTML Oluşturucu Yardımcı Fonksiyon
function generateTableHtmlFromWorksheet(worksheet) {
    let htmlTable = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Tablo Belgesi</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #1e293b; background: #fff; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
        th { background-color: #2563eb; color: #ffffff; font-weight: 600; }
        tr:nth-child(even) { background-color: #f8fafc; }
        tr:hover { background-color: #f1f5f9; }
    </style>
    </head><body><h2>Tablo Raporu</h2><table>`;

    let isFirstRow = true;
    worksheet.eachRow(row => {
        let rowHtml = '<tr>';
        row.eachCell({ includeEmpty: true }, (cell) => {
            let cellValue = '';
            if (cell && cell.value !== null && cell.value !== undefined) {
                if (cell.value.richText) {
                    cellValue = cell.value.richText.map(rt => rt.text).join('');
                } else if (cell.value.result !== undefined) {
                    cellValue = cell.value.result;
                } else if (cell.value.text !== undefined) {
                    cellValue = cell.value.text;
                } else if (cell.value instanceof Date) {
                    cellValue = cell.value.toLocaleDateString();
                } else {
                    cellValue = cell.value.toString();
                }
            }
            cellValue = String(cellValue).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
            if (isFirstRow) rowHtml += `<th>${cellValue}</th>`;
            else rowHtml += `<td>${cellValue}</td>`;
        });
        rowHtml += '</tr>';
        htmlTable += rowHtml;
        isFirstRow = false;
    });

    htmlTable += `</table></body></html>`;
    return htmlTable;
}

// Excel/Tablo'dan PDF Oluşturma Yardımcısı
async function renderHtmlToPdf(htmlContent, savePath, onProgress) {
    if (onProgress) onProgress(50, 'PDF sayfası derleniyor...', 'Chromium motorunda sayfa düzeni oluşturuluyor...');
    const win = new BrowserWindow({ show: false });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    if (onProgress) onProgress(75, 'Vektörel PDF çıktısı alınıyor...', 'A4 baskı formatı hazırlanıyor...');
    const pdf = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4'
    });
    fs.writeFileSync(savePath, pdf);
    win.destroy();
    if (onProgress) onProgress(100, 'Tamamlandı!', 'PDF başarıyla diske kaydedildi.');
    return { success: true, path: savePath };
}

// Evrensel Belge Dönüştürücü (Universal Document Converter)
ipcMain.handle('convert-document', async (event, { filePath, targetFormat, savePath }) => {
    const sendDocProgress = (percent, stage, detail) => {
        try {
            event.sender.send('doc-conversion-progress', { percent, stage, detail });
        } catch(e) {}
    };

    try {
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        const target = (targetFormat || '').toLowerCase().replace('.', '');
        const HTMLtoDOCX = require('html-to-docx');
        const PDFParser = require('pdf2json');
        const { PDFDocument } = require('pdf-lib');
        
        sendDocProgress(10, 'Belge taranıyor...', `${ext.toUpperCase()} dosyası okunuyor...`);

        // 1. WORD (.docx)
        if (ext === 'docx') {
            if (target === 'pdf') {
                sendDocProgress(30, 'Word belgesi çözümleniyor...', 'Metin ve stiller ayrıştırılıyor...');
                const result = await mammoth.convertToHtml({ path: filePath });
                const styledHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                    th { background: #f1f5f9; font-weight: 600; }
                    img { max-width: 100%; height: auto; }
                    h1, h2, h3 { color: #0f172a; }
                </style></head><body>${result.value}</body></html>`;
                return await renderHtmlToPdf(styledHtml, savePath, sendDocProgress);
            } else if (target === 'txt' || target === 'md') {
                sendDocProgress(50, 'Metin ayıklanıyor...', 'Word içeriği ham metne dönüştürülüyor...');
                const result = await mammoth.extractRawText({ path: filePath });
                fs.writeFileSync(savePath, result.value, 'utf-8');
                sendDocProgress(100, 'Tamamlandı!', 'Metin belgesi başarıyla kaydedildi.');
                return { success: true, path: savePath };
            } else if (target === 'html') {
                sendDocProgress(50, 'HTML oluşturuluyor...', 'Web biçimine dönüştürülüyor...');
                const result = await mammoth.convertToHtml({ path: filePath });
                const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Belge</title><style>body{font-family:'Segoe UI',sans-serif;padding:30px;line-height:1.6;}</style></head><body>${result.value}</body></html>`;
                fs.writeFileSync(savePath, fullHtml, 'utf-8');
                sendDocProgress(100, 'Tamamlandı!', 'HTML belgesi kaydedildi.');
                return { success: true, path: savePath };
            }
        }
        
        // 2. EXCEL (.xlsx, .xls)
        if (ext === 'xlsx' || ext === 'xls') {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.getWorksheet(1);
            
            if (target === 'pdf') {
                const html = generateTableHtmlFromWorksheet(worksheet);
                return await renderHtmlToPdf(html, savePath);
            } else if (target === 'csv') {
                await workbook.csv.writeFile(savePath);
                return { success: true, path: savePath };
            } else if (target === 'json') {
                const rows = [];
                let headers = [];
                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) {
                        headers = row.values.slice(1).map(v => String(v || '').trim());
                    } else {
                        const obj = {};
                        row.values.slice(1).forEach((val, idx) => {
                            const key = headers[idx] || `sutun_${idx + 1}`;
                            obj[key] = val !== null && val !== undefined ? val : '';
                        });
                        rows.push(obj);
                    }
                });
                fs.writeFileSync(savePath, JSON.stringify(rows, null, 2), 'utf-8');
                return { success: true, path: savePath };
            } else if (target === 'html') {
                const html = generateTableHtmlFromWorksheet(worksheet);
                fs.writeFileSync(savePath, html, 'utf-8');
                return { success: true, path: savePath };
            } else if (target === 'txt') {
                let txt = '';
                worksheet.eachRow(row => {
                    txt += row.values.slice(1).map(v => String(v || '')).join('\t') + '\n';
                });
                fs.writeFileSync(savePath, txt, 'utf-8');
                return { success: true, path: savePath };
            }
        }
        
        // 3. CSV (.csv)
        if (ext === 'csv') {
            const workbook = new ExcelJS.Workbook();
            await workbook.csv.readFile(filePath);
            const worksheet = workbook.getWorksheet(1);
            
            if (target === 'xlsx') {
                await workbook.xlsx.writeFile(savePath);
                return { success: true, path: savePath };
            } else if (target === 'pdf') {
                const html = generateTableHtmlFromWorksheet(worksheet);
                return await renderHtmlToPdf(html, savePath);
            } else if (target === 'json') {
                const rows = [];
                let headers = [];
                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) {
                        headers = row.values.slice(1).map(v => String(v || '').trim());
                    } else {
                        const obj = {};
                        row.values.slice(1).forEach((val, idx) => {
                            const key = headers[idx] || `sutun_${idx + 1}`;
                            obj[key] = val !== null && val !== undefined ? val : '';
                        });
                        rows.push(obj);
                    }
                });
                fs.writeFileSync(savePath, JSON.stringify(rows, null, 2), 'utf-8');
                return { success: true, path: savePath };
            } else if (target === 'html') {
                const html = generateTableHtmlFromWorksheet(worksheet);
                fs.writeFileSync(savePath, html, 'utf-8');
                return { success: true, path: savePath };
            } else if (target === 'txt') {
                const raw = fs.readFileSync(filePath, 'utf-8');
                fs.writeFileSync(savePath, raw, 'utf-8');
                return { success: true, path: savePath };
            }
        }
        
        // 4. PDF (.pdf)
        if (ext === 'pdf') {
            const textContent = await new Promise((resolve, reject) => {
                const parser = new PDFParser(this, 1);
                parser.on("pdfParser_dataError", errData => reject(errData.parserError));
                parser.on("pdfParser_dataReady", () => resolve(parser.getRawTextContent()));
                parser.loadPDF(filePath);
            });
            const decodedText = decodeURIComponent(textContent || '');

            if (target === 'docx') {
                const htmlLines = decodedText.split('\n').map(line => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join('');
                const fileBuffer = await HTMLtoDOCX(htmlLines, null, { table: { row: { cantSplit: true } }, footer: true, pageNumber: true });
                fs.writeFileSync(savePath, fileBuffer);
                return { success: true, path: savePath };
            } else if (target === 'txt') {
                fs.writeFileSync(savePath, decodedText, 'utf-8');
                return { success: true, path: savePath };
            } else if (target === 'html') {
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PDF Metni</title><style>body{font-family:'Segoe UI',sans-serif;padding:30px;line-height:1.6;white-space:pre-wrap;}</style></head><body>${decodedText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body></html>`;
                fs.writeFileSync(savePath, html, 'utf-8');
                return { success: true, path: savePath };
            }
        }
        
        // 5. METİN & BELGE (.txt, .md, .html, .htm)
        if (ext === 'txt' || ext === 'md' || ext === 'html' || ext === 'htm') {
            const raw = fs.readFileSync(filePath, 'utf-8');
            if (target === 'pdf') {
                let htmlBody = raw;
                if (ext === 'txt' || ext === 'md') {
                    htmlBody = `<div style="white-space: pre-wrap; font-family: 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.6; color: #1e293b;">${raw.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
                }
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{padding:40px;}</style></head><body>${htmlBody}</body></html>`;
                return await renderHtmlToPdf(html, savePath);
            } else if (target === 'docx') {
                let htmlBody = raw;
                if (ext === 'txt' || ext === 'md') {
                    htmlBody = raw.split('\n').map(l => `<p>${l.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join('');
                }
                const fileBuffer = await HTMLtoDOCX(htmlBody, null, { table: { row: { cantSplit: true } }, footer: true, pageNumber: true });
                fs.writeFileSync(savePath, fileBuffer);
                return { success: true, path: savePath };
            } else if (target === 'txt') {
                const plain = raw.replace(/<[^>]*>/g, '');
                fs.writeFileSync(savePath, plain, 'utf-8');
                return { success: true, path: savePath };
            } else if (target === 'html') {
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><pre style="white-space:pre-wrap;font-family:'Segoe UI',sans-serif;padding:20px;">${raw.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`;
                fs.writeFileSync(savePath, html, 'utf-8');
                return { success: true, path: savePath };
            } else if (target === 'md') {
                fs.writeFileSync(savePath, raw, 'utf-8');
                return { success: true, path: savePath };
            }
        }
        
        // 6. JSON (.json)
        if (ext === 'json') {
            const jsonText = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(jsonText);
            const arrayData = Array.isArray(data) ? data : [data];
            
            if (target === 'xlsx' || target === 'csv' || target === 'pdf') {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Veri');
                const headers = Array.from(new Set(arrayData.flatMap(obj => typeof obj === 'object' && obj !== null ? Object.keys(obj) : ['deger'])));
                worksheet.addRow(headers);
                
                arrayData.forEach(item => {
                    if (typeof item === 'object' && item !== null) {
                        const row = headers.map(h => {
                            const val = item[h];
                            return typeof val === 'object' ? JSON.stringify(val) : (val !== undefined ? val : '');
                        });
                        worksheet.addRow(row);
                    } else {
                        worksheet.addRow([item]);
                    }
                });
                
                if (target === 'xlsx') {
                    await workbook.xlsx.writeFile(savePath);
                    return { success: true, path: savePath };
                } else if (target === 'csv') {
                    await workbook.csv.writeFile(savePath);
                    return { success: true, path: savePath };
                } else if (target === 'pdf') {
                    const html = generateTableHtmlFromWorksheet(worksheet);
                    return await renderHtmlToPdf(html, savePath);
                }
            } else if (target === 'txt' || target === 'md') {
                fs.writeFileSync(savePath, JSON.stringify(data, null, 2), 'utf-8');
                return { success: true, path: savePath };
            } else if (target === 'html') {
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{padding:20px;font-family:monospace;background:#f8fafc;color:#1e293b;}</style></head><body><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
                fs.writeFileSync(savePath, html, 'utf-8');
                return { success: true, path: savePath };
            }
        }
        
        // 7. GÖRSELLER (.png, .jpg, .jpeg, .webp, .bmp)
        if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) {
            if (target === 'pdf') {
                const pdfDoc = await PDFDocument.create();
                let imageBytes = fs.readFileSync(filePath);
                let image;
                if (ext === 'png') {
                    image = await pdfDoc.embedPng(imageBytes);
                } else if (ext === 'jpg' || ext === 'jpeg') {
                    image = await pdfDoc.embedJpg(imageBytes);
                } else {
                    const pngBuffer = await sharp(imageBytes).png().toBuffer();
                    image = await pdfDoc.embedPng(pngBuffer);
                }
                const page = pdfDoc.addPage([image.width, image.height]);
                page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
                const pdfBytes = await pdfDoc.save();
                fs.writeFileSync(savePath, pdfBytes);
                return { success: true, path: savePath };
            } else if (target === 'docx') {
                const { Document, Packer, Paragraph, ImageRun } = require('docx');
                const imageBuffer = await sharp(filePath).png().toBuffer();
                const meta = await sharp(imageBuffer).metadata();
                let w = meta.width;
                let h = meta.height;
                const maxW = 550;
                if (w > maxW) {
                    h = Math.round((h * maxW) / w);
                    w = maxW;
                }
                const doc = new Document({
                    sections: [{
                        children: [
                            new Paragraph({
                                children: [
                                    new ImageRun({
                                        data: imageBuffer,
                                        transformation: { width: w, height: h }
                                    })
                                ]
                            })
                        ]
                    }]
                });
                const buffer = await Packer.toBuffer(doc);
                fs.writeFileSync(savePath, buffer);
                return { success: true, path: savePath };
            }
        }

        return { success: false, error: `${ext.toUpperCase()} formatından ${target.toUpperCase()} formatına dönüştürme desteklenmiyor.` };
    } catch (err) {
        console.error('convert-document error:', err);
        return { success: false, error: err.message };
    }
});

// Excel -> PDF
ipcMain.handle('convert-excel-to-pdf', async (event, { filePath, savePath }) => {
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);
        
        let htmlTable = `<html><head><meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
        </style>
        </head><body><table>`;

        let isFirstRow = true;
        worksheet.eachRow(row => {
            let rowHtml = '<tr>';
            row.eachCell({ includeEmpty: true }, (cell) => {
                let cellValue = '';
                if (cell && cell.value !== null && cell.value !== undefined) {
                    if (cell.value.richText) {
                        cellValue = cell.value.richText.map(rt => rt.text).join('');
                    } else if (cell.value.result !== undefined) {
                        cellValue = cell.value.result;
                    } else if (cell.value.text !== undefined) {
                        cellValue = cell.value.text;
                    } else if (cell.value instanceof Date) {
                        cellValue = cell.value.toLocaleDateString();
                    } else {
                        cellValue = cell.value.toString();
                    }
                }
                
                // Explicitly convert to string to avoid "replace is not a function" on numbers/booleans
                cellValue = String(cellValue).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
                
                if (isFirstRow) rowHtml += `<th>${cellValue}</th>`;
                else rowHtml += `<td>${cellValue}</td>`;
            });
            rowHtml += '</tr>';
            htmlTable += rowHtml;
            isFirstRow = false;
        });

        htmlTable += `</table></body></html>`;

        const win = new BrowserWindow({ show: false });
        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlTable)}`);
        
        const pdf = await win.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4'
        });
        
        require('fs').writeFileSync(savePath, pdf);
        win.destroy();

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// PDF -> Word
ipcMain.handle('convert-pdf-to-word', async (event, { filePath, savePath }) => {
    try {
        const fs = require('fs');
        const HTMLtoDOCX = require('html-to-docx');
        const PDFParser = require('pdf2json');
        
        // pdf2json kullanarak metni güvenli bir şekilde (DOMMatrix hatası olmadan) çıkartalım.
        const textContent = await new Promise((resolve, reject) => {
            // '1' parametresi salt metin (raw text) modunu aktif eder
            const pdfParser = new PDFParser(this, 1);
            
            pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
            pdfParser.on("pdfParser_dataReady", () => {
                // PDFParser salt metni bazen aralara fazladan boşluklar koyarak okuyabiliyor
                resolve(pdfParser.getRawTextContent());
            });
            
            pdfParser.loadPDF(filePath);
        });
        
        // Düz metni paragraf (p) veya kırılımlı HTML'e çevir
        const lines = textContent
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('----------------Page'));
        
        const htmlContent = lines.length > 0
            ? lines.map(line => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join('')
            : '<p>(Metin bulunamadı veya taranmış resim belgesi)</p>';
        
        const fileBuffer = await HTMLtoDOCX(htmlContent, null, {
            table: { row: { cantSplit: true } },
            footer: true,
            pageNumber: true,
        });
        
        fs.writeFileSync(savePath, fileBuffer);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// PDF (Resim) -> Word
ipcMain.handle('convert-images-to-word', async (event, { images, savePath }) => {
    try {
        const fs = require('fs');
        const { Document, Packer, Paragraph, ImageRun } = require('docx');

        const doc = new Document({
            sections: images.map(base64Image => {
                return {
                    properties: {
                        page: {
                            margin: { top: 0, right: 0, bottom: 0, left: 0 }
                        }
                    },
                    children: [
                        new Paragraph({
                            children: [
                                new ImageRun({
                                    data: Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ""), "base64"),
                                    transformation: {
                                        width: 794,
                                        height: 1123
                                    }
                                })
                            ]
                        })
                    ]
                };
            })
        });

        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(savePath, buffer);
        
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Terminal Loglama (Geliştirici veya Kullanıcı bilgilendirme için)
ipcMain.on('log-to-terminal', (e, message) => {
    console.log("[PDF Çevirici] " + message);
});

// Dosyayı doğrudan RAM'e tampon (Buffer) olarak oku (Frontend Fetch hatalarını aşmak için)
ipcMain.handle('read-file-buffer', (event, filePath) => {
    try {
        const fs = require('fs');
        return { success: true, data: fs.readFileSync(filePath) };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Word İşlemleri
ipcMain.handle('read-word', async (e, path) => (await mammoth.convertToHtml({path: path})).value);

ipcMain.handle('save-to-word', async (e, { content, savePath }) => {
    try {
        const HTMLtoDOCX = require('html-to-docx');
        const fileBuffer = await HTMLtoDOCX(content, null, {
            table: { row: { cantSplit: true } },
            footer: true,
            pageNumber: true,
        });
        require('fs').writeFileSync(savePath, fileBuffer);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});
// URL Analiz
ipcMain.on('analyze-url', async (event, url) => {
    try {
        const ytdlp = getYtDlp();
        const options = {
            dumpJson: true,
            legacyServerConnect: true,
            noCheckCertificates: true,
            noWarnings: true
        };
        
        const metadata = await ytdlp(url, options);
        let resolutions = new Set();
        
        if (metadata.formats) {
            metadata.formats.forEach(f => {
                if (f.height) {
                    resolutions.add(f.height);
                }
            });
        }
        
        // Sort descending
        const sortedResolutions = Array.from(resolutions).sort((a, b) => b - a);
        event.reply('url-analyzed', sortedResolutions);
    } catch (err) {
        event.reply('url-analyze-error', err.message);
    }
});

// Sosyal Medya İndirici
ipcMain.on('download-social-media', async (event, { url, format, quality, savePath, isThumbnail }) => {
    try {
        const ytdlp = getYtDlp();
        
        let options = {
            o: savePath,
            ffmpegLocation: getFfmpegPath(),
            legacyServerConnect: true,
            rmCacheDir: true,
            noCheckCertificates: true,
            noWarnings: true,
            noContinue: true,
            forceOverwrites: true
        };

        if (isThumbnail) {
            options.skipDownload = true;
            options.writeThumbnail = true;
            options.convertThumbnails = 'jpg';
        } else if (format === 'mp3') {
            options.f = 'bestaudio';
            options.extractAudio = true;
            options.audioFormat = 'mp3';
        } else {
            options.mergeOutputFormat = format; // mp4, mkv or webm
            
            // Eğer MP4 istenmişse ffmpeg uyumsuzluğunu tamamen aşmak için 
            // videoyu mp4 (h.264), sesi m4a (aac) istiyoruz. (Youtube'da H.264 genelde max 1080p'dir)
            const videoExt = format === 'mp4' ? '[ext=mp4]' : '';
            const audioExt = format === 'mp4' ? '[ext=m4a]' : '';
            
            if (quality === 'best') {
                options.f = `bestvideo${videoExt}+bestaudio${audioExt}/best`;
            } else {
                options.f = `bestvideo[height<=${quality}]${videoExt}+bestaudio${audioExt}/best[height<=${quality}]`;
            }
        }

        const subprocess = ytdlp.exec(url, options);

        let lastError = "";
        subprocess.stderr.on('data', (data) => {
            lastError += data.toString() + "\n";
            console.error('yt-dlp stderr:', data.toString());
        });

        subprocess.stdout.on('data', (data) => {
            const output = data.toString();
            const progressMatch = output.match(/(\d+\.?\d*)%/);
            const speedMatch = output.match(/at\s+([\d\.]+\s*\w+\/s)/i);
            const etaMatch = output.match(/ETA\s+([\d:]+)/i);
            if (progressMatch) {
                const pct = parseFloat(progressMatch[1]);
                event.reply('download-progress', {
                    percent: pct,
                    speed: speedMatch ? `⚡ Hız: ${speedMatch[1]}` : '⚡ Hız: İndiriliyor...',
                    eta: etaMatch ? `⏳ Kalan: ${etaMatch[1]}` : '',
                    stage: pct >= 100 ? 'İndirme tamamlandı, dosya birleştiriliyor...' : 'Medya internetten indiriliyor...'
                });
            }
        });

        subprocess.on('close', (code) => {
            if (code === 0) {
                event.reply('download-done', savePath);
            } else {
                event.reply('download-error', `İndirme hatası (Kod ${code}): ${lastError.trim() || 'Bilinmeyen hata'}`);
            }
        });

        subprocess.on('error', (err) => {
            event.reply('download-error', err.message);
        });

    } catch (err) {
        event.reply('download-error', err.message);
    }
});

// PDF Araçları (Birleştir & Böl)
ipcMain.handle('merge-pdfs', async (event, { filePaths, savePath }) => {
    try {
        const { PDFDocument } = require('pdf-lib');
        const fs = require('fs');
        
        const mergedPdf = await PDFDocument.create();
        
        for (const path of filePaths) {
            const pdfBytes = fs.readFileSync(path);
            const pdf = await PDFDocument.load(pdfBytes);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
        
        const mergedPdfBytes = await mergedPdf.save();
        fs.writeFileSync(savePath, mergedPdfBytes);
        return { success: true, path: savePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('split-pdf', async (event, { filePath, splitAfterPage, savePathPart1, savePathPart2 }) => {
    try {
        const { PDFDocument } = require('pdf-lib');
        const fs = require('fs');
        
        const pdfBytes = fs.readFileSync(filePath);
        const originalPdf = await PDFDocument.load(pdfBytes);
        const totalPages = originalPdf.getPageCount();
        
        if (splitAfterPage < 1 || splitAfterPage >= totalPages) {
            return { success: false, error: `Geçersiz sayfa numarası. Toplam sayfa sayısı: ${totalPages}` };
        }
        
        // 1. Bölüm
        const part1 = await PDFDocument.create();
        const indices1 = Array.from({ length: splitAfterPage }, (_, i) => i);
        const copiedPages1 = await part1.copyPages(originalPdf, indices1);
        copiedPages1.forEach((page) => part1.addPage(page));
        fs.writeFileSync(savePathPart1, await part1.save());
        
        // 2. Bölüm
        const part2 = await PDFDocument.create();
        const indices2 = Array.from({ length: totalPages - splitAfterPage }, (_, i) => i + splitAfterPage);
        const copiedPages2 = await part2.copyPages(originalPdf, indices2);
        copiedPages2.forEach((page) => part2.addPage(page));
        fs.writeFileSync(savePathPart2, await part2.save());
        
        return { success: true, paths: [savePathPart1, savePathPart2] };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Dosya Konumunu Windows Gezgini'nde Göster
ipcMain.handle('show-item-in-folder', async (event, fullPath) => {
    try {
        if (fullPath && fs.existsSync(fullPath)) {
            shell.showItemInFolder(fullPath);
            return { success: true };
        }
        return { success: false, error: 'Dosya bulunamadı.' };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Dosyayı Varsayılan Uygulamayla Aç
ipcMain.handle('open-path', async (event, fullPath) => {
    try {
        if (fullPath && fs.existsSync(fullPath)) {
            const err = await shell.openPath(fullPath);
            if (err) return { success: false, error: err };
            return { success: true };
        }
        return { success: false, error: 'Dosya bulunamadı.' };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Medya Meta-Verisi ve Dosya Bilgileri (Çözünürlük, Codec, Boyut)
ipcMain.handle('get-media-metadata', async (event, filePath) => {
    try {
        if (!filePath || !fs.existsSync(filePath)) {
            return { success: false, error: 'Dosya bulunamadı.' };
        }
        const stats = fs.statSync(filePath);
        const parsed = path.parse(filePath);

        return new Promise((resolve) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                const baseInfo = {
                    success: true,
                    size: stats.size,
                    name: parsed.base,
                    ext: parsed.ext.replace('.', '').toLowerCase()
                };

                if (err || !metadata) {
                    return resolve(baseInfo);
                }

                try {
                    const format = metadata.format || {};
                    const videoStream = (metadata.streams || []).find(s => s.codec_type === 'video');
                    const audioStream = (metadata.streams || []).find(s => s.codec_type === 'audio');

                    let fps = null;
                    if (videoStream && videoStream.r_frame_rate) {
                        const parts = videoStream.r_frame_rate.split('/');
                        if (parts.length === 2 && parseFloat(parts[1]) > 0) {
                            fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
                        }
                    }

                    resolve({
                        ...baseInfo,
                        duration: format.duration ? parseFloat(format.duration) : null,
                        bitrate: format.bit_rate ? Math.round(parseInt(format.bit_rate) / 1000) : null,
                        formatName: format.format_long_name || format.format_name,
                        video: videoStream ? {
                            codec: videoStream.codec_name,
                            width: videoStream.width,
                            height: videoStream.height,
                            fps: fps
                        } : null,
                        audio: audioStream ? {
                            codec: audioStream.codec_name,
                            channels: audioStream.channels,
                            sampleRate: audioStream.sample_rate
                        } : null
                    });
                } catch(e) {
                    resolve(baseInfo);
                }
            });
        });
    } catch(err) {
        return { success: false, error: err.message };
    }
});

// Öğrenilen Kelimeleri Dışa Aktarma (JSON veya CSV)
ipcMain.handle('export-learned-words', async (event, { format }) => {
    try {
        const learnedWords = dictionaryEngine.getAllLearnedVocabulary();
        if (!learnedWords || learnedWords.length === 0) {
            return { success: false, error: 'Henüz öğrenilmiş veya kaydedilmiş kelime bulunmuyor.' };
        }

        const ext = format === 'csv' ? 'csv' : 'json';
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Kelime Listesini Dışa Aktar',
            defaultPath: `kelime_listesi_${new Date().toISOString().slice(0, 10)}.${ext}`,
            filters: [
                ext === 'csv' ? { name: 'Excel / CSV Dosyası (*.csv)', extensions: ['csv'] } : { name: 'JSON Dosyası (*.json)', extensions: ['json'] }
            ]
        });

        if (canceled || !filePath) return { success: false, canceled: true };

        if (ext === 'json') {
            fs.writeFileSync(filePath, JSON.stringify(learnedWords, null, 2), 'utf8');
        } else {
            const header = 'Kelime,Dil,Anlamlar,Ornek_Cumleler,Kayit_Tarihi\n';
            const rows = learnedWords.map(item => {
                const word = `"${(item.word || '').replace(/"/g, '""')}"`;
                const lang = `"${(item.sourceLang || item.lang || '').replace(/"/g, '""')}"`;
                const meanings = `"${(Array.isArray(item.meanings) ? item.meanings.join('; ') : '').replace(/"/g, '""')}"`;
                const examples = `"${(Array.isArray(item.examples) ? item.examples.map(e => typeof e === 'string' ? e : e.sentence || '').join('; ') : '').replace(/"/g, '""')}"`;
                const date = `"${(item.learnedAt || item.timestamp || '').replace(/"/g, '""')}"`;
                return `${word},${lang},${meanings},${examples},${date}`;
            }).join('\n');
            fs.writeFileSync(filePath, '\uFEFF' + header + rows, 'utf8'); // UTF-8 with BOM so Excel displays Turkish characters properly
        }

        return { success: true, filePath };
    } catch(err) {
        return { success: false, error: err.message };
    }
});

// =========================================================================
// 🎨 YENİ ÖZELLİK: GÖRSEL STÜDYOSU & GEMINI AI RÖTUŞ İŞLEYİCİLERİ
// =========================================================================

// Düzenlenmiş Tuval Görselini Kaydetme
ipcMain.handle('save-edited-image', async (event, { base64Data, targetPath, format = 'png', quality = 90 }) => {
    try {
        if (!base64Data) throw new Error('Resim verisi bulunamadı.');
        const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Clean, 'base64');
        const q = Math.max(1, Math.min(100, parseInt(quality) || 90));
        const fmt = (format || 'png').toLowerCase();

        let img = sharp(buffer);
        if (fmt === 'jpeg' || fmt === 'jpg') {
            img = img.jpeg({ quality: q, mozjpeg: true });
        } else if (fmt === 'webp') {
            img = img.webp({ quality: q });
        } else if (fmt === 'png') {
            const comp = Math.max(1, Math.min(9, Math.round((100 - q) / 11)));
            img = img.png({ compressionLevel: comp });
        }

        let outPath = targetPath;
        if (!outPath) {
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'Düzenlenmiş Görseli Kaydet',
                defaultPath: `fotograf_studyo_${Date.now()}.${fmt}`,
                filters: [{ name: `${fmt.toUpperCase()} Görsel`, extensions: [fmt] }]
            });
            if (canceled || !filePath) return { success: false, canceled: true };
            outPath = filePath;
        }

        await img.toFile(outPath);
        const stats = fs.statSync(outPath);
        return { success: true, path: outPath, size: stats.size };
    } catch (err) {
        console.error('save-edited-image hatası:', err);
        return { success: false, error: err.message };
    }
});

// Videodan Belirli Saniyede Önizleme / Kare (Thumbnail) Yakalama
ipcMain.handle('extract-video-thumbnail', async (event, { filePath, timestamp = 1 }) => {
    try {
        if (!filePath || !fs.existsSync(filePath)) throw new Error('Dosya bulunamadı.');
        const tempDir = path.join(app.getPath('temp'), 'multiconverter_thumbs');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const thumbName = `thumb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
        const thumbPath = path.join(tempDir, thumbName);

        await new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .seekInput(Math.max(0, parseFloat(timestamp) || 0))
                .outputOptions(['-vframes', '1', '-q:v', '2', '-y'])
                .save(thumbPath)
                .on('end', () => resolve(true))
                .on('error', (err) => reject(err));
        });

        if (fs.existsSync(thumbPath)) {
            const buf = fs.readFileSync(thumbPath);
            const base64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
            try { fs.unlinkSync(thumbPath); } catch (e) {}
            return { success: true, base64 };
        }
        throw new Error('Video karesi çıkarılamadı.');
    } catch (err) {
        console.error('extract-video-thumbnail hatası:', err);
        return { success: false, error: err.message };
    }
});

// Gemini Vision Yapay Zeka Akıllı Rötuş & Analiz Motoru
ipcMain.handle('gemini-ai-retouch', async (event, { apiKey, imageBase64, mode = 'auto_enhance', customPrompt = '' }) => {
    try {
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
            throw new Error('Lütfen geçerli bir Google Gemini API anahtarı girin.');
        }
        if (!imageBase64) throw new Error('İşlenecek görsel verisi bulunamadı.');

        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        let promptText = '';
        if (mode === 'auto_enhance') {
            promptText = `Sen profesyonel bir fotoğraf editörü ve renk uzmanısın (Master Retoucher). Bu görselin ışığını, gölgelerini, renk sıcaklığını, kontrastını ve doygunluğunu analiz et.
Görseli en estetik, dengeli ve kaliteli hale getirecek filtre değerlerini belirle.
Aşağıdaki JSON formatında YALNIZCA geçerli bir JSON döndür, hiçbir markdown etiketi veya backtick (\\\`\\\`\\\`) ekleme:
{
  "brightness": 10,
  "contrast": 15,
  "saturation": 12,
  "warmth": 5,
  "sharpen": true,
  "blur": 0,
  "explanation": "Fotoğrafın renkleri ve aydınlatması profesyonelce dengelendi, detaylar netleştirildi."
}`;
        } else if (mode === 'custom_prompt') {
            promptText = `Sen profesyonel bir görsel düzenleme ve stilize etme yapay zekasısın.
Kullanıcının şu istek ve talimatını bu görsel üzerinde gerçekleştirecek filtre parametrelerini hesapla:
TALİMAT: "${customPrompt}"

Aşağıdaki JSON formatında YALNIZCA geçerli bir JSON döndür, hiçbir markdown etiketi veya backtick (\\\`\\\`\\\`) ekleme:
{
  "brightness": 0,
  "contrast": 20,
  "saturation": 10,
  "warmth": 15,
  "blur": 0,
  "grayscale": false,
  "sepia": false,
  "invert": false,
  "explanation": "Talimat doğrultusunda uygulanan değişikliklerin Türkçe kısa açıklaması"
}`;
        } else if (mode === 'creative_caption') {
            promptText = `Sen yaratıcı bir sosyal medya ve tipografi uzmanısın. Bu görseli analiz et ve görselin üzerine yerleştirilebilecek 3 farklı yaratıcı, estetik başlık/alıntı önerisi üret.
Aşağıdaki JSON formatında YALNIZCA geçerli bir JSON döndür, hiçbir markdown etiketi veya backtick (\\\`\\\`\\\`) ekleme:
{
  "suggestions": [
    {
      "title": "Kısa ve çarpıcı ana başlık",
      "subtitle": "Açıklayıcı alt metin veya motto",
      "font": "Inter",
      "color": "#ffffff",
      "bgColor": "rgba(0,0,0,0.6)"
    }
  ],
  "photoInsight": "Görselin teması ve kompozisyonu hakkında 1 cümlelik Türkçe analiz"
}`;
        }

        const payload = {
            contents: [
                {
                    parts: [
                        { text: promptText },
                        {
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: cleanBase64
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1000
            }
        };

        const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
        let lastErr = null;

        for (const model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!resp.ok) {
                    const errBody = await resp.text();
                    throw new Error(`Gemini API (${model}) [HTTP ${resp.status}]: ${errBody}`);
                }

                const result = await resp.json();
                const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!rawText) throw new Error('Gemini API yanıt üretmedi.');

                let cleanedJson = rawText.trim();
                if (cleanedJson.startsWith('```')) {
                    cleanedJson = cleanedJson.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
                }

                const parsedData = JSON.parse(cleanedJson);
                return { success: true, model, data: parsedData };
            } catch (err) {
                lastErr = err;
                console.warn(`Model ${model} yanıt vermedi, sonrakine geçiliyor:`, err.message);
            }
        }

        throw lastErr || new Error('Gemini yapay zeka servisine bağlanılamadı.');
    } catch (err) {
        console.error('gemini-ai-retouch hatası:', err);
        return { success: false, error: err.message };
    }
});

// =========================================================================
// ✂️ YENİ ÖZELLİK: VİDEO & SES STÜDYOSU MOTORU (FFmpeg Gelişmiş Editör)
// =========================================================================

// Gelişmiş Video Düzenleyici (Kırpma, Filtre, Hız, Döndürme, Katman Yazı/PNG, Ses Miksleme, Birleştirme)
ipcMain.on('edit-video-advanced', async (event, data) => {
    const tempFilesToClean = [];
    try {
        const {
            filePath,
            targetPath,
            trim = {},
            filters = {},
            overlayPngBase64,
            audioOption = {},
            appendVideos = []
        } = data;

        if (!filePath || !fs.existsSync(filePath)) {
            event.reply('video-edit-error', 'Kaynak video dosyası bulunamadı.');
            return;
        }

        const parsed = path.parse(filePath);
        const format = (data.outputFormat || parsed.ext.replace('.', '') || 'mp4').toLowerCase();
        const outPath = targetPath || path.join(parsed.dir, `${parsed.name}_studyo.${format}`);

        const tempDir = path.join(app.getPath('temp'), 'multiconverter_studio');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Overlay Görseli (Eğer yazı veya filigran tuvali varsa)
        let overlayImgPath = null;
        if (overlayPngBase64) {
            overlayImgPath = path.join(tempDir, `overlay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.png`);
            const cleanBuf = Buffer.from(overlayPngBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            fs.writeFileSync(overlayImgPath, cleanBuf);
            tempFilesToClean.push(overlayImgPath);
        }

        let cmd = ffmpeg(filePath);

        // Kırpma (Trim)
        const startTime = parseFloat(trim.start) || 0;
        const endTime = trim.end != null && !Number.isNaN(parseFloat(trim.end)) ? parseFloat(trim.end) : null;
        let effectiveDuration = null;

        if (startTime > 0) {
            cmd.setStartTime(startTime);
        }
        if (endTime != null && endTime > startTime) {
            effectiveDuration = endTime - startTime;
            cmd.duration(effectiveDuration);
        }

        // Video Filtre Zinciri (Filter Graph)
        const vfList = [];

        // 1. Parlaklık, Kontrast ve Doygunluk (eq)
        const bVal = (parseFloat(filters.brightness) || 0) / 100; // -1.0 .. 1.0
        const cVal = 1 + ((parseFloat(filters.contrast) || 0) / 100); // 0.0 .. 2.0
        const sVal = 1 + ((parseFloat(filters.saturation) || 0) / 100); // 0.0 .. 3.0
        if (bVal !== 0 || cVal !== 1 || sVal !== 1) {
            vfList.push(`eq=brightness=${bVal.toFixed(2)}:contrast=${cVal.toFixed(2)}:saturation=${sVal.toFixed(2)}`);
        }

        // 2. Renk Efektleri (Siyah-Beyaz / Sepya)
        if (filters.grayscale) {
            vfList.push('hue=s=0');
        } else if (filters.sepia) {
            vfList.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
        }

        // 3. Döndürme & Çevirme
        if (filters.rotate === 90) vfList.push('transpose=1');
        else if (filters.rotate === 180) vfList.push('transpose=1,transpose=1');
        else if (filters.rotate === 270) vfList.push('transpose=2');

        if (filters.flipH) vfList.push('hflip');
        if (filters.flipV) vfList.push('vflip');

        // 4. Hız Ayarı (Video PTS & Audio atempo)
        const speed = parseFloat(filters.speed) || 1.0;
        const afList = [];
        if (speed > 0 && speed !== 1.0) {
            vfList.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
            // Audio tempo filter supports 0.5 to 2.0. Chain if needed
            if (speed <= 2.0 && speed >= 0.5) {
                afList.push(`atempo=${speed.toFixed(2)}`);
            } else if (speed > 2.0) {
                afList.push(`atempo=2.0,atempo=${(speed / 2.0).toFixed(2)}`);
            } else if (speed < 0.5) {
                afList.push(`atempo=0.5,atempo=${(speed / 0.5).toFixed(2)}`);
            }
        }

        // Overlay Girişi Varsa
        if (overlayImgPath) {
            cmd.input(overlayImgPath);
            vfList.push('overlay=0:0');
        }

        // İkincil Ses (Müzik / Ses Değiştirme veya Miksleme)
        if (audioOption.secondaryAudioPath && fs.existsSync(audioOption.secondaryAudioPath)) {
            cmd.input(audioOption.secondaryAudioPath);
            if (audioOption.mode === 'replace') {
                // Sadece yeni sesi al
                cmd.outputOptions(['-map', '0:v:0', '-map', '1:a:0', '-shortest']);
            } else if (audioOption.mode === 'mix') {
                const origVol = parseFloat(audioOption.originalVolume) || 1.0;
                const secVol = parseFloat(audioOption.secondaryVolume) || 0.6;
                cmd.complexFilter([
                    `[0:a]volume=${origVol}[a0]`,
                    `[1:a]volume=${secVol}[a1]`,
                    `[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]`
                ], ['aout']);
            }
        } else if (audioOption.mode === 'mute') {
            cmd.noAudio();
        }

        if (vfList.length > 0) {
            cmd.videoFilters(vfList);
        }
        if (afList.length > 0 && audioOption.mode !== 'mute' && audioOption.mode !== 'mix') {
            cmd.audioFilters(afList);
        }

        // Format ve Codec Ayarları
        if (format === 'mp4') {
            cmd.videoCodec('libx264').audioCodec('aac').outputOptions(['-pix_fmt', 'yuv420p', '-movflags', '+faststart']);
        } else if (format === 'webm') {
            cmd.videoCodec('libvpx-vp9').audioCodec('libopus');
        } else if (format === 'mkv') {
            cmd.videoCodec('libx264').audioCodec('aac');
        }

        event.reply('video-edit-progress', {
            percent: 0,
            timemark: '00:00:00',
            stage: 'Video stüdyosu hazırlanıyor...'
        });

        cmd
            .outputOptions('-y')
            .on('progress', (p) => {
                let pct = null;
                if (typeof p.percent === 'number' && Number.isFinite(p.percent) && p.percent > 0) {
                    pct = p.percent;
                } else if (effectiveDuration && p.timemark) {
                    const secs = parseTimemarkToSeconds(p.timemark);
                    if (secs != null && secs > 0) pct = (secs / effectiveDuration) * 100;
                }
                event.reply('video-edit-progress', {
                    percent: pct != null ? Math.min(99.5, Math.max(0.5, pct)) : null,
                    timemark: p.timemark || '00:00:00',
                    fps: p.currentFps ? Math.round(p.currentFps) : null,
                    stage: 'Video efektleri ve filtreleri işleniyor...'
                });
            })
            .on('end', () => {
                tempFilesToClean.forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
                event.reply('video-edit-progress', { percent: 100, stage: 'İşlem tamamlandı!' });
                event.reply('video-edit-done', outPath);
            })
            .on('error', (err) => {
                tempFilesToClean.forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
                console.error('edit-video-advanced ffmpeg hatası:', err.message);
                event.reply('video-edit-error', err.message);
            })
            .save(outPath);
    } catch (err) {
        tempFilesToClean.forEach(f => { try { fs.unlinkSync(f); } catch (e) {} });
        console.error('edit-video-advanced genel hata:', err);
        event.reply('video-edit-error', err.message);
    }
});

// Gelişmiş Ses Düzenleyici (Kırpma, Ses Düzeyi Yükseltme/Normalizasyon, Fade In/Out, Hız, Arka Plan Sesi Ekleme)
ipcMain.on('edit-audio-advanced', async (event, data) => {
    try {
        const {
            filePath,
            targetPath,
            outputFormat = 'mp3',
            trim = {},
            volumeBoost = 100, // %
            fadeIn = 0, // sn
            fadeOut = 0, // sn
            speed = 1.0,
            secondaryAudioPath,
            secondaryVolume = 50
        } = data;

        if (!filePath || !fs.existsSync(filePath)) {
            event.reply('audio-edit-error', 'Kaynak ses dosyası bulunamadı.');
            return;
        }

        const parsed = path.parse(filePath);
        const format = (outputFormat || 'mp3').toLowerCase();
        const outPath = targetPath || path.join(parsed.dir, `${parsed.name}_ses_studyo.${format}`);

        let cmd = ffmpeg(filePath).noVideo();

        // Kırpma
        const startTime = parseFloat(trim.start) || 0;
        const endTime = trim.end != null && !Number.isNaN(parseFloat(trim.end)) ? parseFloat(trim.end) : null;
        let effectiveDuration = null;

        if (startTime > 0) cmd.setStartTime(startTime);
        if (endTime != null && endTime > startTime) {
            effectiveDuration = endTime - startTime;
            cmd.duration(effectiveDuration);
        }

        const afList = [];

        // 1. Ses Seviyesi (Volume Boost: %50 .. %300)
        const volMultiplier = (parseFloat(volumeBoost) || 100) / 100;
        if (volMultiplier !== 1.0) {
            afList.push(`volume=${volMultiplier.toFixed(2)}`);
        }

        // 2. Fade In (Yumuşak Giriş)
        const fIn = parseFloat(fadeIn) || 0;
        if (fIn > 0) {
            afList.push(`afade=t=in:ss=0:d=${fIn.toFixed(1)}`);
        }

        // 3. Fade Out (Yumuşak Çıkış)
        const fOut = parseFloat(fadeOut) || 0;
        if (fOut > 0 && effectiveDuration && effectiveDuration > fOut) {
            const startFadeOut = effectiveDuration - fOut;
            afList.push(`afade=t=out:st=${startFadeOut.toFixed(1)}:d=${fOut.toFixed(1)}`);
        }

        // 4. Hız / Tempo
        const spd = parseFloat(speed) || 1.0;
        if (spd > 0 && spd !== 1.0) {
            if (spd <= 2.0 && spd >= 0.5) afList.push(`atempo=${spd.toFixed(2)}`);
            else if (spd > 2.0) afList.push(`atempo=2.0,atempo=${(spd / 2.0).toFixed(2)}`);
            else if (spd < 0.5) afList.push(`atempo=0.5,atempo=${(spd / 0.5).toFixed(2)}`);
        }

        // İkinci Ses Miksleme (Arka Plan Müziği)
        if (secondaryAudioPath && fs.existsSync(secondaryAudioPath)) {
            cmd.input(secondaryAudioPath);
            const sVol = (parseFloat(secondaryVolume) || 50) / 100;
            cmd.complexFilter([
                `[0:a]${afList.length > 0 ? afList.join(',') + ',' : ''}volume=1.0[a0]`,
                `[1:a]volume=${sVol.toFixed(2)}[a1]`,
                `[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]`
            ], ['aout']);
        } else if (afList.length > 0) {
            cmd.audioFilters(afList);
        }

        // Format Kodlayıcı
        if (format === 'mp3') cmd.audioCodec('libmp3lame').audioBitrate(320);
        else if (format === 'wav') cmd.audioCodec('pcm_s16le');
        else if (format === 'flac') cmd.audioCodec('flac');
        else if (format === 'm4a' || format === 'aac') cmd.audioCodec('aac').audioBitrate(256);
        else if (format === 'ogg') cmd.audioCodec('libvorbis');

        event.reply('audio-edit-progress', { percent: 0, stage: 'Ses stüdyosu hazırlanıyor...' });

        cmd
            .outputOptions('-y')
            .on('progress', (p) => {
                let pct = null;
                if (typeof p.percent === 'number' && Number.isFinite(p.percent) && p.percent > 0) {
                    pct = p.percent;
                } else if (effectiveDuration && p.timemark) {
                    const secs = parseTimemarkToSeconds(p.timemark);
                    if (secs != null && secs > 0) pct = (secs / effectiveDuration) * 100;
                }
                event.reply('audio-edit-progress', {
                    percent: pct != null ? Math.min(99.5, Math.max(0.5, pct)) : null,
                    timemark: p.timemark || '00:00:00',
                    stage: 'Ses dalgaları işleniyor ve filtreleniyor...'
                });
            })
            .on('end', () => {
                event.reply('audio-edit-progress', { percent: 100, stage: 'Ses işlemi tamamlandı!' });
                event.reply('audio-edit-done', outPath);
            })
            .on('error', (err) => {
                console.error('edit-audio-advanced ffmpeg hatası:', err.message);
                event.reply('audio-edit-error', err.message);
            })
            .save(outPath);
    } catch (err) {
        console.error('edit-audio-advanced genel hata:', err);
        event.reply('audio-edit-error', err.message);
    }
});