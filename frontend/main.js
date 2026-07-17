const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 750,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
        },
        icon: path.join(__dirname, 'assets', 'icon.png'), // opcional
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // DevTools (opcional, remova em produção)
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
        // Encerrar backend ao fechar a janela
        if (backendProcess) {
            backendProcess.kill();
            backendProcess = null;
        }
        app.quit();
    });
}

ipcMain.handle('dialog:open', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

ipcMain.handle('dialog:save', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

app.whenReady().then(() => {
    // Iniciar o servidor Flask como subprocesso
    startBackend();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Função para iniciar o backend (Flask)
function startBackend() {
    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    const backendScript = path.join(__dirname, '..', 'backend', 'app.py');

    // Verifica se o script existe
    if (!fs.existsSync(backendScript)) {
        console.error('Backend script not found:', backendScript);
        return;
    }

    backendProcess = spawn(pythonPath, [backendScript], {
        env: { ...process.env, PORT: 5000 },
        stdio: 'pipe',
    });

    backendProcess.stdout.on('data', (data) => {
        console.log(`[Backend] ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
        console.error(`[Backend Error] ${data}`);
    });

    backendProcess.on('close', (code) => {
        console.log(`Backend process exited with code ${code}`);
        backendProcess = null;
    });

    // Aguardar um pouco para o servidor iniciar
    // (em produção, seria melhor usar um mecanismo de health check)
    setTimeout(() => {
        console.log('Backend iniciado (aguardando conexão)');
    }, 2000);
}

// Expor função para o renderer obter o caminho base (opcional)
ipcMain.handle('get-base-path', () => {
    return app.getAppPath();
});