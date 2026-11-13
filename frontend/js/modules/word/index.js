class WordModule {
    constructor(container) {
        this.container = container;
        this.currentFeature = 'merge';
        this.mergeFeature = new MergeFeature(this);
        this.convertFeature = new ConvertFeature(this);
        this.compareFeature = new DocCompareFeature(this);
        this.extractImagesFeature = new ExtractImagesFeature(this);
        this.watermarkFeature = new WatermarkFeature(this);
        this.filePathFeature = new FilePathFeature(this);

        this.features = [
            { id: 'merge', label: 'Juntar Documentos', render: (container) => this.mount(this.mergeFeature, container) },
            { id: 'convert', label: 'Converter', render: (container) => this.mount(this.convertFeature, container) },
            { id: 'compare', label: 'Comparar', render: (container) => this.mount(this.compareFeature, container) },
            { id: 'extract-images', label: 'Extrair Imagens', render: (container) => this.mount(this.extractImagesFeature, container) },
            { id: 'watermark', label: 'Marca d\'Água', render: (container) => this.mount(this.watermarkFeature, container) },
            { id: 'filepath', label: 'Caminho do Arquivo', render: (container) => this.mount(this.filePathFeature, container) },
        ];
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h2 class="module-title"><i class="bi bi-file-earmark-word me-2"></i>Word</h2>
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

window.WordModule = WordModule;