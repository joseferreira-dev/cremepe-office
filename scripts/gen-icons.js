// Rasteriza os SVGs de frontend/assets para PNG/ICO — usa o PROPRIO
// Electron para renderizar, porque o repo nao tem ImageMagick nem
// Inkscape.
//
//   node_modules\.bin\electron.cmd scripts\gen-icons.js
//
// Saida:
//   frontend/assets/icon.png  512x512  janela do app (main.ts)
//   frontend/assets/icon.ico 256..16  instalador (package.json)
//   frontend/assets/logo.png         wordmark
//
// O .ico usa entradas PNG (formato suportado desde o Windows Vista) —
// nao ha BMP crua porque ela exigiria decodificar o PNG para BGRA.
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'frontend', 'assets');

// viewBox dos SVGs: icon512x512, logo756.58x233
const ALVOS = [
    { svg: 'icon.svg', png: 'icon.png', w: 512, h: 512 },
    { svg: 'logo.svg', png: 'logo.png', w: 756, h: 233 },
];

const TAMANHOS_ICO = [256, 128, 64, 48, 32, 16];

/** Monta um .ico a partir de PNGs (entradas PNG,4bpp32). */
function montarIco(pngs) {
    const cabecalho = Buffer.alloc(6);
    cabecalho.writeUInt16LE(0, 0);          // reserved
    cabecalho.writeUInt16LE(1, 2);          // type: icon
    cabecalho.writeUInt16LE(pngs.length, 4);

    let deslocamento = 6 + pngs.length * 16;
    const entradas = [];
    for (const { tam, buf } of pngs) {
        const e = Buffer.alloc(16);
        e.writeUInt8(tam >= 256 ? 0 : tam, 0);   // largura (0 = 256)
        e.writeUInt8(tam >= 256 ? 0 : tam, 1);   // altura
        e.writeUInt8(0, 2);                       // cores
        e.writeUInt8(0, 3);                       // reserved
        e.writeUInt16LE(1, 4);                    // planes
        e.writeUInt16LE(32, 6);                   // bits por pixel
        e.writeUInt32LE(buf.length, 8);           // tamanho
        e.writeUInt32LE(deslocamento, 12);        // deslocamento
        deslocamento += buf.length;
        entradas.push(e);
    }
    return Buffer.concat([cabecalho, ...entradas, ...pngs.map((p) => p.buf)]);
}

/** Renderiza o SVG numa janela oculta e devolve o NativeImage. */
async function rasterizar(svgPath, w, h) {
    const svg = fs.readFileSync(svgPath, 'utf8');
    const html = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}
svg{display:block;width:${w}px;height:${h}px}</style></head>
<body>${svg}</body></html>`;

    const win = new BrowserWindow({
        width: w,
        height: h,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: { backgroundThrottling: false },
    });

    try {
        await new Promise((res, rej) => {
            win.webContents.once('did-finish-load', res);
            win.webContents.once('did-fail-load', (_e, code, desc) =>
                rej(new Error(`falha ao carregar ${svgPath}: ${code} ${desc}`)));
            win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        });
        // deixa o compositor produzir pelo menos um frame
        await new Promise((r) => setTimeout(r, 400));
        return await win.webContents.capturePage();
    } finally {
        win.destroy();
    }
}

/** Confere que o canto superior esquerdo esta transparente (fora do
 *  retângulo arredondado) — um fundo branco ficaria feio na barra de
 *  tarefas. */
function cantoTransparente(img) {
    const bmp = img.toBitmap();          //4 bytes por pixel
    if (bmp.length < 4) return false;
    return bmp[3] === 0;                 // alpha do pixel (0,0)
}

(async () => {
    await app.whenReady();

    // Sem isso o Electron SAÍ quando a primeira janela do rasterizador
    // é destruída (comportamento padrão no Windows) e só o primeiro
    // alvo é gerado.
    app.on('window-all-closed', () => { /* mantém vivo até o fim */ });

    const falhas = [];

    //1) PNGs
    for (const alvo of ALVOS) {
        const svg = path.join(ASSETS, alvo.svg);
        const png = path.join(ASSETS, alvo.png);
        const img = await rasterizar(svg, alvo.w, alvo.h);
        const buf = img.toPNG();
        fs.writeFileSync(png, buf);
        const ok = buf.length > 3000;
        console.log(`[gen-icons] ${alvo.png}: ${buf.length} bytes ${ok ? 'OK' : 'SUSPEITO (muito pequeno)'}`);
        if (!ok) falhas.push(`${alvo.png} muito pequeno (renderizacao em branco?)`);
        if (alvo.svg === 'icon.svg' && !cantoTransparente(img)) {
            falhas.push('icon.png: canto nao esta transparente (fundo branco)');
        }
    }

    //2) ICO multi-tamanho a partir do icon.png
    const base = nativeImage.createFromPath(path.join(ASSETS, 'icon.png'));
    if (base.isEmpty()) {
        falhas.push('icon.png nao abriu para gerar o .ico');
    } else {
        const pngs = TAMANHOS_ICO.map((tam) => ({
            tam,
            buf: base.resize({ width: tam, height: tam }).toPNG(),
        }));
        const ico = montarIco(pngs);
        fs.writeFileSync(path.join(ASSETS, 'icon.ico'), ico);
        console.log(`[gen-icons] icon.ico: ${ico.length} bytes, ${pngs.length} tamanhos (${TAMANHOS_ICO.join('/')})`);
        if (ico.readUInt16LE(4) !== pngs.length) falhas.push('icon.ico: cabecalho invalido');
    }

    app.exit(falhas.length ? 1 : 0);
    if (falhas.length) falhas.forEach((f) => console.error(`[gen-icons] ERRO: ${f}`));
})();
