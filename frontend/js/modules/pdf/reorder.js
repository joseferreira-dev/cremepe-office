class PDFReorderFeature {
    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal"><i class="bi bi-arrow-up-down me-2"></i>Reordenar Páginas</h4>
                <p class="text-muted">Defina a nova ordem das páginas do PDF. Você pode especificar páginas individuais ou intervalos.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="reorder-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-reorder-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Nova ordem das páginas</h5>
                    <div class="mb-2">
                        <label class="form-label">Digite a nova ordem</label>
                        <input type="text" id="reorder-order" class="form-control" placeholder="Ex: 5,1,3,2,4 ou 1-3,5,4">
                        <small class="text-muted">Use vírgula para separar, hífen para intervalos. Ex: 5,1,3,2,4 (reorganiza as 5 páginas na ordem 5,1,3,2,4). Todas as páginas devem ser incluídas exatamente uma vez.</small>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="reorder-output" class="form-control" placeholder="Caminho do arquivo reordenado">
                        <button class="btn btn-outline-secondary" id="btn-reorder-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-reorder-execute"><i class="bi bi-play-fill me-1"></i>Reordenar</button>

            <div class="progress mt-2"><div class="progress-bar" id="reorder-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="reorder-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-reorder-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('reorder-input').value = result.filePaths[0];
                        this.suggestOutput();
                    }
                });
            }
        });

        document.getElementById('btn-reorder-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('reorder-output').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-reorder-execute').addEventListener('click', () => this.executeReorder());
    }

    suggestOutput() {
        const input = document.getElementById('reorder-input').value;
        if (input) {
            const base = input.replace(/\.[^.]+$/, '');
            const output = document.getElementById('reorder-output');
            if (!output.value) {
                output.value = `${base}_reordenado.pdf`;
            }
        }
    }

    async executeReorder() {
        const inputFile = document.getElementById('reorder-input').value.trim();
        const outputFile = document.getElementById('reorder-output').value.trim();
        const orderStr = document.getElementById('reorder-order').value.trim();

        if (!inputFile || !outputFile) {
            FileUtils.log('Selecione o PDF de entrada e defina o arquivo de saída.', 'reorder-log');
            return;
        }

        if (!orderStr) {
            FileUtils.log('Defina a nova ordem das páginas.', 'reorder-log');
            return;
        }

        const btn = document.getElementById('btn-reorder-execute');
        btn.disabled = true;
        FileUtils.clearLog('reorder-log');
        FileUtils.log(`Reordenando páginas: ${orderStr}...`, 'reorder-log');

        try {
            const result = await window.API.pdf.reorderPages({
                pdf_path: inputFile,
                output_path: outputFile,
                new_order_str: orderStr
            });

            const { total_pages, output_file, errors } = result;
            FileUtils.log(`Concluído! PDF reordenado salvo em: ${output_file}`, 'reorder-log');
            FileUtils.log(`Total de páginas: ${total_pages}`, 'reorder-log');
            if (errors.length) {
                FileUtils.log(`Erros: ${errors.length}`, 'reorder-log');
                errors.forEach(e => FileUtils.log(`  ${e}`, 'reorder-log'));
            }
            document.getElementById('reorder-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'reorder-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.PDFReorderFeature = PDFReorderFeature;