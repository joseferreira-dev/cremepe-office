import os
import csv
from pathlib import Path
from datetime import datetime
import json

def generate_folder_report(directory, recursive=True, include_files=True, output_format='txt', output_path=None):
    """
    Gera um relatório da estrutura de pastas.
    directory: caminho da pasta raiz
    recursive: incluir subpastas
    include_files: listar arquivos (se False, apenas pastas)
    output_format: 'txt' (indentado) ou 'csv'
    output_path: caminho para salvar (se None, retorna string)
    Retorna o conteúdo do relatório (string) ou salva no arquivo.
    """
    src_path = Path(directory)
    if not src_path.exists():
        raise FileNotFoundError(f"Diretório não encontrado: {directory}")

    if output_format == 'txt':
        content = generate_txt_report(src_path, recursive, include_files)
    elif output_format == 'csv':
        content = generate_csv_report(src_path, recursive, include_files)
    else:
        raise ValueError("Formato inválido. Use 'txt' ou 'csv'.")

    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return output_path
    else:
        return content

def generate_txt_report(src_path, recursive, include_files):
    """Gera relatório em formato texto indentado."""
    lines = []
    lines.append(f"Relatório de estrutura: {src_path}")
    lines.append(f"Gerado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("=" * 60)
    
    # Função recursiva para percorrer
    def walk(path, indent=0):
        prefix = "  " * indent
        # Exibe a pasta atual
        try:
            stats = os.stat(path)
            mtime = datetime.fromtimestamp(stats.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
            # Conta arquivos dentro da pasta (apenas direto, não recursivo)
            try:
                items = list(path.iterdir())
                file_count = sum(1 for p in items if p.is_file())
                dir_count = sum(1 for p in items if p.is_dir())
                total_items = len(items)
            except PermissionError:
                file_count = dir_count = total_items = 0
            size = stats.st_size if path.is_file() else 0
            # Para pastas, tamanho total (recursivo) seria pesado; usamos 0 ou calculamos sob demanda
            # Exibe linha da pasta
            lines.append(f"{prefix}📁 {path.name}/ (arquivos: {file_count}, subpastas: {dir_count}, modificado: {mtime})")
            
            # Se include_files for True, lista os arquivos na pasta atual
            if include_files:
                for item in path.iterdir():
                    if item.is_file():
                        try:
                            fstats = os.stat(item)
                            fmtime = datetime.fromtimestamp(fstats.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                            fsize = fstats.st_size
                            lines.append(f"{prefix}  📄 {item.name} ({fsize} bytes, {fmtime})")
                        except PermissionError:
                            lines.append(f"{prefix}  📄 {item.name} (sem permissão)")
            
            # Se recursivo, desce nas subpastas
            if recursive:
                for item in path.iterdir():
                    if item.is_dir() and not item.name.startswith('.'):
                        walk(item, indent + 1)
        except PermissionError:
            lines.append(f"{prefix}⛔ Sem permissão para acessar {path.name}")

    walk(src_path)
    return "\n".join(lines)

def generate_csv_report(src_path, recursive, include_files):
    """Gera relatório em formato CSV."""
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    # Cabeçalho
    if include_files:
        writer.writerow(['Tipo', 'Nome', 'Caminho', 'Tamanho (bytes)', 'Data Modificação', 'Arquivos na Pasta'])
    else:
        writer.writerow(['Tipo', 'Nome', 'Caminho', 'Data Modificação', 'Arquivos na Pasta'])

    def walk(path, parent_path=''):
        try:
            # Primeiro a pasta atual
            stats = os.stat(path)
            mtime = datetime.fromtimestamp(stats.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
            # Conta arquivos na pasta (direto)
            try:
                items = list(path.iterdir())
                file_count = sum(1 for p in items if p.is_file())
            except PermissionError:
                file_count = 0
            if include_files:
                writer.writerow(['PASTA', path.name, str(path), 0, mtime, file_count])
                # Lista arquivos
                for item in path.iterdir():
                    if item.is_file():
                        try:
                            fstats = os.stat(item)
                            fmtime = datetime.fromtimestamp(fstats.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                            writer.writerow(['ARQUIVO', item.name, str(item), fstats.st_size, fmtime, ''])
                        except PermissionError:
                            writer.writerow(['ARQUIVO', item.name, str(item), 'SEM PERMISSÃO', '', ''])
            else:
                writer.writerow(['PASTA', path.name, str(path), mtime, file_count])
            
            # Subpastas (se recursivo)
            if recursive:
                for item in path.iterdir():
                    if item.is_dir() and not item.name.startswith('.'):
                        walk(item)
        except PermissionError:
            pass

    walk(src_path)
    return output.getvalue()