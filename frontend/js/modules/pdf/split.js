class PDFSplitFeature {
    constructor() {
        this.mode = 'custom'; // 'custom' ou 'fixed'
        this.previewData = null;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Dividir</h4>
                <p class="text-muted">Divida um PDF em partes com intervalos personalizados ou tamanho fixo.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="split-pdf-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-split-pdf-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Pasta de saída</h5>
                    <div class="input-group">
                        <input type="text" id="split-pdf-output" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-split-pdf-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Modo de divisão</h5>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="split-mode" id="split-mode-custom" value="custom" checked>
                                <label class="form-check-label">Intervalo Personalizado</label>
                            </div>
                            <small class="text-muted">Ex: 1-10, 15-16, 20-25</small>
                        </div>
                        <div class="col-md-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="split-mode" id="split-mode-fixed" value="fixed">
                                <label class="form-check-label">Intervalo Fixo</label>
                            </div>
                            <small class="text-muted">Dividir de X em X páginas</small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3" id="split-custom-config">
                <div class="card-body">
                    <h5 class="card-title text-success">Intervalos personalizados</h5>
                    <div class="mb-2">
                        <label class="form-label">Digite os intervalos</label>
                        <input type="text" id="split-intervals" class="form-control" placeholder="Ex: 1-10, 15-16, 20-25">
                    </div>
                </div>
            </div>

            <div class="card mb-3" id="split-fixed-config" style="display:none;">
                <div class="card-body">
                    <h5 class="card-title text-success">Intervalo Fixo</h5>
                    <div class="mb-2">
                        <label class="form-label">Páginas por arquivo</label>
                        <input type="number" id="split-pages-per-file" class="form-control" value="10" min="1">
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções de saída</h5>
                    <div class="mb-2">
                        <label class="form-label">Prefixo das partes</label>
                        <input type="text" id="split-part-prefix" class="form-control" placeholder="Ex: documento" value="part">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="split-combine">
                        <label class="form-check-label">Combinar em um único arquivo (não gera partes individuais)</label>
                    </div>
                    <div id="split-combine-name-container" style="display:none;" class="mt-2">
                        <label class="form-label">Nome do arquivo final</label>
                        <input type="text" id="split-combine-name" class="form-control" placeholder="Ex: documento_final" value="combined">
                        <small class="text-muted">O arquivo será salvo com extensão .pdf</small>
                    </div>
                </div>
            </div>

            <div class="d-flex gap-2">
                <button class="btn btn-outline-success" id="btn-split-preview"><i class="bi bi-eye me-1"></i>Pré-visualizar</button>
                <button class="btn btn-success" id="btn-split-execute"><i class="bi bi-play-fill me-1"></i>Dividir</button>
            </div>

            <div id="split-preview-area" style="display:none;" class="mt-3">
                <label class="fw-bold text-success">Pré-visualização</label>
                <div id="split-preview-list" class="border rounded p-2" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            <div class="progress mt-2"><div class="progress-bar" id="split-pdf-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="split-pdf-log">Log de operações vazio</div>
            </div>
        `;

        // Eventos para alternar entre modos
        document.querySelectorAll('input[name="split-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.mode = e.target.value;
                document.getElementById('split-custom-config').style.display = (this.mode === 'custom') ? 'block' : 'none';
                document.getElementById('split-fixed-config').style.display = (this.mode === 'fixed') ? 'block' : 'none';
            });
        });

        // Evento para mostrar/ocultar campo de nome combinado
        document.getElementById('split-combine').addEventListener('change', (e) => {
            document.getElementById('split-combine-name-container').style.display = e.target.checked ? 'block' : 'none';
        });

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-split-pdf-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('split-pdf-input').value = result.filePaths[0];
                    }
                });
            }
        });

        document.getElementById('btn-split-pdf-output').addEventListener('click', () => {
            FileUtils.selectDirectory('split-pdf-output');
        });

        document.getElementById('btn-split-preview').addEventListener('click', () => this.previewSplit());
        document.getElementById('btn-split-execute').addEventListener('click', () => this.executeSplit());
    }

    previewSplit() {
        const mode = this.mode;
        const intervalsStr = document.getElementById('split-intervals').value.trim();
        const pagesPerFile = parseInt(document.getElementById('split-pages-per-file').value);
        const combine = document.getElementById('split-combine').checked;
        const partPrefix = document.getElementById('split-part-prefix').value.trim() || 'part';
        const combineName = document.getElementById('split-combine-name').value.trim() || 'combined';

        const previewArea = document.getElementById('split-preview-area');
        previewArea.style.display = 'block';
        const listDiv = document.getElementById('split-preview-list');

        let html = '';
        if (mode === 'custom') {
            const parts = intervalsStr.split(',').map(s => s.trim()).filter(Boolean);
            if (parts.length === 0) {
                html = '<p class="text-muted">Nenhum intervalo definido.</p>';
            } else {
                html = `<strong>Intervalos definidos (${parts.length}):</strong><br>${parts.map(p => `- ${p}`).join('<br>')}`;
            }
        } else {
            html = `<strong>Intervalo fixo:</strong> ${pagesPerFile} páginas por arquivo`;
        }

        if (combine) {
            html += `<br><br><strong>Modo combinado:</strong> será gerado apenas o arquivo <strong>${combineName}.pdf</strong>`;
        } else {
            html += `<br><br><strong>Modo partes:</strong> serão gerados arquivos com prefixo <strong>${partPrefix}_</strong>`;
        }

        listDiv.innerHTML = html;
        FileUtils.log('Pré-visualização gerada.', 'split-pdf-log');
    }

    async executeSplit() {
        const inputFile = document.getElementById('split-pdf-input').value.trim();
        const outputDir = document.getElementById('split-pdf-output').value.trim();
        const mode = this.mode;
        const combine = document.getElementById('split-combine').checked;
        const partPrefix = document.getElementById('split-part-prefix').value.trim() || 'part';
        const combineName = document.getElementById('split-combine-name').value.trim() || 'combined';

        if (!inputFile || !outputDir) {
            FileUtils.log('Selecione o PDF e a pasta de destino.', 'split-pdf-log');
            return;
        }

        const btn = document.getElementById('btn-split-execute');
        btn.disabled = true;
        FileUtils.clearLog('split-pdf-log');
        FileUtils.log('Iniciando divisão...', 'split-pdf-log');

        try {
            let result;
            if (mode === 'custom') {
                const intervalsStr = document.getElementById('split-intervals').value.trim();
                if (!intervalsStr) {
                    FileUtils.log('Digite os intervalos.', 'split-pdf-log');
                    btn.disabled = false;
                    return;
                }
                result = await window.API.pdf.splitCustom({
                    pdf_path: inputFile,
                    output_dir: outputDir,
                    intervals_str: intervalsStr,
                    combine: combine,
                    part_prefix: partPrefix,
                    combine_name: combineName
                });
            } else {
                const pagesPerFile = parseInt(document.getElementById('split-pages-per-file').value);
                if (isNaN(pagesPerFile) || pagesPerFile < 1) {
                    FileUtils.log('Informe um número válido de páginas por arquivo.', 'split-pdf-log');
                    btn.disabled = false;
                    return;
                }
                result = await window.API.pdf.splitFixed({
                    pdf_path: inputFile,
                    output_dir: outputDir,
                    pages_per_file: pagesPerFile,
                    combine: combine,
                    part_prefix: partPrefix,
                    combine_name: combineName
                });
            }

            const { total_pages, total_files, output_files, combined_file, errors } = result;
            if (combine) {
                FileUtils.log(`Concluído! Arquivo combinado gerado: ${combined_file} (${total_pages} páginas)`, 'split-pdf-log');
            } else {
                FileUtils.log(`Concluído! ${total_files} arquivos gerados a partir de ${total_pages} páginas.`, 'split-pdf-log');
                if (output_files.length) {
                    FileUtils.log(`Arquivos:\n${output_files.join('\n')}`, 'split-pdf-log');
                }
            }
            if (errors.length) {
                FileUtils.log(`Erros: ${errors.length}`, 'split-pdf-log');
                errors.forEach(e => FileUtils.log(`  ${e}`, 'split-pdf-log'));
            }
            document.getElementById('split-pdf-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'split-pdf-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.PDFSplitFeature = PDFSplitFeature;