const {app, BrowserWindow, BrowserView, ipcMain, session, Menu, dialog, net, shell, desktopCapturer, nativeImage, clipboard} = require('electron');
const path = require('path');
const fs =require('fs');
const ProxyChain = require('proxy-chain');
const crypto = require('crypto');

const getAssetPath = (assetName) => {
    return path.join(__dirname, assetName);
};

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
app.commandLine.appendSwitch('webrtc-ip-handling-policy', 'default_public_interface_only');
app.commandLine.appendSwitch('enable-webrtc-hide-local-ips-with-mdns', 'true');
app.commandLine.appendSwitch('disable-webgl-debug-renderer-info');

let autoScreenshot = true;
let actProxy = '';
const BYPASS_DOMAINS = [
    '<local>',
].join(',');


let mainWindow = null;
let browserView = null;
let proxySelectorWindow = null;
let logViewerWindow = null;
let quickProxyChangeWindow = null;
let persistentAnonymizedProxyUrl = null;
let isLoggingEnabled = true;
const proxiesFilePath = path.join(app.getPath('userData'), 'proxies.json');
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');
const iconPath = getAssetPath('img.png');
let currentLogFilePath = null;
let logStatusInterval = null;
let userSelectedLogPath = null;
const BROWSER_PARTITION = 'persist:browser_session';
let cleanUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
let autoScreenshotEnabled = false;
let screenshotInterval = null;
let isWindowActive = false;
let lastMouseMoveTime = 0;
const MOUSE_ACTIVITY_TIMEOUT = 90000; 


function loadProxies() {
    try {
        if (fs.existsSync(proxiesFilePath)) {
            return JSON.parse(fs.readFileSync(proxiesFilePath, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load proxies:', e);
    }
    return [];
}

function saveProxies(proxies) {
    try {
        fs.writeFileSync(proxiesFilePath, JSON.stringify(proxies, null, 2));
    } catch (e) {
        console.error('Failed to save proxies:', e);
    }
}


function loadSettings() {
    let defaultExclude = [
        '*google.com*',
        '*cloudflare.com*',
        '*analytics*',
        '*tracking*'
    ];

    try {
        if (fs.existsSync(settingsFilePath)) {
            const raw = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
            return {
                lastLogPath: raw.lastLogPath ?? null,
                filterPatterns: Array.isArray(raw.filterPatterns) ? raw.filterPatterns : defaultExclude,
                autoScreenshot: raw.autoScreenshot ?? false
            };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }

    return {
        lastLogPath: null,
        filterPatterns: defaultExclude,
        autoScreenshot: false
    };
}

function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function getRealIp() {
    console.log('[Info]: Getting real IP address...');
    try {
        const response = await net.fetch('https://ipinfo.io/json');
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        const data = await response.json();
        console.log(`[Info]: ✅ Real IP obtained: ${data.ip}`);
        return data.ip || 'Could not determine';
    } catch (error) {
        console.error('[Info]: ❌ Failed to get real IP:', error.message);
        return 'Could not determine';
    }
}

function sanitizeProxyUrl(proxyUrl) {
    return proxyUrl;
    try {
        const url = new URL(proxyUrl);
        if (url.password) {
            url.password = encodeURIComponent(url.password);
        }
        if (url.username) {
            url.username = encodeURIComponent(url.username);
        }
        return url.toString();
    } catch (e) {
        console.warn('Failed to parse proxy URL for sanitization, using original string.');
        return proxyUrl;
    }
}

async function setupBrowserView(proxyRules = '', indexView = true) {
    console.log(`[ViewSetup] Setting up BrowserView with proxy rules: "${proxyRules}"`);
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (browserView && !browserView.webContents.isDestroyed()) {
        console.log('[ViewSetup] Destroying old BrowserView...');
        mainWindow.removeBrowserView(browserView);
        browserView.webContents.destroy();
        browserView = null;
    }

    const browserSession = session.fromPartition(BROWSER_PARTITION);

    await browserSession.setProxy({
        proxyRules: proxyRules,
        proxyBypassRules: BYPASS_DOMAINS
    });
    console.log('[ViewSetup] ✅ Proxy set for session. Verification:', await browserSession.resolveProxy('https://ipinfo.io/'));

    browserView = new BrowserView({
        webPreferences: {
            session: browserSession,
            preload: path.join(__dirname, 'preload-view.js'),
            contextIsolation: true,
        }
    });

    mainWindow.setBrowserView(browserView);
    const toolbarHeight = 85;
    const updateBounds = () => {
        if (!mainWindow || mainWindow.isDestroyed() || !browserView || browserView.webContents.isDestroyed()) return;
        const cb = mainWindow.getContentBounds();
        browserView.setBounds({x: 0, y: toolbarHeight, width: cb.width, height: cb.height - toolbarHeight});
    };

    mainWindow.on('resize', updateBounds);
    updateBounds();

    setupNetworkLogging(browserView.webContents, proxyRules);
    browserView.webContents.setWindowOpenHandler(({url}) => {
        console.log(`[WindowOpener] Intercepted attempt to open new window for: ${url}`);
        if (browserView && !browserView.webContents.isDestroyed()) {
            browserView.webContents.loadURL(url);
        }
        return {action: 'deny'};
    });
    browserView.webContents.on('did-start-loading', () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('set-loading-state', true);
    });
    browserView.webContents.on('did-stop-loading', () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('set-loading-state', false);
    });
    browserView.webContents.on('did-fail-load', () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('set-loading-state', false);
    });
    browserView.webContents.on('did-navigate', (event, url) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('url-updated', url);
    });

    if(indexView){
        browserView.webContents.loadFile(getAssetPath('index.html'));
    }
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 1024,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    });
    mainWindow.loadFile(getAssetPath('browser.html'));
    mainWindow.webContents.on('did-finish-load', () => {
        setupBrowserView('');
    });

    mainWindow.on('focus', () => {
        isWindowActive = true;
        lastMouseMoveTime = Date.now();
        console.log('[Activity] Window focused');
    });

    mainWindow.on('blur', () => {
        isWindowActive = false;
        console.log('[Activity] Window blurred');
    });

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
            document.addEventListener('mousemove', () => {
                window.electronAPI.reportMouseActivity();
            });
        `);
    });

    mainWindow.on('browser-view-created', (event, view) => {
        if (view && view.webContents) {
            view.webContents.on('did-finish-load', () => {
                view.webContents.executeJavaScript(`
                    document.addEventListener('mousemove', () => {
                        window.electronAPI.reportMouseActivity();
                    });
                `);
            });
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (logViewerWindow) logViewerWindow.close();
    });
    buildMenu();

    isWindowActive = true;
    lastMouseMoveTime = Date.now();

    toggleAutoScreenshot(autoScreenshot);
}

function createProxySelectorWindow() {
    if (proxySelectorWindow) {
        proxySelectorWindow.focus();
        return;
    }
    proxySelectorWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        parent: mainWindow,
        modal: !!mainWindow,
        frame: false,
        resizable: false,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    proxySelectorWindow.loadFile(getAssetPath('proxy-selector.html'));
    proxySelectorWindow.webContents.on('did-finish-load', () => {
        proxySelectorWindow.webContents.send('load-proxies', loadProxies());
        const settings = loadSettings();
        const initialLogPath = settings.lastLogPath || app.getPath('logs');
        proxySelectorWindow.webContents.send('set-initial-log-path', initialLogPath);
        proxySelectorWindow.webContents.send('set-filter-patterns', settings.filterPatterns);
        proxySelectorWindow.webContents.send('set-auto-screenshot-state', settings.autoScreenshot || false);
        proxySelectorWindow.webContents.send('set-app-info', {name: app.getName(), version: app.getVersion()});
    });
    proxySelectorWindow.on('closed', () => {
        proxySelectorWindow = null;
    });
}

function createLogViewerWindow() {
    if (logViewerWindow) {
        logViewerWindow.focus();
        return;
    }
    logViewerWindow = new BrowserWindow({
        width: 1200,
        height: 1200,
        parent: mainWindow,
        title: 'Network Activity',
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    logViewerWindow.loadFile(getAssetPath('log-viewer.html'));
    logViewerWindow.on('closed', () => {
        logViewerWindow = null;
    });
}

function createQuickProxyChangeWindow() {
    if (quickProxyChangeWindow) {
        quickProxyChangeWindow.focus();
        return;
    }

    quickProxyChangeWindow = new BrowserWindow({
        width: 800,
        height: 400,
        parent: mainWindow,
        modal: !!mainWindow,
        frame: true,
        resizable: false,
        icon: iconPath,
        title: 'Quick Proxy Change',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    quickProxyChangeWindow.loadFile(getAssetPath('quick-proxy-change.html'));

    quickProxyChangeWindow.on('closed', () => {
        quickProxyChangeWindow = null;
    });
}

function buildMenu() {
    const menu = Menu.buildFromTemplate([{
        label: 'File',
        submenu: [
            {label: 'Proxy Settings', click: () => createProxySelectorWindow()},
            {
                label: 'Quick Proxy Change',
                click: () => showQuickProxyChangeDialog(),
                enabled: !!persistentAnonymizedProxyUrl
            },
            {
                label: 'Enable Logging',
                type: 'checkbox',
                checked: isLoggingEnabled,
                click: (item) => {
                    isLoggingEnabled = item.checked;
                    console.log(`Logging is now ${isLoggingEnabled ? 'ENABLED' : 'DISABLED'}`);
                }
            },
            {type: 'separator'},
            {role: 'quit', label: 'Exit'}
        ]
    }, {
        label: 'Edit',
        submenu: [{role: 'undo', label: 'Undo'}, {
            role: 'redo',
            label: 'Redo'
        }, {type: 'separator'}, {role: 'cut', label: 'Cut'}, {role: 'copy', label: 'Copy'}, {
            role: 'paste',
            label: 'Paste'
        }, {role: 'delete', label: 'Delete'}, {type: 'separator'}, {role: 'selectAll', label: 'Select All'}]
    }, {
        label: 'View',
        submenu: [{role: 'reload', label: 'Reload'}, {
            role: 'forceReload',
            label: 'Reload (No Cache)'
        }, {
            role: 'toggleDevTools',
            label: 'Developer Tools'
        }, {type: 'separator'}, {label: 'Show Network Activity', click: () => createLogViewerWindow()}]
    }]);
    Menu.setApplicationMenu(menu);
}

function showQuickProxyChangeDialog() {
    createQuickProxyChangeWindow();
}

async function quickChangeProxy(proxyUrl) {
    const oldPort = persistentAnonymizedProxyUrl
        ? Number(new URL(persistentAnonymizedProxyUrl).port)
        : undefined;

    const sanitizedProxy = sanitizeProxyUrl(proxyUrl);

    try {
        if (persistentAnonymizedProxyUrl) {
            await ProxyChain.closeAnonymizedProxy(persistentAnonymizedProxyUrl, true);
            await new Promise(r => setTimeout(r, 120));
        }

        actProxy = proxyUrl;
        if (oldPort) {
            persistentAnonymizedProxyUrl = await ProxyChain.anonymizeProxy({ url: sanitizedProxy, port: oldPort });
        } else {
            persistentAnonymizedProxyUrl = await ProxyChain.anonymizeProxy(sanitizedProxy);
        }

        const newPort = Number(new URL(persistentAnonymizedProxyUrl).port);
        
        
        
        
        
        
        
        const metaEntry = {
            type: 'session_start',
            log_created_at: now.toISOString(),
            proxy_info: actProxy || 'NONE'
        };
        logStream.write(JSON.stringify(metaEntry) + '\n');


        return persistentAnonymizedProxyUrl;

    } catch (error) {
        const isAddrBusy = error && (error.code === 'EADDRINUSE' || /EADDRINUSE/.test(String(error.message)));

        try {
            if (isAddrBusy && oldPort) {
                await new Promise(r => setTimeout(r, 250));
                persistentAnonymizedProxyUrl = await ProxyChain.anonymizeProxy(sanitizedProxy, { port: oldPort });
            } else {
                persistentAnonymizedProxyUrl = await ProxyChain.anonymizeProxy(sanitizedProxy);
            }

            const newPort = Number(new URL(persistentAnonymizedProxyUrl).port);
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Proxy Changed',
                message: 'Proxy has been changed successfully (with fallback).',
                detail: `Port: ${oldPort ?? '—'} → ${newPort}`,
                buttons: ['OK']
            });
            return persistentAnonymizedProxyUrl;

        } catch (e2) {
            dialog.showErrorBox('Error', `An error occurred while changing proxy: ${e2.message}`);
            throw e2;
        }
    }
}

async function setupNetworkLogging(webContents, proxyInfo = 'NONE') {
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    const timeString = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const randomChars = crypto.randomBytes(3).toString('hex');
    const fileName = `${timeString}-${randomChars}.jsonl`;
    const baseLogDir = userSelectedLogPath || app.getPath('logs');
    const logDirectory = path.join(baseLogDir, dateString);
    try {
        fs.mkdirSync(logDirectory, {recursive: true});
    } catch (err) {
        dialog.showErrorBox('Error Creating Log Folder', `Failed to create directory: ${logDirectory}\n\nError: ${err.message}`);
        app.quit();
        return;
    }
    currentLogFilePath = path.join(logDirectory, fileName);
    const logStream = fs.createWriteStream(currentLogFilePath, {flags: 'a'});
    console.log(`📝 Network logging via CDP is active. File: ${currentLogFilePath}`);

    const metaEntry = {
        type: 'session_start',
        log_created_at: now.toISOString(),
        proxy_info: actProxy || 'NONE'
    };
    logStream.write(JSON.stringify(metaEntry) + '\n');

    const ongoingRequests = new Map();
    const cdpDebugger = webContents.debugger;
    try {
        if (!cdpDebugger.isAttached()) cdpDebugger.attach('1.3');
    } catch (err) {
        console.error('Failed to connect to debugger:', err);
        return;
    }
    await cdpDebugger.sendCommand('Network.enable');
    
    
    
    cdpDebugger.on('detach', (event, reason) => console.log('Debugger detached:', reason));
    
    
    const ongoingWebsockets = new Map();
    
    cdpDebugger.on('message', async (event, method, params) => {
        if (!isLoggingEnabled) return;
        
        
        if (method === 'Network.webSocketCreated') {
            const { requestId, url, initiator } = params;
            console.log(`WebSocket created: ${url}`);
            
            const settings = loadSettings();
            const filterPatterns = settings.filterPatterns || [];
            
            if (shouldFilterUrl(url, filterPatterns)) {
                return;
            }
            
            ongoingWebsockets.set(requestId, {
                id: requestId,
                type: 'websocket',
                url: url,
                initiator: initiator,
                created: Date.now(),
                status: 'created',
                frames: []
            });
        }
        
        if (method === 'Network.webSocketHandshakeResponseReceived') {
            const { requestId, response } = params;
            if (ongoingWebsockets.has(requestId)) {
                const wsInfo = ongoingWebsockets.get(requestId);
                wsInfo.status = 'connected';
                wsInfo.response = {
                    statusCode: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                };
                console.log(`WebSocket connected: ${wsInfo.url}`);
            }
        }
        
        if (method === 'Network.webSocketFrameSent') {
            const { requestId, timestamp, response } = params;
            if (ongoingWebsockets.has(requestId)) {
                const wsInfo = ongoingWebsockets.get(requestId);
                wsInfo.frames.push({
                    direction: 'sent',
                    timestamp: timestamp,
                    data: response.payloadData,
                    opcode: response.opcode,
                    mask: response.mask
                });
                
                
                const frameLogEntry = {
                    type: 'websocket_frame',
                    direction: 'sent',
                    timestamp: Date.now(),
                    url: wsInfo.url,
                    data: response.payloadData,
                    opcode: response.opcode,
                    mask: response.mask
                };
                
                finalizeLog(frameLogEntry);
            }
        }
        
        if (method === 'Network.webSocketFrameReceived') {
            const { requestId, timestamp, response } = params;
            if (ongoingWebsockets.has(requestId)) {
                const wsInfo = ongoingWebsockets.get(requestId);
                wsInfo.frames.push({
                    direction: 'received',
                    timestamp: timestamp,
                    data: response.payloadData,
                    opcode: response.opcode
                });
                
                
                const frameLogEntry = {
                    type: 'websocket_frame',
                    direction: 'received',
                    timestamp: Date.now(),
                    url: wsInfo.url,
                    data: response.payloadData,
                    opcode: response.opcode
                };
                
                finalizeLog(frameLogEntry);
            }
        }
        
        if (method === 'Network.webSocketClosed') {
            const { requestId, timestamp } = params;
            if (ongoingWebsockets.has(requestId)) {
                const wsInfo = ongoingWebsockets.get(requestId);
                wsInfo.status = 'closed';
                wsInfo.closedAt = timestamp;
                
                
                const closeLogEntry = {
                    type: 'websocket_closed',
                    timestamp: Date.now(),
                    url: wsInfo.url,
                    duration: (timestamp - wsInfo.created) * 1000, 
                    framesCount: wsInfo.frames.length
                };
                
                finalizeLog(closeLogEntry);
                console.log(`WebSocket closed: ${wsInfo.url}`);
                
                
                ongoingWebsockets.delete(requestId);
            }
        }
        
        if (method === 'Network.webSocketFrameError') {
            const { requestId, timestamp, errorMessage } = params;
            if (ongoingWebsockets.has(requestId)) {
                const wsInfo = ongoingWebsockets.get(requestId);
                
                
                const errorLogEntry = {
                    type: 'websocket_error',
                    timestamp: Date.now(),
                    url: wsInfo.url,
                    error: errorMessage
                };
                
                finalizeLog(errorLogEntry);
                console.log(`WebSocket error: ${wsInfo.url} - ${errorMessage}`);
            }
        }
        
        
        if (method === 'Network.requestWillBeSent') {
            const {requestId, request, timestamp, type} = params;
            if (request.url.startsWith('data:')) return;

            const settings = loadSettings();
            const filterPatterns = settings.filterPatterns || [];

            if (shouldFilterUrl(request.url, filterPatterns)) {
                return;
            }

            ongoingRequests.set(requestId, {
                id: requestId,
                url: request.url,
                method: request.method,
                startTime: timestamp,
                type: type,
                request: {headers: request.headers, body: request.postData || null},
                response: null,
                responseBody: null
            });
        }
        if (method === 'Network.responseReceived') {
            const {requestId, response} = params;
            if (ongoingRequests.has(requestId)) {
                const logEntry = ongoingRequests.get(requestId);
                logEntry.response = {
                    statusCode: response.status,
                    statusMessage: response.statusText,
                    headers: response.headers,
                    mimeType: response.mimeType
                };
            }
        }
        if (method === 'Network.loadingFinished') {
            const {requestId, timestamp} = params;
            if (ongoingRequests.has(requestId)) {
                const logEntry = ongoingRequests.get(requestId);
                logEntry.endTime = timestamp;
                logEntry.durationMs = (logEntry.endTime - logEntry.startTime) * 1000;
                try {
                    const response = await cdpDebugger.sendCommand('Network.getResponseBody', {requestId});
                    logEntry.responseBody = response.base64Encoded ? `<base64|mime|${logEntry.response?.mimeType}|${response.body}>` : response.body;
                } catch (error) {
                    logEntry.responseBody = `<Failed to get response body: ${error.message}>`;
                }
                finalizeLog(logEntry);
            }
        }
        if (method === 'Network.loadingFailed') {
            const {requestId, timestamp, errorText} = params;
            if (ongoingRequests.has(requestId)) {
                const logEntry = ongoingRequests.get(requestId);
                logEntry.endTime = timestamp;
                logEntry.error = errorText;
                finalizeLog(logEntry);
            }
        }
    });
    const finalizeLog = (logEntry) => {
        logStream.write(JSON.stringify(logEntry) + '\n');
        if (logViewerWindow && !logViewerWindow.isDestroyed()) {
            logViewerWindow.webContents.send('new-log-entry', logEntry);
        }
        ongoingRequests.delete(logEntry.id);
    };
    webContents.on('destroyed', () => {
        if (cdpDebugger.isAttached()) cdpDebugger.detach();
    });
    startLogStatusUpdater();
}

function startLogStatusUpdater() {
    if (logStatusInterval) clearInterval(logStatusInterval);
    logStatusInterval = setInterval(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        let statusString = 'Logging disabled';
        if (isLoggingEnabled && currentLogFilePath) {
            try {
                if (fs.existsSync(currentLogFilePath)) {
                    const stats = fs.statSync(currentLogFilePath);
                    const fileSize = formatBytes(stats.size);
                    const lineCount = fs.readFileSync(currentLogFilePath, 'utf8').split('\n').filter(Boolean).length;
                    statusString = `📝 ${path.basename(currentLogFilePath)} | ${fileSize} | ${lineCount} entries`;
                } else {
                    statusString = '📝 Waiting for first request...';
                }
            } catch (e) {
                statusString = '⚠️ Error reading log';
            }
        }
        mainWindow.webContents.send('update-log-status', statusString);
    }, 5000);
}

async function testProxy(upstreamProxyUrl) {
    console.log(`\n--- 🚀 Starting proxy test: ${upstreamProxyUrl} ---`);
    let anonymizedProxyUrl = null;
    let testWindow = null;
    const testPartition = `proxy-test-${Date.now()}`;
    try {
        actProxy = upstreamProxyUrl;

        anonymizedProxyUrl = await ProxyChain.anonymizeProxy(upstreamProxyUrl);
        console.log(`[Test]: ✅ Temporary proxy started at ${anonymizedProxyUrl}`);
        const testSession = session.fromPartition(testPartition, {cache: false});
        await testSession.setProxy({proxyRules: anonymizedProxyUrl, proxyBypassRules: '<local>'});
        testWindow = new BrowserWindow({show: false, webPreferences: {session: testSession}});
        console.log('[Test]: Loading URL in invisible window...');
        await testWindow.loadURL('https://ipinfo.io/json');
        const pageContent = await testWindow.webContents.executeJavaScript('document.body.innerText');
        console.log('[Test]: ✅ Response received. Body:', pageContent);
        const data = JSON.parse(pageContent);
        if (!data.ip || !data.country) {
            throw new Error('Incomplete JSON in response from ipinfo.io');
        }
        return {success: true, data};
    } catch (error) {
        console.error(`[Test]: ❌ Error during test: ${error.message}`);
        return {success: false, data: null, error: error.message};
    } finally {
        if (testWindow) testWindow.destroy();
        if (anonymizedProxyUrl) await ProxyChain.closeAnonymizedProxy(anonymizedProxyUrl, true);
        const testSession = session.fromPartition(testPartition);
        if (testSession) await testSession.clearStorageData();
        console.log('--- 🏁 Finishing proxy test ---\n');
    }
}

app.whenReady().then(() => {
    ipcMain.on('report-mouse-activity', () => {
        lastMouseMoveTime = Date.now();
    });

    ipcMain.handle('get-current-proxy', async () => {
        return actProxy;
    });

    ipcMain.handle('apply-quick-proxy-change', async (event, proxyUrl) => {
        try {
            await quickChangeProxy(proxyUrl);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-screenshot', async (event, imageData, filename) => {
        try {
            const defaultPath = path.join(app.getPath('pictures'), filename.replace(/[^a-zA-Z0-9-_.]/g, '_') + '.png');
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'Save Screenshot',
                defaultPath: defaultPath,
                filters: [
                    { name: 'PNG Images', extensions: ['png'] }
                ]
            });

            if (canceled) {
                return { success: false, message: 'Save canceled' };
            }

            const buffer = Buffer.from(imageData, 'base64');
            fs.writeFileSync(filePath, buffer);

            return { success: true, path: filePath };
        } catch (error) {
            console.error('Error saving screenshot:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('copy-screenshot', async (event, imageData) => {
        try {
            const buffer = Buffer.from(imageData, 'base64');
            const image = nativeImage.createFromBuffer(buffer);
            clipboard.writeImage(image);
            return { success: true };
        } catch (error) {
            console.error('Error copying screenshot:', error);
            return { success: false, error: error.message };
        }
    });

    createProxySelectorWindow();

    const settings = loadSettings();
    if (settings.autoScreenshot) {
        toggleAutoScreenshot(true);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createProxySelectorWindow();
    });
});
app.on('will-quit', async () => {
    if (logStatusInterval) clearInterval(logStatusInterval);
    if (screenshotInterval) clearInterval(screenshotInterval);
    if (persistentAnonymizedProxyUrl) {
        await ProxyChain.closeAnonymizedProxy(persistentAnonymizedProxyUrl, true);
    }
    const browserSession = session.fromPartition(BROWSER_PARTITION);
    if (browserSession) {
        await browserSession.clearStorageData();
    }
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

async function captureScreenshot(saveToLog = false) {
    try {
        if (!mainWindow || mainWindow.isDestroyed() || !browserView || browserView.webContents.isDestroyed()) {
            throw new Error('Target window or view for screenshot is not available.');
        }

        const now = Date.now();
        const timeSinceLastMouseMove = now - lastMouseMoveTime;

        if (!isWindowActive && timeSinceLastMouseMove > MOUSE_ACTIVITY_TIMEOUT) {
            console.log(`[AutoScreenshot] Skipping - window inactive (${isWindowActive}) and no mouse activity for ${Math.round(timeSinceLastMouseMove/1000)}s`);
            return { success: false, skipped: true, reason: 'Window inactive and no recent mouse activity' };
        }

        const nowDate = new Date();
        const timeString = nowDate.toTimeString().split(' ')[0].replace(/:/g, '-');
        const milliseconds = nowDate.getMilliseconds().toString().padStart(3, '0');

        const virtualPath = `autoscreen::/5sec/${timeString}.${milliseconds}.jpeg`;

        const image = await browserView.webContents.capturePage();
        const buffer = image.toPNG();

        console.log(`Screenshot captured: ${virtualPath} (window active: ${isWindowActive}, last mouse activity: ${Math.round(timeSinceLastMouseMove/1000)}s ago)`);

        if (currentLogFilePath && isLoggingEnabled) {
            const logEntry = {
                type: 'screenshot',
                timestamp: Date.now(),
                path: virtualPath,
                imageData: buffer.toString('base64')
            };

            const logStream = fs.createWriteStream(currentLogFilePath, {flags: 'a'});
            logStream.write(JSON.stringify(logEntry) + '\n');
            logStream.end();

            if (logViewerWindow && !logViewerWindow.isDestroyed()) {
                logViewerWindow.webContents.send('new-log-entry', logEntry);
            }
        }

        return { success: true, path: virtualPath };
    } catch (error) {
        console.error('Error creating screenshot:', error);
        return { success: false, error: error.message };
    }
}
function toggleAutoScreenshot(enabled) {
    autoScreenshotEnabled = enabled;

    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    }

    if (enabled && mainWindow && !mainWindow.isDestroyed()) {
        screenshotInterval = setInterval(async () => {
            if (isLoggingEnabled && mainWindow && !mainWindow.isDestroyed()) {
                console.log('[AutoScreenshot] Taking screenshot...');
                await captureScreenshot(true);
            }
        }, 5000);
    }
}

ipcMain.handle('open-log-directory', async (event, dirPath) => {
    const pathToOpen = dirPath || app.getPath('logs');
    console.log(`[Shell] Attempting to open folder: ${pathToOpen}`);
    if (fs.existsSync(pathToOpen)) {
        await shell.openPath(pathToOpen);
    } else {
        try {
            fs.mkdirSync(pathToOpen, {recursive: true});
            await shell.openPath(pathToOpen);
        } catch (error) {
            dialog.showErrorBox('Error', `Failed to create or open directory:\n${pathToOpen}`);
        }
    }
});
ipcMain.handle('select-log-directory', async (event) => {
    const {canceled, filePaths} = await dialog.showOpenDialog(proxySelectorWindow, {properties: ['openDirectory']});
    if (!canceled && filePaths.length > 0) {
        event.sender.send('log-directory-selected', filePaths[0]);
    }
});

ipcMain.handle('open-log-viewer', () => {
    createLogViewerWindow();
    return { success: true };
});
function shouldFilterUrl(url, patterns) {
    if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
        return false;
    }

    return patterns.some(pattern => {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*');

        const regex = new RegExp(regexPattern, 'i');
        return regex.test(url);
    });
}

ipcMain.handle('proxy-selected', async (event, {proxy, logPath, filterPatterns, autoScreenshot}) => {
    userSelectedLogPath = logPath;

    const settings = loadSettings();
    settings.lastLogPath = logPath;
    if (filterPatterns && Array.isArray(filterPatterns)) {
        settings.filterPatterns = filterPatterns;
    }
    settings.autoScreenshot = autoScreenshot;
    saveSettings(settings);

    toggleAutoScreenshot(autoScreenshot);

    if (!proxy || proxy.toLowerCase() === 'none') {
        if (persistentAnonymizedProxyUrl) {
            await ProxyChain.closeAnonymizedProxy(persistentAnonymizedProxyUrl, true);
            persistentAnonymizedProxyUrl = null;
        }
        if (!mainWindow) {
            createMainWindow();
        } else {
            await setupBrowserView('');
        }
        if (proxySelectorWindow) proxySelectorWindow.close();
        return;
    }

    const realIp = await getRealIp();
    const sanitizedProxy = sanitizeProxyUrl(proxy);
    const testResult = await testProxy(sanitizedProxy);

    if (testResult.success) {
        const {ip, country, city, org} = testResult.data;
        const {response} = await dialog.showMessageBox(proxySelectorWindow, {
            type: 'question',
            title: 'Proxy Confirmation',
            message: 'Proxy tested successfully!',
            detail: `Your IP: ${realIp}\nIP through proxy: ${ip}\n\nCountry: ${country}${city ? `, ${city}` : ''}\nOrganization: ${org || 'N/A'}`,
            buttons: ['Apply and Continue', 'Cancel'],
            defaultId: 0,
            cancelId: 1
        });
        if (response === 1) {
            throw new Error('User canceled selection.');
        }

        if (persistentAnonymizedProxyUrl) await ProxyChain.closeAnonymizedProxy(persistentAnonymizedProxyUrl, true);
        actProxy = proxy;
        persistentAnonymizedProxyUrl = await ProxyChain.anonymizeProxy(sanitizedProxy);

        if (!mainWindow) {
            createMainWindow();
            mainWindow.webContents.once('did-finish-load', () => setupBrowserView(persistentAnonymizedProxyUrl));
        } else {
            await setupBrowserView(persistentAnonymizedProxyUrl);
        }

        const proxies = loadProxies();
        if (!proxies.includes(proxy)) {
            proxies.unshift(proxy);
            saveProxies(proxies.slice(0, 10));
        }

        if (proxySelectorWindow) proxySelectorWindow.close();
    } else {
        dialog.showErrorBox('Proxy Verification Error', `Failed to connect through the specified proxy.\n\nError: ${testResult.error}`);
        throw new Error('Proxy verification failed.');
    }
});
ipcMain.on('navigate-to', (event, url) => {
    if (browserView && !browserView.webContents.isDestroyed()) browserView.webContents.loadURL(url);
});
ipcMain.on('nav-back', () => {
    if (browserView && !browserView.webContents.isDestroyed() && browserView.webContents.canGoBack()) browserView.webContents.goBack();
});
ipcMain.on('nav-forward', () => {
    if (browserView && !browserView.webContents.isDestroyed() && browserView.webContents.canGoForward()) browserView.webContents.goForward();
});
ipcMain.on('nav-reload', () => {
    if (browserView && !browserView.webContents.isDestroyed()) browserView.webContents.reload();
});

ipcMain.handle('take-screenshot', async () => {
    return await captureScreenshot(false);
});

ipcMain.handle('get-existing-logs', async () => {
    if (!currentLogFilePath || !fs.existsSync(currentLogFilePath)) {
        return [];
    }

    try {
        const logContent = fs.readFileSync(currentLogFilePath, 'utf8');
        const logEntries = logContent
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    console.error('Error parsing log line:', e);
                    return null;
                }
            })
            .filter(entry => entry !== null);

        return logEntries;
    } catch (error) {
        console.error('Error reading log file:', error);
        return [];
    }
});

ipcMain.handle('clear-logs', async () => {
    if (!currentLogFilePath) {
        return { success: false, error: 'Log file not found' };
    }

    try {
        if (fs.existsSync(currentLogFilePath)) {
            const logContent = fs.readFileSync(currentLogFilePath, 'utf8');
            const lines = logContent.split('\n');

            if (lines.length > 0 && lines[0].includes('session_start')) {
                fs.writeFileSync(currentLogFilePath, lines[0] + '\n');
            } else {
                fs.writeFileSync(currentLogFilePath, '');
            }

            return { success: true };
        } else {
            return { success: false, error: 'Log file does not exist' };
        }
    } catch (error) {
        console.error('Error clearing log file:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('open-jsonl-file', async (event) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(logViewerWindow, {
            title: 'Open JSONL Log File',
            filters: [
                { name: 'JSONL Files', extensions: ['jsonl'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });

        if (canceled || filePaths.length === 0) {
            return { success: false, canceled: true };
        }

        const filePath = filePaths[0];

        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'File does not exist' };
        }

        const fileContent = fs.readFileSync(filePath, 'utf8');
        const logEntries = fileContent
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    console.error('Error parsing log line:', e);
                    return null;
                }
            })
            .filter(entry => entry !== null);

        return {
            success: true,
            logs: logEntries,
            filePath: filePath
        };
    } catch (error) {
        console.error('Error opening JSONL file:', error);
        return { success: false, error: error.message };
    }
});
