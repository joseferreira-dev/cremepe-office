import { ExcelConvertFeature } from './convert.js';
import { ExcelExtractCellsFeature } from './extract_cells.js';
import { ExcelMergeAllFeature } from './merge_all.js';
import { ExcelSplitFeature } from './split_by_column.js';
import { ExcelSplitSheetsFeature } from './split_sheets.js';

export class ExcelModule {
    constructor(container) {
        this.container = container;
        this.currentFeature = 'convert';
        this.features = [
            { id: 'convert', label: 'Conversão em Lote', render: (container) => this.mount(new ExcelConvertFeature(), container) },
            { id: 'merge-all', label: 'Combinar Planilhas', render: (container) => this.mount(new ExcelMergeAllFeature(), container) },
            { id: 'extract-cells', label: 'Extrair Células', render: (container) => this.mount(new ExcelExtractCellsFeature(), container) },
            { id: 'split', label: 'Dividir por Coluna', render: (container) => this.mount(new ExcelSplitFeature(), container) },
            { id: 'split-sheets', label: 'Extrair Abas', render: (container) => this.mount(new ExcelSplitSheetsFeature(), container) },
        ];
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h2 class="module-title"><i class="bi bi-file-earmark-excel me-2"></i>excel</h2>
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

