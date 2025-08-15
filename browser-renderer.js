


const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const urlInput = document.getElementById('url-input');
const logStatusDisplay = document.getElementById('log-status-display');
const toolbar = document.getElementById('browser-toolbar'); 


backBtn.addEventListener('click', () => window.electronAPI.navBack());
forwardBtn.addEventListener('click', () => window.electronAPI.navForward());
reloadBtn.addEventListener('click', () => window.electronAPI.navReload());

urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        let url = urlInput.value.trim();
        if (url) {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            window.electronAPI.navigateTo(url);
        }
    }
});




window.electronAPI.onURLUpdate((url) => {
    if (document.activeElement !== urlInput) { 
        urlInput.value = url;
    }
});


window.electronAPI.onUpdateLogStatus((status) => {
    logStatusDisplay.textContent = status;
    logStatusDisplay.title = status;
});


window.electronAPI.onSetLoadingState((isLoading) => {
    if (isLoading) {
        toolbar.classList.add('loading');
    } else {
        toolbar.classList.remove('loading');
    }
});
