import { API } from '../../api.js';
import { Feature } from '../feature.js';

export class MergeFeature extends Feature {
    constructor(module) {
        super('merge');
        this.module = module;
        this.docxPaths = [];
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Juntar Documentos</h4>
                <p class="text-zinc-500">Combine vários documentos DOC ou DOCX em um único arquivo, mantendo formatação, imagens e quebras de página.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Documentos para juntar</h5>
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

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="merge-output" class="form-control" placeholder="Caminho para salvar o documento final">
                        <button class="btn btn-outline-secondary" id="btn-merge-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Opções</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="merge-page-breaks" checked>
                        <label class="form-check-label">Inserir quebra de página entre documentos</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-merge"><i data-lucide="play"></i> Juntar</button>

            ${this.progressHTML()}

            ${this.logHTML()}
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
            listDiv.innerHTML = '<p class="text-zinc-500">Nenhum documento selecionado.</p>';
        } else {
            listDiv.innerHTML = paths.map(p => `<div><i data-lucide="file-pen" class="me-1"></i> ${p}</div>`).join('');
        }
    }

    async mergeDocuments() {
        const docxPaths = document.getElementById('merge-docx-list').value.split(',').map(s => s.trim()).filter(Boolean);
        const outputPath = document.getElementById('merge-output').value.trim();
        const insertPageBreaks = document.getElementById('merge-page-breaks').checked;

        if (!docxPaths.length || !outputPath) {
            this.log('Selecione os documentos e defina o destino.');
            return;
        }

        const btn = document.getElementById('btn-merge');
        btn.disabled = true;
        this.clearLog();
        this.log(`Juntando ${docxPaths.length} documentos...`);

        try {
            const result = await API.word.merge({
                docx_paths: docxPaths,
                output_path: outputPath,
                insert_page_breaks: insertPageBreaks
            });
            this.log(`Documentos juntados em: ${result.output_path}`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}