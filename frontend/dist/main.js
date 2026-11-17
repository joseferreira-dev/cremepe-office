"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// frontend/main.ts
var import_electron = require("electron");
var import_path2 = __toESM(require("path"));
var import_child_process = require("child_process");
var import_fs2 = __toESM(require("fs"));
var import_electron_store = __toESM(require("electron-store"));

// frontend/logger.ts
var logger_exports = {};
__export(logger_exports, {
  close: () => close,
  error: () => error,
  getLogPath: () => getLogPath,
  init: () => init,
  log: () => log,
  warn: () => warn
});
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var stream = null;
var logPath = null;
function init(app2) {
  if (stream) return logPath;
  try {
    const dir = app2.getPath("logs");
    import_fs.default.mkdirSync(dir, { recursive: true });
    logPath = import_path.default.join(dir, "cremepe-office.log");
    stream = import_fs.default.createWriteStream(logPath, { flags: "a" });
    stream.on("error", (e) => {
      console.error("Logger: erro ao gravar log:", e.message);
      stream = null;
    });
  } catch (e) {
    console.error("Logger: n\xE3o foi poss\xEDvel abrir arquivo de log:", e.message);
    stream = null;
  }
  return logPath;
}
function close() {
  if (stream) {
    try {
      stream.end();
    } catch {
    }
    stream = null;
  }
}
function formatArgs(args) {
  return args.map((a) => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === "object" && a !== null) {
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    }
    return String(a);
  }).join(" ");
}
function write(level, args) {
  const line = `${(/* @__PURE__ */ new Date()).toISOString()} [${level}] ${formatArgs(args)}`;
  if (level === "ERROR") console.error(line);
  else console.log(line);
  if (stream) {
    try {
      stream.write(line + "\n");
    } catch {
    }
  }
}
function getLogPath() {
  return logPath;
}
function log(...args) {
  write("INFO", args);
}
function warn(...args) {
  write("WARN", args);
}
function error(...args) {
  write("ERROR", args);
}

// frontend/main.ts
var FRONTEND_DIR = import_path2.default.join(__dirname, "..");
var REPO_ROOT = import_path2.default.join(FRONTEND_DIR, "..");
var store = new import_electron_store.default({
  name: "user-preferences"
});
var mainWindow = null;
var splashWindow = null;
var backendProcess = null;
function pipeProcessLog(stream2, prefix, level) {
  let buffer = "";
  stream2.on("data", (data) => {
    buffer += data.toString();
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      if (line.trim()) logger_exports[level](`${prefix}${line}`);
    }
  });
  stream2.on("end", () => {
    if (buffer.trim()) logger_exports[level](`${prefix}${buffer}`);
    buffer = "";
  });
}
function createSplashWindow() {
  splashWindow = new import_electron.BrowserWindow({
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
      preload: import_path2.default.join(__dirname, "preload.js")
    },
    icon: import_path2.default.join(FRONTEND_DIR, "assets", "icon.png")
  });
  splashWindow.loadFile(import_path2.default.join(FRONTEND_DIR, "splash.html"));
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}
function createMainWindow() {
  const win = new import_electron.BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1e3,
    minHeight: 600,
    webPreferences: {
      preload: import_path2.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: import_path2.default.join(FRONTEND_DIR, "assets", "icon.png"),
    show: false
  });
  mainWindow = win;
  win.webContents.on("console-message", (details) => {
    const { level, message, lineNumber, sourceId } = details;
    if (level === "debug") return;
    const location = sourceId ? ` (${import_path2.default.basename(sourceId)}:${lineNumber})` : "";
    if (level === "error") error(`[Renderer] ${message}${location}`);
    else if (level === "warning") warn(`[Renderer] ${message}${location}`);
    else log(`[Renderer] ${message}${location}`);
  });
  win.loadFile(import_path2.default.join(FRONTEND_DIR, "index.html"));
  win.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    win.show();
  });
  win.on("closed", () => {
    log("Janela principal fechada");
    mainWindow = null;
    if (backendProcess) {
      backendProcess.kill();
      backendProcess = null;
    }
    import_electron.app.quit();
  });
}
async function waitForBackend(maxAttempts = 30, intervalMs = 500) {
  const url = "http://127.0.0.1:5000/api/health";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        log("Backend est\xE1 pronto!");
        return true;
      }
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  warn("Backend n\xE3o respondeu ap\xF3s v\xE1rias tentativas.");
  return false;
}
function startBackend() {
  const { cmd, args } = getBackendPath();
  log(`Iniciando backend: ${cmd} ${args.join(" ")}`);
  const env = {
    ...process.env,
    PORT: "5000",
    // Backend grava o log no mesmo diretório do Electron
    CREMEPE_LOG_DIR: import_electron.app.getPath("logs")
  };
  backendProcess = (0, import_child_process.spawn)(cmd, args, { env, stdio: "pipe" });
  backendProcess.on("error", (err) => {
    error(`Falha ao iniciar o processo backend: ${err.message}`);
    backendProcess = null;
  });
  pipeProcessLog(backendProcess.stdout, "[Backend] ", "log");
  pipeProcessLog(backendProcess.stderr, "[Backend] ", "error");
  backendProcess.on("close", (code) => {
    if (code === 0) log("Backend encerrado (code 0)");
    else error(`Backend process exited with code ${code}`);
    backendProcess = null;
  });
}
function getBackendPath() {
  if (process.env.NODE_ENV === "development" || !import_electron.app.isPackaged) {
    const scriptPath = import_path2.default.join(REPO_ROOT, "backend", "app.py");
    const venvPy = process.platform === "win32" ? import_path2.default.join(REPO_ROOT, "venv", "Scripts", "python.exe") : import_path2.default.join(REPO_ROOT, "venv", "bin", "python");
    const fallback = process.platform === "win32" ? "python" : "python3";
    const cmd = import_fs2.default.existsSync(venvPy) ? venvPy : fallback;
    return { cmd, args: [scriptPath], isPython: true };
  } else {
    let exePath;
    if (process.platform === "win32") {
      exePath = import_path2.default.join(process.resourcesPath, "backend.exe");
    } else {
      exePath = import_path2.default.join(import_path2.default.dirname(import_electron.app.getPath("exe")), "backend");
    }
    if (!import_fs2.default.existsSync(exePath)) {
      exePath = import_path2.default.join(import_path2.default.dirname(import_electron.app.getPath("exe")), "backend.exe");
    }
    return { cmd: exePath, args: [], isPython: false };
  }
}
async function backendAlreadyRunning() {
  try {
    const res = await fetch("http://127.0.0.1:5000/api/health", {
      signal: AbortSignal.timeout(800)
    });
    return res.ok;
  } catch {
    return false;
  }
}
import_electron.app.whenReady().then(async () => {
  init(import_electron.app);
  log(`CREMEPE Office v${import_electron.app.getVersion()} iniciando (packaged=${import_electron.app.isPackaged}, log=${getLogPath()})`);
  createSplashWindow();
  if (!import_electron.app.isPackaged && await backendAlreadyRunning()) {
    log("Backend j\xE1 ativo em 127.0.0.1:5000 \u2014 reutilizando");
  } else {
    startBackend();
  }
  const backendOk = await waitForBackend(30, 500);
  if (!backendOk) {
    warn("Backend n\xE3o iniciou a tempo, mas continuaremos.");
  }
  createMainWindow();
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  }, 2e3);
});
import_electron.app.on("window-all-closed", () => {
  log("Todas as janelas fechadas");
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});
import_electron.app.on("activate", () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});
import_electron.app.on("will-quit", () => {
  log("Encerrando aplicativo");
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  close();
});
import_electron.app.on("render-process-gone", (event, webContents, details) => {
  error(`Renderer process gone: reason=${details.reason}, exitCode=${details.exitCode}`);
});
import_electron.app.on("child-process-gone", (event, details) => {
  error(`Child process gone: type=${details.type}, reason=${details.reason}, exitCode=${details.exitCode}`);
});
process.on("uncaughtException", (err) => {
  error("uncaughtException no processo principal:", err);
});
process.on("unhandledRejection", (reason) => {
  error("unhandledRejection no processo principal:", reason);
});
import_electron.ipcMain.handle("store:get", (_event, key) => {
  return store.get(key);
});
import_electron.ipcMain.handle("store:set", (_event, key, value) => {
  store.set(key, value);
  return true;
});
import_electron.ipcMain.handle("store:delete", (_event, key) => {
  store.delete(key);
  return true;
});
import_electron.ipcMain.handle("dialog:open", async (_event, options) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  const result = await import_electron.dialog.showOpenDialog(mainWindow, options);
  return result;
});
import_electron.ipcMain.handle("dialog:save", async (_event, options) => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  const result = await import_electron.dialog.showSaveDialog(mainWindow, options);
  return result;
});
import_electron.ipcMain.handle("get-base-path", () => {
  return import_electron.app.getAppPath();
});
