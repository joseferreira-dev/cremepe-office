class FileModule {
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

        this.features = [
            { id: 'collect', label: 'Coletar Arquivos', render: (container) => this.collectFeature.render(container) },
            { id: 'rename', label: 'Renomear em Lote', render: (container) => this.renameFeature.render(container) },
            { id: 'duplicates', label: 'Localizar Duplicatas', render: (container) => this.duplicatesFeature.render(container) },
            { id: 'organize', label: 'Organizar por Extensão', render: (container) => this.organizeFeature.render(container) },
            { id: 'rename-by-content', label: 'Renomear por Conteúdo', render: (container) => this.renameByContentFeature.render(container) },
            { id: 'attributes', label: 'Alterar Atributos', render: (container) => this.attributesFeature.render(container) },
            { id: 'report', label: 'Relatório de Estrutura', render: (container) => this.reportFeature.render(container) },
        ];
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h2 class="module-title">Arquivos e Pastas</h2>
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

window.FileModule = FileModule;