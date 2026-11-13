import { ArchiveFeature } from './archive.js';
import { AttributesFeature } from './attributes.js';
import { CollectFeature } from './collect.js';
import { CompareFeature } from './compare.js';
import { DuplicatesFeature } from './duplicates.js';
import { OrganizeFeature } from './organize.js';
import { RenameFeature } from './rename.js';
import { RenameByContentFeature } from './rename_by_content.js';
import { ReportFeature } from './report.js';
import { SplitFeature } from './split.js';

export class FileModule {
    constructor(container) {
        this.container = container;
        this.currentFeature = 'collect';
        this.previewData = null;

        this.collectFeature = new CollectFeature(this);
        this.renameFeature = new RenameFeature(this);
        this.duplicatesFeature = new DuplicatesFeature(this);
        this.organizeFeature = new OrganizeFeature(this);
        this.renameByContentFeature = new RenameByContentFeature(this);
        this.attributesFeature = new AttributesFeature(this);
        this.reportFeature = new ReportFeature(this);
        this.compareFeature = new CompareFeature(this);
        this.archiveFeature = new ArchiveFeature(this);
        this.splitFeature = new SplitFeature(this);

        this.features = [
            { id: 'collect', label: 'Coletar Arquivos', render: (container) => this.mount(this.collectFeature, container) },
            { id: 'rename', label: 'Renomear em Lote', render: (container) => this.mount(this.renameFeature, container) },
            { id: 'duplicates', label: 'Localizar Duplicatas', render: (container) => this.mount(this.duplicatesFeature, container) },
            { id: 'organize', label: 'Organizar por Extensão', render: (container) => this.mount(this.organizeFeature, container) },
            { id: 'rename-by-content', label: 'Renomear por Conteúdo', render: (container) => this.mount(this.renameByContentFeature, container) },
            { id: 'attributes', label: 'Alterar Atributos', render: (container) => this.mount(this.attributesFeature, container) },
            { id: 'report', label: 'Relatório de Estrutura', render: (container) => this.mount(this.reportFeature, container) },
            { id: 'compare', label: 'Comparar Pastas', render: (container) => this.mount(this.compareFeature, container) },
            { id: 'archive', label: 'Compactar e Extrair', render: (container) => this.mount(this.archiveFeature, container) },
            { id: 'split', label: 'Dividir e Remontar', render: (container) => this.mount(this.splitFeature, container) },
        ];
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h2 class="module-title"><i class="bi bi-folder2-open me-2"></i>Arquivos e Pastas</h2>
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
            item.addEventListener('click', () => {
                const feature = item.dataset.feature;
                this.selectFeature(feature);
            });
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

    // Monta uma feature no container: destroi a anterior (destroy remove
    // listeners/timers rastreados), limpa o DOM e renderiza a nova.
    mount(instance, container) {
        if (this._active) {
            this._active.destroy();
        }
        container.innerHTML = '';
        this._active = instance;
        instance.render(container);
    }

    // Chamado pelo app ao trocar de pagina: destroi a feature ativa.
    destroy() {
        if (this._active) {
            this._active.destroy();
            this._active = null;
        }
    }

    renderCurrentFeature() {
        const feature = this.features.find(f => f.id === this.currentFeature);
        if (feature) {
            feature.render(document.getElementById('feature-content'));
        }
    }
}

