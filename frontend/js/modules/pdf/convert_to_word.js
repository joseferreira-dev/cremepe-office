import { API } from '../../api.js';
import { Feature } from '../feature.js';

export class PDFConvertToWordFeature extends Feature {
    constructor() {
        super('convert');
        this.direction = 'pdf_to_word'; // 'pdf_to_word' | 'word_to_pdf'
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Converter Word ↔ PDF</h4>
                <p class="text-muted">Converta documentos entre os formatos Word (.docx, .doc) e PDF.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Direção da conversão</h5>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-direction" id="convert-pdf-to-word" value="pdf_to_word" checked>
                                <label class="form-check-label">PDF → Word (.docx)</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-direction" id="convert-word-to-pdf" value="word_to_pdf">
                                <label class="form-check-label">Word (.docx, .doc) → PDF</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="convert-input-file" class="form-control" placeholder="Selecione o arquivo...">
                        <button class="btn btn-outline-secondary" id="btn-convert-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="convert-output-file" class="form-control" placeholder="Caminho do arquivo de saída">
                        <button class="btn btn-outline-secondary" id="btn-convert-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-convert-execute"><i data-lucide="play" class="me-1"></i>Converter</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        // Eventos para alternar direção
        document.querySelectorAll('input[name="convert-direction"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.direction = e.target.value;
                this.updateSuggestions();
            });
        });

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-convert-input').addEventListener('click', () => {
            const filters = this.direction === 'pdf_to_word'
                ? [{ name: 'PDF', extensions: ['pdf'] }]
                : [{ name: 'Word', extensions: ['docx', 'doc'] }];
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: filters
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('convert-input-file').value = result.filePaths[0];
                        this.suggestOutput();
                    }
                });
            }
        });

        document.getElementById('btn-convert-output').addEventListener('click', () => {
            const ext = this.direction === 'pdf_to_word' ? 'docx' : 'pdf';
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('convert-output-file').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-convert-execute').addEventListener('click', () => this.executeConvert());

        // Atualizar sugestões quando entrada mudar
        document.getElementById('convert-input-file').addEventListener('change', () => this.suggestOutput());
        document.querySelectorAll('input[name="convert-direction"]').forEach(radio => {
            radio.addEventListener('change', () => this.suggestOutput());
        });
    }

    suggestOutput() {
        const input = document.getElementById('convert-input-file').value.trim();
        if (input) {
            const output = document.getElementById('convert-output-file');
            if (!output.value) {
                const base = input.replace(/\.[^.]+$/, '');
                const ext = this.direction === 'pdf_to_word' ? 'docx' : 'pdf';
                output.value = `${base}.${ext}`;
            }
        }
    }

    async executeConvert() {
        const inputFile = document.getElementById('convert-input-file').value.trim();
        const outputFile = document.getElementById('convert-output-file').value.trim();

        if (!inputFile || !outputFile) {
            this.log('Selecione o arquivo de entrada e defina o de saída.');
            return;
        }

        const btn = document.getElementById('btn-convert-execute');
        btn.disabled = true;
        this.clearLog();

        try {
            if (this.direction === 'pdf_to_word') {
                this.log('Convertendo PDF → Word...');
                const result = await API.pdf.convertToWord({
                    pdf_path: inputFile,
                    output_path: outputFile
                });
                if (result.warning) this.log(`Aviso: ${result.warning}`);
                this.log(`Concluído! Arquivo salvo em: ${result.output_path}`);
            } else {
                this.log('Convertendo Word → PDF...');
                const result = await API.word.convert({
                    input_path: inputFile,
                    output_path: outputFile,
                    output_format: 'pdf'
                });
                this.log(`Concluído! Arquivo salvo em: ${result.output_path}`);
            }
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}

