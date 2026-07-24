class PDFExtractPagesFeature {
    constructor() {
        this.mode = 'all'; // 'all' ou 'selected'
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Extrair Páginas</h4>
                <p class="text-muted">Extraia páginas individuais ou selecionadas de um PDF.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="extract-pdf-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-extract-pdf-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Pasta de saída</h5>
                    <div class="input-group">
                        <input type="text" id="extract-pdf-output" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-extract-pdf-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Modo de extração</h5>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="extract-mode" id="extract-mode-all" value="all" checked>
                                <label class="form-check-label">Extrair todas as páginas</label>
                            </div>
                            <small class="text-muted">Cada página será salva como um arquivo PDF separado</small>
                        </div>
                        <div class="col-md-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="extract-mode" id="extract-mode-selected" value="selected">
                                <label class="form-check-label">Extrair páginas selecionadas</label>
                            </div>
                            <small class="text-muted">Ex: 1,3,5-7 (páginas 1, 3, 5, 6 e 7)</small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3" id="extract-selected-config" style="display:none;">
                <div class="card-body">
                    <h5 class="card-title text-success">Seleção de páginas</h5>
                    <div class="mb-2">
                        <label class="form-label">Páginas a extrair</label>
                        <input type="text" id="extract-pages-selection" class="form-control" placeholder="Ex: 1,3,5-7,10,15-20">
                        <small class="text-muted">Use números separados por vírgula ou intervalos com hífen</small>
                    </div>
                </div>
            </div>

            <div class="card mb-3" id="extract-combine-config" style="display:none;">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções de combinação</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="extract-combine">
                        <label class="form-check-label">Combinar páginas extraídas em um único PDF</label>
                    </div>
                    <div id="extract-combine-name-group" style="display:none;" class="mt-2">
                        <label class="form-label">Nome do arquivo combinado</label>
                        <input type="text" id="extract-combine-name" class="form-control" placeholder="Ex: paginas_extraidas" value="extracted_combined">
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Prefixo (opcional)</h5>
                    <input type="text" id="extract-prefix" class="form-control" placeholder="ex: pagina">
                </div>
            </div>

            <button class="btn btn-success" id="btn-extract-execute"><i class="bi bi-play-fill me-1"></i>Extrair</button>

            <div class="progress mt-2"><div class="progress-bar" id="extract-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="extract-log">Log de operações vazio</div>
            </div>
        `;

        // Eventos para alternar entre modos
        document.querySelectorAll('input[name="extract-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.mode = e.target.value;
                document.getElementById('extract-selected-config').style.display = (this.mode === 'selected') ? 'block' : 'none';
                document.getElementById('extract-combine-config').style.display = (this.mode === 'selected') ? 'block' : 'none';
            });
        });

        // Inicializar estado
        document.getElementById('extract-selected-config').style.display = 'none';
        document.getElementById('extract-combine-config').style.display = 'none';

        // Evento para mostrar/ocultar campo de nome do arquivo combinado
        document.getElementById('extract-combine').addEventListener('change', (e) => {
            document.getElementById('extract-combine-name-group').style.display = e.target.checked ? 'block' : 'none';
        });

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-extract-pdf-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('extract-pdf-input').value = result.filePaths[0];
                    }
                });
            }
        });

        document.getElementById('btn-extract-pdf-output').addEventListener('click', () => {
            FileUtils.selectDirectory('extract-pdf-output');
        });

        document.getElementById('btn-extract-execute').addEventListener('click', () => this.executeExtract());
    }

    async executeExtract() {
        const inputFile = document.getElementById('extract-pdf-input').value.trim();
        const outputDir = document.getElementById('extract-pdf-output').value.trim();
        const mode = this.mode;
        const prefix = document.getElementById('extract-prefix').value.trim();

        if (!inputFile || !outputDir) {
            FileUtils.log('Selecione o PDF e a pasta de destino.', 'extract-log');
            return;
        }

        const btn = document.getElementById('btn-extract-execute');
        btn.disabled = true;
        FileUtils.clearLog('extract-log');

        try {
            let result;

            if (mode === 'all') {
                FileUtils.log('Extraindo todas as páginas...', 'extract-log');
                result = await window.API.pdf.extractAllPages({
                    pdf_path: inputFile,
                    output_dir: outputDir,
                    prefix: prefix
                });
            } else {
                const pagesSelection = document.getElementById('extract-pages-selection').value.trim();
                if (!pagesSelection) {
                    FileUtils.log('Selecione pelo menos uma página.', 'extract-log');
                    btn.disabled = false;
                    return;
                }
                const combine = document.getElementById('extract-combine').checked;
                const combineName = document.getElementById('extract-combine-name').value.trim() || undefined;

                FileUtils.log('Extraindo páginas selecionadas...', 'extract-log');
                result = await window.API.pdf.extractSelectedPages({
                    pdf_path: inputFile,
                    output_dir: outputDir,
                    pages_selection: pagesSelection,
                    prefix: prefix,
                    combine: combine,
                    combine_name: combineName
                });
            }

            const { total_pages, total_files, output_files, combined_file, errors } = result;
            if (combined_file) {
                FileUtils.log(`Concluído! ${total_files} arquivos gerados.`, 'extract-log');
                FileUtils.log(`Arquivos combinados em: ${combined_file}`, 'extract-log');
            } else {
                FileUtils.log(`Concluído! ${total_files} arquivos gerados a partir de ${total_pages} páginas.`, 'extract-log');
                if (output_files.length <= 10) {
                    output_files.forEach(f => FileUtils.log(`  ${f}`, 'extract-log'));
                } else {
                    FileUtils.log(`  ${output_files.length} arquivos gerados na pasta ${outputDir}`, 'extract-log');
                }
            }
            if (errors.length) {
                FileUtils.log(`Erros: ${errors.length}`, 'extract-log');
                errors.forEach(e => FileUtils.log(`  ${e}`, 'extract-log'));
            }
            document.getElementById('extract-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'extract-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.PDFExtractPagesFeature = PDFExtractPagesFeature;