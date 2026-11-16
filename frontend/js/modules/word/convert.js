import { API } from '../../api.js';
import { Feature } from '../feature.js';

export class ConvertFeature extends Feature {
    constructor(module) {
        super('convert');
        this.module = module;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Converter Documento</h4>
                <p class="text-zinc-500">Converta documentos Word para HTML, TXT, DOC ou PDF.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="convert-input" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-convert-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Formato de saída</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-html" value="html" checked>
                                <label class="form-check-label">HTML</label>
                            </div>
                        </div>
                        <div class="md:col-span-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-txt" value="txt">
                                <label class="form-check-label">TXT</label>
                            </div>
                        </div>
                        <div class="md:col-span-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-doc" value="doc">
                                <label class="form-check-label">DOC</label>
                            </div>
                        </div>
                        <div class="md:col-span-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-pdf" value="pdf">
                                <label class="form-check-label">PDF</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="convert-output" class="form-control" placeholder="Caminho para salvar o arquivo convertido...">
                        <button class="btn btn-outline-secondary" id="btn-convert-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-convert"><i data-lucide="play"></i> Converter</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-convert-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Word', extensions: ['docx', 'doc'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('convert-input').value = result.filePaths[0];
                        this.suggestOutputPath();
                    }
                });
            }
        });

        container.querySelector('#btn-convert-output').addEventListener('click', () => {
            const format = document.querySelector('input[name="convert-format"]:checked').value;
            const ext = format;
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: format.toUpperCase(), extensions: [ext] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('convert-output').value = result.filePath;
                    }
                });
            }
        });

        container.querySelectorAll('input[name="convert-format"]').forEach(radio => {
            radio.addEventListener('change', () => this.suggestOutputPath());
        });

        container.querySelector('#btn-convert').addEventListener('click', () => this.convertDocument());
    }

    suggestOutputPath() {
        const input = document.getElementById('convert-input').value.trim();
        const format = document.querySelector('input[name="convert-format"]:checked').value;
        if (input) {
            const baseName = input.replace(/\.[^.]+$/, '');
            const output = document.getElementById('convert-output');
            if (!output.value) {
                output.value = `${baseName}.${format}`;
            }
        }
    }

    async convertDocument() {
        const inputPath = document.getElementById('convert-input').value.trim();
        const outputPath = document.getElementById('convert-output').value.trim();
        const format = document.querySelector('input[name="convert-format"]:checked').value;

        if (!inputPath || !outputPath) {
            this.log('Selecione o arquivo de entrada e defina o destino.');
            return;
        }

        const btn = document.getElementById('btn-convert');
        btn.disabled = true;
        this.clearLog();
        this.log(`Convertendo para ${format.toUpperCase()}...`);

        try {
            const result = await API.word.convert({
                input_path: inputPath,
                output_path: outputPath,
                output_format: format
            });
            this.log(`Convertido para: ${result.output_path}`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}