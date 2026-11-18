import { API } from '../../api.js';

/**
 * Dica de contagem de paginas + validacao local de intervalos.
 *
 * A rota sync POST /api/pdf/info devolve {pages, encrypted, ...} sem job;
 * as features dividir/extrair/reordenar usam para mostrar a paginacao do
 * arquivo selecionado e recusar intervalos fora do range ANTES de disparar
 * um job. O back continua validando — aqui e so UX (evita job + espera).
 *
 * A dica e escrita via textContent (nunca innerHTML): caminhos e erros de
 * arquivo nao sao HTML.
 */

export interface PageInfoWatcher {
    /** Relê o input e atualiza a dica (chamar apos selecao de arquivo). */
    refresh: () => void;
    /** Contagem cacheada da ultima leitura OK; undefined se ainda nao ha. */
    pages: () => number | undefined;
}

type Tone = 'muted' | 'ok' | 'err';

const TONE_CLASS: Record<Tone, string> = {
    muted: 'mt-2 text-zinc-500',
    ok: 'mt-2 text-emerald-600',
    err: 'mt-2 text-rose-600',
};

export function attachPageInfoHint(inputId: string, hintId: string): PageInfoWatcher {
    const state: { pages?: number } = {};
    let seq = 0; // descarta respostas de leituras antigas (selecao rapida)

    const render = (tone: Tone, text: string): void => {
        const hint = document.getElementById(hintId);
        if (!hint) return;
        hint.style.display = text ? 'block' : 'none';
        hint.className = TONE_CLASS[tone];
        hint.textContent = text;
    };

    const refresh = (): void => {
        const input = document.getElementById(inputId) as HTMLInputElement | null;
        const path = input ? input.value.trim() : '';
        const mySeq = ++seq;
        state.pages = undefined;
        if (!path) {
            render('muted', '');
            return;
        }
        render('muted', 'Consultando páginas...');
        API.pdf.info({ pdf_path: path }).then((info) => {
            if (mySeq !== seq) return; // resposta obsoleta
            state.pages = info.pages;
            render('ok', `${info.pages} página(s)`
                + (info.encrypted ? ' — criptografado' : ''));
        }).catch((err: Error) => {
            if (mySeq !== seq) return;
            render('err', `não foi possível ler: ${err.message}`);
        });
    };

    // Edicao manual: o 'change' dispara ao sair do campo.
    document.getElementById(inputId)?.addEventListener('change', refresh);

    return { refresh, pages: () => state.pages };
}

/**
 * Valida uma lista "1-3, 5, 7-9" contra a contagem real de paginas.
 * Devolve mensagem de erro ou null.
 *
 * Mesma sintaxe dos parsers do back (_parse_custom_intervals,
 * _parse_extract_selection, _parse_page_order): virgula separa, hifen
 * marca intervalo, paginas sao 1-based.
 */
export function validatePageRange(expr: string, pages: number): string | null {
    const parts = expr.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return 'Nenhuma página definida.';
    for (const part of parts) {
        const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!m) return `Trecho inválido: "${part}" (use algo como "1-3, 5").`;
        const a = parseInt(m[1], 10);
        const b = m[2] !== undefined ? parseInt(m[2], 10) : a;
        if (b < a) return `Intervalo invertido: "${part}".`;
        if (a < 1) return 'As páginas começam em 1.';
        if (b > pages) return `A página ${b} não existe — o PDF tem ${pages} página(s).`;
    }
    return null;
}
