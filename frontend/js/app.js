console.log('App iniciado');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado');

    const pages = {
        home: HomePage,
        files: FileModule,
        pdf: PDFModule,
        word: WordModule,
        excel: ExcelModule,
        settings: SettingsPage,
    };

    const container = document.getElementById('page-container');
    let currentModuleInstance = null;

    window.navigateTo = (page, feature = null) => {
        console.log(`Navegando para: ${page}, feature: ${feature}`);

        // Atualizar botões
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
        if (btn) btn.classList.add('active');

        // Limpar container
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

    if (window.API && window.API.health) {
        window.API.health()
            .then(() => console.log('Backend OK'))
            .catch(err => console.warn('Backend indisponível:', err.message));
    }
});