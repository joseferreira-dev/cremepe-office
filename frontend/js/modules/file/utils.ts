import type { OpenDialogOptions } from 'electron';

export const FileUtils = {
    _dialogOpen: false, // impede múltiplas aberturas simultâneas

    /**
     * Abre o diálogo de PASTA e preenche o input.
     *
     * opts.append   -> concatena ao valor atual (em vez de substituir);
     * opts.onSelect -> callback pós-preenchimento.
     * Os25 pontos existentes chamam sem opts — comportamento idêntico
     * (substitui + dispara 'change').
     */
    selectDirectory: function (inputId: string, opts?: { append?: boolean; onSelect?: () => void }) {
        if (this._dialogOpen) {
            console.warn('Diálogo já em andamento.');
            return;
        }

        const o = opts || {};
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            this._dialogOpen = true;
            window.electronAPI.showOpenDialog({ properties: ['openDirectory'] })
                .then(result => {
                    this._dialogOpen = false;
                    if (!result.canceled && result.filePaths.length > 0) {
                        const input = document.getElementById(inputId);
                        if (input) {
                            const alvo = input as DomElement;
                            const nova = result.filePaths[0];
                            alvo.value = o.append && alvo.value
                                ? `${alvo.value}, ${nova}`
                                : nova;
                            // Dispara evento 'change' para sincronizar
                            const event = new Event('change', { bubbles: true });
                            input.dispatchEvent(event);
                            if (o.onSelect) o.onSelect();
                        }
                    }
                })
                .catch(() => {
                    this._dialogOpen = false;
                });
        } else {
            alert('Selecione a pasta manualmente.');
        }
    },

    log: function (message: string, logId: string) {
        const logArea = document.getElementById(logId)!;
        if (logArea) {
            const p = document.createElement('p');
            p.textContent = message;
            logArea.appendChild(p);
            logArea.scrollTop = logArea.scrollHeight;
        }
    },

    clearLog: function (logId: string) {
        const logArea = document.getElementById(logId)!;
        if (logArea) {
            logArea.innerHTML = '';
        }
    },

    // Adicione no FileUtils:
    /**
     * Abre o diálogo de ARQUIVO e preenche o input.
     *
     * Substitui os blocos inline de showOpenDialog (56 ocorrências com
     * boilerplate repetido) e corrige o que eles não faziam:
     *   - dispara 'change' após preencher (o selectDirectory já fazia;
     *     sem isso o suggestOutput() não rodava via diálogo);
     *   - opts.multiple -> multiSelections (seleção múltipla);
     *   - opts.append   -> concatena ao valor atual (listas separadas
     *                      por vírgula) em vez de substituir;
     *   - opts.onSelect -> callback pós-preenchimento (ex.: re-render
     *                      da lista de arquivos);
     *   - guarda de diálogo simultâneo (igual ao selectDirectory).
     */
    selectFile: function (
        inputId: string,
        filters?: any,
        opts?: { multiple?: boolean; append?: boolean; onSelect?: () => void },
    ) {
        if (this._dialogOpen) {
            console.warn('Diálogo já em andamento.');
            return;
        }
        const o = opts || {};
        if (window.electronAPI && window.electronAPI.showOpenDialog) {
            this._dialogOpen = true;
            const properties: NonNullable<OpenDialogOptions['properties']> = ['openFile'];
            if (o.multiple) properties.push('multiSelections');
            window.electronAPI.showOpenDialog({ properties, filters })
                .then(result => {
                    this._dialogOpen = false;
                    if (result.canceled || !result.filePaths.length) return;
                    const input = document.getElementById(inputId);
                    if (!input) return;
                    const alvo = input as DomElement;
                    const novos = o.multiple
                        ? result.filePaths.join(', ')
                        : result.filePaths[0];
                    alvo.value = o.append && alvo.value
                        ? `${alvo.value}, ${novos}`
                        : novos;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    if (o.onSelect) o.onSelect();
                })
                .catch(() => { this._dialogOpen = false; });
        } else {
            alert('Selecione o arquivo manualmente.');
        }
    },

    /** Igual ao selectFile mas com o diálogo Salvar (showSaveDialog). */
    selectSaveFile: function (
        inputId: string,
        filters?: any,
        opts?: { onSelect?: () => void },
    ) {
        if (this._dialogOpen) {
            console.warn('Diálogo já em andamento.');
            return;
        }
        const o = opts || {};
        if (window.electronAPI && window.electronAPI.showSaveDialog) {
            this._dialogOpen = true;
            window.electronAPI.showSaveDialog({ filters })
                .then(result => {
                    this._dialogOpen = false;
                    if (result.canceled || !result.filePath) return;
                    const input = document.getElementById(inputId);
                    if (!input) return;
                    (input as DomElement).value = result.filePath;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    if (o.onSelect) o.onSelect();
                })
                .catch(() => { this._dialogOpen = false; });
        } else {
            alert('Selecione o local para salvar.');
        }
    },
};