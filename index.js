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
            nodeIntegration: true,
            contextIsolation: false
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
        if (options.width || options.height) {
            img = img.resize(parseInt(options.width) || null, parseInt(options.height) || null);
        }
        if (options.grayscale) img = img.grayscale();
        
        // FİLİGRAN KODU
        if (options.watermark) {
            img = img.composite([{
                input: options.watermark,
                gravity: 'southeast', // Sağ alt köşeye hizala
                blend: 'over' // Üstüne bindir
            }]);
        }
        
        await img.toFormat(options.format).toFile(outPath);
        return { success: true, path: outPath };
    } catch (err) { return { success: false, error: err.message }; }
});

// Excel -> PDF
ipcMain.on('convert-excel-to-pdf', async (event, filePath) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    const doc = new jsPDF();
    const data = [];
    worksheet.eachRow(row => data.push(row.values.slice(1)));
    doc.autoTable({ head: [data[0]], body: data.slice(1) });
    const out = filePath.replace('.xlsx', '.pdf');
    doc.save(out);
    event.reply('doc-conversion-done', out);
});

// Word İşlemleri
ipcMain.handle('read-word', async (e, path) => (await mammoth.convertToHtml({path: path})).value);

ipcMain.on('save-to-word', async (e, { content, savePath }) => {
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun(content)] })] }] });
    fs.writeFileSync(savePath, await Packer.toBuffer(doc));
    e.reply('word-saved', savePath);
});