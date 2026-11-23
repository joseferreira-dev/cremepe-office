import { API } from '../../api.js';
import { Feature, escapeHtml } from '../feature.js';

const STATUS_STYLE: Record<string, { icon: string; cls: string }> = {
    ok: { icon: 'circle-check', cls: 'text-emerald-600' },
    warn: { icon: 'triangle-alert', cls: 'text-amber-600' },
    error: { icon: 'circle-x', cls: 'text-rose-600' },
};

function formatSize(bytes: number) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
}

export class PDFValidateFeature extends Feature {
    repairSource = '';

    constructor() {
        super('validate');
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Validar PDF</h4>
                <p class="text-zinc-500">Analisa estrutura, páginas, imagens e fontes para detectar
                    corrupção, truncamento ou referências quebradas.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="validate-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-validate-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-validate"><i data-lucide="shield-check"></i> Validar</button>

            ${this.progressHTML()}

            <div id="validate-result" class="mt-4" style="display:none;">
                <div id="validate-banner" class="mb-3 flex items-center gap-3 rounded-xl border p-4 font-medium"></div>
                <div class="mb-3 flex flex-wrap gap-2" id="validate-stats"></div>
                <div class="card">
                    <div class="card-body p-0">
                        <ul id="validate-checks" class="divide-y divide-zinc-100"></ul>
                    </div>
                </div>
                <div id="validate-repair" class="mt-4 flex items-center gap-3" style="display:none;">
                    <button class="btn btn-outline-success" id="btn-validate-repair"><i data-lucide="wrench"></i> Reparar PDF</button>
                    <small class="text-zinc-500">Corrige os problemas encontrados em uma cópia — o original não é alterado.</small>
                </div>
            </div>

            ${this.logHTML()}
        `;

        document.getElementById('btn-validate-input')!.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.showOpenDialog) {
                window.electronAPI.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'PDF', extensions: ['pdf'] }]
                }).then(result => {
                    if (!result.canceled) {
                        (document.getElementById('validate-input') as DomElement).value = result.filePaths[0];
                    }
                });
            }
        });

        document.getElementById('btn-validate')!.addEventListener('click', () => this.validatePDF());
        document.getElementById('btn-validate-repair')!.addEventListener('click', () => this.repairCores());
    }

    async validatePDF(keepLog = false) {
        const inputPath = (document.getElementById('validate-input') as DomElement).value.trim();
        if (!inputPath) {
            this.log('Selecione o PDF que deseja validar.');
            return;
        }

        const btn = document.getElementById('btn-validate')!;
        (btn as DomElement).disabled = true;
        if (!keepLog) {
            this.clearLog();
        }
        this.log('Analisando integridade do PDF...');

        try {
            const r = await API.pdf.validate({ pdf_path: inputPath });
            this.renderResult(r);
            const erros = r.checks.filter((c: any) => c.status === 'error').length;
            const avisos = r.checks.filter((c: any) => c.status === 'warn').length;
            if (!r.valid) {
                this.log(`Problemas encontrados: ${erros} erro(s), ${avisos} aviso(s).`);
            } else if (avisos) {
                this.log(`PDF utilizável com ${avisos} aviso(s).`);
            } else {
                this.log('PDF íntegro: nenhum problema encontrado.');
            }
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }

    renderResult(r: any) {
        const erros = r.checks.filter((c: any) => c.status === 'error').length;
        const avisos = r.checks.filter((c: any) => c.status === 'warn').length;

        let banner;
        if (!r.valid) {
            banner = {
                cls: 'border-rose-200 bg-rose-50 text-rose-800',
                icon: 'circle-x',
                text: `PDF com problemas — ${erros} erro(s)${avisos ? `, ${avisos} aviso(s)` : ''}`,
            };
        } else if (avisos) {
            banner = {
                cls: 'border-amber-200 bg-amber-50 text-amber-800',
                icon: 'triangle-alert',
                text: `PDF utilizável — ${avisos} aviso(s)`,
            };
        } else {
            banner = {
                cls: 'border-emerald-200 bg-emerald-50 text-emerald-800',
                icon: 'circle-check',
                text: 'PDF íntegro — nenhum problema encontrado',
            };
        }

        const bannerEl = document.getElementById('validate-banner')!;
        bannerEl.className = `mb-3 flex items-center gap-3 rounded-xl border p-4 font-medium ${banner.cls}`;
        bannerEl.innerHTML = `<i data-lucide="${banner.icon}"></i><span>${banner.text}</span>`;

        const s = r.stats || {};
        const statBadges = [
            `${s.pages ?? '?'} página(s)`,
            formatSize(s.file_size || 0),
            `PDF ${s.pdf_version || '?'}`,
        ];
        if (s.encrypted) statBadges.push('Criptografado');
        if (s.repaired) statBadges.push('Precisou de reparo');
        if (s.producer) statBadges.push(String(s.producer).slice(0, 40));
        document.getElementById('validate-stats')!.innerHTML = statBadges
            .map(t => `<span class="badge">${escapeHtml(t)}</span>`).join('');

        document.getElementById('validate-checks')!.innerHTML = r.checks.map((c: any) => {
            const st = STATUS_STYLE[c.status] || STATUS_STYLE.warn;
            return `
                <li class="flex items-start gap-3 px-5 py-3">
                    <i data-lucide="${st.icon}" class="${st.cls} mt-0.5 shrink-0"></i>
                    <div class="min-w-0">
                        <div class="text-sm font-semibold text-zinc-800">${escapeHtml(c.label)}</div>
                        ${c.detail ? `<div class="text-sm break-words text-zinc-500">${escapeHtml(c.detail)}</div>` : ''}
                    </div>
                </li>
            `;
        }).join('');

        // Reparo: aparece quando existe ao menos UM check em error
        // (paginas/fluxos/imagens/fontes/cores/abertura...).
        this.repairSource = r.pdf_path || '';
        const temErro = r.checks.some((c: any) => c.status === 'error');
        document.getElementById('validate-repair')!.style.display =
            temErro ? 'block' : 'none';

        document.getElementById('validate-result')!.style.display = 'block';
    }

    async repairCores() {
        const inputPath = this.repairSource;
        if (!inputPath) {
            return;
        }

        // Copia nova: o original nunca e alterado.
        let outputPath = inputPath.replace(/\.pdf$/i, '') + '_corrigido.pdf';
        if (window.electronAPI && window.electronAPI.showSaveDialog) {
            const res = await window.electronAPI.showSaveDialog({
                defaultPath: outputPath,
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });
            if (res.canceled || !res.filePath) {
                return;
            }
            outputPath = res.filePath;
        }

        const btn = document.getElementById('btn-validate-repair')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Reparando problemas encontrados...');
        this.log('Em arquivos grandes isso pode levar minutos.');

        try {
            const rep = await API.pdf.repair({
                input_path: inputPath,
                output_path: outputPath
            });
            const before = rep.issues_before || {};
            const cats = Object.entries(before)
                .filter(([, v]) => (v as number) > 0)
                .map(([k, v]) => `${k}: ${v}`);
            if (cats.length) {
                this.log(`Problemas antes: ${cats.join(', ')}.`);
            }
            this.log(`Reparo: ${rep.repaired_count} corrigido(s)`
                + (rep.unrepaired_count
                    ? `, ${rep.unrepaired_count} não corrigido(s)` : '') + '.');
            (rep.unrepaired || []).slice(0, 5).forEach((u: any) => {
                const colorants = Array.isArray(u.colorants)
                    ? ` [${u.colorants.join('+')}]` : '';
                this.log(`  não corrigido${colorants} (${u.category}): ${u.reason}`);
            });
            if (!rep.repaired_count) {
                this.log('Nada pôde ser corrigido com segurança — original intacto.');
                this.setProgress(100);
                return;
            }
            this.log(`Arquivo corrigido salvo em: ${outputPath}`);

            // Revalida a copia corrigida mantendo o log do reparo.
            (document.getElementById('validate-input') as DomElement).value = outputPath;
            this.repairSource = outputPath;
            await this.validatePDF(true);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}
