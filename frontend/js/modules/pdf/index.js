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

export class PDFModule extends DomainModule {
    // Lista de features do módulo — fonte única (consumida pela Home
    // para montar o catálogo de atalhos).
    static features = [
        { id: 'merge', label: 'Combinar', make: () => new PDFMergeFeature() },
        { id: 'merge-by-size', label: 'Combinar por Tamanho', make: () => new PDFMergeBySizeFeature() },
        { id: 'split', label: 'Dividir', make: () => new PDFSplitFeature() },
        { id: 'split-by-size', label: 'Dividir por Tamanho', make: () => new PDFSplitBySizeFeature() },
        { id: 'extract-pages', label: 'Extrair Páginas', make: () => new PDFExtractPagesFeature() },
        { id: 'remove-pages', label: 'Remover Páginas', make: () => new PDFRemovePagesFeature() },
        { id: 'reorder', label: 'Reordenar Páginas', make: () => new PDFReorderFeature() },
        { id: 'add-page-numbers', label: 'Numerar Páginas', make: () => new PDFAddPageNumbersFeature() },
        { id: 'convert-to-word', label: 'Converter para Word', make: () => new PDFConvertToWordFeature() },
        { id: 'convert-to-image', label: 'Converter para Imagem', make: () => new PDFConvertToImageFeature() },
        { id: 'compress', label: 'Comprimir', make: () => new PDFCompressFeature() },
        { id: 'protect', label: 'Proteger/Desproteger', make: () => new PDFProtectFeature() },
    ];

    constructor(container) {
        super(container, {
            title: 'PDF',
            icon: 'file-text',
            features: PDFModule.features,
        });
    }
}
