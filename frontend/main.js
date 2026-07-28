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

function getBackendPath() {
    // Em desenvolvimento: usa o script Python
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
        const scriptPath = path.join(__dirname, '..', 'backend', 'app.py');
        return { cmd: pythonPath, args: [scriptPath], isPython: true };
    } else {
        // Em produção: usa o executável embutido
        // O executável backend.exe estará ao lado do app ou em resources/
        let exePath;
        if (process.platform === 'win32') {
            // No Windows, o app é um .exe e os recursos ficam em resources/
            exePath = path.join(process.resourcesPath, 'backend.exe');
        } else {
            // Para outros SOs, ajuste conforme
            exePath = path.join(path.dirname(app.getPath('exe')), 'backend');
        }
        // Se não existir, tenta no diretório do app
        if (!fs.existsSync(exePath)) {
            exePath = path.join(path.dirname(app.getPath('exe')), 'backend.exe');
        }
        return { cmd: exePath, args: [], isPython: false };
    }
}

// Função para iniciar o backend (Flask)
function startBackend() {
    const { cmd, args, isPython } = getBackendPath();
    console.log(`Iniciando backend: ${cmd} ${args.join(' ')}`);

    const env = { ...process.env, PORT: 5000 };
    if (isPython) {
        backendProcess = spawn(cmd, args, { env, stdio: 'pipe' });
    } else {
        // Para executável, apenas executa
        backendProcess = spawn(cmd, args, { env, stdio: 'pipe' });
    }

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

// Quando o app for fechado, mata o backend
app.on('will-quit', () => {
    if (backendProcess) {
        backendProcess.kill();
        backendProcess = null;
    }
});

// Expor função para o renderer obter o caminho base (opcional)
ipcMain.handle('get-base-path', () => {
    return app.getAppPath();
});