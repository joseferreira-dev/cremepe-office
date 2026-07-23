class ExcelMergeAllFeature {
    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal"><i class="bi bi-files me-2"></i>Juntar Tudo em Um</h4>
                <p class="text-muted">Consolide todos os arquivos XLSX de uma pasta em um único arquivo mestre.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Pastas</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta de origem (com os arquivos .xlsx)</label>
                        <div class="input-group">
                            <input type="text" id="merge-source-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-merge-source">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Arquivo de destino (.xlsx)</label>
                        <div class="input-group">
                            <input type="text" id="merge-dest-file" class="form-control" placeholder="Caminho do arquivo de saída...">
                            <button class="btn btn-outline-secondary" id="btn-merge-dest">Salvar como</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções</h5>
                    <div class="mb-2">
                        <label class="form-label">Modo de mesclagem</label>
                        <select id="merge-mode" class="form-select">
                            <option value="sheets">Cada arquivo em uma aba separada</option>
                            <option value="stack">Empilhar todas as linhas em uma única aba</option>
                        </select>
                    </div>
                    <div id="merge-header-option" class="mb-2">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="merge-include-header" checked>
                            <label class="form-check-label">Incluir cabeçalho (apenas do primeiro arquivo)</label>
                        </div>
                        <small class="text-muted">Se desmarcado, todas as linhas (incluindo cabeçalhos) serão tratadas como dados.</small>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="merge-recursive">
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-merge-all"><i class="bi bi-play-fill"></i> Mesclar</button>

            <div class="progress mt-2"><div class="progress-bar" id="merge-all-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="merge-all-log">Log de operações vazio</div>
            </div>
        `;

        // Mostrar/ocultar opção de cabeçalho conforme modo
        document.getElementById('merge-mode').addEventListener('change', (e) => {
            const showHeader = e.target.value === 'stack';
            document.getElementById('merge-header-option').style.display = showHeader ? 'block' : 'none';
        });
        // Inicializar estado
        document.getElementById('merge-header-option').style.display =
            document.getElementById('merge-mode').value === 'stack' ? 'block' : 'none';

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-merge-source').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('merge-source-dir');
        });

        document.getElementById('btn-merge-dest').addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('merge-dest-file').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-merge-all').addEventListener('click', () => this.mergeAll());
    }

    async mergeAll() {
        const sourceDir = document.getElementById('merge-source-dir').value.trim();
        const destFile = document.getElementById('merge-dest-file').value.trim();
        const mode = document.getElementById('merge-mode').value;
        const includeHeader = document.getElementById('merge-include-header').checked;
        const recursive = document.getElementById('merge-recursive').checked;

        if (!sourceDir || !destFile) {
            FileUtils.log('Selecione a pasta de origem e o arquivo de destino.', 'merge-all-log');
            return;
        }

        // Verifica se o destino está dentro da origem (para evitar recursão infinita)
        const normalizedSource = sourceDir.replace(/\\/g, '/');
        const normalizedDest = destFile.replace(/\\/g, '/');
        const destDir = normalizedDest.substring(0, normalizedDest.lastIndexOf('/'));
        if (destDir === normalizedSource) {
            FileUtils.log('O arquivo de destino não pode estar dentro da pasta de origem.', 'merge-all-log');
            return;
        }

        const btn = document.getElementById('btn-merge-all');
        btn.disabled = true;
        FileUtils.clearLog('merge-all-log');
        FileUtils.log(`Iniciando mesclagem (modo: ${mode})...`, 'merge-all-log');

        try {
            const result = await window.API.excel.mergeAll({
                source_dir: sourceDir,
                dest_file: destFile,
                mode: mode,
                include_header: includeHeader,
                recursive: recursive
            });

            const { processed, total_rows, total_sheets, errors } = result;
            if (mode === 'sheets') {
                FileUtils.log(`Concluído! ${processed} arquivos processados, ${total_sheets} abas criadas.`, 'merge-all-log');
            } else {
                FileUtils.log(`Concluído! ${processed} arquivos processados, ${total_rows} linhas consolidadas.`, 'merge-all-log');
            }
            if (errors.length) {
                FileUtils.log(`Erros: ${errors.length}`, 'merge-all-log');
                errors.forEach(e => FileUtils.log(`  ${e}`, 'merge-all-log'));
            }
            document.getElementById('merge-all-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'merge-all-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.ExcelMergeAllFeature = ExcelMergeAllFeature;