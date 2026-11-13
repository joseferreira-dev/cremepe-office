import { API } from '../../api.js';
import { Feature } from '../feature.js';
import { FileUtils } from '../file/utils.js';

export class ExcelConvertFeature extends Feature {
    constructor() {
        super('excel');
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Conversão em Lote</h4>
                <p class="text-muted">Converta vários arquivos XLSX ou CSV para outros formatos de uma só vez.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Pastas</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta de origem</label>
                        <div class="input-group">
                            <input type="text" id="excel-source-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-excel-source">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Pasta de destino</label>
                        <div class="input-group">
                            <input type="text" id="excel-dest-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-excel-dest">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-3">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title text-success">Formato de entrada</h5>
                            <select id="excel-input-format" class="form-select">
                                <option value="xlsx">XLSX</option>
                                <option value="csv">CSV</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title text-success">Formato de saída</h5>
                            <select id="excel-output-format" class="form-select">
                                <option value="xlsx">XLSX</option>
                                <option value="csv">CSV</option>
                                <option value="xls">XLS (Excel 97-2003)</option>
                                <option value="html">HTML</option>
                                <option value="markdown">Markdown</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="excel-recursive">
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="excel-overwrite">
                        <label class="form-check-label">Sobrescrever arquivos existentes</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-excel-convert"><i class="bi bi-play-fill"></i> Converter</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-excel-source').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('excel-source-dir');
        });

        document.getElementById('btn-excel-dest').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('excel-dest-dir');
        });

        document.getElementById('btn-excel-convert').addEventListener('click', () => this.convertBatch());
    }

    async convertBatch() {
        const sourceDir = document.getElementById('excel-source-dir').value.trim();
        const destDir = document.getElementById('excel-dest-dir').value.trim();
        const inputFormat = document.getElementById('excel-input-format').value;
        const outputFormat = document.getElementById('excel-output-format').value;
        const recursive = document.getElementById('excel-recursive').checked;
        const overwrite = document.getElementById('excel-overwrite').checked;

        if (!sourceDir || !destDir) {
            this.log('Selecione as pastas de origem e destino.');
            return;
        }
        if (sourceDir === destDir) {
            this.log('Origem e destino não podem ser iguais.');
            return;
        }

        const btn = document.getElementById('btn-excel-convert');
        btn.disabled = true;
        this.clearLog();
        this.log(`Iniciando conversão de ${inputFormat.toUpperCase()} → ${outputFormat.toUpperCase()}...`);

        try {
            const result = await API.excel.convertBatch({
                source_dir: sourceDir,
                dest_dir: destDir,
                input_format: inputFormat,
                output_format: outputFormat,
                recursive: recursive,
                overwrite: overwrite
            });

            const { processed, skipped, errors } = result;
            this.log(`Concluído! ${processed} arquivos convertidos, ${skipped} ignorados.`);
            if (errors.length) {
                this.log(`Erros: ${errors.length}`);
                errors.forEach(e => this.log(`  ${e.file}: ${e.error}`));
            }
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}

