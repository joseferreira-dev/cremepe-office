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
    constructor(container) {
        super(container, {
            title: 'Arquivos e Pastas',
            icon: 'bi-folder2-open',
            features: [
                { id: 'collect', label: 'Coletar Arquivos', make: (m) => new CollectFeature(m) },
                { id: 'rename', label: 'Renomear em Lote', make: (m) => new RenameFeature(m) },
                { id: 'duplicates', label: 'Localizar Duplicatas', make: (m) => new DuplicatesFeature(m) },
                { id: 'organize', label: 'Organizar por Extensão', make: (m) => new OrganizeFeature(m) },
                { id: 'rename-by-content', label: 'Renomear por Conteúdo', make: (m) => new RenameByContentFeature(m) },
                { id: 'attributes', label: 'Alterar Atributos', make: (m) => new AttributesFeature(m) },
                { id: 'report', label: 'Relatório de Estrutura', make: (m) => new ReportFeature(m) },
                { id: 'compare', label: 'Comparar Pastas', make: (m) => new CompareFeature(m) },
                { id: 'archive', label: 'Compactar e Extrair', make: (m) => new ArchiveFeature(m) },
                { id: 'split', label: 'Dividir e Remontar', make: (m) => new SplitFeature(m) },
            ],
        });
    }
}
