const FileUtils = {
    _dialogOpen: false, // impede múltiplas aberturas simultâneas

    selectDirectory: function (inputId) {
        if (this._dialogOpen) {
            console.warn('Diálogo já em andamento.');
            return;
        }

        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            this._dialogOpen = true;
            window.electronAPI.showOpenDialog({ properties: ['openDirectory'] })
                .then(result => {
                    this._dialogOpen = false;
                    if (!result.canceled && result.filePaths.length > 0) {
                        const input = document.getElementById(inputId);
                        if (input) {
                            input.value = result.filePaths[0];
                            // Dispara evento 'change' para sincronizar
                            const event = new Event('change', { bubbles: true });
                            input.dispatchEvent(event);
                        }
                    }
                })
                .catch(() => {
                    this._dialogOpen = false;
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