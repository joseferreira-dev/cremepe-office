class ExcelSplitFeature {
    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Dividir por Coluna</h4>
                <p class="text-muted">Divida um arquivo grande em vários arquivos com base nos valores de uma coluna específica.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="split-input-file" class="form-control" placeholder="Selecione o arquivo XLSX...">
                        <button class="btn btn-outline-secondary" id="btn-split-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Pasta de saída</h5>
                    <div class="input-group">
                        <input type="text" id="split-output-dir" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-split-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Configuração</h5>
                    <div class="mb-2">
                        <label class="form-label">Coluna chave (nome ou índice 0-based)</label>
                        <div class="input-group">
                            <input type="text" id="split-column" class="form-control" placeholder="Ex: 'Estado' ou 0, 1, 2...">
                            <button class="btn btn-outline-secondary" id="btn-split-preview">Visualizar colunas</button>
                        </div>
                        <small class="text-muted">Digite o nome da coluna ou o índice (começando em 0). Ex: "Estado" ou "3".</small>
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

            <button class="btn btn-success" id="btn-split-execute"><i class="bi bi-play-fill"></i> Dividir</button>

            <div class="progress mt-2"><div class="progress-bar" id="split-progress" style="width:0%"></div></div>

            <div id="split-preview-area" style="display:none;" class="mt-3">
                <label class="fw-bold text-success">Pré-visualização</label>
                <div id="split-preview-list" class="border rounded p-2" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="split-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-split-input').addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('split-input-file').value = result.filePaths[0];
                    }
                });
            }
        });

        document.getElementById('btn-split-output').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('split-output-dir');
        });

        document.getElementById('btn-split-preview').addEventListener('click', () => this.previewColumns());

        document.getElementById('btn-split-execute').addEventListener('click', () => this.executeSplit());
    }

    async previewColumns() {
        const inputFile = document.getElementById('split-input-file').value.trim();
        if (!inputFile) {
            FileUtils.log('Selecione o arquivo de entrada.', 'split-log');
            return;
        }

        const btn = document.getElementById('btn-split-preview');
        btn.disabled = true;
        FileUtils.clearLog('split-log');
        FileUtils.log('Carregando cabeçalhos...', 'split-log');

        try {
            // Usamos a rota existente de leitura (read) para obter cabeçalhos
            const result = await window.API.excel.read({ file_path: inputFile });
            if (!result.data || result.data.length === 0) {
                FileUtils.log('Arquivo sem dados.', 'split-log');
                return;
            }
            const headers = Object.keys(result.data[0]);
            const previewArea = document.getElementById('split-preview-area');
            previewArea.style.display = 'block';
            const listDiv = document.getElementById('split-preview-list');
            listDiv.innerHTML = `
                <strong>Colunas disponíveis (${headers.length}):</strong><br>
                ${headers.map((h, i) => `<span class="badge bg-secondary me-1">${i}: ${h}</span>`).join('')}
                <br><small class="text-muted">Use o nome ou o índice para a coluna chave.</small>
            `;
            FileUtils.log('Cabeçalhos carregados.', 'split-log');
        } catch (err) {
            FileUtils.log(`Erro ao ler arquivo: ${err.message}`, 'split-log');
        } finally {
            btn.disabled = false;
        }
    }

    async executeSplit() {
        const inputFile = document.getElementById('split-input-file').value.trim();
        const outputDir = document.getElementById('split-output-dir').value.trim();
        const column = document.getElementById('split-column').value.trim();
        const format = document.getElementById('split-format').value;
        const includeHeader = document.getElementById('split-include-header').checked;

        if (!inputFile || !outputDir || !column) {
            FileUtils.log('Preencha todos os campos.', 'split-log');
            return;
        }

        // Se column for número, converter para int
        let columnParam = column;
        if (!isNaN(column) && column.trim() !== '') {
            columnParam = parseInt(column, 10);
        }

        const btn = document.getElementById('btn-split-execute');
        btn.disabled = true;
        FileUtils.clearLog('split-log');
        FileUtils.log(`Dividindo por coluna "${column}"...`, 'split-log');

        try {
            const result = await window.API.excel.splitByColumn({
                input_file: inputFile,
                output_dir: outputDir,
                column: columnParam,
                output_format: format,
                include_header: includeHeader
            });

            const { total_rows, total_groups, output_files, errors } = result;
            FileUtils.log(`Concluído! ${total_rows} linhas divididas em ${total_groups} arquivos.`, 'split-log');
            if (errors.length) {
                FileUtils.log(`Erros: ${errors.length}`, 'split-log');
                errors.forEach(e => FileUtils.log(`  ${e}`, 'split-log'));
            }
            if (output_files.length) {
                FileUtils.log(`Arquivos gerados:\n${output_files.join('\n')}`, 'split-log');
            }
            document.getElementById('split-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'split-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.ExcelSplitFeature = ExcelSplitFeature;