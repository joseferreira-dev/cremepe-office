import { API } from '../../api.js';
import { Feature } from '../feature.js';
import { FileUtils } from './utils.js';
import type { DomainModule } from '../domain.js';

export class OrganizeFeature extends Feature {
    module!: DomainModule;
    previewData!: any;
    constructor(module: DomainModule) {
        super('organize');
        this.module = module;
        this.previewData = null;
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Organizar por Extensão</h4>
                <p class="text-zinc-500">Mova arquivos para subpastas com base em sua extensão (ex: .pdf → PDF/). Arquivos ocultos são ignorados.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Diretório</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="organize-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-organize-dir">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Opções</h5>
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

            <div class="flex gap-2 mb-4">
                <button class="btn btn-outline-success" id="btn-organize-preview"><i data-lucide="eye"></i> Pré-visualizar</button>
                <button class="btn btn-success" id="btn-organize"><i data-lucide="play"></i> Organizar</button>
            </div>

            <div id="organize-preview-area" style="display:none;">
                <label class="font-semibold text-zinc-600">Pré-visualização</label>
                <div id="organize-preview-list" class="border rounded p-2 border-zinc-200" style="max-height:300px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container: HTMLElement) {
        container.querySelector('#btn-organize-dir')!.addEventListener('click', (e: any) => {
            e.stopPropagation();
            FileUtils.selectDirectory('organize-dir');
        });

        container.querySelector('#btn-organize-preview')!.addEventListener('click', () => this.previewOrganize());
        container.querySelector('#btn-organize')!.addEventListener('click', () => this.executeOrganize());
    }

    async previewOrganize() {
        const dir = (document.getElementById('organize-dir') as DomElement).value.trim();
        if (!dir) {
            this.log('Selecione uma pasta.');
            return;
        }

        const recursive = (document.getElementById('organize-recursive') as DomElement).checked;
        const moveOthers = (document.getElementById('organize-move-others') as DomElement).checked;

        const btn = document.getElementById('btn-organize-preview')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Carregando pré-visualização...');

        try {
            const result = await API.file.organizePreview({
                dir,
                recursive,
                move_others: moveOthers
            });
            this.previewData = result.preview;
            const previewArea = document.getElementById('organize-preview-area')!;
            previewArea.style.display = 'block';
            const listDiv = document.getElementById('organize-preview-list')!;
            if (this.previewData.length === 0) {
                listDiv.innerHTML = '<p class="text-zinc-500">Nenhum arquivo encontrado.</p>';
            } else {
                let html = '';
                let total = 0;
                this.previewData.forEach((group: any) => {
                    total += group.count;
                    html += `
                        <div class="mb-2">
                            <strong>${group.folder}/ (${group.count} arquivos)</strong>
                            <ul class="list-none ms-4">
                                ${group.files.map((f: any) => `<li><i data-lucide="file"></i> ${f}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                });
                listDiv.innerHTML = html;
                this.log(`Pré-visualização: ${total} arquivos serão organizados em ${this.previewData.length} pastas.`);
            }
        } catch (err) {
            this.log(`Erro na pré-visualização: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }

    async executeOrganize() {
        const dir = (document.getElementById('organize-dir') as DomElement).value.trim();
        if (!dir) {
            this.log('Selecione uma pasta.');
            return;
        }

        const recursive = (document.getElementById('organize-recursive') as DomElement).checked;
        const copy = (document.getElementById('organize-copy') as DomElement).checked;
        const moveOthers = (document.getElementById('organize-move-others') as DomElement).checked;
        const deleteEmpty = (document.getElementById('organize-delete-empty') as DomElement).checked;
        const onConflict = (document.getElementById('organize-conflict') as DomElement).value;

        const btn = document.getElementById('btn-organize')!;
        (btn as DomElement).disabled = true;
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
            document.getElementById('organize-preview-area')!.style.display = 'none';
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}