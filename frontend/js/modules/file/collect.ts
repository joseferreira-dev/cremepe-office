import { API } from '../../api.js';
import { Feature } from '../feature.js';
import { FileUtils } from './utils.js';
import type { DomainModule } from '../domain.js';

export class CollectFeature extends Feature {
    module!: DomainModule;
    srcDirs!: any[];
    constructor(module: DomainModule) {
        super('collect');
        this.module = module;
        this.srcDirs = [''];
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Coletar Arquivos</h4>
                <p class="text-zinc-500">Reúna arquivos de múltiplas pastas em um destino.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Diretórios de Origem</h5>
                    <div id="src-dirs-container">
                        <!-- Campos dinâmicos -->
                    </div>
                    <button class="btn btn-outline-success btn-sm mt-2" id="add-src-dir">
                        <i data-lucide="circle-plus"></i> Adicionar Origem
                    </button>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Destino</h5>
                    <div class="input-group">
                        <input type="text" id="dst-dir" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-dst">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Opções</h5>
                    <div class="grid grid-cols-12 gap-2">
                        <div class="md:col-span-4">
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="recursive" checked> <label class="form-check-label">Recursivo (incluir subpastas)</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="copy-files"> <label class="form-check-label">Copiar (manter arquivos originais)</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="preserve-structure"> <label class="form-check-label">Preservar estrutura de pastas original</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="include-hidden"> <label class="form-check-label">Incluir arquivos ocultos</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="delete-empty"> <label class="form-check-label">Excluir pastas vazias (após mover)</label></div>
                        </div>
                        <div class="md:col-span-8">
                            <div class="mb-2">
                                <label class="form-label">Extensões (separadas por vírgula, ex: .pdf,.docx)</label>
                                <input type="text" id="extensions" class="form-control" placeholder="Deixe vazio para todas">
                            </div>
                            <div class="mb-2">
                                <label class="form-label">Coletar arquivos modificados nos últimos (dias)</label>
                                <input type="number" id="days-back" class="form-control" value="" placeholder="Ex: 7" min="1">
                            </div>
                            <div>
                                <label class="form-label">Em caso de conflito (nomes iguais)</label>
                                <select id="on-conflict" class="form-select">
                                    <option value="skip">Pular</option>
                                    <option value="overwrite">Sobrescrever</option>
                                    <option value="rename">Renomear automaticamente</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex gap-2 mb-4">
                <button class="btn btn-outline-success" id="btn-preview"><i data-lucide="eye"></i> Pré-visualizar</button>
                <button class="btn btn-success" id="btn-collect"><i data-lucide="play"></i> Coletar Arquivos</button>
            </div>

            <div id="preview-area" style="display:none;">
                <label class="font-semibold text-zinc-600">Pré-visualização (<span id="preview-count">0</span> arquivos)</label>
                <div id="preview-list" class="border rounded p-2 border-zinc-200" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        this.renderSrcDirs(container);
        this.attachEvents(container);
    }

    renderSrcDirs(container: HTMLElement) {
        const containerDiv = container.querySelector('#src-dirs-container')!;
        containerDiv.innerHTML = this.srcDirs.map((val: any, idx: number) => `
            <div class="input-group mb-1">
                <input type="text" class="form-control src-dir-input" data-idx="${idx}" value="${val}" placeholder="Selecione a pasta de origem...">
                <button class="btn btn-outline-secondary btn-src-select" data-idx="${idx}">Selecionar</button>
                ${this.srcDirs.length > 1 ? `<button class="btn btn-outline-danger btn-src-remove" data-idx="${idx}"><i data-lucide="x"></i></button>` : ''}
            </div>
        `).join('');
    }

    attachEvents(container: HTMLElement) {
        // Adicionar origem
        container.querySelector('#add-src-dir')!.addEventListener('click', () => {
            this.srcDirs.push('');
            this.renderSrcDirs(container);
        });

        // Selecionar destino – com prevenção de propagação
        container.querySelector('#btn-dst')!.addEventListener('click', (e: any) => {
            e.stopPropagation();
            e.preventDefault();
            FileUtils.selectDirectory('dst-dir');
        });

        // Pré-visualizar
        container.querySelector('#btn-preview')!.addEventListener('click', () => this.previewFiles());

        // Coletar
        container.querySelector('#btn-collect')!.addEventListener('click', () => this.executeCollect());

        // Delegação para botões dinâmicos de origem — o matching usa
        // closest(): o clique pode cair no SVG do ícone dentro do botão.
        // this.on() rastreia o listener: o #feature-content persiste entre
        // features do módulo, então destroy() o remove ao sair da feature
        // (evita que um clique seja processado N vezes).
        this.on(container, 'click', (e) => {
            const selectBtn = e.target.closest('.btn-src-select')!;
            if (selectBtn) {
                e.stopPropagation();
                e.preventDefault();
                this.selectDirectoryForSrc(selectBtn.dataset.idx, container);
                return;
            }
            const removeBtn = e.target.closest('.btn-src-remove')!;
            if (removeBtn) {
                e.stopPropagation();
                e.preventDefault();
                const idx = parseInt(removeBtn.dataset.idx);
                this.srcDirs.splice(idx, 1);
                this.renderSrcDirs(container);
            }
        });

        // Atualizar array quando o usuário digitar manualmente
        this.on(container, 'input', (e) => {
            if (e.target.classList.contains('src-dir-input')) {
                const idx = parseInt(e.target.dataset.idx);
                this.srcDirs[idx] = e.target.value;
            }
        });
    }

    selectDirectoryForSrc(idx: number, container: HTMLElement) {
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            window.electronAPI.showOpenDialog({ properties: ['openDirectory'] })
                .then(result => {
                    if (!result.canceled && result.filePaths.length > 0) {
                        this.srcDirs[idx] = result.filePaths[0];
                        this.renderSrcDirs(container);
                    }
                });
        } else {
            alert('Selecione a pasta manualmente.');
        }
    }

    async previewFiles() {
        const srcDirs = this.srcDirs.filter((s: any) => s.trim() !== '');
        if (!srcDirs.length) {
            this.log('Adicione pelo menos uma origem.');
            return;
        }
        const recursive = (document.getElementById('recursive') as DomElement).checked;
        const extensions = (document.getElementById('extensions') as DomElement).value.trim();
        const includeHidden = (document.getElementById('include-hidden') as DomElement).checked;
        const daysBack = (document.getElementById('days-back') as DomElement).value.trim();

        const btn = document.getElementById('btn-preview')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Carregando pré-visualização...');

        try {
            const params: Record<string, any> = {
                src_dirs: srcDirs,
                recursive,
                include_hidden: includeHidden,
            };
            if (extensions) params.extensions = extensions;
            if (daysBack) params.days_back = parseInt(daysBack);

            const result = await API.file.preview(params);
            const previewArea = document.getElementById('preview-area')!;
            previewArea.style.display = 'block';
            document.getElementById('preview-count')!.textContent = result.count;
            const listDiv = document.getElementById('preview-list')!;
            if (result.count === 0) {
                listDiv.innerHTML = '<p class="text-zinc-500">Nenhum arquivo corresponde aos filtros.</p>';
            } else {
                listDiv.innerHTML = result.files.map((f: any) => `
                    <div><i data-lucide="file" class="me-1"></i> ${f.relative} (${(f.size / 1024).toFixed(1)} KB)</div>
                `).join('');
            }
            this.log(`Pré-visualização: ${result.count} arquivos encontrados.`);
        } catch (err) {
            this.log(`Erro na pré-visualização: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }

    async executeCollect() {
        const srcDirs = this.srcDirs.filter((s: any) => s.trim() !== '');
        const dst = (document.getElementById('dst-dir') as DomElement).value.trim();
        if (!srcDirs.length || !dst) {
            this.log('Erro: Adicione pelo menos uma origem e um destino.');
            return;
        }

        for (const s of srcDirs) {
            if (s === dst) {
                this.log('Erro: Uma origem não pode ser igual ao destino.');
                return;
            }
        }

        const recursive = (document.getElementById('recursive') as DomElement).checked;
        const copy = (document.getElementById('copy-files') as DomElement).checked;
        const preserveStructure = (document.getElementById('preserve-structure') as DomElement).checked;
        const includeHidden = (document.getElementById('include-hidden') as DomElement).checked;
        const deleteEmpty = (document.getElementById('delete-empty') as DomElement).checked;
        const extensions = (document.getElementById('extensions') as DomElement).value.trim();
        const daysBack = (document.getElementById('days-back') as DomElement).value.trim();
        const onConflict = (document.getElementById('on-conflict') as DomElement).value;

        const btn = document.getElementById('btn-collect')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Iniciando coleta...');

        try {
            const params: Record<string, any> = {
                src_dirs: srcDirs,
                dst_dir: dst,
                recursive,
                copy,
                preserve_structure: preserveStructure,
                include_hidden: includeHidden,
                delete_empty_dirs: deleteEmpty,
                on_conflict: onConflict,
            };
            if (extensions) params.extensions = extensions;
            if (daysBack) params.days_back = parseInt(daysBack);

            const result = await API.file.collect(params);
            this.log(`Concluído! ${result.processed_count} arquivos coletados.`);
            this.setProgress(100);
            document.getElementById('preview-area')!.style.display = 'none';
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}