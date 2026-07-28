const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let splashWindow;
let backendProcess = null;
let backendReady = false;

// Função para criar a splash screen
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 500,
        frame: false,
        transparent: false,
        alwaysOnTop: true,
        resizable: false,
        center: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
    });
    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.on('closed', () => {
        splashWindow = null;
    });
}

// Função para criar a janela principal
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false, // não mostra até estar pronta
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.once('ready-to-show', () => {
        // Quando a janela estiver carregada, exibe e fecha splash
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
        }
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (backendProcess) {
            backendProcess.kill();
            backendProcess = null;
        }
        app.quit();
    });
}

// Health check do backend
async function waitForBackend(maxAttempts = 30, intervalMs = 500) {
    const url = 'http://localhost:5000/api/health';
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                console.log('Backend está pronto!');
                return true;
            }
        } catch (e) {
            // ignore, tenta novamente
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    console.warn('Backend não respondeu após várias tentativas.');
    return false;
}

// Função para iniciar o backend (mantida)
function startBackend() {
    const { cmd, args, isPython } = getBackendPath();
    console.log(`Iniciando backend: ${cmd} ${args.join(' ')}`);

    const env = { ...process.env, PORT: 5000 };
    backendProcess = spawn(cmd, args, { env, stdio: 'pipe' });

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
}

// Determina o caminho do backend (desenvolvimento ou produção)
function getBackendPath() {
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
        const scriptPath = path.join(__dirname, '..', 'backend', 'app.py');
        return { cmd: pythonPath, args: [scriptPath], isPython: true };
    } else {
        let exePath;
        if (process.platform === 'win32') {
            exePath = path.join(process.resourcesPath, 'backend.exe');
        } else {
            exePath = path.join(path.dirname(app.getPath('exe')), 'backend');
        }
        if (!fs.existsSync(exePath)) {
            exePath = path.join(path.dirname(app.getPath('exe')), 'backend.exe');
        }
        return { cmd: exePath, args: [], isPython: false };
    }
}

// Eventos do app
app.whenReady().then(async () => {
    // Cria splash primeiro
    createSplashWindow();

    // Inicia o backend
    startBackend();

    // Aguarda o backend ficar pronto (com timeout)
    const backendOk = await waitForBackend(30, 500); // 15 segundos

    if (!backendOk) {
        console.warn('Backend não iniciou a tempo, mas continuaremos.');
    }

    // Cria a janela principal
    createMainWindow();

    // Força o fechamento da splash se ainda estiver aberta (caso o ready-to-show da main não dispare)
    setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
            splashWindow = null;
        }
    }, 2000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});

// Quando o app for fechado, mata o backend
app.on('will-quit', () => {
    if (backendProcess) {
        backendProcess.kill();
        backendProcess = null;
    }
});

// IPC handlers (dialogos)
ipcMain.handle('dialog:open', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

ipcMain.handle('dialog:save', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

ipcMain.handle('get-base-path', () => {
    return app.getAppPath();
});