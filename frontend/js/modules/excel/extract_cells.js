class ExcelExtractCellsFeature {
    constructor() {
        this.fields = [];
        this.cellCounter = 1;
        this.previewResults = null;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Extrair Células</h4>
                <p class="text-muted">Escaneie uma pasta de planilhas e extraia valores de células específicas, com suporte a fórmulas matemáticas.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Pasta e destino</h5>
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

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Campos a extrair</h5>
                    <div id="fields-container">
                        <!-- Campos serão adicionados aqui -->
                    </div>
                    <div class="mt-2">
                        <button class="btn btn-outline-success btn-sm" id="add-field-btn">
                            <i class="bi bi-plus-circle"></i> Adicionar Campo
                        </button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="extract-recursive">
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-extract-run"><i class="bi bi-play-fill"></i> Extrair</button>

            <div class="progress mt-2"><div class="progress-bar" id="extract-progress" style="width:0%"></div></div>

            <div id="extract-preview" style="display:none;" class="mt-3">
                <label class="fw-bold text-success">Pré-visualização (<span id="extract-count">0</span> arquivos)</label>
                <div id="extract-table-container" style="max-height:400px; overflow:auto; border:1px solid #dee2e6; border-radius:0.375rem;"></div>
            </div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="extract-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents();
        this.addField(); // Adiciona um campo padrão
    }

    attachEvents() {
        document.getElementById('btn-extract-source').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('extract-source-dir');
        });

        document.getElementById('btn-extract-output').addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'CSV', extensions: ['csv'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('extract-output-csv').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('add-field-btn').addEventListener('click', () => this.addField());
        document.getElementById('btn-extract-run').addEventListener('click', () => this.runExtract());
    }

    addField() {
        const container = document.getElementById('fields-container');
        const fieldId = `field-${Date.now()}`;
        const row = document.createElement('div');
        row.className = 'row g-2 mb-2 align-items-center';
        row.id = fieldId;
        row.innerHTML = `
            <div class="col-md-3">
                <input type="text" class="form-control field-name" placeholder="Nome do campo (ex: Valor)" value="Campo${this.cellCounter}">
            </div>
            <div class="col-md-2">
                <select class="form-select field-type">
                    <option value="cell">Célula</option>
                    <option value="formula">Fórmula</option>
                </select>
            </div>
            <div class="col-md-5 field-source-container">
                <input type="text" class="form-control field-source" placeholder="Ex: A4" value="A${this.cellCounter}">
            </div>
            <div class="col-md-2">
                <button class="btn btn-outline-danger btn-sm remove-field-btn"><i class="bi bi-trash"></i></button>
            </div>
        `;

        // Evento para trocar entre célula e fórmula
        row.querySelector('.field-type').addEventListener('change', (e) => {
            const sourceInput = row.querySelector('.field-source');
            const isFormula = e.target.value === 'formula';
            sourceInput.placeholder = isFormula ? 'Ex: Valor - Pago' : 'Ex: A4';
            sourceInput.value = isFormula ? '' : 'A1';
        });

        // Evento para remover
        row.querySelector('.remove-field-btn').addEventListener('click', () => {
            if (container.children.length > 1) {
                row.remove();
            } else {
                FileUtils.log('Mantenha pelo menos um campo.', 'extract-log');
            }
        });

        container.appendChild(row);
        this.cellCounter++;
    }

    getFields() {
        const fields = [];
        document.querySelectorAll('#fields-container .row').forEach(row => {
            const name = row.querySelector('.field-name').value.trim();
            const source = row.querySelector('.field-source').value.trim();
            const type = row.querySelector('.field-type').value;
            if (name && source) {
                fields.push({ name, source, type });
            }
        });
        return fields;
    }

    async runExtract() {
        const sourceDir = document.getElementById('extract-source-dir').value.trim();
        const outputFile = document.getElementById('extract-output-csv').value.trim() || undefined;
        const recursive = document.getElementById('extract-recursive').checked;
        const fields = this.getFields();

        if (!sourceDir) {
            FileUtils.log('Selecione a pasta de origem.', 'extract-log');
            return;
        }
        if (fields.length === 0) {
            FileUtils.log('Adicione pelo menos um campo.', 'extract-log');
            return;
        }

        // Valida campos
        for (let f of fields) {
            if (f.type === 'cell' && !/^[A-Z]+[0-9]+$/i.test(f.source)) {
                FileUtils.log(`Campo "${f.name}" tem referência inválida (ex: A1).`, 'extract-log');
                return;
            }
        }

        const btn = document.getElementById('btn-extract-run');
        btn.disabled = true;
        FileUtils.clearLog('extract-log');
        FileUtils.log(`Extraindo dados...`, 'extract-log');

        try {
            const result = await window.API.excel.extractCells({
                source_dir: sourceDir,
                fields: fields.map(f => ({ name: f.name, source: f.source })),
                recursive: recursive,
                output_file: outputFile
            });

            const { results, errors, total_files } = result;

            if (errors.length) {
                FileUtils.log(`Erros: ${errors.length}`, 'extract-log');
                errors.forEach(e => FileUtils.log(`  ${e}`, 'extract-log'));
            }

            if (results.length === 0) {
                FileUtils.log('Nenhum dado extraído.', 'extract-log');
            } else {
                FileUtils.log(`${results.length} arquivos processados.`, 'extract-log');
                // Mostrar pré-visualização
                this.showPreview(results, fields);
            }

            if (outputFile) {
                FileUtils.log(`Relatório salvo em: ${outputFile}`, 'extract-log');
            }

            document.getElementById('extract-progress').style.width = '100%';

        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'extract-log');
        } finally {
            btn.disabled = false;
        }
    }

    showPreview(results, fields) {
        const previewDiv = document.getElementById('extract-preview');
        previewDiv.style.display = 'block';
        document.getElementById('extract-count').textContent = results.length;

        const tableContainer = document.getElementById('extract-table-container');
        if (!results.length) {
            tableContainer.innerHTML = '<p class="text-muted">Nenhum resultado.</p>';
            return;
        }

        // Monta tabela
        const headers = ['Arquivo', ...fields.map(f => f.name)];
        let html = '<table class="table table-sm table-striped mb-0"><thead><tr>';
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        results.forEach(row => {
            html += '<tr>';
            headers.forEach(h => {
                let val = row[h] !== undefined ? row[h] : '';
                if (typeof val === 'number') val = val.toFixed(2);
                html += `<td>${val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        tableContainer.innerHTML = html;
    }
}

window.ExcelExtractCellsFeature = ExcelExtractCellsFeature;