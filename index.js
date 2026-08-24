const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { jsPDF } = require('jspdf');
const { Document, Packer, Paragraph, TextRun } = require("docx");
const mammoth = require("mammoth");
require('jspdf-autotable');

function getFfmpegPath() {
    const installed = ffmpegInstaller.path;
    if (!app.isPackaged) return installed;
    const unpacked = installed.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    return fs.existsSync(unpacked) ? unpacked : installed;
}
ffmpeg.setFfmpegPath(getFfmpegPath());

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

function createWindow() {
    const winOpts = {
        width: 1100,
        height: 750,
        backgroundColor: '#121212',
        frame: false, // Windows çerçevesini kapatır (custom title bar görünsün)
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
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
    win.loadFile('index.html');

    // Maximize/restore ikonunu gerçek pencere durumuna göre güncelle.
    win.on('maximize', () => win.webContents.send('window-maximized-changed', true));
    win.on('unmaximize', () => win.webContents.send('window-maximized-changed', false));
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('window-maximized-changed', win.isMaximized());
    });
    
    // Pencere Kontrol Kanalları (Yeni Çubuk İçin)
    ipcMain.on('window-minimize', () => win.minimize());
    ipcMain.on('window-maximize', () => {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    });
    ipcMain.on('window-close', () => win.close());
}

// Windows Görev Çubuğu Özelleştirmesi
app.whenReady().then(() => {
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
    createWindow();
});

// Medya Dönüştürme
ipcMain.on('convert-media', (event, { filePath, outputFormat, startTime, endTime }) => {
    const parsed = path.parse(filePath);
    const outputPath = path.join(parsed.dir, `${parsed.name}_islenmis.${outputFormat}`);
    const start = Number(startTime) || 0;
    const end = endTime != null && !Number.isNaN(Number(endTime)) ? Number(endTime) : null;

    let command = ffmpeg(filePath).setStartTime(start);
    if (end != null && end > start) command.duration(end - start);

    command
        .outputOptions('-y')
        .toFormat(outputFormat)
        .on('progress', (p) => {
            const pct = typeof p.percent === 'number' && Number.isFinite(p.percent) ? p.percent : null;
            if (pct != null) event.reply('conversion-progress', pct);
        })
        .on('end', () => event.reply('conversion-done', outputPath))
        .on('error', (err) => {
            console.error('ffmpeg:', err.message);
            event.reply('conversion-error', err.message);
        })
        .save(outputPath);
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

// Resim İşleme (Artık hedef yolu parametre olarak alıyor)
ipcMain.handle('process-image-sharp', async (event, { filePath, targetPath, options }) => {
    try {
        const outPath = targetPath || (filePath.split('.')[0] + `_islenmis.${options.format}`);
        
        let img = sharp(filePath);
        
        // FİLİGRAN KODU
        if (options.watermark) {
            img = img.composite([{
                input: options.watermark,
                gravity: options.watermarkPosition || 'southeast',
                blend: 'over'
            }]);
        }
        
        // Kırpma işlemi (öncelikli)
        if (options.crop) {
            img = img.extract({
                left: Math.round(options.crop.x),
                top: Math.round(options.crop.y),
                width: Math.round(options.crop.width),
                height: Math.round(options.crop.height)
            });
        }
        
        // Boyutlandırma işlemi (Kırpmadan sonra yapılması daha mantıklıdır)
        if (options.width || options.height) {
            img = img.resize(parseInt(options.width) || null, parseInt(options.height) || null);
        }
        
        if (options.grayscale) img = img.grayscale();
        
        await img.toFormat(options.format).toFile(outPath);
        return { success: true, path: outPath };
    } catch (err) { return { success: false, error: err.message }; }
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
        const htmlContent = textContent.split('\n').map(line => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join('');
        
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
        const ytdlp = require('yt-dlp-exec');
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
        const ytdlp = require('yt-dlp-exec');
        
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
            // Try to extract percentage
            const progressMatch = output.match(/(\d+\.\d+)%/);
            if (progressMatch) {
                const pct = parseFloat(progressMatch[1]);
                event.reply('download-progress', pct);
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