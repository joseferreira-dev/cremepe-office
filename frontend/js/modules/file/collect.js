class CollectFeature {
    constructor(module) {
        this.module = module;
        this.srcDirs = [''];
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Coletar Arquivos</h4>
                <p class="text-muted">Reúna arquivos de múltiplas pastas em um destino.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Diretórios de Origem</h5>
                    <div id="src-dirs-container">
                        <!-- Campos dinâmicos -->
                    </div>
                    <button class="btn btn-outline-success btn-sm mt-2" id="add-src-dir">
                        <i class="bi bi-plus-circle"></i> Adicionar Origem
                    </button>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Destino</h5>
                    <div class="input-group">
                        <input type="text" id="dst-dir" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-dst">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções</h5>
                    <div class="row g-2">
                        <div class="col-md-4">
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="recursive" checked> <label class="form-check-label">Recursivo (incluir subpastas)</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="copy-files"> <label class="form-check-label">Copiar (manter arquivos originais)</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="preserve-structure"> <label class="form-check-label">Preservar estrutura de pastas original</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="include-hidden"> <label class="form-check-label">Incluir arquivos ocultos</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="delete-empty"> <label class="form-check-label">Excluir pastas vazias (após mover)</label></div>
                        </div>
                        <div class="col-md-8">
                            <div class="mb-2">
                                <label class="form-label">Extensões (separadas por vírgula, ex: .pdf,.docx)</label>
                                <input type="text" id="extensions" class="form-control" placeholder="Deixe vazio para todas">
                            </div>
                            <div class="mb-2">
                                <label class="form-label">Coletar arquivos modificados nos últimos (dias)</label>
                                <input type="number" id="days-back" class="form-control" value="" placeholder="Ex: 7" min="1">
                            </div>
                            <div>
                                <label class="form-label">Em caso de conflito (nomes iguais)</label>
                                <select id="on-conflict" class="form-select">
                                    <option value="skip">Pular</option>
                                    <option value="overwrite">Sobrescrever</option>
                                    <option value="rename">Renomear automaticamente</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="d-flex gap-2 mb-3">
                <button class="btn btn-outline-success" id="btn-preview"><i class="bi bi-eye"></i> Pré-visualizar</button>
                <button class="btn btn-success" id="btn-collect"><i class="bi bi-play-fill"></i> Coletar Arquivos</button>
            </div>

            <div id="preview-area" style="display:none;">
                <label class="fw-bold text-success">Pré-visualização (<span id="preview-count">0</span> arquivos)</label>
                <div id="preview-list" class="border rounded p-2" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            <div class="progress mt-2"><div class="progress-bar" id="collect-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="collect-log">Log de operações vazio</div>
            </div>
        `;

        this.renderSrcDirs(container);
        this.attachEvents(container);
    }

    renderSrcDirs(container) {
        const containerDiv = container.querySelector('#src-dirs-container');
        containerDiv.innerHTML = this.srcDirs.map((val, idx) => `
            <div class="input-group mb-1">
                <input type="text" class="form-control src-dir-input" data-idx="${idx}" value="${val}" placeholder="Selecione a pasta de origem...">
                <button class="btn btn-outline-secondary btn-src-select" data-idx="${idx}">Selecionar</button>
                ${this.srcDirs.length > 1 ? `<button class="btn btn-outline-danger btn-src-remove" data-idx="${idx}"><i class="bi bi-x"></i></button>` : ''}
            </div>
        `).join('');
    }

    attachEvents(container) {
        // Adicionar origem
        container.querySelector('#add-src-dir').addEventListener('click', () => {
            this.srcDirs.push('');
            this.renderSrcDirs(container);
        });

        // Selecionar destino
        container.querySelector('#btn-dst').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('dst-dir');
        });

        // Pré-visualizar
        container.querySelector('#btn-preview').addEventListener('click', () => this.previewFiles());

        // Coletar
        container.querySelector('#btn-collect').addEventListener('click', () => this.executeCollect());

        // Delegação para os botões de seleção e remoção das origens
        container.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('btn-src-select')) {
                e.stopPropagation();
                const idx = target.dataset.idx;
                this.selectDirectoryForSrc(idx, container);
            }
            if (target.classList.contains('btn-src-remove')) {
                e.stopPropagation();
                const idx = parseInt(target.dataset.idx);
                this.srcDirs.splice(idx, 1);
                this.renderSrcDirs(container);
            }
        });

        // Atualizar valor dos inputs de origem
        container.addEventListener('input', (e) => {
            if (e.target.classList.contains('src-dir-input')) {
                const idx = parseInt(e.target.dataset.idx);
                this.srcDirs[idx] = e.target.value;
            }
        });
    }

    selectDirectoryForSrc(idx, container) {
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            window.electronAPI.showOpenDialog({ properties: ['openDirectory'] })
                .then(result => {
                    if (!result.canceled && result.filePaths.length > 0) {
                        this.srcDirs[idx] = result.filePaths[0];
                        this.renderSrcDirs(container);
                    }
                });
        } else {
            alert('Selecione a pasta manualmente.');
        }
    }

    async previewFiles() {
        const srcDirs = this.srcDirs.filter(s => s.trim() !== '');
        if (!srcDirs.length) {
            FileUtils.log('Adicione pelo menos uma origem.', 'collect-log');
            return;
        }
        const recursive = document.getElementById('recursive').checked;
        const extensions = document.getElementById('extensions').value.trim();
        const includeHidden = document.getElementById('include-hidden').checked;
        const daysBack = document.getElementById('days-back').value.trim();

        const btn = document.getElementById('btn-preview');
        btn.disabled = true;
        FileUtils.clearLog('collect-log');
        FileUtils.log('Carregando pré-visualização...', 'collect-log');

        try {
            const params = {
                src_dirs: srcDirs,
                recursive,
                include_hidden: includeHidden,
            };
            if (extensions) params.extensions = extensions;
            if (daysBack) params.days_back = parseInt(daysBack);

            const result = await window.API.file.preview(params);
            this.module.previewData = result.files;
            const previewArea = document.getElementById('preview-area');
            previewArea.style.display = 'block';
            document.getElementById('preview-count').textContent = result.count;
            const listDiv = document.getElementById('preview-list');
            if (result.count === 0) {
                listDiv.innerHTML = '<p class="text-muted">Nenhum arquivo corresponde aos filtros.</p>';
            } else {
                listDiv.innerHTML = result.files.map(f => `
                    <div><i class="bi bi-file-earmark me-1"></i> ${f.relative} (${(f.size / 1024).toFixed(1)} KB)</div>
                `).join('');
            }
            FileUtils.log(`Pré-visualização: ${result.count} arquivos encontrados.`, 'collect-log');
        } catch (err) {
            FileUtils.log(`Erro na pré-visualização: ${err.message}`, 'collect-log');
        } finally {
            btn.disabled = false;
        }
    }

    async executeCollect() {
        const srcDirs = this.srcDirs.filter(s => s.trim() !== '');
        const dst = document.getElementById('dst-dir').value.trim();
        if (!srcDirs.length || !dst) {
            FileUtils.log('Erro: Adicione pelo menos uma origem e um destino.', 'collect-log');
            return;
        }

        for (let s of srcDirs) {
            if (s === dst) {
                FileUtils.log('Erro: Uma origem não pode ser igual ao destino.', 'collect-log');
                return;
            }
        }

        const recursive = document.getElementById('recursive').checked;
        const copy = document.getElementById('copy-files').checked;
        const preserveStructure = document.getElementById('preserve-structure').checked;
        const includeHidden = document.getElementById('include-hidden').checked;
        const deleteEmpty = document.getElementById('delete-empty').checked;
        const extensions = document.getElementById('extensions').value.trim();
        const daysBack = document.getElementById('days-back').value.trim();
        const onConflict = document.getElementById('on-conflict').value;

        const btn = document.getElementById('btn-collect');
        btn.disabled = true;
        FileUtils.clearLog('collect-log');
        FileUtils.log('Iniciando coleta...', 'collect-log');

        try {
            const params = {
                src_dirs: srcDirs,
                dst_dir: dst,
                recursive,
                copy,
                preserve_structure: preserveStructure,
                include_hidden: includeHidden,
                delete_empty_dirs: deleteEmpty,
                on_conflict: onConflict,
            };
            if (extensions) params.extensions = extensions;
            if (daysBack) params.days_back = parseInt(daysBack);

            const result = await window.API.file.collect(params);
            FileUtils.log(`Concluído! ${result.processed_count} arquivos coletados.`, 'collect-log');
            document.getElementById('collect-progress').style.width = '100%';
            document.getElementById('preview-area').style.display = 'none';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'collect-log');
        } finally {
            btn.disabled = false;
        }
    }
}