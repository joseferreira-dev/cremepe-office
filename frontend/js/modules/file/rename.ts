import { API } from '../../api.js';
import { Feature } from '../feature.js';
import { FileUtils } from './utils.js';
import type { DomainModule } from '../domain.js';

export class RenameFeature extends Feature {
    module!: DomainModule;
    renameFilePaths!: any[];
    constructor(module: DomainModule) {
        super('rename');
        this.module = module;
        this.renameFilePaths = [];
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Renomear em Lote</h4>
                <p class="text-zinc-500">Renomeie vários arquivos de uma só vez com um padrão personalizado.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Diretório</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="rename-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-rename-dir">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Filtrar por extensão (ex: .pdf,.docx)</label>
                        <input type="text" id="rename-extensions" class="form-control" placeholder="Deixe vazio para todos">
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Padrão de Renomeação</h5>
                    <div class="mb-2">
                        <label class="form-label">Prefixo</label>
                        <input type="text" id="prefix" class="form-control" placeholder="ex: CREME_">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Sufixo</label>
                        <input type="text" id="suffix" class="form-control" placeholder="ex: _2026">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="use-sequential">
                        <label class="form-check-label">Adicionar numeração sequencial (001, 002...)</label>
                    </div>
                    <div class="mt-2" id="start-number-row" style="display:none;">
                        <label class="form-label">Número inicial</label>
                        <input type="number" id="start-number" class="form-control" value="1" min="1" style="width:100px;">
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Substituição (Regex)</h5>
                    <div class="mb-2">
                        <label class="form-label">Presets</label>
                        <select id="regex-preset" class="form-select">
                            <option value="none">Nenhum</option>
                            <option value="remove_spaces">Remover espaços (substituir por _)</option>
                            <option value="remove_accents">Remover acentos</option>
                            <option value="lowercase">Minúsculas</option>
                            <option value="uppercase">Maiúsculas</option>
                            <option value="titlecase">Título</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>
                    <div id="custom-regex-area" style="display:none;">
                        <div class="mb-2">
                            <label class="form-label">Buscar (regex)</label>
                            <input type="text" id="regex-search" class="form-control" placeholder="ex: \\s+">
                        </div>
                        <div class="mb-2">
                            <label class="form-label">Substituir por</label>
                            <input type="text" id="regex-replace" class="form-control" placeholder="ex: _">
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="remove-accents">
                        <label class="form-check-label">Remover acentos (adicional)</label>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Substituir espaços por</label>
                        <input type="text" id="replace-spaces" class="form-control" placeholder="ex: _ (deixe vazio para manter)">
                    </div>
                </div>
            </div>

            <div class="flex gap-2 mb-4">
                <button class="btn btn-outline-success" id="btn-rename-preview"><i data-lucide="eye"></i> Pré-visualizar</button>
                <button class="btn btn-success" id="btn-rename"><i data-lucide="play"></i> Renomear Arquivos</button>
            </div>

            <div id="rename-preview-area" style="display:none;">
                <label class="font-semibold text-zinc-600">Pré-visualização (<span id="rename-preview-count">0</span> arquivos)</label>
                <div id="rename-preview-list" class="border rounded p-2 border-zinc-200" style="max-height:250px; overflow:auto; font-size:0.9rem;">
                    <table class="table table-sm table-striped mb-0">
                        <thead><tr><th>Nome atual</th><th>Novo nome</th></tr></thead>
                        <tbody id="rename-preview-tbody"></tbody>
                    </table>
                </div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        this.attachEvents(container);
    }

    attachEvents(container: HTMLElement) {
        // Selecionar diretório
        container.querySelector('#btn-rename-dir')!.addEventListener('click', (e: any) => {
            e.stopPropagation();
            FileUtils.selectDirectory('rename-dir');
            // Força o carregamento dos arquivos após selecionar
            this.loadRenameFiles();
        });

        // Carregar arquivos quando o campo for alterado manualmente
        container.querySelector('#rename-dir')!.addEventListener('change', () => {
            this.loadRenameFiles();
        });

        // Numeração sequencial
        container.querySelector('#use-sequential')!.addEventListener('change', (e: any) => {
            (container.querySelector('#start-number-row') as HTMLElement).style.display = e.target.checked ? 'block' : 'none';
        });

        // Presets de regex
        container.querySelector('#regex-preset')!.addEventListener('change', (e: any) => {
            const val = e.target.value;
            (container.querySelector('#custom-regex-area') as HTMLElement).style.display = (val === 'custom') ? 'block' : 'none';
            if (val === 'remove_spaces') {
                (document.getElementById('regex-search') as DomElement).value = '\\s+';
                (document.getElementById('regex-replace') as DomElement).value = '_';
                (document.getElementById('replace-spaces') as DomElement).value = '';
                (document.getElementById('remove-accents') as DomElement).checked = false;
            } else if (val === 'remove_accents') {
                (document.getElementById('regex-search') as DomElement).value = '';
                (document.getElementById('regex-replace') as DomElement).value = '';
                (document.getElementById('remove-accents') as DomElement).checked = true;
                (document.getElementById('replace-spaces') as DomElement).value = '';
            } else if (val === 'lowercase' || val === 'uppercase' || val === 'titlecase' || val === 'none') {
                (document.getElementById('regex-search') as DomElement).value = '';
                (document.getElementById('regex-replace') as DomElement).value = '';
                (document.getElementById('remove-accents') as DomElement).checked = false;
                (document.getElementById('replace-spaces') as DomElement).value = '';
            }
        });

        // Botões
        container.querySelector('#btn-rename-preview')!.addEventListener('click', () => this.previewRename());
        container.querySelector('#btn-rename')!.addEventListener('click', () => this.executeRename());
    }

    loadRenameFiles() {
        const dir = (document.getElementById('rename-dir') as DomElement).value.trim();
        if (!dir) {
            this.renameFilePaths = [];
            this.log('Nenhum diretório selecionado.');
            return;
        }
        if (API && API.file && API.file.list) {
            this.log('Carregando lista de arquivos...');
            API.file.list({ dir })
                .then(result => {
                    this.renameFilePaths = result.files.map((f: any) => `${dir}/${f}`);
                    this.log(`Arquivos encontrados: ${this.renameFilePaths.length}`);
                })
                .catch(err => this.log(`Erro ao listar: ${err.message}`));
        }
    }

    async previewRename() {
        const dir = (document.getElementById('rename-dir') as DomElement).value.trim();
        if (!dir) {
            this.log('Selecione uma pasta.');
            return;
        }
        // Se não tiver carregado, carrega agora
        if (this.renameFilePaths.length === 0) {
            try {
                const result = await API.file.list({ dir });
                this.renameFilePaths = result.files.map((f: any) => `${dir}/${f}`);
                if (this.renameFilePaths.length === 0) {
                    this.log('Nenhum arquivo encontrado.');
                    return;
                }
            } catch (err) {
                this.log(`Erro ao listar: ${(err as Error).message}`);
                return;
            }
        }

        const prefix = (document.getElementById('prefix') as DomElement).value;
        const suffix = (document.getElementById('suffix') as DomElement).value;
        const useSeq = (document.getElementById('use-sequential') as DomElement).checked;
        const startNum = parseInt((document.getElementById('start-number') as DomElement).value) || 1;
        const extensions = (document.getElementById('rename-extensions') as DomElement).value.trim();
        const regexSearch = (document.getElementById('regex-search') as DomElement).value;
        const regexReplace = (document.getElementById('regex-replace') as DomElement).value;
        const preset = (document.getElementById('regex-preset') as DomElement).value;
        const removeAccents = (document.getElementById('remove-accents') as DomElement).checked;
        const replaceSpaces = (document.getElementById('replace-spaces') as DomElement).value.trim() || null;

        let caseConversion = 'none';
        if (preset === 'lowercase') caseConversion = 'lower';
        else if (preset === 'uppercase') caseConversion = 'upper';
        else if (preset === 'titlecase') caseConversion = 'title';

        const finalRegex = (preset === 'custom') ? regexSearch : (preset === 'remove_spaces' ? '\\s+' : null);
        const finalReplace = (preset === 'custom') ? regexReplace : (preset === 'remove_spaces' ? '_' : '');

        const params = {
            file_paths: this.renameFilePaths,
            prefix,
            suffix,
            start_number: startNum,
            use_original_name: !useSeq,
            extensions: extensions ? extensions.split(',').map(e => e.trim()) : undefined,
            regex_pattern: finalRegex,
            regex_replacement: finalReplace,
            case_conversion: caseConversion,
            remove_accents: removeAccents,
            replace_spaces_with: replaceSpaces,
        };

        const btn = document.getElementById('btn-rename-preview')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Carregando pré-visualização...');

        try {
            const result = await API.file.renamePreview(params);
            const previewArea = document.getElementById('rename-preview-area')!;
            previewArea.style.display = 'block';
            document.getElementById('rename-preview-count')!.textContent = result.count;
            const tbody = document.getElementById('rename-preview-tbody')!;
            if (result.count === 0) {
                tbody.innerHTML = '<tr><td colspan="2" class="text-zinc-500">Nenhum arquivo corresponde aos critérios.</td></tr>';
            } else {
                tbody.innerHTML = result.preview.map((p: any) => `
                    <tr>
                        <td>${p.original}</td>
                        <td><strong>${p.new}</strong></td>
                    </tr>
                `).join('');
            }
            this.log(`Pré-visualização: ${result.count} arquivos.`);
        } catch (err) {
            this.log(`Erro na pré-visualização: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }

    async executeRename() {
        const dir = (document.getElementById('rename-dir') as DomElement).value.trim();
        if (!dir) {
            this.log('Selecione uma pasta.');
            return;
        }
        if (this.renameFilePaths.length === 0) {
            this.log('Carregue os arquivos primeiro (selecione a pasta).');
            return;
        }

        const prefix = (document.getElementById('prefix') as DomElement).value;
        const suffix = (document.getElementById('suffix') as DomElement).value;
        const useSeq = (document.getElementById('use-sequential') as DomElement).checked;
        const startNum = parseInt((document.getElementById('start-number') as DomElement).value) || 1;
        const extensions = (document.getElementById('rename-extensions') as DomElement).value.trim();
        const regexSearch = (document.getElementById('regex-search') as DomElement).value;
        const regexReplace = (document.getElementById('regex-replace') as DomElement).value;
        const preset = (document.getElementById('regex-preset') as DomElement).value;
        const removeAccents = (document.getElementById('remove-accents') as DomElement).checked;
        const replaceSpaces = (document.getElementById('replace-spaces') as DomElement).value.trim() || null;

        let caseConversion = 'none';
        if (preset === 'lowercase') caseConversion = 'lower';
        else if (preset === 'uppercase') caseConversion = 'upper';
        else if (preset === 'titlecase') caseConversion = 'title';

        const finalRegex = (preset === 'custom') ? regexSearch : (preset === 'remove_spaces' ? '\\s+' : null);
        const finalReplace = (preset === 'custom') ? regexReplace : (preset === 'remove_spaces' ? '_' : '');

        const params = {
            file_paths: this.renameFilePaths,
            prefix,
            suffix,
            start_number: startNum,
            use_original_name: !useSeq,
            extensions: extensions ? extensions.split(',').map(e => e.trim()) : undefined,
            regex_pattern: finalRegex,
            regex_replacement: finalReplace,
            case_conversion: caseConversion,
            remove_accents: removeAccents,
            replace_spaces_with: replaceSpaces,
        };

        const btn = document.getElementById('btn-rename')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log(`Renomeando arquivos...`);

        try {
            const result = await API.file.rename(params);
            this.log(`Concluído! ${result.renamed_count} arquivos renomeados.`);
            this.setProgress(100);
            document.getElementById('rename-preview-area')!.style.display = 'none';
            // Recarrega a lista para refletir as alterações
            this.loadRenameFiles();
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}