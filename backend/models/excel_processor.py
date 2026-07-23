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

# ========== EXTRAIR CÉLULAS ==========
def _evaluate_formula(expression, values):
    """
    Avalia uma expressão matemática simples usando valores numéricos.
    Substitui nomes de campos por seus valores e calcula o resultado.
    """
    # Substitui nomes de campos pelos valores
    for key, val in values.items():
        if isinstance(val, (int, float)):
            # Substitui o nome do campo pelo valor (garantindo que não seja parte de outra palavra)
            expression = re.sub(rf'\b{re.escape(key)}\b', str(val), expression)
    # Remove espaços e avalia
    try:
        # Usa eval com segurança restrita (apenas operadores matemáticos)
        # Permite + - * / ** ( ) . e números
        result = eval(expression, {"__builtins__": None}, {})
        return result
    except Exception:
        return None

def extract_cells_from_directory(source_dir, fields, recursive=False, output_file=None):
    """
    Escaneia uma pasta de planilhas XLSX e extrai células específicas.
    fields: lista de dicionários { 'name': str, 'source': str } onde source pode ser:
        - uma célula: "A1", "B2", etc.
        - uma fórmula: "Valor1 - Valor2" (referenciando nomes de outros campos)
    Retorna: lista de dicionários com nome do arquivo + valores extraídos.
    Se output_file for fornecido, salva como CSV.
    """
    source_path = Path(source_dir).resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Pasta não encontrada: {source_dir}")

    if recursive:
        files = list(source_path.rglob('*.xlsx'))
    else:
        files = list(source_path.glob('*.xlsx'))

    if not files:
        raise ValueError(f"Nenhum arquivo .xlsx encontrado em {source_dir}")

    # Validar campos
    for f in fields:
        if not f.get('name') or not f.get('source'):
            raise ValueError("Cada campo deve ter 'name' e 'source'")

    results = []
    errors = []

    for file_path in files:
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
            ws = wb.active
            row_data = {'_file': str(file_path), '_name': file_path.name}

            # Primeiro: extrair valores de células (para campos que são referências de célula)
            cell_values = {}
            for field in fields:
                source = field['source'].strip()
                # Verifica se é uma referência de célula (ex: A1, B2...)
                if re.match(r'^[A-Z]+[0-9]+$', source, re.IGNORECASE):
                    cell_value = ws[source].value
                    # Tenta converter para número se possível
                    try:
                        cell_value = float(cell_value) if isinstance(cell_value, (int, float)) else cell_value
                    except:
                        pass
                    cell_values[field['name']] = cell_value
                # else: é fórmula, será avaliada depois

            # Segundo: avaliar fórmulas (campos que não são células)
            for field in fields:
                source = field['source'].strip()
                if not re.match(r'^[A-Z]+[0-9]+$', source, re.IGNORECASE):
                    # É fórmula - substitui nomes pelos valores
                    # Pega todos os nomes de campos que podem ser referenciados
                    expr = source
                    # Substitui nomes pelos valores numéricos
                    for name, val in cell_values.items():
                        if isinstance(val, (int, float)):
                            expr = re.sub(rf'\b{re.escape(name)}\b', str(val), expr)
                    # Avalia a expressão
                    try:
                        # Avalia com segurança
                        result_val = eval(expr, {"__builtins__": None}, {})
                        # Se o resultado é numérico, formata como número
                        if isinstance(result_val, (int, float)):
                            cell_values[field['name']] = result_val
                        else:
                            cell_values[field['name']] = result_val
                    except Exception as e:
                        cell_values[field['name']] = None
                        errors.append(f"{file_path.name}: Erro na fórmula '{field['name']}': {str(e)}")

            # Monta linha de resultados
            result_row = {'Arquivo': file_path.name}
            for field in fields:
                result_row[field['name']] = cell_values.get(field['name'])
            results.append(result_row)

        except Exception as e:
            errors.append(f"{file_path.name}: {str(e)}")

    # Se output_file for fornecido, salva como CSV
    if output_file:
        if results:
            with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
                fieldnames = ['Arquivo'] + [f['name'] for f in fields]
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(results)
        else:
            # Nenhum resultado, criar arquivo vazio com cabeçalho
            with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
                fieldnames = ['Arquivo'] + [f['name'] for f in fields]
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()

    return {
        'results': results,
        'errors': errors,
        'total_files': len(files)
    }

# ========== DIVIDIR POR COLUNA ==========
def split_by_column(
    input_file: str,
    output_dir: str,
    column: str,                 # Nome da coluna ou índice (0-based)
    output_format: str = 'xlsx', # 'xlsx' ou 'csv'
    include_header: bool = True,
    recursive: bool = False      # não usado, mas mantido para consistência
) -> dict:
    """
    Divide um arquivo Excel em vários arquivos com base nos valores de uma coluna.

    Args:
        input_file: Caminho do arquivo de entrada (.xlsx)
        output_dir: Pasta de saída para os arquivos divididos
        column: Nome da coluna ou índice (0-based)
        output_format: 'xlsx' ou 'csv'
        include_header: Se True, inclui cabeçalho em cada arquivo

    Returns:
        dict com estatísticas: total_rows, total_groups, output_files, errors
    """
    input_path = Path(input_file).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_file}")

    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)

    # Carregar workbook
    wb = load_workbook(input_path, data_only=True)
    ws = wb.active
    if ws is None:
        raise ValueError("Planilha vazia")

    # Obter cabeçalhos e identificar coluna
    headers = [cell.value for cell in ws[1]] if include_header else None
    all_rows = list(ws.iter_rows(values_only=True))

    if not all_rows:
        raise ValueError("Arquivo sem dados")

    # Determinar o índice da coluna
    col_index = None
    if isinstance(column, str):
        if headers:
            try:
                col_index = headers.index(column)
            except ValueError:
                raise ValueError(f"Coluna '{column}' não encontrada nos cabeçalhos: {headers}")
        else:
            raise ValueError("Arquivo sem cabeçalhos; use índice numérico")
    else:
        col_index = int(column)
        if col_index < 0 or col_index >= len(all_rows[0]):
            raise ValueError(f"Índice {col_index} inválido (max: {len(all_rows[0])-1})")

    # Agrupar linhas por valor da coluna (ignorando cabeçalho)
    groups = {}
    start_row = 1 if include_header else 0
    header_row = all_rows[0] if include_header else None

    for row in all_rows[start_row:]:
        if len(row) <= col_index:
            continue  # linha com colunas insuficientes
        key = row[col_index]
        if key is None:
            key = 'NULL'
        else:
            key = str(key).strip()
            if not key:
                key = 'EMPTY'
        # Sanitizar para nome de arquivo
        safe_key = re.sub(r'[\\/*?:"<>|]', '_', key)
        if safe_key not in groups:
            groups[safe_key] = []
        groups[safe_key].append(row)

    if not groups:
        raise ValueError("Nenhuma linha encontrada para dividir")

    stats = {
        'total_rows': len(all_rows) - (1 if include_header else 0),
        'total_groups': len(groups),
        'output_files': [],
        'errors': []
    }

    # Para cada grupo, criar arquivo
    ext = '.xlsx' if output_format == 'xlsx' else '.csv'
    for group_key, rows in groups.items():
        out_file = output_path / f"{group_key}{ext}"

        if output_format == 'xlsx':
            wb_out = Workbook()
            ws_out = wb_out.active
            if include_header and header_row:
                ws_out.append(header_row)
            for row in rows:
                ws_out.append(row)
            wb_out.save(out_file)
        else:  # csv
            import csv
            with open(out_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                if include_header and header_row:
                    writer.writerow(header_row)
                writer.writerows(rows)

        stats['output_files'].append(str(out_file))

    return stats