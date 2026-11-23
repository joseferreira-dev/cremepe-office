import { API } from '../../api.js';
import { Feature, escapeHtml } from '../feature.js';
import { FileUtils } from '../file/utils.js';

export class ExcelSplitFeature extends Feature {
    constructor() {
        super('split');
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Dividir por Coluna</h4>
                <p class="text-zinc-500">Divida um arquivo grande em vários arquivos com base nos valores de uma coluna específica.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="split-input-file" class="form-control" placeholder="Selecione o arquivo XLSX...">
                        <button class="btn btn-outline-secondary" id="btn-split-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pasta de saída</h5>
                    <div class="input-group">
                        <input type="text" id="split-output-dir" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-split-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Configuração</h5>
                    <div class="mb-2">
                        <label class="form-label">Coluna chave (nome ou índice 0-based)</label>
                        <div class="input-group">
                            <input type="text" id="split-column" class="form-control" placeholder="Ex: 'Estado' ou 0, 1, 2...">
                            <button class="btn btn-outline-secondary" id="btn-split-preview">Visualizar colunas</button>
                        </div>
                        <small class="text-zinc-500">Digite o nome da coluna ou o índice (começando em 0). Ex: "Estado" ou "3".</small>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Formato de saída</label>
                        <select id="split-format" class="form-select">
                            <option value="xlsx">XLSX</option>
                            <option value="csv">CSV</option>
                        </select>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="split-include-header" checked>
                        <label class="form-check-label">Incluir cabeçalho em cada arquivo</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-split-execute"><i data-lucide="play"></i> Dividir</button>

            ${this.progressHTML()}

            <div id="split-preview-area" style="display:none;" class="mt-4">
                <label class="font-semibold text-zinc-600">Pré-visualização</label>
                <div id="split-preview-list" class="border rounded p-2 border-zinc-200" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            ${this.logHTML()}
        `;

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-split-input')!.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
                }).then(result => {
                    if (!result.canceled) {
                        (document.getElementById('split-input-file') as DomElement).value = result.filePaths[0];
                    }
                });
            }
        });

        document.getElementById('btn-split-output')!.addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('split-output-dir');
        });

        document.getElementById('btn-split-preview')!.addEventListener('click', () => this.previewColumns());

        document.getElementById('btn-split-execute')!.addEventListener('click', () => this.executeSplit());
    }

    async previewColumns() {
        const inputFile = (document.getElementById('split-input-file') as DomElement).value.trim();
        if (!inputFile) {
            this.log('Selecione o arquivo de entrada.');
            return;
        }

        const btn = document.getElementById('btn-split-preview')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Carregando cabeçalhos...');

        try {
            // Usamos a rota existente de leitura (read) para obter cabeçalhos
            const result = await API.excel.read({ file_path: inputFile });
            if (!result.data || result.data.length === 0) {
                this.log('Arquivo sem dados.');
                return;
            }
            const headers = Object.keys(result.data[0]);
            const previewArea = document.getElementById('split-preview-area')!;
            previewArea.style.display = 'block';
            const listDiv = document.getElementById('split-preview-list')!;
            listDiv.innerHTML = `
                <strong>Colunas disponíveis (${headers.length}):</strong><br>
                ${headers.map((h, i) => `<span class="badge bg-zinc-500 me-1">${i}: ${escapeHtml(h)}</span>`).join('')}
                <br><small class="text-zinc-500">Use o nome ou o índice para a coluna chave.</small>
            `;
            this.log('Cabeçalhos carregados.');
        } catch (err) {
            this.log(`Erro ao ler arquivo: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }

    async executeSplit() {
        const inputFile = (document.getElementById('split-input-file') as DomElement).value.trim();
        const outputDir = (document.getElementById('split-output-dir') as DomElement).value.trim();
        const column = (document.getElementById('split-column') as DomElement).value.trim();
        const format = (document.getElementById('split-format') as DomElement).value;
        const includeHeader = (document.getElementById('split-include-header') as DomElement).checked;

        if (!inputFile || !outputDir || !column) {
            this.log('Preencha todos os campos.');
            return;
        }

        // Se column for número, converter para int
        let columnParam: string | number = column;
        if (!isNaN(Number(column)) && column.trim() !== '') {
            columnParam = parseInt(column, 10);
        }

        const btn = document.getElementById('btn-split-execute')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log(`Dividindo por coluna "${column}"...`);

        try {
            const result = await API.excel.splitByColumn({
                input_file: inputFile,
                output_dir: outputDir,
                column: columnParam,
                output_format: format,
                include_header: includeHeader
            });

            const { total_rows, total_groups, output_files, errors } = result;
            this.log(`Concluído! ${total_rows} linhas divididas em ${total_groups} arquivos.`);
            if (errors.length) {
                this.log(`Erros: ${errors.length}`);
                errors.forEach((e: any) => this.log(`  ${e}`));
            }
            if (output_files.length) {
                this.log(`Arquivos gerados:\n${output_files.join('\n')}`);
            }
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}

