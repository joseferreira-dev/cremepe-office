import { API } from '../../api.js';
import { Feature, escapeHtml } from '../feature.js';
import type { DomainModule } from '../domain.js';

export class ArchiveFeature extends Feature {
    mode!: string;
    module!: DomainModule;
    constructor(module: DomainModule) {
        super('archive');
        this.module = module;
        this.mode = 'compress'; // 'compress' | 'extract'
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Compactar / Extrair</h4>
                <p class="text-zinc-500">Crie arquivos ZIP com opções avançadas ou extraia arquivos compactados.</p>
            </div>

            <!-- Tabs -->
            <ul class="nav-tabs mb-4" role="tablist">
                <li role="presentation">
                    <button class="nav-link active" data-mode="compress" id="tab-compress">Compactar (ZIP)</button>
                </li>
                <li role="presentation">
                    <button class="nav-link" data-mode="extract" id="tab-extract">Extrair</button>
                </li>
            </ul>

            <!-- Conteúdo Compactar -->
            <div id="archive-compress-content">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivos/Pastas para compactar</h5>
                        <div class="mb-2">
                            <label class="form-label">Selecione arquivos ou pastas</label>
                            <div class="input-group">
                                <input type="text" id="archive-sources" class="form-control" placeholder="Caminhos separados por vírgula">
                                <button class="btn btn-outline-secondary" id="btn-add-files">Adicionar Arquivos</button>
                                <button class="btn btn-outline-secondary" id="btn-add-folder">Adicionar Pasta</button>
                            </div>
                        </div>
                        <div id="source-list" style="max-height:100px; overflow:auto; font-size:0.9rem;"></div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Destino</h5>
                        <div class="input-group">
                            <input type="text" id="archive-output" class="form-control" placeholder="Caminho do arquivo ZIP">
                            <button class="btn btn-outline-secondary" id="btn-output">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Opções de Compactação</h5>
                        <div class="grid grid-cols-12 gap-2">
                            <div class="md:col-span-6">
                                <label class="form-label">Nível de compressão</label>
                                <input type="range" id="compression-level" class="form-range" min="0" max="9" value="6">
                                <span id="level-label">6</span>
                            </div>
                            <div class="md:col-span-6">
                                <label class="form-label">Método</label>
                                <select id="compression-method" class="form-select">
                                    <option value="deflate">DEFLATE</option>
                                    <option value="bzip2">BZIP2</option>
                                    <option value="lzma">LZMA</option>
                                    <option value="store">STORED (sem compressão)</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-12 gap-2 mt-2">
                            <div class="md:col-span-6">
                                <label class="form-label">Senha (opcional)</label>
                                <input type="password" id="archive-password" class="form-control" placeholder="Deixe vazio para sem senha">
                            </div>
                            <div class="md:col-span-6">
                                <label class="form-label">Padrões de inclusão (ex: *.pdf,*.docx)</label>
                                <input type="text" id="include-patterns" class="form-control" placeholder="Separados por vírgula">
                            </div>
                        </div>
                        <div class="grid grid-cols-12 gap-2 mt-2">
                            <div class="md:col-span-6">
                                <label class="form-label">Padrões de exclusão (ex: *.tmp,*.log)</label>
                                <input type="text" id="exclude-patterns" class="form-control" placeholder="Separados por vírgula">
                            </div>
                            <div class="md:col-span-6">
                                <div class="form-check mt-2">
                                    <input class="form-check-input" type="checkbox" id="exclude-hidden">
                                    <label class="form-check-label">Excluir arquivos ocultos</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="archive-recursive" checked>
                                    <label class="form-check-label">Incluir subpastas</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-compress"><i data-lucide="play"></i> Compactar</button>
            </div>

            <!-- Conteúdo Extrair -->
            <div id="archive-extract-content" style="display:none;">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivo para extrair</h5>
                        <div class="input-group">
                            <input type="text" id="extract-archive" class="form-control" placeholder="Selecione o arquivo compactado...">
                            <button class="btn btn-outline-secondary" id="btn-extract-archive">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Destino da extração</h5>
                        <div class="input-group">
                            <input type="text" id="extract-dir" class="form-control" placeholder="Selecione a pasta de destino...">
                            <button class="btn btn-outline-secondary" id="btn-extract-dir">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Senha (opcional)</h5>
                        <input type="password" id="extract-password" class="form-control" placeholder="Deixe vazio se não houver senha">
                    </div>
                </div>

                <button class="btn btn-success" id="btn-extract"><i data-lucide="play"></i> Extrair</button>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        // Renderiza a lista ja existente (input pode ter valor de uma
        // sessao anterior); sem isso a lista nascia vazia.
        this.updateSourceList();
        this.attachEvents(container);
    }

    attachEvents(container: HTMLElement) {
        // Tabs
        container.querySelectorAll('.nav-link').forEach((tab: any) => {
            tab.addEventListener('click', (e: any) => {
                const mode = e.target.dataset.mode;
                this.mode = mode;
                document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('archive-compress-content')!.style.display = (mode === 'compress') ? 'block' : 'none';
                document.getElementById('archive-extract-content')!.style.display = (mode === 'extract') ? 'block' : 'none';
            });
        });

        // Selecionar arquivos/pastas para compactar
        container.querySelector('#btn-add-files')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
                    .then(result => {
                        if (!result.canceled) {
                            const current = (document.getElementById('archive-sources') as DomElement).value;
                            const newPaths = result.filePaths.join(', ');
                            (document.getElementById('archive-sources') as DomElement).value = current ? current + ', ' + newPaths : newPaths;
                            this.updateSourceList();
                        }
                    });
            }
        });

        container.querySelector('#btn-add-folder')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openDirectory'] })
                    .then(result => {
                        if (!result.canceled) {
                            const current = (document.getElementById('archive-sources') as DomElement).value;
                            const newPath = result.filePaths[0];
                            (document.getElementById('archive-sources') as DomElement).value = current ? current + ', ' + newPath : newPath;
                            this.updateSourceList();
                        }
                    });
            }
        });

        // Selecionar destino
        container.querySelector('#btn-output')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({ filters: [{ name: 'ZIP', extensions: ['zip'] }] })
                    .then(result => {
                        if (!result.canceled && result.filePath) {
                            (document.getElementById('archive-output') as DomElement).value = result.filePath;
                        }
                    });
            }
        });

        // Selecionar arquivo para extrair
        container.querySelector('#btn-extract-archive')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Arquivos compactados', extensions: ['zip', '7z', 'rar', 'tar', 'gz', 'tgz'] }] })
                    .then(result => {
                        if (!result.canceled) (document.getElementById('extract-archive') as DomElement).value = result.filePaths[0];
                    });
            }
        });

        container.querySelector('#btn-extract-dir')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openDirectory'] })
                    .then(result => {
                        if (!result.canceled) (document.getElementById('extract-dir') as DomElement).value = result.filePaths[0];
                    });
            }
        });

        // Nível de compressão
        container.querySelector('#compression-level')!.addEventListener('input', (e: any) => {
            document.getElementById('level-label')!.textContent = e.target.value;
        });

        // Botões
        container.querySelector('#btn-compress')!.addEventListener('click', () => this.compress());
        container.querySelector('#btn-extract')!.addEventListener('click', () => this.extract());
    }

    updateSourceList() {
        const val = (document.getElementById('archive-sources') as DomElement).value;
        const paths = val.split(',').map(s => s.trim()).filter(Boolean);
        const listDiv = document.getElementById('source-list')!;
        if (paths.length === 0) {
            listDiv.innerHTML = '<p class="text-zinc-500">Nenhum arquivo/pasta selecionado.</p>';
        } else {
            listDiv.innerHTML = paths.map(p => `<div><i data-lucide="file" class="me-1"></i> ${escapeHtml(p)}</div>`).join('');
        }
    }

    async compress() {
        const sources = (document.getElementById('archive-sources') as DomElement).value.split(',').map(s => s.trim()).filter(Boolean);
        const output = (document.getElementById('archive-output') as DomElement).value.trim();
        if (!sources.length || !output) {
            this.log('Selecione os arquivos/pastas e defina o destino.');
            return;
        }

        const password = (document.getElementById('archive-password') as DomElement).value.trim() || undefined;
        const level = parseInt((document.getElementById('compression-level') as DomElement).value);
        const method = (document.getElementById('compression-method') as DomElement).value;
        const recursive = (document.getElementById('archive-recursive') as DomElement).checked;
        const excludeHidden = (document.getElementById('exclude-hidden') as DomElement).checked;
        const includePatterns = (document.getElementById('include-patterns') as DomElement).value.trim() || undefined;
        const excludePatterns = (document.getElementById('exclude-patterns') as DomElement).value.trim() || undefined;

        const btn = document.getElementById('btn-compress')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Compactando...');

        try {
            const result = await API.file.compress({
                source_paths: sources,
                output_path: output,
                password,
                compression_level: level,
                compression_method: method,
                recursive,
                exclude_hidden: excludeHidden,
                include_patterns: includePatterns ? includePatterns.split(',').map(s => s.trim()) : undefined,
                exclude_patterns: excludePatterns ? excludePatterns.split(',').map(s => s.trim()) : undefined
            });
            this.log(`Compactação concluída: ${result.output_path}`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }

    async extract() {
        const archivePath = (document.getElementById('extract-archive') as DomElement).value.trim();
        const extractDir = (document.getElementById('extract-dir') as DomElement).value.trim();
        if (!archivePath || !extractDir) {
            this.log('Selecione o arquivo e o destino.');
            return;
        }

        const password = (document.getElementById('extract-password') as DomElement).value.trim() || undefined;

        const btn = document.getElementById('btn-extract')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Extraindo...');

        try {
            const result = await API.file.extract({
                archive_path: archivePath,
                extract_dir: extractDir,
                password
            });
            this.log(`Extraído para: ${result.extract_dir}`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}