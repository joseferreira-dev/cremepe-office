import { API } from '../../api.js';
import { Feature } from '../feature.js';

export class DocCompareFeature extends Feature {
    constructor(module) {
        super('compare');
        this.module = module;
        this.result = null;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Comparar Documentos</h4>
                <p class="text-muted">Compare dois documentos Word e veja as diferenças.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Documento 1 (base)</h5>
                    <div class="input-group">
                        <input type="text" id="compare-doc1" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-compare-doc1">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Documento 2 (comparação)</h5>
                    <div class="input-group">
                        <input type="text" id="compare-doc2" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-compare-doc2">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-compare"><i class="bi bi-play-fill"></i> Comparar</button>

            ${this.progressHTML()}

            <div id="compare-result" style="display:none;" class="mt-3">
                <div class="row g-2 mb-2">
                    <div class="col-4"><span class="badge bg-danger">Removidos: <span id="removed-count">0</span></span></div>
                    <div class="col-4"><span class="badge bg-success">Adicionados: <span id="added-count">0</span></span></div>
                    <div class="col-4"><span class="badge bg-warning">Modificados: <span id="modified-count">0</span></span></div>
                </div>
                <div id="compare-details" style="max-height:400px; overflow:auto; border:1px solid #dee2e6; border-radius:0.375rem; padding:8px; font-size:0.9rem;">
                    <!-- Detalhes serão preenchidos -->
                </div>
            </div>

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-compare-doc1').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Word', extensions: ['docx', 'doc'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('compare-doc1').value = result.filePaths[0];
                    }
                });
            }
        });

        container.querySelector('#btn-compare-doc2').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Word', extensions: ['docx', 'doc'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('compare-doc2').value = result.filePaths[0];
                    }
                });
            }
        });

        container.querySelector('#btn-compare').addEventListener('click', () => this.compareDocuments());
    }

    async compareDocuments() {
        const doc1 = document.getElementById('compare-doc1').value.trim();
        const doc2 = document.getElementById('compare-doc2').value.trim();

        if (!doc1 || !doc2) {
            this.log('Selecione ambos os documentos.');
            return;
        }

        const btn = document.getElementById('btn-compare');
        btn.disabled = true;
        this.clearLog();
        this.log('Comparando documentos...');

        try {
            const result = await API.word.compare({
                doc1_path: doc1,
                doc2_path: doc2
            });

            document.getElementById('removed-count').textContent = result.summary.removed;
            document.getElementById('added-count').textContent = result.summary.added;
            document.getElementById('modified-count').textContent = result.summary.modified;

            const detailsDiv = document.getElementById('compare-details');
            let html = '';
            result.differences.forEach((diff, idx) => {
                if (diff.type === 'removed') {
                    html += `<div class="border-bottom py-1"><span class="badge bg-danger me-2">Removido</span><span style="background:#ffcccc;">${diff.text}</span></div>`;
                } else if (diff.type === 'added') {
                    html += `<div class="border-bottom py-1"><span class="badge bg-success me-2">Adicionado</span><span style="background:#ccffcc;">${diff.text}</span></div>`;
                } else if (diff.type === 'modified') {
                    html += `<div class="border-bottom py-1"><span class="badge bg-warning me-2">Modificado</span><span style="background:#ffffcc;">${diff.old_text}</span> → <span style="background:#ccffcc;">${diff.new_text}</span></div>`;
                }
            });
            if (!html) {
                html = '<p class="text-muted">Nenhuma diferença encontrada.</p>';
            }
            detailsDiv.innerHTML = html;

            document.getElementById('compare-result').style.display = 'block';
            this.log('Comparação concluída.');
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}