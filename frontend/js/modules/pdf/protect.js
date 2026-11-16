import { API } from '../../api.js';
import { Feature } from '../feature.js';

export class PDFProtectFeature extends Feature {
    constructor() {
        super('protect');
        this.mode = 'protect';
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-brand-600 font-normal">Proteger / Desproteger</h4>
                <p class="text-slate-500">Adicione ou remova senha de arquivos PDF.</p>
            </div>

            <ul class="nav-tabs mb-4" role="tablist">
                <li role="presentation">
                    <button class="nav-link active" data-mode="protect" id="tab-protect">Proteger com Senha</button>
                </li>
                <li role="presentation">
                    <button class="nav-link" data-mode="remove" id="tab-remove">Remover Senha</button>
                </li>
            </ul>

            <div id="protect-content">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title text-brand-600">Arquivo de entrada</h5>
                        <div class="input-group">
                            <input type="text" id="protect-input" class="form-control" placeholder="Selecione o PDF...">
                            <button class="btn btn-outline-secondary" id="btn-protect-input">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title text-brand-600">Senha</h5>
                        <input type="password" id="protect-pwd" class="form-control" placeholder="Digite a senha para abrir o PDF">
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title text-brand-600">Arquivo de saída</h5>
                        <div class="input-group">
                            <input type="text" id="protect-output" class="form-control" placeholder="Caminho do PDF protegido">
                            <button class="btn btn-outline-secondary" id="btn-protect-output">Selecionar</button>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-protect"><i data-lucide="lock" class="me-1"></i>Proteger</button>
            </div>

            <div id="remove-content" style="display:none;">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title text-brand-600">Arquivo protegido</h5>
                        <div class="input-group">
                            <input type="text" id="remove-input" class="form-control" placeholder="Selecione o PDF com senha...">
                            <button class="btn btn-outline-secondary" id="btn-remove-input">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title text-brand-600">Senha</h5>
                        <input type="password" id="remove-pwd" class="form-control" placeholder="Digite a senha do documento">
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title text-brand-600">Arquivo de saída (sem senha)</h5>
                        <div class="input-group">
                            <input type="text" id="remove-output" class="form-control" placeholder="Caminho do PDF desprotegido">
                            <button class="btn btn-outline-secondary" id="btn-remove-output">Selecionar</button>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-remove"><i data-lucide="unlock" class="me-1"></i>Remover Senha</button>
            </div>

            ${this.progressHTML()}

            <div id="protect-result" style="display:none;" class="mt-4">
                <div id="password-info" class="mt-2"></div>
            </div>

            ${this.logHTML()}
        `;

        document.querySelectorAll('.nav-link').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.mode = mode;
                document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('protect-content').style.display = (mode === 'protect') ? 'block' : 'none';
                document.getElementById('remove-content').style.display = (mode === 'remove') ? 'block' : 'none';
            });
        });

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-protect-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('protect-input').value = result.filePaths[0];
                        this.suggestOutput('protect-input', 'protect-output', '_protegido');
                    }
                });
            }
        });

        document.getElementById('btn-protect-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('protect-output').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-remove-input').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        document.getElementById('remove-input').value = result.filePaths[0];
                        this.suggestOutput('remove-input', 'remove-output', '_desprotegido');
                    }
                });
            }
        });

        document.getElementById('btn-remove-output').addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showSaveDialog) {
                window.electronAPI.showSaveDialog({
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled && result.filePath) {
                        document.getElementById('remove-output').value = result.filePath;
                    }
                });
            }
        });

        document.getElementById('btn-protect').addEventListener('click', () => this.protectPassword());
        document.getElementById('btn-remove').addEventListener('click', () => this.removePassword());
    }

    suggestOutput(inputId, outputId, suffix) {
        const input = document.getElementById(inputId).value.trim();
        const output = document.getElementById(outputId);
        if (input && !output.value) {
            const base = input.replace(/\.[^.]+$/, '');
            output.value = `${base}${suffix}.pdf`;
        }
    }

    async protectPassword() {
        const inputPath = document.getElementById('protect-input').value.trim();
        const outputPath = document.getElementById('protect-output').value.trim();
        const password = document.getElementById('protect-pwd').value.trim();

        if (!inputPath || !outputPath || !password) {
            this.log('Preencha todos os campos.');
            return;
        }

        const btn = document.getElementById('btn-protect');
        btn.disabled = true;
        this.clearLog();
        this.log('Protegendo PDF...');

        try {
            const result = await API.pdf.protectPassword({
                input_path: inputPath,
                output_path: outputPath,
                password: password
            });

            document.getElementById('protect-result').style.display = 'block';
            document.getElementById('password-info').innerHTML = `<div><strong>Senha:</strong> ${result.password}</div>`;

            this.log(`PDF protegido com sucesso!`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }

    async removePassword() {
        const inputPath = document.getElementById('remove-input').value.trim();
        const outputPath = document.getElementById('remove-output').value.trim();
        const password = document.getElementById('remove-pwd').value.trim();

        if (!inputPath || !outputPath || !password) {
            this.log('Preencha todos os campos.');
            return;
        }

        const btn = document.getElementById('btn-remove');
        btn.disabled = true;
        this.clearLog();
        this.log('Removendo senha...');

        try {
            const result = await API.pdf.removePassword({
                input_path: inputPath,
                output_path: outputPath,
                password: password
            });

            document.getElementById('password-info').innerHTML = '';

            this.log(`Senha removida! Arquivo salvo em: ${result.output_path}`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}

