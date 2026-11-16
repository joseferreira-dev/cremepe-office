import { DomainModule } from '../domain.js';
import { ExcelConvertFeature } from './convert.js';
import { ExcelExtractCellsFeature } from './extract_cells.js';
import { ExcelMergeAllFeature } from './merge_all.js';
import { ExcelSplitFeature } from './split_by_column.js';
import { ExcelSplitSheetsFeature } from './split_sheets.js';

export class ExcelModule extends DomainModule {
    // Lista de features do módulo — fonte única (consumida pela Home
    // para montar o catálogo de atalhos).
    static features = [
        { id: 'convert', label: 'Conversão em Lote', make: () => new ExcelConvertFeature() },
        { id: 'merge-all', label: 'Combinar Planilhas', make: () => new ExcelMergeAllFeature() },
        { id: 'extract-cells', label: 'Extrair Células', make: () => new ExcelExtractCellsFeature() },
        { id: 'split', label: 'Dividir por Coluna', make: () => new ExcelSplitFeature() },
        { id: 'split-sheets', label: 'Extrair Abas', make: () => new ExcelSplitSheetsFeature() },
    ];

    constructor(container) {
        super(container, {
            title: 'Excel',
            icon: 'bi-file-earmark-excel',
            features: ExcelModule.features,
        });
    }
}
