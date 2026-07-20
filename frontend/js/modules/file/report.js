class ReportFeature {
    constructor(module) {
        this.module = module;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Gerar Relatório de Estrutura</h4>
                <p class="text-muted">Exporte a árvore de diretórios para TXT ou CSV, com opção de incluir ou não os arquivos.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Diretório</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="report-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-report-dir">Selecionar</button>
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="report-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="report-include-files" checked>
                        <label class="form-check-label">Listar arquivos</label>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Formato de saída</h5>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="report-format" id="report-format-txt" value="txt" checked>
                                <label class="form-check-label">TXT (indentado)</label>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="report-format" id="report-format-csv" value="csv">
                                <label class="form-check-label">CSV</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Salvar em arquivo (opcional)</h5>
                    <div class="input-group">
                        <input type="text" id="report-output-path" class="form-control" placeholder="Caminho para salvar (deixe vazio para visualizar)">
                        <button class="btn btn-outline-secondary" id="btn-report-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-generate-report"><i class="bi bi-play-fill"></i> Gerar Relatório</button>

            <div class="progress mt-2"><div class="progress-bar" id="report-progress" style="width:0%"></div></div>

            <div id="report-result" style="display:none;" class="mt-3">
                <label class="fw-bold text-success">Resultado</label>
                <div id="report-content" class="border rounded p-2" style="max-height:400px; overflow:auto; font-family:monospace; font-size:0.85rem; white-space:pre-wrap;"></div>
            </div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG</label>
                <div class="log-area" id="report-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-report-dir').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('report-dir');
        });

        container.querySelector('#btn-report-output').addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                const formatRadio = document.querySelector('input[name="report-format"]:checked');
                const ext = formatRadio ? formatRadio.value : 'txt';
                const filters = [{ name: ext.toUpperCase(), extensions: [ext] }];
                window.electronAPI.showSaveDialog({ filters })
                    .then(result => {
                        if (!result.canceled && result.filePath) {
                            document.getElementById('report-output-path').value = result.filePath;
                        }
                    });
            }
        });

        container.querySelector('#btn-generate-report').addEventListener('click', () => this.generateReport());
    }

    async generateReport() {
        const dir = document.getElementById('report-dir').value.trim();
        if (!dir) {
            FileUtils.log('Selecione uma pasta.', 'report-log');
            return;
        }

        const recursive = document.getElementById('report-recursive').checked;
        const includeFiles = document.getElementById('report-include-files').checked;
        const formatRadio = document.querySelector('input[name="report-format"]:checked');
        const format = formatRadio ? formatRadio.value : 'txt';
        const outputPath = document.getElementById('report-output-path').value.trim() || undefined;

        const btn = document.getElementById('btn-generate-report');
        btn.disabled = true;
        FileUtils.clearLog('report-log');
        FileUtils.log('Gerando relatório...', 'report-log');

        try {
            const result = await window.API.file.generateReport({
                dir,
                recursive,
                include_files: includeFiles,
                format,
                output_path: outputPath
            });

            if (result.saved_path) {
                FileUtils.log(`Relatório salvo em: ${result.saved_path}`, 'report-log');
            } else {
                const contentDiv = document.getElementById('report-result');
                contentDiv.style.display = 'block';
                document.getElementById('report-content').textContent = result.content;
                FileUtils.log('Relatório gerado com sucesso.', 'report-log');
            }
            document.getElementById('report-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'report-log');
        } finally {
            btn.disabled = false;
        }
    }
}