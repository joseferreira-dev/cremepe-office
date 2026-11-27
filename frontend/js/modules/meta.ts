/**
 * Metadados das funcionalidades para a Home (titulo, icone, descricao
 * e id legado do card) — DADOS PUROS, sem importar os modulos.
 *
 * Vive separado do home.ts porque favorites.ts e domain.ts tambem o
 * precisam (estrelas nas listas dos dominios); importar home.ts aqui
 * criaria o ciclo domain -> favorites -> home -> domain.
 */

export const HOME_META: Record<string, { id?: string; icon?: string; title?: string; desc?: string }> = {
    // ARQUIVOS
    'files/collect': { id: 'collect', icon: 'folder-input', title: 'Coletar Arquivos', desc: 'Reúna arquivos de múltiplas pastas.' },
    'files/rename': { id: 'rename', icon: 'pencil', title: 'Renomear em Lote', desc: 'Renomeie vários arquivos de uma vez.' },
    'files/duplicates': { id: 'duplicates', icon: 'copy', title: 'Localizar Duplicatas', desc: 'Encontre arquivos duplicados.' },
    'files/organize': { id: 'organize', icon: 'folder-tree', title: 'Organizar por Extensão', desc: 'Organize arquivos por tipo.' },
    'files/rename-by-content': { id: 'rename-by-content', icon: 'tags', title: 'Renomear por Conteúdo', desc: 'Renomeie usando metadados.' },
    'files/attributes': { id: 'attributes', icon: 'sliders-horizontal', title: 'Alterar Atributos', desc: 'Modifique datas e permissões.' },
    'files/report': { id: 'report', icon: 'list-tree', title: 'Relatório de Estrutura', desc: 'Exporte árvore de diretórios.' },
    'files/compare': { id: 'compare', icon: 'arrow-left-right', title: 'Comparar Pastas', desc: 'Compare e sincronize pastas.' },
    'files/archive': { id: 'archive', icon: 'archive', title: 'Compactar/Extrair', desc: 'Crie ou extraia arquivos ZIP.' },
    'files/split': { id: 'split-file', icon: 'scissors', title: 'Dividir/Remontar', desc: 'Divida ou remonte arquivos grandes.' },
    // PDF
    'pdf/merge': { id: 'pdf-merge', icon: 'file-text', title: 'Combinar PDFs', desc: 'Mescle vários PDFs.' },
    'pdf/merge-by-size': { id: 'pdf-merge-size', icon: 'file-text', title: 'Combinar por Tamanho', desc: 'Agrupe PDFs por limite de tamanho.' },
    'pdf/split': { id: 'pdf-split', icon: 'scissors', title: 'Dividir PDF', desc: 'Divida em partes com intervalos.' },
    'pdf/split-by-size': { id: 'pdf-split-size', icon: 'ruler', title: 'Dividir por Tamanho', desc: 'Divida PDF por MB.' },
    'pdf/extract-pages': { id: 'pdf-extract', icon: 'file-text', title: 'Extrair Páginas', desc: 'Extraia páginas específicas.' },
    'pdf/remove-pages': { id: 'pdf-remove', icon: 'file-text', title: 'Remover Páginas', desc: 'Remova páginas indesejadas.' },
    'pdf/reorder': { id: 'pdf-reorder', icon: 'files', title: 'Reordenar Páginas', desc: 'Altere a ordem das páginas.' },
    'pdf/add-page-numbers': { id: 'pdf-numbers', icon: 'arrow-down-wide-narrow', title: 'Numerar Páginas', desc: 'Adicione numeração.' },
    'pdf/convert-to-word': { id: 'pdf-to-word', icon: 'file-output', title: 'PDF → Word', desc: 'Converta PDF para Word.' },
    'pdf/convert-to-image': { id: 'pdf-image', icon: 'image', title: 'PDF ↔ Imagem', desc: 'Converta entre PDF e imagens.' },
    'pdf/compress': { id: 'pdf-compress', icon: 'minimize-2', title: 'Comprimir PDF', desc: 'Reduza o tamanho do PDF.' },
    'pdf/validate': { id: 'pdf-validate', icon: 'shield-check', title: 'Validar PDF', desc: 'Confira integridade e erros do arquivo.' },
    'pdf/ocr': { id: 'pdf-ocr', icon: 'scan-text', title: 'OCR / Texto', desc: 'Reconheça texto em PDFs digitalizados.' },
    'pdf/protect': { id: 'pdf-protect', icon: 'lock', title: 'Proteger/Desproteger', desc: 'Adicione ou remova senha.' },
    // WORD
    'word/merge': { id: 'word-merge', icon: 'file-pen', title: 'Juntar Documentos', desc: 'Combine vários Word.' },
    'word/convert': { id: 'word-convert', icon: 'arrow-left-right', title: 'Converter Word', desc: 'Converta para HTML, TXT, PDF, etc.' },
    'word/compare': { id: 'word-compare', icon: 'files', title: 'Comparar Docs', desc: 'Compare dois documentos.' },
    'word/extract-images': { id: 'word-images', icon: 'image', title: 'Extrair Imagens', desc: 'Extraia imagens do documento.' },
    'word/watermark': { id: 'word-watermark', icon: 'droplet', title: "Marca d'Água", desc: 'Insira texto ou imagem.' },
    'word/filepath': { id: 'word-filepath', icon: 'file', title: 'Caminho do Arquivo', desc: 'Insira caminho no documento.' },
    // EXCEL
    'excel/convert': { id: 'excel-convert', icon: 'file-spreadsheet', title: 'Conversão em Lote', desc: 'Converta planilhas em lote.' },
    'excel/merge-all': { id: 'excel-merge', icon: 'table', title: 'Combinar Planilhas', desc: 'Consolide várias planilhas.' },
    'excel/extract-cells': { id: 'excel-extract', icon: 'grid-2x2', title: 'Extrair Células', desc: 'Extraia células específicas.' },
    'excel/split': { id: 'excel-split', icon: 'separator-vertical', title: 'Dividir por Coluna', desc: 'Divida pela coluna chave.' },
    'excel/split-sheets': { id: 'excel-sheets', icon: 'files', title: 'Extrair Abas', desc: 'Separe abas em arquivos.' },
};

/** Id do card — mesma regra do buildAvailableFeatures da Home. */
export function cardId(page: string, featureId: string): string {
    return HOME_META[`${page}/${featureId}`]?.id || `${page}-${featureId}`;
}

/** Secao/nome do dominio por pagina (mesmo mapeamento do catalogo). */
export const SECTION_BY_PAGE: Record<string, string> = {
    files: 'Arquivos',
    pdf: 'PDF',
    word: 'Word',
    excel: 'Excel',
};

