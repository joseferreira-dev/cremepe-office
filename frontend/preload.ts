import { contextBridge, ipcRenderer } from 'electron';
import type {
    OpenDialogOptions,
    OpenDialogReturnValue,
    SaveDialogOptions,
    SaveDialogReturnValue,
} from 'electron';

// Expor APIs seguras para o renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Enviar mensagem para o main (exemplo)
    send: (channel: string, data?: unknown): void => {
        const validChannels = ['toMain'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    // Receber mensagens do main
    receive: (channel: string, func: (...args: unknown[]) => void): void => {
        const validChannels = ['fromMain'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (_event, ...args) => func(...args));
        }
    },
    // Diálogos
    showOpenDialog: (options: OpenDialogOptions): Promise<OpenDialogReturnValue> =>
        ipcRenderer.invoke('dialog:open', options),
    showSaveDialog: (options: SaveDialogOptions): Promise<SaveDialogReturnValue> =>
        ipcRenderer.invoke('dialog:save', options),

    // ========== API do electron-store ==========
    storeGet: (key: string): Promise<unknown> => ipcRenderer.invoke('store:get', key),
    storeSet: (key: string, value: unknown): Promise<boolean> =>
        ipcRenderer.invoke('store:set', key, value),
    storeDelete: (key: string): Promise<boolean> => ipcRenderer.invoke('store:delete', key),
});

// Função para obter o caminho base
contextBridge.exposeInMainWorld('getBasePath', (): Promise<string> => {
    return ipcRenderer.invoke('get-base-path');
});
