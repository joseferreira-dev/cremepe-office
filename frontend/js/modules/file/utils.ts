export const FileUtils = {
    _dialogOpen: false, // impede múltiplas aberturas simultâneas

    selectDirectory: function (inputId: string) {
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
                        const input = document.getElementById(inputId)!;
                        if (input) {
                            (input as DomElement).value = result.filePaths[0];
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

    log: function (message: string, logId: string) {
        const logArea = document.getElementById(logId)!;
        if (logArea) {
            const p = document.createElement('p');
            p.textContent = message;
            logArea.appendChild(p);
            logArea.scrollTop = logArea.scrollHeight;
        }
    },

    clearLog: function (logId: string) {
        const logArea = document.getElementById(logId)!;
        if (logArea) {
            logArea.innerHTML = '';
        }
    },

    // Adicione no FileUtils:
    selectFile: function (inputId: string, filters: any) {
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            window.electronAPI.showOpenDialog({ properties: ['openFile'], filters })
                .then(result => {
                    if (!result.canceled && result.filePaths.length > 0) {
                        (document.getElementById(inputId) as DomElement).value = result.filePaths[0];
                    }
                });
        } else {
            alert('Selecione o arquivo manualmente.');
        }
    },

    selectSaveFile: function (inputId: string, filters: any) {
        if (window.electronAPI && window.electronAPI.showSaveDialog) {
            window.electronAPI.showSaveDialog({ filters })
                .then(result => {
                    if (!result.canceled && result.filePath) {
                        (document.getElementById(inputId) as DomElement).value = result.filePath;
                    }
                });
        } else {
            alert('Selecione o local para salvar.');
        }
    },
};