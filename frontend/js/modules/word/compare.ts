import { API } from '../../api.js';
import { Feature } from '../feature.js';
import type { DomainModule } from '../domain.js';

export class DocCompareFeature extends Feature {
    module!: DomainModule;
    result!: any;
    constructor(module: DomainModule) {
        super('compare');
        this.module = module;
        this.result = null;
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Comparar Documentos</h4>
                <p class="text-zinc-500">Compare dois documentos Word e veja as diferenças.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Documento 1 (base)</h5>
                    <div class="input-group">
                        <input type="text" id="compare-doc1" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-compare-doc1">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Documento 2 (comparação)</h5>
                    <div class="input-group">
                        <input type="text" id="compare-doc2" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-compare-doc2">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-compare"><i data-lucide="play"></i> Comparar</button>

            ${this.progressHTML()}

            <div id="compare-result" style="display:none;" class="mt-4">
                <div class="grid grid-cols-12 gap-2 mb-2">
                    <div class="col-span-4"><span class="badge bg-rose-600">Removidos: <span id="removed-count">0</span></span></div>
                    <div class="col-span-4"><span class="badge bg-brand-600">Adicionados: <span id="added-count">0</span></span></div>
                    <div class="col-span-4"><span class="badge bg-amber-100">Modificados: <span id="modified-count">0</span></span></div>
                </div>
                <div id="compare-details" style="max-height:400px; overflow:auto; border:1px solid #dee2e6; border-radius:0.375rem; padding:8px; font-size:0.9rem;">
                    <!-- Detalhes serão preenchidos -->
                </div>
            </div>

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container: HTMLElement) {
        container.querySelector('#btn-compare-doc1')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Word', extensions: ['docx', 'doc'] }]
                }).then(result => {
                    if (!result.canceled) {
                        (document.getElementById('compare-doc1') as DomElement).value = result.filePaths[0];
                    }
                });
            }
        });

        container.querySelector('#btn-compare-doc2')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Word', extensions: ['docx', 'doc'] }]
                }).then(result => {
                    if (!result.canceled) {
                        (document.getElementById('compare-doc2') as DomElement).value = result.filePaths[0];
                    }
                });
            }
        });

        container.querySelector('#btn-compare')!.addEventListener('click', () => this.compareDocuments());
    }

    async compareDocuments() {
        const doc1 = (document.getElementById('compare-doc1') as DomElement).value.trim();
        const doc2 = (document.getElementById('compare-doc2') as DomElement).value.trim();

        if (!doc1 || !doc2) {
            this.log('Selecione ambos os documentos.');
            return;
        }

        const btn = document.getElementById('btn-compare')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Comparando documentos...');

        try {
            const result = await API.word.compare({
                doc1_path: doc1,
                doc2_path: doc2
            });

            document.getElementById('removed-count')!.textContent = result.summary.removed;
            document.getElementById('added-count')!.textContent = result.summary.added;
            document.getElementById('modified-count')!.textContent = result.summary.modified;

            const detailsDiv = document.getElementById('compare-details')!;
            let html = '';
            result.differences.forEach((diff: any, idx: number) => {
                if (diff.type === 'removed') {
                    html += `<div class="border-b py-1"><span class="badge bg-rose-600 me-2">Removido</span><span style="background:#ffcccc;">${diff.text}</span></div>`;
                } else if (diff.type === 'added') {
                    html += `<div class="border-b py-1"><span class="badge bg-brand-600 me-2">Adicionado</span><span style="background:#ccffcc;">${diff.text}</span></div>`;
                } else if (diff.type === 'modified') {
                    html += `<div class="border-b py-1"><span class="badge bg-amber-100 me-2">Modificado</span><span style="background:#ffffcc;">${diff.old_text}</span> → <span style="background:#ccffcc;">${diff.new_text}</span></div>`;
                }
            });
            if (!html) {
                html = '<p class="text-zinc-500">Nenhuma diferença encontrada.</p>';
            }
            detailsDiv.innerHTML = html;

            document.getElementById('compare-result')!.style.display = 'block';
            this.log('Comparação concluída.');
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}