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
            const t = setTimeout(() => rej(new Error('ws nao abriu em 10s')), 10000);
            ws.onopen = () => { clearTimeout(t); res(); };
            ws.onerror = () => { clearTimeout(t); rej(new Error('ws falhou')); };
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

        // Sem isto, uma WS que fecha no meio do teste deixa todo
        // send() pendurado para SEMPRE (o smoke trava sem saida e o
        // gate vira ruim). Rejeita o que estiver em aberto.
        ws.onclose = () => {
            for (const { reject } of pending.values()) {
                reject(new Error('ws do CDP fechou durante o teste'));
            }
            pending.clear();
        };

        const send = (method, params = {}, timeoutMs = 30000) => new Promise((resolve, reject) => {
            const id = ++msgId;
            const timer = setTimeout(() => {
                if (pending.delete(id)) reject(new Error(`timeout de ${timeoutMs / 1000}s em ${method}`));
            }, timeoutMs);
            pending.set(id, {
                resolve: (v) => { clearTimeout(timer); resolve(v); },
                reject: (e) => { clearTimeout(timer); reject(e); },
            });
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

        // Home: cards de atalhos — o catálogo de checkboxes foi
        // removido; a favoritação agora é pela estrela da lista do domínio.
        await evaluate("window.navigateTo('home')");
        await sleep(500);

        // Primeira execução (store zerado): atalhos padrão semeados
        const seededCards = await evaluate("document.querySelectorAll('.quick-card').length");
        if (seededCards !== 8) {
            exceptions.push(`home: ${seededCards} cards semeados (esperado 8)`);
        } else {
            console.log('home: 8 atalhos padrao semeados OK');
        }
        // Nota: com a janela oculta, o captureScreenshot pode devolver o
        // ÚLTIMO frame que a janela compôs — observado: screenshots da
        // home mostravam o estado FINAL da execução (dom com outro nº de
        // cards). O DOM é a fonte de verdade; os asserts abaixo leem o
        // DOM, não os pixels. home-edit.png/home-catalog.png saem
        // corretos porque um click anterior forçou a composição.
        await shot('home.png');

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

        // ===== Catálogo removido =====
        // O "Adicionar atalhos" com checkboxes sumiu; agora se favorita
        // pela estrela da lista de cada domínio.
        const semCatalogo = await evaluate(`(() => ({
            editArea: !!document.getElementById('edit-area'),
            toggle: !!document.getElementById('toggle-edit-mode'),
            checkboxes: document.querySelectorAll('.feature-checkbox').length,
            busca: !!document.getElementById('catalog-search'),
        }))()`);
        if (semCatalogo.editArea || semCatalogo.toggle || semCatalogo.checkboxes || semCatalogo.busca) {
            exceptions.push(`home: catalogo ainda presente ${JSON.stringify(semCatalogo)}`);
        } else {
            console.log('home: catalogo de checkboxes removido OK');
        }

        // cards após o teste de store legado (base dos asserts seguintes)
        const cardsBase = await evaluate("document.querySelectorAll('.quick-card').length");

        // ===== Favoritar pela estrela da lista do domínio =====
        await evaluate("window.navigateTo('pdf')");
        await waitFor("document.querySelectorAll('.feature-star').length === 14");
        await sleep(400); // preenchimento das estrelas é assíncrono (storeGet)
        const lista = await evaluate(`(() => ({
            li: document.querySelectorAll('.feature-list li').length,
            estrelas: document.querySelectorAll('.feature-star').length,
            marcadas: document.querySelectorAll('.feature-star.starred').length,
            semBusca: !document.getElementById('feature-search'),
        }))()`);
        // marcadas=1 porque o teste de store legado gravou pdf-merge
        if (lista.li !== 14 || lista.estrelas !== 14 || lista.marcadas !== 1 || !lista.semBusca) {
            exceptions.push(`pdf: li=${lista.li} estrelas=${lista.estrelas} marcadas=${lista.marcadas} busca=${!lista.semBusca} (esperado 14/14/1/sem busca)`);
        } else {
            console.log('pdf: 14 estrelas na lista,1 favoritada OK');
        }
        await shot('pdf-estrelas.png');

        // (1) clicar numa estrela desfavoritada: marca e NÃO navega
        const clicado = await evaluate(`(() => {
            const b = Array.from(document.querySelectorAll('.feature-star'))
                .find(x => !x.classList.contains('starred'));
            if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return b ? b.dataset.feature : null;
        })()`);
        if (!clicado) {
            exceptions.push('estrela: nenhuma estrela desfavoritada para clicar');
        } else {
            const marcou = await waitFor(
                `document.querySelectorAll('.feature-star.starred').length === ${lista.marcadas + 1}`);
            if (!marcou) {
                const n = await evaluate("document.querySelectorAll('.feature-star.starred').length");
                exceptions.push(`estrela: ${n} marcadas (esperado ${lista.marcadas + 1})`);
            } else {
                console.log('estrela: clicar favorita na lista do dominio OK');
            }
        }
        if (!(await evaluate("!!document.querySelector('.module-pdf')"))) {
            exceptions.push('estrela: clicar na estrela navegou para fora do PDF');
        }

        // (2) o card aparece na Home
        await evaluate("window.navigateTo('home')");
        await sleep(500);
        const cardsHome = await evaluate("document.querySelectorAll('.quick-card').length");
        if (cardsHome !== cardsBase + 1) {
            exceptions.push(`home: ${cardsHome} cards apos favoritar (esperado ${cardsBase + 1})`);
        } else {
            console.log('home: card aparece apos favoritar pela estrela OK');
        }

        // (3) estrela DO CARD RECIÉM-FAVORITADO remove em1 clique —
        //     precisa mirar nele: o primeiro .star-btn da grade é outro
        //     card (os favoritos são antigos) e o teste falharia alvo
        //     errado.
        const removeuClicado = await evaluate(`(() => {
            const card = Array.from(document.querySelectorAll('.quick-card .card'))
                .find(c => c.dataset.feature === ${JSON.stringify(clicado)});
            const s = card && card.querySelector('.star-btn');
            if (s) s.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return !!s;
        })()`);
        if (!removeuClicado) {
            exceptions.push(`estrela: card de "${clicado}" nao encontrado na home`);
        }
        const removeu = await waitFor(`document.querySelectorAll('.quick-card').length === ${cardsBase}`);
        if (!removeu) {
            const n = await evaluate("document.querySelectorAll('.quick-card').length");
            exceptions.push(`home: estrela do card -> ${n} (esperado ${cardsBase})`);
        } else {
            console.log('home: estrela do card remove favorito em 1 clique OK');
        }

        // (4) a lista do domínio reflete o desfavoritado (sincronismo)
        await evaluate("window.navigateTo('pdf')");
        await waitFor(`document.querySelectorAll('.feature-star.starred').length === ${lista.marcadas}`);
        const resync = await evaluate("document.querySelectorAll('.feature-star.starred').length");
        if (resync !== lista.marcadas) {
            exceptions.push(`estrela: ${resync} marcadas apos remover da home (esperado ${lista.marcadas})`);
        } else {
            console.log('estrela: lista do dominio sincroniza com a home OK');
        }

        // (5) contagem e chips de categoria REMOVIDOS do Acesso Rápido
        await evaluate("window.navigateTo('home')");
        await sleep(400);
        const semContagem = await evaluate(`(() => ({
            count: !!document.getElementById('favorites-count'),
            chips: document.querySelectorAll('.domain-chip').length,
            titulo: (document.querySelector('#page-container h2')?.textContent || '').trim(),
        }))()`);
        if (semContagem.count || semContagem.chips > 0 || semContagem.titulo !== 'Acesso Rápido') {
            exceptions.push(`home: contagem/chips/titulo inesperados ${JSON.stringify(semContagem)}`);
        } else {
            console.log('home: Acesso Rápido sem contagem e sem chips de categoria OK');
        }
        await shot('home-catalog.png');

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

        // Busca local do menu de domínios REMOVIDA — só a global
        // permanece: o PDF lista as14 features, todas visíveis, e o
        // input #feature-search não existe mais.
        await evaluate("window.navigateTo('pdf')");
        await sleep(400);
        const menu = await evaluate(`(() => {
            const lis = Array.from(document.querySelectorAll('.feature-list li'));
            return {
                temInput: !!document.getElementById('feature-search'),
                total: lis.length,
                ocultos: lis.filter(li => li.hidden).length,
            };
        })()`);
        if (menu.temInput || menu.total !== 14 || menu.ocultos !== 0) {
            exceptions.push(`busca-local: presente=${menu.temInput} (esperado false), ${menu.ocultos}/${menu.total} ocultos (esperado 0/14)`);
        } else {
            console.log('busca-local: removida, menu do PDF com 14 OK');
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

        // Barra de resultado: compress gera output_path e a barra
        // global deve oferecer abrir/copiar (antes o caminho so ia
        // para o log).
        const OUT_PDF = path.join(os.tmpdir(), 'cremepe-smoke-comprimido.pdf');
        try { fs.unlinkSync(OUT_PDF); } catch (e) { /* */ }
        await evaluate("window.navigateTo('pdf', 'compress')");
        await sleep(500);
        await evaluate(`document.getElementById('compress-input').value = ${JSON.stringify(VALID_PDF)}`);
        await evaluate(`document.getElementById('compress-output').value = ${JSON.stringify(OUT_PDF)}`);
        await evaluate("document.getElementById('btn-compress').click()");
        let barOk = false;
        for (let bi = 0; bi < 30; bi++) {
            await sleep(400);
            barOk = await evaluate(
                "document.getElementById('result-bar')?.style.display === 'block'"
            );
            if (barOk) break;
        }
        if (!barOk) {
            exceptions.push('result-bar: nao apareceu apos compress');
        } else {
            const caminho = await evaluate(
                "document.getElementById('result-path')?.textContent?.trim() || ''"
            );
            if (!caminho.toLowerCase().endsWith('.pdf')) {
                exceptions.push(`result-bar: caminho invalido (${caminho})`);
            } else {
                console.log(`result-bar: arquivo gerado exposto OK (${caminho.split(/[\\\\/]/).pop()})`);
            }

            // Copiar caminho: feedback "Copiado" (clipboard via IPC)
            await evaluate("document.getElementById('result-copy').click()");
            await sleep(400);
            const copiado = await evaluate(
                "(document.getElementById('result-copy')?.textContent || '').includes('Copiado')"
            );
            if (!copiado) {
                exceptions.push('result-bar: Copiar nao deu feedback');
            } else {
                console.log('result-bar: copiar caminho da feedback OK');
            }
            await shot('result-bar.png');

            // Fechar esconde; navegar de tela tambem
            await evaluate("document.getElementById('result-close').click()");
            await sleep(200);
            const fechou = await evaluate(
                "document.getElementById('result-bar').style.display === 'none'"
            );
            if (!fechou) {
                exceptions.push('result-bar: fechar nao escondeu');
            } else {
                console.log('result-bar: fechar OK');
            }
        }

        // Busca global (sidebar / Ctrl+K): o termo filtra o catalogo
        // completo e Enter navega para o1o resultado; a feature aberta
        // vira chip de "Recentes" na home.
        await evaluate("window.navigateTo('home')");
        await sleep(500);
        await evaluate(`(() => {
            const i = document.getElementById('global-search');
            i.value = 'numerar';
            i.dispatchEvent(new Event('input', { bubbles: true }));
        })()`);
        await sleep(300);
        const gs = await evaluate(`(() => {
            const box = document.getElementById('global-search-results');
            const itens = box ? box.querySelectorAll('.gs-item') : [];
            return {
                aberto: !!box && !box.hidden,
                n: itens.length,
                titulo: itens[0]?.querySelector('.gs-title')?.textContent?.trim() || '',
            };
        })()`);
        if (!gs.aberto || gs.n < 1) {
            exceptions.push(`busca-global: dropdown nao abriu (aberto=${gs.aberto}, n=${gs.n})`);
        } else {
            console.log(`busca-global: "numerar" -> ${gs.n} resultado(s) ("${gs.titulo}")`);
        }

        // Enter navega para o1o resultado (Numerar Paginas / PDF)
        await evaluate(`(() => {
            const i = document.getElementById('global-search');
            i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        })()`);
        await sleep(700);
        const aposBusca = await evaluate(`(() => {
            const naPagina = !!document.querySelector('.module-pdf');
            const ativo = document.querySelector('.feature-list li.active')?.dataset?.feature || '';
            const inputVazio = (document.getElementById('global-search')?.value || '') === '';
            return { naPagina, ativo, inputVazio };
        })()`);
        if (!aposBusca.naPagina || aposBusca.ativo !== 'add-page-numbers' || !aposBusca.inputVazio) {
            exceptions.push(`busca-global: Enter nao navegou (pagina=${aposBusca.naPagina}, feature=${aposBusca.ativo}, inputVazio=${aposBusca.inputVazio})`);
        } else {
            console.log('busca-global: Enter navega e limpa o campo OK');
        }

        // Recent chip: ao voltar para a home, a feature aberta aparece
        await evaluate("window.navigateTo('home')");
        await sleep(900);
        const recentes = await evaluate(`(() => {
            const chips = document.querySelectorAll('#recent-chips .recent-chip');
            const primeiro = chips[0]?.querySelector('span')?.textContent?.trim() || '';
            return { n: chips.length, primeiro };
        })()`);
        if (recentes.n < 1) {
            exceptions.push('recentes: nenhum chip apos abrir uma feature');
        } else {
            console.log(`recentes: ${recentes.n} chip(s), primeiro "${recentes.primeiro}" OK`);
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
