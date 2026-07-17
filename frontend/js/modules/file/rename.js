class RenameFeature {
    constructor(module) {
        this.module = module;
        this.renameFilePaths = [];
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Renomear em Lote</h4>
                <p class="text-muted">Renomeie vários arquivos de uma só vez com um padrão personalizado.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Diretório</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="rename-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-rename-dir">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Filtrar por extensão (ex: .pdf,.docx)</label>
                        <input type="text" id="rename-extensions" class="form-control" placeholder="Deixe vazio para todos">
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Padrão de Renomeação</h5>
                    <div class="mb-2">
                        <label class="form-label">Prefixo</label>
                        <input type="text" id="prefix" class="form-control" placeholder="ex: CREME_">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Sufixo</label>
                        <input type="text" id="suffix" class="form-control" placeholder="ex: _2026">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="use-sequential">
                        <label class="form-check-label">Adicionar numeração sequencial (001, 002...)</label>
                    </div>
                    <div class="mt-2" id="start-number-row" style="display:none;">
                        <label class="form-label">Número inicial</label>
                        <input type="number" id="start-number" class="form-control" value="1" min="1" style="width:100px;">
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Substituição (Regex)</h5>
                    <div class="mb-2">
                        <label class="form-label">Presets</label>
                        <select id="regex-preset" class="form-select">
                            <option value="none">Nenhum</option>
                            <option value="remove_spaces">Remover espaços (substituir por _)</option>
                            <option value="remove_accents">Remover acentos</option>
                            <option value="lowercase">Minúsculas</option>
                            <option value="uppercase">Maiúsculas</option>
                            <option value="titlecase">Título</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>
                    <div id="custom-regex-area" style="display:none;">
                        <div class="mb-2">
                            <label class="form-label">Buscar (regex)</label>
                            <input type="text" id="regex-search" class="form-control" placeholder="ex: \s+">
                        </div>
                        <div class="mb-2">
                            <label class="form-label">Substituir por</label>
                            <input type="text" id="regex-replace" class="form-control" placeholder="ex: _">
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="remove-accents">
                        <label class="form-check-label">Remover acentos (adicional)</label>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Substituir espaços por</label>
                        <input type="text" id="replace-spaces" class="form-control" placeholder="ex: _ (deixe vazio para manter)">
                    </div>
                </div>
            </div>

            <div class="d-flex gap-2 mb-3">
                <button class="btn btn-outline-success" id="btn-rename-preview"><i class="bi bi-eye"></i> Pré-visualizar</button>
                <button class="btn btn-success" id="btn-rename"><i class="bi bi-play-fill"></i> Renomear Arquivos</button>
            </div>

            <div id="rename-preview-area" style="display:none;">
                <label class="fw-bold text-success">Pré-visualização (<span id="rename-preview-count">0</span> arquivos)</label>
                <div id="rename-preview-list" class="border rounded p-2" style="max-height:250px; overflow:auto; font-size:0.9rem;">
                    <table class="table table-sm table-striped mb-0">
                        <thead><tr><th>Nome atual</th><th>Novo nome</th></tr></thead>
                        <tbody id="rename-preview-tbody"></tbody>
                    </table>
                </div>
            </div>

            <div class="progress mt-2"><div class="progress-bar" id="rename-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="rename-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        // Selecionar diretório
        container.querySelector('#btn-rename-dir').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('rename-dir');
            // Força o carregamento dos arquivos após selecionar
            this.loadRenameFiles();
        });

        // Carregar arquivos quando o campo for alterado manualmente
        container.querySelector('#rename-dir').addEventListener('change', () => {
            this.loadRenameFiles();
        });

        // Numeração sequencial
        container.querySelector('#use-sequential').addEventListener('change', (e) => {
            container.querySelector('#start-number-row').style.display = e.target.checked ? 'block' : 'none';
        });

        // Presets de regex
        container.querySelector('#regex-preset').addEventListener('change', (e) => {
            const val = e.target.value;
            container.querySelector('#custom-regex-area').style.display = (val === 'custom') ? 'block' : 'none';
            if (val === 'remove_spaces') {
                document.getElementById('regex-search').value = '\\s+';
                document.getElementById('regex-replace').value = '_';
                document.getElementById('replace-spaces').value = '';
                document.getElementById('remove-accents').checked = false;
            } else if (val === 'remove_accents') {
                document.getElementById('regex-search').value = '';
                document.getElementById('regex-replace').value = '';
                document.getElementById('remove-accents').checked = true;
                document.getElementById('replace-spaces').value = '';
            } else if (val === 'lowercase' || val === 'uppercase' || val === 'titlecase' || val === 'none') {
                document.getElementById('regex-search').value = '';
                document.getElementById('regex-replace').value = '';
                document.getElementById('remove-accents').checked = false;
                document.getElementById('replace-spaces').value = '';
            }
        });

        // Botões
        container.querySelector('#btn-rename-preview').addEventListener('click', () => this.previewRename());
        container.querySelector('#btn-rename').addEventListener('click', () => this.executeRename());
    }

    loadRenameFiles() {
        const dir = document.getElementById('rename-dir').value.trim();
        if (!dir) {
            this.renameFilePaths = [];
            FileUtils.log('Nenhum diretório selecionado.', 'rename-log');
            return;
        }
        if (window.API && window.API.file && window.API.file.list) {
            FileUtils.log('Carregando lista de arquivos...', 'rename-log');
            window.API.file.list({ dir })
                .then(result => {
                    this.renameFilePaths = result.files.map(f => `${dir}/${f}`);
                    FileUtils.log(`Arquivos encontrados: ${this.renameFilePaths.length}`, 'rename-log');
                })
                .catch(err => FileUtils.log(`Erro ao listar: ${err.message}`, 'rename-log'));
        }
    }

    async previewRename() {
        const dir = document.getElementById('rename-dir').value.trim();
        if (!dir) {
            FileUtils.log('Selecione uma pasta.', 'rename-log');
            return;
        }
        // Se não tiver carregado, carrega agora
        if (this.renameFilePaths.length === 0) {
            try {
                const result = await window.API.file.list({ dir });
                this.renameFilePaths = result.files.map(f => `${dir}/${f}`);
                if (this.renameFilePaths.length === 0) {
                    FileUtils.log('Nenhum arquivo encontrado.', 'rename-log');
                    return;
                }
            } catch (err) {
                FileUtils.log(`Erro ao listar: ${err.message}`, 'rename-log');
                return;
            }
        }

        const prefix = document.getElementById('prefix').value;
        const suffix = document.getElementById('suffix').value;
        const useSeq = document.getElementById('use-sequential').checked;
        const startNum = parseInt(document.getElementById('start-number').value) || 1;
        const extensions = document.getElementById('rename-extensions').value.trim();
        const regexSearch = document.getElementById('regex-search').value;
        const regexReplace = document.getElementById('regex-replace').value;
        const preset = document.getElementById('regex-preset').value;
        const removeAccents = document.getElementById('remove-accents').checked;
        const replaceSpaces = document.getElementById('replace-spaces').value.trim() || null;

        let caseConversion = 'none';
        if (preset === 'lowercase') caseConversion = 'lower';
        else if (preset === 'uppercase') caseConversion = 'upper';
        else if (preset === 'titlecase') caseConversion = 'title';

        let finalRegex = (preset === 'custom') ? regexSearch : (preset === 'remove_spaces' ? '\\s+' : null);
        let finalReplace = (preset === 'custom') ? regexReplace : (preset === 'remove_spaces' ? '_' : '');

        const params = {
            file_paths: this.renameFilePaths,
            prefix,
            suffix,
            start_number: startNum,
            use_original_name: !useSeq,
            extensions: extensions ? extensions.split(',').map(e => e.trim()) : undefined,
            regex_pattern: finalRegex,
            regex_replacement: finalReplace,
            case_conversion: caseConversion,
            remove_accents: removeAccents,
            replace_spaces_with: replaceSpaces,
        };

        const btn = document.getElementById('btn-rename-preview');
        btn.disabled = true;
        FileUtils.clearLog('rename-log');
        FileUtils.log('Carregando pré-visualização...', 'rename-log');

        try {
            const result = await window.API.file.renamePreview(params);
            const previewArea = document.getElementById('rename-preview-area');
            previewArea.style.display = 'block';
            document.getElementById('rename-preview-count').textContent = result.count;
            const tbody = document.getElementById('rename-preview-tbody');
            if (result.count === 0) {
                tbody.innerHTML = '<tr><td colspan="2" class="text-muted">Nenhum arquivo corresponde aos critérios.</td></tr>';
            } else {
                tbody.innerHTML = result.preview.map(p => `
                    <tr>
                        <td>${p.original}</td>
                        <td><strong>${p.new}</strong></td>
                    </tr>
                `).join('');
            }
            FileUtils.log(`Pré-visualização: ${result.count} arquivos.`, 'rename-log');
        } catch (err) {
            FileUtils.log(`Erro na pré-visualização: ${err.message}`, 'rename-log');
        } finally {
            btn.disabled = false;
        }
    }

    async executeRename() {
        const dir = document.getElementById('rename-dir').value.trim();
        if (!dir) {
            FileUtils.log('Selecione uma pasta.', 'rename-log');
            return;
        }
        if (this.renameFilePaths.length === 0) {
            FileUtils.log('Carregue os arquivos primeiro (selecione a pasta).', 'rename-log');
            return;
        }

        const prefix = document.getElementById('prefix').value;
        const suffix = document.getElementById('suffix').value;
        const useSeq = document.getElementById('use-sequential').checked;
        const startNum = parseInt(document.getElementById('start-number').value) || 1;
        const extensions = document.getElementById('rename-extensions').value.trim();
        const regexSearch = document.getElementById('regex-search').value;
        const regexReplace = document.getElementById('regex-replace').value;
        const preset = document.getElementById('regex-preset').value;
        const removeAccents = document.getElementById('remove-accents').checked;
        const replaceSpaces = document.getElementById('replace-spaces').value.trim() || null;

        let caseConversion = 'none';
        if (preset === 'lowercase') caseConversion = 'lower';
        else if (preset === 'uppercase') caseConversion = 'upper';
        else if (preset === 'titlecase') caseConversion = 'title';

        let finalRegex = (preset === 'custom') ? regexSearch : (preset === 'remove_spaces' ? '\\s+' : null);
        let finalReplace = (preset === 'custom') ? regexReplace : (preset === 'remove_spaces' ? '_' : '');

        const params = {
            file_paths: this.renameFilePaths,
            prefix,
            suffix,
            start_number: startNum,
            use_original_name: !useSeq,
            extensions: extensions ? extensions.split(',').map(e => e.trim()) : undefined,
            regex_pattern: finalRegex,
            regex_replacement: finalReplace,
            case_conversion: caseConversion,
            remove_accents: removeAccents,
            replace_spaces_with: replaceSpaces,
        };

        const btn = document.getElementById('btn-rename');
        btn.disabled = true;
        FileUtils.clearLog('rename-log');
        FileUtils.log(`Renomeando arquivos...`, 'rename-log');

        try {
            const result = await window.API.file.rename(params);
            FileUtils.log(`Concluído! ${result.renamed_count} arquivos renomeados.`, 'rename-log');
            document.getElementById('rename-progress').style.width = '100%';
            document.getElementById('rename-preview-area').style.display = 'none';
            // Recarrega a lista para refletir as alterações
            this.loadRenameFiles();
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'rename-log');
        } finally {
            btn.disabled = false;
        }
    }
}