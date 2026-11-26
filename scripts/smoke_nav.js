/**
 * Smoke de navegacao via CDP: sobe o Electron, percorre as 5 paginas e
 * TODAS as features de cada modulo, capturando excecoes JS.
 * Uso: node smoke_nav.js   (rodar com cwd na raiz do repo)
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Store isolado a cada execução: exercita o caminho de primeira
// execução (semeação de atalhos) sem tocar no userData real.
const USER_DATA_DIR = path.join(os.tmpdir(), 'cremepe-smoke-userdata');
// Screenshots por página para inspeção visual
const SHOT_DIR = path.join(os.tmpdir(), 'cremepe-shots');

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (r) => {
            let d = '';
            r.on('data', (c) => (d += c));
            r.on('end', () => {
                try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function waitForHealth(timeoutMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        try {
            const r = await new Promise((resolve, reject) => {
                const req = http.get('http://127.0.0.1:5000/api/health', (res) => {
                    let d = '';
                    res.on('data', (c) => (d += c));
                    res.on('end', () => resolve(res.statusCode));
                });
                req.on('error', reject);
                req.setTimeout(2000, () => req.destroy(new Error('timeout')));
            });
            if (r === 200) return true;
        } catch (e) { /* ainda subindo */ }
        await sleep(1000);
    }
    return false;
}

function cleanup() {
    try { spawnSync('taskkill', ['/F', '/IM', 'electron.exe', '/T'], { stdio: 'ignore' }); } catch (e) { /* */ }
    try { spawnSync('taskkill', ['/F', '/IM', 'python.exe', '/T'], { stdio: 'ignore' }); } catch (e) { /* */ }
}

(async () => {
    const exceptions = [];
    const consoleErrors = [];
    // PDF mínimo (1 página) para provar a cadeia pdf.js sob CSP
    const MIN_PDF_B64 = 'JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgNiAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNCAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDYgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9BdXRob3IgKGFub255bW91cykgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MTExNjA5MzE0NC0wMycwMCcpIC9DcmVhdG9yIChhbm9ueW1vdXMpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MTExNjA5MzE0NC0wMycwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0ICh1bnNwZWNpZmllZCkgL1RpdGxlICh1bnNpdGxlZCkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Db3VudCAxIC9LaWRzIFsgMyAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMTAxCj4+CnN0cmVhbQpHYXBBLlltUSIoKGtwQU5WdGU4SC4iO2lhS3BpcUspaStyUyZFcyEpN0VfKlppR2RGXlkpcFQ1KXM1UClLZEVDRTlnZEAkTjlILFRUdXUiXGxcNC1eJCFoNG4tYzYmSV4oUFN+PmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDgKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDAwOTIgMDAwMDAgbiAKMDAwMDAwMDE5OSAwMDAwMCBuIAowMDAwMDAwNDAyIDAwMDAwIG4gCjAwMDAwMDA0NzAgMDAwMDAgbiAKMDAwMDAwMDczMSAwMDAwMCBuIAowMDAwMDAwNzkwIDAwMDAwIG4gCnRyYWlsZXIKPDwKL0lEIApbPDA1MjczZTIyYzY2Njk3ODBhMTk0MzRkYmJjNDliZTQ1PjwwNTI3M2UyMmM2NjY5NzgwYTE5NDM0ZGJiYzQ5YmU0NT5dCiUgUmVwb3J0TGFiIGdlbmVyYXRlZCBQREYgZG9jdW1lbnQgLS0gZGlnZXN0IChvcGVuc291cmNlKQoKL0luZm8gNSAwIFIKL1Jvb3QgNCAwIFIKL1NpemUgOAo+PgpzdGFydHhyZWYKOTgxCiUlRU9GCg==';
    let exitCode = 1;

    const env = { ...process.env };
    // Sem patch de PATH de propósito: o main.js precisa resolver o
    // python do venv sozinho (cenario real do `npm run dev`).
    try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (e) { /* */ }
    // PDF válido para o fluxo da feature "Validar PDF"
    const VALID_PDF = path.join(os.tmpdir(), 'cremepe-smoke-valid.pdf');
    fs.writeFileSync(VALID_PDF, Buffer.from(MIN_PDF_B64, 'base64'));
    const proc = spawn('node_modules\\.bin\\electron.cmd', [
        '--remote-debugging-port=9222',
        '--remote-allow-origins=*',
        `--user-data-dir=${USER_DATA_DIR}`,
        // A conversao de <i data-lucide> para <svg> roda dentro de
        // requestAnimationFrame (app.ts renderIcons). Com a janela
        // oculta/oculta por outras, o Chromium para o rAF (background
        // throttling) e os icones nunca aparecem — flakiness intermitente
        // do smoke. Estes switches mantem o renderer ativo.
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-timer-throttling',
        '.',
    ], {
        detached: false, stdio: 'ignore', env, shell: true,
    });

    try {
        if (!(await waitForHealth(30000))) {
            console.log('RESULTADO: FALHA - backend nao respondeu');
            return;
        }
        console.log('health: 200');

        // espera a pagina do renderer aparecer no CDP
        let target = null;
        let lastCdpErr = '';
        for (let i = 0; i < 30 && !target; i++) {
            await sleep(1000);
            try {
                const list = await getJson('http://127.0.0.1:9222/json/list');
                target = list.find((t) => t.type === 'page' && t.url.includes('index.html')) || list.find((t) => t.type === 'page');
                if (!target && list.length) lastCdpErr = 'sem target page: ' + list.map((t) => t.type + ':' + t.url).join(', ');
            } catch (e) { lastCdpErr = e.message; }
        }
        if (!target) {
            console.log('RESULTADO: FALHA - CDP nao respondeu (' + lastCdpErr + ')');
            return;
        }

        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((res, rej) => {
            ws.onopen = res;
            ws.onerror = () => rej(new Error('ws falhou'));
        });

        let msgId = 0;
        const pending = new Map();
        ws.onmessage = (ev) => {
            const m = JSON.parse(ev.data);
            if (m.id && pending.has(m.id)) {
                const { resolve, reject } = pending.get(m.id);
                pending.delete(m.id);
                if (m.error) reject(new Error(m.error.message));
                else resolve(m.result);
            } else if (m.method === 'Runtime.exceptionThrown') {
                const d = m.params.exceptionDetails;
                exceptions.push((d.exception && (d.exception.description || d.exception.value)) || d.text);
            } else if (m.method === 'Runtime.consoleAPICalled' &&
                       (m.params.type === 'error' || m.params.type === 'assert')) {
                const args = (m.params.args || [])
                    .map((a) => a.value ?? a.description ?? String(a.unserializableValue ?? ''))
                    .join(' ');
                consoleErrors.push(args);
            } else if (m.method === 'Log.entryAdded') {
                const e = m.params.entry;
                if (e.level === 'error') consoleErrors.push(`${e.source}: ${e.text}`);
            }
        };

        const send = (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++msgId;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });

        const evaluate = async (expression) => {
            const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (r.exceptionDetails) {
                throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
            }
            return r.result.value;
        };

        // Espera uma condicao ser verdadeira (renders/icones tem latencia
        // variavel; sleep fixo corre contra o rAF e falha intermitente).
        const waitFor = async (expression, timeoutMs = 5000, intervalMs = 100) => {
            const t0 = Date.now();
            for (;;) {
                if (await evaluate(expression)) return true;
                if (Date.now() - t0 >= timeoutMs) return false;
                await sleep(intervalMs);
            }
        };

        const shot = async (name) => {
            const r = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(r.data, 'base64'));
        };
        fs.mkdirSync(SHOT_DIR, { recursive: true });

        await send('Runtime.enable');
        await send('Log.enable');

        // aguarda o app montar a home
        for (let i = 0; i < 15; i++) {
            const ready = await evaluate("!!document.querySelector('#page-container .page')");
            if (ready) break;
            await sleep(500);
        }

        // Indicador de saúde do backend (classes CSS, não estilos inline)
        await sleep(1500);
        const healthState = await evaluate(`(() => ({
            dot: document.getElementById('status-dot').className,
            text: document.getElementById('status-text').textContent,
        }))()`);
        if (!healthState.dot.includes('online') || healthState.text !== 'Backend online') {
            exceptions.push(`health: dot="${healthState.dot}" text="${healthState.text}"`);
        } else {
            console.log('health: indicador "Backend online" OK');
        }

        // Nenhum recurso externo: assets locais (vendor) ou 127.0.0.1
        const external = await evaluate(`performance.getEntriesByType('resource')
            .map(e => e.name)
            .filter(u => /^https?:/.test(u) && !u.includes('127.0.0.1') && !u.includes('localhost'))`);
        if (external.length > 0) {
            exceptions.push(`recursos externos: ${external.slice(0, 3).join(', ')}`);
        } else {
            console.log('vendor: 0 recursos externos (tudo local) OK');
        }

        // pdf.js sob CSP: getDocument real (script + worker locais)
        try {
            const pdfCheck = await evaluate(`(async () => {
                const b64 = '${MIN_PDF_B64}';
                const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
                const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
                const pages = doc.numPages;
                await doc.destroy();
                return { pages, worker: pdfjsLib.GlobalWorkerOptions.workerSrc };
            })()`);
            if (pdfCheck.pages !== 1 || pdfCheck.worker !== 'vendor/pdf.worker.min.js') {
                exceptions.push(`pdf.js: pages=${pdfCheck.pages} worker=${pdfCheck.worker}`);
            } else {
                console.log('pdf.js: getDocument 1 pagina via worker local OK');
            }
        } catch (e) {
            exceptions.push('pdf.js getDocument falhou: ' + e.message);
        }

        const pages = ['home', 'files', 'pdf', 'word', 'excel'];
        let featuresVisited = 0;

        for (const page of pages) {
            await evaluate(`window.navigateTo('${page}')`);
            await sleep(400);
            if (page !== 'home') {
                await shot(`${page}.png`);
            }
            const featureIds = await evaluate(
                "Array.from(document.querySelectorAll('.feature-list li')).map(li => li.dataset.feature)"
            );
            for (const fid of featureIds) {
                await evaluate(`window.navigateTo('${page}', '${fid}')`);
                await sleep(300);
                const mounted = await evaluate(
                    "!!document.querySelector('#feature-content .page, #feature-content form, #feature-content .card, #feature-content h3, #feature-content h4, #feature-content label, #feature-content button, #feature-content div')"
                );
                if (!mounted) {
                    exceptions.push(`feature vazia: ${page}/${fid}`);
                }
                featuresVisited++;
            }
            console.log(`pagina ${page}: ${featureIds.length} features OK`);
        }

        // Home: catálogo de atalhos (edit mode) deve ter35 opções
        await evaluate("window.navigateTo('home')");
        await sleep(500);

        // Primeira execução (store zerado): atalhos padrão semeados
        const seededCards = await evaluate("document.querySelectorAll('.quick-card').length");
        if (seededCards !== 8) {
            exceptions.push(`home: ${seededCards} cards semeados (esperado 8)`);
        } else {
            console.log('home: 8 atalhos padrao semeados OK');
        }
        await shot('home.png');

        await evaluate("document.getElementById('toggle-edit-mode').click()");
        await waitFor("document.querySelectorAll('.feature-checkbox').length === 35");
        const checkboxCount = await evaluate("document.querySelectorAll('.feature-checkbox').length");
        if (checkboxCount !== 35) {
            exceptions.push(`home: ${checkboxCount} checkboxes (esperado 35)`);
        } else {
            console.log('home: 35 checkboxes de atalho OK');
        }
        await shot('home-edit.png');

        // Store legado (icones bi-* de versoes antigas): getCards deve
        // re-sincronizar com o catálogo atual e descartar ids obsoletos.
        await evaluate(`window.electronAPI.storeSet('quickAccessCards', [
            { id: 'collect', icon: 'bi-folder2-open', title: 'Antigo', desc: '', section: 'Arquivos', page: 'files', feature: 'collect' },
            { id: 'pdf-merge', icon: 'bi-file-earmark-pdf', title: 'Antigo2', desc: '', section: 'PDF', page: 'pdf', feature: 'merge' },
            { id: 'removido', icon: 'bi-x', title: 'Fantasma', desc: '', section: 'PDF', page: 'pdf', feature: 'nao-existe' },
        ])`);
        await evaluate("window.navigateTo('home')");
        // captureScreenshot FORCA um frame — flush do rAF pendente do
        // renderIcons() (janela oculta nao produz frames sozinha).
        await shot('home-legacy.png');
        // Espera o rAF do renderIcons() converter todos os <i> antes de
        // inspecionar — sleep fixo perdia a corrida intermitentemente.
        await waitFor("document.querySelectorAll('i[data-lucide]').length === 0");
        const legacy = await evaluate(`(() => ({
            cards: document.querySelectorAll('.quick-card').length,
            iconsConverted: document.querySelectorAll('.card-icon svg.lucide').length,
            leftover: document.querySelectorAll('i[data-lucide]').length,
        }))()`);
        if (legacy.cards !== 2 || legacy.iconsConverted !== 2 || legacy.leftover !== 0) {
            exceptions.push(`store legado: ${JSON.stringify(legacy)} (esperado cards=2 icons=2 leftover=0)`);
        } else {
            console.log('store legado: re-sincronizado (2 cards, icones lucide, id obsoleto removido) OK');
        }

        // 1º clique em botão com ÍCONE (alvo = svg do Lucide, não o botão)
        await evaluate("window.navigateTo('home')");
        await shot('home-toggle.png');  // frame forcado -> rAF do Lucide
        const toggleIcon = await waitFor("!!document.querySelector('#toggle-edit-mode svg')");
        if (!toggleIcon) {
            exceptions.push('toggle-edit-mode: svg do Lucide nao apareceu em 5s');
        } else {
            await evaluate(`(() => {
                const svg = document.querySelector('#toggle-edit-mode svg');
                svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            })()`);
            const editToggled = await waitFor(
                "document.getElementById('edit-area')?.style.display === 'block'"
            );
            if (!editToggled) {
                exceptions.push('toggle-edit-mode: clique no icone nao alternou a edicao');
            } else {
                console.log('icone: toggle-edit-mode responde no 1o clique OK');
            }
        }

        // X de remover origem (Coletar Arquivos):1 add ->2 rows -> clique no svg
        await evaluate("window.navigateTo('files', 'collect')");
        await sleep(500);
        await evaluate("document.getElementById('add-src-dir').click()");
        await waitFor("document.querySelectorAll('#src-dirs-container .input-group').length === 2");
        await shot('collect-src.png');  // frame forcado -> rAF do Lucide
        const rowsBefore = await evaluate(
            "document.querySelectorAll('#src-dirs-container .input-group').length"
        );
        const removeIcon = await waitFor("!!document.querySelector('.btn-src-remove svg')");
        if (!removeIcon) {
            exceptions.push('btn-src-remove: svg do Lucide nao apareceu em 5s');
        } else {
            await evaluate(`(() => {
                const svg = document.querySelector('.btn-src-remove svg');
                svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            })()`);
            await waitFor(
                "document.querySelectorAll('#src-dirs-container .input-group').length === 1"
            );
            const rowsAfter = await evaluate(
                "document.querySelectorAll('#src-dirs-container .input-group').length"
            );
            if (rowsBefore !== 2 || rowsAfter !== 1) {
                exceptions.push(`btn-src-remove: ${rowsBefore} -> ${rowsAfter} linhas (esperado 2 -> 1 no 1o clique)`);
            } else {
                console.log('icone: X de remover origem remove no 1o clique OK');
            }
        }

        // Busca no menu: "numerar" deve isolar 1 das 12 features do PDF
        await evaluate("window.navigateTo('pdf')");
        await sleep(400);
        await evaluate(`(() => {
            const i = document.getElementById('feature-search');
            i.value = 'numerar';
            i.dispatchEvent(new Event('input', { bubbles: true }));
        })()`);
        await sleep(200);
        const searchState = await evaluate(`(() => {
            const lis = Array.from(document.querySelectorAll('.feature-list li'));
            return { total: lis.length, visible: lis.filter(li => !li.hidden).length };
        })()`);
        if (searchState.total !== 14 || searchState.visible !== 1) {
            exceptions.push(`busca: ${searchState.visible}/${searchState.total} visiveis (esperado 1/14)`);
        } else {
            console.log('busca: filtro "numerar" isola 1/14 OK');
        }

        // Fluxo completo da feature "Validar PDF": digitar caminho,
        // clicar, esperar o resultado do job e conferir o banner
        await evaluate("window.navigateTo('pdf', 'validate')");
        await sleep(500);
        await evaluate(`document.getElementById('validate-input').value = ${JSON.stringify(VALID_PDF)}`);
        await evaluate("document.getElementById('btn-validate').click()");
        let validateOk = false;
        for (let vi = 0; vi < 25; vi++) {
            await sleep(400);
            validateOk = await evaluate(
                "document.getElementById('validate-result').style.display === 'block'"
            );
            if (validateOk) break;
        }
        if (!validateOk) {
            exceptions.push('validate: painel de resultado nao apareceu');
        } else {
            const banner = await evaluate(
                "document.getElementById('validate-banner').textContent.trim()"
            );
            if (!/ntegro/.test(banner)) {
                exceptions.push('validate: banner inesperado: ' + banner);
            } else {
                console.log(`validate: fluxo completo OK ("${banner}")`);
            }
            await shot('feature-validate.png');
        }

        console.log(`features percorridas: ${featuresVisited}`);

        // Sonda de enforcement: um script inline INJETADO deve ser
        // bloqueado (senão o meta CSP está inoperante). A violação
        // esperada é filtrada na allowlist abaixo.
        const cspProbe = await evaluate(`(() => {
            const s = document.createElement('script');
            s.textContent = 'window.__cspProbe = 1;';
            document.head.appendChild(s);
            return {
                ran: window.__cspProbe === 1,
                meta: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
            };
        })()`);
        if (cspProbe.ran || !cspProbe.meta) {
            exceptions.push(`csp: meta=${cspProbe.meta} inlineExecutou=${cspProbe.ran}`);
        } else {
            console.log('csp: ativo — script inline injetado bloqueado OK');
        }

        // Erros de console (CSP, rede, runtime) viram falha —
        // allowlist só para ruído conhecido e inócuo.
        const CONSOLE_ALLOW = [
            /Security Warning/i,
            /favicon/i,
            /Executing inline script violates/i, // sonda de enforcement acima
        ];
        [...new Set(consoleErrors)]
            .filter((t) => !CONSOLE_ALLOW.some((re) => re.test(t)))
            .forEach((t) => exceptions.push('console: ' + t));

        if (exceptions.length === 0) {
            console.log('RESULTADO: SMOKE OK (0 excecoes)');
            exitCode = 0;
        } else {
            console.log(`RESULTADO: FALHA - ${exceptions.length} excecoes:`);
            [...new Set(exceptions)].slice(0, 15).forEach((e) => console.log('  - ' + String(e).split('\n')[0]));
            exitCode = 1;
        }
        ws.close();
    } catch (e) {
        console.log('RESULTADO: FALHA - ' + e.message);
        exitCode = 1;
    } finally {
        cleanup();
        try { proc.kill(); } catch (e) { /* */ }
        process.exit(exitCode);
    }
})();
