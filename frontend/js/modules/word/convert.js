class ConvertFeature {
    constructor(module) {
        this.module = module;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Converter Documento</h4>
                <p class="text-muted">Converta documentos Word para HTML, TXT, DOC ou PDF.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="convert-input" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-convert-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Formato de saída</h5>
                    <div class="row">
                        <div class="col-md-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-html" value="html" checked>
                                <label class="form-check-label">HTML</label>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-txt" value="txt">
                                <label class="form-check-label">TXT</label>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-doc" value="doc">
                                <label class="form-check-label">DOC</label>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-pdf" value="pdf">
                                <label class="form-check-label">PDF</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="convert-output" class="form-control" placeholder="Caminho para salvar o arquivo convertido...">
                        <button class="btn btn-outline-secondary" id="btn-convert-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-convert"><i class="bi bi-play-fill"></i> Converter</button>

            <div class="progress mt-2"><div class="progress-bar" id="convert-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG</label>
                <div class="log-area" id="convert-log">Log de operações vazio</div>
            </div>
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
            FileUtils.log('Selecione o arquivo de entrada e defina o destino.', 'convert-log');
            return;
        }

        const btn = document.getElementById('btn-convert');
        btn.disabled = true;
        FileUtils.clearLog('convert-log');
        FileUtils.log(`Convertendo para ${format.toUpperCase()}...`, 'convert-log');

        try {
            const result = await window.API.word.convert({
                input_path: inputPath,
                output_path: outputPath,
                output_format: format
            });
            FileUtils.log(`Convertido para: ${result.output_path}`, 'convert-log');
            document.getElementById('convert-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'convert-log');
        } finally {
            btn.disabled = false;
        }
    }
}