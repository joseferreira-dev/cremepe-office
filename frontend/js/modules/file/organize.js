import { API } from '../../api.js';
import { Feature } from '../feature.js';
import { FileUtils } from './utils.js';

export class OrganizeFeature extends Feature {
    constructor(module) {
        super('organize');
        this.module = module;
        this.previewData = null;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Organizar por Extensão</h4>
                <p class="text-muted">Mova arquivos para subpastas com base em sua extensão (ex: .pdf → PDF/). Arquivos ocultos são ignorados.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Diretório</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="organize-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-organize-dir">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="organize-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="organize-copy">
                        <label class="form-check-label">Copiar (manter arquivos originais)</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="organize-move-others">
                        <label class="form-check-label">Mover arquivos sem extensão para pasta OUTROS</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="organize-delete-empty">
                        <label class="form-check-label">Excluir pastas vazias (após mover)</label>
                    </div>
                    <div class="mt-2">
                        <label class="form-label">Em caso de conflito (arquivo já existe na pasta destino)</label>
                        <select id="organize-conflict" class="form-select">
                            <option value="skip">Pular</option>
                            <option value="overwrite">Sobrescrever</option>
                            <option value="rename">Renomear automaticamente</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="d-flex gap-2 mb-3">
                <button class="btn btn-outline-success" id="btn-organize-preview"><i class="bi bi-eye"></i> Pré-visualizar</button>
                <button class="btn btn-success" id="btn-organize"><i class="bi bi-play-fill"></i> Organizar</button>
            </div>

            <div id="organize-preview-area" style="display:none;">
                <label class="fw-bold text-success">Pré-visualização</label>
                <div id="organize-preview-list" class="border rounded p-2" style="max-height:300px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-organize-dir').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('organize-dir');
        });

        container.querySelector('#btn-organize-preview').addEventListener('click', () => this.previewOrganize());
        container.querySelector('#btn-organize').addEventListener('click', () => this.executeOrganize());
    }

    async previewOrganize() {
        const dir = document.getElementById('organize-dir').value.trim();
        if (!dir) {
            this.log('Selecione uma pasta.');
            return;
        }

        const recursive = document.getElementById('organize-recursive').checked;
        const moveOthers = document.getElementById('organize-move-others').checked;

        const btn = document.getElementById('btn-organize-preview');
        btn.disabled = true;
        this.clearLog();
        this.log('Carregando pré-visualização...');

        try {
            const result = await API.file.organizePreview({
                dir,
                recursive,
                move_others: moveOthers
            });
            this.previewData = result.preview;
            const previewArea = document.getElementById('organize-preview-area');
            previewArea.style.display = 'block';
            const listDiv = document.getElementById('organize-preview-list');
            if (this.previewData.length === 0) {
                listDiv.innerHTML = '<p class="text-muted">Nenhum arquivo encontrado.</p>';
            } else {
                let html = '';
                let total = 0;
                this.previewData.forEach(group => {
                    total += group.count;
                    html += `
                        <div class="mb-2">
                            <strong>${group.folder}/ (${group.count} arquivos)</strong>
                            <ul class="list-unstyled ms-3">
                                ${group.files.map(f => `<li><i class="bi bi-file-earmark"></i> ${f}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                });
                listDiv.innerHTML = html;
                this.log(`Pré-visualização: ${total} arquivos serão organizados em ${this.previewData.length} pastas.`);
            }
        } catch (err) {
            this.log(`Erro na pré-visualização: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }

    async executeOrganize() {
        const dir = document.getElementById('organize-dir').value.trim();
        if (!dir) {
            this.log('Selecione uma pasta.');
            return;
        }

        const recursive = document.getElementById('organize-recursive').checked;
        const copy = document.getElementById('organize-copy').checked;
        const moveOthers = document.getElementById('organize-move-others').checked;
        const deleteEmpty = document.getElementById('organize-delete-empty').checked;
        const onConflict = document.getElementById('organize-conflict').value;

        const btn = document.getElementById('btn-organize');
        btn.disabled = true;
        this.clearLog();
        this.log(`Organizando arquivos em ${dir}...`);

        try {
            const result = await API.file.organize({
                dir,
                recursive,
                copy,
                on_conflict: onConflict,
                move_others: moveOthers,
                delete_empty_folders: deleteEmpty
            });
            this.log(`Concluído! ${result.processed_count} arquivos organizados.`);
            this.setProgress(100);
            document.getElementById('organize-preview-area').style.display = 'none';
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}