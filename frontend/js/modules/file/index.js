import { DomainModule } from '../domain.js';
import { ArchiveFeature } from './archive.js';
import { AttributesFeature } from './attributes.js';
import { CollectFeature } from './collect.js';
import { CompareFeature } from './compare.js';
import { DuplicatesFeature } from './duplicates.js';
import { OrganizeFeature } from './organize.js';
import { RenameFeature } from './rename.js';
import { RenameByContentFeature } from './rename_by_content.js';
import { ReportFeature } from './report.js';
import { SplitFeature } from './split.js';

export class FileModule extends DomainModule {
    // Lista de features do módulo — fonte única (consumida pela Home
    // para montar o catálogo de atalhos).
    static features = [
        { id: 'collect', label: 'Coletar Arquivos', icon: 'folder-input', make: (m) => new CollectFeature(m) },
        { id: 'rename', label: 'Renomear em Lote', icon: 'pencil', make: (m) => new RenameFeature(m) },
        { id: 'duplicates', label: 'Localizar Duplicatas', icon: 'copy', make: (m) => new DuplicatesFeature(m) },
        { id: 'organize', label: 'Organizar por Extensão', icon: 'folder-tree', make: (m) => new OrganizeFeature(m) },
        { id: 'rename-by-content', label: 'Renomear por Conteúdo', icon: 'tags', make: (m) => new RenameByContentFeature(m) },
        { id: 'attributes', label: 'Alterar Atributos', icon: 'sliders-horizontal', make: (m) => new AttributesFeature(m) },
        { id: 'report', label: 'Relatório de Estrutura', icon: 'list-tree', make: (m) => new ReportFeature(m) },
        { id: 'compare', label: 'Comparar Pastas', icon: 'arrow-left-right', make: (m) => new CompareFeature(m) },
        { id: 'archive', label: 'Compactar e Extrair', icon: 'archive', make: (m) => new ArchiveFeature(m) },
        { id: 'split', label: 'Dividir e Remontar', icon: 'scissors', make: (m) => new SplitFeature(m) },
    ];

    constructor(container) {
        super(container, {
            page: 'files',
            title: 'Arquivos e Pastas',
            icon: 'folder-open',
            features: FileModule.features,
        });
    }
}
