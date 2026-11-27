/**
 * Contexto da funcionalidade em uso (página + feature).
 *
 * O api.ts não sabe em qual feature o usuário está quando uma operação
 * termina; este registro é preenchido pelo domain.ts (render e
 * selectFeature) e pelo app.ts (navigateTo) para que a atividade
 * registrada saiba qual título exibir.
 *
 * Dados puros, sem imports — domain/app/api podem usá-lo sem ciclo.
 */
export const Contexto = {
    page: '',
    feature: '',

    definir(page: string, feature: string): void {
        this.page = page;
        this.feature = feature;
    },

    limpar(): void {
        this.page = '';
        this.feature = '';
    },
};
