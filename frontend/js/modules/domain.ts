/**
 * Base dos módulos de domínio (PDF, Word, Excel, Arquivos).
 *
 * Cada módulo declara título, ícone e a lista de features (id, label e
 * fábrica `make`). A base cuida do menu lateral (com filtro de busca),
 * da montagem/desmontagem da feature ativa e da troca de página.
 *
 * Uso:
 *   export class PdfModule extends DomainModule {
 *       constructor(container) {
 *           super(container, {
 *               page: 'pdf',   // cor do domínio (module-pdf)
 *               title: 'PDF',
 *               icon: 'file-text',
 *               features: [
 *                   { id: 'merge', label: 'Combinar', icon: 'combine',
 *                     make: () => new PDFMergeFeature() },
 *               ],
 *           });
 *       }
 *   }
 *
 * Ciclo de vida:
 *   - a instância de cada feature é criada UMA vez, de forma lazy, no
 *     primeiro monte; ao voltar para a feature, o estado digitado pelo
 *     usuário (caminhos, opções) permanece;
 *   - ao montar, a feature ativa anterior é destruída (destroy() remove
 *     listeners/timers rastreados) e o #feature-content é limpo antes do
 *     novo render — nunca há dois renderes vivos ao mesmo tempo;
 *   - `make(module)` recebe o módulo: features que compartilham estado
 *     com o módulo o recebem pelo construtor.
 */
import type { Feature } from './feature.js';

// Texto normalizado para busca: sem acentos e em minúsculas
// ("numerar" encontra "Numerar Páginas").
const normalizeText = (s: string): string =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Declaração de uma feature no menu lateral de um módulo. */
export interface FeatureDef {
    id: string;
    label: string;
    icon?: string;
    make: (module: DomainModule) => Feature;
}

interface DomainModuleOptions {
    page: string;
    title: string;
    icon: string;
    features: FeatureDef[];
}

export class DomainModule {
    container: HTMLElement;
    page: string;
    title: string;
    icon: string;
    features: FeatureDef[];
    currentFeature: string;
    _instances: Map<string, Feature>;
    _active: Feature | null;

    constructor(container: HTMLElement, { page, title, icon, features }: DomainModuleOptions) {
        this.container = container;
        this.page = page; // id da cor do domínio (module-{page})
        this.title = title;
        this.icon = icon;
        this.features = features;
        this.currentFeature = features[0].id;
        this._instances = new Map();
        this._active = null;
    }

    render(): void {
        this.container.innerHTML = `
            <div class="page active module-${this.page}">
                <div class="mb-7 flex items-center gap-4">
                    <div class="icon-chip"><i data-lucide="${this.icon}"></i></div>
                    <div>
                        <h2 class="module-title">${this.title}</h2>
                        <p class="module-subtitle">${this.features.length} funcionalidades</p>
                    </div>
                </div>
                <div class="flex gap-6">
                    <div class="module-sidebar">
                        <h3>Funcionalidades</h3>
                        <div class="feature-search">
                            <div class="relative">
                                <i data-lucide="search"
                                   class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400"></i>
                                <input type="search" class="form-control form-control-sm"
                                       id="feature-search" placeholder="Buscar..."
                                       aria-label="Buscar funcionalidade">
                            </div>
                        </div>
                        <ul class="feature-list">
                            ${this.features.map(f => `<li data-feature="${f.id}" class="${f.id === this.currentFeature ? 'active' : ''}"><i data-lucide="${f.icon || 'circle'}"></i><span>${f.label}</span></li>`).join('')}
                        </ul>
                        <p class="feature-empty text-xs" hidden>Nenhuma funcionalidade</p>
                    </div>
                    <div class="min-w-0 grow" id="feature-content"></div>
                </div>
            </div>
        `;

        this.container.querySelectorAll<HTMLElement>('.feature-list li').forEach(item => {
            item.addEventListener('click', () => this.selectFeature(item.dataset.feature!));
        });

        this.bindFeatureSearch();

        this.renderCurrentFeature();
    }

    // Filtro do menu: esconde itens que não batem com a busca
    // (acentos/case-insensitive). Os listeners morrem junto com o
    // innerHTML ao trocar de página.
    bindFeatureSearch(): void {
        const input = this.container.querySelector<HTMLInputElement>('#feature-search');
        const items = this.container.querySelectorAll('.feature-list li');
        const empty = this.container.querySelector('.feature-empty');
        if (!input) return;

        input.addEventListener('input', () => {
            const query = normalizeText(input.value.trim());
            let visible = 0;
            items.forEach((li) => {
                const match = !query || normalizeText(li.textContent || '').includes(query);
                (li as HTMLElement).hidden = !match;
                if (match) visible++;
            });
            if (empty) (empty as HTMLElement).hidden = visible > 0;
        });
    }

    selectFeature(featureId: string): void {
        this.currentFeature = featureId;
        this.container.querySelectorAll<HTMLElement>('.feature-list li').forEach(li => {
            li.classList.toggle('active', li.dataset.feature === featureId);
        });
        this.renderCurrentFeature();
    }

    renderCurrentFeature(): void {
        const def = this.features.find(f => f.id === this.currentFeature);
        if (def) {
            this.mountFeature(def);
        }
    }

    // Monta a feature declarada: cria a instância na primeira vez (lazy),
    // destroi a ativa, limpa o container e renderiza.
    mountFeature(def: FeatureDef): void {
        if (this._active) {
            this._active.destroy();
        }
        let instance = this._instances.get(def.id);
        if (!instance) {
            instance = def.make(this);
            this._instances.set(def.id, instance);
        }
        const container = document.getElementById('feature-content')!;
        container.innerHTML = '';
        this._active = instance;
        instance.render(container);
    }

    // Chamado pelo app ao trocar de página: destrói a feature ativa.
    destroy(): void {
        if (this._active) {
            this._active.destroy();
            this._active = null;
        }
    }
}
