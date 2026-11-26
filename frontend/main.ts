import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron';
import type { OpenDialogOptions, SaveDialogOptions } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import Store from 'electron-store';
import * as logger from './logger';

// O bundle gerado fica em frontend/dist; os assets estáticos
// (index.html, splash.html, assets/) ficam em frontend/ (um nível acima).
const FRONTEND_DIR = path.join(__dirname, '..');
const REPO_ROOT = path.join(FRONTEND_DIR, '..');

// Inicializa o store para os atalhos. Sem default de quickAccessCards:
// ausência da chave = primeira execução, e o renderer semeia os atalhos
// padrão (um [] explícito do usuário continua sendo respeitado).
const store = new Store({
    name: 'user-preferences'
});

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let backendProcess: ChildProcessWithoutNullStreams | null = null;

// Escreve stdout/stderr de um processo filho no log, linha a linha
// (chunks do pipe chegam em tamanhos arbitrários).
function pipeProcessLog(stream: NodeJS.ReadableStream, prefix: string,
                         level: 'log' | 'warn' | 'error'): void {
    let buffer = '';
    stream.on('data', (data) => {
        buffer += data.toString();
        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).replace(/\r$/, '');
            buffer = buffer.slice(idx + 1);
            if (line.trim()) logger[level](`${prefix}${line}`);
        }
    });
    stream.on('end', () => {
        if (buffer.trim()) logger[level](`${prefix}${buffer}`);
        buffer = '';
    });
}

// Função para criar a splash screen
function createSplashWindow(): void {
    splashWindow = new BrowserWindow({
        width: 500,
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
        icon: path.join(FRONTEND_DIR, 'assets', 'icon.png'),
    });
    splashWindow.loadFile(path.join(FRONTEND_DIR, 'splash.html'));
    splashWindow.on('closed', () => {
        splashWindow = null;
    });
}

// Função para criar a janela principal
function createMainWindow(): void {
    const win = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: path.join(FRONTEND_DIR, 'assets', 'icon.png'),
        show: false,
    });
    mainWindow = win;

    // Captura erros/avisos do renderer (API nova do Electron 43:
    // o primeiro argumento é o objeto de detalhes com level como string).
    // Registrado ANTES do loadFile para não perder mensagens iniciais.
    win.webContents.on('console-message', (details) => {
        const { level, message, lineNumber, sourceId } = details;
        if (level === 'debug') return;
        const location = sourceId ? ` (${path.basename(sourceId)}:${lineNumber})` : '';
        if (level === 'error') logger.error(`[Renderer] ${message}${location}`);
        else if (level === 'warning') logger.warn(`[Renderer] ${message}${location}`);
        else logger.log(`[Renderer] ${message}${location}`);
    });

    win.loadFile(path.join(FRONTEND_DIR, 'index.html'));

    win.once('ready-to-show', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
        }
        win.show();
    });

    win.on('closed', () => {
        logger.log('Janela principal fechada');
        mainWindow = null;
        if (backendProcess) {
            backendProcess.kill();
            backendProcess = null;
        }
        app.quit();
    });
}

// Health check do backend
async function waitForBackend(maxAttempts = 30, intervalMs = 500): Promise<boolean> {
    const url = 'http://127.0.0.1:5000/api/health';
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                logger.log('Backend está pronto!');
                return true;
            }
        } catch {
            // ignore
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    logger.warn('Backend não respondeu após várias tentativas.');
    return false;
}

// Função para iniciar o backend
function startBackend(): void {
    const { cmd, args } = getBackendPath();
    logger.log(`Iniciando backend: ${cmd} ${args.join(' ')}`);

    const env: NodeJS.ProcessEnv = {
        ...process.env,
        PORT: '5000',
        // Backend grava o log no mesmo diretório do Electron
        CREMEPE_LOG_DIR: app.getPath('logs'),
    };
    backendProcess = spawn(cmd, args, { env, stdio: 'pipe' });

    // Sem handler de 'error', spawn falho (ex.: python ausente) derruba o app
    backendProcess.on('error', (err) => {
        logger.error(`Falha ao iniciar o processo backend: ${err.message}`);
        backendProcess = null;
    });

    pipeProcessLog(backendProcess.stdout, '[Backend] ', 'log');
    pipeProcessLog(backendProcess.stderr, '[Backend] ', 'error');

    backendProcess.on('close', (code) => {
        if (code === 0) logger.log('Backend encerrado (code 0)');
        else logger.error(`Backend process exited with code ${code}`);
        backendProcess = null;
    });
}

// Determina o caminho do backend (desenvolvimento ou produção)
function getBackendPath(): { cmd: string; args: string[]; isPython: boolean } {
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        const scriptPath = path.join(REPO_ROOT, 'backend', 'app.py');
        // Prefere o interpretador do venv do projeto (deps como pdf2docx);
        // cai para o python do PATH quando o venv não existe.
        const venvPy = process.platform === 'win32'
            ? path.join(REPO_ROOT, 'venv', 'Scripts', 'python.exe')
            : path.join(REPO_ROOT, 'venv', 'bin', 'python');
        const fallback = process.platform === 'win32' ? 'python' : 'python3';
        const cmd = fs.existsSync(venvPy) ? venvPy : fallback;
        return { cmd, args: [scriptPath], isPython: true };
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

// Dev: um backend já servindo a porta (ex.: `npm run start-backend`
// concorrente) é reutilizado — evita o segundo processo brigando por5000
async function backendAlreadyRunning(): Promise<boolean> {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/health', {
            signal: AbortSignal.timeout(800),
        });
        return res.ok;
    } catch {
        return false;
    }
}

// Eventos do app
app.whenReady().then(async () => {
    logger.init(app);
    logger.log(`CREMEPE Office v${app.getVersion()} iniciando` +
        ` (packaged=${app.isPackaged}, log=${logger.getLogPath()})`);

    createSplashWindow();
    if (!app.isPackaged && (await backendAlreadyRunning())) {
        logger.log('Backend já ativo em 127.0.0.1:5000 — reutilizando');
    } else {
        startBackend();
    }
    const backendOk = await waitForBackend(30, 500);
    if (!backendOk) {
        logger.warn('Backend não iniciou a tempo, mas continuaremos.');
    }
    createMainWindow();
    setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
            splashWindow = null;
        }
    }, 2000);
});

app.on('window-all-closed', () => {
    logger.log('Todas as janelas fechadas');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createMainWindow();
    }
});

app.on('will-quit', () => {
    logger.log('Encerrando aplicativo');
    if (backendProcess) {
        backendProcess.kill();
        backendProcess = null;
    }
    logger.close();
});

// Diagnóstico: processo do renderer ou filho do Electron morreu
app.on('render-process-gone', (event, webContents, details) => {
    logger.error(`Renderer process gone: reason=${details.reason}, exitCode=${details.exitCode}`);
});
app.on('child-process-gone', (event, details) => {
    logger.error(`Child process gone: type=${details.type}, reason=${details.reason}, exitCode=${details.exitCode}`);
});

// Erros não tratados no processo principal: registra no arquivo de log.
// (em app GUI o stderr não é visível, então sem isto o erro se perderia)
process.on('uncaughtException', (err) => {
    logger.error('uncaughtException no processo principal:', err);
});
process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection no processo principal:', reason);
});

// ========== IPC HANDLERS para electron-store ==========
ipcMain.handle('store:get', (_event: Electron.IpcMainInvokeEvent, key: string) => {
    return store.get(key);
});
ipcMain.handle('store:set', (_event: Electron.IpcMainInvokeEvent, key: string, value: unknown) => {
    store.set(key, value);
    return true;
});

ipcMain.handle('store:delete', (_event: Electron.IpcMainInvokeEvent, key: string) => {
    store.delete(key);
    return true;
});

// ========== IPC HANDLERS para diálogos ==========
ipcMain.handle('dialog:open', async (_event: Electron.IpcMainInvokeEvent, options: OpenDialogOptions) => {
    if (!mainWindow) return { canceled: true, filePaths: [] as string[] };
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

ipcMain.handle('dialog:save', async (_event: Electron.IpcMainInvokeEvent, options: SaveDialogOptions) => {
    if (!mainWindow) return { canceled: true, filePaths: [] as string[] };
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

ipcMain.handle('get-base-path', () => {
    return app.getAppPath();
});

// ========== IPC HANDLERS: resultado da operação ==========
// Abrir/copiar o arquivo gerado — antes o usuario via o caminho no log
// e precisava digitar à mão em outro lugar.
ipcMain.handle('shell:open-path', async (_event: Electron.IpcMainInvokeEvent, caminho: string) => {
    if (!caminho || typeof caminho !== 'string') {
        return { ok: false, error: 'caminho inválido' };
    }
    if (!fs.existsSync(caminho)) {
        return { ok: false, error: 'arquivo não encontrado' };
    }
    const erro = await shell.openPath(caminho);
    return erro ? { ok: false, error: erro } : { ok: true };
});

ipcMain.handle('shell:show-item', (_event: Electron.IpcMainInvokeEvent, caminho: string) => {
    if (!caminho || typeof caminho !== 'string') return false;
    shell.showItemInFolder(caminho);
    return true;
});

ipcMain.handle('clipboard:write-text', (_event: Electron.IpcMainInvokeEvent, texto: string) => {
    clipboard.writeText(String(texto ?? ''));
    return true;
});
