import { API } from '../../api.js';
import { Feature } from '../feature.js';
import { FileUtils } from './utils.js';

export class DuplicatesFeature extends Feature {
    constructor(module) {
        super('duplicates');
        this.module = module;
        this.groups = [];
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-brand-600 font-normal">Localizar Duplicatas</h4>
                <p class="text-slate-500">Encontre e remova arquivos duplicados em uma pasta.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title text-brand-600">Diretório</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="duplicates-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-duplicates-dir">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Comparar por</label>
                        <select id="duplicates-match" class="form-select">
                            <option value="hash">Hash MD5 (conteúdo)</option>
                            <option value="name">Nome do arquivo</option>
                        </select>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="duplicates-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="duplicates-hidden">
                        <label class="form-check-label">Incluir arquivos ocultos</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-find-duplicates">Procurar Duplicatas</button>

            <div id="duplicates-result" style="display:none;" class="mt-4">
                <label class="font-bold text-brand-600">Resultado (<span id="duplicates-count">0</span> grupos)</label>
                <div id="duplicates-list" class="border rounded p-2 border-slate-200" style="max-height:300px; overflow:auto; font-size:0.9rem;"></div>
                <div class="mt-2">
                    <label class="form-label">Ação para duplicatas (manter o primeiro)</label>
                    <select id="duplicates-action" class="form-select">
                        <option value="delete">Excluir</option>
                        <option value="move">Mover para pasta</option>
                    </select>
                    <div id="duplicates-destination-row" style="display:none;" class="mt-2">
                        <label class="form-label">Pasta de destino</label>
                        <div class="input-group">
                            <input type="text" id="duplicates-destination" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-duplicates-dest">Selecionar</button>
                        </div>
                    </div>
                </div>
                <button class="btn btn-danger mt-2" id="btn-remove-duplicates">Aplicar Ação</button>
            </div>

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-duplicates-dir').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('duplicates-dir');
        });
        container.querySelector('#btn-duplicates-dest').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('duplicates-destination');
        });
        container.querySelector('#duplicates-action').addEventListener('change', (e) => {
            container.querySelector('#duplicates-destination-row').style.display = (e.target.value === 'move') ? 'block' : 'none';
        });
        container.querySelector('#btn-find-duplicates').addEventListener('click', () => this.findDuplicates());
        container.querySelector('#btn-remove-duplicates').addEventListener('click', () => this.removeDuplicates());
    }

    async findDuplicates() {
        const dir = document.getElementById('duplicates-dir').value.trim();
        if (!dir) {
            this.log('Selecione uma pasta.');
            return;
        }
        const recursive = document.getElementById('duplicates-recursive').checked;
        const matchBy = document.getElementById('duplicates-match').value;
        const includeHidden = document.getElementById('duplicates-hidden').checked;

        this.clearLog();
        this.log('Procurando duplicatas...');
        try {
            const result = await API.file.findDuplicates({
                dir,
                recursive,
                match_by: matchBy,
                include_hidden: includeHidden
            });
            this.groups = result.groups;
            const resultDiv = document.getElementById('duplicates-result');
            resultDiv.style.display = 'block';
            document.getElementById('duplicates-count').textContent = result.total_groups;
            const listDiv = document.getElementById('duplicates-list');
            if (result.total_groups === 0) {
                listDiv.innerHTML = '<p class="text-slate-500">Nenhuma duplicata encontrada.</p>';
            } else {
                listDiv.innerHTML = result.groups.map((g, idx) => `
                    <div class="mb-2">
                        <strong>Grupo ${idx + 1} (${g.count} arquivos)</strong>
                        <ul class="list-none ms-4">
                            ${g.files.map(f => `<li><i data-lucide="file"></i> ${f}</li>`).join('')}
                        </ul>
                    </div>
                `).join('');
            }
            this.log(`Encontrados ${result.total_groups} grupos de duplicatas.`);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        }
    }

    async removeDuplicates() {
        if (!this.groups || this.groups.length === 0) {
            this.log('Nenhum grupo para processar.');
            return;
        }
        const action = document.getElementById('duplicates-action').value;
        let destination = null;
        if (action === 'move') {
            destination = document.getElementById('duplicates-destination').value.trim();
            if (!destination) {
                this.log('Selecione a pasta de destino.');
                return;
            }
        }
        if (!confirm(`Tem certeza que deseja ${action === 'delete' ? 'excluir' : 'mover'} os arquivos duplicados?`)) return;

        const btn = document.getElementById('btn-remove-duplicates');
        btn.disabled = true;
        this.log(`Aplicando ação (${action})...`);
        try {
            const result = await API.file.removeDuplicates({
                groups: this.groups.map(g => g.files),
                action,
                destination
            });
            this.log(`Concluído! ${result.removed_count} arquivos ${action === 'delete' ? 'excluídos' : 'movidos'}.`);
            document.getElementById('duplicates-result').style.display = 'none';
            this.groups = [];
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}