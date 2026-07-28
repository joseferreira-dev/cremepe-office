class HomePage {
    constructor(container) {
        this.container = container;
        this.storageKey = 'quickAccessCards';
        this.isEditing = false;
        this.draggedId = null;

        // ====== TODAS AS FUNCIONALIDADES DISPONÍVEIS (PRÉ‑DEFINIDAS) ======
        this.availableFeatures = [
            // ARQUIVOS
            { id: 'collect', icon: 'bi-folder2-open', title: 'Coletar Arquivos', desc: 'Reúna arquivos de múltiplas pastas.', section: 'Arquivos', page: 'files', feature: 'collect' },
            { id: 'rename', icon: 'bi-pencil-square', title: 'Renomear em Lote', desc: 'Renomeie vários arquivos de uma vez.', section: 'Arquivos', page: 'files', feature: 'rename' },
            { id: 'duplicates', icon: 'bi-files', title: 'Localizar Duplicatas', desc: 'Encontre arquivos duplicados.', section: 'Arquivos', page: 'files', feature: 'duplicates' },
            { id: 'organize', icon: 'bi-diagram-2', title: 'Organizar por Extensão', desc: 'Organize arquivos por tipo.', section: 'Arquivos', page: 'files', feature: 'organize' },
            { id: 'rename-by-content', icon: 'bi-tags', title: 'Renomear por Conteúdo', desc: 'Renomeie usando metadados.', section: 'Arquivos', page: 'files', feature: 'rename-by-content' },
            { id: 'attributes', icon: 'bi-sliders', title: 'Alterar Atributos', desc: 'Modifique datas e permissões.', section: 'Arquivos', page: 'files', feature: 'attributes' },
            { id: 'report', icon: 'bi-file-text', title: 'Relatório de Estrutura', desc: 'Exporte árvore de diretórios.', section: 'Arquivos', page: 'files', feature: 'report' },
            { id: 'compare', icon: 'bi-arrow-left-right', title: 'Comparar Pastas', desc: 'Compare e sincronize pastas.', section: 'Arquivos', page: 'files', feature: 'compare' },
            { id: 'archive', icon: 'bi-archive', title: 'Compactar/Extrair', desc: 'Crie ou extraia arquivos ZIP.', section: 'Arquivos', page: 'files', feature: 'archive' },
            { id: 'split-file', icon: 'bi-scissors', title: 'Dividir/Remontar', desc: 'Divida ou remonte arquivos grandes.', section: 'Arquivos', page: 'files', feature: 'split' },
            // PDF
            { id: 'pdf-merge', icon: 'bi-file-earmark-pdf', title: 'Combinar PDFs', desc: 'Mescle vários PDFs.', section: 'PDF', page: 'pdf', feature: 'merge' },
            { id: 'pdf-merge-size', icon: 'bi-file-earmark-pdf', title: 'Combinar por Tamanho', desc: 'Agrupe PDFs por limite de tamanho.', section: 'PDF', page: 'pdf', feature: 'merge-by-size' },
            { id: 'pdf-split', icon: 'bi-scissors', title: 'Dividir PDF', desc: 'Divida em partes com intervalos.', section: 'PDF', page: 'pdf', feature: 'split' },
            { id: 'pdf-split-size', icon: 'bi-rulers', title: 'Dividir por Tamanho', desc: 'Divida PDF por MB.', section: 'PDF', page: 'pdf', feature: 'split-by-size' },
            { id: 'pdf-extract', icon: 'bi-file-earmark-pdf', title: 'Extrair Páginas', desc: 'Extraia páginas específicas.', section: 'PDF', page: 'pdf', feature: 'extract-pages' },
            { id: 'pdf-remove', icon: 'bi-file-earmark-pdf', title: 'Remover Páginas', desc: 'Remova páginas indesejadas.', section: 'PDF', page: 'pdf', feature: 'remove-pages' },
            { id: 'pdf-reorder', icon: 'bi-files', title: 'Reordenar Páginas', desc: 'Altere a ordem das páginas.', section: 'PDF', page: 'pdf', feature: 'reorder' },
            { id: 'pdf-numbers', icon: 'bi-sort-numeric-down', title: 'Numerar Páginas', desc: 'Adicione numeração.', section: 'PDF', page: 'pdf', feature: 'add-page-numbers' },
            { id: 'pdf-to-word', icon: 'bi-file-word', title: 'PDF → Word', desc: 'Converta PDF para Word.', section: 'PDF', page: 'pdf', feature: 'convert-to-word' },
            { id: 'pdf-image', icon: 'bi-image', title: 'PDF ↔ Imagem', desc: 'Converta entre PDF e imagens.', section: 'PDF', page: 'pdf', feature: 'convert-to-image' },
            { id: 'pdf-compress', icon: 'bi-file-earmark-pdf', title: 'Comprimir PDF', desc: 'Reduza o tamanho do PDF.', section: 'PDF', page: 'pdf', feature: 'compress' },
            { id: 'pdf-protect', icon: 'bi-lock', title: 'Proteger/Desproteger', desc: 'Adicione ou remova senha.', section: 'PDF', page: 'pdf', feature: 'protect' },
            // WORD
            { id: 'word-merge', icon: 'bi-file-earmark-word', title: 'Juntar Documentos', desc: 'Combine vários Word.', section: 'Word', page: 'word', feature: 'merge' },
            { id: 'word-convert', icon: 'bi-arrow-left-right', title: 'Converter Word', desc: 'Converta para HTML, TXT, PDF, etc.', section: 'Word', page: 'word', feature: 'convert' },
            { id: 'word-compare', icon: 'bi-files', title: 'Comparar Docs', desc: 'Compare dois documentos.', section: 'Word', page: 'word', feature: 'compare' },
            { id: 'word-images', icon: 'bi-image', title: 'Extrair Imagens', desc: 'Extraia imagens do documento.', section: 'Word', page: 'word', feature: 'extract-images' },
            { id: 'word-watermark', icon: 'bi-droplet', title: 'Marca d\'Água', desc: 'Insira texto ou imagem.', section: 'Word', page: 'word', feature: 'watermark' },
            { id: 'word-filepath', icon: 'bi-file-earmark', title: 'Caminho do Arquivo', desc: 'Insira caminho no documento.', section: 'Word', page: 'word', feature: 'filepath' },
            // EXCEL
            { id: 'excel-convert', icon: 'bi-file-earmark-excel', title: 'Conversão em Lote', desc: 'Converta planilhas em lote.', section: 'Excel', page: 'excel', feature: 'convert' },
            { id: 'excel-merge', icon: 'bi-table', title: 'Combinar Planilhas', desc: 'Consolide várias planilhas.', section: 'Excel', page: 'excel', feature: 'merge-all' },
            { id: 'excel-extract', icon: 'bi-grid', title: 'Extrair Células', desc: 'Extraia células específicas.', section: 'Excel', page: 'excel', feature: 'extract-cells' },
            { id: 'excel-split', icon: 'bi-columns', title: 'Dividir por Coluna', desc: 'Divida pela coluna chave.', section: 'Excel', page: 'excel', feature: 'split' },
            { id: 'excel-sheets', icon: 'bi-files', title: 'Extrair Abas', desc: 'Separe abas em arquivos.', section: 'Excel', page: 'excel', feature: 'split-sheets' },
        ];
    }

    // ====== CARDS SALVOS ======
    getCards() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch (e) { }
        }
        return [];
    }

    saveCards(cards) {
        localStorage.setItem(this.storageKey, JSON.stringify(cards));
    }

    // ====== RENDER ======
    render() {
        const cards = this.getCards();
        const cardIds = cards.map(c => c.id);

        let cardsHtml = '';
        if (cards.length === 0) {
            cardsHtml = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-grid-3x3-gap" style="font-size: 2rem;"></i>
                    <p class="mt-2">Nenhum atalho adicionado. Clique em "Editar" e marque as funcionalidades desejadas.</p>
                </div>
            `;
        } else {
            cardsHtml = `<div class="row g-3" id="quick-access-grid">${this.renderCardItems(cards)}</div>`;
        }

        // Gerar lista de checkboxes, agrupados por seção
        const sections = ['Arquivos', 'PDF', 'Word', 'Excel'];
        let checkboxesHtml = '';
        sections.forEach(section => {
            const sectionFeatures = this.availableFeatures.filter(f => f.section === section);
            if (sectionFeatures.length === 0) return;
            checkboxesHtml += `
                <div class="mb-3">
                    <h6 class="text-success fw-bold">${section}</h6>
                    <div class="row">
                        ${sectionFeatures.map(f => `
                            <div class="col-md-6 col-lg-4">
                                <div class="form-check">
                                    <input class="form-check-input feature-checkbox" type="checkbox" value="${f.id}" id="chk-${f.id}" ${cardIds.includes(f.id) ? 'checked' : ''}>
                                    <label class="form-check-label" for="chk-${f.id}">
                                        <i class="bi ${f.icon}"></i> ${f.title}
                                    </label>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        this.container.innerHTML = `
            <div class="page active">
                <h1 class="module-title">Painel Inicial</h1>

                <div class="d-flex justify-content-between align-items-center mt-3 mb-3">
                    <h2 class="h5 text-success fw-normal mb-0">Acesso Rápido</h2>
                    <div>
                        <button class="btn btn-sm btn-outline-success" id="toggle-edit-mode">
                            <i class="bi bi-pencil"></i> ${this.isEditing ? 'Concluir edição' : 'Editar'}
                        </button>
                    </div>
                </div>

                <div id="quick-access-container">
                    ${cardsHtml}
                </div>

                <!-- Área de edição com checkboxes -->
                <div id="edit-area" style="${this.isEditing ? 'display:block;' : 'display:none;'}" class="mt-4 p-3 border rounded bg-light">
                    <h5 class="text-success"><i class="bi bi-check2-square"></i> Selecione as funcionalidades para exibir</h5>
                    <div id="checkboxes-container">
                        ${checkboxesHtml}
                    </div>
                    <div class="mt-3">
                        <button class="btn btn-success" id="apply-changes-btn">
                            <i class="bi bi-check2"></i> Aplicar alterações
                        </button>
                        <button class="btn btn-outline-secondary ms-2" id="reset-cards-btn">
                            <i class="bi bi-arrow-counterclockwise"></i> Restaurar vazio
                        </button>
                    </div>
                </div>

                <!-- Atividade Recente -->
                <h2 class="h5 text-success fw-normal mt-4 mb-3">Atividade Recente</h2>
                <div class="card p-0 border">
                    <div class="list-group list-group-flush">
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <strong><i class="bi bi-folder2-open me-2 text-success"></i>Coletar Arquivos</strong>
                            <span class="flex-grow-1 mx-2">Coletados 247 arquivos → C:\Destino</span>
                            <small class="text-muted">14:32</small>
                        </div>
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <strong><i class="bi bi-pencil-square me-2 text-success"></i>Renomear em Lote</strong>
                            <span class="flex-grow-1 mx-2">3 arquivos renomeados com prefixo CREME_</span>
                            <small class="text-muted">11:18</small>
                        </div>
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <strong><i class="bi bi-file-earmark-pdf me-2 text-danger"></i>Mesclar PDF</strong>
                            <span class="flex-grow-1 mx-2">Falha ao abrir contrato_v2.pdf</span>
                            <small class="text-muted">09:45</small>
                        </div>
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <strong><i class="bi bi-arrow-left-right me-2 text-success"></i>Converter Documento</strong>
                            <span class="flex-grow-1 mx-2">relatorio_anual.docx → relatorio_anual.pdf</span>
                            <small class="text-muted">Ontem</small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachEvents();
        if (this.isEditing) {
            this.initDragDrop();
        }
    }

    renderCardItems(cards) {
        return cards.map(card => `
            <div class="col-6 col-md-3 quick-card" draggable="${this.isEditing}" data-id="${card.id}">
                <div class="card h-100" data-page="${card.page}" data-feature="${card.feature}">
                    <div class="card-body d-flex flex-column">
                        <div class="card-icon mb-2"><i class="bi ${card.icon}"></i></div>
                        <h5 class="card-title">${card.title}</h5>
                        <p class="card-text">${card.desc}</p>
                        <span class="badge bg-secondary mb-2 align-self-start">${card.section}</span>
                        <button class="btn btn-success mt-auto align-self-start btn-open-card">Abrir</button>
                        ${this.isEditing ? `<button class="btn btn-sm btn-outline-danger mt-2 remove-card-btn" data-id="${card.id}"><i class="bi bi-trash"></i> Remover</button>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ====== EVENTOS ======
    attachEvents() {
        // Abrir funcionalidade
        this.container.querySelectorAll('.btn-open-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = e.target.closest('.card');
                const page = card.dataset.page;
                const feature = card.dataset.feature;
                window.navigateTo(page, feature);
            });
        });

        // Clique no card (exceto botões)
        this.container.querySelectorAll('.quick-card .card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-open-card') || e.target.closest('.remove-card-btn')) return;
                const page = card.dataset.page;
                const feature = card.dataset.feature;
                window.navigateTo(page, feature);
            });
        });

        // Alternar edição
        const toggleBtn = document.getElementById('toggle-edit-mode');
        toggleBtn.addEventListener('click', () => {
            this.isEditing = !this.isEditing;
            this.render();
        });

        // Aplicar alterações (checkboxes)
        const applyBtn = document.getElementById('apply-changes-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const checkedBoxes = document.querySelectorAll('.feature-checkbox:checked');
                const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);
                const selectedFeatures = this.availableFeatures.filter(f => selectedIds.includes(f.id));
                // Preservar a ordem existente (se o card já estiver na lista, mantém a posição)
                const currentCards = this.getCards();
                const updatedCards = [];
                // Primeiro, manter os cards que ainda estão selecionados, na ordem atual
                currentCards.forEach(card => {
                    if (selectedIds.includes(card.id)) {
                        updatedCards.push(card);
                    }
                });
                // Depois, adicionar os novos (que não estavam na lista)
                selectedFeatures.forEach(f => {
                    if (!updatedCards.some(c => c.id === f.id)) {
                        updatedCards.push({ ...f });
                    }
                });
                this.saveCards(updatedCards);
                this.render();
            });
        }

        // Restaurar vazio
        const resetBtn = document.getElementById('reset-cards-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Remover todos os atalhos da Home?')) {
                    this.saveCards([]);
                    this.render();
                }
            });
        }

        // Remover card (delegação)
        this.container.addEventListener('click', (e) => {
            if (e.target.closest('.remove-card-btn')) {
                const btn = e.target.closest('.remove-card-btn');
                const id = btn.dataset.id;
                if (!id) return;
                const cards = this.getCards();
                const card = cards.find(c => c.id === id);
                if (!card) return;
                if (confirm(`Remover o atalho "${card.title}"?`)) {
                    const updated = cards.filter(c => c.id !== id);
                    this.saveCards(updated);
                    this.render();
                }
            }
        });
    }

    // ====== DRAG & DROP ======
    initDragDrop() {
        const cards = this.getCards();
        const grid = document.getElementById('quick-access-grid');
        if (!grid) return;

        const items = grid.querySelectorAll('.quick-card');
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggedId = item.dataset.id;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', this.draggedId);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                document.querySelectorAll('.quick-card.drag-over').forEach(el => el.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const draggedId = e.dataTransfer.getData('text/plain');
                if (!draggedId || draggedId === item.dataset.id) return;

                const draggedCard = cards.find(c => c.id === draggedId);
                const targetCard = cards.find(c => c.id === item.dataset.id);
                if (!draggedCard || !targetCard) return;

                const fromIndex = cards.indexOf(draggedCard);
                const toIndex = cards.indexOf(targetCard);
                if (fromIndex === -1 || toIndex === -1) return;

                const [moved] = cards.splice(fromIndex, 1);
                const newToIndex = cards.indexOf(targetCard);
                cards.splice(newToIndex, 0, moved);
                this.saveCards(cards);
                this.render();
            });
        });
    }
}

window.HomePage = HomePage;