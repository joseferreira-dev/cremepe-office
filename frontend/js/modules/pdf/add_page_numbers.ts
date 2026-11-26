import { API } from '../../api.js';
import { Feature } from '../feature.js';

export class PDFAddPageNumbersFeature extends Feature {
    previewCanvasId!: string;
    updateTimeout!: any;
    constructor() {
        super('pn');
        this.updateTimeout = null;
        this.previewCanvasId = 'page-number-preview-canvas';
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Numerar Páginas</h4>
                <p class="text-zinc-500">Adicione numeração às páginas de um PDF com controle de posição, cores e estilo.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="pn-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-pn-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-12 gap-4 mb-4">
                <div class="md:col-span-6">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Configuração</h5>
                            <div class="grid grid-cols-12 gap-2">
                                <div class="col-span-6">
                                    <label class="form-label">Página inicial</label>
                                    <input type="number" id="pn-start-page" class="form-control" value="1" min="1">
                                </div>
                                <div class="col-span-6">
                                    <label class="form-label">Página final</label>
                                    <input type="number" id="pn-end-page" class="form-control" placeholder="vazio = até o final">
                                </div>
                                <div class="col-span-12">
                                    <label class="form-label">Número inicial</label>
                                    <input type="number" id="pn-start-number" class="form-control" value="1" min="0">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Estilo</h5>
                            <div class="grid grid-cols-12 gap-2">
                                <div class="col-span-6">
                                    <label class="form-label">Cor do número</label>
                                    <input type="color" id="pn-color" class="form-control" value="#000000">
                                </div>
                                <div class="col-span-6">
                                    <label class="form-label">Cor do fundo</label>
                                    <input type="color" id="pn-bg-color" class="form-control" value="#ffffff">
                                </div>
                                <div class="col-span-12">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="pn-show-bg" checked>
                                        <label class="form-check-label">Mostrar fundo (retângulo)</label>
                                    </div>
                                </div>
                                <div class="col-span-6">
                                    <label class="form-label">Tamanho da fonte</label>
                                    <select id="pn-font-size" class="form-select">
                                        <option value="8">8</option>
                                        <option value="9">9</option>
                                        <option value="10">10</option>
                                        <option value="11">11</option>
                                        <option value="12" selected>12</option>
                                    </select>
                                </div>
                                <div class="col-span-6">
                                    <label class="form-label">Margem da borda (cm)</label>
                                    <input type="number" id="pn-margin" class="form-control" value="1.0" min="0" step="0.1">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Posição</h5>
                            <select id="pn-position" class="form-select">
                                <option value="top-left">Superior Esquerdo</option>
                                <option value="top-center">Superior Central</option>
                                <option value="top-right">Superior Direito</option>
                                <option value="bottom-left">Inferior Esquerdo</option>
                                <option value="bottom-center" selected>Inferior Central</option>
                                <option value="bottom-right">Inferior Direito</option>
                                <option value="center">Centro</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="md:col-span-6">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title section-title">Preview</h5>
                            <div style="position:relative; width:100%; max-width:400px; margin:0 auto; border:2px solid #007A51; border-radius:8px; padding:4px; background:#f8f9fa;">
                                <canvas id="${this.previewCanvasId}" width="400" height="566" style="width:100%; height:auto; display:block;"></canvas>
                                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:12px; color:#6c757d; pointer-events:none;">
                                    Página
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="pn-output" class="form-control" placeholder="Caminho do PDF numerado">
                        <button class="btn btn-outline-secondary" id="btn-pn-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-pn-apply"><i data-lucide="play" class="me-1"></i>Inserir Numeração</button>

            ${this.progressHTML()}

            <div id="pn-result" style="display:none;" class="mt-4">
                <div class="grid grid-cols-12 gap-2">
                    <div class="col-span-6"><span class="badge bg-zinc-500">Total páginas: <span id="pn-total-pages">0</span></span></div>
                    <div class="col-span-6"><span class="badge bg-brand-600">Processadas: <span id="pn-processed">0</span></span></div>
                </div>
            </div>

            ${this.logHTML('LOG')}
        `;

        // Atualiza preview ao alterar estes controles
        ['pn-position', 'pn-color', 'pn-bg-color', 'pn-show-bg', 'pn-font-size', 'pn-margin'].forEach(id => {
            const el = document.getElementById(id)!;
            if (el) {
                el.addEventListener('input', () => this.schedulePreviewUpdate());
                el.addEventListener('change', () => this.schedulePreviewUpdate());
            }
        });

        this.attachEvents();
        this.updatePreview();
    }

    attachEvents() {
        document.getElementById('btn-pn-input')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        (document.getElementById('pn-input') as DomElement).value = result.filePaths[0];
                        this.suggestOutput();
                    }
                });
            }
        });

        document.getElementById('btn-pn-output')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        (document.getElementById('pn-output') as DomElement).value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-pn-apply')!.addEventListener('click', () => this.applyPageNumbers());
        document.getElementById('pn-input')!.addEventListener('change', () => this.suggestOutput());
    }

    suggestOutput() {
        const input = (document.getElementById('pn-input') as DomElement).value.trim();
        const output = document.getElementById('pn-output')!;
        if (input && !(output as DomElement).value) {
            const base = input.replace(/\.[^.]+$/, '');
            (output as DomElement).value = `${base}_numerado.pdf`;
        }
    }

    schedulePreviewUpdate() {
        if (this.updateTimeout) {
            this.clearTimeout(this.updateTimeout);
        }
        this.updateTimeout = this.setTimeout(() => {
            this.updatePreview();
            this.updateTimeout = null;
        }, 200);
    }

    updatePreview() {
        const canvas = document.getElementById(this.previewCanvasId)!;
        if (!canvas) return;
        const ctx = (canvas as HTMLCanvasElement).getContext('2d')!;
        const w = 400, h = 566;

        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#007A51';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, w, h);

        const position = (document.getElementById('pn-position') as DomElement).value;
        const color = (document.getElementById('pn-color') as DomElement).value;
        const bgColor = (document.getElementById('pn-bg-color') as DomElement).value;
        const showBg = (document.getElementById('pn-show-bg') as DomElement).checked;
        const fontSize = parseInt((document.getElementById('pn-font-size') as DomElement).value) || 12;
        const marginCm = parseFloat((document.getElementById('pn-margin') as DomElement).value) || 1.0;
        const margin = marginCm * 28.3464567;

        const text = '123';
        const textWidth = text.length * fontSize * 0.6;
        const textHeight = fontSize;
        const pad = 8;
        const boxWidth = textWidth + 2 * pad;
        const boxHeight = textHeight + 2 * pad;

        let cx, cy;
        const refMap: Record<string, { hRef: number; vRef: number }> = {
            'top-left': { hRef: 0, vRef: 0 },
            'top-center': { hRef: 0.5, vRef: 0 },
            'top-right': { hRef: 1, vRef: 0 },
            'bottom-left': { hRef: 0, vRef: 1 },
            'bottom-center': { hRef: 0.5, vRef: 1 },
            'bottom-right': { hRef: 1, vRef: 1 },
            'center': { hRef: 0.5, vRef: 0.5 }
        };
        const ref = refMap[position] || { hRef: 0.5, vRef: 1 };
        if (ref.hRef === 0) cx = margin + boxWidth / 2;
        else if (ref.hRef === 0.5) cx = w / 2;
        else cx = w - margin - boxWidth / 2;
        if (ref.vRef === 0) cy = margin + boxHeight / 2;
        else if (ref.vRef === 0.5) cy = h / 2;
        else cy = h - margin - boxHeight / 2;

        if (cx - boxWidth / 2 < 0) cx = boxWidth / 2;
        if (cx + boxWidth / 2 > w) cx = w - boxWidth / 2;
        if (cy - boxHeight / 2 < 0) cy = boxHeight / 2;
        if (cy + boxHeight / 2 > h) cy = h - boxHeight / 2;

        const rectX = cx - boxWidth / 2;
        const rectY = cy - boxHeight / 2;

        // Desenhar fundo retangular se solicitado
        if (showBg) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(rectX, rectY, boxWidth, boxHeight);
            ctx.strokeStyle = bgColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(rectX, rectY, boxWidth, boxHeight);
        }

        // Texto centralizado
        ctx.fillStyle = color;
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy);

        // Informações
        ctx.font = '10px Arial';
        ctx.fillStyle = '#6c757d';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Posição: ${position}`, 5, 5);
        ctx.fillText(`Margem: ${marginCm.toFixed(1)} cm`, 5, 20);
        ctx.fillText(`Cor: ${color}`, 5, 35);
        ctx.fillText(`Fundo: ${showBg ? bgColor : 'nenhum'}`, 5, 50);
        ctx.fillText(`Fonte: ${fontSize}pt`, 5, 65);
    }

    async applyPageNumbers() {
        const inputPath = (document.getElementById('pn-input') as DomElement).value.trim();
        const outputPath = (document.getElementById('pn-output') as DomElement).value.trim();
        const startPage = parseInt((document.getElementById('pn-start-page') as DomElement).value) || 1;
        const endPage = (document.getElementById('pn-end-page') as DomElement).value.trim() ? parseInt((document.getElementById('pn-end-page') as DomElement).value) : null;
        const startNumber = parseInt((document.getElementById('pn-start-number') as DomElement).value) || 1;
        const color = (document.getElementById('pn-color') as DomElement).value;
        const bgColor = (document.getElementById('pn-bg-color') as DomElement).value;
        const showBg = (document.getElementById('pn-show-bg') as DomElement).checked;
        const position = (document.getElementById('pn-position') as DomElement).value;
        const fontSize = parseInt((document.getElementById('pn-font-size') as DomElement).value) || 12;
        const marginCm = parseFloat((document.getElementById('pn-margin') as DomElement).value) || 1.0;

        if (!inputPath || !outputPath) {
            this.log('Selecione o PDF de entrada e defina o de saída.');
            return;
        }

        const btn = document.getElementById('btn-pn-apply')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Inserindo numeração...');

        try {
            const result = await API.pdf.addPageNumbers({
                input_path: inputPath,
                output_path: outputPath,
                start_page: startPage,
                end_page: endPage,
                start_number: startNumber,
                color: color,
                background_color: bgColor,
                position: position,
                font_size: fontSize,
                show_background: showBg,
                margin_cm: marginCm
            });

            document.getElementById('pn-total-pages')!.textContent = result.total_pages;
            document.getElementById('pn-processed')!.textContent = result.processed_pages;
            document.getElementById('pn-result')!.style.display = 'block';

            this.log(`Numeração inserida! ${result.processed_pages} páginas numeradas.`);
            this.log(`Arquivo: ${result.output_path}`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}

