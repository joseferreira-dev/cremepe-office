"use strict";

// frontend/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Enviar mensagem para o main (exemplo)
  send: (channel, data) => {
    const validChannels = ["toMain"];
    if (validChannels.includes(channel)) {
      import_electron.ipcRenderer.send(channel, data);
    }
  },
  // Receber mensagens do main
  receive: (channel, func) => {
    const validChannels = ["fromMain"];
    if (validChannels.includes(channel)) {
      import_electron.ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  },
  // Diálogos
  showOpenDialog: (options) => import_electron.ipcRenderer.invoke("dialog:open", options),
  showSaveDialog: (options) => import_electron.ipcRenderer.invoke("dialog:save", options),
  // ========== API do electron-store ==========
  storeGet: (key) => import_electron.ipcRenderer.invoke("store:get", key),
  storeSet: (key, value) => import_electron.ipcRenderer.invoke("store:set", key, value),
  storeDelete: (key) => import_electron.ipcRenderer.invoke("store:delete", key),
  // ========== Resultado da operação (barra "Abrir/Copiar") ==========
  openPath: (caminho) => import_electron.ipcRenderer.invoke("shell:open-path", caminho),
  showItemInFolder: (caminho) => import_electron.ipcRenderer.invoke("shell:show-item", caminho),
  copyText: (texto) => import_electron.ipcRenderer.invoke("clipboard:write-text", texto)
});
import_electron.contextBridge.exposeInMainWorld("getBasePath", () => {
  return import_electron.ipcRenderer.invoke("get-base-path");
});
