import { PDFAddPageNumbersFeature } from './add_page_numbers.js';
import { PDFCompressFeature } from './compress.js';
import { PDFConvertToImageFeature } from './convert_to_image.js';
import { PDFConvertToWordFeature } from './convert_to_word.js';
import { PDFExtractPagesFeature } from './extract_pages.js';
import { PDFMergeFeature } from './merge.js';
import { PDFMergeBySizeFeature } from './merge_by_size.js';
import { PDFProtectFeature } from './protect.js';
import { PDFRemovePagesFeature } from './remove_pages.js';
import { PDFReorderFeature } from './reorder.js';
import { PDFSplitFeature } from './split.js';
import { PDFSplitBySizeFeature } from './split_by_size.js';

export class PDFModule {
    constructor(container) {
        this.container = container;
        this.currentFeature = 'merge';
        this.features = [
            { id: 'merge', label: 'Combinar', render: (container) => this.mount(new PDFMergeFeature(), container) },
            { id: 'merge-by-size', label: 'Combinar por Tamanho', render: (container) => this.mount(new PDFMergeBySizeFeature(), container) },
            { id: 'split', label: 'Dividir', render: (container) => this.mount(new PDFSplitFeature(), container) },
            { id: 'split-by-size', label: 'Dividir por Tamanho', render: (container) => this.mount(new PDFSplitBySizeFeature(), container) },
            { id: 'extract-pages', label: 'Extrair Páginas', render: (container) => this.mount(new PDFExtractPagesFeature(), container) },
            { id: 'remove-pages', label: 'Remover Páginas', render: (container) => this.mount(new PDFRemovePagesFeature(), container) },
            { id: 'reorder', label: 'Reordenar Páginas', render: (container) => this.mount(new PDFReorderFeature(), container) },
            { id: 'add-page-numbers', label: 'Numerar Páginas', render: (container) => this.mount(new PDFAddPageNumbersFeature(), container) },
            { id: 'convert-to-word', label: 'Converter para Word', render: (container) => this.mount(new PDFConvertToWordFeature(), container) },
            { id: 'convert-to-image', label: 'Converter para Imagem', render: (container) => this.mount(new PDFConvertToImageFeature(), container) },
            { id: 'compress', label: 'Comprimir', render: (container) => this.mount(new PDFCompressFeature(), container) },
            { id: 'protect', label: 'Proteger/Desproteger', render: (container) => this.mount(new PDFProtectFeature(), container) },
        ];
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h2 class="module-title"><i class="bi bi-file-earmark-pdf me-2"></i>PDF</h2>
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

