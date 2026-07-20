class ArchiveFeature {
    constructor(module) {
        this.module = module;
        this.mode = 'compress'; // 'compress' | 'extract'
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Compactar / Extrair</h4>
                <p class="text-muted">Crie arquivos ZIP com opções avançadas ou extraia arquivos compactados.</p>
            </div>

            <!-- Tabs -->
            <ul class="nav nav-tabs mb-3" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" data-mode="compress" id="tab-compress">Compactar (ZIP)</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" data-mode="extract" id="tab-extract">Extrair</button>
                </li>
            </ul>

            <!-- Conteúdo Compactar -->
            <div id="archive-compress-content">
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Arquivos/Pastas para compactar</h5>
                        <div class="mb-2">
                            <label class="form-label">Selecione arquivos ou pastas</label>
                            <div class="input-group">
                                <input type="text" id="archive-sources" class="form-control" placeholder="Caminhos separados por vírgula">
                                <button class="btn btn-outline-secondary" id="btn-add-files">Adicionar Arquivos</button>
                                <button class="btn btn-outline-secondary" id="btn-add-folder">Adicionar Pasta</button>
                            </div>
                        </div>
                        <div id="source-list" style="max-height:100px; overflow:auto; font-size:0.9rem;"></div>
                    </div>
                </div>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Destino</h5>
                        <div class="input-group">
                            <input type="text" id="archive-output" class="form-control" placeholder="Caminho do arquivo ZIP">
                            <button class="btn btn-outline-secondary" id="btn-output">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Opções de Compactação</h5>
                        <div class="row g-2">
                            <div class="col-md-6">
                                <label class="form-label">Nível de compressão</label>
                                <input type="range" id="compression-level" class="form-range" min="0" max="9" value="6">
                                <span id="level-label">6</span>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Método</label>
                                <select id="compression-method" class="form-select">
                                    <option value="deflate">DEFLATE</option>
                                    <option value="bzip2">BZIP2</option>
                                    <option value="lzma">LZMA</option>
                                    <option value="store">STORED (sem compressão)</option>
                                </select>
                            </div>
                        </div>
                        <div class="row g-2 mt-2">
                            <div class="col-md-6">
                                <label class="form-label">Senha (opcional)</label>
                                <input type="password" id="archive-password" class="form-control" placeholder="Deixe vazio para sem senha">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Padrões de inclusão (ex: *.pdf,*.docx)</label>
                                <input type="text" id="include-patterns" class="form-control" placeholder="Separados por vírgula">
                            </div>
                        </div>
                        <div class="row g-2 mt-2">
                            <div class="col-md-6">
                                <label class="form-label">Padrões de exclusão (ex: *.tmp,*.log)</label>
                                <input type="text" id="exclude-patterns" class="form-control" placeholder="Separados por vírgula">
                            </div>
                            <div class="col-md-6">
                                <div class="form-check mt-2">
                                    <input class="form-check-input" type="checkbox" id="exclude-hidden">
                                    <label class="form-check-label">Excluir arquivos ocultos</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="archive-recursive" checked>
                                    <label class="form-check-label">Incluir subpastas</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-compress"><i class="bi bi-play-fill"></i> Compactar</button>
            </div>

            <!-- Conteúdo Extrair -->
            <div id="archive-extract-content" style="display:none;">
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Arquivo para extrair</h5>
                        <div class="input-group">
                            <input type="text" id="extract-archive" class="form-control" placeholder="Selecione o arquivo compactado...">
                            <button class="btn btn-outline-secondary" id="btn-extract-archive">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Destino da extração</h5>
                        <div class="input-group">
                            <input type="text" id="extract-dir" class="form-control" placeholder="Selecione a pasta de destino...">
                            <button class="btn btn-outline-secondary" id="btn-extract-dir">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Senha (opcional)</h5>
                        <input type="password" id="extract-password" class="form-control" placeholder="Deixe vazio se não houver senha">
                    </div>
                </div>

                <button class="btn btn-success" id="btn-extract"><i class="bi bi-play-fill"></i> Extrair</button>
            </div>

            <div class="progress mt-2"><div class="progress-bar" id="archive-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG</label>
                <div class="log-area" id="archive-log">Log de operações vazio</div>
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
                document.getElementById('archive-compress-content').style.display = (mode === 'compress') ? 'block' : 'none';
                document.getElementById('archive-extract-content').style.display = (mode === 'extract') ? 'block' : 'none';
            });
        });

        // Selecionar arquivos/pastas para compactar
        container.querySelector('#btn-add-files').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
                    .then(result => {
                        if (!result.canceled) {
                            const current = document.getElementById('archive-sources').value;
                            const newPaths = result.filePaths.join(', ');
                            document.getElementById('archive-sources').value = current ? current + ', ' + newPaths : newPaths;
                            this.updateSourceList();
                        }
                    });
            }
        });

        container.querySelector('#btn-add-folder').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openDirectory'] })
                    .then(result => {
                        if (!result.canceled) {
                            const current = document.getElementById('archive-sources').value;
                            const newPath = result.filePaths[0];
                            document.getElementById('archive-sources').value = current ? current + ', ' + newPath : newPath;
                            this.updateSourceList();
                        }
                    });
            }
        });

        // Selecionar destino
        container.querySelector('#btn-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({ filters: [{ name: 'ZIP', extensions: ['zip'] }] })
                    .then(result => {
                        if (!result.canceled && result.filePath) {
                            document.getElementById('archive-output').value = result.filePath;
                        }
                    });
            }
        });

        // Selecionar arquivo para extrair
        container.querySelector('#btn-extract-archive').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Arquivos compactados', extensions: ['zip', '7z', 'rar', 'tar', 'gz', 'tgz'] }] })
                    .then(result => {
                        if (!result.canceled) document.getElementById('extract-archive').value = result.filePaths[0];
                    });
            }
        });

        container.querySelector('#btn-extract-dir').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openDirectory'] })
                    .then(result => {
                        if (!result.canceled) document.getElementById('extract-dir').value = result.filePaths[0];
                    });
            }
        });

        // Nível de compressão
        container.querySelector('#compression-level').addEventListener('input', (e) => {
            document.getElementById('level-label').textContent = e.target.value;
        });

        // Botões
        container.querySelector('#btn-compress').addEventListener('click', () => this.compress());
        container.querySelector('#btn-extract').addEventListener('click', () => this.extract());
    }

    updateSourceList() {
        const val = document.getElementById('archive-sources').value;
        const paths = val.split(',').map(s => s.trim()).filter(Boolean);
        const listDiv = document.getElementById('source-list');
        if (paths.length === 0) {
            listDiv.innerHTML = '<p class="text-muted">Nenhum arquivo/pasta selecionado.</p>';
        } else {
            listDiv.innerHTML = paths.map(p => `<div><i class="bi bi-file-earmark me-1"></i> ${p}</div>`).join('');
        }
    }

    async compress() {
        const sources = document.getElementById('archive-sources').value.split(',').map(s => s.trim()).filter(Boolean);
        const output = document.getElementById('archive-output').value.trim();
        if (!sources.length || !output) {
            FileUtils.log('Selecione os arquivos/pastas e defina o destino.', 'archive-log');
            return;
        }

        const password = document.getElementById('archive-password').value.trim() || undefined;
        const level = parseInt(document.getElementById('compression-level').value);
        const method = document.getElementById('compression-method').value;
        const recursive = document.getElementById('archive-recursive').checked;
        const excludeHidden = document.getElementById('exclude-hidden').checked;
        const includePatterns = document.getElementById('include-patterns').value.trim() || undefined;
        const excludePatterns = document.getElementById('exclude-patterns').value.trim() || undefined;

        const btn = document.getElementById('btn-compress');
        btn.disabled = true;
        FileUtils.clearLog('archive-log');
        FileUtils.log('Compactando...', 'archive-log');

        try {
            const result = await window.API.file.compress({
                source_paths: sources,
                output_path: output,
                password,
                compression_level: level,
                compression_method: method,
                recursive,
                exclude_hidden: excludeHidden,
                include_patterns: includePatterns ? includePatterns.split(',').map(s => s.trim()) : undefined,
                exclude_patterns: excludePatterns ? excludePatterns.split(',').map(s => s.trim()) : undefined
            });
            FileUtils.log(`Compactação concluída: ${result.output_path}`, 'archive-log');
            document.getElementById('archive-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'archive-log');
        } finally {
            btn.disabled = false;
        }
    }

    async extract() {
        const archivePath = document.getElementById('extract-archive').value.trim();
        const extractDir = document.getElementById('extract-dir').value.trim();
        if (!archivePath || !extractDir) {
            FileUtils.log('Selecione o arquivo e o destino.', 'archive-log');
            return;
        }

        const password = document.getElementById('extract-password').value.trim() || undefined;

        const btn = document.getElementById('btn-extract');
        btn.disabled = true;
        FileUtils.clearLog('archive-log');
        FileUtils.log('Extraindo...', 'archive-log');

        try {
            const result = await window.API.file.extract({
                archive_path: archivePath,
                extract_dir: extractDir,
                password
            });
            FileUtils.log(`Extraído para: ${result.extract_dir}`, 'archive-log');
            document.getElementById('archive-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'archive-log');
        } finally {
            btn.disabled = false;
        }
    }
}