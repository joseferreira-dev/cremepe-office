const FileUtils = {
    selectDirectory: function (inputId) {
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            window.electronAPI.showOpenDialog({ properties: ['openDirectory'] })
                .then(result => {
                    if (!result.canceled && result.filePaths.length > 0) {
                        document.getElementById(inputId).value = result.filePaths[0];
                        // Dispara evento 'change' para que outros listeners sejam notificados
                        const input = document.getElementById(inputId);
                        const event = new Event('change', { bubbles: true });
                        input.dispatchEvent(event);
                    }
                });
        } else {
            alert('Selecione a pasta manualmente.');
        }
    },

    log: function (message, logId) {
        const logArea = document.getElementById(logId);
        if (logArea) {
            const p = document.createElement('p');
            p.textContent = message;
            logArea.appendChild(p);
            logArea.scrollTop = logArea.scrollHeight;
        }
    },

    clearLog: function (logId) {
        const logArea = document.getElementById(logId);
        if (logArea) {
            logArea.innerHTML = '';
        }
    }
};