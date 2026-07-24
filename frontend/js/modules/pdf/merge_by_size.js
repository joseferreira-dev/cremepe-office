class PDFMergeBySizeFeature {
    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Combinar por Tamanho</h4>
                <p class="text-muted">Agrupe PDFs de uma pasta em lotes com tamanho máximo definido. Arquivos individuais que excedem o limite são copiados separadamente.</p>
            </div>

            <!-- Pastas (lado a lado) -->
            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Pastas</h5>
                    <div class="row g-2">
                        <div class="col-md-12">
                            <label class="form-label">Pasta de origem</label>
                            <div class="input-group">
                                <input type="text" id="pdf-merge-size-source" class="form-control" placeholder="Selecione a pasta...">
                                <button class="btn btn-outline-secondary" id="btn-pdf-merge-size-source">Selecionar</button>
                            </div>
                        </div>
                        <div class="col-md-12">
                            <label class="form-label">Pasta de destino</label>
                            <div class="input-group">
                                <input type="text" id="pdf-merge-size-dest" class="form-control" placeholder="Selecione a pasta...">
                                <button class="btn btn-outline-secondary" id="btn-pdf-merge-size-dest">Selecionar</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Configurações (lado a lado) -->
            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Configurações</h5>
                    <div class="row g-2">
                        <div class="col-md-6">
                            <label class="form-label">Tamanho máximo (MB)</label>
                            <input type="number" id="pdf-merge-size-max" class="form-control" value="50" min="1" step="0.5">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Ordem dos arquivos</label>
                            <select id="pdf-merge-size-order" class="form-select">
                                <option value="name">Alfabética (A-Z)</option>
                                <option value="mtime">Data de modificação (mais recente primeiro)</option>
                                <option value="mtime_old">Data de modificação (mais antigo primeiro)</option>
                            </select>
                        </div>
                        <div class="col-md-12">
                            <label class="form-label">Prefixo (opcional)</label>
                            <input type="text" id="pdf-merge-size-prefix" class="form-control" placeholder="ex: relatorio_">
                        </div>
                        <div class="col-md-12 d-flex align-items-end">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="pdf-merge-size-recursive">
                                <label class="form-check-label">Incluir subpastas</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-pdf-merge-size"><i class="bi bi-play-fill"></i> Combinar</button>

            <div class="progress mt-2"><div class="progress-bar" id="pdf-merge-size-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="pdf-merge-size-log">Log de operações vazio</div>
            </div>
        `;

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-pdf-merge-size-source').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('pdf-merge-size-source');
        });

        document.getElementById('btn-pdf-merge-size-dest').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('pdf-merge-size-dest');
        });

        document.getElementById('btn-pdf-merge-size').addEventListener('click', () => this.mergeBySize());
    }

    async mergeBySize() {
        const sourceDir = document.getElementById('pdf-merge-size-source').value.trim();
        const destDir = document.getElementById('pdf-merge-size-dest').value.trim();
        const maxSize = parseFloat(document.getElementById('pdf-merge-size-max').value);
        const orderBy = document.getElementById('pdf-merge-size-order').value;
        const prefix = document.getElementById('pdf-merge-size-prefix').value.trim() || undefined;
        const recursive = document.getElementById('pdf-merge-size-recursive').checked;

        if (!sourceDir || !destDir) {
            FileUtils.log('Selecione as pastas de origem e destino.', 'pdf-merge-size-log');
            return;
        }
        if (sourceDir === destDir) {
            FileUtils.log('Origem e destino não podem ser iguais.', 'pdf-merge-size-log');
            return;
        }
        if (isNaN(maxSize) || maxSize <= 0) {
            FileUtils.log('Informe um tamanho máximo válido.', 'pdf-merge-size-log');
            return;
        }

        const btn = document.getElementById('btn-pdf-merge-size');
        btn.disabled = true;
        FileUtils.clearLog('pdf-merge-size-log');
        FileUtils.log(`Iniciando combinação com limite de ${maxSize} MB...`, 'pdf-merge-size-log');

        try {
            const result = await window.API.pdf.mergeBySize({
                source_dir: sourceDir,
                dest_dir: destDir,
                max_size_mb: maxSize,
                order_by: orderBy,
                prefix: prefix,
                recursive: recursive
            });

            const { processed, merged_groups, copied_files, errors } = result;
            FileUtils.log(`Concluído! ${processed} arquivos processados.`, 'pdf-merge-size-log');
            FileUtils.log(`  ${merged_groups} grupos combinados`, 'pdf-merge-size-log');
            FileUtils.log(`  ${copied_files} arquivos individuais copiados (excederam o limite)`, 'pdf-merge-size-log');
            if (errors.length) {
                FileUtils.log(`Erros: ${errors.length}`, 'pdf-merge-size-log');
                errors.forEach(e => FileUtils.log(`  ${e}`, 'pdf-merge-size-log'));
            }
            document.getElementById('pdf-merge-size-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'pdf-merge-size-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.PDFMergeBySizeFeature = PDFMergeBySizeFeature;