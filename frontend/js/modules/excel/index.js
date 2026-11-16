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
        { id: 'convert', label: 'Conversão em Lote', icon: 'refresh-cw', make: () => new ExcelConvertFeature() },
        { id: 'merge-all', label: 'Combinar Planilhas', icon: 'table-2', make: () => new ExcelMergeAllFeature() },
        { id: 'extract-cells', label: 'Extrair Células', icon: 'grid-2x2', make: () => new ExcelExtractCellsFeature() },
        { id: 'split', label: 'Dividir por Coluna', icon: 'separator-vertical', make: () => new ExcelSplitFeature() },
        { id: 'split-sheets', label: 'Extrair Abas', icon: 'layers', make: () => new ExcelSplitSheetsFeature() },
    ];

    constructor(container) {
        super(container, {
            page: 'excel',
            title: 'Excel',
            icon: 'file-spreadsheet',
            features: ExcelModule.features,
        });
    }
}
