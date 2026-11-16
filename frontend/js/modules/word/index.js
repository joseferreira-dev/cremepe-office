import { DomainModule } from '../domain.js';
import { DocCompareFeature } from './compare.js';
import { ConvertFeature } from './convert.js';
import { ExtractImagesFeature } from './extract_images.js';
import { FilePathFeature } from './filepath.js';
import { MergeFeature } from './merge.js';
import { WatermarkFeature } from './watermark.js';

export class WordModule extends DomainModule {
    // Lista de features do módulo — fonte única (consumida pela Home
    // para montar o catálogo de atalhos).
    static features = [
        { id: 'merge', label: 'Juntar Documentos', icon: 'files', make: (m) => new MergeFeature(m) },
        { id: 'convert', label: 'Converter', icon: 'refresh-cw', make: (m) => new ConvertFeature(m) },
        { id: 'compare', label: 'Comparar', icon: 'git-compare', make: (m) => new DocCompareFeature(m) },
        { id: 'extract-images', label: 'Extrair Imagens', icon: 'image', make: (m) => new ExtractImagesFeature(m) },
        { id: 'watermark', label: "Marca d'Água", icon: 'droplets', make: (m) => new WatermarkFeature(m) },
        { id: 'filepath', label: 'Caminho do Arquivo', icon: 'link', make: (m) => new FilePathFeature(m) },
    ];

    constructor(container) {
        super(container, {
            page: 'word',
            title: 'Word',
            icon: 'file-pen',
            features: WordModule.features,
        });
    }
}
