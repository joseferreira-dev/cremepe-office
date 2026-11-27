/**
 * Atividades recentes da Home: o que foi FEITO em cada operação e se
 * houve erro.
 *
 * O api.ts registra aqui depois de cada operação (sucesso ou falha);
 * a Home exibe como lista com status. Substituiu o antigo Recents —
 * que só guardava qual feature foi ABERTA, sem resultado algum.
 *
 * Importa só dados puros de meta.ts (títulos) e o contexto — nunca os
 * módulos nem o home.ts, para não criar ciclo de importação.
 */
import { Contexto } from './contexto.js';
import { HOME_META } from './modules/meta.js';

const CHAVE = 'atividades';
const MAX = 12;

export interface Atividade {
    page: string;
    feature: string;
    quando: number;   // epoch ms
    resumo: string;   // o que aconteceu (arquivo gerado, erro, "concluído")
    ok: boolean;
}

export const Atividades = {
    /**
     * Registra uma operação com o contexto atual. Silencioso em erro
     * (nunca deve derrubar a operação que acabou de rodar).
     *
     * A mesma ação repetida no topo só atualiza o horário — rodar
     * Comprimir cinco vezes seguidas não ocupa a lista inteira.
     */
    async registrar(resumo: string, ok: boolean): Promise<void> {
        const { page, feature } = Contexto;
        if (!page || !feature || !window.electronAPI?.storeSet) return;
        try {
            const lista = await Atividades.listar();
            const nova: Atividade = { page, feature, quando: Date.now(), resumo, ok };
            const head = lista[0];
            const repetida = !!head && head.page === page && head.feature === feature
                && head.resumo === resumo && head.ok === ok;
            const novos = repetida ? [nova, ...lista.slice(1)] : [nova, ...lista];
            await window.electronAPI.storeSet(CHAVE, novos.slice(0, MAX));
        } catch (e) {
            console.warn('Erro ao registrar atividade:', e);
        }
    },

    /** Lista (mais recente primeiro). Entradas inválidas são descartadas. */
    async listar(): Promise<Atividade[]> {
        if (!window.electronAPI?.storeGet) return [];
        try {
            const v = await window.electronAPI.storeGet(CHAVE);
            if (!Array.isArray(v)) return [];
            return v.filter((a: any) => a && a.page && a.feature && typeof a.resumo === 'string');
        } catch {
            return [];
        }
    },

    /** Título da atividade (meta da Home; degrada para "Operação"). */
    titulo(a: Atividade): string {
        return HOME_META[`${a.page}/${a.feature}`]?.title || 'Operação';
    },

    /** Tempo relativo em português: "agora", "há3 min", "há2 h", "há4 d". */
    quando(a: Atividade): string {
        const s = Math.max(0, Math.round((Date.now() - a.quando) / 1000));
        if (s < 60) return 'agora';
        const min = Math.round(s / 60);
        if (min < 60) return `há${min} min`;
        const h = Math.round(min / 60);
        if (h < 24) return `há${h} h`;
        return `há${Math.round(h / 24)} d`;
    },
};
