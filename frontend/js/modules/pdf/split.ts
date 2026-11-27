import { API } from '../../api.js';
import { Feature, escapeHtml } from '../feature.js';
import { FileUtils } from '../file/utils.js';
import { attachPageInfoHint, validatePageRange } from './pageinfo.js';

export class PDFSplitFeature extends Feature {
    mode!: string;
    pageInfo!: ReturnType<typeof attachPageInfoHint>;
    constructor() {
        super('split-pdf');
        this.mode = 'custom'; // 'custom' ou 'fixed'
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Dividir</h4>
                <p class="text-zinc-500">Divida um PDF em partes com intervalos personalizados ou tamanho fixo.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="split-pdf-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-split-pdf-input">Selecionar</button>
                    </div>
                    <div id="split-info-hint" class="mt-2 text-zinc-500" style="display:none;"></div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pasta de saída</h5>
                    <div class="input-group">
                        <input type="text" id="split-pdf-output" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-split-pdf-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Modo de divisão</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="split-mode" id="split-mode-custom" value="custom" checked>
                                <label class="form-check-label">Intervalo Personalizado</label>
                            </div>
                            <small class="text-zinc-500">Ex: 1-10, 15-16, 20-25</small>
                        </div>
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="split-mode" id="split-mode-fixed" value="fixed">
                                <label class="form-check-label">Intervalo Fixo</label>
                            </div>
                            <small class="text-zinc-500">Dividir de X em X páginas</small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4" id="split-custom-config">
                <div class="card-body">
                    <h5 class="card-title section-title">Intervalos personalizados</h5>
                    <div class="mb-2">
                        <label class="form-label">Digite os intervalos</label>
                        <input type="text" id="split-intervals" class="form-control" placeholder="Ex: 1-10, 15-16, 20-25">
                    </div>
                </div>
            </div>

            <div class="card mb-4" id="split-fixed-config" style="display:none;">
                <div class="card-body">
                    <h5 class="card-title section-title">Intervalo Fixo</h5>
                    <div class="mb-2">
                        <label class="form-label">Páginas por arquivo</label>
                        <input type="number" id="split-pages-per-file" class="form-control" value="10" min="1">
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Opções de saída</h5>
                    <div class="mb-2">
                        <label class="form-label">Prefixo das partes</label>
                        <input type="text" id="split-part-prefix" class="form-control" placeholder="Ex: documento" value="part">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="split-combine">
                        <label class="form-check-label">Combinar em um único arquivo (não gera partes individuais)</label>
                    </div>
                    <div id="split-combine-name-container" style="display:none;" class="mt-2">
                        <label class="form-label">Nome do arquivo final</label>
                        <input type="text" id="split-combine-name" class="form-control" placeholder="Ex: documento_final" value="combined">
                        <small class="text-zinc-500">O arquivo será salvo com extensão .pdf</small>
                    </div>
                </div>
            </div>

            <div class="flex gap-2">
                <button class="btn btn-outline-success" id="btn-split-preview"><i data-lucide="eye" class="me-1"></i>Pré-visualizar</button>
                <button class="btn btn-success" id="btn-split-execute"><i data-lucide="play" class="me-1"></i>Dividir</button>
            </div>

            <div id="split-preview-area" style="display:none;" class="mt-4">
                <label class="font-semibold text-zinc-600">Pré-visualização</label>
                <div id="split-preview-list" class="border rounded p-2 border-zinc-200" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        // Eventos para alternar entre modos
        document.querySelectorAll('input[name="split-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.mode = (e.target as DomElement).value;
                document.getElementById('split-custom-config')!.style.display = (this.mode === 'custom') ? 'block' : 'none';
                document.getElementById('split-fixed-config')!.style.display = (this.mode === 'fixed') ? 'block' : 'none';
            });
        });

        // Evento para mostrar/ocultar campo de nome combinado
        document.getElementById('split-combine')!.addEventListener('change', (e) => {
            document.getElementById('split-combine-name-container')!.style.display = (e.target as DomElement).checked ? 'block' : 'none';
        });

        this.attachEvents();
    }

    attachEvents() {
        this.pageInfo = attachPageInfoHint('split-pdf-input', 'split-info-hint');

        document.getElementById('btn-split-pdf-input')!.addEventListener('click', () => {
            FileUtils.selectFile('split-pdf-input', [{ name: 'PDF', extensions: ['pdf'] }], {onSelect: () => { this.pageInfo.refresh(); }})
        });

        document.getElementById('btn-split-pdf-output')!.addEventListener('click', () => {
            FileUtils.selectDirectory('split-pdf-output');
        });

        document.getElementById('btn-split-preview')!.addEventListener('click', () => this.previewSplit());
        document.getElementById('btn-split-execute')!.addEventListener('click', () => this.executeSplit());
    }

    previewSplit() {
        const mode = this.mode;
        const intervalsStr = (document.getElementById('split-intervals') as DomElement).value.trim();
        const pagesPerFile = parseInt((document.getElementById('split-pages-per-file') as DomElement).value);
        const combine = (document.getElementById('split-combine') as DomElement).checked;
        const partPrefix = (document.getElementById('split-part-prefix') as DomElement).value.trim() || 'part';
        const combineName = (document.getElementById('split-combine-name') as DomElement).value.trim() || 'combined';

        const previewArea = document.getElementById('split-preview-area')!;
        previewArea.style.display = 'block';
        const listDiv = document.getElementById('split-preview-list')!;

        let html;
        if (mode === 'custom') {
            const parts = intervalsStr.split(',').map(s => s.trim()).filter(Boolean);
            if (parts.length === 0) {
                html = '<p class="text-zinc-500">Nenhum intervalo definido.</p>';
            } else {
                html = `<strong>Intervalos definidos (${parts.length}):</strong><br>${parts.map(p => `- ${escapeHtml(p)}`).join('<br>')}`;
            }
        } else {
            html = `<strong>Intervalo fixo:</strong> ${pagesPerFile} páginas por arquivo`;
        }

        if (combine) {
            html += `<br><br><strong>Modo combinado:</strong> será gerado apenas o arquivo <strong>${escapeHtml(combineName)}.pdf</strong>`;
        } else {
            html += `<br><br><strong>Modo partes:</strong> serão gerados arquivos com prefixo <strong>${escapeHtml(partPrefix)}_</strong>`;
        }

        listDiv.innerHTML = html;
        this.log('Pré-visualização gerada.');
    }

    async executeSplit() {
        const inputFile = (document.getElementById('split-pdf-input') as DomElement).value.trim();
        const outputDir = (document.getElementById('split-pdf-output') as DomElement).value.trim();
        const mode = this.mode;
        const combine = (document.getElementById('split-combine') as DomElement).checked;
        const partPrefix = (document.getElementById('split-part-prefix') as DomElement).value.trim() || 'part';
        const combineName = (document.getElementById('split-combine-name') as DomElement).value.trim() || 'combined';

        if (!inputFile || !outputDir) {
            this.log('Selecione o PDF e a pasta de destino.');
            return;
        }

        const btn = document.getElementById('btn-split-execute')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Iniciando divisão...');

        try {
            let result;
            if (mode === 'custom') {
                const intervalsStr = (document.getElementById('split-intervals') as DomElement).value.trim();
                if (!intervalsStr) {
                    this.log('Digite os intervalos.');
                    (btn as DomElement).disabled = false;
                    return;
                }
                // Valida localmente contra a contagem real de paginas
                // (se a leitura ainda nao voltou, o back valida de novo).
                const pages = this.pageInfo.pages();
                const problem = pages !== undefined
                    ? validatePageRange(intervalsStr, pages) : null;
                if (problem) {
                    this.log(`Erro: ${problem}`);
                    (btn as DomElement).disabled = false;
                    return;
                }
                result = await API.pdf.splitCustom({
                    pdf_path: inputFile,
                    output_dir: outputDir,
                    intervals_str: intervalsStr,
                    combine: combine,
                    part_prefix: partPrefix,
                    combine_name: combineName
                });
            } else {
                const pagesPerFile = parseInt((document.getElementById('split-pages-per-file') as DomElement).value);
                if (isNaN(pagesPerFile) || pagesPerFile < 1) {
                    this.log('Informe um número válido de páginas por arquivo.');
                    (btn as DomElement).disabled = false;
                    return;
                }
                result = await API.pdf.splitFixed({
                    pdf_path: inputFile,
                    output_dir: outputDir,
                    pages_per_file: pagesPerFile,
                    combine: combine,
                    part_prefix: partPrefix,
                    combine_name: combineName
                });
            }

            const { total_pages, total_files, output_files, combined_file, errors } = result;
            if (combine) {
                this.log(`Concluído! Arquivo combinado gerado: ${combined_file} (${total_pages} páginas)`);
            } else {
                this.log(`Concluído! ${total_files} arquivos gerados a partir de ${total_pages} páginas.`);
                if (output_files.length) {
                    this.log(`Arquivos:\n${output_files.join('\n')}`);
                }
            }
            if (errors.length) {
                this.log(`Erros: ${errors.length}`);
                errors.forEach((e: any) => this.log(`  ${e}`));
            }
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}

