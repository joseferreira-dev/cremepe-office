/**
 * Favoritos da Home (os cards de "Acesso Rápido").
 *
 * A estrela mora nas listas dos domínios (domain.ts) e este módulo faz o
 * toggle no electron-store. Importa SÓ dados puros de meta.ts — nunca
 * home.ts nem os módulos — para não criar o ciclo
 * domain -> favorites -> home -> domain.
 */
import { HOME_META, SECTION_BY_PAGE, cardId } from './modules/meta.js';

const CHAVE = 'quickAccessCards';

/** Mesmo shape que o buildAvailableFeatures da Home devolve. */
interface Card {
    id: string;
    icon: string;
    title: string;
    desc: string;
    section: string;
    page: string;
    feature: string;
}

async function ler(): Promise<Card[] | null> {
    if (!window.electronAPI?.storeGet) return null;
    try {
        const v = await window.electronAPI.storeGet(CHAVE);
        return Array.isArray(v) ? v : null;
    } catch (e) {
        console.warn('Erro ao ler favoritos:', e);
        return null;
    }
}

async function salvar(cards: Card[]): Promise<void> {
    if (!window.electronAPI?.storeSet) return;
    try {
        await window.electronAPI.storeSet(CHAVE, cards);
    } catch (e) {
        console.warn('Erro ao salvar favoritos:', e);
    }
}

export const Favs = {
    /** Ids dos cards favoritados (vazio quando o store ainda não existe). */
    async ids(): Promise<Set<string>> {
        const cards = await ler();
        return new Set((cards || []).map((c) => c.id));
    },

    /**
     * Alterna o favorito de uma funcionalidade e persiste.
     * Devolve o NOVO estado (true = favoritado).
     *
     * `fallback` leva rótulo/ícone do módulo para o caso de o meta não
     * ter entrada — degrada igual ao buildAvailableFeatures da Home.
     */
    async alternar(
        page: string,
        featureId: string,
        fallback?: { label?: string; icon?: string },
    ): Promise<boolean> {
        const cards = (await ler()) || [];
        const id = cardId(page, featureId);
        const existe = cards.some((c) => c.id === id);

        let novos: Card[];
        if (existe) {
            novos = cards.filter((c) => c.id !== id);
        } else {
            const meta = HOME_META[`${page}/${featureId}`] || {};
            novos = [...cards, {
                id,
                icon: meta.icon || fallback?.icon || 'circle-play',
                title: meta.title || fallback?.label || featureId,
                desc: meta.desc || '',
                section: SECTION_BY_PAGE[page] || page,
                page,
                feature: featureId,
            }];
        }
        await salvar(novos);
        return !existe;
    },
};
