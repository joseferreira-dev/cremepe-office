import { API } from './api.js';
import { ExcelModule } from './modules/excel/index.js';
import { FileModule } from './modules/file/index.js';
import { HomePage } from './modules/home.js';
import { PDFModule } from './modules/pdf/index.js';
import { WordModule } from './modules/word/index.js';

// pdf.js carrega como script clássico (vendor/pdf.min.js); o worker
// local é configurado aqui para que o index.html não precise de script
// inline — o CSP usa script-src 'self'.
if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
}

document.addEventListener('DOMContentLoaded', () => {
    // Cada página/módulo é uma classe com construtor (container) e
    // render(); HomePage e os DomainModule compartilham o contrato.
    type PageClass = new (container: HTMLElement) => any;
    const pages: Record<string, PageClass> = {
        home: HomePage,
        files: FileModule,
        pdf: PDFModule,
        word: WordModule,
        excel: ExcelModule,
    };

    const container = document.getElementById('page-container')!;
    let currentModuleInstance: any = null;

    window.navigateTo = (page, feature = null) => {
        document.querySelectorAll<HTMLElement>('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const btn = document.querySelector(`.nav-btn[data-page="${page}"]`)!;
        if (btn) btn.classList.add('active');

        // Destroi a página/módulo anterior: remove os listeners e timers
        // rastreados, que do contrário sobreviveriam à troca de tela.
        if (currentModuleInstance && typeof currentModuleInstance.destroy === 'function') {
            currentModuleInstance.destroy();
        }
        currentModuleInstance = null;

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

    document.querySelectorAll<HTMLElement>('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page!;
            window.navigateTo(page);
        });
    });

    // Cancelamento de jobs: delegacao global do botao Cancelar da
    // barra de progresso (o botao fica visivel so durante o polling,
    // em pollJob; sem job ativo o clique e um no-op).
    document.addEventListener('click', (e) => {
        const alvo = e.target instanceof Element
            ? e.target.closest('.progress-cancel')
            : null;
        if (alvo) {
            void API.jobs.cancel();
        }
    });

    window.navigateTo('home');

    // ====== ÍCONES LUCIDE ======
    // Converte <i data-lucide> em <svg> após cada render. A chamada
    // inicial cobre o sidebar (estático); o observer cobre as trocas
    // dinâmicas de tela/features. O seletor é restrito a <i> para
    // ignorar os <svg> já convertidos (que podem herdar o atributo).
    let iconsPending = false;
    function renderIcons() {
        if (iconsPending) return;
        iconsPending = true;
        requestAnimationFrame(() => {
            iconsPending = false;
            if (window.lucide && document.querySelector('i[data-lucide]')!) {
                window.lucide.createIcons();
            }
        });
    }
    renderIcons();
    new MutationObserver(() => renderIcons()).observe(container, {
        childList: true,
        subtree: true,
    });

    // ========== HEALTH CHECK DO BACKEND ==========
    // Aparência (cor do ponto) vive no CSS via classes .online/.offline;
    // aqui só troca o estado e o texto.
    const statusDot = document.getElementById('status-dot')!;
    const statusText = document.getElementById('status-text')!;

    function checkBackendStatus() {
        if (!statusDot || !statusText) return;

        API.health()
            .then(() => {
                statusDot.classList.add('online');
                statusDot.classList.remove('offline');
                statusText.textContent = 'Backend online';
            })
            .catch(() => {
                statusDot.classList.add('offline');
                statusDot.classList.remove('online');
                statusText.textContent = 'Backend offline';
            });
    }

    // Imediato + polling a cada 5s; se o backend ainda estiver subindo,
    // o próximo tick corrige o indicador.
    checkBackendStatus();
    setInterval(checkBackendStatus, 5000);
});