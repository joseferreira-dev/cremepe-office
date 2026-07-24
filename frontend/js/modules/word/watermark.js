class WatermarkFeature {
    constructor(module) {
        this.module = module;
        this.updateTimeout = null;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Inserir Marca d'Água</h4>
                <p class="text-muted">Adicione uma marca d'água de texto ou imagem com posição, tamanho e transparência configuráveis.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Documento</h5>
                    <div class="input-group">
                        <input type="text" id="wm-input" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-wm-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="row g-3">
                <!-- Coluna esquerda: controles -->
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title text-success">Tipo de marca d'água</h5>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="wm-type" id="wm-type-text" value="text" checked>
                                        <label class="form-check-label">Texto</label>
                                    </div>
                                    <div id="wm-text-group">
                                        <label class="form-label">Texto</label>
                                        <input type="text" id="wm-text" class="form-control" value="CONFIDENCIAL">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="wm-type" id="wm-type-image" value="image">
                                        <label class="form-check-label">Imagem</label>
                                    </div>
                                    <div id="wm-image-group" style="display:none;">
                                        <label class="form-label">Imagem</label>
                                        <div class="input-group">
                                            <input type="text" id="wm-image-path" class="form-control" placeholder="Selecione a imagem...">
                                            <button class="btn btn-outline-secondary" id="btn-wm-image">Selecionar</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title text-success">Posição</h5>
                            <div class="row g-2">
                                <div class="col-md-12">
                                    <label class="form-label">Posição</label>
                                    <select id="wm-position" class="form-select">
                                        <option value="top-left">Superior Esquerdo</option>
                                        <option value="top-center">Superior Central</option>
                                        <option value="top-right">Superior Direito</option>
                                        <option value="center-left">Centro Esquerdo</option>
                                        <option value="center" selected>Centro</option>
                                        <option value="center-right">Centro Direito</option>
                                        <option value="bottom-left">Inferior Esquerdo</option>
                                        <option value="bottom-center">Inferior Central</option>
                                        <option value="bottom-right">Inferior Direito</option>
                                    </select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Margem Esq. (cm)</label>
                                    <input type="number" id="wm-margin-left" class="form-control" value="0" step="0.5">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Margem Sup. (cm)</label>
                                    <input type="number" id="wm-margin-top" class="form-control" value="0" step="0.5">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title text-success">Tamanho</h5>
                            <div class="row g-2">
                                <div class="col-md-6">
                                    <label class="form-label">Largura (cm)</label>
                                    <input type="number" id="wm-width" class="form-control" value="5" step="0.5" min="1">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Altura (cm)</label>
                                    <input type="number" id="wm-height" class="form-control" value="5" step="0.5" min="1">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title text-success">Transparência</h5>
                            <div class="d-flex align-items-center gap-2">
                                <input type="range" id="wm-transparency" class="form-range flex-grow-1" min="0" max="100" value="50">
                                <span id="wm-transparency-label" class="fw-bold" style="min-width:45px;">50%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Coluna direita: preview -->
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title text-success">Preview da Posição</h5>
                            <div style="position:relative; width:100%; max-width:400px; margin:0 auto; border:2px solid #007A51; border-radius:8px; padding:4px; background:#f8f9fa;">
                                <canvas id="wm-preview-canvas" width="400" height="566" style="width:100%; height:auto; display:block;"></canvas>
                                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:12px; color:#6c757d; pointer-events:none;">
                                    Página
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Arquivo de saída</h5>
                        <div class="input-group">
                            <input type="text" id="wm-output" class="form-control" placeholder="Caminho para salvar o documento...">
                            <button class="btn btn-outline-secondary" id="btn-wm-output">Selecionar</button>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-wm-apply"><i class="bi bi-play-fill"></i> Inserir Marca d'Água</button>

            <div class="progress mt-2"><div class="progress-bar" id="wm-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="wm-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents(container);
        // Atualiza preview imediatamente
        this.updatePreview();
    }

    attachEvents(container) {
        // Toggle texto/imagem
        container.querySelectorAll('input[name="wm-type"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const isText = document.getElementById('wm-type-text').checked;
                document.getElementById('wm-text-group').style.display = isText ? 'block' : 'none';
                document.getElementById('wm-image-group').style.display = isText ? 'none' : 'block';
            });
        });

        // Selecionar documento
        container.querySelector('#btn-wm-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Word', extensions: ['docx', 'doc'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('wm-input').value = result.filePaths[0];
                        this.suggestOutput();
                    }
                });
            }
        });

        // Selecionar imagem
        container.querySelector('#btn-wm-image').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('wm-image-path').value = result.filePaths[0];
                    }
                });
            }
        });

        // Selecionar saída
        container.querySelector('#btn-wm-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'Word', extensions: ['docx'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('wm-output').value = result.filePath;
                    }
                });
            }
        });

        // Transparência
        container.querySelector('#wm-transparency').addEventListener('input', (e) => {
            document.getElementById('wm-transparency-label').textContent = e.target.value + '%';
            // Não precisa atualizar preview, transparência não afeta posição
        });

        // Atualiza preview automaticamente ao mudar posição/margens/tamanho
        ['wm-position', 'wm-margin-left', 'wm-margin-top', 'wm-width', 'wm-height'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.schedulePreviewUpdate());
                el.addEventListener('change', () => this.schedulePreviewUpdate());
            }
        });

        // Botão aplicar
        container.querySelector('#btn-wm-apply').addEventListener('click', () => this.applyWatermark());

        // Atualiza sugestão de saída
        container.querySelector('#wm-input').addEventListener('change', () => this.suggestOutput());
    }

    suggestOutput() {
        const input = document.getElementById('wm-input').value.trim();
        const output = document.getElementById('wm-output');
        if (input && !output.value) {
            const base = input.replace(/\.[^.]+$/, '');
            output.value = `${base}_watermarked.docx`;
        }
    }

    schedulePreviewUpdate() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        this.updateTimeout = setTimeout(() => {
            this.updatePreview();
            this.updateTimeout = null;
        }, 200); // pequeno atraso para evitar muitas chamadas
    }

    async updatePreview() {
        const position = document.getElementById('wm-position').value;
        const width = parseFloat(document.getElementById('wm-width').value) || 5;
        const height = parseFloat(document.getElementById('wm-height').value) || 5;
        const marginLeft = parseFloat(document.getElementById('wm-margin-left').value) || 0;
        const marginTop = parseFloat(document.getElementById('wm-margin-top').value) || 0;

        try {
            const result = await window.API.word.watermarkPreview({
                position: position,
                width_cm: width,
                height_cm: height,
                margin_left_cm: marginLeft,
                margin_top_cm: marginTop
            });
            this.drawPreview(result);
        } catch (err) {
            console.warn('Erro ao carregar preview:', err);
            // Fallback com valores padrão
            this.drawPreview({
                left: 0,
                top: 0,
                width: width,
                height: height,
                page_width: 21,
                page_height: 29.7
            });
        }
    }

    drawPreview(data) {
        const canvas = document.getElementById('wm-preview-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = 400;
        const h = 566;

        const scaleX = w / data.page_width;
        const scaleY = h / data.page_height;

        ctx.clearRect(0, 0, w, h);

        // Fundo (página)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#007A51';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, w, h);

        // Marca d'água
        const leftPx = data.left * scaleX;
        const topPx = data.top * scaleY;
        const widthPx = data.width * scaleX;
        const heightPx = data.height * scaleY;

        ctx.fillStyle = 'rgba(0, 122, 81, 0.3)';
        ctx.fillRect(leftPx, topPx, widthPx, heightPx);
        ctx.strokeStyle = '#007A51';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(leftPx, topPx, widthPx, heightPx);
        ctx.setLineDash([]);

        ctx.fillStyle = '#007A51';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Marca d\'Água', leftPx + widthPx / 2, topPx + heightPx / 2);

        // Info
        ctx.font = '10px Arial';
        ctx.fillStyle = '#6c757d';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`L: ${data.left.toFixed(1)}cm`, 5, 5);
        ctx.fillText(`T: ${data.top.toFixed(1)}cm`, 5, 20);
        ctx.fillText(`W: ${data.width.toFixed(1)}cm`, 5, 35);
        ctx.fillText(`H: ${data.height.toFixed(1)}cm`, 5, 50);
    }

    async applyWatermark() {
        const inputPath = document.getElementById('wm-input').value.trim();
        const outputPath = document.getElementById('wm-output').value.trim();
        const isText = document.getElementById('wm-type-text').checked;
        const text = isText ? document.getElementById('wm-text').value.trim() : undefined;
        const imagePath = !isText ? document.getElementById('wm-image-path').value.trim() : undefined;
        const position = document.getElementById('wm-position').value;
        const width = parseFloat(document.getElementById('wm-width').value) || 5;
        const height = parseFloat(document.getElementById('wm-height').value) || 5;
        const transparency = parseInt(document.getElementById('wm-transparency').value) / 100;
        const marginLeft = parseFloat(document.getElementById('wm-margin-left').value) || 0;
        const marginTop = parseFloat(document.getElementById('wm-margin-top').value) || 0;

        if (!inputPath || !outputPath) {
            FileUtils.log('Selecione o documento de entrada e defina o de saída.', 'wm-log');
            return;
        }

        if (isText && !text) {
            FileUtils.log('Digite o texto da marca d\'água.', 'wm-log');
            return;
        }

        if (!isText && !imagePath) {
            FileUtils.log('Selecione uma imagem.', 'wm-log');
            return;
        }

        const btn = document.getElementById('btn-wm-apply');
        btn.disabled = true;
        FileUtils.clearLog('wm-log');
        FileUtils.log('Inserindo marca d\'água...', 'wm-log');

        try {
            const params = {
                input_path: inputPath,
                output_path: outputPath,
                content_type: isText ? 'text' : 'image',
                text: text,
                image_path: imagePath,
                position: position,
                width_cm: width,
                height_cm: height,
                transparency: transparency,
                margin_left_cm: marginLeft,
                margin_top_cm: marginTop
            };
            const result = await window.API.word.watermark(params);
            FileUtils.log(`Marca d'água inserida em: ${result.output_path}`, 'wm-log');
            document.getElementById('wm-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'wm-log');
        } finally {
            btn.disabled = false;
        }
    }
}