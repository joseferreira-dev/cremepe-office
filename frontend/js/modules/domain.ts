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
import { Favs } from '../favorites.js';
import { Contexto } from '../contexto.js';
import { cardId } from './meta.js';

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
        // Contexto da feature em uso: o api.ts usa para titolar a
        // atividade registrada quando uma operação termina.
        Contexto.definir(this.page, this.currentFeature);

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
                        <ul class="feature-list">
                            ${this.features.map(f => `
                                <li data-feature="${f.id}" class="${f.id === this.currentFeature ? 'active' : ''}">
                                    <i data-lucide="${f.icon || 'circle'}"></i>
                                    <span class="grow">${f.label}</span>
                                    <button type="button" class="feature-star" data-feature="${f.id}"
                                            aria-pressed="false"
                                            title="Favoritar (aparece na Home)"
                                            aria-label="Favoritar ${f.label}">
                                        <i data-lucide="star"></i>
                                    </button>
                                </li>`).join('')}
                        </ul>
                    </div>
                    <div class="min-w-0 grow" id="feature-content"></div>
                </div>
            </div>
        `;

        this.container.querySelectorAll<HTMLElement>('.feature-list li').forEach(item => {
            item.addEventListener('click', () => this.selectFeature(item.dataset.feature!));
        });

        // Estrela: alterna o favorito SEM navegar para a feature
        this.container.querySelectorAll<HTMLButtonElement>('.feature-star').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const featureId = btn.dataset.feature!;
                const def = this.features.find(f => f.id === featureId);
                const ativo = await Favs.alternar(this.page, featureId, {
                    label: def?.label, icon: def?.icon,
                });
                this.marcarEstrela(btn, ativo);
            });
        });

        // O store é assíncrono: as estrelas nascem vazias e são
        // preenchidas logo em seguida (mesmo padrão da Home).
        void this.sincronizarEstrelas();

        this.renderCurrentFeature();
    }

    /** Aplica o estado visual de uma estrela (preenchida/vazia). */
    private marcarEstrela(btn: HTMLButtonElement, ativo: boolean): void {
        btn.classList.toggle('starred', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
        btn.title = ativo ? 'Remover dos atalhos da Home' : 'Favoritar (aparece na Home)';
    }

    /** Sincroniza as estrelas com os favoritos gravados no store. */
    private async sincronizarEstrelas(): Promise<void> {
        const favs = await Favs.ids();
        this.container.querySelectorAll<HTMLButtonElement>('.feature-star').forEach(btn => {
            const featureId = btn.dataset.feature!;
            this.marcarEstrela(btn, favs.has(cardId(this.page, featureId)));
        });
    }

    selectFeature(featureId: string): void {
        this.currentFeature = featureId;
        Contexto.definir(this.page, featureId);
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
