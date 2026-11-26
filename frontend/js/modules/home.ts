import { Feature } from './feature.js';
import { ExcelModule } from './excel/index.js';
import { FileModule } from './file/index.js';
import { PDFModule } from './pdf/index.js';
import { WordModule } from './word/index.js';

// Metadados exclusivos da Home por "pagina/feature": id legado do card
// (persistido no electron-store), icone, titulo e descricao. A lista de
// funcionalidades e a navegacao vem dos modulos (static features de cada
// index.js) — meta ausente degrada para o label da feature.
const HOME_META: Record<string, { id?: string; icon?: string; title?: string; desc?: string }> = {
    // ARQUIVOS
    'files/collect': { id: 'collect', icon: 'folder-input', title: 'Coletar Arquivos', desc: 'Reúna arquivos de múltiplas pastas.' },
    'files/rename': { id: 'rename', icon: 'pencil', title: 'Renomear em Lote', desc: 'Renomeie vários arquivos de uma vez.' },
    'files/duplicates': { id: 'duplicates', icon: 'copy', title: 'Localizar Duplicatas', desc: 'Encontre arquivos duplicados.' },
    'files/organize': { id: 'organize', icon: 'folder-tree', title: 'Organizar por Extensão', desc: 'Organize arquivos por tipo.' },
    'files/rename-by-content': { id: 'rename-by-content', icon: 'tags', title: 'Renomear por Conteúdo', desc: 'Renomeie usando metadados.' },
    'files/attributes': { id: 'attributes', icon: 'sliders-horizontal', title: 'Alterar Atributos', desc: 'Modifique datas e permissões.' },
    'files/report': { id: 'report', icon: 'list-tree', title: 'Relatório de Estrutura', desc: 'Exporte árvore de diretórios.' },
    'files/compare': { id: 'compare', icon: 'arrow-left-right', title: 'Comparar Pastas', desc: 'Compare e sincronize pastas.' },
    'files/archive': { id: 'archive', icon: 'archive', title: 'Compactar/Extrair', desc: 'Crie ou extraia arquivos ZIP.' },
    'files/split': { id: 'split-file', icon: 'scissors', title: 'Dividir/Remontar', desc: 'Divida ou remonte arquivos grandes.' },
    // PDF
    'pdf/merge': { id: 'pdf-merge', icon: 'file-text', title: 'Combinar PDFs', desc: 'Mescle vários PDFs.' },
    'pdf/merge-by-size': { id: 'pdf-merge-size', icon: 'file-text', title: 'Combinar por Tamanho', desc: 'Agrupe PDFs por limite de tamanho.' },
    'pdf/split': { id: 'pdf-split', icon: 'scissors', title: 'Dividir PDF', desc: 'Divida em partes com intervalos.' },
    'pdf/split-by-size': { id: 'pdf-split-size', icon: 'ruler', title: 'Dividir por Tamanho', desc: 'Divida PDF por MB.' },
    'pdf/extract-pages': { id: 'pdf-extract', icon: 'file-text', title: 'Extrair Páginas', desc: 'Extraia páginas específicas.' },
    'pdf/remove-pages': { id: 'pdf-remove', icon: 'file-text', title: 'Remover Páginas', desc: 'Remova páginas indesejadas.' },
    'pdf/reorder': { id: 'pdf-reorder', icon: 'files', title: 'Reordenar Páginas', desc: 'Altere a ordem das páginas.' },
    'pdf/add-page-numbers': { id: 'pdf-numbers', icon: 'arrow-down-wide-narrow', title: 'Numerar Páginas', desc: 'Adicione numeração.' },
    'pdf/convert-to-word': { id: 'pdf-to-word', icon: 'file-output', title: 'PDF → Word', desc: 'Converta PDF para Word.' },
    'pdf/convert-to-image': { id: 'pdf-image', icon: 'image', title: 'PDF ↔ Imagem', desc: 'Converta entre PDF e imagens.' },
    'pdf/compress': { id: 'pdf-compress', icon: 'minimize-2', title: 'Comprimir PDF', desc: 'Reduza o tamanho do PDF.' },
    'pdf/validate': { id: 'pdf-validate', icon: 'shield-check', title: 'Validar PDF', desc: 'Confira integridade e erros do arquivo.' },
    'pdf/ocr': { id: 'pdf-ocr', icon: 'scan-text', title: 'OCR / Texto', desc: 'Reconheça texto em PDFs digitalizados.' },
    'pdf/protect': { id: 'pdf-protect', icon: 'lock', title: 'Proteger/Desproteger', desc: 'Adicione ou remova senha.' },
    // WORD
    'word/merge': { id: 'word-merge', icon: 'file-pen', title: 'Juntar Documentos', desc: 'Combine vários Word.' },
    'word/convert': { id: 'word-convert', icon: 'arrow-left-right', title: 'Converter Word', desc: 'Converta para HTML, TXT, PDF, etc.' },
    'word/compare': { id: 'word-compare', icon: 'files', title: 'Comparar Docs', desc: 'Compare dois documentos.' },
    'word/extract-images': { id: 'word-images', icon: 'image', title: 'Extrair Imagens', desc: 'Extraia imagens do documento.' },
    'word/watermark': { id: 'word-watermark', icon: 'droplet', title: "Marca d'Água", desc: 'Insira texto ou imagem.' },
    'word/filepath': { id: 'word-filepath', icon: 'file', title: 'Caminho do Arquivo', desc: 'Insira caminho no documento.' },
    // EXCEL
    'excel/convert': { id: 'excel-convert', icon: 'file-spreadsheet', title: 'Conversão em Lote', desc: 'Converta planilhas em lote.' },
    'excel/merge-all': { id: 'excel-merge', icon: 'table', title: 'Combinar Planilhas', desc: 'Consolide várias planilhas.' },
    'excel/extract-cells': { id: 'excel-extract', icon: 'grid-2x2', title: 'Extrair Células', desc: 'Extraia células específicas.' },
    'excel/split': { id: 'excel-split', icon: 'separator-vertical', title: 'Dividir por Coluna', desc: 'Divida pela coluna chave.' },
    'excel/split-sheets': { id: 'excel-sheets', icon: 'files', title: 'Extrair Abas', desc: 'Separe abas em arquivos.' },
};

// Visual por seção: chips/badges/botões dos cards na cor do domínio
const SECTION_STYLE: Record<string, { chip: string; badge: string; btn: string }> = {
    'Arquivos': { chip: 'chip-arquivos', badge: 'badge-arquivos', btn: 'btn-arquivos' },
    'PDF': { chip: 'chip-pdf', badge: 'badge-pdf', btn: 'btn-pdf' },
    'Word': { chip: 'chip-word', badge: 'badge-word', btn: 'btn-word' },
    'Excel': { chip: 'chip-excel', badge: 'badge-excel', btn: 'btn-excel' },
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
                icon: meta.icon || 'circle-play',
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
    availableFeatures!: any;
    cards!: any[];
    container!: HTMLElement;
    draggedId!: any;
    isEditing!: boolean;
    storageKey!: string;
    constructor(container: HTMLElement) {
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
                    // Re-sincroniza com o catálogo atual: cards salvos por
                    // versões antigas podem trazer ícones/títulos desatualizados
                    // (ex.: nomes bi-* de antes da migração para Lucide).
                    // A ordem e a seleção do usuário permanecem; ids que não
                    // existem mais são descartados.
                    const byId = new Map(this.availableFeatures.map((f: any) => [f.id, f]));
                    return stored.map((c) => byId.get(c.id)).filter(Boolean);
                }
                if (stored === undefined || stored === null) {
                    // Primeira execução: semeia os atalhos padrão
                    const seeded = DEFAULT_SHORTCUT_IDS
                        .map((id) => this.availableFeatures.find((f: any) => f.id === id))
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

    async saveCards(cards: any) {
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
        const cardIds = this.cards.map((c: any) => c.id);

        let cardsHtml;
        if (this.cards.length === 0) {
            cardsHtml = `
                <div class="rounded-xl border border-dashed border-zinc-300 py-10 text-center">
                    <i data-lucide="grid-3x3" class="text-4xl text-zinc-300"></i>
                    <p class="mt-4 text-sm text-zinc-500">Nenhum atalho adicionado. Clique em "Editar" e marque as funcionalidades desejadas.</p>
                </div>
            `;
        } else {
            cardsHtml = `<div class="grid grid-cols-12 gap-4" id="quick-access-grid">${this.renderCardItems(this.cards)}</div>`;
        }

        const sections = ['Arquivos', 'PDF', 'Word', 'Excel'];
        let checkboxesHtml = '';
        sections.forEach(section => {
            const sectionFeatures = this.availableFeatures.filter((f: any) => f.section === section);
            if (sectionFeatures.length === 0) return;
            checkboxesHtml += `
                <div class="mb-4">
                    <h6 class="text-brand-600 font-bold">${section}</h6>
                    <div class="grid grid-cols-12 gap-4">
                        ${sectionFeatures.map((f: any) => `
                            <div class="md:col-span-6 lg:col-span-4">
                                <div class="form-check">
                                    <input class="form-check-input feature-checkbox" type="checkbox" value="${f.id}" id="chk-${f.id}" ${cardIds.includes(f.id) ? 'checked' : ''}>
                                    <label class="form-check-label" for="chk-${f.id}">
                                        <i data-lucide="${f.icon}"></i> ${f.title}
                                    </label>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        this.container.innerHTML = `
            <div class="page active module-home">
                <div class="hero mb-7">
                    <p class="text-xs font-semibold tracking-widest text-white/60 uppercase">CREMEPE Office</p>
                    <h1 class="mt-2 text-3xl font-semibold tracking-tight">Painel Inicial</h1>
                    <p class="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
                        Atalhos das suas funcionalidades. Reorganize com <span class="font-semibold text-white">Editar</span>
                        ou navegue pelos domínios no menu lateral.
                    </p>
                </div>

                <div class="mb-4 flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-zinc-900">Acesso Rápido</h2>
                    <div>
                        <button class="btn btn-outline-success btn-sm" id="toggle-edit-mode">
                            <i data-lucide="pencil"></i> ${this.isEditing ? 'Concluir edição' : 'Editar'}
                        </button>
                    </div>
                </div>

                <div id="quick-access-container">
                    ${cardsHtml}
                </div>

                <div id="edit-area" style="${this.isEditing ? 'display:block;' : 'display:none;'}" class="mt-6">
                    <h5 class="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                        <i data-lucide="square-check"></i> Selecione as funcionalidades para exibir
                    </h5>
                    <div id="checkboxes-container">
                        ${checkboxesHtml}
                    </div>
                    <div class="mt-5 flex gap-2">
                        <button class="btn btn-success" id="apply-changes-btn">
                            <i data-lucide="check"></i> Aplicar alterações
                        </button>
                        <button class="btn btn-outline-secondary" id="reset-cards-btn">
                            <i data-lucide="rotate-ccw"></i> Restaurar vazio
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

    renderCardItems(cards: any) {
        return cards.map((card: any) => {
            const style = SECTION_STYLE[card.section] || { chip: '', badge: '', btn: 'btn-success' };
            return `
            <div class="col-span-6 md:col-span-3 quick-card" draggable="${this.isEditing}" data-id="${card.id}">
                <div class="card h-full" data-page="${card.page}" data-feature="${card.feature}">
                    <div class="card-body">
                        <div class="card-icon mb-1 ${style.chip}"><i data-lucide="${card.icon}"></i></div>
                        <h5 class="card-title">${card.title}</h5>
                        <p class="card-text">${card.desc}</p>
                        <div class="mt-auto flex items-center gap-2 pt-1">
                            <span class="badge ${style.badge}">${card.section}</span>
                        </div>
                        <button class="btn w-full ${style.btn} btn-open-card">Abrir <i data-lucide="arrow-right"></i></button>
                        ${this.isEditing ? `<button class="btn btn-outline-danger btn-sm w-full remove-card-btn" data-id="${card.id}"><i data-lucide="trash"></i> Remover</button>` : ''}
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    // ====== CONFIGURAÇÃO DE EVENTOS (UMA ÚNICA VEZ) ======
    setupEventListeners() {
        // Delegação para todos os eventos do container
        // this.on() rastreia o listener: o #page-container persiste entre
        // visitas, então destroy() o remove quando a home é descartada.
        this.on(this.container, 'click', async (e) => {
            const target = e.target;

            // 1. Botão "Abrir" no card
            if (target.closest('.btn-open-card')!) {
                e.stopPropagation();
                const card = target.closest('.card')!;
                const page = card.dataset.page;
                const feature = card.dataset.feature;
                if (page && feature) {
                    window.navigateTo(page, feature);
                }
                return;
            }

            // 2. Clique no card (qualquer área, exceto botões)
            if (target.closest('.quick-card .card')! && !target.closest('.btn-open-card')! && !target.closest('.remove-card-btn')!) {
                const card = target.closest('.card')!;
                const page = card.dataset.page;
                const feature = card.dataset.feature;
                if (page && feature) {
                    window.navigateTo(page, feature);
                }
                return;
            }

            // 3. Botão "Remover"
            if (target.closest('.remove-card-btn')!) {
                e.stopPropagation();
                const btn = target.closest('.remove-card-btn')!;
                const id = btn.dataset.id;
                if (!id) return;
                const card = this.cards.find((c: any) => c.id === id);
                if (!card) return;
                if (confirm(`Remover o atalho "${card.title}"?`)) {
                    const updated = this.cards.filter((c: any) => c.id !== id);
                    await this.saveCards(updated);
                    this.render();
                }
                return;
            }

            // 4. Alternar edição (closest: o clique pode cair no ícone)
            if (target.closest('#toggle-edit-mode')!) {
                this.isEditing = !this.isEditing;
                this.render();
                return;
            }

            // 5. Aplicar alterações (checkboxes)
            if (target.closest('#apply-changes-btn')!) {
                const checkedBoxes = document.querySelectorAll('.feature-checkbox:checked');
                const selectedIds = Array.from(checkedBoxes).map(cb => (cb as DomElement).value);
                const selectedFeatures = this.availableFeatures.filter((f: any) => selectedIds.includes(f.id));
                const currentCards = this.cards;
                const updatedCards: any[] = [];
                // Manter a ordem dos cards existentes
                currentCards.forEach((card: any) => {
                    if (selectedIds.includes(card.id)) {
                        updatedCards.push(card);
                    }
                });
                // Adicionar novos que não estavam na lista
                selectedFeatures.forEach((f: any) => {
                    if (!updatedCards.some(c => c.id === f.id)) {
                        updatedCards.push({ ...f });
                    }
                });
                await this.saveCards(updatedCards);
                this.render();
                return;
            }

            // 6. Restaurar vazio
            if (target.closest('#reset-cards-btn')!) {
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
        const grid = document.getElementById('quick-access-grid')!;
        if (!grid) return;

        const items = grid.querySelectorAll<HTMLElement>('.quick-card');
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggedId = (item as HTMLElement).dataset.id;
                e.dataTransfer!.effectAllowed = 'move';
                e.dataTransfer!.setData('text/plain', this.draggedId);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                document.querySelectorAll('.quick-card.drag-over').forEach(el => el.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer!.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const draggedId = e.dataTransfer!.getData('text/plain');
                if (!draggedId || draggedId === (item as HTMLElement).dataset.id) return;

                const draggedCard = this.cards.find((c: any) => c.id === draggedId);
                const targetCard = this.cards.find((c: any) => c.id === (item as HTMLElement).dataset.id);
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

