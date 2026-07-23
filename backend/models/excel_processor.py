import os
import csv
from pathlib import Path
import openpyxl
import xlwt
from openpyxl import load_workbook

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