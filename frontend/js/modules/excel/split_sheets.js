class ExcelSplitSheetsFeature extends Feature {
    constructor() {
        super('split-sheets');
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Extrair Abas</h4>
                <p class="text-muted">Extraia cada aba de um arquivo Excel para um arquivo separado (XLSX ou CSV).</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="split-sheets-input" class="form-control" placeholder="Selecione o arquivo .xlsx...">
                        <button class="btn btn-outline-secondary" id="btn-split-sheets-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Pasta de destino</h5>
                    <div class="input-group">
                        <input type="text" id="split-sheets-output" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-split-sheets-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Formato de saída</h5>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="split-sheets-format" id="split-format-xlsx" value="xlsx" checked>
                                <label class="form-check-label">XLSX</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="split-sheets-format" id="split-format-csv" value="csv">
                                <label class="form-check-label">CSV</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-split-sheets"><i class="bi bi-play-fill"></i> Extrair Abas</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-split-sheets-input').addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('split-sheets-input').value = result.filePaths[0];
                    }
                });
            }
        });

        document.getElementById('btn-split-sheets-output').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('split-sheets-output');
        });

        document.getElementById('btn-split-sheets').addEventListener('click', () => this.splitSheets());
    }

    async splitSheets() {
        const inputFile = document.getElementById('split-sheets-input').value.trim();
        const outputDir = document.getElementById('split-sheets-output').value.trim();
        const formatRadio = document.querySelector('input[name="split-sheets-format"]:checked');
        const outputFormat = formatRadio ? formatRadio.value : 'xlsx';

        if (!inputFile || !outputDir) {
            this.log('Selecione o arquivo e a pasta de destino.');
            return;
        }

        const btn = document.getElementById('btn-split-sheets');
        btn.disabled = true;
        this.clearLog();
        this.log(`Extraindo abas para ${outputFormat.toUpperCase()}...`);

        try {
            const result = await window.API.excel.splitSheets({
                input_file: inputFile,
                output_dir: outputDir,
                output_format: outputFormat
            });

            const { processed, files, errors } = result;
            this.log(`Concluído! ${processed} abas extraídas.`);
            files.forEach(f => this.log(`  ${f}`));
            if (errors.length) {
                this.log(`Erros: ${errors.length}`);
                errors.forEach(e => this.log(`  ${e}`));
            }
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}

window.ExcelSplitSheetsFeature = ExcelSplitSheetsFeature;