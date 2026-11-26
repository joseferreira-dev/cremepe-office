import { API } from '../../api.js';
import { Feature, escapeHtml } from '../feature.js';
import { FileUtils } from './utils.js';
import type { DomainModule } from '../domain.js';

export class SplitFeature extends Feature {
    mode!: string;
    module!: DomainModule;
    constructor(module: DomainModule) {
        super('split');
        this.module = module;
        this.mode = 'split'; // 'split' | 'merge'
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Dividir / Remontar Arquivos</h4>
                <p class="text-zinc-500">Divida um arquivo grande em partes menores ou remonte partes em um único arquivo.</p>
            </div>

            <!-- Tabs -->
            <ul class="nav-tabs mb-4" role="tablist">
                <li role="presentation">
                    <button class="nav-link active" data-mode="split" id="tab-split">Dividir</button>
                </li>
                <li role="presentation">
                    <button class="nav-link" data-mode="merge" id="tab-merge">Remontar</button>
                </li>
            </ul>

            <!-- Conteúdo Dividir -->
            <div id="split-content">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivo para dividir</h5>
                        <div class="input-group">
                            <input type="text" id="split-file" class="form-control" placeholder="Selecione o arquivo...">
                            <button class="btn btn-outline-secondary" id="btn-split-file">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Destino</h5>
                        <div class="input-group">
                            <input type="text" id="split-output-dir" class="form-control" placeholder="Pasta para salvar as partes...">
                            <button class="btn btn-outline-secondary" id="btn-split-dir">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Opções</h5>
                        <div class="mb-2">
                            <label class="form-label">Tamanho de cada parte (MB)</label>
                            <input type="number" id="split-size" class="form-control" value="100" min="1" step="1">
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="split-overwrite">
                            <label class="form-check-label">Sobrescrever partes existentes</label>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-split"><i data-lucide="play"></i> Dividir</button>
            </div>

            <!-- Conteúdo Remontar -->
            <div id="merge-content" style="display:none;">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Selecione as partes (.partNNNN)</h5>
                        <div class="mb-2">
                            <label class="form-label">Partes</label>
                            <div class="input-group">
                                <input type="text" id="merge-parts" class="form-control" placeholder="Caminhos separados por vírgula ou selecione">
                                <button class="btn btn-outline-secondary" id="btn-merge-parts">Selecionar arquivos</button>
                            </div>
                            <div id="parts-list" style="max-height:100px; overflow:auto; font-size:0.9rem; margin-top:4px;"></div>
                        </div>
                        <div class="mb-2">
                            <label class="form-label">Arquivo de saída</label>
                            <div class="input-group">
                                <input type="text" id="merge-output" class="form-control" placeholder="Caminho para salvar o arquivo remontado...">
                                <button class="btn btn-outline-secondary" id="btn-merge-output">Selecionar</button>
                            </div>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="merge-overwrite">
                            <label class="form-check-label">Sobrescrever se existir</label>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-merge"><i data-lucide="play"></i> Remontar</button>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        // Renderiza a lista ja existente (input pode ter valor de uma
        // sessao anterior); sem isso a lista nascia vazia.
        this.updatePartsList();
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
                document.getElementById('split-content')!.style.display = (mode === 'split') ? 'block' : 'none';
                document.getElementById('merge-content')!.style.display = (mode === 'merge') ? 'block' : 'none';
            });
        });

        // Dividir
        FileUtils.selectFile('split-file', [])
        container.querySelector('#btn-split-dir')!.addEventListener('click', () => {
            FileUtils.selectDirectory('split-output-dir');
        });
        container.querySelector('#btn-split')!.addEventListener('click', () => this.splitFile());

        // Remontar
        FileUtils.selectFile('merge-parts', [], { multiple: true, append: true, onSelect: () => { this.updatePartsList(); } })
        FileUtils.selectSaveFile('merge-output', [])
        container.querySelector('#btn-merge')!.addEventListener('click', () => this.mergeParts());
    }

    updatePartsList() {
        const val = (document.getElementById('merge-parts') as DomElement).value;
        const paths = val.split(',').map(s => s.trim()).filter(Boolean);
        const listDiv = document.getElementById('parts-list')!;
        if (paths.length === 0) {
            listDiv.innerHTML = '<p class="text-zinc-500">Nenhuma parte selecionada.</p>';
        } else {
            listDiv.innerHTML = paths.map(p => `<div><i data-lucide="file" class="me-1"></i> ${escapeHtml(p)}</div>`).join('');
        }
    }

    async splitFile() {
        const filePath = (document.getElementById('split-file') as DomElement).value.trim();
        const outputDir = (document.getElementById('split-output-dir') as DomElement).value.trim();
        const partSize = parseInt((document.getElementById('split-size') as DomElement).value) || 100;
        const overwrite = (document.getElementById('split-overwrite') as DomElement).checked;

        if (!filePath || !outputDir) {
            this.log('Preencha o arquivo e o destino.');
            return;
        }

        const btn = document.getElementById('btn-split')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Dividindo arquivo...');

        try {
            const result = await API.file.split({
                file_path: filePath,
                output_dir: outputDir,
                part_size_mb: partSize,
                overwrite
            });
            this.log(`Dividido em ${result.count} partes:\n${result.parts.join('\n')}`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }

    async mergeParts() {
        const partsInput = (document.getElementById('merge-parts') as DomElement).value.trim();
        const partsList = partsInput.split(',').map(s => s.trim()).filter(Boolean);
        const outputPath = (document.getElementById('merge-output') as DomElement).value.trim();
        const overwrite = (document.getElementById('merge-overwrite') as DomElement).checked;

        if (!partsList.length || !outputPath) {
            this.log('Selecione as partes e o destino.');
            return;
        }

        const btn = document.getElementById('btn-merge')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Remontando arquivo...');

        try {
            const result = await API.file.merge({
                parts_list: partsList,
                output_path: outputPath,
                overwrite
            });
            this.log(`Arquivo remontado em: ${result.output_path}`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}