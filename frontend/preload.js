const { contextBridge, ipcRenderer } = require('electron');

// Expor APIs seguras para o renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Enviar mensagem para o main (exemplo)
    send: (channel, data) => {
        // canais permitidos
        const validChannels = ['toMain'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    // Receber mensagens do main
    receive: (channel, func) => {
        const validChannels = ['fromMain'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    // Outras funções úteis, como abrir diálogo de arquivo (via main)
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:open', options),
    showSaveDialog: (options) => ipcRenderer.invoke('dialog:save', options),
});

// Pode-se adicionar também uma função para obter o caminho base
contextBridge.exposeInMainWorld('getBasePath', () => {
    return ipcRenderer.invoke('get-base-path');
});