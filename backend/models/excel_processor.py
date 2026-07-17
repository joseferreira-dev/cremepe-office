import os
from pathlib import Path
from openpyxl import load_workbook, Workbook
from openpyxl.utils import get_column_letter

def merge_excel_files(file_paths, output_path):
    """
    Mescla vários arquivos Excel em uma única planilha, copiando todas as linhas de cada arquivo.
    Assume que todos têm a mesma estrutura (cabeçalho na primeira linha).
    """
    if not file_paths:
        raise ValueError("Lista de arquivos vazia")
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Cria um novo workbook
    wb_out = Workbook()
    ws_out = wb_out.active
    ws_out.title = "Merged"

    first_file = True
    for file_path in file_paths:
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")
        wb = load_workbook(file_path, data_only=True)
        # Assume que queremos a primeira planilha
        ws = wb.worksheets[0]
        # Copia linhas
        for row in ws.iter_rows(values_only=True):
            # Se for o primeiro arquivo, copia cabeçalho também
            # Senão, pula cabeçalho (assumindo que é a primeira linha)
            if not first_file and row == ws[1]:  # simplificação: verifica se é igual ao cabeçalho
                continue
            ws_out.append(row)
        first_file = False

    wb_out.save(str(output_path))
    return str(output_path)

def read_excel_sheet(file_path, sheet_name=0):
    """
    Lê uma planilha Excel e retorna os dados como lista de dicionários.
    """
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")
    wb = load_workbook(file_path, data_only=True)
    if isinstance(sheet_name, int):
        ws = wb.worksheets[sheet_name]
    else:
        ws = wb[sheet_name]
    # Obtém cabeçalhos da primeira linha
    headers = [cell.value for cell in ws[1]]
    data = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not any(row):  # linha vazia
            continue
        data.append(dict(zip(headers, row)))
    return data

def write_excel_file(file_path, data, sheet_name='Sheet1'):
    """
    Escreve uma lista de dicionários em um arquivo Excel.
    """
    file_path = Path(file_path)
    file_path.parent.mkdir(parents=True, exist_ok=True)

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name

    if not data:
        # Se não houver dados, cria arquivo vazio
        wb.save(str(file_path))
        return str(file_path)

    headers = list(data[0].keys())
    ws.append(headers)
    for row in data:
        ws.append([row.get(h, '') for h in headers])

    wb.save(str(file_path))
    return str(file_path)