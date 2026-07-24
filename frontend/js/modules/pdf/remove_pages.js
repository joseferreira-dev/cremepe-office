class PDFRemovePagesFeature {
    constructor() {
        this.saveRemoved = false;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Remover Páginas</h4>
                <p class="text-muted">Remova páginas específicas do PDF. O arquivo original será mantido, e um novo arquivo será gerado sem as páginas removidas.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="remove-pages-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-remove-pages-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Páginas a remover</h5>
                    <div class="mb-2">
                        <label class="form-label">Selecione as páginas</label>
                        <input type="text" id="remove-pages-selection" class="form-control" placeholder="Ex: 1,3,5 ou 1-10 ou 1,3-5,10">
                        <small class="text-muted">Use vírgula para separar, hífen para intervalos. Ex: 1,3-5,10</small>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de saída (sem as páginas removidas)</h5>
                    <div class="input-group">
                        <input type="text" id="remove-pages-output" class="form-control" placeholder="Caminho do arquivo final">
                        <button class="btn btn-outline-secondary" id="btn-remove-pages-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="remove-pages-save-removed">
                        <label class="form-check-label">Salvar páginas removidas em um arquivo separado</label>
                    </div>
                    <div id="remove-pages-removed-group" style="display:none;" class="mt-2">
                        <label class="form-label">Arquivo das páginas removidas</label>
                        <div class="input-group">
                            <input type="text" id="remove-pages-removed-output" class="form-control" placeholder="Caminho para salvar as páginas removidas">
                            <button class="btn btn-outline-secondary" id="btn-remove-pages-removed-output">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-remove-pages-execute"><i class="bi bi-play-fill me-1"></i>Remover Páginas</button>

            <div class="progress mt-2"><div class="progress-bar" id="remove-pages-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="remove-pages-log">Log de operações vazio</div>
            </div>
        `;

        // Evento para mostrar/ocultar campo do arquivo de removidas
        document.getElementById('remove-pages-save-removed').addEventListener('change', (e) => {
            const group = document.getElementById('remove-pages-removed-group');
            group.style.display = e.target.checked ? 'block' : 'none';
        });

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-remove-pages-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('remove-pages-input').value = result.filePaths[0];
                        // Sugerir nome de saída
                        this.suggestOutputs();
                    }
                });
            }
        });

        document.getElementById('btn-remove-pages-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('remove-pages-output').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-remove-pages-removed-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('remove-pages-removed-output').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-remove-pages-execute').addEventListener('click', () => this.executeRemove());
    }

    suggestOutputs() {
        const input = document.getElementById('remove-pages-input').value;
        if (input) {
            const base = input.replace(/\.[^.]+$/, '');
            const output = document.getElementById('remove-pages-output');
            if (!output.value) {
                output.value = `${base}_sem_paginas.pdf`;
            }
            const removed = document.getElementById('remove-pages-removed-output');
            if (!removed.value) {
                removed.value = `${base}_paginas_removidas.pdf`;
            }
        }
    }

    async executeRemove() {
        const inputFile = document.getElementById('remove-pages-input').value.trim();
        const outputFile = document.getElementById('remove-pages-output').value.trim();
        const pagesSelection = document.getElementById('remove-pages-selection').value.trim();
        const saveRemoved = document.getElementById('remove-pages-save-removed').checked;
        const removedOutput = document.getElementById('remove-pages-removed-output').value.trim() || undefined;

        if (!inputFile || !outputFile) {
            FileUtils.log('Selecione o PDF de entrada e defina o arquivo de saída.', 'remove-pages-log');
            return;
        }

        if (!pagesSelection) {
            FileUtils.log('Informe as páginas a remover.', 'remove-pages-log');
            return;
        }

        const btn = document.getElementById('btn-remove-pages-execute');
        btn.disabled = true;
        FileUtils.clearLog('remove-pages-log');
        FileUtils.log(`Removendo páginas: ${pagesSelection}...`, 'remove-pages-log');

        try {
            const result = await window.API.pdf.removePages({
                pdf_path: inputFile,
                output_path: outputFile,
                pages_to_remove_str: pagesSelection,
                save_removed: saveRemoved,
                removed_output_path: removedOutput
            });

            const { total_pages, remaining_pages, removed_pages, output_file, removed_file, errors } = result;
            FileUtils.log(`Concluído! Total: ${total_pages} páginas, Removidas: ${removed_pages}, Restantes: ${remaining_pages}`, 'remove-pages-log');
            FileUtils.log(`Arquivo sem páginas: ${output_file}`, 'remove-pages-log');
            if (removed_file) {
                FileUtils.log(`Páginas removidas salvas em: ${removed_file}`, 'remove-pages-log');
            }
            if (errors.length) {
                FileUtils.log(`Erros: ${errors.length}`, 'remove-pages-log');
                errors.forEach(e => FileUtils.log(`  ${e}`, 'remove-pages-log'));
            }
            document.getElementById('remove-pages-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'remove-pages-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.PDFRemovePagesFeature = PDFRemovePagesFeature;