class FilePathFeature {
    constructor(module) {
        this.module = module;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Inserir Caminho do Arquivo</h4>
                <p class="text-muted">Insira o caminho do arquivo como marca d'água no documento.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Documento</h5>
                    <div class="input-group">
                        <input type="text" id="fp-input" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-fp-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="row g-3">
                <!-- Coluna esquerda -->
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title text-success">Caminho</h5>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="fp-full-path" checked>
                                <label class="form-check-label">Usar caminho completo</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="fp-relative-path">
                                <label class="form-check-label">Usar apenas o nome do arquivo</label>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title text-success">Posição</h5>
                            <div class="row g-2">
                                <div class="col-md-12">
                                    <label class="form-label">Posição</label>
                                    <select id="fp-position" class="form-select">
                                        <option value="top">Superior (horizontal)</option>
                                        <option value="bottom">Inferior (horizontal)</option>
                                        <option value="left">Esquerda (vertical)</option>
                                        <option value="right" selected>Direita (vertical)</option>
                                    </select>
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label">Distância da borda (cm)</label>
                                    <input type="number" id="fp-margin" class="form-control" value="1.0" step="0.1" min="0">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Coluna direita -->
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title text-success">Estilo</h5>
                            <div class="row g-2">
                                <div class="col-md-6">
                                    <label class="form-label">Tamanho (pt)</label>
                                    <input type="number" id="fp-font-size" class="form-control" value="12" min="6" step="1">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Cor</label>
                                    <input type="color" id="fp-color" class="form-control" value="#000000">
                                </div>
                            </div>
                            <div class="row g-2 mt-2">
                                <div class="col-md-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="fp-bold">
                                        <label class="form-check-label">Negrito</label>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="fp-italic">
                                        <label class="form-check-label">Itálico</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title text-success">Transparência</h5>
                            <div class="d-flex align-items-center gap-2">
                                <input type="range" id="fp-transparency" class="form-range flex-grow-1" min="0" max="100" value="50">
                                <span id="fp-transparency-label" class="fw-bold" style="min-width:45px;">50%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="fp-output" class="form-control" placeholder="Caminho para salvar...">
                        <button class="btn btn-outline-secondary" id="btn-fp-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-fp-apply"><i class="bi bi-play-fill"></i> Inserir Caminho</button>

            <div class="progress mt-2"><div class="progress-bar" id="fp-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG</label>
                <div class="log-area" id="fp-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-fp-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Word', extensions: ['docx', 'doc'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('fp-input').value = result.filePaths[0];
                        this.suggestOutput();
                    }
                });
            }
        });

        container.querySelector('#btn-fp-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'Word', extensions: ['docx'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('fp-output').value = result.filePath;
                    }
                });
            }
        });

        container.querySelector('#fp-transparency').addEventListener('input', (e) => {
            document.getElementById('fp-transparency-label').textContent = e.target.value + '%';
        });

        container.querySelector('#btn-fp-apply').addEventListener('click', () => this.applyFilePath());
        container.querySelector('#fp-input').addEventListener('change', () => this.suggestOutput());
    }

    suggestOutput() {
        const input = document.getElementById('fp-input').value.trim();
        const output = document.getElementById('fp-output');
        if (input && !output.value) {
            const base = input.replace(/\.[^.]+$/, '');
            output.value = `${base}_path.docx`;
        }
    }

    async applyFilePath() {
        const inputPath = document.getElementById('fp-input').value.trim();
        const outputPath = document.getElementById('fp-output').value.trim();
        const position = document.getElementById('fp-position').value;
        const margin = parseFloat(document.getElementById('fp-margin').value) || 1.0;
        const fontSize = parseInt(document.getElementById('fp-font-size').value) || 12;
        const color = document.getElementById('fp-color').value;
        const bold = document.getElementById('fp-bold').checked;
        const italic = document.getElementById('fp-italic').checked;
        const transparency = parseInt(document.getElementById('fp-transparency').value) / 100;
        const useFullPath = document.getElementById('fp-full-path').checked;

        if (!inputPath || !outputPath) {
            FileUtils.log('Selecione o documento de entrada e defina o de saída.', 'fp-log');
            return;
        }

        const btn = document.getElementById('btn-fp-apply');
        btn.disabled = true;
        FileUtils.clearLog('fp-log');
        FileUtils.log('Inserindo caminho do arquivo...', 'fp-log');

        try {
            const result = await window.API.word.filepath({
                input_path: inputPath,
                output_path: outputPath,
                position: position,
                margin_cm: margin,
                font_size: fontSize,
                color: color,
                bold: bold,
                italic: italic,
                transparency: transparency,
                use_full_path: useFullPath
            });
            FileUtils.log(`Caminho inserido em: ${result.output_path}`, 'fp-log');
            document.getElementById('fp-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'fp-log');
        } finally {
            btn.disabled = false;
        }
    }
}