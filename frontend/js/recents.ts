/**
 * Funcionalidades usadas recentemente (seção "Recentes" da home).
 *
 * Persiste SÓ pares {page, feature} no electron-store, sem depender do
 * catálogo — assim domain.ts pode importar este módulo sem criar um
 * ciclo (domain -> recents -> home -> domain). Título, ícone e seção
 * são re-hidratados pelo consumidor (home) via buildAvailableFeatures,
 * então renomear uma feature não deixa entrada órfã.
 */

const CHAVE = 'recentFeatures';
const MAX = 8;

export interface Recente {
    page: string;
    feature: string;
}

export const Recents = {
    /**
     * Registra o uso de uma feature: mais recente primeiro, sem
     * duplicatas, limitado a MAX. Chamado no navigateTo (home) e no
     * selectFeature (menu dos módulos) — silencioso em erro para não
     * interromper a navegação.
     */
    async registrar(page: string, feature: string): Promise<void> {
        if (!page || !feature || !window.electronAPI?.storeGet) return;
        try {
            const stored = await window.electronAPI.storeGet(CHAVE);
            const lista: Recente[] = Array.isArray(stored) ? stored : [];
            const nova: Recente[] = [
                { page, feature },
                ...lista.filter((r) => !(r.page === page && r.feature === feature)),
            ].slice(0, MAX);
            await window.electronAPI.storeSet(CHAVE, nova);
        } catch (e) {
            console.warn('Erro ao registrar recente:', e);
        }
    },

    /** Pares brutos {page, feature} (o consumidor hidrata o meta). */
    async listar(): Promise<Recente[]> {
        if (!window.electronAPI?.storeGet) return [];
        try {
            const stored = await window.electronAPI.storeGet(CHAVE);
            if (!Array.isArray(stored) || stored.length === 0) return [];
            return stored.filter((r: any) => r && r.page && r.feature);
        } catch {
            return [];
        }
    },
};
