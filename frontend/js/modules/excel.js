class ExcelModule {
    constructor(container) {
        this.container = container;
        this.currentFeature = 'merge';
        this.features = [
            { id: 'merge', label: 'Mesclar Planilhas', render: this.renderMerge.bind(this) },
            { id: 'read', label: 'Ler Planilha', render: this.renderRead.bind(this) },
            { id: 'write', label: 'Escrever Dados', render: this.renderWrite.bind(this) },
        ];
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h2 class="module-title"><i class="bi bi-file-earmark-excel me-2"></i>Planilhas</h2>
                <div class="d-flex gap-3" style="height: calc(100% - 60px);">
                    <div class="module-sidebar flex-shrink-0" style="width: 240px;">
                        <h3>Funcionalidades</h3>
                        <ul class="feature-list">
                            ${this.features.map(f => `<li data-feature="${f.id}" class="${f.id === this.currentFeature ? 'active' : ''}">${f.label}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="flex-grow-1 overflow-auto" id="feature-content"></div>
                </div>
            </div>
        `;
        this.container.querySelectorAll('.feature-list li').forEach(item => {
            item.addEventListener('click', () => {
                const feature = item.dataset.feature;
                this.selectFeature(feature);
            });
        });
        this.renderCurrentFeature();
    }

    selectFeature(featureId) {
        this.currentFeature = featureId;
        this.container.querySelectorAll('.feature-list li').forEach(li => {
            li.classList.toggle('active', li.dataset.feature === featureId);
        });
        this.renderCurrentFeature();
    }

    renderCurrentFeature() {
        const feature = this.features.find(f => f.id === this.currentFeature);
        if (feature) feature.render();
    }

    renderMerge() {
        const content = document.getElementById('feature-content');
        content.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal"><i class="bi bi-arrow-left-right me-2"></i>Mesclar Planilhas</h4>
                <p class="text-muted">Combine várias planilhas Excel em uma única.</p>
            </div>
            <div class="card mb-3">
                <div class="card-body">
                    <div class="mb-2">
                        <label class="form-label">Arquivos</label>
                        <div class="input-group">
                            <input type="text" id="excel-merge-files" class="form-control" placeholder="Caminhos separados por vírgula">
                            <button class="btn btn-outline-secondary" id="btn-add-excel">Adicionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Salvar como</label>
                        <div class="input-group">
                            <input type="text" id="excel-merge-output" class="form-control" placeholder="Caminho de saída">
                            <button class="btn btn-outline-secondary" id="btn-excel-output">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>
            <button class="btn btn-success" id="btn-merge-excel">Mesclar</button>
            <div class="mt-3">
                <label class="fw-bold text-success">LOG</label>
                <div class="log-area" id="excel-log">Log de operações vazio</div>
            </div>
        `;

        document.getElementById('btn-add-excel').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }] })
                    .then(result => {
                        if (!result.canceled) {
                            const current = document.getElementById('excel-merge-files').value;
                            const newPaths = result.filePaths.join(', ');
                            document.getElementById('excel-merge-files').value = current ? current + ', ' + newPaths : newPaths;
                        }
                    });
            }
        });

        document.getElementById('btn-excel-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({ filters: [{ name: 'Excel', extensions: ['xlsx'] }] })
                    .then(result => {
                        if (!result.canceled && result.filePath) {
                            document.getElementById('excel-merge-output').value = result.filePath;
                        }
                    });
            }
        });

        document.getElementById('btn-merge-excel').addEventListener('click', async () => {
            const files = document.getElementById('excel-merge-files').value.split(',').map(s => s.trim()).filter(Boolean);
            const output = document.getElementById('excel-merge-output').value.trim();
            if (!files.length || !output) {
                this.log('Preencha os arquivos e o caminho de saída.', 'excel-log');
                return;
            }
            try {
                const result = await window.API.excel.merge({ file_paths: files, output_path: output });
                this.log(`Planilhas mescladas: ${result.output_path}`, 'excel-log');
            } catch (err) {
                this.log(`Erro: ${err.message}`, 'excel-log');
            }
        });
    }

    renderRead() {
        const content = document.getElementById('feature-content');
        content.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal"><i class="bi bi-eye me-2"></i>Ler Planilha</h4>
                <p class="text-muted">Visualize o conteúdo de uma planilha Excel.</p>
            </div>
            <div class="card mb-3">
                <div class="card-body">
                    <div class="mb-2">
                        <label class="form-label">Arquivo</label>
                        <div class="input-group">
                            <input type="text" id="excel-read-file" class="form-control" placeholder="Caminho do arquivo">
                            <button class="btn btn-outline-secondary" id="btn-read-select">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Nome da planilha (ou índice)</label>
                        <input type="text" id="excel-sheet-name" class="form-control" value="0" style="width:200px;">
                    </div>
                </div>
            </div>
            <button class="btn btn-success" id="btn-read-excel">Ler</button>
            <div class="mt-3">
                <label class="fw-bold text-success">LOG</label>
                <div class="log-area" id="read-log">Log de operações vazio</div>
            </div>
            <div class="mt-2">
                <label class="fw-bold text-success">Dados</label>
                <div id="excel-data" class="p-2 border rounded" style="max-height:300px; overflow:auto;"></div>
            </div>
        `;

        document.getElementById('btn-read-select').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }] })
                    .then(result => {
                        if (!result.canceled) document.getElementById('excel-read-file').value = result.filePaths[0];
                    });
            }
        });

        document.getElementById('btn-read-excel').addEventListener('click', async () => {
            const file = document.getElementById('excel-read-file').value.trim();
            const sheet = document.getElementById('excel-sheet-name').value.trim();
            if (!file) {
                this.log('Selecione um arquivo.', 'read-log');
                return;
            }
            try {
                const result = await window.API.excel.read({ file_path: file, sheet_name: isNaN(sheet) ? sheet : parseInt(sheet) });
                const dataDiv = document.getElementById('excel-data');
                if (result.data && result.data.length) {
                    dataDiv.innerHTML = `<pre class="mb-0">${JSON.stringify(result.data, null, 2)}</pre>`;
                } else {
                    dataDiv.innerHTML = '<p class="text-muted">Nenhum dado encontrado.</p>';
                }
                this.log(`Lidos ${result.data.length} registros.`, 'read-log');
            } catch (err) {
                this.log(`Erro: ${err.message}`, 'read-log');
            }
        });
    }

    renderWrite() {
        const content = document.getElementById('feature-content');
        content.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal"><i class="bi bi-pencil me-2"></i>Escrever Dados</h4>
                <p class="text-muted">Crie uma planilha Excel a partir de dados JSON.</p>
            </div>
            <div class="card mb-3">
                <div class="card-body">
                    <div class="mb-2">
                        <label class="form-label">Arquivo de saída</label>
                        <div class="input-group">
                            <input type="text" id="excel-write-file" class="form-control" placeholder="Caminho de saída">
                            <button class="btn btn-outline-secondary" id="btn-write-select">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Nome da planilha</label>
                        <input type="text" id="excel-write-sheet" class="form-control" value="Sheet1" style="width:200px;">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Dados (JSON)</label>
                        <textarea id="excel-write-data" class="form-control" rows="4" placeholder='[{"col1":"valor1","col2":"valor2"}]'></textarea>
                    </div>
                </div>
            </div>
            <button class="btn btn-success" id="btn-write-excel">Escrever</button>
            <div class="mt-3">
                <label class="fw-bold text-success">LOG</label>
                <div class="log-area" id="write-log">Log de operações vazio</div>
            </div>
        `;

        document.getElementById('btn-write-select').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({ filters: [{ name: 'Excel', extensions: ['xlsx'] }] })
                    .then(result => {
                        if (!result.canceled && result.filePath) {
                            document.getElementById('excel-write-file').value = result.filePath;
                        }
                    });
            }
        });

        document.getElementById('btn-write-excel').addEventListener('click', async () => {
            const file = document.getElementById('excel-write-file').value.trim();
            const sheet = document.getElementById('excel-write-sheet').value.trim();
            const dataStr = document.getElementById('excel-write-data').value.trim();
            if (!file || !dataStr) {
                this.log('Preencha o arquivo e os dados.', 'write-log');
                return;
            }
            try {
                const data = JSON.parse(dataStr);
                if (!Array.isArray(data) || data.length === 0) throw new Error('Dados devem ser um array não vazio.');
                const result = await window.API.excel.write({ file_path: file, sheet_name: sheet, data });
                this.log(`Dados escritos em ${result.output_path}`, 'write-log');
            } catch (err) {
                this.log(`Erro: ${err.message}`, 'write-log');
            }
        });
    }

    log(message, logId) {
        const logArea = document.getElementById(logId);
        if (logArea) {
            const p = document.createElement('p');
            p.textContent = message;
            logArea.appendChild(p);
            logArea.scrollTop = logArea.scrollHeight;
        }
    }
}
window.ExcelModule = ExcelModule;