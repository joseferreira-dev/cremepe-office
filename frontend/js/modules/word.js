class WordModule {
    constructor(container) {
        this.container = container;
        this.currentFeature = 'convert';
        this.features = [
            { id: 'convert', label: 'Converter para PDF', render: this.renderConvert.bind(this) },
            { id: 'extract', label: 'Extrair Texto', render: this.renderExtract.bind(this) },
        ];
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h2 class="module-title"><i class="bi bi-file-earmark-word me-2"></i>Documentos</h2>
                <div class="d-flex gap-3" style="height: calc(100% - 60px);">
                    <div class="module-sidebar flex-shrink-0" style="width: 240px;">
                        <h3>Funcionalidades</h3>
                        <ul class="feature-list">
                            ${this.features.map(f => `<li data-feature="${f.id}" class="${f.id === this.currentFeature ? 'active' : ''}">${f.label}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="flex-grow-1 overflow-auto" id="feature-content"></div>
                </div>
            </div>
        `;
        this.container.querySelectorAll('.feature-list li').forEach(item => {
            item.addEventListener('click', () => {
                const feature = item.dataset.feature;
                this.selectFeature(feature);
            });
        });
        this.renderCurrentFeature();
    }

    selectFeature(featureId) {
        this.currentFeature = featureId;
        this.container.querySelectorAll('.feature-list li').forEach(li => {
            li.classList.toggle('active', li.dataset.feature === featureId);
        });
        this.renderCurrentFeature();
    }

    renderCurrentFeature() {
        const feature = this.features.find(f => f.id === this.currentFeature);
        if (feature) feature.render();
    }

    renderConvert() {
        const content = document.getElementById('feature-content');
        content.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal"><i class="bi bi-arrow-left-right me-2"></i>Converter DOCX para PDF</h4>
                <p class="text-muted">Converta documentos Word para o formato PDF.</p>
            </div>
            <div class="card mb-3">
                <div class="card-body">
                    <div class="mb-2">
                        <label class="form-label">Arquivo DOCX</label>
                        <div class="input-group">
                            <input type="text" id="docx-input" class="form-control" placeholder="Selecione o arquivo .docx">
                            <button class="btn btn-outline-secondary" id="btn-docx-select">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Salvar PDF como (opcional)</label>
                        <div class="input-group">
                            <input type="text" id="docx-output" class="form-control" placeholder="Caminho de saída">
                            <button class="btn btn-outline-secondary" id="btn-docx-output">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>
            <button class="btn btn-success" id="btn-convert-docx">Converter</button>
            <div class="mt-3">
                <label class="fw-bold text-success">LOG</label>
                <div class="log-area" id="word-log">Log de operações vazio</div>
            </div>
        `;

        document.getElementById('btn-docx-select').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Word', extensions: ['docx'] }] })
                    .then(result => {
                        if (!result.canceled) document.getElementById('docx-input').value = result.filePaths[0];
                    });
            }
        });

        document.getElementById('btn-docx-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({ filters: [{ name: 'PDF', extensions: ['pdf'] }] })
                    .then(result => {
                        if (!result.canceled && result.filePath) {
                            document.getElementById('docx-output').value = result.filePath;
                        }
                    });
            }
        });

        document.getElementById('btn-convert-docx').addEventListener('click', async () => {
            const docxPath = document.getElementById('docx-input').value.trim();
            const outputPath = document.getElementById('docx-output').value.trim() || undefined;
            if (!docxPath) {
                this.log('Selecione um arquivo DOCX.', 'word-log');
                return;
            }
            try {
                const result = await window.API.word.convertToPdf({ docx_path: docxPath, output_path: outputPath });
                this.log(`Convertido para PDF: ${result.output_path}`, 'word-log');
            } catch (err) {
                this.log(`Erro: ${err.message}`, 'word-log');
            }
        });
    }

    renderExtract() {
        const content = document.getElementById('feature-content');
        content.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal"><i class="bi bi-file-text me-2"></i>Extrair Texto de DOCX</h4>
                <p class="text-muted">Extraia todo o texto de um documento Word.</p>
            </div>
            <div class="card mb-3">
                <div class="card-body">
                    <div class="mb-2">
                        <label class="form-label">Arquivo DOCX</label>
                        <div class="input-group">
                            <input type="text" id="extract-input" class="form-control" placeholder="Selecione o arquivo .docx">
                            <button class="btn btn-outline-secondary" id="btn-extract-select">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>
            <button class="btn btn-success" id="btn-extract-text">Extrair</button>
            <div class="mt-3">
                <label class="fw-bold text-success">LOG</label>
                <div class="log-area" id="extract-log">Log de operações vazio</div>
            </div>
            <div class="mt-2">
                <label class="fw-bold text-success">Texto Extraído</label>
                <textarea id="extracted-text" class="form-control" rows="8" readonly></textarea>
            </div>
        `;

        document.getElementById('btn-extract-select').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Word', extensions: ['docx'] }] })
                    .then(result => {
                        if (!result.canceled) document.getElementById('extract-input').value = result.filePaths[0];
                    });
            }
        });

        document.getElementById('btn-extract-text').addEventListener('click', async () => {
            const docxPath = document.getElementById('extract-input').value.trim();
            if (!docxPath) {
                this.log('Selecione um arquivo DOCX.', 'extract-log');
                return;
            }
            try {
                const result = await window.API.word.extractText({ docx_path: docxPath });
                document.getElementById('extracted-text').value = result.text;
                this.log('Texto extraído com sucesso.', 'extract-log');
            } catch (err) {
                this.log(`Erro: ${err.message}`, 'extract-log');
            }
        });
    }

    log(message, logId) {
        const logArea = document.getElementById(logId);
        if (logArea) {
            const p = document.createElement('p');
            p.textContent = message;
            logArea.appendChild(p);
            logArea.scrollTop = logArea.scrollHeight;
        }
    }
}
window.WordModule = WordModule;