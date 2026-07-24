class PDFMergeFeature {
    constructor() {
        this.files = []; // array de objetos { path, name, thumbnail }
        this.thumbnailCache = {}; // cache de thumbnails
        this.draggedIndex = null;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Combinar PDFs</h4>
                <p class="text-muted">Combine vários PDFs em um único documento. Arraste para reordenar.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivos PDF</h5>
                    <div class="mb-2">
                        <div class="input-group">
                            <button class="btn btn-outline-success" id="btn-pdf-merge-add">
                                <i class="bi bi-plus-circle me-1"></i> Adicionar PDFs
                            </button>
                            <button class="btn btn-outline-secondary" id="btn-pdf-merge-clear">
                                <i class="bi bi-trash me-1"></i> Limpar todos
                            </button>
                        </div>
                    </div>
                    <div id="pdf-merge-list" class="border rounded p-2" style="min-height:100px; max-height:400px; overflow-y:auto;">
                        <p class="text-muted text-center my-3">Nenhum PDF adicionado. Clique em "Adicionar PDFs" para começar.</p>
                    </div>
                    <div class="mt-2 text-muted small">
                        <i class="bi bi-arrows-move me-1"></i> Arraste os itens para reordenar
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="pdf-merge-output" class="form-control" placeholder="Caminho do arquivo final">
                        <button class="btn btn-outline-secondary" id="btn-pdf-merge-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="d-flex gap-2">
                <button class="btn btn-success" id="btn-pdf-merge"><i class="bi bi-play-fill me-1"></i> Juntar</button>
                <button class="btn btn-outline-secondary" id="btn-pdf-merge-preview"><i class="bi bi-eye me-1"></i> Pré-visualizar ordem</button>
            </div>

            <div class="progress mt-2"><div class="progress-bar" id="pdf-merge-progress" style="width:0%"></div></div>

            <div class="mt-3">
                <label class="fw-bold text-success">LOG DE OPERAÇÕES</label>
                <div class="log-area" id="pdf-merge-log">Log de operações vazio</div>
            </div>
        `;

        // Atualiza lista com os arquivos existentes (se houver)
        this.updateList();
        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-pdf-merge-add').addEventListener('click', () => this.addPDFs());
        document.getElementById('btn-pdf-merge-clear').addEventListener('click', () => this.clearAll());
        document.getElementById('btn-pdf-merge-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('pdf-merge-output').value = result.filePath;
                    }
                });
            }
        });
        document.getElementById('btn-pdf-merge').addEventListener('click', () => this.mergePDFs());
        document.getElementById('btn-pdf-merge-preview').addEventListener('click', () => this.previewOrder());

        // Adicionar atalho para arrastar e soltar na lista
        const list = document.getElementById('pdf-merge-list');
        list.addEventListener('dragover', (e) => this.handleDragOver(e));
        list.addEventListener('drop', (e) => this.handleDrop(e));
        list.addEventListener('dragend', () => this.draggedIndex = null);
    }

    async addPDFs() {
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            const result = await window.electronAPI.showOpenDialog({
                properties: ['openFile', 'multiSelections'],
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });
            if (!result.canceled) {
                for (const filePath of result.filePaths) {
                    // Evitar duplicatas
                    if (this.files.some(f => f.path === filePath)) continue;
                    this.files.push({
                        path: filePath,
                        name: filePath.split(/[\\/]/).pop(),
                        thumbnail: null // será carregado depois
                    });
                }
                // Carregar thumbnails em lote
                await this.loadThumbnails();
                this.updateList();
                FileUtils.log(`${this.files.length} PDF(s) adicionados.`, 'pdf-merge-log');
            }
        }
    }

    clearAll() {
        if (this.files.length === 0) return;
        if (!confirm('Remover todos os PDFs da lista?')) return;
        this.files = [];
        this.thumbnailCache = {};
        this.updateList();
        FileUtils.log('Lista limpa.', 'pdf-merge-log');
    }

    async loadThumbnails() {
        // Carregar thumbnail para cada arquivo que ainda não tem
        for (const file of this.files) {
            if (!file.thumbnail) {
                try {
                    const thumb = await this.renderThumbnail(file.path);
                    file.thumbnail = thumb;
                } catch (err) {
                    console.warn('Erro ao carregar thumbnail:', err);
                    // Usar um ícone de fallback
                    file.thumbnail = null;
                }
            }
        }
    }

    renderThumbnail(filePath) {
        return new Promise((resolve, reject) => {
            const loadingTask = pdfjsLib.getDocument(filePath);
            loadingTask.promise.then(pdf => {
                pdf.getPage(1).then(page => {
                    const viewport = page.getViewport({ scale: 1 });
                    const scale = 120 / viewport.width; // largura fixa 120px
                    const scaledViewport = page.getViewport({ scale });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = scaledViewport.width;
                    canvas.height = scaledViewport.height;
                    const renderContext = {
                        canvasContext: context,
                        viewport: scaledViewport
                    };
                    page.render(renderContext).promise.then(() => {
                        resolve(canvas.toDataURL());
                    }).catch(reject);
                }).catch(reject);
            }).catch(reject);
        });
    }

    updateList() {
        const list = document.getElementById('pdf-merge-list');
        if (this.files.length === 0) {
            list.innerHTML = `<p class="text-muted text-center my-3">Nenhum PDF adicionado. Clique em "Adicionar PDFs" para começar.</p>`;
            return;
        }

        // Gerar HTML dos itens
        let html = `<div class="pdf-items">`;
        this.files.forEach((file, index) => {
            const thumbSrc = file.thumbnail || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160"%3E%3Crect width="120" height="160" fill="%23f0f0f0"/%3E%3Ctext x="60" y="80" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle"%3EPDF%3C/text%3E%3C/svg%3E';
            html += `
                <div class="pdf-item" draggable="true" data-index="${index}" style="display:inline-block; margin:6px; padding:4px; border:1px solid #dee2e6; border-radius:6px; background:white; cursor:grab; width:120px; text-align:center; vertical-align:top;">
                    <img src="${thumbSrc}" alt="${file.name}" style="width:100%; height:auto; border-radius:4px;">
                    <div style="font-size:11px; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:110px;" title="${file.name}">${file.name}</div>
                    <button class="btn btn-sm btn-outline-danger" style="margin-top:4px; padding:1px 6px; font-size:10px;" data-remove="${index}">✕</button>
                </div>
            `;
        });
        html += `</div>`;
        list.innerHTML = html;

        // Adicionar eventos de drag
        list.querySelectorAll('.pdf-item').forEach(item => {
            item.addEventListener('dragstart', (e) => this.handleDragStart(e));
            item.addEventListener('dragover', (e) => e.preventDefault());
            item.addEventListener('dragenter', (e) => e.preventDefault());
        });

        // Eventos para remover
        list.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.remove);
                this.removeItem(index);
            });
        });
    }

    removeItem(index) {
        if (index < 0 || index >= this.files.length) return;
        this.files.splice(index, 1);
        // Limpar cache de thumbnail (opcional)
        this.updateList();
        FileUtils.log(`PDF removido da lista.`, 'pdf-merge-log');
    }

    // Drag and Drop handlers
    handleDragStart(e) {
        const item = e.target.closest('.pdf-item');
        if (!item) return;
        const index = parseInt(item.dataset.index);
        this.draggedIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index);
        // Adicionar classe para feedback visual
        setTimeout(() => item.classList.add('dragging'), 0);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDrop(e) {
        e.preventDefault();
        const target = e.target.closest('.pdf-item');
        if (!target) return;
        const targetIndex = parseInt(target.dataset.index);
        if (this.draggedIndex === null || this.draggedIndex === targetIndex) return;

        // Reordenar array
        const [removed] = this.files.splice(this.draggedIndex, 1);
        this.files.splice(targetIndex, 0, removed);
        this.draggedIndex = null;
        this.updateList();
        FileUtils.log('Ordem dos PDFs alterada.', 'pdf-merge-log');
    }

    previewOrder() {
        if (this.files.length === 0) {
            FileUtils.log('Adicione PDFs primeiro.', 'pdf-merge-log');
            return;
        }
        const order = this.files.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
        alert(`Ordem dos PDFs:\n\n${order}`);
    }

    async mergePDFs() {
        const files = this.files.map(f => f.path);
        const output = document.getElementById('pdf-merge-output').value.trim();

        if (!files.length || !output) {
            FileUtils.log('Selecione os PDFs e defina o destino.', 'pdf-merge-log');
            return;
        }

        const btn = document.getElementById('btn-pdf-merge');
        btn.disabled = true;
        FileUtils.clearLog('pdf-merge-log');
        FileUtils.log(`Juntando ${files.length} PDFs na ordem definida...`, 'pdf-merge-log');

        try {
            const result = await window.API.pdf.merge({
                pdf_paths: files,
                output_path: output
            });
            FileUtils.log(`Concluído! PDF salvo em: ${result.output_path}`, 'pdf-merge-log');
            document.getElementById('pdf-merge-progress').style.width = '100%';
        } catch (err) {
            FileUtils.log(`Erro: ${err.message}`, 'pdf-merge-log');
        } finally {
            btn.disabled = false;
        }
    }
}

window.PDFMergeFeature = PDFMergeFeature;