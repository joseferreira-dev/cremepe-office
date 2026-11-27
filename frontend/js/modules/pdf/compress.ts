import { API } from '../../api.js';
import { FileUtils } from '../file/utils.js';
import { Feature } from '../feature.js';

export class PDFCompressFeature extends Feature {
    compressionLevels!: any;
    constructor() {
        super('compress');
        this.compressionLevels = [
            { value: 'low', label: 'Baixa (150 DPI)' },
            { value: 'medium', label: 'Média (100 DPI)' },
            { value: 'high', label: 'Alta (72 DPI)' }
        ];
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Comprimir PDF</h4>
                <p class="text-zinc-500">Reduza o tamanho do PDF reamostrando imagens e aplicando compressão JPEG.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="compress-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-compress-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Nível de compressão</h5>
                    <div class="grid grid-cols-12 gap-2">
                        ${this.compressionLevels.map((lvl: any) => `
                            <div class="md:col-span-4">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="compress-level" id="compress-${lvl.value}" value="${lvl.value}" ${lvl.value === 'medium' ? 'checked' : ''}>
                                    <label class="form-check-label" for="compress-${lvl.value}">${lvl.label}</label>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Qualidade das imagens (JPEG)</h5>
                    <div class="flex items-center gap-4">
                        <input type="range" id="jpeg-quality" class="form-range grow" min="10" max="100" value="85">
                        <span id="jpeg-quality-label" class="font-bold" style="min-width:45px;">85%</span>
                    </div>
                    <small class="text-zinc-500">Valores mais baixos = arquivos menores, porém com perda de qualidade.
                        Aplica-se apenas quando "Redimensionar imagens" está ativo.</small>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Opções</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compress-remove-metadata">
                        <label class="form-check-label">Remover metadados (autor, título, etc.)</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compress-downscale" checked>
                        <label class="form-check-label">Redimensionar imagens (reduzir resolução)</label>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="compress-output" class="form-control" placeholder="Caminho do PDF comprimido">
                        <button class="btn btn-outline-secondary" id="btn-compress-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-compress"><i data-lucide="play" class="me-1"></i>Comprimir</button>

            ${this.progressHTML()}

            <div id="compress-result" style="display:none;" class="mt-4">
                <div class="grid grid-cols-12 gap-2">
                    <div class="col-span-6"><span class="badge bg-zinc-500">Original: <span id="orig-size">0</span> KB</span></div>
                    <div class="col-span-6"><span class="badge bg-brand-600">Comprimido: <span id="comp-size">0</span> KB</span></div>
                </div>
                <div class="mt-2"><span class="badge bg-sky-100">Redução: <span id="comp-ratio">0</span>%</span></div>
                <div class="mt-2" id="skipped-images-row" style="display:none;">
                    <span class="badge bg-amber-100 text-amber-800">
                        <span id="skipped-images">0</span> imagem(ns) mantida(s) intacta(s)
                    </span>
                    <div class="mt-1"><small class="text-zinc-500">Não reamostradas (codec indisponível no
                        ambiente ou já abaixo do DPI alvo) — preservadas para não degradar a qualidade.</small></div>
                </div>
            </div>

            ${this.logHTML()}
        `;

        // Atualizar label do slider de qualidade
        document.getElementById('jpeg-quality')!.addEventListener('input', (e) => {
            document.getElementById('jpeg-quality-label')!.textContent = (e.target as DomElement).value + '%';
        });

        this.attachEvents();
    }

    attachEvents() {
        document.getElementById('btn-compress-input')!.addEventListener('click', () => {
            FileUtils.selectFile('compress-input', [{ name: 'PDF', extensions: ['pdf'] }], {onSelect: () => { this.suggestOutput(); }})
        });

        document.getElementById('btn-compress-output')!.addEventListener('click', () => {
            FileUtils.selectSaveFile('compress-output', [{ name: 'PDF', extensions: ['pdf'] }])
        });

        document.getElementById('btn-compress')!.addEventListener('click', () => this.compressPDF());
        document.getElementById('compress-input')!.addEventListener('change', () => this.suggestOutput());
    }

    suggestOutput() {
        const input = (document.getElementById('compress-input') as DomElement).value.trim();
        const output = document.getElementById('compress-output')!;
        if (input && !(output as DomElement).value) {
            const base = input.replace(/\.[^.]+$/, '');
            (output as DomElement).value = `${base}_comprimido.pdf`;
        }
    }

    async compressPDF() {
        const inputPath = (document.getElementById('compress-input') as DomElement).value.trim();
        const outputPath = (document.getElementById('compress-output') as DomElement).value.trim();
        const levelRadio = document.querySelector('input[name="compress-level"]:checked')!;
        const compressionLevel = levelRadio ? (levelRadio as DomElement).value : 'medium';
        const jpegQuality = parseInt((document.getElementById('jpeg-quality') as DomElement).value) || 85;
        const removeMetadata = (document.getElementById('compress-remove-metadata') as DomElement).checked;
        const downscaleImages = (document.getElementById('compress-downscale') as DomElement).checked;

        if (!inputPath || !outputPath) {
            this.log('Selecione o PDF de entrada e defina o de saída.');
            return;
        }

        const btn = document.getElementById('btn-compress')!;
        (btn as DomElement).disabled = true;
        this.clearLog();
        this.log('Comprimindo PDF...');

        try {
            const result = await API.pdf.compress({
                input_path: inputPath,
                output_path: outputPath,
                compression_level: compressionLevel,
                jpeg_quality: jpegQuality,
                remove_metadata: removeMetadata,
                downscale_images: downscaleImages
            });

            const orig = (result.original_size / 1024).toFixed(2);
            const comp = (result.compressed_size / 1024).toFixed(2);
            const reduction = Math.max(0, ((1 - result.ratio) * 100)).toFixed(1);

            document.getElementById('orig-size')!.textContent = orig;
            document.getElementById('comp-size')!.textContent = comp;
            document.getElementById('comp-ratio')!.textContent = reduction;
            document.getElementById('compress-result')!.style.display = 'block';

            // Imagens que o backend nao reamostrou (skipped_images):
            // mostra a contagem para o usuario entender por que a reducao
            // ficou abaixo do esperado (ex.: JBIG2/DeviceN no arquivo real).
            const skipped = typeof result.skipped_images === 'number'
                ? result.skipped_images : 0;
            const skippedRow = document.getElementById('skipped-images-row');
            if (skipped > 0 && skippedRow) {
                document.getElementById('skipped-images')!.textContent = String(skipped);
                skippedRow.style.display = 'block';
                this.log(`${skipped} imagem(ns) mantida(s) intacta(s) (codec indisponível neste ambiente ou já abaixo do DPI alvo).`);
            } else if (skippedRow) {
                skippedRow.style.display = 'none';
            }

            if (result.ratio >= 1) {
                this.log(`Sem redução de tamanho: ${orig} KB -> ${comp} KB (conteúdo já estava otimizado).`);
                this.log(`Arquivo salvo em: ${result.output_path}`);
            } else {
                this.log(`Comprimido com sucesso! Tamanho original: ${orig} KB, comprimido: ${comp} KB (redução de ${reduction}%)`);
                this.log(`Arquivo salvo em: ${result.output_path}`);
            }
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}

