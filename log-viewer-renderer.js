
let logEntries = [];
let filteredLogs = [];
let selectedLogId = null;


const logList = document.getElementById('log-list');
const logDetailEmpty = document.getElementById('log-detail-empty');
const logDetail = document.getElementById('log-detail');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const filterType = document.getElementById('filter-type');
const filterStatus = document.getElementById('filter-status');
const clearLogsBtn = document.getElementById('clear-logs');
const openJsonlFileBtn = document.getElementById('open-jsonl-file');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');


document.addEventListener('DOMContentLoaded', () => {

    window.electronAPI.getExistingLogs().then(logs => {
        if (logs && logs.length > 0) {
            logs.forEach(log => addLogEntry(log));
            updateFilterOptions();
            applyFiltersAndSearch();
        }
    }).catch(error => {
        console.error('Ошибка при загрузке существующих логов:', error);
    });


    setupEventListeners();
});


function setupEventListeners() {

    window.electronAPI.onNewLogEntry((logEntry) => {
        addLogEntry(logEntry);
        updateFilterOptions();
        applyFiltersAndSearch();
    });


    searchInput.addEventListener('input', applyFiltersAndSearch);
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        applyFiltersAndSearch();
    });
    filterType.addEventListener('change', applyFiltersAndSearch);
    filterStatus.addEventListener('change', applyFiltersAndSearch);
    

    clearLogsBtn.addEventListener('click', clearLogs);
    

    openJsonlFileBtn.addEventListener('click', async () => {
        try {
            const result = await window.electronAPI.openJsonlFile();
            if (result.success) {

                logEntries = [];
                

                if (result.logs && result.logs.length > 0) {
                    result.logs.forEach(log => addLogEntry(log));
                    updateFilterOptions();
                    applyFiltersAndSearch();
                }
            }
        } catch (error) {
            console.error('Error opening JSONL file:', error);
        }
    });
    

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    

    document.querySelectorAll('.log-list-column').forEach(column => {
        column.addEventListener('click', () => {
            const columnName = column.getAttribute('data-column');
            sortLogsByColumn(columnName);
        });
    });
}


function addLogEntry(logEntry) {

    logEntry.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    

    logEntries.push(logEntry);
    

    if (passesFilters(logEntry)) {
        addLogToDisplay(logEntry);
    }
}


function passesFilters(logEntry) {

    const typeFilter = filterType.value;
    if (typeFilter !== 'all' && logEntry.type !== typeFilter) {
        return false;
    }
    

    const statusFilter = filterStatus.value;
    if (statusFilter !== 'all') {
        const status = logEntry.status || 0;
        
        if (statusFilter === 'success' && (status < 200 || status >= 300)) {
            return false;
        }
        if (statusFilter === 'redirect' && (status < 300 || status >= 400)) {
            return false;
        }
        if (statusFilter === 'client-error' && (status < 400 || status >= 500)) {
            return false;
        }
        if (statusFilter === 'server-error' && (status < 500 || status >= 600)) {
            return false;
        }
    }
    

    const searchQuery = searchInput.value.toLowerCase();
    if (searchQuery) {

        let searchTarget = '';
        let host = '';
        
        if (logEntry.type === 'screenshot') {
            searchTarget = logEntry.path || '';
        } else {
            searchTarget = logEntry.url || '';
            try {
                const urlObj = new URL(searchTarget);
                host = urlObj.hostname;
            } catch (e) {
                host = '';
            }
        }
        

        if (!searchTarget.toLowerCase().includes(searchQuery) &&
            !host.toLowerCase().includes(searchQuery)) {
            return false;
        }
    }
    
    return true;
}


function addLogToDisplay(logEntry) {
    const logItem = document.createElement('div');
    logItem.classList.add('log-list-item');
    logItem.setAttribute('data-id', logEntry.id);
    

    if (logEntry.error) {
        logItem.classList.add('error');
    }
    

    if (logEntry.type === 'screenshot') {
        logItem.classList.add('screenshot');
    } else if (logEntry.type === 'websocket' || logEntry.type === 'websocket_frame' ||
               logEntry.type === 'websocket_closed' || logEntry.type === 'websocket_error') {
        logItem.classList.add('websocket');
    }
    


    const status = logEntry.response && logEntry.response.statusCode ? logEntry.response.statusCode : (logEntry.status || 0);
    let statusClass = '';
    if (status >= 200 && status < 300) {
        statusClass = 'status-2xx';
    } else if (status >= 300 && status < 400) {
        statusClass = 'status-3xx';
    } else if (status >= 400 && status < 500) {
        statusClass = 'status-4xx';
    } else if (status >= 500) {
        statusClass = 'status-5xx';
    }
    

    const method = logEntry.method || 'GET';
    const methodClass = `method-${method}`;
    

    const timestamp = logEntry.timestamp || Date.now();
    const date = new Date(timestamp);
    const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    

    function limitUrlLength(url, maxLength = 200) {
        if (!url) return '';
        if (url.length <= maxLength) return url;
        

        const start = url.substring(0, maxLength / 2 - 3);
        const end = url.substring(url.length - maxLength / 2 + 3);
        return `${start}...${end}`;
    }
    

    function extractHostFromUrl(url) {
        if (!url) return '-';
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (e) {

            return url.split('/')[0] || '-';
        }
    }
    

    if (logEntry.type === 'screenshot') {
        const displayPath = limitUrlLength(logEntry.path || '');
        

        let thumbnailHtml = '<span class="screenshot-icon">📷</span>';
        

        let imageData = '';
        if (logEntry.data && typeof logEntry.data === 'string') {
            if (logEntry.data.startsWith('data:image')) {

                imageData = logEntry.data;
            } else {

                imageData = `data:image/png;base64,${logEntry.data}`;
            }
        } else if (logEntry.imageData && typeof logEntry.imageData === 'string') {
            if (logEntry.imageData.includes('<base64 data, mime:')) {

                const match = logEntry.imageData.match(/<base64 data, mime: ([^>]+)>/);
                if (match && match[1]) {
                    imageData = `data:image/png;base64,${match[1]}`;
                }
            } else {

                imageData = `data:image/png;base64,${logEntry.imageData}`;
            }
        }
        

        if (imageData) {
            thumbnailHtml = `<img src="${imageData}" class="screenshot-thumbnail-small" alt="Screenshot">`;
        }
        

        logItem.innerHTML = `
            <div class="log-list-item-column time">${timeString}</div>
            <div class="log-list-item-column method">${thumbnailHtml}</div>
            <div class="log-list-item-column status">-</div>
            <div class="log-list-item-column type">Screenshot</div>
            <div class="log-list-item-column path" title="${logEntry.path || ''}">${displayPath}</div>
        `;
        

        logItem.classList.add('screenshot-item');
    }

    else if (logEntry.type === 'websocket') {
        const url = logEntry.url || '';
        const displayUrl = limitUrlLength(url);
        
        logItem.innerHTML = `
            <div class="log-list-item-column time">${timeString}</div>
            <div class="log-list-item-column method">WS</div>
            <div class="log-list-item-column status ${logEntry.status === 'connected' ? 'status-2xx' : ''}">${logEntry.status || '-'}</div>
            <div class="log-list-item-column type">WebSocket</div>
            <div class="log-list-item-column path" title="${url}">${displayUrl}</div>
        `;
        

        logItem.classList.add('websocket-item');
    }

    else if (logEntry.type === 'websocket_frame') {
        const url = logEntry.url || '';
        const displayUrl = limitUrlLength(url);
        const direction = logEntry.direction || '-';
        const directionIcon = direction === 'sent' ? '↑' : '↓';
        
        logItem.innerHTML = `
            <div class="log-list-item-column time">${timeString}</div>
            <div class="log-list-item-column method">${directionIcon}</div>
            <div class="log-list-item-column status">-</div>
            <div class="log-list-item-column type">WS Frame</div>
            <div class="log-list-item-column path" title="${url}">${displayUrl}</div>
        `;
        

        logItem.classList.add('websocket-frame-item');
    }

    else if (logEntry.type === 'websocket_closed') {
        const url = logEntry.url || '';
        const displayUrl = limitUrlLength(url);
        
        logItem.innerHTML = `
            <div class="log-list-item-column time">${timeString}</div>
            <div class="log-list-item-column method">WS</div>
            <div class="log-list-item-column status">Closed</div>
            <div class="log-list-item-column type">WebSocket</div>
            <div class="log-list-item-column path" title="${url}">${displayUrl}</div>
        `;
        

        logItem.classList.add('websocket-closed-item');
    }

    else if (logEntry.type === 'websocket_error') {
        const url = logEntry.url || '';
        const displayUrl = limitUrlLength(url);
        
        logItem.innerHTML = `
            <div class="log-list-item-column time">${timeString}</div>
            <div class="log-list-item-column method">WS</div>
            <div class="log-list-item-column status status-5xx">Error</div>
            <div class="log-list-item-column type">WebSocket</div>
            <div class="log-list-item-column path" title="${url}">${displayUrl}</div>
        `;
        

        logItem.classList.add('websocket-error-item');
    }
    else {
        const url = logEntry.url || '';
        const displayUrl = limitUrlLength(url);
        const host = extractHostFromUrl(url);
        
        logItem.innerHTML = `
            <div class="log-list-item-column time">${timeString}</div>
            <div class="log-list-item-column method ${methodClass}">${method}</div>
            <div class="log-list-item-column status ${statusClass}">${status || '-'}</div>
            <div class="log-list-item-column type">${logEntry.type || '-'}</div>
            <div class="log-list-item-column path" title="${url}">${displayUrl}</div>
        `;
    }
    

    logItem.addEventListener('click', () => {
        selectLogEntry(logEntry.id);
    });
    

    logList.appendChild(logItem);
    

    logList.scrollTop = logList.scrollHeight;
}


function selectLogEntry(logId) {

    const previousSelected = document.querySelector('.log-list-item.selected');
    if (previousSelected) {
        previousSelected.classList.remove('selected');
    }
    

    const logItem = document.querySelector(`.log-list-item[data-id="${logId}"]`);
    if (logItem) {
        logItem.classList.add('selected');
    }
    

    selectedLogId = logId;
    

    const logEntry = logEntries.find(entry => entry.id === logId);
    if (logEntry) {

        showLogDetails(logEntry);
    }
}


function showLogDetails(logEntry) {

    logDetailEmpty.style.display = 'none';
    logDetail.style.display = 'flex';
    

    if (logEntry.type === 'screenshot') {

        document.getElementById('log-detail-url').textContent = logEntry.path || 'Screenshot';
        document.getElementById('log-detail-url').title = logEntry.path || 'Screenshot';


        document.getElementById('detail-status').textContent = '-';
        document.getElementById('detail-status').className = '';
        
        document.getElementById('detail-method').textContent = '-';
        document.getElementById('detail-method').className = '';
        
        document.getElementById('detail-type').textContent = 'Screenshot';
        

        const timestamp = logEntry.timestamp || Date.now();
        const date = new Date(timestamp);
        const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
        document.getElementById('detail-time').textContent = timeString;
        
        document.getElementById('detail-duration').textContent = '-';
        

        document.getElementById('request-headers').innerHTML = '';
        document.getElementById('response-headers').innerHTML = '';
        

        document.getElementById('request-body').textContent = '';
        

        const responseBody = document.getElementById('response-body');
        if (logEntry.imageData) {

            let imageDataToUse = logEntry.imageData;
            if (typeof imageDataToUse === 'string' && imageDataToUse.includes('<base64 data, mime:')) {

                console.log('Обнаружены данные в формате <base64 data, mime:>, пытаемся извлечь...');
                

                if (logEntry.data && typeof logEntry.data === 'string') {
                    if (logEntry.data.startsWith('data:image')) {

                        const base64Part = logEntry.data.split(',')[1];
                        imageDataToUse = base64Part || '';
                        console.log('Извлечены данные из logEntry.data');
                    } else {

                        imageDataToUse = logEntry.data;
                        console.log('Используем logEntry.data как base64');
                    }
                } else {

                    const match = imageDataToUse.match(/<base64 data, mime: ([^>]+)>/);
                    if (match && match[1]) {
                        imageDataToUse = match[1];
                        console.log('Извлечены данные из строки imageData');
                    } else {
                        imageDataToUse = '';
                        console.log('Не удалось извлечь данные, используем заглушку');
                    }
                }
            }
            
            responseBody.innerHTML = `
                <div class="screenshot-container">
                    <div class="screenshot-header">
                        <span class="screenshot-timestamp">${new Date(logEntry.timestamp).toLocaleString()}</span>
                        <span class="screenshot-path">${logEntry.path || ''}</span>
                    </div>
                    <div class="screenshot-image-wrapper">
                        ${imageDataToUse ?
                            `<img src="data:image/png;base64,${imageDataToUse}" alt="Screenshot" class="screenshot-image">` :
                            `<div class="screenshot-placeholder">Image not available</div>`
                        }
                    </div>
                    <div class="screenshot-controls">
                        <button class="screenshot-control-btn" id="save-screenshot" ${!imageDataToUse ? 'disabled' : ''}>💾 Save</button>
                        <button class="screenshot-control-btn" id="copy-screenshot" ${!imageDataToUse ? 'disabled' : ''}>📋 Copy</button>
                        <button class="screenshot-control-btn" id="fullscreen-screenshot" ${!imageDataToUse ? 'disabled' : ''}>🔍 Zoom</button>
                    </div>
                </div>
            `;
            

            setTimeout(() => {
                const saveBtn = document.getElementById('save-screenshot');
                if (saveBtn) {
                    saveBtn.addEventListener('click', () => {
                        window.electronAPI.saveScreenshot(logEntry.imageData, logEntry.path);
                    });
                }
                
                const copyBtn = document.getElementById('copy-screenshot');
                if (copyBtn) {
                    copyBtn.addEventListener('click', () => {
                        window.electronAPI.copyScreenshot(logEntry.imageData);
                    });
                }
                
                const fullscreenBtn = document.getElementById('fullscreen-screenshot');
                if (fullscreenBtn) {
                    fullscreenBtn.addEventListener('click', () => {

                        const modal = document.createElement('div');
                        modal.className = 'screenshot-modal';
                        modal.innerHTML = `
                            <div class="screenshot-modal-content">
                                <span class="screenshot-modal-close">&times;</span>
                                ${imageDataToUse ?
                                    `<img src="data:image/png;base64,${imageDataToUse}" alt="Screenshot" class="screenshot-modal-image">` :
                                    `<div class="screenshot-placeholder">Image not available</div>`
                                }
                            </div>
                        `;
                        document.body.appendChild(modal);
                        

                        const closeBtn = modal.querySelector('.screenshot-modal-close');
                        if (closeBtn) {
                            closeBtn.addEventListener('click', () => {
                                document.body.removeChild(modal);
                            });
                        }
                        

                        modal.addEventListener('click', (event) => {
                            if (event.target === modal) {
                                document.body.removeChild(modal);
                            }
                        });
                    });
                }
            }, 0);
        } else {
            responseBody.textContent = 'Screenshot data not available';
        }
        

        switchTab('response');
    }

    else if (logEntry.type === 'websocket' || logEntry.type === 'websocket_frame' ||
             logEntry.type === 'websocket_closed' || logEntry.type === 'websocket_error') {
        

        document.getElementById('log-detail-url').textContent = logEntry.url || 'WebSocket';
        document.getElementById('log-detail-url').title = logEntry.url || 'WebSocket';


        const detailStatus = document.getElementById('detail-status');
        if (logEntry.type === 'websocket') {
            detailStatus.textContent = logEntry.status || 'Created';
            detailStatus.className = logEntry.status === 'connected' ? 'status-2xx' : '';
        } else if (logEntry.type === 'websocket_closed') {
            detailStatus.textContent = 'Closed';
            detailStatus.className = '';
        } else if (logEntry.type === 'websocket_error') {
            detailStatus.textContent = 'Error';
            detailStatus.className = 'status-5xx';
        } else {
            detailStatus.textContent = logEntry.direction === 'sent' ? 'Sent' : 'Received';
            detailStatus.className = logEntry.direction === 'sent' ? 'method-POST' : 'method-GET';
        }
        
        const detailMethod = document.getElementById('detail-method');
        detailMethod.textContent = 'WS';
        detailMethod.className = '';
        
        document.getElementById('detail-type').textContent = logEntry.type === 'websocket_frame' ?
            'WebSocket Frame' : 'WebSocket';
        

        const timestamp = logEntry.timestamp || Date.now();
        const date = new Date(timestamp);
        const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
        document.getElementById('detail-time').textContent = timeString;
        

        if (logEntry.type === 'websocket_closed' && logEntry.duration) {
            document.getElementById('detail-duration').textContent = `${logEntry.duration} ms`;
        } else {
            document.getElementById('detail-duration').textContent = '-';
        }
        

        const requestHeaders = document.getElementById('request-headers');
        requestHeaders.innerHTML = '';
        

        const responseHeaders = document.getElementById('response-headers');
        responseHeaders.innerHTML = '';
        

        if (logEntry.type === 'websocket' && logEntry.response && logEntry.response.headers) {
            Object.entries(logEntry.response.headers).forEach(([name, value]) => {
                const headerItem = document.createElement('div');
                headerItem.classList.add('header-item');
                headerItem.innerHTML = `
                    <div class="header-name">${name}:</div>
                    <div class="header-value">${value}</div>
                `;
                responseHeaders.appendChild(headerItem);
            });
        }
        

        const requestBody = document.getElementById('request-body');
        requestBody.textContent = '';
        

        const responseBody = document.getElementById('response-body');
        

        if (logEntry.type === 'websocket_frame') {

            responseBody.innerHTML = `
                <div class="websocket-frame-container">
                    <div class="websocket-frame-header">
                        <span class="websocket-frame-direction">${logEntry.direction === 'sent' ? 'Sent' : 'Received'}</span>
                        <span class="websocket-frame-opcode">Opcode: ${logEntry.opcode || '-'}</span>
                    </div>
                    <div class="websocket-frame-data">
                        <pre>${logEntry.data || 'No data'}</pre>
                    </div>
                </div>
            `;
        }

        else if (logEntry.type === 'websocket_error') {
            responseBody.innerHTML = `
                <div class="websocket-error-container">
                    <div class="websocket-error-message">
                        <h3>WebSocket Error</h3>
                        <pre>${logEntry.error || 'Unknown error'}</pre>
                    </div>
                </div>
            `;
        }

        else if (logEntry.type === 'websocket_closed') {
            responseBody.innerHTML = `
                <div class="websocket-closed-container">
                    <div class="websocket-closed-message">
                        <h3>WebSocket Closed</h3>
                        <p>Duration: ${logEntry.duration ? `${logEntry.duration} ms` : 'Unknown'}</p>
                        <p>Frames exchanged: ${logEntry.framesCount || 0}</p>
                    </div>
                </div>
            `;
        }

        else {
            responseBody.innerHTML = `
                <div class="websocket-info-container">
                    <div class="websocket-info-message">
                        <h3>WebSocket Connection</h3>
                        <p>Status: ${logEntry.status || 'Created'}</p>
                        <p>URL: ${logEntry.url || '-'}</p>
                        ${logEntry.initiator ? `<p>Initiator: ${logEntry.initiator.type || '-'}</p>` : ''}
                    </div>
                </div>
            `;
        }
        

        switchTab('response');
    } else {

        

        document.getElementById('log-detail-url').textContent = logEntry.url || '';
        document.getElementById('log-detail-url').title = logEntry.url || '';



        const status = logEntry.response && logEntry.response.statusCode ? logEntry.response.statusCode : (logEntry.status || 0);
        let statusClass = '';
        if (status >= 200 && status < 300) {
            statusClass = 'status-2xx';
        } else if (status >= 300 && status < 400) {
            statusClass = 'status-3xx';
        } else if (status >= 400 && status < 500) {
            statusClass = 'status-4xx';
        } else if (status >= 500) {
            statusClass = 'status-5xx';
        }
        

        const detailStatus = document.getElementById('detail-status');
        detailStatus.textContent = status || '-';
        detailStatus.className = statusClass;
        

        const method = logEntry.method || 'GET';
        const methodClass = `method-${method}`;
        
        const detailMethod = document.getElementById('detail-method');
        detailMethod.textContent = method;
        detailMethod.className = methodClass;
        
        document.getElementById('detail-type').textContent = logEntry.type || '-';
        

        const timestamp = logEntry.timestamp || Date.now();
        const date = new Date(timestamp);
        const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
        document.getElementById('detail-time').textContent = timeString;
        

        const duration = logEntry.duration || 0;
        document.getElementById('detail-duration').textContent = `${duration} ms`;
        

        const requestHeaders = document.getElementById('request-headers');
        requestHeaders.innerHTML = '';
        

        const reqHeaders = logEntry.requestHeaders || (logEntry.request && logEntry.request.headers) || {};
        
        if (Object.keys(reqHeaders).length > 0) {
            Object.entries(reqHeaders).forEach(([name, value]) => {
                const headerItem = document.createElement('div');
                headerItem.classList.add('header-item');
                headerItem.innerHTML = `
                    <div class="header-name">${name}:</div>
                    <div class="header-value">${value}</div>
                `;
                requestHeaders.appendChild(headerItem);
            });
        } else {
            requestHeaders.innerHTML = '<div class="no-data">No request headers available</div>';
        }
        

        const responseHeaders = document.getElementById('response-headers');
        responseHeaders.innerHTML = '';
        

        const respHeaders = logEntry.responseHeaders ||
                          (logEntry.response && logEntry.response.headers) || {};
        
        if (Object.keys(respHeaders).length > 0) {
            Object.entries(respHeaders).forEach(([name, value]) => {
                const headerItem = document.createElement('div');
                headerItem.classList.add('header-item');
                headerItem.innerHTML = `
                    <div class="header-name">${name}:</div>
                    <div class="header-value">${value}</div>
                `;
                responseHeaders.appendChild(headerItem);
            });
        } else {
            responseHeaders.innerHTML = '<div class="no-data">No response headers available</div>';
        }
        

        const requestBody = document.getElementById('request-body');
        

        let reqBody = null;
        
        if (logEntry.requestBody) {
            reqBody = logEntry.requestBody;
        } else if (logEntry.request && logEntry.request.body) {
            reqBody = logEntry.request.body;
        } else if (logEntry.request && typeof logEntry.request.postData !== 'undefined') {
            reqBody = logEntry.request.postData;
        } else if (typeof logEntry.postData !== 'undefined') {
            reqBody = logEntry.postData;
        }
        
        if (reqBody) {
            try {

                if (typeof reqBody === 'string') {
                    try {

                        const parsedJson = JSON.parse(reqBody);
                        const formattedBody = JSON.stringify(parsedJson, null, 2);
                        requestBody.textContent = formattedBody;
                    } catch (jsonError) {

                        if (reqBody.includes('=') && reqBody.includes('&')) {
                            try {

                                const params = new URLSearchParams(reqBody);
                                let formattedParams = '';
                                for (const [key, value] of params.entries()) {
                                    formattedParams += `${key}: ${value}\n`;
                                }
                                requestBody.textContent = formattedParams;
                            } catch (urlError) {

                                requestBody.textContent = reqBody;
                            }
                        } else {

                            requestBody.textContent = reqBody;
                        }
                    }
                } else if (typeof reqBody === 'object') {

                    requestBody.textContent = JSON.stringify(reqBody, null, 2);
                } else {

                    requestBody.textContent = String(reqBody);
                }
            } catch (e) {

                requestBody.textContent = String(reqBody);
            }
        } else {
            requestBody.textContent = 'No request body';
        }
        

        const responseBody = document.getElementById('response-body');
        const respBody = logEntry.responseBody || null;
        
        if (respBody) {
            try {

                if (typeof respBody === 'string' &&
                    (respBody.trim().startsWith('<svg') ||
                     respBody.trim().startsWith('<?xml') && respBody.includes('<svg'))) {

                    responseBody.innerHTML = `
                        <div class="svg-container">
                            ${respBody}
                        </div>
                    `;
                }

                else if (typeof respBody === 'string' &&
                         respBody.startsWith('data:image/svg+xml;base64,')) {

                    const base64Data = respBody.replace('data:image/svg+xml;base64,', '');
                    try {
                        const decodedSvg = atob(base64Data);
                        responseBody.innerHTML = `
                            <div class="svg-container">
                                ${decodedSvg}
                            </div>
                        `;
                    } catch (decodeError) {

                        responseBody.innerHTML = `
                            <div class="image-container">
                                <img src="${respBody}" alt="SVG Image" class="response-image">
                            </div>
                        `;
                    }
                }

                else if (typeof respBody === 'string' &&
                         respBody.startsWith('data:image/')) {

                    responseBody.innerHTML = `
                        <div class="image-container">
                            <img src="${respBody}" alt="Image" class="response-image">
                        </div>
                    `;
                }

                else {
                    try {
                        const formattedBody = JSON.stringify(JSON.parse(respBody), null, 2);
                        responseBody.textContent = formattedBody;
                    } catch (jsonError) {

                        responseBody.textContent = respBody;
                    }
                }
            } catch (e) {

                responseBody.textContent = respBody;
            }
        } else {
            responseBody.textContent = 'No response body';
        }
        

        const tabRequest = document.getElementById('tab-request');
        

        const existingButton = document.getElementById('copy-as-curl');
        if (existingButton) {
            existingButton.remove();
        }
        

        const copyAsCurlBtn = document.createElement('button');
        copyAsCurlBtn.id = 'copy-as-curl';
        copyAsCurlBtn.textContent = 'Copy as cURL';
        copyAsCurlBtn.className = 'copy-button';
        

        copyAsCurlBtn.setAttribute('data-log-id', logEntry.id);
        

        copyAsCurlBtn.onclick = function() {

            const currentLogId = this.getAttribute('data-log-id');
            const currentLogEntry = logEntries.find(entry => entry.id === currentLogId);
            
            if (!currentLogEntry) {
                console.error('Log entry not found for ID:', currentLogId);
                return;
            }
            
            console.log('Copying curl command for log entry:', currentLogEntry);
            console.log('URL:', currentLogEntry.url);
            
            const curlCommand = generateCurlCommand(currentLogEntry);
            navigator.clipboard.writeText(curlCommand)
                .then(() => {
                    this.textContent = 'Copied!';
                    setTimeout(() => {
                        this.textContent = 'Copy as cURL';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                    this.textContent = 'Failed to copy';
                    setTimeout(() => {
                        this.textContent = 'Copy as cURL';
                    }, 2000);
                });
        };
        
        tabRequest.insertBefore(copyAsCurlBtn, requestBody);
    }
}


function generateCurlCommand(logEntry) {

    if (logEntry.type === 'websocket' ||
        logEntry.type === 'websocket_frame' ||
        logEntry.type === 'websocket_closed' ||
        logEntry.type === 'websocket_error') {

        return generateWebSocketCurlCommand(logEntry);
    } else if (logEntry.type === 'screenshot') {

        return '# Screenshots cannot be represented as curl commands';
    }
    

    const url = logEntry.url || '';
    if (!url) {
        return '# Cannot generate curl command: URL is missing';
    }
    

    const method = logEntry.method || 'GET';
    

    const headers = logEntry.requestHeaders || (logEntry.request && logEntry.request.headers) || {};
    

    const body = logEntry.requestBody || (logEntry.request && logEntry.request.body) || null;
    

    let proxyInfo = 'NONE';

    const sessionStartEntry = logEntries.find(entry => entry.type === 'session_start');
    if (sessionStartEntry && sessionStartEntry.proxy_info && sessionStartEntry.proxy_info !== 'NONE') {
        proxyInfo = sessionStartEntry.proxy_info;
    }
    

    let command = `curl -X ${method} '${url}'`;
    

    Object.entries(headers).forEach(([name, value]) => {
        if (typeof value === 'string') {
            command += ` \\\n  -H '${name}: ${value.replace(/'/g, "\\'")}'`;
        } else if (value !== null && value !== undefined) {
            command += ` \\\n  -H '${name}: ${String(value).replace(/'/g, "\\'")}'`;
        }
    });
    

    if (body) {
        try {

            if (typeof body === 'string') {
                try {

                    const jsonBody = JSON.parse(body);
                    command += ` \\\n  -d '${JSON.stringify(jsonBody).replace(/'/g, "\\'")}'`;
                } catch (e) {

                    command += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`;
                }
            } else if (typeof body === 'object') {

                command += ` \\\n  -d '${JSON.stringify(body).replace(/'/g, "\\'")}'`;
            } else {

                command += ` \\\n  -d '${String(body).replace(/'/g, "\\'")}'`;
            }
        } catch (e) {
            console.error('Error processing request body for curl command:', e);
            command += ` \\\n  # Error processing request body: ${e.message}`;
        }
    }
    

    if (proxyInfo && proxyInfo !== 'NONE') {
        command += ` \\\n  --proxy '${proxyInfo}'`;
    }
    
    return command;
}


function generateWebSocketCurlCommand(logEntry) {
    const url = logEntry.url || '';
    if (!url) {
        return '# Cannot generate curl command: WebSocket URL is missing';
    }
    

    const httpUrl = url.replace(/^ws/, 'http');
    

    const headers = logEntry.response && logEntry.response.headers ? logEntry.response.headers : {};
    

    let command = `# WebSocket connection to ${url}\n`;
    command += `# Note: curl doesn't support WebSocket protocol directly\n`;
    command += `# This is a HTTP request that would initiate a WebSocket handshake\n\n`;
    command += `curl -X GET '${httpUrl}' \\\n`;
    command += `  -H 'Connection: Upgrade' \\\n`;
    command += `  -H 'Upgrade: websocket' \\\n`;
    command += `  -H 'Sec-WebSocket-Version: 13' \\\n`;
    command += `  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \\\n`;
    

    Object.entries(headers).forEach(([name, value]) => {
        if (name.toLowerCase() !== 'connection' &&
            name.toLowerCase() !== 'upgrade' &&
            name.toLowerCase() !== 'sec-websocket-version' &&
            name.toLowerCase() !== 'sec-websocket-key') {
            if (typeof value === 'string') {
                command += `  -H '${name}: ${value.replace(/'/g, "\\'")}' \\\n`;
            } else if (value !== null && value !== undefined) {
                command += `  -H '${name}: ${String(value).replace(/'/g, "\\'")}' \\\n`;
            }
        }
    });
    

    if (logEntry.type === 'websocket_frame') {
        command += `\n# WebSocket Frame (${logEntry.direction || 'unknown direction'})\n`;
        command += `# Data: ${logEntry.data || 'empty'}\n`;
    } else if (logEntry.type === 'websocket_closed') {
        command += `\n# WebSocket Closed\n`;
        command += `# Duration: ${logEntry.duration ? `${logEntry.duration} ms` : 'unknown'}\n`;
        command += `# Frames exchanged: ${logEntry.framesCount || 0}\n`;
    } else if (logEntry.type === 'websocket_error') {
        command += `\n# WebSocket Error\n`;
        command += `# Error: ${logEntry.error || 'unknown error'}\n`;
    }
    
    return command;
}


function switchTab(tabId) {

    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    

    document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
}


function applyFiltersAndSearch() {

    logList.innerHTML = '';
    

    filteredLogs = logEntries.filter(passesFilters);
    

    filteredLogs.forEach(logEntry => {
        addLogToDisplay(logEntry);
    });
    

    if (selectedLogId) {
        const logItem = document.querySelector(`.log-list-item[data-id="${selectedLogId}"]`);
        if (logItem) {
            logItem.classList.add('selected');
        } else {

            selectedLogId = null;
            logDetailEmpty.style.display = 'flex';
            logDetail.style.display = 'none';
        }
    }
}


function updateFilterOptions() {


    const uniqueTypes = new Set();
    uniqueTypes.add('all');
    

    logEntries.forEach(entry => {
        if (entry.type) {
            uniqueTypes.add(entry.type);
        }
    });
    

    const currentTypeValue = filterType.value;
    

    filterType.innerHTML = '';
    

    const allTypesOption = document.createElement('option');
    allTypesOption.value = 'all';
    allTypesOption.textContent = 'All Types';
    filterType.appendChild(allTypesOption);
    

    Array.from(uniqueTypes)
        .filter(type => type !== 'all')
        .sort()
        .forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            filterType.appendChild(option);
        });
    

    if (Array.from(uniqueTypes).includes(currentTypeValue)) {
        filterType.value = currentTypeValue;
    } else {
        filterType.value = 'all';
    }
    


    const statusRanges = new Set();
    statusRanges.add('all');
    

    logEntries.forEach(entry => {
        const status = entry.status || 0;
        if (status >= 200 && status < 300) {
            statusRanges.add('success');
        } else if (status >= 300 && status < 400) {
            statusRanges.add('redirect');
        } else if (status >= 400 && status < 500) {
            statusRanges.add('client-error');
        } else if (status >= 500 && status < 600) {
            statusRanges.add('server-error');
        }
    });
    

    const currentStatusValue = filterStatus.value;
    

    filterStatus.innerHTML = '';
    

    const allStatusOption = document.createElement('option');
    allStatusOption.value = 'all';
    allStatusOption.textContent = 'All Status';
    filterStatus.appendChild(allStatusOption);
    

    const statusLabels = {
        'success': 'Success (2xx)',
        'redirect': 'Redirect (3xx)',
        'client-error': 'Client Error (4xx)',
        'server-error': 'Server Error (5xx)'
    };
    

    Array.from(statusRanges)
        .filter(range => range !== 'all')
        .sort()
        .forEach(range => {
            const option = document.createElement('option');
            option.value = range;
            option.textContent = statusLabels[range] || range;
            filterStatus.appendChild(option);
        });
    

    if (Array.from(statusRanges).includes(currentStatusValue)) {
        filterStatus.value = currentStatusValue;
    } else {
        filterStatus.value = 'all';
    }
}


function sortLogsByColumn(columnName) {

    let sortFunction;
    
    switch (columnName) {
        case 'time':
            sortFunction = (a, b) => (a.timestamp || 0) - (b.timestamp || 0);
            break;
        case 'method':
            sortFunction = (a, b) => (a.method || '').localeCompare(b.method || '');
            break;
        case 'status':
            sortFunction = (a, b) => (a.status || 0) - (b.status || 0);
            break;
        case 'type':
            sortFunction = (a, b) => (a.type || '').localeCompare(b.type || '');
            break;
        case 'url':
            sortFunction = (a, b) => (a.url || '').localeCompare(b.url || '');
            break;
        default:
            sortFunction = (a, b) => (a.timestamp || 0) - (b.timestamp || 0);
    }
    

    logEntries.sort(sortFunction);
    

    applyFiltersAndSearch();
}


function clearLogs() {

    logEntries = [];
    filteredLogs = [];
    

    logList.innerHTML = '';
    

    selectedLogId = null;
    logDetailEmpty.style.display = 'flex';
    logDetail.style.display = 'none';
    

    window.electronAPI.clearLogs();
}
