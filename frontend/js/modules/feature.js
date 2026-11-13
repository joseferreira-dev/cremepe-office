/**
 * Classe base para as features das telas (PDF, Word, Excel, Arquivos).
 *
 * Centraliza o que era repetido em cada uma das 33 features:
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
 * Os IDs gerados ('{prefix}-log' / '{prefix}-progress') sao os MESMOS
 * usados antes da refactoracao — nada muda no DOM final.
 */
class Feature {
    constructor(prefix) {
        this.prefix = prefix;
        this.logId = `${prefix}-log`;
        this.progressId = `${prefix}-progress`;
    }

    /** Adiciona uma linha na area de log da feature. */
    log(message) {
        FileUtils.log(message, this.logId);
    }

    /** Limpa a area de log da feature. */
    clearLog() {
        FileUtils.clearLog(this.logId);
    }

    /** Define o percentual da barra de progresso (0-100). */
    setProgress(percent) {
        const bar = document.getElementById(this.progressId);
        if (bar) bar.style.width = `${percent}%`;
    }

    /** HTML da barra de progresso (estado inicial 0%). */
    progressHTML() {
        return `<div class="progress mt-2"><div class="progress-bar" id="${this.progressId}" style="width:0%"></div></div>`;
    }

    /** HTML da area de log com rotulo (padrao: LOG DE OPERACOES). */
    logHTML(label = 'LOG DE OPERAÇÕES') {
        return `<div class="mt-3">
                <label class="fw-bold text-success">${label}</label>
                <div class="log-area" id="${this.logId}">Log de operações vazio</div>
            </div>`;
    }
}

window.Feature = Feature;
