/**
 * Busca global de funcionalidades (campo no sidebar + Ctrl+K).
 *
 * Filtra o catálogo completo (as 35 features de todos os domínios) por
 * título/descrição/seção, sem acentos e case-insensitive — "numerar"
 * encontra "Numerar Páginas". Enter ou clique navegam direto para a
 * feature; Esc limpa; Ctrl+K foca o campo de qualquer tela.
 */
import { escapeHtml } from './modules/feature.js';
import { buildAvailableFeatures } from './modules/home.js';

// Mesma normalização do filtro do menu dos módulos (domain.ts)
const normalizeText = (s: string): string =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const MAX_RESULTADOS = 8;

export function initGlobalSearch(): void {
    const input = document.getElementById('global-search') as HTMLInputElement | null;
    const box = document.getElementById('global-search-results');
    if (!input || !box) return;

    const catalogo = buildAvailableFeatures();

    const fechar = () => {
        box.hidden = true;
        input.setAttribute('aria-expanded', 'false');
    };

    const abrir = () => {
        box.hidden = false;
        input.setAttribute('aria-expanded', 'true');
    };

    const filtrar = () => {
        const term = normalizeText(input.value.trim());
        if (!term) {
            fechar();
            return [];
        }
        return catalogo.filter((f: any) =>
            normalizeText(f.title).includes(term) ||
            normalizeText(f.desc || '').includes(term) ||
            normalizeText(f.section).includes(term),
        ).slice(0, MAX_RESULTADOS);
    };

    const render = () => {
        const hits = filtrar();
        if (!hits.length) {
            box.innerHTML = `<div class="gs-empty">Nenhuma funcionalidade para
                "${escapeHtml(input.value.trim())}"</div>`;
            abrir();
            return;
        }
        box.innerHTML = hits.map((f: any, i: number) => `
            <button type="button" class="gs-item" role="option"
                    data-page="${f.page}" data-feature="${f.feature}"
                    data-idx="${i}">
                <i data-lucide="${f.icon}"></i>
                <span class="gs-text">
                    <span class="gs-title">${escapeHtml(f.title)}</span>
                    <span class="gs-section">${escapeHtml(f.section)}</span>
                </span>
            </button>
        `).join('');
        abrir();
    };

    const navegar = (page: string, feature: string) => {
        fechar();
        input.value = '';
        input.blur();
        window.navigateTo(page, feature);
    };

    input.addEventListener('input', render);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const primeiro = box.querySelector<HTMLElement>('.gs-item');
            if (primeiro) {
                e.preventDefault();
                navegar(primeiro.dataset.page!, primeiro.dataset.feature!);
            }
        } else if (e.key === 'Escape') {
            input.value = '';
            fechar();
            input.blur();
        } else if (e.key === 'ArrowDown') {
            const primeiro = box.querySelector<HTMLElement>('.gs-item');
            if (primeiro) {
                e.preventDefault();
                primeiro.focus();
            }
        }
    });

    // Navegação por clique/teclado nos resultados (delegação: os itens
    // são re-renderizados a cada tecla)
    box.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest?.('.gs-item') as HTMLElement | null;
        if (item) navegar(item.dataset.page!, item.dataset.feature!);
    });

    box.addEventListener('keydown', (e) => {
        const item = (e.target as HTMLElement).closest?.('.gs-item') as HTMLElement | null;
        if (!item) return;
        const itens = Array.from(box.querySelectorAll<HTMLElement>('.gs-item'));
        const idx = itens.indexOf(item);
        if (e.key === 'ArrowDown' && idx < itens.length - 1) {
            e.preventDefault();
            itens[idx + 1].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (idx === 0) input.focus();
            else itens[idx - 1].focus();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            navegar(item.dataset.page!, item.dataset.feature!);
        } else if (e.key === 'Escape') {
            input.focus();
            input.value = '';
            fechar();
        }
    });

    // Fecha ao clicar fora
    document.addEventListener('click', (e) => {
        const alvo = e.target as HTMLElement;
        if (!alvo.closest?.('#global-search-wrap')) fechar();
    });

    // Ctrl+K (ou Cmd+K no Mac): foca a busca de qualquer tela
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            input.focus();
            input.select();
            if (input.value.trim()) render();
        }
    });
}
