const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    convertMedia: (data) => ipcRenderer.send('convert-media', data),
    openFileDialog: (filters) => ipcRenderer.invoke('open-file-dialog', filters),
    saveFileDialog: (extension) => ipcRenderer.invoke('save-file-dialog', extension),
    processImageSharp: (data) => ipcRenderer.invoke('process-image-sharp', data),
    convertExcelToPdf: (data) => ipcRenderer.invoke('convert-excel-to-pdf', data),
    convertPdfToWord: (data) => ipcRenderer.invoke('convert-pdf-to-word', data),
    convertImagesToWord: (data) => ipcRenderer.invoke('convert-images-to-word', data),
    mergePdfs: (data) => ipcRenderer.invoke('merge-pdfs', data),
    splitPdf: (data) => ipcRenderer.invoke('split-pdf', data),
    readFileBuffer: (path) => ipcRenderer.invoke('read-file-buffer', path),
    logToTerminal: (msg) => ipcRenderer.send('log-to-terminal', msg),
    readWord: (path) => ipcRenderer.invoke('read-word', path),
    saveToWord: (data) => ipcRenderer.invoke('save-to-word', data),
    windowMinimize: () => ipcRenderer.send('window-minimize'),
    windowMaximize: () => ipcRenderer.send('window-maximize'),
    windowClose: () => ipcRenderer.send('window-close'),

    // Listeners
    onWindowMaximizedChanged: (callback) => ipcRenderer.on('window-maximized-changed', (event, value) => callback(value)),
    onConversionProgress: (callback) => ipcRenderer.on('conversion-progress', (event, value) => callback(value)),
    onConversionDone: (callback) => ipcRenderer.on('conversion-done', (event, path) => callback(path)),
    onConversionError: (callback) => ipcRenderer.on('conversion-error', (event, err) => callback(err)),
    // New feature: Social Media Downloader
    analyzeUrl: (url) => ipcRenderer.send('analyze-url', url),
    onUrlAnalyzed: (callback) => ipcRenderer.on('url-analyzed', (event, data) => callback(data)),
    onUrlAnalyzeError: (callback) => ipcRenderer.on('url-analyze-error', (event, err) => callback(err)),
    downloadSocialMedia: (data) => ipcRenderer.send('download-social-media', data),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, value) => callback(value)),
    onDownloadDone: (callback) => ipcRenderer.on('download-done', (event, path) => callback(path)),
    onDownloadError: (callback) => ipcRenderer.on('download-error', (event, err) => callback(err))
});
