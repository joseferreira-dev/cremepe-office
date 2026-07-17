class HomePage {
    constructor(container) {
        this.container = container;
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h1 class="module-title">Painel Inicial</h1>

                <!-- Estatísticas -->
                <div class="row g-3 mb-4">
                    <div class="col-6 col-md-3">
                        <div class="stat-card">
                            <div class="stat-number">1.284</div>
                            <div class="stat-label">Arquivos Processados</div>
                            <div class="stat-detail">Esta semana</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="stat-card">
                            <div class="stat-number">12</div>
                            <div class="stat-label">Operações Hoje</div>
                            <div class="stat-detail">Última: 14:32</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="stat-card">
                            <div class="stat-number">3</div>
                            <div class="stat-label">Erros Registrados</div>
                            <div class="stat-detail">Taxa: 0,2%</div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="stat-card">
                            <div class="stat-number">2,4 GB</div>
                            <div class="stat-label">Espaço Economizado</div>
                            <div class="stat-detail">Desde jan/2026</div>
                        </div>
                    </div>
                </div>

                <h2 class="h5 text-success fw-normal mt-3">Acesso Rápido</h2>
                <div class="row g-3">
                    ${this.createCard('bi-folder2-open', 'Coletar Arquivos', 'Reúna arquivos de múltiplas pastas em um destino.', 'files', 'collect')}
                    ${this.createCard('bi-pencil-square', 'Renomear em Lote', 'Renomeie centenas de arquivos de uma só vez.', 'files', 'rename')}
                    ${this.createCard('bi-file-earmark-pdf', 'Mesclar PDFs', 'Combine vários PDFs em um único documento.', 'pdf', 'merge')}
                    ${this.createCard('bi-arrow-left-right', 'Converter Docs', 'Converta entre formatos Word, PDF e mais.', 'word', 'convert')}
                </div>

                <h2 class="h5 text-success fw-normal mt-4">Atividade Recente</h2>
                <div class="card p-0 border">
                    <div class="list-group list-group-flush">
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <strong><i class="bi bi-folder2-open me-2 text-success"></i>Coletar Arquivos</strong>
                            <span class="flex-grow-1 mx-2">Coletados 247 arquivos → C:\Destino</span>
                            <small class="text-muted">14:32</small>
                        </div>
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <strong><i class="bi bi-pencil-square me-2 text-success"></i>Renomear em Lote</strong>
                            <span class="flex-grow-1 mx-2">3 arquivos renomeados com prefixo CREME_</span>
                            <small class="text-muted">11:18</small>
                        </div>
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <strong><i class="bi bi-file-earmark-pdf me-2 text-danger"></i>Mesclar PDF</strong>
                            <span class="flex-grow-1 mx-2">Falha ao abrir contrato_v2.pdf</span>
                            <small class="text-muted">09:45</small>
                        </div>
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                            <strong><i class="bi bi-arrow-left-right me-2 text-success"></i>Converter Documento</strong>
                            <span class="flex-grow-1 mx-2">relatorio_anual.docx → relatorio_anual.pdf</span>
                            <small class="text-muted">Ontem</small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Eventos dos cards
        this.container.querySelectorAll('.card .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.card');
                const page = card.dataset.page;
                const feature = card.dataset.feature;
                window.navigateTo(page, feature);
            });
        });
    }

    createCard(iconClass, title, desc, page, feature) {
        return `
            <div class="col-6 col-md-3">
                <div class="card h-100" data-page="${page}" data-feature="${feature}">
                    <div class="card-body d-flex flex-column">
                        <div class="card-icon mb-2"><i class="bi ${iconClass}"></i></div>
                        <h5 class="card-title">${title}</h5>
                        <p class="card-text">${desc}</p>
                        <button class="btn btn-success mt-auto align-self-start">Abrir</button>
                    </div>
                </div>
            </div>
        `;
    }
}
window.HomePage = HomePage;