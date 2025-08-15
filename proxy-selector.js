
const newProxyInput = document.getElementById('new-proxy');
const savedProxiesSelect = document.getElementById('saved-proxies');
const startBtn = document.getElementById('start-btn');
const noProxyBtn = document.getElementById('no-proxy-btn');
const selectLogDirBtn = document.getElementById('select-log-dir-btn');
const logDirDisplay = document.getElementById('log-dir-display');
const logDirFullPath = document.getElementById('log-dir-full-path');
const openLogDirBtn = document.getElementById('open-log-dir-btn');
const openLogViewerBtn = document.getElementById('open-log-viewer-btn');
const urlFilterPatterns = document.getElementById('url-filter-patterns');
const autoScreenshotCheckbox = document.getElementById('auto-screenshot');
const appIcon = document.getElementById('app-icon');
const appTitle = document.getElementById('app-title');
const quickProxyInput = document.getElementById('quick-proxy');
const applyQuickProxyBtn = document.getElementById('apply-quick-proxy');
let selectedLogPath = null;
let savedFilterPatterns = [];
let autoScreenshotEnabled = false;

function updateLogPathDisplays(path) {
    selectedLogPath = path;
    if (path) {
        logDirDisplay.textContent = path;
        logDirDisplay.title = path;
        logDirFullPath.textContent = path;
    } else {
        logDirDisplay.textContent = 'Default (application logs folder)';
        logDirFullPath.textContent = 'Default path will be determined at launch.';
    }
}

window.electronAPI.onLoadProxies((proxies) => {
    proxies.forEach(proxy => {
        const option = document.createElement('option');
        option.value = proxy;
        option.textContent = proxy;
        savedProxiesSelect.appendChild(option);
    });
});
window.electronAPI.onSetInitialLogPath((path) => {
    updateLogPathDisplays(path);
});
window.electronAPI.onLogDirectorySelected((path) => {
    updateLogPathDisplays(path);
});
window.electronAPI.onSetFilterPatterns((patterns) => {
    savedFilterPatterns = patterns || [];
    urlFilterPatterns.value = savedFilterPatterns.join('\n');
});
window.electronAPI.onSetAppInfo((info) => {
    appTitle.textContent = 'v'+info.version;
    document.title = `${info.name}`;
    appIcon.src = './img.png';
});
window.electronAPI.onSetAutoScreenshotState((enabled) => {
    autoScreenshotEnabled = enabled;
    autoScreenshotCheckbox.checked = enabled;
});
selectLogDirBtn.addEventListener('click', () => {
    window.electronAPI.selectLogDirectory();
});
openLogDirBtn.addEventListener('click', () => {
    window.electronAPI.openLogDirectory(selectedLogPath);
});

openLogViewerBtn.addEventListener('click', () => {
    window.electronAPI.openLogViewer();
});

autoScreenshotCheckbox.addEventListener('change', () => {
    autoScreenshotEnabled = autoScreenshotCheckbox.checked;
});

function setButtonsState(disabled, text = 'Start') {
    startBtn.disabled = disabled;
    noProxyBtn.disabled = disabled;
    selectLogDirBtn.disabled = disabled;
    openLogDirBtn.disabled = disabled;
    startBtn.textContent = disabled ? text : 'Start';
}

const sendSelection = (proxyValue) => {
    setButtonsState(true, 'Testing...');
    

    const filterPatternsText = urlFilterPatterns.value.trim();
    const filterPatterns = filterPatternsText ?
        filterPatternsText.split('\n').map(pattern => pattern.trim()).filter(pattern => pattern) :
        [];
    
    window.electronAPI.selectProxy({
        proxy: proxyValue,
        logPath: selectedLogPath,
        filterPatterns: filterPatterns,
        autoScreenshot: autoScreenshotEnabled
    }).catch(console.error).finally(() => {
        setButtonsState(false);
    });
};
startBtn.addEventListener('click', () => {
    const selectedProxy = newProxyInput.value.trim() || savedProxiesSelect.value;
    if (selectedProxy) {
        sendSelection(selectedProxy);
    } else {
        alert('Please enter or select a proxy.');
    }
});
noProxyBtn.addEventListener('click', () => {

    const filterPatternsText = urlFilterPatterns.value.trim();
    const filterPatterns = filterPatternsText ?
        filterPatternsText.split('\n').map(pattern => pattern.trim()).filter(pattern => pattern) :
        [];
        
    window.electronAPI.selectProxy({
        proxy: 'NONE',
        logPath: selectedLogPath,
        filterPatterns: filterPatterns,
        autoScreenshot: autoScreenshotEnabled
    });
});


applyQuickProxyBtn.addEventListener('click', () => {
    const quickProxyValue = quickProxyInput.value.trim();
    if (quickProxyValue) {
        sendSelection(quickProxyValue);
    } else {
        alert('Please enter a proxy URL.');
    }
});
