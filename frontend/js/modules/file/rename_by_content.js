class RenameByContentFeature {
    constructor(module) {
        this.module = module;
        this.previewData = null;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Renomear por Conteúdo</h4>
                <p class="text-muted">Renomeie arquivos com base em metadados EXIF (imagens), ID3 (áudio) ou primeira linha (textos). Arquivos ocultos são ignorados.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Diretório</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="rename-content-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-rename-content-dir">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções</h5>
                    <div class="mb-2">
                        <label class="form-label">Padrão de renomeação</label>
                        <select id="rename-content-pattern" class="form-select">
                            <option value="auto">Automático (data para fotos, artista para músicas, primeira linha para textos)</option>
                            <option value="date">Data (apenas imagens)</option>
                            <option value="artist">Artista + Título (apenas áudio)</option>
                            <option value="line">Primeira linha (apenas textos)</option>
                        </select>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="rename-content-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                </div>
            </div>

            <div class="d-flex gap-2 mb-3">
                <button class="btn btn-outline-success" id="btn-rename-content-preview"><i class="bi bi-eye"></i> Pré-visualizar</button>
                <button class="btn btn-success" id="btn-rename-content"><i class="bi bi-play-fill"></i> Renomear</button>
            </div>

            <div id="rename-content-preview-area" style="display:none;">
                <label class="fw-bold text-success">Pré-visualização</label>
                <div id="rename-content-preview-list" class="border rounded p-2" style="max-height:300px; overflow:auto; font-size:0.9rem;">
                    <table class="table table-sm table-striped mb-0">
                        <thead><tr><th>Original</th><th>Novo nome</th><th>Status</th></tr></thead>
                        <tbody id="rename-content-preview-tbody"></tbody>
                    </table>
                </div>
                <div class="mt-2">
                    <span class="badge bg-success">Renomeados: <span id="preview-renamed-count">0</span></span>
                    <span class="badge bg-warning">Ignorados: <span id="preview-skipped-count">0</span></span>
                    <span class="badge bg-danger">Erros: <span id="preview-errors-count">0</span></span>
                </div>
            </div>

            <div class="progress mt-2"><div class="progress-bar" id="rename-content-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="rename-content-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-rename-content-dir').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('rename-content-dir');
        });

        container.querySelector('#btn-rename-content-preview').addEventListener('click', () => this.previewRename());
        container.querySelector('#btn-rename-content').addEventListener('click', () => this.executeRename());
    }

    async previewRename() {
        const dir = document.getElementById('rename-content-dir').value.trim();
        if (!dir) {
            FileUtils.log('Selecione uma pasta.', 'rename-content-log');
            return;
        }

        const recursive = document.getElementById('rename-content-recursive').checked;
        const pattern = document.getElementById('rename-content-pattern').value;

        const btn = document.getElementById('btn-rename-content-preview');
        btn.disabled = true;
        FileUtils.clearLog('rename-content-log');
        FileUtils.log('Carregando pré-visualização...', 'rename-content-log');

        try {
            const result = await window.API.file.renameByContentPreview({
                dir,
                recursive,
                pattern
            });
            this.previewData = result;
            const previewArea = document.getElementById('rename-content-preview-area');
            previewArea.style.display = 'block';
            const tbody = document.getElementById('rename-content-preview-tbody');
            const renamed = result.renamed || [];
            const skipped = result.skipped || [];
            const errors = result.errors || [];
            document.getElementById('preview-renamed-count').textContent = renamed.length;
            document.getElementById('preview-skipped-count').textContent = skipped.length;
            document.getElementById('preview-errors-count').textContent = errors.length;

            let html = '';
            renamed.forEach(item => {
                html += `<tr><td>${item.original}</td><td><strong>${item.new}</strong></td><td class="text-success">✓</td></tr>`;
            });
            skipped.forEach(item => {
                const reason = item.reason || 'Desconhecido';
                html += `<tr><td>${item.path}</td><td>—</td><td class="text-warning">Ignorado: ${reason}</td></tr>`;
            });
            errors.forEach(item => {
                html += `<tr><td>${item.file}</td><td>—</td><td class="text-danger">${item.error}</td></tr>`;
            });
            if (html === '') {
                html = '<tr><td colspan="3" class="text-muted">Nenhum arquivo processado.</td></tr>';
            }
            tbody.innerHTML = html;
            FileUtils.log(`Pré-visualização: ${renamed.length} arquivos serão renomeados.`, 'rename-content-log');
        } catch (err) {
            FileUtils.log(`Erro na pré-visualização: ${err.message}`, 'rename-content-log');
        } finally {
            btn.disabled = false;
        }
    }

    async executeRename() {
        const dir = document.getElementById('rename-content-dir').value.trim();
        if (!dir) {
            FileUtils.log('Selecione uma pasta.', 'rename-content-log');
            return;
        }

        const recursive = document.getElementById('rename-content-recursive').checked;
        const pattern = document.getElementById('rename-content-pattern').value;

        const btn = document.getElementById('btn-rename-content');
        btn.disabled = true;
        FileUtils.clearLog('rename-content-log');
        FileUtils.log(`Renomeando arquivos em ${dir}...`, 'rename-content-log');

        try {
            const result = await window.API.file.renameByContent({
                dir,
                recursive,
                pattern
            });
            FileUtils.log(`Concluído! ${result.renamed.length} arquivos renomeados, ${result.skipped.length} ignorados, ${result.errors.length} erros.`, 'rename-content-log');
            document.getElementById('rename-content-progress').style.width = '100%';
            document.getElementById('rename-content-preview-area').style.display = 'none';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'rename-content-log');
        } finally {
            btn.disabled = false;
        }
    }
}