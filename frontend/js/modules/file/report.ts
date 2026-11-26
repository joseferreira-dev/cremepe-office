import { API } from '../../api.js';
import { Feature } from '../feature.js';
import { FileUtils } from './utils.js';
import type { DomainModule } from '../domain.js';

export class ReportFeature extends Feature {
    module!: DomainModule;
    constructor(module: DomainModule) {
        super('report');
        this.module = module;
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Gerar Relatório de Estrutura</h4>
                <p class="text-zinc-500">Exporte a árvore de diretórios para TXT ou CSV, com opção de incluir ou não os arquivos.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Diretório</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="report-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-report-dir">Selecionar</button>
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="report-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="report-include-files" checked>
                        <label class="form-check-label">Listar arquivos</label>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Formato de saída</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="report-format" id="report-format-txt" value="txt" checked>
                                <label class="form-check-label">TXT (indentado)</label>
                            </div>
                        </div>
                        <div class="md:col-span-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="report-format" id="report-format-csv" value="csv">
                                <label class="form-check-label">CSV</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Salvar em arquivo (opcional)</h5>
                    <div class="input-group">
                        <input type="text" id="report-output-path" class="form-control" placeholder="Caminho para salvar (deixe vazio para visualizar)">
                        <button class="btn btn-outline-secondary" id="btn-report-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-generate-report"><i data-lucide="play"></i> Gerar Relatório</button>

            ${this.progressHTML()}

            <div id="report-result" style="display:none;" class="mt-4">
                <label class="font-semibold text-zinc-600">Resultado</label>
                <div id="report-content" class="border rounded p-2 border-zinc-200" style="max-height:400px; overflow:auto; font-family:monospace; font-size:0.85rem; white-space:pre-wrap;"></div>
            </div>

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container: HTMLElement) {
        container.querySelector('#btn-report-dir')!.addEventListener('click', (e: any) => {
            e.stopPropagation();
            FileUtils.selectDirectory('report-dir');
        });

        container.querySelector('#btn-report-output')!.addEventListener('click', (e: any) => {
            e.stopPropagation();
            const formatRadio = document.querySelector('input[name="report-format"]:checked')!;
            const ext = formatRadio ? (formatRadio as DomElement).value : 'txt';
            FileUtils.selectSaveFile('report-output-path', [{ name: ext.toUpperCase(), extensions: [ext] }]);
        });

        container.querySelector('#btn-generate-report')!.addEventListener('click', () => this.generateReport());
    }

    async generateReport() {
        const dir = (document.getElementById('report-dir') as DomElement).value.trim();
        if (!dir) {
            this.log('Selecione uma pasta.');
            return;
        }

        const recursive = (document.getElementById('report-recursive') as DomElement).checked;
        const includeFiles = (document.getElementById('report-include-files') as DomElement).checked;
        const formatRadio = document.querySelector('input[name="report-format"]:checked')!;
        const format = formatRadio ? (formatRadio as DomElement).value : 'txt';
        const outputPath = (document.getElementById('report-output-path') as DomElement).value.trim() || undefined;

        const btn = document.getElementById('btn-generate-report')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Gerando relatório...');

        try {
            const result = await API.file.generateReport({
                dir,
                recursive,
                include_files: includeFiles,
                format,
                output_path: outputPath
            });

            if (result.saved_path) {
                this.log(`Relatório salvo em: ${result.saved_path}`);
            } else {
                const contentDiv = document.getElementById('report-result')!;
                contentDiv.style.display = 'block';
                document.getElementById('report-content')!.textContent = result.content;
                this.log('Relatório gerado com sucesso.');
            }
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}