class PDFSplitBySizeFeature {
    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Dividir por Tamanho</h4>
                <p class="text-muted">Divida um PDF em partes com tamanho máximo definido (em MB).</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="split-size-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-split-size-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Pasta de saída</h5>
                    <div class="input-group">
                        <input type="text" id="split-size-output" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-split-size-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Configurações</h5>
                    <div class="row g-2">
                        <div class="col-md-6">
                            <label class="form-label">Tamanho máximo (MB)</label>
                            <input type="number" id="split-size-max" class="form-control" value="5" min="0.1" step="0.1">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Prefixo das partes (opcional)</label>
                            <input type="text" id="split-size-prefix" class="form-control" placeholder="ex: relatorio_">
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-split-size-execute"><i class="bi bi-play-fill me-1"></i>Dividir</button>

            <div class="progress mt-2"><div class="progress-bar" id="split-size-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="split-size-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-split-size-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('split-size-input').value = result.filePaths[0];
                    }
                });
            }
        });

        document.getElementById('btn-split-size-output').addEventListener('click', () => {
            FileUtils.selectDirectory('split-size-output');
        });

        document.getElementById('btn-split-size-execute').addEventListener('click', () => this.executeSplit());
    }

    async executeSplit() {
        const inputFile = document.getElementById('split-size-input').value.trim();
        const outputDir = document.getElementById('split-size-output').value.trim();
        const maxSize = parseFloat(document.getElementById('split-size-max').value);
        const prefix = document.getElementById('split-size-prefix').value.trim();

        if (!inputFile || !outputDir) {
            FileUtils.log('Selecione o PDF e a pasta de destino.', 'split-size-log');
            return;
        }

        if (isNaN(maxSize) || maxSize <= 0) {
            FileUtils.log('Informe um tamanho máximo válido.', 'split-size-log');
            return;
        }

        const btn = document.getElementById('btn-split-size-execute');
        btn.disabled = true;
        FileUtils.clearLog('split-size-log');
        FileUtils.log(`Iniciando divisão por tamanho (máx: ${maxSize} MB)...`, 'split-size-log');

        try {
            const result = await window.API.pdf.splitBySize({
                pdf_path: inputFile,
                output_dir: outputDir,
                max_size_mb: maxSize,
                prefix: prefix
            });

            const { total_pages, total_files, output_files, errors } = result;
            FileUtils.log(`Concluído! ${total_files} arquivos gerados a partir de ${total_pages} páginas.`, 'split-size-log');
            output_files.forEach(f => FileUtils.log(`  ${f}`, 'split-size-log'));
            if (errors.length) {
                FileUtils.log(`Erros: ${errors.length}`, 'split-size-log');
                errors.forEach(e => FileUtils.log(`  ${e}`, 'split-size-log'));
            }
            document.getElementById('split-size-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'split-size-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.PDFSplitBySizeFeature = PDFSplitBySizeFeature;