import { DomainModule } from '../domain.js';
import { DocCompareFeature } from './compare.js';
import { ConvertFeature } from './convert.js';
import { ExtractImagesFeature } from './extract_images.js';
import { FilePathFeature } from './filepath.js';
import { MergeFeature } from './merge.js';
import { WatermarkFeature } from './watermark.js';

export class WordModule extends DomainModule {
    constructor(container) {
        super(container, {
            title: 'Word',
            icon: 'bi-file-earmark-word',
            features: [
                { id: 'merge', label: 'Juntar Documentos', make: (m) => new MergeFeature(m) },
                { id: 'convert', label: 'Converter', make: (m) => new ConvertFeature(m) },
                { id: 'compare', label: 'Comparar', make: (m) => new DocCompareFeature(m) },
                { id: 'extract-images', label: 'Extrair Imagens', make: (m) => new ExtractImagesFeature(m) },
                { id: 'watermark', label: "Marca d'Água", make: (m) => new WatermarkFeature(m) },
                { id: 'filepath', label: 'Caminho do Arquivo', make: (m) => new FilePathFeature(m) },
            ],
        });
    }
}
