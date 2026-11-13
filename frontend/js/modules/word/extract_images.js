class ExtractImagesFeature extends Feature {
    constructor(module) {
        super('extract');
        this.module = module;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Extrair Imagens</h4>
                <p class="text-muted">Extraia todas as imagens embutidas em um documento Word e salve-as como arquivos individuais.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Documento</h5>
                    <div class="input-group">
                        <input type="text" id="extract-input" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-extract-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Destino</h5>
                    <div class="input-group">
                        <input type="text" id="extract-output" class="form-control" placeholder="Pasta para salvar as imagens...">
                        <button class="btn btn-outline-secondary" id="btn-extract-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções</h5>
                    <div class="mb-2">
                        <label class="form-label">Prefixo para os arquivos (opcional)</label>
                        <input type="text" id="extract-prefix" class="form-control" placeholder="Deixe vazio para usar o nome do documento">
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-extract"><i class="bi bi-play-fill"></i> Extrair</button>

            ${this.progressHTML()}

            ${this.logHTML()}

            <div id="extract-result" style="display:none;" class="mt-3">
                <label class="fw-bold text-success">Imagens extraídas</label>
                <div id="extract-list" class="border rounded p-2" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-extract-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Word', extensions: ['docx', 'doc'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('extract-input').value = result.filePaths[0];
                    }
                });
            }
        });

        container.querySelector('#btn-extract-output').addEventListener('click', () => {
            FileUtils.selectDirectory('extract-output');
        });

        container.querySelector('#btn-extract').addEventListener('click', () => this.extractImages());
    }

    async extractImages() {
        const inputPath = document.getElementById('extract-input').value.trim();
        const outputDir = document.getElementById('extract-output').value.trim();
        const prefix = document.getElementById('extract-prefix').value.trim() || undefined;

        if (!inputPath || !outputDir) {
            this.log('Selecione o documento e a pasta de destino.');
            return;
        }

        const btn = document.getElementById('btn-extract');
        btn.disabled = true;
        this.clearLog();
        this.log('Extraindo imagens...');

        try {
            const result = await window.API.word.extractImages({
                input_path: inputPath,
                output_dir: outputDir,
                prefix: prefix
            });
            this.log(`Extraídas ${result.count} imagens.`);
            this.setProgress(100);

            const resultDiv = document.getElementById('extract-result');
            resultDiv.style.display = 'block';
            const listDiv = document.getElementById('extract-list');
            listDiv.innerHTML = result.images.map(img => `<div><i class="bi bi-image me-1"></i> ${img}</div>`).join('');
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}