/**
 * Base dos módulos de domínio (PDF, Word, Excel, Arquivos).
 *
 * Cada módulo declara título, ícone e a lista de features (id, label e
 * fábrica `make`). A base cuida do menu lateral, da montagem/desmontagem
 * da feature ativa e da troca de página.
 *
 * Uso:
 *   export class PdfModule extends DomainModule {
 *       constructor(container) {
 *           super(container, {
 *               title: 'PDF',
 *               icon: 'bi-file-earmark-pdf',
 *               features: [
 *                   { id: 'merge', label: 'Combinar',
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
export class DomainModule {
    constructor(container, { title, icon, features }) {
        this.container = container;
        this.title = title;
        this.icon = icon;
        this.features = features;
        this.currentFeature = features[0].id;
        this._instances = new Map();
        this._active = null;
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h2 class="module-title"><i class="bi ${this.icon} me-2"></i>${this.title}</h2>
                <div class="d-flex gap-3" style="height: calc(100% - 60px);">
                    <div class="module-sidebar flex-shrink-0" style="width: 240px;">
                        <h3>Funcionalidades</h3>
                        <ul class="feature-list">
                            ${this.features.map(f => `<li data-feature="${f.id}" class="${f.id === this.currentFeature ? 'active' : ''}">${f.label}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="flex-grow-1 overflow-auto" id="feature-content"></div>
                </div>
            </div>
        `;

        this.container.querySelectorAll('.feature-list li').forEach(item => {
            item.addEventListener('click', () => this.selectFeature(item.dataset.feature));
        });

        this.renderCurrentFeature();
    }

    selectFeature(featureId) {
        this.currentFeature = featureId;
        this.container.querySelectorAll('.feature-list li').forEach(li => {
            li.classList.toggle('active', li.dataset.feature === featureId);
        });
        this.renderCurrentFeature();
    }

    renderCurrentFeature() {
        const def = this.features.find(f => f.id === this.currentFeature);
        if (def) {
            this.mountFeature(def);
        }
    }

    // Monta a feature declarada: cria a instância na primeira vez (lazy),
    // destroi a ativa, limpa o container e renderiza.
    mountFeature(def) {
        if (this._active) {
            this._active.destroy();
        }
        let instance = this._instances.get(def.id);
        if (!instance) {
            instance = def.make(this);
            this._instances.set(def.id, instance);
        }
        const container = document.getElementById('feature-content');
        container.innerHTML = '';
        this._active = instance;
        instance.render(container);
    }

    // Chamado pelo app ao trocar de página: destrói a feature ativa.
    destroy() {
        if (this._active) {
            this._active.destroy();
            this._active = null;
        }
    }
}
