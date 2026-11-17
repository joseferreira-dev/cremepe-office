/**
 * Classe base para as features das telas (PDF, Word, Excel, Arquivos).
 *
 * Centraliza o comportamento comum das 33 features:
 *   - area de log de operacoes e barra de progresso (HTML identico)
 *   - acesso aos IDs derivados do prefixo da feature
 *
 * Uso:
 *   class MinhaFeature extends Feature {
 *       constructor() { super('meu-prefixo'); }
 *       render(container) {
 *           container.innerHTML = `
 *               ...
 *               ${this.progressHTML()}
 *               ${this.logHTML()}
 *           `;
 *       }
 *       executar() {
 *           this.clearLog();
 *           this.log('Iniciando...');
 *           this.setProgress(100);
 *       }
 *   }
 *
 * Os IDs gerados sao '{prefix}-log' e '{prefix}-progress', derivados
 * do prefixo passado ao construtor (toda feature referencia esses IDs).
 */
import { FileUtils } from './file/utils.js';

export class Feature {
    prefix: string;
    logId: string;
    progressId: string;
    _listeners: Array<[EventTarget, string, (ev: any) => void]>;
    _timers: Array<ReturnType<typeof setTimeout>>;

    constructor(prefix: string) {
        this.prefix = prefix;
        this.logId = `${prefix}-log`;
        this.progressId = `${prefix}-progress`;
        this._listeners = [];
        this._timers = [];
    }

    /**
     * Monta a feature dentro do container da página. Sobrescrito por
     * cada feature — a base não faz nada.
     */
    render(_container: HTMLElement): void { /* implementado pelas subclasses */ }

    /**
     * Registra um listener RASTREADO — removido automaticamente em destroy().
     * Use para alvos persistentes (container da pagina, document, window).
     * Listeners em elementos filhos do container nao precisam: morrem junto
     * com o innerHTML ao trocar de tela.
     */
    on(target: EventTarget, event: string, handler: (ev: any) => void): (ev: any) => void {
        target.addEventListener(event, handler);
        this._listeners.push([target, event, handler]);
        return handler;
    }

    /** setTimeout RASTREADO — cancelado em destroy(). */
    setTimeout(handler: () => void, delay: number): ReturnType<typeof setTimeout> {
        const id = setTimeout(() => {
            this._timers = this._timers.filter(t => t !== id);
            handler();
        }, delay);
        this._timers.push(id);
        return id;
    }

    /** Cancela um timer rastreado por this.setTimeout(). */
    clearTimeout(id: ReturnType<typeof setTimeout>): void {
        clearTimeout(id);
        this._timers = this._timers.filter(t => t !== id);
    }

    /**
     * Destroi a feature: remove todos os listeners e timers rastreados.
     * Chamado pelo modulo/app ANTES de a feature ser descartada (troca de
     * feature ou de pagina). Subclasses podem sobrescrever — chamar super.destroy().
     */
    destroy(): void {
        for (const [target, event, handler] of this._listeners) {
            target.removeEventListener(event, handler);
        }
        this._listeners = [];
        for (const id of this._timers) {
            clearTimeout(id);
        }
        this._timers = [];
    }

    /** Adiciona uma linha na area de log da feature. */
    log(message: string): void {
        FileUtils.log(message, this.logId);
    }

    /** Limpa a area de log da feature. */
    clearLog(): void {
        FileUtils.clearLog(this.logId);
    }

    /** Define o percentual da barra de progresso (0-100). */
    setProgress(percent: number): void {
        const bar = document.getElementById(this.progressId)!;
        if (bar) bar.style.width = `${percent}%`;
    }

    /** HTML da barra de progresso (estado inicial 0%). */
    progressHTML(): string {
        return `<div class="progress mt-2"><div class="progress-bar" id="${this.progressId}" style="width:0%"></div></div>`;
    }

    /** HTML da area de log com rotulo (padrao: LOG DE OPERACOES). */
    logHTML(label = 'LOG DE OPERAÇÕES'): string {
        return `<div class="mt-6">
                <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">${label}</label>
                <div class="log-area" id="${this.logId}">Log de operações vazio</div>
            </div>`;
    }
}

