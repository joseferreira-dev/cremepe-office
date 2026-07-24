class PDFConvertToImageFeature {
    constructor() {
        this.mode = 'images_to_pdf'; // 'images_to_pdf' | 'pdf_to_images'
        this.imagePaths = [];
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Converter para Imagem</h4>
                <p class="text-muted">Converta imagens para PDF ou PDF para imagens.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Modo de conversão</h5>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-mode" id="mode-images-to-pdf" value="images_to_pdf" checked>
                                <label class="form-check-label">Imagem → PDF</label>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-mode" id="mode-pdf-to-images" value="pdf_to_images">
                                <label class="form-check-label">PDF → Imagem</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Imagem → PDF -->
            <div id="images-to-pdf-config">
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Arquivos de entrada (imagens)</h5>
                        <div class="input-group">
                            <input type="text" id="image-input-paths" class="form-control" placeholder="Selecione uma ou mais imagens">
                            <button class="btn btn-outline-secondary" id="btn-add-images">Adicionar imagens</button>
                            <button class="btn btn-outline-secondary" id="btn-clear-images">Limpar</button>
                        </div>
                        <div id="image-list" class="mt-2" style="max-height:150px; overflow:auto; font-size:0.9rem;"></div>
                    </div>
                </div>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Opções</h5>
                        <div class="row g-2">
                            <div class="col-md-4">
                                <label class="form-label">Margem (cm)</label>
                                <input type="number" id="margin-cm" class="form-control" value="0.5" step="0.1" min="0">
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Orientação</label>
                                <select id="orientation-select" class="form-select">
                                    <option value="portrait">Retrato</option>
                                    <option value="landscape">Paisagem</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Redimensionamento</label>
                                <select id="resize-mode" class="form-select">
                                    <option value="cover">Preencher (cortar excesso)</option>
                                    <option value="fit">Ajustar (centralizar)</option>
                                </select>
                            </div>
                        </div>
                        <!-- Modo de redimensionamento -->
                        <div class="row g-2 mt-2">
                            <div class="col-md-4 d-flex align-items-end">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="combine-images" checked>
                                    <label class="form-check-label">Combinar em único PDF</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Saída para arquivo único -->
                <div id="output-file-group" class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Arquivo de saída (PDF)</h5>
                        <div class="input-group">
                            <input type="text" id="image-to-pdf-output" class="form-control" placeholder="Caminho do PDF de saída">
                            <button class="btn btn-outline-secondary" id="btn-image-to-pdf-output">Selecionar</button>
                        </div>
                    </div>
                </div>

                <!-- Saída para múltiplos arquivos -->
                <div id="output-folder-group" style="display:none;" class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Pasta de saída</h5>
                        <div class="input-group">
                            <input type="text" id="image-to-pdf-folder" class="form-control" placeholder="Selecione a pasta de destino">
                            <button class="btn btn-outline-secondary" id="btn-image-to-pdf-folder">Selecionar</button>
                        </div>
                        <div class="mt-2">
                            <label class="form-label">Nome dos arquivos</label>
                            <div class="row g-2">
                                <div class="col-md-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="naming-mode" id="naming-original" value="original" checked>
                                        <label class="form-check-label">Manter nome original</label>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="naming-mode" id="naming-prefix" value="prefix">
                                        <label class="form-check-label">Usar prefixo</label>
                                    </div>
                                    <div id="prefix-group" style="display:none;" class="mt-1">
                                        <input type="text" id="image-prefix" class="form-control" placeholder="Prefixo" value="imagem">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- PDF → Imagem -->
            <div id="pdf-to-images-config" style="display:none;">
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Arquivos PDF de entrada</h5>
                        <div class="input-group">
                            <input type="text" id="pdf-input-paths" class="form-control" placeholder="Selecione um ou mais PDFs">
                            <button class="btn btn-outline-secondary" id="btn-add-pdfs">Adicionar PDFs</button>
                            <button class="btn btn-outline-secondary" id="btn-clear-pdfs">Limpar</button>
                        </div>
                        <div id="pdf-list" class="mt-2" style="max-height:150px; overflow:auto; font-size:0.9rem;"></div>
                    </div>
                </div>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Opções</h5>
                        <div class="row g-2">
                            <div class="col-md-4">
                                <label class="form-label">Páginas</label>
                                <input type="text" id="pdf-pages-selection" class="form-control" placeholder="Deixe em branco para todas">
                                <small class="text-muted">Ex: 1,3-5,10</small>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Formato da imagem</label>
                                <select id="image-format-select" class="form-select">
                                    <option value="png">PNG</option>
                                    <option value="jpg">JPG</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label">Prefixo (opcional)</label>
                                <input type="text" id="image-prefix-pdf" class="form-control" placeholder="ex: pagina">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success">Pasta de saída</h5>
                        <div class="input-group">
                            <input type="text" id="pdf-to-images-output" class="form-control" placeholder="Pasta para salvar as imagens">
                            <button class="btn btn-outline-secondary" id="btn-pdf-to-images-output">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-convert-image"><i class="bi bi-play-fill me-1"></i>Converter</button>

            <div class="progress mt-2"><div class="progress-bar" id="convert-image-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="convert-image-log">Log de operações vazio</div>
            </div>
        `;

        // Eventos para alternar modos
        document.querySelectorAll('input[name="convert-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.mode = e.target.value;
                document.getElementById('images-to-pdf-config').style.display = (this.mode === 'images_to_pdf') ? 'block' : 'none';
                document.getElementById('pdf-to-images-config').style.display = (this.mode === 'pdf_to_images') ? 'block' : 'none';
            });
        });

        // Evento para alternar entre arquivo/pasta conforme combine
        document.getElementById('combine-images').addEventListener('change', (e) => {
            const combine = e.target.checked;
            document.getElementById('output-file-group').style.display = combine ? 'block' : 'none';
            document.getElementById('output-folder-group').style.display = combine ? 'none' : 'block';
        });

        // Mostrar/ocultar campo de prefixo
        document.querySelectorAll('input[name="naming-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('prefix-group').style.display = (e.target.value === 'prefix') ? 'block' : 'none';
            });
        });

        this.attachEvents();
        this.updateImageList();
        this.updatePDFList();

        // Inicializar visibilidade
        document.getElementById('output-folder-group').style.display = 'none';
        document.getElementById('prefix-group').style.display = 'none';
    }

    attachEvents() {
        // Imagem → PDF
        document.getElementById('btn-add-images').addEventListener('click', () => this.addImages());
        document.getElementById('btn-clear-images').addEventListener('click', () => { this.imagePaths = []; this.updateImageList(); });
        document.getElementById('btn-image-to-pdf-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('image-to-pdf-output').value = result.filePath;
                    }
                });
            }
        });
        document.getElementById('btn-image-to-pdf-folder').addEventListener('click', () => {
            FileUtils.selectDirectory('image-to-pdf-folder');
        });

        // PDF → Imagem
        document.getElementById('btn-add-pdfs').addEventListener('click', () => this.addPDFs());
        document.getElementById('btn-clear-pdfs').addEventListener('click', () => {
            document.getElementById('pdf-input-paths').value = '';
            this.updatePDFList();
        });
        document.getElementById('btn-pdf-to-images-output').addEventListener('click', () => {
            FileUtils.selectDirectory('pdf-to-images-output');
        });

        // Botão principal
        document.getElementById('btn-convert-image').addEventListener('click', () => this.executeConvert());
    }

    // ====== IMAGEM → PDF ======
    async addImages() {
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            const result = await window.electronAPI.showOpenDialog({
                properties: ['openFile', 'multiSelections'],
                filters: [
                    { name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tiff', 'webp'] }
                ]
            });
            if (!result.canceled) {
                this.imagePaths.push(...result.filePaths);
                this.updateImageList();
            }
        }
    }

    updateImageList() {
        const list = document.getElementById('image-list');
        if (this.imagePaths.length === 0) {
            list.innerHTML = '<p class="text-muted">Nenhuma imagem selecionada.</p>';
            return;
        }
        list.innerHTML = this.imagePaths.map(p => `<div><i class="bi bi-file-earmark-image me-1"></i> ${p}</div>`).join('');
        document.getElementById('image-input-paths').value = this.imagePaths.join(', ');
    }

    // ====== PDF → IMAGEM ======
    async addPDFs() {
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            const result = await window.electronAPI.showOpenDialog({
                properties: ['openFile', 'multiSelections'],
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });
            if (!result.canceled) {
                const current = document.getElementById('pdf-input-paths').value;
                const newPaths = result.filePaths.join(', ');
                document.getElementById('pdf-input-paths').value = current ? current + ', ' + newPaths : newPaths;
                this.updatePDFList();
            }
        }
    }

    updatePDFList() {
        const val = document.getElementById('pdf-input-paths').value;
        const paths = val.split(',').map(s => s.trim()).filter(Boolean);
        const list = document.getElementById('pdf-list');
        if (paths.length === 0) {
            list.innerHTML = '<p class="text-muted">Nenhum PDF selecionado.</p>';
            return;
        }
        list.innerHTML = paths.map(p => `<div><i class="bi bi-file-earmark-pdf me-1"></i> ${p}</div>`).join('');
    }

    // ====== EXECUTAR ======
    async executeConvert() {
        const mode = this.mode;
        const btn = document.getElementById('btn-convert-image');
        btn.disabled = true;
        FileUtils.clearLog('convert-image-log');

        try {
            if (mode === 'images_to_pdf') {
                await this.convertImagesToPDF();
            } else {
                await this.convertPdfToImages();
            }
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'convert-image-log');
        } finally {
            btn.disabled = false;
        }
    }

    async convertImagesToPDF() {
        const imagePaths = this.imagePaths;
        const combine = document.getElementById('combine-images').checked;

        let outputPath, naming, prefix, resizeMode;

        if (combine) {
            outputPath = document.getElementById('image-to-pdf-output').value.trim();
            if (!outputPath) {
                FileUtils.log('Defina o caminho do arquivo PDF de saída.', 'convert-image-log');
                throw new Error('Caminho de saída ausente');
            }
            naming = 'prefix'; // não usado
            prefix = '';
        } else {
            outputPath = document.getElementById('image-to-pdf-folder').value.trim();
            if (!outputPath) {
                FileUtils.log('Selecione a pasta de destino.', 'convert-image-log');
                throw new Error('Pasta de destino ausente');
            }
            const namingRadio = document.querySelector('input[name="naming-mode"]:checked');
            naming = namingRadio ? namingRadio.value : 'original';
            prefix = document.getElementById('image-prefix').value.trim() || 'imagem';
        }

        resizeMode = document.getElementById('resize-mode').value; // 'cover' ou 'fit'

        if (imagePaths.length === 0) {
            FileUtils.log('Selecione pelo menos uma imagem.', 'convert-image-log');
            throw new Error('Nenhuma imagem selecionada');
        }

        const margin = parseFloat(document.getElementById('margin-cm').value) || 0.5;
        const orientation = document.getElementById('orientation-select').value;

        FileUtils.log(`Convertendo ${imagePaths.length} imagens para PDF (modo: ${combine ? 'combinado' : 'separado'})...`, 'convert-image-log');

        const result = await window.API.pdf.convertImagesToPDF({
            image_paths: imagePaths,
            output_path: outputPath,
            combine: combine,
            margin_cm: margin,
            orientation: orientation,
            resize_mode: resizeMode,
            naming: naming,
            prefix: prefix
        });

        const { total_images, output_files, combined_file, errors } = result;
        if (combined_file) {
            FileUtils.log(`Concluído! PDF combinado salvo em: ${combined_file}`, 'convert-image-log');
        } else {
            FileUtils.log(`Concluído! ${total_images} PDFs gerados na pasta ${outputPath}.`, 'convert-image-log');
            if (output_files.length <= 10) {
                output_files.forEach(f => FileUtils.log(`  ${f}`, 'convert-image-log'));
            } else {
                FileUtils.log(`  ${output_files.length} arquivos gerados.`, 'convert-image-log');
            }
        }
        if (errors.length) {
            FileUtils.log(`Erros: ${errors.length}`, 'convert-image-log');
            errors.forEach(e => FileUtils.log(`  ${e}`, 'convert-image-log'));
        }
        document.getElementById('convert-image-progress').style.width = '100%';
    }

    async convertPdfToImages() {
        const pdfPaths = document.getElementById('pdf-input-paths').value.split(',').map(s => s.trim()).filter(Boolean);
        const outputDir = document.getElementById('pdf-to-images-output').value.trim();
        const pagesSelection = document.getElementById('pdf-pages-selection').value.trim();
        const imageFormat = document.getElementById('image-format-select').value;
        const prefix = document.getElementById('image-prefix-pdf').value.trim();

        if (pdfPaths.length === 0 || !outputDir) {
            FileUtils.log('Selecione PDFs e a pasta de destino.', 'convert-image-log');
            throw new Error('Dados incompletos');
        }

        FileUtils.log(`Convertendo ${pdfPaths.length} PDF(s) para imagens...`, 'convert-image-log');
        const result = await window.API.pdf.convertPdfToImages({
            pdf_paths: pdfPaths,
            output_dir: outputDir,
            pages_selection: pagesSelection || 'all',
            image_format: imageFormat,
            prefix: prefix
        });

        const { total_pdfs, total_images, output_files, errors } = result;
        FileUtils.log(`Concluído! ${total_images} imagens geradas a partir de ${total_pdfs} PDF(s).`, 'convert-image-log');
        if (output_files.length <= 20) {
            output_files.forEach(f => FileUtils.log(`  ${f}`, 'convert-image-log'));
        } else {
            FileUtils.log(`  ${output_files.length} imagens salvas em ${outputDir}`, 'convert-image-log');
        }
        if (errors.length) {
            FileUtils.log(`Erros: ${errors.length}`, 'convert-image-log');
            errors.forEach(e => FileUtils.log(`  ${e}`, 'convert-image-log'));
        }
        document.getElementById('convert-image-progress').style.width = '100%';
    }
}

window.PDFConvertToImageFeature = PDFConvertToImageFeature;