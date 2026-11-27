import { API } from '../../api.js';
import { Feature, escapeHtml } from '../feature.js';
import { FileUtils } from '../file/utils.js';

export class ExcelExtractCellsFeature extends Feature {
    fields!: any[];
    cellCounter!: number;
    previewResults!: any;
    constructor() {
        super('extract');
        this.fields = [];
        this.cellCounter = 1;
        this.previewResults = null;
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Extrair Células</h4>
                <p class="text-zinc-500">Escaneie uma pasta de planilhas e extraia valores de células específicas, com suporte a fórmulas matemáticas.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pasta e destino</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta de origem</label>
                        <div class="input-group">
                            <input type="text" id="extract-source-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-extract-source">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Arquivo CSV de saída (opcional)</label>
                        <div class="input-group">
                            <input type="text" id="extract-output-csv" class="form-control" placeholder="Deixe vazio para apenas visualizar">
                            <button class="btn btn-outline-secondary" id="btn-extract-output">Salvar como</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Campos a extrair</h5>
                    <div id="fields-container">
                        <!-- Campos serão adicionados aqui -->
                    </div>
                    <div class="mt-2">
                        <button class="btn btn-outline-success btn-sm" id="add-field-btn">
                            <i data-lucide="circle-plus"></i> Adicionar Campo
                        </button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Opções</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="extract-recursive">
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-extract-run"><i data-lucide="play"></i> Extrair</button>

            ${this.progressHTML()}

            <div id="extract-preview" style="display:none;" class="mt-4">
                <label class="font-semibold text-zinc-600">Pré-visualização (<span id="extract-count">0</span> arquivos)</label>
                <div id="extract-table-container" style="max-height:400px; overflow:auto; border:1px solid #dee2e6; border-radius:0.375rem;"></div>
            </div>

            ${this.logHTML()}
        `;

        this.attachEvents();
        this.addField(); // Adiciona um campo padrão
    }

    attachEvents() {
        document.getElementById('btn-extract-source')!.addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('extract-source-dir');
        });

        document.getElementById('btn-extract-output')!.addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectSaveFile('extract-output-csv', [{ name: 'CSV', extensions: ['csv'] }])
        });

        document.getElementById('add-field-btn')!.addEventListener('click', () => this.addField());
        document.getElementById('btn-extract-run')!.addEventListener('click', () => this.runExtract());
    }

    addField() {
        const container = document.getElementById('fields-container')!;
        const fieldId = `field-${Date.now()}`;
        const row = document.createElement('div');
        row.className = 'row g-2 mb-2 align-items-center';
        row.id = fieldId;
        row.innerHTML = `
            <div class="md:col-span-3">
                <input type="text" class="form-control field-name" placeholder="Nome do campo (ex: Valor)" value="Campo${this.cellCounter}">
            </div>
            <div class="md:col-span-2">
                <select class="form-select field-type">
                    <option value="cell">Célula</option>
                    <option value="formula">Fórmula</option>
                </select>
            </div>
            <div class="md:col-span-5 field-source-container">
                <input type="text" class="form-control field-source" placeholder="Ex: A4" value="A${this.cellCounter}">
            </div>
            <div class="md:col-span-2">
                <button class="btn btn-outline-danger btn-sm remove-field-btn"><i data-lucide="trash"></i></button>
            </div>
        `;

        // Evento para trocar entre célula e fórmula
        row.querySelector('.field-type')!.addEventListener('change', (e) => {
            const sourceInput = row.querySelector('.field-source')!;
            const isFormula = (e.target as DomElement).value === 'formula';
            (sourceInput as DomElement).placeholder = isFormula ? 'Ex: Valor - Pago' : 'Ex: A4';
            (sourceInput as DomElement).value = isFormula ? '' : 'A1';
        });

        // Evento para remover
        row.querySelector('.remove-field-btn')!.addEventListener('click', () => {
            if (container.children.length > 1) {
                row.remove();
            } else {
                this.log('Mantenha pelo menos um campo.');
            }
        });

        container.appendChild(row);
        this.cellCounter++;
    }

    getFields() {
        const fields: any[] = [];
        document.querySelectorAll('#fields-container .row').forEach(row => {
            const name = (row.querySelector('.field-name') as DomElement).value.trim();
            const source = (row.querySelector('.field-source') as DomElement).value.trim();
            const type = (row.querySelector('.field-type') as DomElement).value;
            if (name && source) {
                fields.push({ name, source, type });
            }
        });
        return fields;
    }

    async runExtract() {
        const sourceDir = (document.getElementById('extract-source-dir') as DomElement).value.trim();
        const outputFile = (document.getElementById('extract-output-csv') as DomElement).value.trim() || undefined;
        const recursive = (document.getElementById('extract-recursive') as DomElement).checked;
        const fields = this.getFields();

        if (!sourceDir) {
            this.log('Selecione a pasta de origem.');
            return;
        }
        if (fields.length === 0) {
            this.log('Adicione pelo menos um campo.');
            return;
        }

        // Valida campos
        for (const f of fields) {
            if (f.type === 'cell' && !/^[A-Z]+[0-9]+$/i.test(f.source)) {
                this.log(`Campo "${f.name}" tem referência inválida (ex: A1).`);
                return;
            }
        }

        const btn = document.getElementById('btn-extract-run')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log(`Extraindo dados...`);

        try {
            const result = await API.excel.extractCells({
                source_dir: sourceDir,
                fields: fields.map(f => ({ name: f.name, source: f.source })),
                recursive: recursive,
                output_file: outputFile
            });

            const { results, errors } = result;

            if (errors.length) {
                this.log(`Erros: ${errors.length}`);
                errors.forEach((e: any) => this.log(`  ${e}`));
            }

            if (results.length === 0) {
                this.log('Nenhum dado extraído.');
            } else {
                this.log(`${results.length} arquivos processados.`);
                // Mostrar pré-visualização
                this.showPreview(results, fields);
            }

            if (outputFile) {
                this.log(`Relatório salvo em: ${outputFile}`);
            }

            this.setProgress(100);

        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }

    showPreview(results: any, fields: any) {
        const previewDiv = document.getElementById('extract-preview')!;
        previewDiv.style.display = 'block';
        document.getElementById('extract-count')!.textContent = results.length;

        const tableContainer = document.getElementById('extract-table-container')!;
        if (!results.length) {
            tableContainer.innerHTML = '<p class="text-zinc-500">Nenhum resultado.</p>';
            return;
        }

        // Monta tabela (valores de celula vem da planilha: conteudo
        // arbitrario — sempre escapeHtml)
        const headers = ['Arquivo', ...fields.map((f: any) => f.name)];
        let html = '<table class="table table-sm table-striped mb-0"><thead><tr>';
        headers.forEach(h => html += `<th>${escapeHtml(h)}</th>`);
        html += '</tr></thead><tbody>';
        results.forEach((row: any) => {
            html += '<tr>';
            headers.forEach(h => {
                let val = row[h] !== undefined ? row[h] : '';
                if (typeof val === 'number') val = val.toFixed(2);
                html += `<td>${escapeHtml(val)}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        tableContainer.innerHTML = html;
    }
}

