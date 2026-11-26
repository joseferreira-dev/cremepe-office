// Contratos globais do renderer: ponte Electron (preload), globals
// vendorizados (pdf.js e Lucide carregados como <script> classico) e
// funcoes expostas em window pelo app.
import type {
    OpenDialogOptions,
    OpenDialogReturnValue,
    SaveDialogOptions,
    SaveDialogReturnValue,
} from 'electron';

interface ElectronAPI {
    send(channel: string, data?: unknown): void;
    receive(channel: string, func: (...args: unknown[]) => void): void;
    showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue>;
    showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
    storeGet(key: string): Promise<unknown>;
    storeSet(key: string, value: unknown): Promise<boolean>;
    storeDelete(key: string): Promise<boolean>;
    // Resultado da operação: abrir/copiar o arquivo gerado
    openPath(caminho: string): Promise<{ ok: boolean; error?: string }>;
    showItemInFolder(caminho: string): Promise<boolean>;
    copyText(texto: string): Promise<boolean>;
}

interface PdfjsLibGlobal {
    GlobalWorkerOptions: { workerSrc: string };
    // pdf.min.js e vendorizado sem tipos — fronteira tipada por fora
    getDocument(src: unknown): any;
}

interface LucideGlobal {
    createIcons(opts?: {
        icons?: Record<string, unknown>;
        attrs?: Record<string, string>;
    }): void;
    icons: Record<string, unknown>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
        getBasePath: () => Promise<string>;
        navigateTo: (page: string, feature?: string | null) => void;
        pdfjsLib: PdfjsLibGlobal;
        lucide: LucideGlobal;
    }

    const pdfjsLib: PdfjsLibGlobal;
    const lucide: LucideGlobal;

    /**
     * Tipo prático para elementos do DOM quando o código lê/escreve
     * propriedades de input (value/checked/disabled/files) — no JS dinâmico
     * o receptor era qualquer elemento e o runtime já garante que é um
     * input/select/textarea/botão nos pontos de acesso.
     */
    type DomElement = HTMLElement & Pick<
        HTMLInputElement,
        'value' | 'checked' | 'disabled' | 'files' | 'placeholder'
    >;
}
