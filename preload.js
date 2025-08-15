const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

    selectProxy: (proxy) => ipcRenderer.invoke('proxy-selected', proxy),
    onLoadProxies: (callback) => ipcRenderer.on('load-proxies', (event, ...args) => callback(...args)),

    navigateTo: (url) => ipcRenderer.send('navigate-to', url),
    navBack: () => ipcRenderer.send('nav-back'),
    navForward: () => ipcRenderer.send('nav-forward'),
    navReload: () => ipcRenderer.send('nav-reload'),
    onURLUpdate: (callback) => ipcRenderer.on('url-updated', (event, url) => callback(url)),
    openLogDirectory: (path) => ipcRenderer.invoke('open-log-directory', path),
    openLogViewer: () => ipcRenderer.invoke('open-log-viewer'),
    onSetLoadingState: (callback) => ipcRenderer.on('set-loading-state', (event, isLoading) => callback(isLoading)),
    onSetAppInfo: (callback) => ipcRenderer.on('set-app-info', (event, info) => callback(info)),

    onSetInitialLogPath: (callback) => ipcRenderer.on('set-initial-log-path', (event, path) => callback(path)),
    selectLogDirectory: () => ipcRenderer.invoke('select-log-directory'),
    onLogDirectorySelected: (callback) => ipcRenderer.on('log-directory-selected', (event, path) => callback(path)),
    onUpdateLogStatus: (callback) => ipcRenderer.on('update-log-status', (event, status) => callback(status)),
    onNewLogEntry: (callback) => ipcRenderer.on('new-log-entry', (event, logEntry) => callback(logEntry)),
    takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
    

    onSetFilterPatterns: (callback) => ipcRenderer.on('set-filter-patterns', (event, patterns) => callback(patterns)),
    

    onSetAutoScreenshotState: (callback) => ipcRenderer.on('set-auto-screenshot-state', (event, enabled) => callback(enabled)),
    

    getExistingLogs: () => ipcRenderer.invoke('get-existing-logs'),
    clearLogs: () => ipcRenderer.invoke('clear-logs'),
    openJsonlFile: () => ipcRenderer.invoke('open-jsonl-file'),
    

    saveScreenshot: (imageData, filename) => ipcRenderer.invoke('save-screenshot', imageData, filename),
    copyScreenshot: (imageData) => ipcRenderer.invoke('copy-screenshot', imageData),
    

    getCurrentProxy: () => ipcRenderer.invoke('get-current-proxy'),
    applyQuickProxyChange: (proxyUrl) => ipcRenderer.invoke('apply-quick-proxy-change', proxyUrl),
    

    reportMouseActivity: () => ipcRenderer.send('report-mouse-activity'),
});
