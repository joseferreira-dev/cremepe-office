class AttributesFeature extends Feature {
    constructor(module) {
        super('attr');
        this.module = module;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Alterar Atributos em Lote</h4>
                <p class="text-muted">Modifique datas, atributos (somente leitura, oculto, sistema) e permissões de vários arquivos de uma vez.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Diretório</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="attr-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-attr-dir">Selecionar</button>
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="attr-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Atributos (Windows)</h5>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="attr-readonly">
                                <label class="form-check-label">Somente leitura</label>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="attr-hidden">
                                <label class="form-check-label">Oculto</label>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="attr-system">
                                <label class="form-check-label">Sistema</label>
                            </div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <label class="form-label">Permissões (Unix, ex: 755)</label>
                        <input type="text" id="attr-permissions" class="form-control" placeholder="Deixe vazio para não alterar" style="width:150px;">
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Datas</h5>
                    <div class="row">
                        <div class="col-md-6">
                            <label class="form-label">Data de modificação</label>
                            <input type="datetime-local" id="attr-modification-date" class="form-control">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Data de criação (Windows)</label>
                            <input type="datetime-local" id="attr-creation-date" class="form-control">
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-apply-attributes"><i class="bi bi-play-fill"></i> Aplicar</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-attr-dir').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('attr-dir');
        });

        container.querySelector('#btn-apply-attributes').addEventListener('click', () => this.applyAttributes());
    }

    async applyAttributes() {
        const dir = document.getElementById('attr-dir').value.trim();
        if (!dir) {
            this.log('Selecione uma pasta.');
            return;
        }

        const recursive = document.getElementById('attr-recursive').checked;
        const readonly = document.getElementById('attr-readonly').checked ? true : undefined;
        const hidden = document.getElementById('attr-hidden').checked ? true : undefined;
        const system = document.getElementById('attr-system').checked ? true : undefined;
        const permissions = document.getElementById('attr-permissions').value.trim() || undefined;
        const modification_date = document.getElementById('attr-modification-date').value || undefined;
        const creation_date = document.getElementById('attr-creation-date').value || undefined;

        // Validação: pelo menos uma opção
        if (readonly === undefined && hidden === undefined && system === undefined &&
            !permissions && !modification_date && !creation_date) {
            this.log('Selecione pelo menos uma opção para alterar.');
            return;
        }

        const btn = document.getElementById('btn-apply-attributes');
        btn.disabled = true;
        this.clearLog();
        this.log('Aplicando atributos...');

        try {
            const result = await window.API.file.setAttributes({
                dir,
                recursive,
                readonly,
                hidden,
                system,
                permissions,
                modification_date,
                creation_date
            });
            this.log(`Concluído! ${result.processed_count} arquivos processados.`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}