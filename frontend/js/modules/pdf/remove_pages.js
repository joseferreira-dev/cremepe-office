import { API } from '../../api.js';
import { Feature } from '../feature.js';

export class PDFRemovePagesFeature extends Feature {
    constructor() {
        super('remove-pages');
        this.saveRemoved = false;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Remover Páginas</h4>
                <p class="text-zinc-500">Remova páginas específicas do PDF. O arquivo original será mantido, e um novo arquivo será gerado sem as páginas removidas.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="remove-pages-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-remove-pages-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Páginas a remover</h5>
                    <div class="mb-2">
                        <label class="form-label">Selecione as páginas</label>
                        <input type="text" id="remove-pages-selection" class="form-control" placeholder="Ex: 1,3,5 ou 1-10 ou 1,3-5,10">
                        <small class="text-zinc-500">Use vírgula para separar, hífen para intervalos. Ex: 1,3-5,10</small>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de saída (sem as páginas removidas)</h5>
                    <div class="input-group">
                        <input type="text" id="remove-pages-output" class="form-control" placeholder="Caminho do arquivo final">
                        <button class="btn btn-outline-secondary" id="btn-remove-pages-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Opções</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="remove-pages-save-removed">
                        <label class="form-check-label">Salvar páginas removidas em um arquivo separado</label>
                    </div>
                    <div id="remove-pages-removed-group" style="display:none;" class="mt-2">
                        <label class="form-label">Arquivo das páginas removidas</label>
                        <div class="input-group">
                            <input type="text" id="remove-pages-removed-output" class="form-control" placeholder="Caminho para salvar as páginas removidas">
                            <button class="btn btn-outline-secondary" id="btn-remove-pages-removed-output">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-remove-pages-execute"><i data-lucide="play" class="me-1"></i>Remover Páginas</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        // Evento para mostrar/ocultar campo do arquivo de removidas
        document.getElementById('remove-pages-save-removed').addEventListener('change', (e) => {
            const group = document.getElementById('remove-pages-removed-group');
            group.style.display = e.target.checked ? 'block' : 'none';
        });

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-remove-pages-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('remove-pages-input').value = result.filePaths[0];
                        // Sugerir nome de saída
                        this.suggestOutputs();
                    }
                });
            }
        });

        document.getElementById('btn-remove-pages-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('remove-pages-output').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-remove-pages-removed-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('remove-pages-removed-output').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-remove-pages-execute').addEventListener('click', () => this.executeRemove());
    }

    suggestOutputs() {
        const input = document.getElementById('remove-pages-input').value;
        if (input) {
            const base = input.replace(/\.[^.]+$/, '');
            const output = document.getElementById('remove-pages-output');
            if (!output.value) {
                output.value = `${base}_sem_paginas.pdf`;
            }
            const removed = document.getElementById('remove-pages-removed-output');
            if (!removed.value) {
                removed.value = `${base}_paginas_removidas.pdf`;
            }
        }
    }

    async executeRemove() {
        const inputFile = document.getElementById('remove-pages-input').value.trim();
        const outputFile = document.getElementById('remove-pages-output').value.trim();
        const pagesSelection = document.getElementById('remove-pages-selection').value.trim();
        const saveRemoved = document.getElementById('remove-pages-save-removed').checked;
        const removedOutput = document.getElementById('remove-pages-removed-output').value.trim() || undefined;

        if (!inputFile || !outputFile) {
            this.log('Selecione o PDF de entrada e defina o arquivo de saída.');
            return;
        }

        if (!pagesSelection) {
            this.log('Informe as páginas a remover.');
            return;
        }

        const btn = document.getElementById('btn-remove-pages-execute');
        btn.disabled = true;
        this.clearLog();
        this.log(`Removendo páginas: ${pagesSelection}...`);

        try {
            const result = await API.pdf.removePages({
                pdf_path: inputFile,
                output_path: outputFile,
                pages_to_remove_str: pagesSelection,
                save_removed: saveRemoved,
                removed_output_path: removedOutput
            });

            const { total_pages, remaining_pages, removed_pages, output_file, removed_file, errors } = result;
            this.log(`Concluído! Total: ${total_pages} páginas, Removidas: ${removed_pages}, Restantes: ${remaining_pages}`);
            this.log(`Arquivo sem páginas: ${output_file}`);
            if (removed_file) {
                this.log(`Páginas removidas salvas em: ${removed_file}`);
            }
            if (errors.length) {
                this.log(`Erros: ${errors.length}`);
                errors.forEach(e => this.log(`  ${e}`));
            }
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}

