import { API } from '../../api.js';
import { Feature } from '../feature.js';

export class FilePathFeature extends Feature {
    constructor(module) {
        super('fp');
        this.module = module;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Inserir Caminho do Arquivo</h4>
                <p class="text-zinc-500">Insira o caminho do arquivo como marca d'água no documento.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Documento</h5>
                    <div class="input-group">
                        <input type="text" id="fp-input" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-fp-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-12 gap-4">
                <!-- Coluna esquerda -->
                <div class="md:col-span-6">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Caminho</h5>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="fp-full-path" checked>
                                <label class="form-check-label">Usar caminho completo</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="fp-relative-path">
                                <label class="form-check-label">Usar apenas o nome do arquivo</label>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Posição</h5>
                            <div class="grid grid-cols-12 gap-2">
                                <div class="md:col-span-12">
                                    <label class="form-label">Posição</label>
                                    <select id="fp-position" class="form-select">
                                        <option value="top">Superior (horizontal)</option>
                                        <option value="bottom">Inferior (horizontal)</option>
                                        <option value="left">Esquerda (vertical)</option>
                                        <option value="right" selected>Direita (vertical)</option>
                                    </select>
                                </div>
                                <div class="md:col-span-12">
                                    <label class="form-label">Distância da borda (cm)</label>
                                    <input type="number" id="fp-margin" class="form-control" value="1.0" step="0.1" min="0">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Coluna direita -->
                <div class="md:col-span-6">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Estilo</h5>
                            <div class="grid grid-cols-12 gap-2">
                                <div class="md:col-span-6">
                                    <label class="form-label">Tamanho (pt)</label>
                                    <input type="number" id="fp-font-size" class="form-control" value="12" min="6" step="1">
                                </div>
                                <div class="md:col-span-6">
                                    <label class="form-label">Cor</label>
                                    <input type="color" id="fp-color" class="form-control" value="#000000">
                                </div>
                            </div>
                            <div class="grid grid-cols-12 gap-2 mt-2">
                                <div class="md:col-span-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="fp-bold">
                                        <label class="form-check-label">Negrito</label>
                                    </div>
                                </div>
                                <div class="md:col-span-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="fp-italic">
                                        <label class="form-check-label">Itálico</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Transparência</h5>
                            <div class="flex items-center gap-2">
                                <input type="range" id="fp-transparency" class="form-range grow" min="0" max="100" value="50">
                                <span id="fp-transparency-label" class="font-bold" style="min-width:45px;">50%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="fp-output" class="form-control" placeholder="Caminho para salvar...">
                        <button class="btn btn-outline-secondary" id="btn-fp-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-fp-apply"><i data-lucide="play"></i> Inserir Caminho</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-fp-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Word', extensions: ['docx', 'doc'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('fp-input').value = result.filePaths[0];
                        this.suggestOutput();
                    }
                });
            }
        });

        container.querySelector('#btn-fp-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'Word', extensions: ['docx'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('fp-output').value = result.filePath;
                    }
                });
            }
        });

        container.querySelector('#fp-transparency').addEventListener('input', (e) => {
            document.getElementById('fp-transparency-label').textContent = e.target.value + '%';
        });

        container.querySelector('#btn-fp-apply').addEventListener('click', () => this.applyFilePath());
        container.querySelector('#fp-input').addEventListener('change', () => this.suggestOutput());
    }

    suggestOutput() {
        const input = document.getElementById('fp-input').value.trim();
        const output = document.getElementById('fp-output');
        if (input && !output.value) {
            const base = input.replace(/\.[^.]+$/, '');
            output.value = `${base}_path.docx`;
        }
    }

    async applyFilePath() {
        const inputPath = document.getElementById('fp-input').value.trim();
        const outputPath = document.getElementById('fp-output').value.trim();
        const position = document.getElementById('fp-position').value;
        const margin = parseFloat(document.getElementById('fp-margin').value) || 1.0;
        const fontSize = parseInt(document.getElementById('fp-font-size').value) || 12;
        const color = document.getElementById('fp-color').value;
        const bold = document.getElementById('fp-bold').checked;
        const italic = document.getElementById('fp-italic').checked;
        const transparency = parseInt(document.getElementById('fp-transparency').value) / 100;
        const useFullPath = document.getElementById('fp-full-path').checked;

        if (!inputPath || !outputPath) {
            this.log('Selecione o documento de entrada e defina o de saída.');
            return;
        }

        const btn = document.getElementById('btn-fp-apply');
        btn.disabled = true;
        this.clearLog();
        this.log('Inserindo caminho do arquivo...');

        try {
            const result = await API.word.filepath({
                input_path: inputPath,
                output_path: outputPath,
                position: position,
                margin_cm: margin,
                font_size: fontSize,
                color: color,
                bold: bold,
                italic: italic,
                transparency: transparency,
                use_full_path: useFullPath
            });
            this.log(`Caminho inserido em: ${result.output_path}`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}