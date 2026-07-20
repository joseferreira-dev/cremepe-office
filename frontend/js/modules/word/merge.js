class MergeFeature {
    constructor(module) {
        this.module = module;
        this.docxPaths = [];
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Juntar Documentos</h4>
                <p class="text-muted">Combine vários documentos DOC ou DOCX em um único arquivo, mantendo formatação, imagens e quebras de página.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Documentos para juntar</h5>
                    <div class="mb-2">
                        <label class="form-label">Selecione arquivos Word</label>
                        <div class="input-group">
                            <input type="text" id="merge-docx-list" class="form-control" placeholder="Caminhos separados por vírgula">
                            <button class="btn btn-outline-secondary" id="btn-add-docx">Adicionar</button>
                        </div>
                    </div>
                    <div id="docx-list" style="max-height:150px; overflow:auto; font-size:0.9rem;"></div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="merge-output" class="form-control" placeholder="Caminho para salvar o documento final">
                        <button class="btn btn-outline-secondary" id="btn-merge-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="merge-page-breaks" checked>
                        <label class="form-check-label">Inserir quebra de página entre documentos</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-merge"><i class="bi bi-play-fill"></i> Juntar</button>

            <div class="progress mt-2"><div class="progress-bar" id="merge-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="merge-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-add-docx').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile', 'multiSelections'],
                    filters: [
                        { name: 'Word', extensions: ['docx', 'doc'] }
                    ]
                })
                    .then(result => {
                        if (!result.canceled) {
                            const current = document.getElementById('merge-docx-list').value;
                            const newPaths = result.filePaths.join(', ');
                            document.getElementById('merge-docx-list').value = current ? current + ', ' + newPaths : newPaths;
                            this.updateDocxList();
                        }
                    });
            }
        });

        container.querySelector('#btn-merge-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [
                        { name: 'Word', extensions: ['docx'] }
                    ]
                })
                    .then(result => {
                        if (!result.canceled && result.filePath) {
                            document.getElementById('merge-output').value = result.filePath;
                        }
                    });
            }
        });

        container.querySelector('#btn-merge').addEventListener('click', () => this.mergeDocuments());
    }

    updateDocxList() {
        const val = document.getElementById('merge-docx-list').value;
        const paths = val.split(',').map(s => s.trim()).filter(Boolean);
        const listDiv = document.getElementById('docx-list');
        if (paths.length === 0) {
            listDiv.innerHTML = '<p class="text-muted">Nenhum documento selecionado.</p>';
        } else {
            listDiv.innerHTML = paths.map(p => `<div><i class="bi bi-file-earmark-word me-1"></i> ${p}</div>`).join('');
        }
    }

    async mergeDocuments() {
        const docxPaths = document.getElementById('merge-docx-list').value.split(',').map(s => s.trim()).filter(Boolean);
        const outputPath = document.getElementById('merge-output').value.trim();
        const insertPageBreaks = document.getElementById('merge-page-breaks').checked;

        if (!docxPaths.length || !outputPath) {
            FileUtils.log('Selecione os documentos e defina o destino.', 'merge-log');
            return;
        }

        const btn = document.getElementById('btn-merge');
        btn.disabled = true;
        FileUtils.clearLog('merge-log');
        FileUtils.log(`Juntando ${docxPaths.length} documentos...`, 'merge-log');

        try {
            const result = await window.API.word.merge({
                docx_paths: docxPaths,
                output_path: outputPath,
                insert_page_breaks: insertPageBreaks
            });
            FileUtils.log(`Documentos juntados em: ${result.output_path}`, 'merge-log');
            document.getElementById('merge-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'merge-log');
        } finally {
            btn.disabled = false;
        }
    }
}