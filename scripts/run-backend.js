/**
 * Sobe o backend com o interpretador do venv do projeto (deps como
 * pdf2docx vivem lá); cai para o python do PATH se o venv não existir.
 * Usado pelo script npm start-backend (cross-platform).
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const venvPy = process.platform === 'win32'
    ? path.join(root, 'venv', 'Scripts', 'python.exe')
    : path.join(root, 'venv', 'bin', 'python');
const fallback = process.platform === 'win32' ? 'python' : 'python3';
const py = fs.existsSync(venvPy) ? venvPy : fallback;

console.log(`[start-backend] ${py} backend/app.py`);
const child = spawn(py, [path.join(root, 'backend', 'app.py')], {
    stdio: 'inherit',
    cwd: root,
});
child.on('error', (err) => {
    console.error(`[start-backend] falha ao iniciar: ${err.message}`);
    process.exit(1);
});
child.on('exit', (code) => process.exit(code == null ? 1 : code));
