import { Feature, escapeHtml } from './feature.js';
import { ExcelModule } from './excel/index.js';
import { FileModule } from './file/index.js';
import { PDFModule } from './pdf/index.js';
import { WordModule } from './word/index.js';
import { Atividades } from '../activities.js';

import { HOME_META } from './meta.js';

// Visual por seção: chips/badges/botões dos cards na cor do domínio
const SECTION_STYLE: Record<string, { chip: string; badge: string; btn: string }> = {
    'Arquivos': { chip: 'chip-arquivos', badge: 'badge-arquivos', btn: 'btn-arquivos' },
    'PDF': { chip: 'chip-pdf', badge: 'badge-pdf', btn: 'btn-pdf' },
    'Word': { chip: 'chip-word', badge: 'badge-word', btn: 'btn-word' },
    'Excel': { chip: 'chip-excel', badge: 'badge-excel', btn: 'btn-excel' },
};

// Módulos consumidos pelo catálogo (fonte única de ids/navegação)
const MODULE_CATALOG = [
    { page: 'files', section: 'Arquivos', module: FileModule },
    { page: 'pdf', section: 'PDF', module: PDFModule },
    { page: 'word', section: 'Word', module: WordModule },
    { page: 'excel', section: 'Excel', module: ExcelModule },
];

// Atalhos semeados na primeira execução (store sem a chave). Uma vez
// gravados, passam a valer as escolhas do usuário.
const DEFAULT_SHORTCUT_IDS = [
    'collect', 'rename', 'duplicates',
    'pdf-merge', 'pdf-split', 'pdf-compress',
    'word-convert', 'excel-convert',
];

/**
 * Catálogo completo das funcionalidades (fonte única de ids/navegação).
 * Consumido pela Home (atalhos) e pela busca global (Ctrl+K).
 */
export function buildAvailableFeatures() {
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
    storageKey!: string;

    constructor(container: HTMLElement) {
        super('home');
        this.container = container;
        this.storageKey = 'quickAccessCards';
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
     * Atualiza SÓ a zona de favoritos (a grade), sem re-renderizar a
     * página inteira.
     */
    private refreshFavorites() {
        const el = document.getElementById('quick-access-container');
        if (el) el.innerHTML = this.renderFavorites();
        this.initDragDrop();
    }

    // ====== RENDER ======
    async render() {
        this.cards = await this.getCards();
        const atividades = await this.renderAtividades();

        this.container.innerHTML = `
            <div class="page active module-home">
                <h2 class="mb-4 text-lg font-semibold text-zinc-900">Acesso Rápido</h2>

                <div id="quick-access-container" class="mb-8">${this.renderFavorites()}</div>

                ${atividades}
            </div>
        `;

        this.initDragDrop();
    }

    /**
     * Seção "Atividades Recentes": o que foi FEITO em cada operação
     * (resumo) e se houve erro, mais recente primeiro. Oculta quando
     * ainda não há operações (1ª execução).
     */
    async renderAtividades(): Promise<string> {
        const lista = await Atividades.listar();
        if (lista.length === 0) return '';
        return `
            <div>
                <div class="mb-3">
                    <h2 class="text-lg font-semibold text-zinc-900">Atividades Recentes</h2>
                    <p class="text-sm text-zinc-500">Últimas operações executadas</p>
                </div>
                <ul class="atividade-lista" id="atividades-lista">
                    ${lista.map((a) => `
                        <li class="atividade-item" data-page="${a.page}" data-feature="${a.feature}">
                            <span class="atividade-status ${a.ok ? 'ok' : 'erro'}">
                                <i data-lucide="${a.ok ? 'circle-check' : 'circle-x'}"></i>
                            </span>
                            <span class="atividade-titulo">${escapeHtml(Atividades.titulo(a))}</span>
                            <span class="atividade-resumo${a.ok ? '' : ' erro'}">${escapeHtml(a.resumo)}</span>
                            <span class="atividade-quando">${Atividades.quando(a)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    /** Zona de favoritos: grade de cards ou mensagem de estado vazio. */
    renderFavorites() {
        if (this.cards.length === 0) {
            return `
                <div class="estado-vazio">
                    <i data-lucide="grid-3x3" class="estado-vazio-icone"></i>
                    <p class="text-sm text-zinc-500">Nenhum atalho favoritado. Toque na estrela
                        ao lado de uma funcionalidade nos menus dos domínios para ela aparecer aqui.</p>
                </div>
            `;
        }
        return `<div class="grid grid-cols-12 gap-4" id="quick-access-grid">${this.renderCardItems(this.cards)}</div>`;
    }

    renderCardItems(cards: any) {
        return cards.map((card: any) => {
            const style = SECTION_STYLE[card.section] || { chip: '', badge: '', btn: 'btn-success' };
            return `
            <div class="col-span-6 md:col-span-3 quick-card" draggable="true" data-id="${card.id}">
                <div class="card h-full" data-page="${card.page}" data-feature="${card.feature}">
                    <button class="star-btn" data-id="${card.id}"
                            title="Favoritado — clique para desmarcar"
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

        this.on(this.container, 'click', async (e) => {
            const target = e.target as HTMLElement;

            // 1. Item de atividade recente: navega para a feature
            const recente = target.closest?.('.atividade-item') as HTMLElement | null;
            if (recente) {
                window.navigateTo(recente.dataset.page!, recente.dataset.feature!);
                return;
            }

            // 2. Estrela do card: remove dos favoritos (sem confirm — é
            //    reversível estrelando de novo na lista do domínio)
            const star = target.closest?.('.star-btn') as HTMLElement | null;
            if (star) {
                e.stopPropagation();
                await this.toggleFavorite(star.dataset.id!, false);
                return;
            }

            // 3. Botão "Abrir" no card
            if (target.closest('.btn-open-card')) {
                e.stopPropagation();
                this.abrirCard(target);
                return;
            }

            // 4. Clique no card (qualquer área, exceto botões)
            if (target.closest('.quick-card .card') &&
                !target.closest('.btn-open-card') &&
                !target.closest('.star-btn')) {
                this.abrirCard(target);
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
