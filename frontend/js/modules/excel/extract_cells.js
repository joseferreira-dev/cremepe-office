class ExcelExtractCellsFeature {
    constructor() {
        this.mappings = []; // Array de {columnName, cellRef}
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal"><i class="bi bi-table me-2"></i>Extrair Células Específicas</h4>
                <p class="text-muted">Escaneie uma pasta de planilhas e extraia células específicas (ex: B2, C5) gerando um relatório CSV.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Pastas e Arquivo</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta de origem (com os arquivos .xlsx)</label>
                        <div class="input-group">
                            <input type="text" id="extract-source-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-extract-source">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Arquivo CSV de saída</label>
                        <div class="input-group">
                            <input type="text" id="extract-csv-file" class="form-control" placeholder="Caminho do arquivo CSV...">
                            <button class="btn btn-outline-secondary" id="btn-extract-csv">Salvar como</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Células a Extrair</h5>
                    <p class="text-muted">Defina as células que deseja extrair de cada planilha.</p>
                    <div id="mappings-container">
                        <!-- Mapeamentos serão inseridos aqui -->
                    </div>
                    <button class="btn btn-outline-success btn-sm mt-2" id="add-mapping">
                        <i class="bi bi-plus-circle"></i> Adicionar Célula
                    </button>
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

            <button class="btn btn-success" id="btn-extract-cells"><i class="bi bi-play-fill"></i> Extrair</button>

            <div class="progress mt-2"><div class="progress-bar" id="extract-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="extract-log">Log de operações vazio</div>
            </div>
        `;

        // Adicionar um mapeamento inicial de exemplo
        this.mappings = [
            { columnName: 'Título', cellRef: 'A1' },
            { columnName: 'Total', cellRef: 'B2' }
        ];
        this.renderMappings();
        this.attachEvents();
    }

    renderMappings() {
        const container = document.getElementById('mappings-container');
        container.innerHTML = this.mappings.map((map, index) => `
            <div class="row g-2 mb-2" data-index="${index}">
                <div class="col-md-5">
                    <input type="text" class="form-control map-column" value="${map.columnName}" placeholder="Nome da coluna (ex: Total)">
                </div>
                <div class="col-md-5">
                    <input type="text" class="form-control map-cell" value="${map.cellRef}" placeholder="Referência (ex: B2)">
                </div>
                <div class="col-md-2">
                    <button class="btn btn-outline-danger remove-mapping" data-index="${index}">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    attachEvents() {
        document.getElementById('btn-extract-source').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('extract-source-dir');
        });

        document.getElementById('btn-extract-csv').addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'CSV', extensions: ['csv'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('extract-csv-file').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('add-mapping').addEventListener('click', () => {
            this.mappings.push({ columnName: '', cellRef: '' });
            this.renderMappings();
        });

        // Delegação para remoção
        document.getElementById('mappings-container').addEventListener('click', (e) => {
            if (e.target.closest('.remove-mapping')) {
                const btn = e.target.closest('.remove-mapping');
                const index = parseInt(btn.dataset.index);
                this.mappings.splice(index, 1);
                this.renderMappings();
            }
        });

        // Atualizar dados ao digitar
        document.getElementById('mappings-container').addEventListener('input', (e) => {
            const row = e.target.closest('.row');
            if (!row) return;
            const index = parseInt(row.dataset.index);
            const columnInput = row.querySelector('.map-column');
            const cellInput = row.querySelector('.map-cell');
            if (columnInput) this.mappings[index].columnName = columnInput.value;
            if (cellInput) this.mappings[index].cellRef = cellInput.value;
        });

        document.getElementById('btn-extract-cells').addEventListener('click', () => this.extractCells());
    }

    async extractCells() {
        const sourceDir = document.getElementById('extract-source-dir').value.trim();
        const outputCsv = document.getElementById('extract-csv-file').value.trim();
        const recursive = document.getElementById('extract-recursive').checked;

        if (!sourceDir || !outputCsv) {
            FileUtils.log('Selecione a pasta de origem e o arquivo CSV de destino.', 'extract-log');
            return;
        }

        // Validar mapeamentos
        const validMappings = {};
        let hasError = false;
        this.mappings.forEach((map, index) => {
            const col = map.columnName.trim();
            const cell = map.cellRef.trim();
            if (!col || !cell) {
                hasError = true;
                FileUtils.log(`Mapeamento ${index + 1}: Preencha nome e referência da célula.`, 'extract-log');
            } else {
                validMappings[col] = cell;
            }
        });

        if (hasError || Object.keys(validMappings).length === 0) {
            FileUtils.log('Corrija os mapeamentos antes de continuar.', 'extract-log');
            return;
        }

        const btn = document.getElementById('btn-extract-cells');
        btn.disabled = true;
        FileUtils.clearLog('extract-log');
        FileUtils.log(`Iniciando extração de células...`, 'extract-log');

        try {
            const result = await window.API.excel.extractCells({
                source_dir: sourceDir,
                output_csv: outputCsv,
                cell_mappings: validMappings,
                recursive: recursive
            });

            const { processed, errors, output_path } = result;
            FileUtils.log(`Concluído! ${processed} arquivos processados.`, 'extract-log');
            FileUtils.log(`Relatório gerado em: ${output_path}`, 'extract-log');
            if (errors.length) {
                FileUtils.log(`Erros: ${errors.length}`, 'extract-log');
                errors.forEach(e => FileUtils.log(`  ${e}`, 'extract-log'));
            }
            document.getElementById('extract-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'extract-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.ExcelExtractCellsFeature = ExcelExtractCellsFeature;