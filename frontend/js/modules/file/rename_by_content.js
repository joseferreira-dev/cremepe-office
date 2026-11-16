import { API } from '../../api.js';
import { Feature } from '../feature.js';
import { FileUtils } from './utils.js';

export class RenameByContentFeature extends Feature {
    constructor(module) {
        super('rename-content');
        this.module = module;
        this.previewData = null;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-brand-600 font-normal">Renomear por Conteúdo</h4>
                <p class="text-slate-500">Renomeie arquivos com base em metadados EXIF (imagens), ID3 (áudio) ou primeira linha (textos). Arquivos ocultos são ignorados.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title text-brand-600">Diretório</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="rename-content-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-rename-content-dir">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title text-brand-600">Opções</h5>
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

            <div class="flex gap-2 mb-4">
                <button class="btn btn-outline-success" id="btn-rename-content-preview"><i data-lucide="eye"></i> Pré-visualizar</button>
                <button class="btn btn-success" id="btn-rename-content"><i data-lucide="play"></i> Renomear</button>
            </div>

            <div id="rename-content-preview-area" style="display:none;">
                <label class="font-bold text-brand-600">Pré-visualização</label>
                <div id="rename-content-preview-list" class="border rounded p-2 border-slate-200" style="max-height:300px; overflow:auto; font-size:0.9rem;">
                    <table class="table table-sm table-striped mb-0">
                        <thead><tr><th>Original</th><th>Novo nome</th><th>Status</th></tr></thead>
                        <tbody id="rename-content-preview-tbody"></tbody>
                    </table>
                </div>
                <div class="mt-2">
                    <span class="badge bg-brand-600">Renomeados: <span id="preview-renamed-count">0</span></span>
                    <span class="badge bg-amber-100">Ignorados: <span id="preview-skipped-count">0</span></span>
                    <span class="badge bg-rose-600">Erros: <span id="preview-errors-count">0</span></span>
                </div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
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
            this.log('Selecione uma pasta.');
            return;
        }

        const recursive = document.getElementById('rename-content-recursive').checked;
        const pattern = document.getElementById('rename-content-pattern').value;

        const btn = document.getElementById('btn-rename-content-preview');
        btn.disabled = true;
        this.clearLog();
        this.log('Carregando pré-visualização...');

        try {
            const result = await API.file.renameByContentPreview({
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
                html += `<tr><td>${item.original}</td><td><strong>${item.new}</strong></td><td class="text-brand-600">✓</td></tr>`;
            });
            skipped.forEach(item => {
                const reason = item.reason || 'Desconhecido';
                html += `<tr><td>${item.path}</td><td>—</td><td class="text-amber-600">Ignorado: ${reason}</td></tr>`;
            });
            errors.forEach(item => {
                html += `<tr><td>${item.file}</td><td>—</td><td class="text-rose-600">${item.error}</td></tr>`;
            });
            if (html === '') {
                html = '<tr><td colspan="3" class="text-slate-500">Nenhum arquivo processado.</td></tr>';
            }
            tbody.innerHTML = html;
            this.log(`Pré-visualização: ${renamed.length} arquivos serão renomeados.`);
        } catch (err) {
            this.log(`Erro na pré-visualização: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }

    async executeRename() {
        const dir = document.getElementById('rename-content-dir').value.trim();
        if (!dir) {
            this.log('Selecione uma pasta.');
            return;
        }

        const recursive = document.getElementById('rename-content-recursive').checked;
        const pattern = document.getElementById('rename-content-pattern').value;

        const btn = document.getElementById('btn-rename-content');
        btn.disabled = true;
        this.clearLog();
        this.log(`Renomeando arquivos em ${dir}...`);

        try {
            const result = await API.file.renameByContent({
                dir,
                recursive,
                pattern
            });
            this.log(`Concluído! ${result.renamed.length} arquivos renomeados, ${result.skipped.length} ignorados, ${result.errors.length} erros.`);
            this.setProgress(100);
            document.getElementById('rename-content-preview-area').style.display = 'none';
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}