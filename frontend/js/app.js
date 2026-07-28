console.log('App iniciado');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado');

    const pages = {
        home: HomePage,
        files: FileModule,
        pdf: PDFModule,
        word: WordModule,
        excel: ExcelModule,
        // settings: SettingsPage,  // Desativado temporariamente
    };

    const container = document.getElementById('page-container');
    let currentModuleInstance = null;

    window.navigateTo = (page, feature = null) => {
        console.log(`Navegando para: ${page}, feature: ${feature}`);

        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
        if (btn) btn.classList.add('active');

        container.innerHTML = '';

        if (pages[page]) {
            const PageClass = pages[page];
            currentModuleInstance = new PageClass(container);
            currentModuleInstance.render();
            if (feature && typeof currentModuleInstance.selectFeature === 'function') {
                currentModuleInstance.selectFeature(feature);
            }
        } else {
            container.innerHTML = `<div class="page active"><h2>Página em desenvolvimento</h2></div>`;
        }
    };

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            window.navigateTo(page);
        });
    });

    window.navigateTo('home');

    // ========== HEALTH CHECK DO BACKEND ==========
    function checkBackendStatus() {
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        if (!dot || !text) return;

        if (window.API && window.API.health) {
            window.API.health()
                .then(() => {
                    dot.className = 'badge bg-success';
                    dot.style.width = '10px';
                    dot.style.height = '10px';
                    dot.style.display = 'inline-block';
                    dot.style.borderRadius = '50%';
                    text.textContent = 'Backend online';
                    dot.style.backgroundColor = '#28a745';
                    text.style.color = '#d4edda';
                })
                .catch(() => {
                    dot.className = 'badge bg-danger';
                    dot.style.width = '10px';
                    dot.style.height = '10px';
                    dot.style.display = 'inline-block';
                    dot.style.borderRadius = '50%';
                    text.textContent = 'Backend offline';
                    dot.style.backgroundColor = '#dc3545';
                    text.style.color = '#f8d7da';
                });
        } else {
            // fallback: API não disponível
            dot.className = 'badge bg-warning';
            text.textContent = 'API indisponível';
            text.className = 'text-warning';
        }
    }

    // Verifica imediatamente e depois a cada 5 segundos
    checkBackendStatus();
    setInterval(checkBackendStatus, 5000);

    // Primeira verificação também pode ser feita com um pequeno atraso para garantir que o backend já subiu
    setTimeout(checkBackendStatus, 1000);
});