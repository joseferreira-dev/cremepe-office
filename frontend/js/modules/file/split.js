class SplitFeature {
    constructor(module) {
        this.module = module;
        this.mode = 'split'; // 'split' | 'merge'
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Dividir / Remontar Arquivos</h4>
                <p class="text-muted">Divida um arquivo grande em partes menores ou remonte partes em um único arquivo.</p>
            </div>

            <!-- Tabs -->
            <ul class="nav nav-tabs mb-3" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" data-mode="split" id="tab-split">Dividir</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" data-mode="merge" id="tab-merge">Remontar</button>
                </li>
            </ul>

            <!-- Conteúdo Dividir -->
            <div id="split-content">
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Arquivo para dividir</h5>
                        <div class="input-group">
                            <input type="text" id="split-file" class="form-control" placeholder="Selecione o arquivo...">
                            <button class="btn btn-outline-secondary" id="btn-split-file">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Destino</h5>
                        <div class="input-group">
                            <input type="text" id="split-output-dir" class="form-control" placeholder="Pasta para salvar as partes...">
                            <button class="btn btn-outline-secondary" id="btn-split-dir">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Opções</h5>
                        <div class="mb-2">
                            <label class="form-label">Tamanho de cada parte (MB)</label>
                            <input type="number" id="split-size" class="form-control" value="100" min="1" step="1">
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="split-overwrite">
                            <label class="form-check-label">Sobrescrever partes existentes</label>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-split"><i class="bi bi-play-fill"></i> Dividir</button>
            </div>

            <!-- Conteúdo Remontar -->
            <div id="merge-content" style="display:none;">
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Selecione as partes (.partNNNN)</h5>
                        <div class="mb-2">
                            <label class="form-label">Partes</label>
                            <div class="input-group">
                                <input type="text" id="merge-parts" class="form-control" placeholder="Caminhos separados por vírgula ou selecione">
                                <button class="btn btn-outline-secondary" id="btn-merge-parts">Selecionar arquivos</button>
                            </div>
                            <div id="parts-list" style="max-height:100px; overflow:auto; font-size:0.9rem; margin-top:4px;"></div>
                        </div>
                        <div class="mb-2">
                            <label class="form-label">Arquivo de saída</label>
                            <div class="input-group">
                                <input type="text" id="merge-output" class="form-control" placeholder="Caminho para salvar o arquivo remontado...">
                                <button class="btn btn-outline-secondary" id="btn-merge-output">Selecionar</button>
                            </div>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="merge-overwrite">
                            <label class="form-check-label">Sobrescrever se existir</label>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-merge"><i class="bi bi-play-fill"></i> Remontar</button>
            </div>

            <div class="progress mt-2"><div class="progress-bar" id="split-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="split-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        // Tabs
        container.querySelectorAll('.nav-link').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.mode = mode;
                document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('split-content').style.display = (mode === 'split') ? 'block' : 'none';
                document.getElementById('merge-content').style.display = (mode === 'merge') ? 'block' : 'none';
            });
        });

        // Dividir
        container.querySelector('#btn-split-file').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openFile'] })
                    .then(result => {
                        if (!result.canceled) document.getElementById('split-file').value = result.filePaths[0];
                    });
            }
        });
        container.querySelector('#btn-split-dir').addEventListener('click', () => {
            FileUtils.selectDirectory('split-output-dir');
        });
        container.querySelector('#btn-split').addEventListener('click', () => this.splitFile());

        // Remontar
        container.querySelector('#btn-merge-parts').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
                    .then(result => {
                        if (!result.canceled) {
                            const current = document.getElementById('merge-parts').value;
                            const newPaths = result.filePaths.join(', ');
                            document.getElementById('merge-parts').value = current ? current + ', ' + newPaths : newPaths;
                            this.updatePartsList();
                        }
                    });
            }
        });
        container.querySelector('#btn-merge-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({})
                    .then(result => {
                        if (!result.canceled && result.filePath) {
                            document.getElementById('merge-output').value = result.filePath;
                        }
                    });
            }
        });
        container.querySelector('#btn-merge').addEventListener('click', () => this.mergeParts());
    }

    updatePartsList() {
        const val = document.getElementById('merge-parts').value;
        const paths = val.split(',').map(s => s.trim()).filter(Boolean);
        const listDiv = document.getElementById('parts-list');
        if (paths.length === 0) {
            listDiv.innerHTML = '<p class="text-muted">Nenhuma parte selecionada.</p>';
        } else {
            listDiv.innerHTML = paths.map(p => `<div><i class="bi bi-file-earmark me-1"></i> ${p}</div>`).join('');
        }
    }

    async splitFile() {
        const filePath = document.getElementById('split-file').value.trim();
        const outputDir = document.getElementById('split-output-dir').value.trim();
        const partSize = parseInt(document.getElementById('split-size').value) || 100;
        const overwrite = document.getElementById('split-overwrite').checked;

        if (!filePath || !outputDir) {
            FileUtils.log('Preencha o arquivo e o destino.', 'split-log');
            return;
        }

        const btn = document.getElementById('btn-split');
        btn.disabled = true;
        FileUtils.clearLog('split-log');
        FileUtils.log('Dividindo arquivo...', 'split-log');

        try {
            const result = await window.API.file.split({
                file_path: filePath,
                output_dir: outputDir,
                part_size_mb: partSize,
                overwrite
            });
            FileUtils.log(`Dividido em ${result.count} partes:\n${result.parts.join('\n')}`, 'split-log');
            document.getElementById('split-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'split-log');
        } finally {
            btn.disabled = false;
        }
    }

    async mergeParts() {
        const partsInput = document.getElementById('merge-parts').value.trim();
        const partsList = partsInput.split(',').map(s => s.trim()).filter(Boolean);
        const outputPath = document.getElementById('merge-output').value.trim();
        const overwrite = document.getElementById('merge-overwrite').checked;

        if (!partsList.length || !outputPath) {
            FileUtils.log('Selecione as partes e o destino.', 'split-log');
            return;
        }

        const btn = document.getElementById('btn-merge');
        btn.disabled = true;
        FileUtils.clearLog('split-log');
        FileUtils.log('Remontando arquivo...', 'split-log');

        try {
            const result = await window.API.file.merge({
                parts_list: partsList,
                output_path: outputPath,
                overwrite
            });
            FileUtils.log(`Arquivo remontado em: ${result.output_path}`, 'split-log');
            document.getElementById('split-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'split-log');
        } finally {
            btn.disabled = false;
        }
    }
}