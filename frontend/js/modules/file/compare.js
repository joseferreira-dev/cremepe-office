import { API } from '../../api.js';
import { Feature } from '../feature.js';
import { FileUtils } from './utils.js';

export class CompareFeature extends Feature {
    constructor(module) {
        super('compare');
        this.module = module;
        this.compareResult = null;
    }

    render(container) {
        container.innerHTML = `
            <div class="mb-3">
                <h4 class="text-success fw-normal">Comparar e Sincronizar Pastas</h4>
                <p class="text-muted">Compare duas pastas e sincronize arquivos novos/modificados.</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Pastas</h5>
                    <div class="mb-2">
                        <label class="form-label">Origem</label>
                        <div class="input-group">
                            <input type="text" id="compare-source" class="form-control" placeholder="Selecione a pasta origem...">
                            <button class="btn btn-outline-secondary" id="btn-compare-source">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Destino</label>
                        <div class="input-group">
                            <input type="text" id="compare-target" class="form-control" placeholder="Selecione a pasta destino...">
                            <button class="btn btn-outline-secondary" id="btn-compare-target">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <h5 class="card-title text-success">Opções</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compare-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compare-hidden">
                        <label class="form-check-label">Incluir arquivos ocultos</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compare-hash">
                        <label class="form-check-label">Comparar por hash MD5 (mais preciso, porém mais lento)</label>
                    </div>
                </div>
            </div>

            <div class="d-flex gap-2 mb-3">
                <button class="btn btn-outline-success" id="btn-compare"><i data-lucide="eye"></i> Comparar</button>
                <button class="btn btn-success" id="btn-sync" disabled><i data-lucide="arrow-left-right"></i> Sincronizar (copiar para destino)</button>
                <button class="btn btn-danger" id="btn-mirror" disabled><i data-lucide="repeat"></i> Espelhar (remover arquivos extras no destino)</button>
            </div>

            <div id="compare-result" style="display:none;">
                <div class="row g-2 mb-2">
                    <div class="col-6 col-md-3"><span class="badge bg-primary">Origem: <span id="total-source">0</span> arquivos</span></div>
                    <div class="col-6 col-md-3"><span class="badge bg-secondary">Destino: <span id="total-target">0</span> arquivos</span></div>
                    <div class="col-6 col-md-3"><span class="badge bg-success">Idênticos: <span id="identical-count">0</span></span></div>
                    <div class="col-6 col-md-3"><span class="badge bg-warning">Diferentes: <span id="modified-count">0</span></span></div>
                    <div class="col-6 col-md-3"><span class="badge bg-info">Apenas na origem: <span id="only-source-count">0</span></span></div>
                    <div class="col-6 col-md-3"><span class="badge bg-danger">Apenas no destino: <span id="only-target-count">0</span></span></div>
                </div>

                <div id="compare-details" style="max-height:300px; overflow:auto; border:1px solid #dee2e6; border-radius:0.375rem; padding:8px; font-size:0.9rem;">
                    <!-- Detalhes serão preenchidos -->
                </div>
            </div>

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container) {
        container.querySelector('#btn-compare-source').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('compare-source');
        });
        container.querySelector('#btn-compare-target').addEventListener('click', (e) => {
            e.stopPropagation();
            FileUtils.selectDirectory('compare-target');
        });

        container.querySelector('#btn-compare').addEventListener('click', () => this.compareFolders());
        container.querySelector('#btn-sync').addEventListener('click', () => this.syncFolders('copy_to_target'));
        container.querySelector('#btn-mirror').addEventListener('click', () => this.syncFolders('mirror'));
    }

    async compareFolders() {
        const source = document.getElementById('compare-source').value.trim();
        const target = document.getElementById('compare-target').value.trim();
        if (!source || !target) {
            this.log('Selecione ambas as pastas.');
            return;
        }
        if (source === target) {
            this.log('Origem e destino não podem ser iguais.');
            return;
        }

        const recursive = document.getElementById('compare-recursive').checked;
        const includeHidden = document.getElementById('compare-hidden').checked;
        const compareByHash = document.getElementById('compare-hash').checked;

        const btn = document.getElementById('btn-compare');
        btn.disabled = true;
        this.clearLog();
        this.log('Comparando pastas...');

        try {
            const result = await API.file.compare({
                source_dir: source,
                target_dir: target,
                recursive,
                include_hidden: includeHidden,
                compare_by_hash: compareByHash
            });
            this.compareResult = result;

            document.getElementById('total-source').textContent = result.total_source;
            document.getElementById('total-target').textContent = result.total_target;
            document.getElementById('identical-count').textContent = result.identical.length;
            document.getElementById('modified-count').textContent = result.modified_in_source.length;
            document.getElementById('only-source-count').textContent = result.only_in_source.length;
            document.getElementById('only-target-count').textContent = result.only_in_target.length;

            const resultDiv = document.getElementById('compare-result');
            resultDiv.style.display = 'block';

            const detailsDiv = document.getElementById('compare-details');
            let html = '';
            if (result.only_in_source.length) {
                html += `<strong><span class="text-info">Apenas na origem:</span></strong><ul>`;
                result.only_in_source.forEach(p => html += `<li>${p}</li>`);
                html += '</ul>';
            }
            if (result.only_in_target.length) {
                html += `<strong><span class="text-danger">Apenas no destino:</span></strong><ul>`;
                result.only_in_target.forEach(p => html += `<li>${p}</li>`);
                html += '</ul>';
            }
            if (result.modified_in_source.length) {
                html += `<strong><span class="text-warning">Modificados na origem:</span></strong><ul>`;
                result.modified_in_source.forEach(p => html += `<li>${p}</li>`);
                html += '</ul>';
            }
            if (result.identical.length) {
                html += `<strong><span class="text-success">Idênticos:</span></strong> ${result.identical.length} arquivos`;
            }
            if (!html) {
                html = '<p class="text-muted">Nenhuma diferença encontrada.</p>';
            }
            detailsDiv.innerHTML = html;

            document.getElementById('btn-sync').disabled = false;
            document.getElementById('btn-mirror').disabled = false;

            this.log(`Comparação concluída. ${result.only_in_source.length + result.modified_in_source.length} arquivos para copiar.`);
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }

    async syncFolders(action) {
        if (!this.compareResult) {
            this.log('Execute a comparação primeiro.');
            return;
        }

        const source = document.getElementById('compare-source').value.trim();
        const target = document.getElementById('compare-target').value.trim();
        const recursive = document.getElementById('compare-recursive').checked;
        const includeHidden = document.getElementById('compare-hidden').checked;
        const compareByHash = document.getElementById('compare-hash').checked;

        const btn = action === 'copy_to_target' ? document.getElementById('btn-sync') : document.getElementById('btn-mirror');
        btn.disabled = true;

        const actionLabel = action === 'copy_to_target' ? 'copiar para destino' : 'espelhar (remover extras)';
        if (!confirm(`Deseja realmente ${actionLabel}?`)) {
            btn.disabled = false;
            return;
        }

        this.clearLog();
        this.log(`Sincronizando (${actionLabel})...`);

        try {
            const result = await API.file.sync({
                source_dir: source,
                target_dir: target,
                recursive,
                include_hidden: includeHidden,
                compare_by_hash: compareByHash,
                action
            });
            this.log(`Concluído! ${result.copied} arquivos copiados, ${result.removed} removidos, ${result.skipped} ignorados.`);
            // Recarregar comparação automaticamente
            await this.compareFolders();
        } catch (err) {
            this.log(`Erro: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }
}