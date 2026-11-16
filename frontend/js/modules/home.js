import { Feature } from './feature.js';
import { ExcelModule } from './excel/index.js';
import { FileModule } from './file/index.js';
import { PDFModule } from './pdf/index.js';
import { WordModule } from './word/index.js';

// Metadados exclusivos da Home por "pagina/feature": id legado do card
// (persistido no electron-store), icone, titulo e descricao. A lista de
// funcionalidades e a navegacao vem dos modulos (static features de cada
// index.js) — meta ausente degrada para o label da feature.
const HOME_META = {
    // ARQUIVOS
    'files/collect': { id: 'collect', icon: 'bi-folder2-open', title: 'Coletar Arquivos', desc: 'Reúna arquivos de múltiplas pastas.' },
    'files/rename': { id: 'rename', icon: 'bi-pencil-square', title: 'Renomear em Lote', desc: 'Renomeie vários arquivos de uma vez.' },
    'files/duplicates': { id: 'duplicates', icon: 'bi-files', title: 'Localizar Duplicatas', desc: 'Encontre arquivos duplicados.' },
    'files/organize': { id: 'organize', icon: 'bi-diagram-2', title: 'Organizar por Extensão', desc: 'Organize arquivos por tipo.' },
    'files/rename-by-content': { id: 'rename-by-content', icon: 'bi-tags', title: 'Renomear por Conteúdo', desc: 'Renomeie usando metadados.' },
    'files/attributes': { id: 'attributes', icon: 'bi-sliders', title: 'Alterar Atributos', desc: 'Modifique datas e permissões.' },
    'files/report': { id: 'report', icon: 'bi-file-text', title: 'Relatório de Estrutura', desc: 'Exporte árvore de diretórios.' },
    'files/compare': { id: 'compare', icon: 'bi-arrow-left-right', title: 'Comparar Pastas', desc: 'Compare e sincronize pastas.' },
    'files/archive': { id: 'archive', icon: 'bi-archive', title: 'Compactar/Extrair', desc: 'Crie ou extraia arquivos ZIP.' },
    'files/split': { id: 'split-file', icon: 'bi-scissors', title: 'Dividir/Remontar', desc: 'Divida ou remonte arquivos grandes.' },
    // PDF
    'pdf/merge': { id: 'pdf-merge', icon: 'bi-file-earmark-pdf', title: 'Combinar PDFs', desc: 'Mescle vários PDFs.' },
    'pdf/merge-by-size': { id: 'pdf-merge-size', icon: 'bi-file-earmark-pdf', title: 'Combinar por Tamanho', desc: 'Agrupe PDFs por limite de tamanho.' },
    'pdf/split': { id: 'pdf-split', icon: 'bi-scissors', title: 'Dividir PDF', desc: 'Divida em partes com intervalos.' },
    'pdf/split-by-size': { id: 'pdf-split-size', icon: 'bi-rulers', title: 'Dividir por Tamanho', desc: 'Divida PDF por MB.' },
    'pdf/extract-pages': { id: 'pdf-extract', icon: 'bi-file-earmark-pdf', title: 'Extrair Páginas', desc: 'Extraia páginas específicas.' },
    'pdf/remove-pages': { id: 'pdf-remove', icon: 'bi-file-earmark-pdf', title: 'Remover Páginas', desc: 'Remova páginas indesejadas.' },
    'pdf/reorder': { id: 'pdf-reorder', icon: 'bi-files', title: 'Reordenar Páginas', desc: 'Altere a ordem das páginas.' },
    'pdf/add-page-numbers': { id: 'pdf-numbers', icon: 'bi-sort-numeric-down', title: 'Numerar Páginas', desc: 'Adicione numeração.' },
    'pdf/convert-to-word': { id: 'pdf-to-word', icon: 'bi-file-word', title: 'PDF → Word', desc: 'Converta PDF para Word.' },
    'pdf/convert-to-image': { id: 'pdf-image', icon: 'bi-image', title: 'PDF ↔ Imagem', desc: 'Converta entre PDF e imagens.' },
    'pdf/compress': { id: 'pdf-compress', icon: 'bi-file-earmark-pdf', title: 'Comprimir PDF', desc: 'Reduza o tamanho do PDF.' },
    'pdf/protect': { id: 'pdf-protect', icon: 'bi-lock', title: 'Proteger/Desproteger', desc: 'Adicione ou remova senha.' },
    // WORD
    'word/merge': { id: 'word-merge', icon: 'bi-file-earmark-word', title: 'Juntar Documentos', desc: 'Combine vários Word.' },
    'word/convert': { id: 'word-convert', icon: 'bi-arrow-left-right', title: 'Converter Word', desc: 'Converta para HTML, TXT, PDF, etc.' },
    'word/compare': { id: 'word-compare', icon: 'bi-files', title: 'Comparar Docs', desc: 'Compare dois documentos.' },
    'word/extract-images': { id: 'word-images', icon: 'bi-image', title: 'Extrair Imagens', desc: 'Extraia imagens do documento.' },
    'word/watermark': { id: 'word-watermark', icon: 'bi-droplet', title: "Marca d'Água", desc: 'Insira texto ou imagem.' },
    'word/filepath': { id: 'word-filepath', icon: 'bi-file-earmark', title: 'Caminho do Arquivo', desc: 'Insira caminho no documento.' },
    // EXCEL
    'excel/convert': { id: 'excel-convert', icon: 'bi-file-earmark-excel', title: 'Conversão em Lote', desc: 'Converta planilhas em lote.' },
    'excel/merge-all': { id: 'excel-merge', icon: 'bi-table', title: 'Combinar Planilhas', desc: 'Consolide várias planilhas.' },
    'excel/extract-cells': { id: 'excel-extract', icon: 'bi-grid', title: 'Extrair Células', desc: 'Extraia células específicas.' },
    'excel/split': { id: 'excel-split', icon: 'bi-columns', title: 'Dividir por Coluna', desc: 'Divida pela coluna chave.' },
    'excel/split-sheets': { id: 'excel-sheets', icon: 'bi-files', title: 'Extrair Abas', desc: 'Separe abas em arquivos.' },
};

// Ordem das seções na edição de atalhos + módulos consumidos
const MODULE_CATALOG = [
    { page: 'files', section: 'Arquivos', module: FileModule },
    { page: 'pdf', section: 'PDF', module: PDFModule },
    { page: 'word', section: 'Word', module: WordModule },
    { page: 'excel', section: 'Excel', module: ExcelModule },
];

// Atalhos semeados na primeira execução (store sem a chave). Uma vez
// gravados, passam a valer as escolhas do usuário — inclusive o
// "Restaurar vazio", que não é ressemear.
const DEFAULT_SHORTCUT_IDS = [
    'collect', 'rename', 'duplicates',
    'pdf-merge', 'pdf-split', 'pdf-compress',
    'word-convert', 'excel-convert',
];

function buildAvailableFeatures() {
    return MODULE_CATALOG.flatMap(({ page, section, module }) =>
        module.features.map((f) => {
            const meta = HOME_META[`${page}/${f.id}`] || {};
            return {
                id: meta.id || `${page}-${f.id}`,
                icon: meta.icon || 'bi-play-circle',
                title: meta.title || f.label,
                desc: meta.desc || '',
                section,
                page,
                feature: f.id,
            };
        })
    );
}

export class HomePage extends Feature {
    constructor(container) {
        super('home');
        this.container = container;
        this.storageKey = 'quickAccessCards';
        this.isEditing = false;
        this.draggedId = null;
        this.cards = [];

        // Catálogo derivado dos módulos (fonte única de ids/navegação)
        this.availableFeatures = buildAvailableFeatures();

        // Inicializa eventos uma única vez
        this.setupEventListeners();
    }

    // ====== CARDS: ler do electron-store ======
    async getCards() {
        if (window.electronAPI && window.electronAPI.storeGet) {
            try {
                const stored = await window.electronAPI.storeGet(this.storageKey);
                if (Array.isArray(stored)) {
                    return stored;
                }
                if (stored === undefined || stored === null) {
                    // Primeira execução: semeia os atalhos padrão
                    const seeded = DEFAULT_SHORTCUT_IDS
                        .map((id) => this.availableFeatures.find((f) => f.id === id))
                        .filter(Boolean);
                    if (seeded.length > 0) {
                        await this.saveCards(seeded);
                        return seeded;
                    }
                }
            } catch (e) {
                console.warn('Erro ao ler store:', e);
            }
        }
        return [];
    }

    async saveCards(cards) {
        if (window.electronAPI && window.electronAPI.storeSet) {
            try {
                await window.electronAPI.storeSet(this.storageKey, cards);
                return true;
            } catch (e) {
                console.warn('Erro ao salvar store:', e);
                return false;
            }
        }
        return false;
    }

    // ====== RENDER ======
    async render() {
        this.cards = await this.getCards();
        const cardIds = this.cards.map(c => c.id);

        let cardsHtml;
        if (this.cards.length === 0) {
            cardsHtml = `
                <div class="rounded-xl border border-dashed border-slate-300 py-10 text-center">
                    <i class="bi bi-grid-3x3-gap text-4xl text-slate-300"></i>
                    <p class="mt-3 text-sm text-muted">Nenhum atalho adicionado. Clique em "Editar" e marque as funcionalidades desejadas.</p>
                </div>
            `;
        } else {
            cardsHtml = `<div class="grid grid-cols-12 gap-4" id="quick-access-grid">${this.renderCardItems(this.cards)}</div>`;
        }

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

                <div class="mb-4 flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-slate-900">Acesso Rápido</h2>
                    <div>
                        <button class="btn btn-outline-success btn-sm" id="toggle-edit-mode">
                            <i class="bi bi-pencil"></i> ${this.isEditing ? 'Concluir edição' : 'Editar'}
                        </button>
                    </div>
                </div>

                <div id="quick-access-container">
                    ${cardsHtml}
                </div>

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
            </div>
        `;

        // Após atualizar o DOM, reaplica os eventos de drag (se necessário)
        if (this.isEditing) {
            this.initDragDrop();
        }
    }

    renderCardItems(cards) {
        return cards.map(card => `
            <div class="col-span-6 md:col-span-3 quick-card" draggable="${this.isEditing}" data-id="${card.id}">
                <div class="card h-full" data-page="${card.page}" data-feature="${card.feature}">
                    <div class="card-body">
                        <div class="card-icon mb-1"><i class="bi ${card.icon}"></i></div>
                        <h5 class="card-title">${card.title}</h5>
                        <p class="card-text">${card.desc}</p>
                        <div class="mt-auto flex items-center gap-2 pt-1">
                            <span class="badge">${card.section}</span>
                        </div>
                        <button class="btn btn-success w-full btn-open-card">Abrir</button>
                        ${this.isEditing ? `<button class="btn btn-outline-danger btn-sm w-full remove-card-btn" data-id="${card.id}"><i class="bi bi-trash"></i> Remover</button>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ====== CONFIGURAÇÃO DE EVENTOS (UMA ÚNICA VEZ) ======
    setupEventListeners() {
        // Delegação para todos os eventos do container
        // this.on() rastreia o listener: o #page-container persiste entre
        // visitas, então destroy() o remove quando a home é descartada.
        this.on(this.container, 'click', async (e) => {
            const target = e.target;

            // 1. Botão "Abrir" no card
            if (target.closest('.btn-open-card')) {
                e.stopPropagation();
                const card = target.closest('.card');
                const page = card.dataset.page;
                const feature = card.dataset.feature;
                if (page && feature) {
                    window.navigateTo(page, feature);
                }
                return;
            }

            // 2. Clique no card (qualquer área, exceto botões)
            if (target.closest('.quick-card .card') && !target.closest('.btn-open-card') && !target.closest('.remove-card-btn')) {
                const card = target.closest('.card');
                const page = card.dataset.page;
                const feature = card.dataset.feature;
                if (page && feature) {
                    window.navigateTo(page, feature);
                }
                return;
            }

            // 3. Botão "Remover"
            if (target.closest('.remove-card-btn')) {
                e.stopPropagation();
                const btn = target.closest('.remove-card-btn');
                const id = btn.dataset.id;
                if (!id) return;
                const card = this.cards.find(c => c.id === id);
                if (!card) return;
                if (confirm(`Remover o atalho "${card.title}"?`)) {
                    const updated = this.cards.filter(c => c.id !== id);
                    await this.saveCards(updated);
                    this.render();
                }
                return;
            }

            // 4. Alternar edição
            if (target.id === 'toggle-edit-mode') {
                this.isEditing = !this.isEditing;
                this.render();
                return;
            }

            // 5. Aplicar alterações (checkboxes)
            if (target.id === 'apply-changes-btn') {
                const checkedBoxes = document.querySelectorAll('.feature-checkbox:checked');
                const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);
                const selectedFeatures = this.availableFeatures.filter(f => selectedIds.includes(f.id));
                const currentCards = this.cards;
                const updatedCards = [];
                // Manter a ordem dos cards existentes
                currentCards.forEach(card => {
                    if (selectedIds.includes(card.id)) {
                        updatedCards.push(card);
                    }
                });
                // Adicionar novos que não estavam na lista
                selectedFeatures.forEach(f => {
                    if (!updatedCards.some(c => c.id === f.id)) {
                        updatedCards.push({ ...f });
                    }
                });
                await this.saveCards(updatedCards);
                this.render();
                return;
            }

            // 6. Restaurar vazio
            if (target.id === 'reset-cards-btn') {
                if (confirm('Remover todos os atalhos da Home?')) {
                    await this.saveCards([]);
                    this.render();
                }
                return;
            }
        });
    }

    // ====== DRAG & DROP ======
    initDragDrop() {
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

            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const draggedId = e.dataTransfer.getData('text/plain');
                if (!draggedId || draggedId === item.dataset.id) return;

                const draggedCard = this.cards.find(c => c.id === draggedId);
                const targetCard = this.cards.find(c => c.id === item.dataset.id);
                if (!draggedCard || !targetCard) return;

                const fromIndex = this.cards.indexOf(draggedCard);
                const toIndex = this.cards.indexOf(targetCard);
                if (fromIndex === -1 || toIndex === -1) return;

                const [moved] = this.cards.splice(fromIndex, 1);
                const newToIndex = this.cards.indexOf(targetCard);
                this.cards.splice(newToIndex, 0, moved);
                await this.saveCards(this.cards);
                this.render();
            });
        });
    }
}

