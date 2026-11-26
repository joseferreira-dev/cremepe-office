import { API } from '../../api.js';
import { FileUtils } from '../file/utils.js';
import { Feature } from '../feature.js';

export class PDFConvertToWordFeature extends Feature {
    direction!: string;
    updateSuggestions!: any;
    constructor() {
        super('convert');
        this.direction = 'pdf_to_word'; // 'pdf_to_word' | 'word_to_pdf'
    }

    render(container: HTMLElement) {
        container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Converter Word ↔ PDF</h4>
                <p class="text-zinc-500">Converta documentos entre os formatos Word (.docx, .doc) e PDF.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Direção da conversão</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-direction" id="convert-pdf-to-word" value="pdf_to_word" checked>
                                <label class="form-check-label">PDF → Word (.docx)</label>
                            </div>
                        </div>
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-direction" id="convert-word-to-pdf" value="word_to_pdf">
                                <label class="form-check-label">Word (.docx, .doc) → PDF</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="convert-input-file" class="form-control" placeholder="Selecione o arquivo...">
                        <button class="btn btn-outline-secondary" id="btn-convert-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de saída</h5>
                    <div class="input-group">
                        <input type="text" id="convert-output-file" class="form-control" placeholder="Caminho do arquivo de saída">
                        <button class="btn btn-outline-secondary" id="btn-convert-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4" id="convert-pages-card">
                <div class="card-body">
                    <h5 class="card-title section-title">Páginas (PDF → Word)</h5>
                    <input type="text" id="convert-pages" class="form-control" placeholder="Todas as páginas (ou ex.: 1-100, 200-250)">
                    <small class="text-zinc-500">Deixe vazio para converter o arquivo inteiro — em PDFs enormes use um intervalo para agilizar.</small>
                </div>
            </div>

            <button class="btn btn-success" id="btn-convert-execute"><i data-lucide="play" class="me-1"></i>Converter</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;

        // Eventos para alternar direção
        document.querySelectorAll('input[name="convert-direction"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.direction = (e.target as DomElement).value;
                this.togglePagesCard();
                this.updateSuggestions();
            });
        });

        this.togglePagesCard();
        this.attachEvents();
    }

    togglePagesCard() {
        const card = document.getElementById('convert-pages-card');
        if (card) {
            card.style.display = this.direction === 'pdf_to_word' ? 'block' : 'none';
        }
    }

    attachEvents() {
        document.getElementById('btn-convert-input')!.addEventListener('click', () => {
            const filters = this.direction === 'pdf_to_word'
                ? [{ name: 'PDF', extensions: ['pdf'] }]
                : [{ name: 'Word', extensions: ['docx', 'doc'] }];
            FileUtils.selectFile('convert-input-file', filters, { onSelect: () => { this.suggestOutput(); } });
        });

        document.getElementById('btn-convert-output')!.addEventListener('click', () => {
            const ext = this.direction === 'pdf_to_word' ? 'docx' : 'pdf';
            FileUtils.selectSaveFile('convert-output-file', [{ name: ext.toUpperCase(), extensions: [ext] }]);
        });

        document.getElementById('btn-convert-execute')!.addEventListener('click', () => this.executeConvert());

        // Atualizar sugestões quando entrada mudar
        document.getElementById('convert-input-file')!.addEventListener('change', () => this.suggestOutput());
        document.querySelectorAll('input[name="convert-direction"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.suggestOutput();
                this.togglePagesCard();
            });
        });
    }

    suggestOutput() {
        const input = (document.getElementById('convert-input-file') as DomElement).value.trim();
        if (input) {
            const output = document.getElementById('convert-output-file')!;
            if (!(output as DomElement).value) {
                const base = input.replace(/\.[^.]+$/, '');
                const ext = this.direction === 'pdf_to_word' ? 'docx' : 'pdf';
                (output as DomElement).value = `${base}.${ext}`;
            }
        }
    }

    async executeConvert() {
        const inputFile = (document.getElementById('convert-input-file') as DomElement).value.trim();
        const outputFile = (document.getElementById('convert-output-file') as DomElement).value.trim();

        if (!inputFile || !outputFile) {
            this.log('Selecione o arquivo de entrada e defina o de saída.');
            return;
        }

        const btn = document.getElementById('btn-convert-execute')!;
        (btn as DomElement).disabled = true;
        this.clearLog();

        try {
            if (this.direction === 'pdf_to_word') {
                const pagesSel = (document.getElementById('convert-pages') as DomElement).value.trim() || 'all';
                if (pagesSel === 'all') {
                    // Limiar: PDFs enormes demoram muito (arquivo real de
                    // 9315 paginas: >53 min). Pergunta antes de começar.
                    const info = await API.pdf.info({ pdf_path: inputFile });
                    if (info.pages > 200) {
                        const ok = confirm(
                            `PDF com ${info.pages} páginas.\n\n` +
                            'Converter o arquivo INTEIRO pode levar bastante tempo ' +
                            '(em teste real com 9315 páginas: mais de 53 minutos).\n\n' +
                            'OK = converter todas as páginas.\n' +
                            'Cancelar = informe um intervalo no campo "Páginas" (ex.: 1-100) para agilizar.');
                        if (!ok) {
                            this.log('Conversão cancelada. Informe um intervalo de páginas (ex.: 1-100) para converter só uma parte.');
                            return;
                        }
                    }
                }
                this.log(pagesSel === 'all'
                    ? 'Convertendo PDF → Word (todas as páginas)...'
                    : `Convertendo PDF → Word (páginas ${pagesSel})...`);
                const result = await API.pdf.convertToWord({
                    pdf_path: inputFile,
                    output_path: outputFile,
                    pages_selection: pagesSel
                });
                if (result.warning) this.log(`Aviso: ${result.warning}`);
                if (result.pages_converted) this.log(`(${result.pages_converted} página(s) convertida(s))`);
                this.log(`Concluído! Arquivo salvo em: ${result.output_path}`);
            } else {
                this.log('Convertendo Word → PDF...');
                const result = await API.word.convert({
                    input_path: inputFile,
                    output_path: outputFile,
                    output_format: 'pdf'
                });
                this.log(`Concluído! Arquivo salvo em: ${result.output_path}`);
            }
            this.setProgress(100);
        } catch (err) {
            this.log(`Erro: ${(err as Error).message}`);
        } finally {
            (btn as DomElement).disabled = false;
        }
    }
}

