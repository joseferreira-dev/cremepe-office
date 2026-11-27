import { API } from '../../api.js';
import { Feature } from '../feature.js';
import { FileUtils } from '../file/utils.js';
import { attachPageInfoHint, validatePageRange } from './pageinfo.js';

export class PDFExtractPagesFeature extends Feature {
    mode!: string;
    pageInfo!: ReturnType<typeof attachPageInfoHint>;
    constructor() {
        super('extract');
        this.mode = 'all'; // 'all' ou 'selected'
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Extrair Páginas</h4>
                <p class="text-zinc-500">Extraia páginas individuais ou selecionadas de um PDF.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="extract-pdf-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-extract-pdf-input">Selecionar</button>
                    </div>
                    <div id="extract-info-hint" class="mt-2 text-zinc-500" style="display:none;"></div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pasta de saída</h5>
                    <div class="input-group">
                        <input type="text" id="extract-pdf-output" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-extract-pdf-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Modo de extração</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="extract-mode" id="extract-mode-all" value="all" checked>
                                <label class="form-check-label">Extrair todas as páginas</label>
                            </div>
                            <small class="text-zinc-500">Cada página será salva como um arquivo PDF separado</small>
                        </div>
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="extract-mode" id="extract-mode-selected" value="selected">
                                <label class="form-check-label">Extrair páginas selecionadas</label>
                            </div>
                            <small class="text-zinc-500">Ex: 1,3,5-7 (páginas 1, 3, 5, 6 e 7)</small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4" id="extract-selected-config" style="display:none;">
                <div class="card-body">
                    <h5 class="card-title section-title">Seleção de páginas</h5>
                    <div class="mb-2">
                        <label class="form-label">Páginas a extrair</label>
                        <input type="text" id="extract-pages-selection" class="form-control" placeholder="Ex: 1,3,5-7,10,15-20">
                        <small class="text-zinc-500">Use números separados por vírgula ou intervalos com hífen</small>
                    </div>
                </div>
            </div>

            <div class="card mb-4" id="extract-combine-config" style="display:none;">
                <div class="card-body">
                    <h5 class="card-title section-title">Opções de combinação</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="extract-combine">
                        <label class="form-check-label">Combinar páginas extraídas em um único PDF</label>
                    </div>
                    <div id="extract-combine-name-group" style="display:none;" class="mt-2">
                        <label class="form-label">Nome do arquivo combinado</label>
                        <input type="text" id="extract-combine-name" class="form-control" placeholder="Ex: paginas_extraidas" value="extracted_combined">
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Prefixo (opcional)</h5>
                    <input type="text" id="extract-prefix" class="form-control" placeholder="ex: pagina">
                </div>
            </div>

            <button class="btn btn-success" id="btn-extract-execute"><i data-lucide="play" class="me-1"></i>Extrair</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        // Eventos para alternar entre modos
        document.querySelectorAll('input[name="extract-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.mode = (e.target as DomElement).value;
                document.getElementById('extract-selected-config')!.style.display = (this.mode === 'selected') ? 'block' : 'none';
                document.getElementById('extract-combine-config')!.style.display = (this.mode === 'selected') ? 'block' : 'none';
            });
        });

        // Inicializar estado
        document.getElementById('extract-selected-config')!.style.display = 'none';
        document.getElementById('extract-combine-config')!.style.display = 'none';

        // Evento para mostrar/ocultar campo de nome do arquivo combinado
        document.getElementById('extract-combine')!.addEventListener('change', (e) => {
            document.getElementById('extract-combine-name-group')!.style.display = (e.target as DomElement).checked ? 'block' : 'none';
        });

        this.attachEvents();
    }

    attachEvents() {
        this.pageInfo = attachPageInfoHint('extract-pdf-input', 'extract-info-hint');

        document.getElementById('btn-extract-pdf-input')!.addEventListener('click', () => {
            FileUtils.selectFile('extract-pdf-input', [{ name: 'PDF', extensions: ['pdf'] }], {onSelect: () => { this.pageInfo.refresh(); }})
        });

        document.getElementById('btn-extract-pdf-output')!.addEventListener('click', () => {
            FileUtils.selectDirectory('extract-pdf-output');
        });

        document.getElementById('btn-extract-execute')!.addEventListener('click', () => this.executeExtract());
    }

    async executeExtract() {
        const inputFile = (document.getElementById('extract-pdf-input') as DomElement).value.trim();
        const outputDir = (document.getElementById('extract-pdf-output') as DomElement).value.trim();
        const mode = this.mode;
        const prefix = (document.getElementById('extract-prefix') as DomElement).value.trim();

        if (!inputFile || !outputDir) {
            this.log('Selecione o PDF e a pasta de destino.');
            return;
        }

        const btn = document.getElementById('btn-extract-execute')!;
        (btn as DomElement).disabled = true;
        this.clearLog();

        try {
            let result;

            if (mode === 'all') {
                this.log('Extraindo todas as páginas...');
                result = await API.pdf.extractAllPages({
                    pdf_path: inputFile,
                    output_dir: outputDir,
                    prefix: prefix
                });
            } else {
                const pagesSelection = (document.getElementById('extract-pages-selection') as DomElement).value.trim();
                if (!pagesSelection) {
                    this.log('Selecione pelo menos uma página.');
                    (btn as DomElement).disabled = false;
                    return;
                }
                // Valida localmente contra a contagem real de paginas
                // (se a leitura ainda nao voltou, o back valida de novo).
                const pages = this.pageInfo.pages();
                const problem = pages !== undefined
                    ? validatePageRange(pagesSelection, pages) : null;
                if (problem) {
                    this.log(`Erro: ${problem}`);
                    (btn as DomElement).disabled = false;
                    return;
                }
                const combine = (document.getElementById('extract-combine') as DomElement).checked;
                const combineName = (document.getElementById('extract-combine-name') as DomElement).value.trim() || undefined;

                this.log('Extraindo páginas selecionadas...');
                result = await API.pdf.extractSelectedPages({
                    pdf_path: inputFile,
                    output_dir: outputDir,
                    pages_selection: pagesSelection,
                    prefix: prefix,
                    combine: combine,
                    combine_name: combineName
                });
            }

            const { total_pages, total_files, output_files, combined_file, errors } = result;
            if (combined_file) {
                this.log(`Concluído! ${total_files} arquivos gerados.`);
                this.log(`Arquivos combinados em: ${combined_file}`);
            } else {
                this.log(`Concluído! ${total_files} arquivos gerados a partir de ${total_pages} páginas.`);
                if (output_files.length <= 10) {
                    output_files.forEach((f: any) => this.log(`  ${f}`));
                } else {
                    this.log(`  ${output_files.length} arquivos gerados na pasta ${outputDir}`);
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

