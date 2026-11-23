import { API } from '../../api.js';
import { Feature, escapeHtml } from '../feature.js';
import { FileUtils } from './utils.js';
import type { DomainModule } from '../domain.js';

export class CompareFeature extends Feature {
    compareResult!: any;
    module!: DomainModule;
    constructor(module: DomainModule) {
        super('compare');
        this.module = module;
        this.compareResult = null;
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Comparar e Sincronizar Pastas</h4>
                <p class="text-zinc-500">Compare duas pastas e sincronize arquivos novos/modificados.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pastas</h5>
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

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Opções</h5>
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

            <div class="flex gap-2 mb-4">
                <button class="btn btn-outline-success" id="btn-compare"><i data-lucide="eye"></i> Comparar</button>
                <button class="btn btn-success" id="btn-sync" disabled><i data-lucide="arrow-left-right"></i> Sincronizar (copiar para destino)</button>
                <button class="btn btn-danger" id="btn-mirror" disabled><i data-lucide="repeat"></i> Espelhar (remover arquivos extras no destino)</button>
            </div>

            <div id="compare-result" style="display:none;">
                <div class="grid grid-cols-12 gap-2 mb-2">
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-brand-600">Origem: <span id="total-source">0</span> arquivos</span></div>
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-zinc-500">Destino: <span id="total-target">0</span> arquivos</span></div>
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-brand-600">Idênticos: <span id="identical-count">0</span></span></div>
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-amber-100">Diferentes: <span id="modified-count">0</span></span></div>
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-sky-100">Apenas na origem: <span id="only-source-count">0</span></span></div>
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-rose-600">Apenas no destino: <span id="only-target-count">0</span></span></div>
                </div>

                <div id="compare-details" style="max-height:300px; overflow:auto; border:1px solid #dee2e6; border-radius:0.375rem; padding:8px; font-size:0.9rem;">
                    <!-- Detalhes serão preenchidos -->
                </div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container: HTMLElement) {
        container.querySelector('#btn-compare-source')!.addEventListener('click', (e: any) => {
            e.stopPropagation();
            FileUtils.selectDirectory('compare-source');
        });
        container.querySelector('#btn-compare-target')!.addEventListener('click', (e: any) => {
            e.stopPropagation();
            FileUtils.selectDirectory('compare-target');
        });

        container.querySelector('#btn-compare')!.addEventListener('click', () => this.compareFolders());
        container.querySelector('#btn-sync')!.addEventListener('click', () => this.syncFolders('copy_to_target'));
        container.querySelector('#btn-mirror')!.addEventListener('click', () => this.syncFolders('mirror'));
    }

    async compareFolders() {
        const source = (document.getElementById('compare-source') as DomElement).value.trim();
        const target = (document.getElementById('compare-target') as DomElement).value.trim();
        if (!source || !target) {
            this.log('Selecione ambas as pastas.');
            return;
        }
        if (source === target) {
            this.log('Origem e destino não podem ser iguais.');
            return;
        }

        const recursive = (document.getElementById('compare-recursive') as DomElement).checked;
        const includeHidden = (document.getElementById('compare-hidden') as DomElement).checked;
        const compareByHash = (document.getElementById('compare-hash') as DomElement).checked;

        const btn = document.getElementById('btn-compare')!;
        (btn as DomElement).disabled = true;
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

            document.getElementById('total-source')!.textContent = result.total_source;
            document.getElementById('total-target')!.textContent = result.total_target;
            document.getElementById('identical-count')!.textContent = result.identical.length;
            document.getElementById('modified-count')!.textContent = result.modified_in_source.length;
            document.getElementById('only-source-count')!.textContent = result.only_in_source.length;
            document.getElementById('only-target-count')!.textContent = result.only_in_target.length;

            const resultDiv = document.getElementById('compare-result')!;
            resultDiv.style.display = 'block';

            const detailsDiv = document.getElementById('compare-details')!;
            let html = '';
            if (result.only_in_source.length) {
                html += `<strong><span class="text-sky-600">Apenas na origem:</span></strong><ul>`;
                result.only_in_source.forEach((p: any) => html += `<li>${escapeHtml(p)}</li>`);
                html += '</ul>';
            }
            if (result.only_in_target.length) {
                html += `<strong><span class="text-rose-600">Apenas no destino:</span></strong><ul>`;
                result.only_in_target.forEach((p: any) => html += `<li>${escapeHtml(p)}</li>`);
                html += '</ul>';
            }
            if (result.modified_in_source.length) {
                html += `<strong><span class="text-amber-600">Modificados na origem:</span></strong><ul>`;
                result.modified_in_source.forEach((p: any) => html += `<li>${escapeHtml(p)}</li>`);
                html += '</ul>';
            }
            if (result.identical.length) {
                html += `<strong><span class="text-brand-600">Idênticos:</span></strong> ${result.identical.length} arquivos`;
            }
            if (!html) {
                html = '<p class="text-zinc-500">Nenhuma diferença encontrada.</p>';
            }
            detailsDiv.innerHTML = html;

            (document.getElementById('btn-sync') as DomElement).disabled = false;
            (document.getElementById('btn-mirror') as DomElement).disabled = false;

            this.log(`Comparação concluída. ${result.only_in_source.length + result.modified_in_source.length} arquivos para copiar.`);
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }

    async syncFolders(action: any) {
        if (!this.compareResult) {
            this.log('Execute a comparação primeiro.');
            return;
        }

        const source = (document.getElementById('compare-source') as DomElement).value.trim();
        const target = (document.getElementById('compare-target') as DomElement).value.trim();
        const recursive = (document.getElementById('compare-recursive') as DomElement).checked;
        const includeHidden = (document.getElementById('compare-hidden') as DomElement).checked;
        const compareByHash = (document.getElementById('compare-hash') as DomElement).checked;

        const btn = action === 'copy_to_target' ? document.getElementById('btn-sync')! : document.getElementById('btn-mirror')!;
        (btn as DomElement).disabled = true;

        const actionLabel = action === 'copy_to_target' ? 'copiar para destino' : 'espelhar (remover extras)';
        if (!confirm(`Deseja realmente ${actionLabel}?`)) {
            (btn as DomElement).disabled = false;
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
            this.setProgress(100);
            // Recarregar comparação automaticamente
            await this.compareFolders();
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}