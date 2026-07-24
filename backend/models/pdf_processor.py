import os
from pathlib import Path
import shutil
from PyPDF2 import PdfReader, PdfWriter

def merge(pdf_paths, output_path):
    """
    Mescla uma lista de PDFs em um único arquivo.
    Retorna o caminho do arquivo gerado.
    """
    if not pdf_paths:
        raise ValueError("Lista de PDFs vazia")
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    writer = PdfWriter()
    for path in pdf_paths:
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {path}")
        reader = PdfReader(str(path))
        for page in reader.pages:
            writer.add_page(page)
    
    with open(output_path, 'wb') as f:
        writer.write(f)
    return str(output_path)

def merge_by_size(
    source_dir: str,
    dest_dir: str,
    max_size_mb: float,
    recursive: bool = False,
    sort_by: str = 'name',  # 'name' ou 'date'
    prefix: str = ''
) -> dict:
    """
    Combina PDFs de uma pasta em lotes com tamanho máximo definido.
    
    Args:
        source_dir: Pasta de origem
        dest_dir: Pasta de destino
        max_size_mb: Tamanho máximo por lote em MB
        recursive: Se True, inclui subpastas
        sort_by: 'name' (alfabética) ou 'date' (data de modificação)
        prefix: Prefixo para os arquivos combinados (opcional)
    
    Returns:
        dict com estatísticas: processed, merged_groups, copied_files, errors
    """
    source_path = Path(source_dir).resolve()
    dest_path = Path(dest_dir).resolve()
    
    if not source_path.exists():
        raise FileNotFoundError(f"Pasta não encontrada: {source_dir}")
    
    dest_path.mkdir(parents=True, exist_ok=True)
    
    # Coletar arquivos PDF
    if recursive:
        pdf_files = list(source_path.rglob('*.pdf'))
    else:
        pdf_files = list(source_path.glob('*.pdf'))
    
    if not pdf_files:
        raise ValueError(f"Nenhum arquivo PDF encontrado em {source_dir}")
    
    # Ordenar
    if sort_by == 'date':
        pdf_files.sort(key=lambda p: p.stat().st_mtime)
    else:  # 'name'
        pdf_files.sort(key=lambda p: p.name)
    
    stats = {
        'processed': 0,
        'merged_groups': 0,
        'copied_files': 0,
        'errors': []
    }
    
    max_size_bytes = max_size_mb * 1024 * 1024
    
    current_group = []
    current_size = 0
    groups = []
    
    for pdf_path in pdf_files:
        file_size = pdf_path.stat().st_size
        
        # Se o arquivo individual já excede o limite, copiar separadamente
        if file_size > max_size_bytes:
            if current_group:
                groups.append(current_group)
                current_group = []
                current_size = 0
            groups.append(('copy', pdf_path))
            continue
        
        if current_size + file_size > max_size_bytes and current_group:
            groups.append(current_group)
            current_group = [pdf_path]
            current_size = file_size
        else:
            current_group.append(pdf_path)
            current_size += file_size
    
    if current_group:
        groups.append(current_group)
    
    # Processar cada grupo
    for group in groups:
        if isinstance(group, tuple) and group[0] == 'copy':
            _, pdf_path = group
            dest_file = dest_path / pdf_path.name
            if dest_file.exists():
                base = dest_file.stem
                ext = dest_file.suffix
                counter = 1
                while dest_file.exists():
                    dest_file = dest_path / f"{base}_{counter}{ext}"
                    counter += 1
            try:
                shutil.copy2(pdf_path, dest_file)
                stats['copied_files'] += 1
                stats['processed'] += 1
            except Exception as e:
                stats['errors'].append(f"Erro ao copiar {pdf_path.name}: {str(e)}")
        else:
            if len(group) == 1:
                pdf_path = group[0]
                dest_file = dest_path / pdf_path.name
                if dest_file.exists():
                    base = dest_file.stem
                    ext = dest_file.suffix
                    counter = 1
                    while dest_file.exists():
                        dest_file = dest_path / f"{base}_{counter}{ext}"
                        counter += 1
                try:
                    shutil.copy2(pdf_path, dest_file)
                    stats['copied_files'] += 1
                    stats['processed'] += 1
                except Exception as e:
                    stats['errors'].append(f"Erro ao copiar {pdf_path.name}: {str(e)}")
            else:
                try:
                    # Nome do arquivo mesclado com prefixo e contagem
                    if prefix:
                        output_name = f"{prefix}_{stats['merged_groups'] + 1:04d}.pdf"
                    else:
                        first_name = group[0].stem
                        last_name = group[-1].stem
                        if len(group) > 2:
                            output_name = f"{first_name}_ate_{last_name}.pdf"
                        else:
                            output_name = f"{first_name}_e_{last_name}.pdf"
                    
                    dest_file = dest_path / output_name
                    if dest_file.exists():
                        base = dest_file.stem
                        ext = dest_file.suffix
                        counter = 1
                        while dest_file.exists():
                            dest_file = dest_path / f"{base}_{counter}{ext}"
                            counter += 1
                    
                    writer = PdfWriter()
                    for pdf_path in group:
                        reader = PdfReader(pdf_path)
                        for page in reader.pages:
                            writer.add_page(page)
                    
                    with open(dest_file, 'wb') as f:
                        writer.write(f)
                    
                    stats['merged_groups'] += 1
                    stats['processed'] += len(group)
                except Exception as e:
                    stats['errors'].append(f"Erro ao mesclar grupo de {len(group)} arquivos: {str(e)}")
    
    return stats