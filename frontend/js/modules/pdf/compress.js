class PDFCompressFeature {
    constructor() {
        this.compressionLevels = [
            { value: 'low', label: 'Baixa (150 DPI)' },
            { value: 'medium', label: 'Média (100 DPI)' },
            { value: 'high', label: 'Alta (72 DPI)' }
        ];
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Comprimir PDF</h4>
                <p class="text-muted">Reduza o tamanho do PDF reamostrando imagens e aplicando compressão JPEG.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="compress-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-compress-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Nível de compressão</h5>
                    <div class="row g-2">
                        ${this.compressionLevels.map(lvl => `
                            <div class="col-md-4">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="compress-level" id="compress-${lvl.value}" value="${lvl.value}" ${lvl.value === 'medium' ? 'checked' : ''}>
                                    <label class="form-check-label" for="compress-${lvl.value}">${lvl.label}</label>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Qualidade das imagens (JPEG)</h5>
                    <div class="d-flex align-items-center gap-3">
                        <input type="range" id="jpeg-quality" class="form-range flex-grow-1" min="10" max="100" value="85">
                        <span id="jpeg-quality-label" class="fw-bold" style="min-width:45px;">85%</span>
                    </div>
                    <small class="text-muted">Valores mais baixos = arquivos menores, porém com perda de qualidade.</small>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compress-remove-metadata">
                        <label class="form-check-label">Remover metadados (autor, título, etc.)</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compress-downscale" checked>
                        <label class="form-check-label">Redimensionar imagens (reduzir resolução)</label>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="compress-output" class="form-control" placeholder="Caminho do PDF comprimido">
                        <button class="btn btn-outline-secondary" id="btn-compress-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-compress"><i class="bi bi-play-fill me-1"></i>Comprimir</button>

            <div class="progress mt-2"><div class="progress-bar" id="compress-progress" style="width:0%"></div></div>

            <div id="compress-result" style="display:none;" class="mt-3">
                <div class="row g-2">
                    <div class="col-6"><span class="badge bg-secondary">Original: <span id="orig-size">0</span> KB</span></div>
                    <div class="col-6"><span class="badge bg-success">Comprimido: <span id="comp-size">0</span> KB</span></div>
                </div>
                <div class="mt-2"><span class="badge bg-info">Redução: <span id="comp-ratio">0</span>%</span></div>
            </div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="compress-log">Log de operações vazio</div>
            </div>
        `;

        // Atualizar label do slider de qualidade
        document.getElementById('jpeg-quality').addEventListener('input', (e) => {
            document.getElementById('jpeg-quality-label').textContent = e.target.value + '%';
        });

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-compress-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('compress-input').value = result.filePaths[0];
                        this.suggestOutput();
                    }
                });
            }
        });

        document.getElementById('btn-compress-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('compress-output').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-compress').addEventListener('click', () => this.compressPDF());
        document.getElementById('compress-input').addEventListener('change', () => this.suggestOutput());
    }

    suggestOutput() {
        const input = document.getElementById('compress-input').value.trim();
        const output = document.getElementById('compress-output');
        if (input && !output.value) {
            const base = input.replace(/\.[^.]+$/, '');
            output.value = `${base}_comprimido.pdf`;
        }
    }

    async compressPDF() {
        const inputPath = document.getElementById('compress-input').value.trim();
        const outputPath = document.getElementById('compress-output').value.trim();
        const levelRadio = document.querySelector('input[name="compress-level"]:checked');
        const compressionLevel = levelRadio ? levelRadio.value : 'medium';
        const jpegQuality = parseInt(document.getElementById('jpeg-quality').value) || 85;
        const removeMetadata = document.getElementById('compress-remove-metadata').checked;
        const downscaleImages = document.getElementById('compress-downscale').checked;

        if (!inputPath || !outputPath) {
            FileUtils.log('Selecione o PDF de entrada e defina o de saída.', 'compress-log');
            return;
        }

        const btn = document.getElementById('btn-compress');
        btn.disabled = true;
        FileUtils.clearLog('compress-log');
        FileUtils.log('Comprimindo PDF...', 'compress-log');

        try {
            const result = await window.API.pdf.compress({
                input_path: inputPath,
                output_path: outputPath,
                compression_level: compressionLevel,
                jpeg_quality: jpegQuality,
                remove_metadata: removeMetadata,
                downscale_images: downscaleImages
            });

            const orig = (result.original_size / 1024).toFixed(2);
            const comp = (result.compressed_size / 1024).toFixed(2);
            const reduction = ((1 - result.ratio) * 100).toFixed(1);

            document.getElementById('orig-size').textContent = orig;
            document.getElementById('comp-size').textContent = comp;
            document.getElementById('comp-ratio').textContent = reduction;
            document.getElementById('compress-result').style.display = 'block';

            FileUtils.log(`Comprimido com sucesso! Tamanho original: ${orig} KB, comprimido: ${comp} KB (redução de ${reduction}%)`, 'compress-log');
            document.getElementById('compress-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'compress-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.PDFCompressFeature = PDFCompressFeature;