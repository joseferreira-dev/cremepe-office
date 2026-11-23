import { API } from '../../api.js';
import { Feature, escapeHtml } from '../feature.js';
import { FileUtils } from '../file/utils.js';
import type { DomainModule } from '../domain.js';

export class ExtractImagesFeature extends Feature {
    module!: DomainModule;
    constructor(module: DomainModule) {
        super('extract');
        this.module = module;
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Extrair Imagens</h4>
                <p class="text-zinc-500">Extraia todas as imagens embutidas em um documento Word e salve-as como arquivos individuais.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Documento</h5>
                    <div class="input-group">
                        <input type="text" id="extract-input" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-extract-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Destino</h5>
                    <div class="input-group">
                        <input type="text" id="extract-output" class="form-control" placeholder="Pasta para salvar as imagens...">
                        <button class="btn btn-outline-secondary" id="btn-extract-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Opções</h5>
                    <div class="mb-2">
                        <label class="form-label">Prefixo para os arquivos (opcional)</label>
                        <input type="text" id="extract-prefix" class="form-control" placeholder="Deixe vazio para usar o nome do documento">
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-extract"><i data-lucide="play"></i> Extrair</button>

            ${this.progressHTML()}

            ${this.logHTML()}

            <div id="extract-result" style="display:none;" class="mt-4">
                <label class="font-semibold text-zinc-600">Imagens extraídas</label>
                <div id="extract-list" class="border rounded p-2 border-zinc-200" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>
        `;

        this.attachEvents(container);
    }

    attachEvents(container: HTMLElement) {
        container.querySelector('#btn-extract-input')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Word', extensions: ['docx', 'doc'] }]
                }).then(result => {
                    if (!result.canceled) {
                        (document.getElementById('extract-input') as DomElement).value = result.filePaths[0];
                    }
                });
            }
        });

        container.querySelector('#btn-extract-output')!.addEventListener('click', () => {
            FileUtils.selectDirectory('extract-output');
        });

        container.querySelector('#btn-extract')!.addEventListener('click', () => this.extractImages());
    }

    async extractImages() {
        const inputPath = (document.getElementById('extract-input') as DomElement).value.trim();
        const outputDir = (document.getElementById('extract-output') as DomElement).value.trim();
        const prefix = (document.getElementById('extract-prefix') as DomElement).value.trim() || undefined;

        if (!inputPath || !outputDir) {
            this.log('Selecione o documento e a pasta de destino.');
            return;
        }

        const btn = document.getElementById('btn-extract')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Extraindo imagens...');

        try {
            const result = await API.word.extractImages({
                input_path: inputPath,
                output_dir: outputDir,
                prefix: prefix
            });
            this.log(`Extraídas ${result.count} imagens.`);
            this.setProgress(100);

            const resultDiv = document.getElementById('extract-result')!;
            resultDiv.style.display = 'block';
            const listDiv = document.getElementById('extract-list')!;
            listDiv.innerHTML = result.images.map((img: any) => `<div><i data-lucide="image" class="me-1"></i> ${escapeHtml(img)}</div>`).join('');
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}