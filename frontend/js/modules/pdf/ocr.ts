import { API } from '../../api.js';
import { Feature, escapeHtml } from '../feature.js';

/**
 * OCR de PDF (item10): extrai texto de páginas digitalizadas e gera
 * cópias pesquisáveis (camada de texto invisível).
 *
 * O backend roda OS DOIS motores (PyMuPDF e pytesseract) por página e
 * fica com o de maior cobertura de texto plausível — por isso a UI
 * mostra os scores e o motor vencedor.
 */
export class PDFOcrFeature extends Feature {
    constructor() {
        super('ocr');
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">OCR de PDF</h4>
                <p class="text-zinc-500">Reconhece texto em PDFs digitalizados (imagens).
                    Extraia o texto ou gere uma cópia pesquisável — a imagem permanece
                    intacta e o texto fica invisível, mas selecionável e buscável.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="ocr-input" class="form-control" placeholder="Selecione o PDF digitalizado...">
                        <button class="btn btn-outline-secondary" id="btn-ocr-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Opções</h5>
                    <div class="grid grid-cols-12 gap-3">
                        <div class="col-span-4">
                            <label class="form-label text-sm text-zinc-600">Idioma</label>
                            <select id="ocr-idioma" class="form-select">
                                <option value="por+eng" selected>Português + Inglês</option>
                                <option value="por">Português</option>
                                <option value="eng">Inglês</option>
                            </select>
                        </div>
                        <div class="col-span-4">
                            <label class="form-label text-sm text-zinc-600">Resolução (DPI)</label>
                            <select id="ocr-dpi" class="form-select">
                                <option value="300" selected>300 (recomendado)</option>
                                <option value="200">200 (mais rápido)</option>
                                <option value="400">400 (mais preciso)</option>
                            </select>
                        </div>
                        <div class="col-span-4">
                            <label class="form-label text-sm text-zinc-600">Páginas</label>
                            <input type="text" id="ocr-paginas" class="form-control"
                                   placeholder="Todas (ex: 1-3,5)">
                        </div>
                    </div>
                    <small class="text-zinc-500">O reconhecimento roda os dois motores
                        (PyMuPDF e Tesseract) e usa o melhor resultado de cada página.</small>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Saída do PDF pesquisável</h5>
                    <div class="input-group">
                        <input type="text" id="ocr-output" class="form-control"
                               placeholder="Caminho do PDF com camada de texto">
                        <button class="btn btn-outline-secondary" id="btn-ocr-output">Selecionar</button>
                    </div>
                    <small class="text-zinc-500">Só é usado em "Gerar PDF pesquisável";
                        o original nunca é alterado.</small>
                </div>
            </div>

            <div class="flex gap-2">
                <button class="btn btn-success" id="btn-ocr-extrair">
                    <i data-lucide="scan-text" class="me-1"></i>Extrair Texto
                </button>
                <button class="btn btn-outline-success" id="btn-ocr-pesquisavel">
                    <i data-lucide="file-search" class="me-1"></i>Gerar PDF Pesquisável
                </button>
            </div>

            ${this.progressHTML()}

            <div id="ocr-result" style="display:none;" class="mt-4">
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title section-title" id="ocr-result-title">Resultado</h5>
                        <div id="ocr-stats" class="mb-3 flex flex-wrap gap-2"></div>
                        <pre id="ocr-texto"
                             class="text-sm bg-zinc-50 border border-zinc-200 rounded p-2"
                             style="max-height:340px; overflow:auto; white-space:pre-wrap;"></pre>
                    </div>
                </div>
            </div>

            ${this.logHTML()}
        `;

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-ocr-input')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        (document.getElementById('ocr-input') as DomElement).value =
                            result.filePaths[0];
                        this.suggestOutput();
                    }
                });
            }
        });

        document.getElementById('btn-ocr-output')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        (document.getElementById('ocr-output') as DomElement).value =
                            result.filePath;
                    }
                });
            }
        });

        document.getElementById('ocr-input')!
            .addEventListener('change', () => this.suggestOutput());
        document.getElementById('btn-ocr-extrair')!
            .addEventListener('click', () => this.extrairTexto());
        document.getElementById('btn-ocr-pesquisavel')!
            .addEventListener('click', () => this.gerarPesquisavel());
    }

    suggestOutput() {
        const input = (document.getElementById('ocr-input') as DomElement).value.trim();
        const output = document.getElementById('ocr-output')!;
        if (input && !(output as DomElement).value) {
            const base = input.replace(/\.[^.]+$/, '');
            (output as DomElement).value = `${base}_pesquisavel.pdf`;
        }
    }

    /** Lê as opções comuns (idioma/dpi/páginas) dos campos da tela. */
    private opcoes(): { language: string; dpi: number; pages?: number[] } {
        const language =
            (document.getElementById('ocr-idioma') as DomElement).value || 'por+eng';
        const dpi = parseInt((document.getElementById('ocr-dpi') as DomElement).value)
            || 300;
        const bruto =
            (document.getElementById('ocr-paginas') as DomElement).value.trim();
        const pages = bruto ? this.parsePaginas(bruto) : undefined;
        return { language, dpi, pages };
    }

    /** "1-3,5" -> [1,2,3,5] (mesmo formato das demais features). */
    private parsePaginas(bruto: string): number[] {
        const nums: number[] = [];
        for (const parte of bruto.split(',')) {
            const p = parte.trim();
            if (!p) continue;
            if (p.includes('-')) {
                const [a, b] = p.split('-');
                const ini = parseInt(a), fim = parseInt(b);
                if (!ini || !fim) continue;
                for (let n = ini; n <= fim; n++) nums.push(n);
            } else {
                const n = parseInt(p);
                if (n) nums.push(n);
            }
        }
        return nums;
    }

    private async comJob(btn: HTMLElement, rotina: () => Promise<void>) {
        (btn as DomElement).disabled = true;
        this.clearLog();
        try {
            await rotina();
            // completa a barra no sucesso (as demais features chamam
            // setProgress(100) — sem isso a barra ficava em0%)
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }

    async extrairTexto() {
        const input = (document.getElementById('ocr-input') as DomElement).value.trim();
        if (!input) {
            this.log('Selecione o PDF que deseja reconhecer.');
            return;
        }
        const btn = document.getElementById('btn-ocr-extrair')!;
        await this.comJob(btn, async () => {
            this.log('Reconhecendo texto (dois motores por página)...');
            this.log('Em arquivos grandes isso pode levar minutos.');

            const r = await API.pdf.ocrText({
                pdf_path: input,
                ...this.opcoes(),
            });

            const motores = Object.entries(r.motores || {})
                .filter(([, v]) => (v as number) > 0)
                .map(([k, v]) => `${k}: ${v}`);
            this.log(`Concluído: ${r.pages} página(s), ${r.chars} caractere(s).`);
            this.log(`Motores usados — ${motores.join(', ')}.`);
            this.log(`Salvo em: ${r.pdf_path}`);

            this.mostrarResultado('Texto extraído', r, r.texto);
        });
    }

    async gerarPesquisavel() {
        const input = (document.getElementById('ocr-input') as DomElement).value.trim();
        const output =
            (document.getElementById('ocr-output') as DomElement).value.trim();
        if (!input || !output) {
            this.log('Selecione o PDF de entrada e o de saída.');
            return;
        }
        if (input === output) {
            this.log('A saída deve ser diferente do original (ele nunca é alterado).');
            return;
        }

        const btn = document.getElementById('btn-ocr-pesquisavel')!;
        await this.comJob(btn, async () => {
            this.log('Gerando PDF pesquisável...');
            this.log('A imagem permanece intacta; o texto fica invisível e buscável.');

            const r = await API.pdf.ocrSearchable({
                input_path: input,
                output_path: output,
                ...this.opcoes(),
            });

            const motores = Object.entries(r.motores || {})
                .filter(([, v]) => (v as number) > 0)
                .map(([k, v]) => `${k}: ${v}`);
            this.log(`Concluído: ${r.pages} página(s), ` +
                `${r.spans_inseridos} bloco(s) de texto invisível.`);
            this.log(`Motores usados — ${motores.join(', ')}.`);
            this.log(`PDF pesquisável salvo em: ${r.output_path}`);

            this.mostrarResultado('PDF pesquisável gerado', r,
                `Arquivo: ${r.output_path}\n` +
                `Páginas: ${r.pages}\n` +
                `Texto invisível inserido: ${r.spans_inseridos} bloco(s)\n` +
                `Motores: ${motores.join(', ')}`);
        });
    }

    /** Preenche o painel de resultado (stats + texto). */
    private mostrarResultado(titulo: string, r: any, texto: string) {
        document.getElementById('ocr-result-title')!.textContent = titulo;

        const stats = [
            `${r.pages ?? '?'} página(s)`,
            `${r.chars ?? texto.length} caractere(s)`,
        ];
        if (r.motores) {
            for (const [k, v] of Object.entries(r.motores)) {
                if ((v as number) > 0) stats.push(`${k}: ${v}`);
            }
        }
        if (r.scores) {
            for (const [k, v] of Object.entries(r.scores)) {
                stats.push(`score ${k}: ${v}`);
            }
        }
        document.getElementById('ocr-stats')!.innerHTML = stats
            .map(t => `<span class="badge">${escapeHtml(String(t))}</span>`)
            .join('');

        document.getElementById('ocr-texto')!.textContent = texto;
        document.getElementById('ocr-result')!.style.display = 'block';
    }
}
