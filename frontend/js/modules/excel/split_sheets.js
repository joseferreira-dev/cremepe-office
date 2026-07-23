class ExcelSplitSheetsFeature {
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

            <div class="progress mt-2"><div class="progress-bar" id="split-sheets-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="split-sheets-log">Log de operações vazio</div>
            </div>
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
            FileUtils.log('Selecione o arquivo e a pasta de destino.', 'split-sheets-log');
            return;
        }

        const btn = document.getElementById('btn-split-sheets');
        btn.disabled = true;
        FileUtils.clearLog('split-sheets-log');
        FileUtils.log(`Extraindo abas para ${outputFormat.toUpperCase()}...`, 'split-sheets-log');

        try {
            const result = await window.API.excel.splitSheets({
                input_file: inputFile,
                output_dir: outputDir,
                output_format: outputFormat
            });

            const { processed, files, errors } = result;
            FileUtils.log(`Concluído! ${processed} abas extraídas.`, 'split-sheets-log');
            files.forEach(f => FileUtils.log(`  ${f}`, 'split-sheets-log'));
            if (errors.length) {
                FileUtils.log(`Erros: ${errors.length}`, 'split-sheets-log');
                errors.forEach(e => FileUtils.log(`  ${e}`, 'split-sheets-log'));
            }
            document.getElementById('split-sheets-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'split-sheets-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.ExcelSplitSheetsFeature = ExcelSplitSheetsFeature;