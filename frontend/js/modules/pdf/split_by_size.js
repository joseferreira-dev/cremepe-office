class PDFSplitBySizeFeature extends Feature {
    constructor() {
        super('split-size');
    }

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

            ${this.progressHTML()}

            ${this.logHTML()}
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
            this.log('Selecione o PDF e a pasta de destino.');
            return;
        }

        if (isNaN(maxSize) || maxSize <= 0) {
            this.log('Informe um tamanho máximo válido.');
            return;
        }

        const btn = document.getElementById('btn-split-size-execute');
        btn.disabled = true;
        this.clearLog();
        this.log(`Iniciando divisão por tamanho (máx: ${maxSize} MB)...`);

        try {
            const result = await window.API.pdf.splitBySize({
                pdf_path: inputFile,
                output_dir: outputDir,
                max_size_mb: maxSize,
                prefix: prefix
            });

            const { total_pages, total_files, output_files, errors } = result;
            this.log(`Concluído! ${total_files} arquivos gerados a partir de ${total_pages} páginas.`);
            output_files.forEach(f => this.log(`  ${f}`));
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

window.PDFSplitBySizeFeature = PDFSplitBySizeFeature;