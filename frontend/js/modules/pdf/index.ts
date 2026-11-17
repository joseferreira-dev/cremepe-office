import { DomainModule } from '../domain.js';
import { PDFAddPageNumbersFeature } from './add_page_numbers.js';
import { PDFCompressFeature } from './compress.js';
import { PDFConvertToImageFeature } from './convert_to_image.js';
import { PDFConvertToWordFeature } from './convert_to_word.js';
import { PDFExtractPagesFeature } from './extract_pages.js';
import { PDFMergeFeature } from './merge.js';
import { PDFMergeBySizeFeature } from './merge_by_size.js';
import { PDFProtectFeature } from './protect.js';
import { PDFRemovePagesFeature } from './remove_pages.js';
import { PDFReorderFeature } from './reorder.js';
import { PDFSplitFeature } from './split.js';
import { PDFSplitBySizeFeature } from './split_by_size.js';
import { PDFValidateFeature } from './validate.js';

export class PDFModule extends DomainModule {
    // Lista de features do módulo — fonte única (consumida pela Home
    // para montar o catálogo de atalhos).
    static features = [
        { id: 'merge', label: 'Combinar', icon: 'combine', make: () => new PDFMergeFeature() },
        { id: 'merge-by-size', label: 'Combinar por Tamanho', icon: 'layers', make: () => new PDFMergeBySizeFeature() },
        { id: 'split', label: 'Dividir', icon: 'scissors', make: () => new PDFSplitFeature() },
        { id: 'split-by-size', label: 'Dividir por Tamanho', icon: 'ruler', make: () => new PDFSplitBySizeFeature() },
        { id: 'extract-pages', label: 'Extrair Páginas', icon: 'file-output', make: () => new PDFExtractPagesFeature() },
        { id: 'remove-pages', label: 'Remover Páginas', icon: 'file-minus', make: () => new PDFRemovePagesFeature() },
        { id: 'reorder', label: 'Reordenar Páginas', icon: 'arrow-up-down', make: () => new PDFReorderFeature() },
        { id: 'add-page-numbers', label: 'Numerar Páginas', icon: 'list-ordered', make: () => new PDFAddPageNumbersFeature() },
        { id: 'convert-to-word', label: 'Converter para Word', icon: 'refresh-cw', make: () => new PDFConvertToWordFeature() },
        { id: 'convert-to-image', label: 'Converter para Imagem', icon: 'image', make: () => new PDFConvertToImageFeature() },
        { id: 'compress', label: 'Comprimir', icon: 'minimize-2', make: () => new PDFCompressFeature() },
        { id: 'validate', label: 'Validar PDF', icon: 'shield-check', make: () => new PDFValidateFeature() },
        { id: 'protect', label: 'Proteger/Desproteger', icon: 'lock', make: () => new PDFProtectFeature() },
    ];

    constructor(container: HTMLElement) {
        super(container, {
            page: 'pdf',
            title: 'PDF',
            icon: 'file-text',
            features: PDFModule.features,
        });
    }
}
