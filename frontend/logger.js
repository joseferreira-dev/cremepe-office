/**
 * Logger do processo principal (Electron).
 *
 * Em desenvolvimento escreve também no console; em produção (app GUI)
 * o console não existe, então tudo é gravado em arquivo em
 * app.getPath('logs') — normalmente %APPDATA%\<app>\Logs no Windows.
 *
 * Uso:
 *   const logger = require('./logger');
 *   logger.init(app);          // uma vez, no whenReady
 *   logger.log('iniciando');
 *   logger.error('falha:', err);
 */
const fs = require('fs');
const path = require('path');

let stream = null;
let logPath = null;

function init(app) {
    if (stream) return logPath;
    try {
        const dir = app.getPath('logs');
        fs.mkdirSync(dir, { recursive: true });
        logPath = path.join(dir, 'cremepe-office.log');
        stream = fs.createWriteStream(logPath, { flags: 'a' });
        stream.on('error', (e) => {
            console.error('Logger: erro ao gravar log:', e.message);
            stream = null;
        });
    } catch (e) {
        console.error('Logger: não foi possível abrir arquivo de log:', e.message);
        stream = null;
    }
    return logPath;
}

function close() {
    if (stream) {
        try { stream.end(); } catch (e) { /* ignora */ }
        stream = null;
    }
}

function formatArgs(args) {
    return args.map((a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'object' && a !== null) {
            try { return JSON.stringify(a); } catch (e) { return String(a); }
        }
        return String(a);
    }).join(' ');
}

function write(level, args) {
    const line = `${new Date().toISOString()} [${level}] ${formatArgs(args)}`;
    // Console (visível em dev; ignora silenciosamente em app GUI)
    if (level === 'ERROR') console.error(line);
    else console.log(line);

    if (stream) {
        try {
            stream.write(line + '\n');
        } catch (e) {
            // Log nunca pode derrubar o app
        }
    }
}

module.exports = {
    init,
    close,
    getLogPath: () => logPath,
    log: (...args) => write('INFO', args),
    warn: (...args) => write('WARN', args),
    error: (...args) => write('ERROR', args),
};
