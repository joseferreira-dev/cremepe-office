class PDFModule {
    constructor(container) {
        this.container = container;
        this.currentFeature = 'merge';
        this.features = [
            { id: 'merge', label: 'Mesclar PDFs', render: this.renderMerge.bind(this) },
            { id: 'split', label: 'Dividir PDF', render: this.renderSplit.bind(this) },
        ];
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h2 class="module-title"><i class="bi bi-file-earmark-pdf me-2"></i>Gerenciamento de PDFs</h2>
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
        if (feature) feature.render();
    }

    renderMerge() {
        const content = document.getElementById('feature-content');
        content.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal"><i class="bi bi-arrow-left-right me-2"></i>Mesclar PDFs</h4>
                <p class="text-muted">Combine vários PDFs em um único documento.</p>
            </div>
            <div class="card mb-3">
                <div class="card-body text-center text-muted py-5">
                    <i class="bi bi-file-earmark-pdf" style="font-size: 3rem; color: #007A51;"></i>
                    <p class="mt-2">Funcionalidade em desenvolvimento</p>
                </div>
            </div>
        `;
    }

    renderSplit() {
        const content = document.getElementById('feature-content');
        content.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal"><i class="bi bi-scissors me-2"></i>Dividir PDF</h4>
                <p class="text-muted">Divida um PDF em vários arquivos.</p>
            </div>
            <div class="card mb-3">
                <div class="card-body text-center text-muted py-5">
                    <i class="bi bi-file-earmark-pdf" style="font-size: 3rem; color: #007A51;"></i>
                    <p class="mt-2">Funcionalidade em desenvolvimento</p>
                </div>
            </div>
        `;
    }
}
window.PDFModule = PDFModule;