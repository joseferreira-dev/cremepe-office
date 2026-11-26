import { Feature, escapeHtml } from './feature.js';
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

const SECTIONS = ['Arquivos', 'PDF', 'Word', 'Excel'];

// Atalhos semeados na primeira execução (store sem a chave). Uma vez
// gravados, passam a valer as escolhas do usuário — inclusive o
// "Limpar", que não é ressemear.
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
    // O catálogo aberto/fechado (antes "modo de edição"): a seleção
    // agora é IMEDIATA — marcar o checkbox já salva, sem "Aplicar".
    catalogOpen!: boolean;
    searchTerm!: string;   // filtro de texto no catálogo
    domainFilter!: string; // '' = todos os domínios
    storageKey!: string;

    constructor(container: HTMLElement) {
        super('home');
        this.container = container;
        this.storageKey = 'quickAccessCards';
        this.catalogOpen = false;
        this.searchTerm = '';
        this.domainFilter = '';
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

    // ====== SELEÇÃO ======
    get total() {
        return this.availableFeatures.length;
    }

    /** Cards visíveis após o filtro de domínio. */
    get visibleCards() {
        return this.domainFilter
            ? this.cards.filter((c: any) => c.section === this.domainFilter)
            : this.cards;
    }

    countBySection(section: string) {
        if (!section) return this.cards.length;
        return this.cards.filter((c: any) => c.section === section).length;
    }

    /** Adiciona/remove um favorito e persiste (aplicação imediata). */
    private async toggleFavorite(id: string, add: boolean) {
        const existe = this.cards.some((c: any) => c.id === id);
        if (add === existe) return; // nada a mudar
        if (add) {
            const feat = this.availableFeatures.find((f: any) => f.id === id);
            if (feat) this.cards.push({ ...feat });
        } else {
            this.cards = this.cards.filter((c: any) => c.id !== id);
        }
        await this.saveCards(this.cards);
        this.refreshFavorites();
    }

    /**
     * Atualiza SÓ a zona de favoritos (grade, chips, contadores e
     * checkboxes), sem re-renderizar o catálogo — assim o campo de busca
     * mantém o foco e o cursor enquanto o usuário marca/desmarca.
     */
    private refreshFavorites() {
        const set = (id: string, html: string) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        };
        set('quick-access-container', this.renderFavorites());
        set('domain-chips', this.renderDomainChips());

        const fc = document.getElementById('favorites-count');
        if (fc) fc.textContent = `${this.cards.length} de ${this.total} atalhos`;
        const sc = document.getElementById('selected-count');
        if (sc) sc.textContent = `${this.cards.length} de ${this.total} selecionados`;

        // Espelha o estado nos checkboxes (ex.: remoção pela estrela)
        document.querySelectorAll<HTMLInputElement>('.feature-checkbox')
            .forEach((cb) => {
                cb.checked = this.cards.some((c: any) => c.id === cb.value);
            });

        this.initDragDrop();
    }

    // ====== RENDER ======
    async render() {
        this.cards = await this.getCards();

        this.container.innerHTML = `
            <div class="page active module-home">
                <div class="hero mb-7">
                    <p class="text-xs font-semibold tracking-widest text-white/60 uppercase">CREMEPE Office</p>
                    <h1 class="mt-2 text-3xl font-semibold tracking-tight">Painel Inicial</h1>
                    <p class="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
                        Atalhos das suas funcionalidades. Use <span class="font-semibold text-white">Adicionar atalhos</span>
                        para escolher quais aparecem aqui, ou navegue pelos domínios no menu lateral.
                    </p>
                </div>

                <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 class="text-lg font-semibold text-zinc-900">Acesso Rápido</h2>
                        <p class="text-sm text-zinc-500" id="favorites-count">${this.cards.length} de ${this.total} atalhos</p>
                    </div>
                    <button class="btn btn-outline-success btn-sm" id="toggle-edit-mode">
                        <i data-lucide="${this.catalogOpen ? 'x' : 'plus'}"></i>
                        ${this.catalogOpen ? 'Fechar catálogo' : 'Adicionar atalhos'}
                    </button>
                </div>

                <div class="mb-4 flex flex-wrap gap-2" id="domain-chips">${this.renderDomainChips()}</div>

                <div id="quick-access-container">${this.renderFavorites()}</div>

                <div id="edit-area" style="${this.catalogOpen ? 'display:block;' : 'display:none;'}" class="mt-6">
                    <div class="mb-4 flex flex-wrap items-center gap-3">
                        <input type="search" id="catalog-search" class="form-control"
                               placeholder="Buscar funcionalidade por nome..."
                               value="${escapeHtml(this.searchTerm)}">
                        <span class="selected-count" id="selected-count">${this.cards.length} de ${this.total} selecionados</span>
                    </div>
                    <div class="mb-4 flex flex-wrap gap-2">
                        <button class="btn btn-outline-success btn-sm" id="select-all-btn">
                            <i data-lucide="check-check"></i> Marcar todos
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" id="clear-all-btn">
                            <i data-lucide="eraser"></i> Limpar
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" id="reset-default-btn">
                            <i data-lucide="rotate-ccw"></i> Restaurar padrão
                        </button>
                    </div>
                    <div id="checkboxes-container">${this.renderCatalog()}</div>
                </div>
            </div>
        `;

        this.initDragDrop();
    }

    /** Chips de filtro por domínio (com contagem por domínio). */
    renderDomainChips() {
        const chips = [{ label: 'Todos', section: '' },
            ...SECTIONS.map((s) => ({ label: s, section: s }))];
        return chips.map((c) => `
            <button class="domain-chip${this.domainFilter === c.section ? ' active' : ''}"
                    data-section="${c.section}">
                ${c.label} <span class="text-xs opacity-70">(${this.countBySection(c.section)})</span>
            </button>
        `).join('');
    }

    /** Zona de favoritos: grade de cards ou mensagem de estado vazio. */
    renderFavorites() {
        if (this.cards.length === 0) {
            return `
                <div class="rounded-xl border border-dashed border-zinc-300 py-10 text-center">
                    <i data-lucide="grid-3x3" class="text-4xl text-zinc-300"></i>
                    <p class="mt-4 text-sm text-zinc-500">Nenhum atalho adicionado. Clique em
                        "Adicionar atalhos" e marque as funcionalidades desejadas.</p>
                </div>
            `;
        }
        const cards = this.visibleCards;
        if (cards.length === 0) {
            return `
                <div class="rounded-xl border border-dashed border-zinc-300 py-8 text-center">
                    <i data-lucide="folder-search" class="text-3xl text-zinc-300"></i>
                    <p class="mt-3 text-sm text-zinc-500">Nenhum atalho em
                        "${escapeHtml(this.domainFilter)}".</p>
                </div>
            `;
        }
        return `<div class="grid grid-cols-12 gap-4" id="quick-access-grid">${this.renderCardItems(cards)}</div>`;
    }

    renderCardItems(cards: any) {
        return cards.map((card: any) => {
            const style = SECTION_STYLE[card.section] || { chip: '', badge: '', btn: 'btn-success' };
            return `
            <div class="col-span-6 md:col-span-3 quick-card" draggable="true" data-id="${card.id}">
                <div class="card h-full" data-page="${card.page}" data-feature="${card.feature}">
                    <button class="star-btn" data-id="${card.id}"
                            title="Remover dos favoritos"
                            aria-label="Remover ${escapeHtml(card.title)} dos favoritos">
                        <i data-lucide="star"></i>
                    </button>
                    <div class="card-body">
                        <div class="card-icon mb-1 ${style.chip}"><i data-lucide="${card.icon}"></i></div>
                        <h5 class="card-title">${card.title}</h5>
                        <p class="card-text">${card.desc}</p>
                        <div class="mt-auto flex items-center gap-2 pt-1">
                            <span class="badge ${style.badge}">${card.section}</span>
                        </div>
                        <button class="btn w-full ${style.btn} btn-open-card">Abrir <i data-lucide="arrow-right"></i></button>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    /** Catálogo: checkboxes por seção, filtrados pelo termo de busca. */
    renderCatalog() {
        const term = this.searchTerm.trim().toLowerCase();
        const blocos = SECTIONS.map((section) => {
            const feats = this.availableFeatures.filter((f: any) =>
                f.section === section &&
                (!term || f.title.toLowerCase().includes(term) ||
                    (f.desc || '').toLowerCase().includes(term)));
            if (feats.length === 0) return '';
            return `
                <div class="mb-4">
                    <h6 class="text-brand-600 font-bold">${section}</h6>
                    <div class="grid grid-cols-12 gap-4">
                        ${feats.map((f: any) => `
                            <div class="md:col-span-6 lg:col-span-4">
                                <div class="form-check">
                                    <input class="form-check-input feature-checkbox" type="checkbox" value="${f.id}" id="chk-${f.id}" ${this.cards.some((c: any) => c.id === f.id) ? 'checked' : ''}>
                                    <label class="form-check-label" for="chk-${f.id}">
                                        <i data-lucide="${f.icon}"></i> ${f.title}
                                    </label>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
        if (!blocos) {
            return `<p class="text-sm text-zinc-500">Nenhuma funcionalidade encontrada
                para "${escapeHtml(this.searchTerm)}".</p>`;
        }
        return blocos;
    }

    /** Navega para a feature do card clicado (clicou fora da estrela). */
    private abrirCard(alvo: EventTarget | null) {
        const card = (alvo as HTMLElement | null)?.closest?.('.card') as HTMLElement | null;
        if (!card) return;
        const page = card.dataset.page;
        const feature = card.dataset.feature;
        if (page && feature) {
            window.navigateTo(page, feature);
        }
    }

    // ====== CONFIGURAÇÃO DE EVENTOS (UMA ÚNICA VEZ) ======
    setupEventListeners() {
        // Delegação para todos os eventos do container
        // this.on() rastreia o listener: o #page-container persiste entre
        // visitas, então destroy() o remove quando a home é descartada.

        // Aplicação IMEDIATA: marcar/desmarcar o checkbox salva na hora
        // (sem botão "Aplicar") e atualiza só a zona de favoritos.
        this.on(this.container, 'change', (e: any) => {
            const cb = (e.target as HTMLElement)?.closest?.('.feature-checkbox') as HTMLInputElement | null;
            if (!cb) return;
            void this.toggleFavorite(cb.value, cb.checked);
        });

        // Busca no catálogo: filtra os checkboxes sem perder o foco
        this.on(this.container, 'input', (e: any) => {
            const el = e.target as HTMLElement;
            if (!el || el.id !== 'catalog-search') return;
            this.searchTerm = (el as HTMLInputElement).value;
            const box = document.getElementById('checkboxes-container');
            if (box) box.innerHTML = this.renderCatalog();
        });

        this.on(this.container, 'click', async (e) => {
            const target = e.target as HTMLElement;

            // 1. Estrela: remove dos favoritos (sem confirm — é
            //    reversível voltando ao catálogo)
            const star = target.closest?.('.star-btn') as HTMLElement | null;
            if (star) {
                e.stopPropagation();
                await this.toggleFavorite(star.dataset.id!, false);
                return;
            }

            // 2. Botão "Abrir" no card
            if (target.closest('.btn-open-card')) {
                e.stopPropagation();
                this.abrirCard(target);
                return;
            }

            // 3. Clique no card (qualquer área, exceto botões)
            if (target.closest('.quick-card .card') &&
                !target.closest('.btn-open-card') &&
                !target.closest('.star-btn')) {
                this.abrirCard(target);
                return;
            }

            // 4. Alternar catálogo (closest: o clique pode cair no ícone)
            if (target.closest('#toggle-edit-mode')) {
                this.catalogOpen = !this.catalogOpen;
                this.render();
                return;
            }

            // 5. Filtro por domínio
            const chip = target.closest?.('.domain-chip') as HTMLElement | null;
            if (chip) {
                this.domainFilter = chip.dataset.section || '';
                this.refreshFavorites();
                return;
            }

            // 6. Marcar todos
            if (target.closest('#select-all-btn')) {
                const faltantes = this.availableFeatures
                    .filter((f: any) => !this.cards.some((c: any) => c.id === f.id))
                    .map((f: any) => ({ ...f }));
                if (faltantes.length) {
                    this.cards.push(...faltantes);
                    await this.saveCards(this.cards);
                    this.refreshFavorites();
                }
                return;
            }

            // 7. Limpar (remover todos os favoritos)
            if (target.closest('#clear-all-btn')) {
                if (this.cards.length === 0) return;
                if (confirm('Remover todos os atalhos da Home?')) {
                    this.cards = [];
                    await this.saveCards([]);
                    this.refreshFavorites();
                }
                return;
            }

            // 8. Restaurar padrão (os atalhos semeados na1ª execução)
            if (target.closest('#reset-default-btn')) {
                if (confirm('Restaurar os atalhos padrão da Home?')) {
                    this.cards = DEFAULT_SHORTCUT_IDS
                        .map((id) => this.availableFeatures.find((f: any) => f.id === id))
                        .filter(Boolean)
                        .map((f: any) => ({ ...f }));
                    await this.saveCards(this.cards);
                    this.refreshFavorites();
                }
                return;
            }
        });
    }

    // ====== DRAG & DROP ======
    // Sempre ativo (antes só no modo edição): a reordenação é uma
    // operação de leitura do estado, não de edição da seleção.
    initDragDrop() {
        const grid = document.getElementById('quick-access-grid');
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
                // Só a zona de favoritos muda — preserva busca/filtro
                this.refreshFavorites();
            });
        });
    }
}
