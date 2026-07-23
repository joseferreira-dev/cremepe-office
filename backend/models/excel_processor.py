import os
import csv
from pathlib import Path
import re
import openpyxl
import xlwt
from openpyxl import Workbook, load_workbook
from datetime import datetime

# ========== UTILITÁRIOS ==========
def _get_base_name(file_path):
    return Path(file_path).stem

def _read_csv_rows(input_path):
    """Lê um arquivo CSV e retorna lista de listas."""
    with open(input_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        return list(reader)

# ========== XLSX -> OUTROS ==========
def convert_xlsx_to_csv(input_path, output_path):
    wb = load_workbook(input_path, data_only=True)
    ws = wb.active
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        for row in ws.iter_rows(values_only=True):
            writer.writerow(row)

def convert_xlsx_to_xls(input_path, output_path):
    wb = load_workbook(input_path, data_only=True)
    ws = wb.active
    book = xlwt.Workbook(encoding='utf-8')
    sheet = book.add_sheet('Sheet1')
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        for j, val in enumerate(row):
            if val is None:
                val = ''
            sheet.write(i, j, val)
    book.save(output_path)

def convert_xlsx_to_html(input_path, output_path):
    wb = load_workbook(input_path, data_only=True)
    ws = wb.active
    html = '<table border="1" cellpadding="3" style="border-collapse:collapse;">\n'
    for row in ws.iter_rows(values_only=True):
        html += '<tr>'
        for cell in row:
            html += f'<td>{cell if cell is not None else ""}</td>'
        html += '</tr>\n'
    html += '</table>'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

def convert_xlsx_to_markdown(input_path, output_path):
    wb = load_workbook(input_path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('')
        return
    headers = [str(cell) if cell is not None else '' for cell in rows[0]]
    md = '| ' + ' | '.join(headers) + ' |\n'
    md += '|' + '|'.join(['---' for _ in headers]) + '|\n'
    for row in rows[1:]:
        values = [str(cell) if cell is not None else '' for cell in row]
        md += '| ' + ' | '.join(values) + ' |\n'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(md)

# ========== CSV -> OUTROS ==========
def convert_csv_to_xlsx(input_path, output_path):
    rows = _read_csv_rows(input_path)
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    wb.save(output_path)

def convert_csv_to_xls(input_path, output_path):
    rows = _read_csv_rows(input_path)
    book = xlwt.Workbook(encoding='utf-8')
    sheet = book.add_sheet('Sheet1')
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            sheet.write(i, j, val)
    book.save(output_path)

def convert_csv_to_html(input_path, output_path):
    rows = _read_csv_rows(input_path)
    html = '<table border="1" cellpadding="3" style="border-collapse:collapse;">\n'
    for row in rows:
        html += '<tr>'
        for cell in row:
            html += f'<td>{cell}</td>'
        html += '</tr>\n'
    html += '</table>'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

def convert_csv_to_markdown(input_path, output_path):
    rows = _read_csv_rows(input_path)
    if not rows:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('')
        return
    headers = rows[0]
    md = '| ' + ' | '.join(headers) + ' |\n'
    md += '|' + '|'.join(['---' for _ in headers]) + '|\n'
    for row in rows[1:]:
        md += '| ' + ' | '.join(row) + ' |\n'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(md)

# ========== CONVERSÃO EM LOTE ==========
def batch_convert(source_dir, dest_dir, input_format, output_format, recursive=False, overwrite=False):
    """
    Converte todos os arquivos de uma pasta (e subpastas, se recursive=True)
    do formato de entrada para o formato de saída.

    input_format: 'xlsx' ou 'csv'
    output_format: 'xlsx', 'csv', 'xls', 'html', 'markdown'
    """
    source_path = Path(source_dir).resolve()
    dest_path = Path(dest_dir).resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Pasta origem não encontrada: {source_dir}")
    dest_path.mkdir(parents=True, exist_ok=True)

    ext_map = {
        'xlsx': '.xlsx',
        'csv': '.csv',
        'xls': '.xls',
        'html': '.html',
        'markdown': '.md'
    }
    input_ext = ext_map[input_format]
    output_ext = ext_map[output_format]

    if recursive:
        files = list(source_path.rglob('*'))
    else:
        files = list(source_path.glob('*'))
    files = [f for f in files if f.is_file() and f.suffix.lower() == input_ext]

    results = {'processed': 0, 'skipped': 0, 'errors': []}

    for file_path in files:
        base = file_path.stem
        output_file = dest_path / (base + output_ext)

        if output_file.exists() and not overwrite:
            results['skipped'] += 1
            continue

        try:
            # Mapeia a função de conversão
            if input_format == 'xlsx':
                if output_format == 'csv':
                    convert_xlsx_to_csv(file_path, output_file)
                elif output_format == 'xls':
                    convert_xlsx_to_xls(file_path, output_file)
                elif output_format == 'html':
                    convert_xlsx_to_html(file_path, output_file)
                elif output_format == 'markdown':
                    convert_xlsx_to_markdown(file_path, output_file)
            elif input_format == 'csv':
                if output_format == 'xlsx':
                    convert_csv_to_xlsx(file_path, output_file)
                elif output_format == 'xls':
                    convert_csv_to_xls(file_path, output_file)
                elif output_format == 'html':
                    convert_csv_to_html(file_path, output_file)
                elif output_format == 'markdown':
                    convert_csv_to_markdown(file_path, output_file)
            results['processed'] += 1
        except Exception as e:
            results['errors'].append({'file': str(file_path), 'error': str(e)})

    return results

# ========== MESCLAR TUDO EM UM ==========
def _sanitize_sheet_name(name: str, max_len=31) -> str:
    """Sanitiza o nome da aba para ser válido no Excel."""
    # Remove caracteres inválidos: \ / ? * [ ]
    name = re.sub(r'[\\/*?:\[\]]', '', name)
    # Remove espaços extras e limita tamanho
    name = name.strip()[:max_len]
    if not name:
        name = "Sheet"
    return name

def merge_all_files(
    source_dir: str,
    dest_file: str,
    mode: str = 'sheets',          # 'sheets' ou 'stack'
    include_header: bool = True,   # só usado em 'stack'
    recursive: bool = False
) -> dict:
    """
    Consolida todos os arquivos .xlsx de uma pasta em um único arquivo.

    Args:
        source_dir: Pasta de origem
        dest_file: Caminho do arquivo de saída (.xlsx)
        mode: 'sheets' (cada arquivo em uma aba) ou 'stack' (empilhar linhas)
        include_header: Se True e mode='stack', usa cabeçalho do primeiro arquivo
        recursive: Se True, inclui subpastas

    Returns:
        dict com estatísticas: processed, total_rows, total_sheets, errors
    """
    source_path = Path(source_dir).resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Pasta não encontrada: {source_dir}")

    dest_path = Path(dest_file).resolve()
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    # Coletar arquivos .xlsx
    if recursive:
        files = list(source_path.rglob('*.xlsx'))
    else:
        files = list(source_path.glob('*.xlsx'))

    if not files:
        raise ValueError(f"Nenhum arquivo .xlsx encontrado em {source_dir}")

    stats = {
        'processed': 0,
        'total_rows': 0,
        'total_sheets': 0,
        'errors': []
    }

    if mode == 'sheets':
        # Criar um novo workbook
        wb_out = Workbook()
        # Remover a aba padrão (será substituída)
        default_sheet = wb_out.active
        wb_out.remove(default_sheet)

        for file_path in files:
            try:
                wb_in = load_workbook(file_path, data_only=True)
                # Usar a primeira planilha ativa
                ws_in = wb_in.active
                if ws_in is None:
                    stats['errors'].append(f"{file_path.name}: Planilha vazia")
                    continue

                # Nome da aba: nome do arquivo sem extensão, sanitizado
                sheet_name = _sanitize_sheet_name(file_path.stem)
                # Garantir nome único
                if sheet_name in wb_out.sheetnames:
                    counter = 2
                    base = sheet_name
                    while f"{base}_{counter}" in wb_out.sheetnames:
                        counter += 1
                    sheet_name = f"{base}_{counter}"

                ws_out = wb_out.create_sheet(title=sheet_name)

                # Copiar dados
                for row in ws_in.iter_rows(values_only=True):
                    ws_out.append(row)

                stats['processed'] += 1
                stats['total_sheets'] += 1
                stats['total_rows'] += ws_in.max_row - 1  # desconsidera cabeçalho? não, contamos tudo

            except Exception as e:
                stats['errors'].append(f"{file_path.name}: {str(e)}")

        # Salvar
        wb_out.save(dest_path)

    else:  # mode == 'stack'
        wb_out = Workbook()
        ws_out = wb_out.active
        ws_out.title = "Consolidado"

        first_file = True
        total_rows = 0

        for file_path in files:
            try:
                wb_in = load_workbook(file_path, data_only=True)
                ws_in = wb_in.active
                if ws_in is None:
                    stats['errors'].append(f"{file_path.name}: Planilha vazia")
                    continue

                # Determinar linhas a copiar
                rows_to_copy = list(ws_in.iter_rows(values_only=True))

                if not rows_to_copy:
                    continue

                if include_header:
                    if first_file:
                        # Copiar cabeçalho do primeiro arquivo
                        header_row = rows_to_copy[0]
                        ws_out.append(header_row)
                        data_rows = rows_to_copy[1:]
                        first_file = False
                    else:
                        # Pular cabeçalho dos demais
                        data_rows = rows_to_copy[1:]
                else:
                    # Sem cabeçalho: copiar todas as linhas
                    data_rows = rows_to_copy

                # Copiar linhas de dados
                for row in data_rows:
                    ws_out.append(row)

                stats['processed'] += 1
                stats['total_rows'] += len(data_rows)

            except Exception as e:
                stats['errors'].append(f"{file_path.name}: {str(e)}")

        wb_out.save(dest_path)

    return stats

# ========== EXTRAIR CÉLULAS ESPECÍFICAS ==========
# ========== EXTRAIR CÉLULAS ESPECÍFICAS ==========
def extract_cells(
    source_dir: str,
    output_csv: str,
    cell_mappings: dict,  # ex: {"Título": "A1", "Total": "B2", "Data": "C5"}
    recursive: bool = False
) -> dict:
    """
    Escaneia todos os arquivos .xlsx de uma pasta e extrai células específicas,
    gerando um arquivo CSV de resumo.

    Args:
        source_dir: Pasta de origem
        output_csv: Caminho do arquivo CSV de saída
        cell_mappings: Dicionário {nome_coluna: referencia_celula}, ex: {"Valor Total": "B2"}
        recursive: Se True, inclui subpastas

    Returns:
        dict com estatísticas: processed, errors, output_path
    """
    source_path = Path(source_dir).resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Pasta não encontrada: {source_dir}")

    output_path = Path(output_csv).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Coletar arquivos .xlsx
    if recursive:
        files = list(source_path.rglob('*.xlsx'))
    else:
        files = list(source_path.glob('*.xlsx'))

    if not files:
        raise ValueError(f"Nenhum arquivo .xlsx encontrado em {source_dir}")

    # Definir cabeçalho do CSV: "Arquivo" + colunas extraídas
    headers = ['Arquivo'] + list(cell_mappings.keys())

    # Preparar lista de linhas
    rows = []
    errors = []

    for file_path in files:
        row_data = {'Arquivo': file_path.name}
        try:
            wb = load_workbook(file_path, data_only=True)
            ws = wb.active
            if ws is None:
                errors.append(f"{file_path.name}: Planilha vazia")
                # Preencher com valores vazios
                for col_name in cell_mappings.keys():
                    row_data[col_name] = ''
                rows.append(row_data)
                continue

            # Extrair cada célula
            for col_name, cell_ref in cell_mappings.items():
                try:
                    value = ws[cell_ref].value
                    # Converter para string se não for None
                    row_data[col_name] = str(value) if value is not None else ''
                except Exception as e:
                    row_data[col_name] = ''
                    errors.append(f"{file_path.name}: Erro ao extrair {cell_ref} ({col_name}) - {str(e)}")

            rows.append(row_data)

        except Exception as e:
            errors.append(f"{file_path.name}: {str(e)}")
            # Adicionar linha vazia mesmo assim
            for col_name in cell_mappings.keys():
                row_data[col_name] = ''
            rows.append(row_data)

    # Escrever CSV
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    stats = {
        'processed': len(rows),
        'errors': errors,
        'output_path': str(output_path)
    }
    return stats