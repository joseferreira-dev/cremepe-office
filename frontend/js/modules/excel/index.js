class ExcelModule {
    constructor(container) {
        this.container = container;
        this.currentFeature = 'convert';
        this.features = [
            { id: 'convert', label: 'Conversão em Lote', render: (container) => new ExcelConvertFeature().render(container) },
        ];
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h2 class="module-title"><i class="bi bi-file-earmark-excel me-2"></i>Planilhas</h2>
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

    renderCurrentFeature() {
        const feature = this.features.find(f => f.id === this.currentFeature);
        if (feature) {
            const content = document.getElementById('feature-content');
            content.innerHTML = '';
            feature.render(content);
        }
    }
}

window.ExcelModule = ExcelModule;