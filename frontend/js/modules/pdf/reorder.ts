import { API } from '../../api.js';
import { Feature } from '../feature.js';

export class PDFReorderFeature extends Feature {
    constructor() {
        super('reorder');
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900"><i data-lucide="arrow-up-down" class="me-2"></i>Reordenar Páginas</h4>
                <p class="text-zinc-500">Defina a nova ordem das páginas do PDF. Você pode especificar páginas individuais ou intervalos.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="reorder-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-reorder-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Nova ordem das páginas</h5>
                    <div class="mb-2">
                        <label class="form-label">Digite a nova ordem</label>
                        <input type="text" id="reorder-order" class="form-control" placeholder="Ex: 5,1,3,2,4 ou 1-3,5,4">
                        <small class="text-zinc-500">Use vírgula para separar, hífen para intervalos. Ex: 5,1,3,2,4 (reorganiza as 5 páginas na ordem 5,1,3,2,4). Todas as páginas devem ser incluídas exatamente uma vez.</small>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="reorder-output" class="form-control" placeholder="Caminho do arquivo reordenado">
                        <button class="btn btn-outline-secondary" id="btn-reorder-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-reorder-execute"><i data-lucide="play" class="me-1"></i>Reordenar</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-reorder-input')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        (document.getElementById('reorder-input') as DomElement).value = result.filePaths[0];
                        this.suggestOutput();
                    }
                });
            }
        });

        document.getElementById('btn-reorder-output')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        (document.getElementById('reorder-output') as DomElement).value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-reorder-execute')!.addEventListener('click', () => this.executeReorder());
    }

    suggestOutput() {
        const input = (document.getElementById('reorder-input') as DomElement).value;
        if (input) {
            const base = input.replace(/\.[^.]+$/, '');
            const output = document.getElementById('reorder-output')!;
            if (!(output as DomElement).value) {
                (output as DomElement).value = `${base}_reordenado.pdf`;
            }
        }
    }

    async executeReorder() {
        const inputFile = (document.getElementById('reorder-input') as DomElement).value.trim();
        const outputFile = (document.getElementById('reorder-output') as DomElement).value.trim();
        const orderStr = (document.getElementById('reorder-order') as DomElement).value.trim();

        if (!inputFile || !outputFile) {
            this.log('Selecione o PDF de entrada e defina o arquivo de saída.');
            return;
        }

        if (!orderStr) {
            this.log('Defina a nova ordem das páginas.');
            return;
        }

        const btn = document.getElementById('btn-reorder-execute')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log(`Reordenando páginas: ${orderStr}...`);

        try {
            const result = await API.pdf.reorderPages({
                pdf_path: inputFile,
                output_path: outputFile,
                new_order_str: orderStr
            });

            const { total_pages, output_file, errors } = result;
            this.log(`Concluído! PDF reordenado salvo em: ${output_file}`);
            this.log(`Total de páginas: ${total_pages}`);
            if (errors.length) {
                this.log(`Erros: ${errors.length}`);
                errors.forEach((e: any) => this.log(`  ${e}`));
            }
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}

