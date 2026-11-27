// Prepara o Tesseract-OCR para embutir no instalador.
//
//   node scripts/build-tesseract.js           build (pula se ja pronto)
//   node scripts/build-tesseract.js --force   refaz do zero
//
// Gera vendor/tesseract/ (binario + idiomas por/eng), que o
// electron-builder copia para resources/tesseract/ via extraResources.
// O backend (backend/services/pdf_ocr.py) descobre esse diretorio sozinho
// e o usa ANTES do Tesseract do sistema — assim o OCR funciona sem nada
// instalado no computador do usuario final.
//
// Por que extrair em vez de instalar:
//   - o instalador do UB Mannheim (NSIS) tem manifesto "highestAvailable"
//     e pediria UAC em conta de administrador;
//   - ele BAIXA os .traineddata durante a instalacao (o tessdata/ vem
//     vazio quando extraido), entao os idiomas sao baixados aqui
//     direto do repositorio oficial.
// Os tres arquivos sao fixados por SHA256: build deterministico.
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DEST = path.join(RAIZ, 'vendor', 'tesseract');
const CACHE = path.join(RAIZ, 'vendor', '.cache');

const FONTES = [
    {
        nome: 'tesseract-ocr-w64-setup-5.5.0.20241111.exe',
        url: 'https://github.com/tesseract-ocr/tesseract/releases/download/5.5.0/tesseract-ocr-w64-setup-5.5.0.20241111.exe',
        sha256: 'f3fc4236425b690c8be756f35793f77394ee004be0a6460a440c754d892f68bc',
    },
    {
        nome: 'eng.traineddata',
        url: 'https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata',
        sha256: 'daa0c97d651c19fba3b25e81317cd697e9908c8208090c94c3905381c23fc047',
    },
    {
        nome: 'por.traineddata',
        url: 'https://github.com/tesseract-ocr/tessdata/raw/main/por.traineddata',
        sha256: '016c6a371bb1e4c48fe521908cf3ba3d751fade0ab846ad5d4086b563f5c528c',
    },
];

// Restos do instalador que nao interessam ao runtime.
const LIXO = ['$PLUGINSDIR', 'doc', 'tesseract-uninstall.exe'];

function falhar(msg) {
    console.error(`[build-tesseract] ERRO: ${msg}`);
    process.exit(1);
}

function hashArquivo(f) {
    return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
}

function mb(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Download com cache e verificacao de SHA256 (segue redirects do GitHub). */
function baixar(fonte, tentativas = 5) {
    const destino = path.join(CACHE, fonte.nome);
    if (fs.existsSync(destino)) {
        if (hashArquivo(destino) === fonte.sha256) {
            console.log(`  cache valido: ${fonte.nome}`);
            return Promise.resolve(destino);
        }
        console.log(`  cache invalido, baixando de novo: ${fonte.nome}`);
        fs.unlinkSync(destino);
    }

    console.log(`  baixando ${fonte.nome}...`);
    return new Promise((resolve, reject) => {
        const get = (url, restantes) => {
            https.get(url, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    if (restantes <= 0) return reject(new Error('redirects demais'));
                    return get(res.headers.location, restantes - 1);
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`HTTP ${res.statusCode} em ${url}`));
                }
                const ws = fs.createWriteStream(destino);
                res.pipe(ws);
                ws.on('finish', () => {
                    ws.close();
                    const h = hashArquivo(destino);
                    if (h !== fonte.sha256) {
                        fs.unlinkSync(destino);
                        return reject(new Error(
                            `SHA256 divergente em ${fonte.nome}\n  esperado ${fonte.sha256}\n  obtido   ${h}`));
                    }
                    console.log(`  ok: ${fonte.nome} (${mb(fs.statSync(destino).size)})`);
                    resolve(destino);
                });
                ws.on('error', reject);
            }).on('error', reject);
        };
        get(fonte.url, tentativas);
    });
}

/** Localiza o executavel do 7-Zip (extraia instalador NSIS sem UAC). */
function achar7z() {
    if (process.env.SEVEN_ZIP && fs.existsSync(process.env.SEVEN_ZIP)) {
        return process.env.SEVEN_ZIP;
    }
    const candidatos = [
        'C:\\Program Files\\7-Zip\\7z.exe',
        'C:\\Program Files (x86)\\7-Zip\\7z.exe',
        '/usr/bin/7z',
        '/usr/bin/7zz',
        '/opt/homebrew/bin/7z',
    ];
    for (const c of candidatos) {
        if (fs.existsSync(c)) return c;
    }
    const teste = spawnSync('7z', ['-h'], { stdio: 'ignore' });
    if (!teste.error) return '7z';
    return null;
}

function extrair(instalador, destino) {
    const sete = achar7z();
    if (!sete) {
        falhar('7-Zip nao encontrado. Instale em C:\\Program Files\\7-Zip '
            + 'ou defina a variavel SEVEN_ZIP com o caminho do 7z.exe.');
    }
    console.log(`  extraindo com ${sete}...`);
    if (fs.existsSync(destino)) fs.rmSync(destino, { recursive: true, force: true });
    const r = spawnSync(sete, ['x', instalador, `-o${destino}`, '-y'], { stdio: 'ignore' });
    if (r.status !== 0) falhar(`7-Zip falhou (status ${r.status})`);
}

function limpar(destino) {
    for (const item of LIXO) {
        const alvo = path.join(destino, item);
        if (fs.existsSync(alvo)) fs.rmSync(alvo, { recursive: true, force: true });
    }
}

function jaPronto() {
    const exe = process.platform === 'win32' ? 'tesseract.exe' : 'tesseract';
    const tessdata = path.join(DEST, 'tessdata');
    return fs.existsSync(path.join(DEST, exe))
        && fs.existsSync(path.join(tessdata, 'eng.traineddata'))
        && fs.existsSync(path.join(tessdata, 'por.traineddata'));
}

function verificar() {
    const exe = path.join(DEST, 'tesseract.exe');
    if (!fs.existsSync(exe)) falhar('tesseract.exe ausente apos a extracao');
    for (const idioma of ['eng', 'por']) {
        const f = path.join(DEST, 'tessdata', `${idioma}.traineddata`);
        if (!fs.existsSync(f)) falhar(`tessdata/${idioma}.traineddata ausente`);
    }
    // Prova que o binario roda com as DLLs extraidas ao lado.
    const v = spawnSync(exe, ['--version'], { encoding: 'utf8' });
    if (v.status !== 0) {
        falhar(`tesseract.exe nao executou (status ${v.status}): ${v.stderr || ''}`);
    }
    const primeira = (v.stderr || v.stdout || '').split('\n')[0].trim();
    console.log(`  binario OK: ${primeira}`);
}

function gravarNotice() {
    const fontes = FONTES.map((f) => `  ${f.nome}\n    ${f.url}\n    sha256 ${f.sha256}`).join('\n');
    const texto = `Tesseract OCR — binario embutido no CREMEPE Office
=========================================================
Gerado por scripts/build-tesseract.js em ${new Date().toISOString()}

Fontes (SHA256 fixado):
${fontes}

Licenca: Apache License2.0
  https://github.com/tesseract-ocr/tesseract/blob/main/LICENSE
  Os arquivos .traineddata vem de tesseract-ocr/tessdata (Apache2.0).

Uso: o backend (backend/services/pdf_ocr.py) procura este diretorio
antes do Tesseract do sistema; pode ser sobrescrito com TESSERACT_HOME.
`;
    fs.writeFileSync(path.join(DEST, 'NOTICE.txt'), texto, 'utf8');
}

(async function main() {
    if (process.platform !== 'win32') {
        falhar('este script empacota o instalador Windows do UB Mannheim; '
            + 'rode em Windows.');
    }
    const force = process.argv.includes('--force');
    if (!force && jaPronto()) {
        console.log('[build-tesseract] ja pronto, nada a fazer (use --force para refazer)');
        return;
    }

    console.log('[build-tesseract] baixando fontes oficiais...');
    fs.mkdirSync(CACHE, { recursive: true });
    const baixados = {};
    for (const fonte of FONTES) {
        baixados[fonte.nome] = await baixar(fonte);
    }

    console.log('[build-tesseract] extraindo o binario...');
    extrair(baixados[FONTES[0].nome], DEST);
    limpar(DEST);

    console.log('[build-tesseract] instalando idiomas (por + eng)...');
    const tessdata = path.join(DEST, 'tessdata');
    fs.mkdirSync(tessdata, { recursive: true });
    for (const nome of ['eng.traineddata', 'por.traineddata']) {
        fs.copyFileSync(baixados[nome], path.join(tessdata, nome));
    }

    console.log('[build-tesseract] verificando...');
    verificar();
    gravarNotice();

    const tamanho = spawnSync('cmd', ['/c', `dir /s /-c "${DEST}"`], { encoding: 'utf8' });
    console.log(`[build-tesseract] PRONTO em ${path.relative(RAIZ, DEST)}`);
    console.log(`[build-tesseract] fontes no cache: ${path.relative(RAIZ, CACHE)} `
        + '(nao vai para o repositorio)');
})();
