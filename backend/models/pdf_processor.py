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

def _parse_custom_intervals(intervals_str: str, total_pages: int) -> list:
    """
    Converte uma string de intervalos como "1-10, 15-16, 17-17, 20-25" em uma lista de tuplas (start, end).
    Valida se os números estão dentro do total de páginas.
    """
    intervals = []
    parts = [p.strip() for p in intervals_str.split(',') if p.strip()]
    for part in parts:
        if '-' in part:
            start_str, end_str = part.split('-', 1)
            try:
                start = int(start_str.strip())
                end = int(end_str.strip())
            except ValueError:
                raise ValueError(f"Intervalo inválido: {part}")
            if start < 1 or end > total_pages or start > end:
                raise ValueError(f"Intervalo {start}-{end} inválido para documento com {total_pages} páginas")
            intervals.append((start, end))
        else:
            # Página única
            try:
                page = int(part.strip())
            except ValueError:
                raise ValueError(f"Página inválida: {part}")
            if page < 1 or page > total_pages:
                raise ValueError(f"Página {page} inválida para documento com {total_pages} páginas")
            intervals.append((page, page))
    return intervals

def split_custom(pdf_path: str, output_dir: str, intervals_str: str, 
                 combine: bool = False, part_prefix: str = "part", combine_name: str = "combined") -> dict:
    """
    Divide um PDF em partes com base em intervalos personalizados.
    
    Args:
        pdf_path: Caminho do PDF de entrada
        output_dir: Pasta de saída
        intervals_str: String com intervalos (ex: "1-10, 15-16, 20-25")
        combine: Se True, gera apenas o arquivo combinado (não gera partes individuais)
        part_prefix: Prefixo para os arquivos de parte (ex: "documento")
        combine_name: Nome do arquivo combinado (sem extensão)
    
    Returns:
        dict com estatísticas: total_pages, total_files, output_files, combined_file, errors
    """
    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")
    
    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)
    
    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)
    intervals = _parse_custom_intervals(intervals_str, total_pages)
    
    stats = {
        'total_pages': total_pages,
        'total_files': 0,
        'output_files': [],
        'combined_file': None,
        'errors': []
    }
    
    if combine:
        # Gerar apenas o arquivo combinado
        try:
            writer = PdfWriter()
            for start, end in intervals:
                for page_num in range(start - 1, end):
                    writer.add_page(reader.pages[page_num])
            
            # Garantir extensão .pdf
            combine_file = output_path / f"{combine_name}.pdf"
            if combine_file.exists():
                base = combine_file.stem
                ext = combine_file.suffix
                counter = 1
                while combine_file.exists():
                    combine_file = output_path / f"{base}_{counter}{ext}"
                    counter += 1
            
            with open(combine_file, 'wb') as f:
                writer.write(f)
            stats['combined_file'] = str(combine_file)
            stats['total_files'] = 1
        except Exception as e:
            stats['errors'].append(f"Erro ao gerar arquivo combinado: {str(e)}")
    else:
        # Gerar partes individuais
        for idx, (start, end) in enumerate(intervals, 1):
            try:
                part_writer = PdfWriter()
                for page_num in range(start - 1, end):
                    part_writer.add_page(reader.pages[page_num])
                
                output_file = output_path / f"{part_prefix}_{idx:04d}_{start}-{end}.pdf"
                with open(output_file, 'wb') as f:
                    part_writer.write(f)
                stats['output_files'].append(str(output_file))
                stats['total_files'] += 1
            except Exception as e:
                stats['errors'].append(f"Erro ao gerar parte {idx}: {str(e)}")
    
    return stats

def split_fixed(pdf_path: str, output_dir: str, pages_per_file: int, 
                combine: bool = False, part_prefix: str = "part", combine_name: str = "combined") -> dict:
    """
    Divide um PDF em partes de tamanho fixo (N páginas por arquivo).
    
    Args:
        pdf_path: Caminho do PDF de entrada
        output_dir: Pasta de saída
        pages_per_file: Número de páginas por arquivo
        combine: Se True, gera apenas o arquivo combinado (não gera partes individuais)
        part_prefix: Prefixo para os arquivos de parte
        combine_name: Nome do arquivo combinado (sem extensão)
    
    Returns:
        dict com estatísticas: total_pages, total_files, output_files, combined_file, errors
    """
    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")
    
    if pages_per_file < 1:
        raise ValueError("Número de páginas por arquivo deve ser >= 1")
    
    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)
    
    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)
    
    stats = {
        'total_pages': total_pages,
        'total_files': 0,
        'output_files': [],
        'combined_file': None,
        'errors': []
    }
    
    if combine:
        # Gerar apenas o arquivo combinado
        try:
            writer = PdfWriter()
            for page_num in range(total_pages):
                writer.add_page(reader.pages[page_num])
            
            combine_file = output_path / f"{combine_name}.pdf"
            if combine_file.exists():
                base = combine_file.stem
                ext = combine_file.suffix
                counter = 1
                while combine_file.exists():
                    combine_file = output_path / f"{base}_{counter}{ext}"
                    counter += 1
            
            with open(combine_file, 'wb') as f:
                writer.write(f)
            stats['combined_file'] = str(combine_file)
            stats['total_files'] = 1
        except Exception as e:
            stats['errors'].append(f"Erro ao gerar arquivo combinado: {str(e)}")
    else:
        # Gerar partes individuais
        for start in range(0, total_pages, pages_per_file):
            end = min(start + pages_per_file, total_pages)
            part_writer = PdfWriter()
            for page_num in range(start, end):
                part_writer.add_page(reader.pages[page_num])
            
            output_file = output_path / f"{part_prefix}_{start+1:04d}-{end:04d}.pdf"
            with open(output_file, 'wb') as f:
                part_writer.write(f)
            stats['output_files'].append(str(output_file))
            stats['total_files'] += 1
    
    return stats

def split_by_size(
    pdf_path: str,
    output_dir: str,
    max_size_mb: float,
    prefix: str = ''
) -> dict:
    """
    Divide um PDF em partes com tamanho máximo definido (em MB).

    Args:
        pdf_path: Caminho do PDF de entrada
        output_dir: Pasta de saída
        max_size_mb: Tamanho máximo por parte (MB)
        prefix: Prefixo para os nomes das partes (ex: 'relatorio_')

    Returns:
        dict com estatísticas: total_pages, total_files, output_files, errors
    """
    from io import BytesIO

    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")

    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)

    if total_pages == 0:
        raise ValueError("O PDF não contém páginas.")

    max_size_bytes = max_size_mb * 1024 * 1024

    stats = {
        'total_pages': total_pages,
        'total_files': 0,
        'output_files': [],
        'errors': []
    }

    current_pages = []
    part_number = 1
    prefix_str = f"{prefix}_" if prefix else ""

    for page_num in range(total_pages):
        current_pages.append(reader.pages[page_num])

        # Testar o tamanho da parte atual
        temp_writer = PdfWriter()
        for page in current_pages:
            temp_writer.add_page(page)

        buffer = BytesIO()
        temp_writer.write(buffer)
        size = buffer.tell()

        if size > max_size_bytes:
            if len(current_pages) == 1:
                # Uma única página já ultrapassou o limite - salvar mesmo assim
                part_writer = PdfWriter()
                part_writer.add_page(current_pages[0])
                part_name = f"{prefix_str}part_{part_number:04d}.pdf"
                part_file = output_path / part_name
                with open(part_file, 'wb') as f:
                    part_writer.write(f)
                stats['output_files'].append(str(part_file))
                stats['total_files'] += 1
                current_pages = []
                part_number += 1
            else:
                # Salvar parte sem a última página (que causou o estouro)
                part_writer = PdfWriter()
                for page in current_pages[:-1]:
                    part_writer.add_page(page)

                part_name = f"{prefix_str}part_{part_number:04d}.pdf"
                part_file = output_path / part_name
                with open(part_file, 'wb') as f:
                    part_writer.write(f)
                stats['output_files'].append(str(part_file))
                stats['total_files'] += 1

                # Nova parte começa com a página que estourou
                current_pages = [current_pages[-1]]
                part_number += 1

    # Salvar a última parte (se houver páginas restantes)
    if current_pages:
        part_writer = PdfWriter()
        for page in current_pages:
            part_writer.add_page(page)
        part_name = f"{prefix_str}part_{part_number:04d}.pdf"
        part_file = output_path / part_name
        with open(part_file, 'wb') as f:
            part_writer.write(f)
        stats['output_files'].append(str(part_file))
        stats['total_files'] += 1

    return stats

def _parse_extract_selection(page_str: str, total_pages: int) -> list:
    """
    Converte uma string de seleção de páginas como "1,3,5-7" em uma lista de números de página (1-based).
    """
    pages = []
    parts = [p.strip() for p in page_str.split(',') if p.strip()]
    for part in parts:
        if '-' in part:
            start_str, end_str = part.split('-', 1)
            try:
                start = int(start_str.strip())
                end = int(end_str.strip())
            except ValueError:
                raise ValueError(f"Intervalo inválido: {part}")
            if start < 1 or end > total_pages or start > end:
                raise ValueError(f"Intervalo {start}-{end} inválido para documento com {total_pages} páginas")
            pages.extend(range(start, end + 1))
        else:
            try:
                page = int(part.strip())
            except ValueError:
                raise ValueError(f"Página inválida: {part}")
            if page < 1 or page > total_pages:
                raise ValueError(f"Página {page} inválida para documento com {total_pages} páginas")
            pages.append(page)
    # Remove duplicatas mantendo a ordem
    seen = set()
    return [p for p in pages if not (p in seen or seen.add(p))]

def extract_all_pages(pdf_path: str, output_dir: str, prefix: str = '') -> dict:
    """
    Extrai todas as páginas de um PDF em arquivos individuais.
    
    Args:
        pdf_path: Caminho do PDF de entrada
        output_dir: Pasta de saída
        prefix: Prefixo para os nomes dos arquivos (ex: 'pagina_')
    
    Returns:
        dict com estatísticas: total_pages, total_files, output_files, errors
    """
    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")
    
    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)
    
    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)
    
    if total_pages == 0:
        raise ValueError("O PDF não contém páginas.")
    
    stats = {
        'total_pages': total_pages,
        'total_files': 0,
        'output_files': [],
        'errors': []
    }
    
    prefix_str = f"{prefix}_" if prefix else ""
    
    for page_num in range(1, total_pages + 1):
        try:
            writer = PdfWriter()
            writer.add_page(reader.pages[page_num - 1])
            
            output_file = output_path / f"{prefix_str}page_{page_num:04d}.pdf"
            with open(output_file, 'wb') as f:
                writer.write(f)
            stats['output_files'].append(str(output_file))
            stats['total_files'] += 1
        except Exception as e:
            stats['errors'].append(f"Erro ao extrair página {page_num}: {str(e)}")
    
    return stats

def extract_selected_pages(
    pdf_path: str,
    output_dir: str,
    pages_selection: str,
    prefix: str = '',
    combine: bool = False,
    combine_name: str = None
) -> dict:
    """
    Extrai páginas selecionadas de um PDF.
    
    Args:
        pdf_path: Caminho do PDF de entrada
        output_dir: Pasta de saída
        pages_selection: String com a seleção (ex: "1,3,5-7")
        prefix: Prefixo para os nomes dos arquivos (ex: 'pagina_')
        combine: Se True, mescla as páginas extraídas em um único PDF
        combine_name: Nome do arquivo combinado (sem extensão)
    
    Returns:
        dict com estatísticas: total_pages, total_files, output_files, combined_file, errors
    """
    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")
    
    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)
    
    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)
    
    if total_pages == 0:
        raise ValueError("O PDF não contém páginas.")
    
    # Parse da seleção
    page_numbers = _parse_extract_selection(pages_selection, total_pages)
    
    if not page_numbers:
        raise ValueError("Nenhuma página selecionada para extrair.")
    
    stats = {
        'total_pages': total_pages,
        'total_files': 0,
        'output_files': [],
        'combined_file': None,
        'errors': []
    }
    
    prefix_str = f"{prefix}_" if prefix else ""
    combined_writer = PdfWriter()
    files_generated = []
    
    for idx, page_num in enumerate(page_numbers, 1):
        try:
            writer = PdfWriter()
            writer.add_page(reader.pages[page_num - 1])
            
            output_file = output_path / f"{prefix_str}page_{page_num:04d}.pdf"
            with open(output_file, 'wb') as f:
                writer.write(f)
            stats['output_files'].append(str(output_file))
            stats['total_files'] += 1
            files_generated.append(output_file)
            
            # Se combine=True, adiciona ao writer combinado
            if combine:
                combined_writer.add_page(reader.pages[page_num - 1])
                
        except Exception as e:
            stats['errors'].append(f"Erro ao extrair página {page_num}: {str(e)}")
    
    # Se combine=True e há páginas extraídas, gerar o arquivo combinado
    if combine and stats['total_files'] > 0:
        combine_name = combine_name or "extracted_combined"
        if not combine_name.endswith('.pdf'):
            combine_name += '.pdf'
        combined_file = output_path / combine_name
        with open(combined_file, 'wb') as f:
            combined_writer.write(f)
        stats['combined_file'] = str(combined_file)
    
    return stats

def _parse_remove_selection(selection_str: str, total_pages: int) -> list:
    """
    Converte uma string de seleção de páginas em uma lista de números (1-based).
    Suporta: "1,3,5", "1-10", "1-5, 10-15", "1,3-5,10"
    """
    pages = set()
    parts = [p.strip() for p in selection_str.split(',') if p.strip()]
    for part in parts:
        if '-' in part:
            start_str, end_str = part.split('-', 1)
            try:
                start = int(start_str.strip())
                end = int(end_str.strip())
            except ValueError:
                raise ValueError(f"Intervalo inválido: {part}")
            if start < 1 or end > total_pages or start > end:
                raise ValueError(f"Intervalo {start}-{end} inválido (total: {total_pages} páginas)")
            for p in range(start, end + 1):
                pages.add(p)
        else:
            try:
                p = int(part.strip())
            except ValueError:
                raise ValueError(f"Página inválida: {part}")
            if p < 1 or p > total_pages:
                raise ValueError(f"Página {p} inválida (total: {total_pages} páginas)")
            pages.add(p)
    return sorted(pages)

def remove_pages(
    pdf_path: str,
    output_path: str,
    pages_to_remove_str: str,
    save_removed: bool = False,
    removed_output_path: str = None
) -> dict:
    """
    Remove páginas específicas de um PDF.

    Args:
        pdf_path: Caminho do PDF de entrada
        output_path: Caminho do PDF de saída (sem as páginas removidas)
        pages_to_remove_str: String com páginas a remover (ex: "1,3,5" ou "1-10" ou "1,3-5,10")
        save_removed: Se True, salva as páginas removidas em um arquivo separado
        removed_output_path: Caminho para salvar as páginas removidas (se None e save_removed=True, usa "removed_pages.pdf" no mesmo diretório)

    Returns:
        dict com estatísticas: total_pages, remaining_pages, removed_pages, output_file, removed_file, errors
    """
    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)

    if total_pages == 0:
        raise ValueError("O PDF não contém páginas.")

    try:
        pages_to_remove = _parse_remove_selection(pages_to_remove_str, total_pages)
    except ValueError as e:
        raise ValueError(f"Erro na seleção de páginas: {str(e)}")

    pages_to_remove_set = set(pages_to_remove)
    pages_to_keep = [i for i in range(1, total_pages + 1) if i not in pages_to_remove_set]

    if not pages_to_keep:
        raise ValueError("Nenhuma página restante após a remoção.")

    stats = {
        'total_pages': total_pages,
        'remaining_pages': len(pages_to_keep),
        'removed_pages': len(pages_to_remove),
        'output_file': None,
        'removed_file': None,
        'errors': []
    }

    # Gerar arquivo sem as páginas removidas
    try:
        writer = PdfWriter()
        for page_num in pages_to_keep:
            writer.add_page(reader.pages[page_num - 1])
        with open(output_path, 'wb') as f:
            writer.write(f)
        stats['output_file'] = str(output_path)
    except Exception as e:
        stats['errors'].append(f"Erro ao salvar arquivo final: {str(e)}")

    # Salvar páginas removidas separadamente, se solicitado
    if save_removed and pages_to_remove:
        try:
            if removed_output_path is None:
                removed_output_path = output_path.parent / "removed_pages.pdf"
            else:
                removed_output_path = Path(removed_output_path).resolve()
                removed_output_path.parent.mkdir(parents=True, exist_ok=True)

            writer_removed = PdfWriter()
            for page_num in pages_to_remove:
                writer_removed.add_page(reader.pages[page_num - 1])
            with open(removed_output_path, 'wb') as f:
                writer_removed.write(f)
            stats['removed_file'] = str(removed_output_path)
        except Exception as e:
            stats['errors'].append(f"Erro ao salvar páginas removidas: {str(e)}")

    return stats

def _parse_page_order(order_str: str, total_pages: int) -> list:
    """
    Converte uma string de ordem em uma lista de números (1-based) PRESERVANDO A ORDEM.
    Suporta: "5,1,3,2,4" ou "1-3,5,4"
    """
    pages = []
    parts = [p.strip() for p in order_str.split(',') if p.strip()]
    for part in parts:
        if '-' in part:
            start_str, end_str = part.split('-', 1)
            try:
                start = int(start_str.strip())
                end = int(end_str.strip())
            except ValueError:
                raise ValueError(f"Intervalo inválido: {part}")
            if start < 1 or end > total_pages or start > end:
                raise ValueError(f"Intervalo {start}-{end} inválido (total: {total_pages} páginas)")
            for p in range(start, end + 1):
                pages.append(p)
        else:
            try:
                p = int(part.strip())
            except ValueError:
                raise ValueError(f"Página inválida: {part}")
            if p < 1 or p > total_pages:
                raise ValueError(f"Página {p} inválida (total: {total_pages} páginas)")
            pages.append(p)
    return pages

def reorder_pages(
    pdf_path: str,
    output_path: str,
    new_order_str: str
) -> dict:
    """
    Reordena as páginas de um PDF de acordo com a ordem especificada.

    Args:
        pdf_path: Caminho do PDF de entrada
        output_path: Caminho do PDF de saída com a nova ordem
        new_order_str: String com a nova ordem (ex: "5,1,3,2,4" ou "1-3,5,4")

    Returns:
        dict com estatísticas: total_pages, output_file, errors
    """
    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)

    if total_pages == 0:
        raise ValueError("O PDF não contém páginas.")

    try:
        new_order = _parse_page_order(new_order_str, total_pages)
    except ValueError as e:
        raise ValueError(f"Erro na ordem especificada: {str(e)}")

    # Verificar se todas as páginas foram incluídas
    if len(new_order) != total_pages:
        raise ValueError(
            f"Número de páginas na ordem ({len(new_order)}) não corresponde ao total de páginas ({total_pages}). "
            "Para reordenar, todas as páginas devem ser incluídas exatamente uma vez."
        )

    # Verificar duplicatas
    if len(set(new_order)) != total_pages:
        raise ValueError("A ordem contém páginas duplicadas. Cada página deve aparecer exatamente uma vez.")

    stats = {
        'total_pages': total_pages,
        'output_file': None,
        'errors': []
    }

    try:
        writer = PdfWriter()
        for page_num in new_order:
            writer.add_page(reader.pages[page_num - 1])
        with open(output_path, 'wb') as f:
            writer.write(f)
        stats['output_file'] = str(output_path)
    except Exception as e:
        stats['errors'].append(f"Erro ao salvar arquivo reordenado: {str(e)}")

    return stats