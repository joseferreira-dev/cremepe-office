from pathlib import Path
import logging
import re
import shutil
from typing import List, Optional
from PyPDF2 import PdfReader, PdfWriter
from pdf2docx import Converter
import io
from io import BytesIO
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import tempfile
import fitz
import pikepdf
import secrets
from utils.jobs import report_progress

logger = logging.getLogger(__name__)

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
    for i_grp, group in enumerate(groups, 1):
        report_progress(i_grp, len(groups))
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
            for i_page, page_num in enumerate(range(total_pages), 1):
                report_progress(i_page, total_pages)
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
        pages_done = 0
        for start in range(0, total_pages, pages_per_file):
            end = min(start + pages_per_file, total_pages)
            part_writer = PdfWriter()
            for page_num in range(start, end):
                pages_done += 1
                report_progress(pages_done, total_pages)
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

def add_page_numbers(
    input_path: str,
    output_path: str,
    start_page: int = 1,
    end_page: int = None,
    start_number: int = 1,
    color: str = '#000000',
    background_color: str = None,
    position: str = 'bottom-center',
    font_size: int = 12,
    show_background: bool = False,
    margin_cm: float = 1.0
) -> dict:
    import fitz
    from pathlib import Path

    input_path = Path(input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(input_path)
    total_pages = len(doc)

    if end_page is None:
        end_page = total_pages

    if start_page < 1 or start_page > total_pages:
        raise ValueError(f"Página inicial inválida: {start_page}")
    if end_page < start_page or end_page > total_pages:
        raise ValueError(f"Página final inválida: {end_page}")

    def hex_to_rgb(hex_color):
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 6:
            r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
            return (r/255, g/255, b/255)
        return (0, 0, 0)

    text_color = hex_to_rgb(color)
    bg_color = None
    if background_color:
        bg_color = hex_to_rgb(background_color)

    margin_pt = margin_cm * 28.3464567

    position_map = {
        'top-left': (margin_pt, margin_pt, 0, 0),
        'top-center': (0, margin_pt, 0.5, 0),
        'top-right': (margin_pt, margin_pt, 1, 0),
        'bottom-left': (margin_pt, 0, 0, 1),
        'bottom-center': (0, 0, 0.5, 1),
        'bottom-right': (margin_pt, 0, 1, 1),
        'center': (0, 0, 0.5, 0.5),
    }
    if position not in position_map:
        position = 'bottom-center'
    _, _, h_ref, v_ref = position_map[position]

    page_counter = start_number
    pages_total = end_page - (start_page - 1)

    for page_num in range(start_page - 1, end_page):
        report_progress(page_num - (start_page - 1) + 1, pages_total)
        page = doc[page_num]
        rect = page.rect

        text = str(page_counter)

        # Largura exata do texto com a fonte escolhida
        text_width = fitz.get_text_length(text, fontname="helv", fontsize=font_size)
        # Altura do texto é aproximadamente o próprio font_size (em pontos)
        text_height = font_size
        pad = 8
        box_width = text_width + 2 * pad
        box_height = text_height + 2 * pad

        # Posicionamento baseado no centro (cx, cy)
        if h_ref == 0:
            cx = margin_pt + box_width / 2
        elif h_ref == 0.5:
            cx = rect.width / 2
        else:
            cx = rect.width - margin_pt - box_width / 2

        if v_ref == 0:
            cy = margin_pt + box_height / 2
        elif v_ref == 0.5:
            cy = rect.height / 2
        else:
            cy = rect.height - margin_pt - box_height / 2

        # Evitar que o retângulo ultrapasse as bordas
        if cx - box_width/2 < 0:
            cx = box_width/2
        if cx + box_width/2 > rect.width:
            cx = rect.width - box_width/2
        if cy - box_height/2 < 0:
            cy = box_height/2
        if cy + box_height/2 > rect.height:
            cy = rect.height - box_height/2

        text_rect = fitz.Rect(cx - box_width/2, cy - box_height/4, cx + box_width/2, cy + box_height/2)

        # Desenhar fundo (retângulo) se solicitado
        if show_background and bg_color:
            page.draw_rect(text_rect, color=bg_color, fill=bg_color, width=0)

        # Inserir texto centralizado horizontal e verticalmente no retângulo
        page.insert_textbox(
            text_rect,
            text,
            fontsize=font_size,
            fontname="helv",
            color=text_color,
            align=fitz.TEXT_ALIGN_CENTER
        )

        page_counter += 1

    doc.save(output_path)
    doc.close()

    return {
        'total_pages': total_pages,
        'processed_pages': end_page - start_page + 1,
        'output_path': str(output_path)
    }

def _scanned_pdf_warning(pdf_path: Path) -> Optional[str]:
    """Avisa quando o PDF nao tem texto (provavel escaneado/imagenico).

    O pdf2docx gera um docx vazio em PDFs sem texto, mas so avisa no
    log interno — aqui o aviso chega ao cliente na resposta.
    """
    try:
        with fitz.open(str(pdf_path)) as doc:
            total_words = sum(len(page.get_text().split()) for page in doc)
    except Exception:
        return None  # nao conseguiu analisar: nao bloqueia nem avisa
    if total_words == 0:
        return ("PDF sem texto extraído (provável PDF escaneado): o Word pode "
                "gerar um documento vazio. Execute OCR no PDF antes de converter.")
    return None


def convert_pdf_to_word(pdf_path: str, output_path: str) -> dict:
    """
    Converte um arquivo PDF para Word (.docx) usando pdf2docx.

    Retorna {"output_path": ...} e, quando apropriado,
    {"warning": ...} (PDF sem texto — ver _scanned_pdf_warning).
    """
    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        cv = Converter(str(pdf_path))
        cv.convert(str(output_path), start=0, end=None)
        cv.close()
    except Exception as e:
        raise RuntimeError(f"Erro ao converter PDF para Word: {str(e)}")

    result = {"output_path": str(output_path)}
    warning = _scanned_pdf_warning(pdf_path)
    if warning:
        result["warning"] = warning
    return result

def convert_images_to_pdf(
    image_paths: List[str],
    output_path: str,
    combine: bool = True,
    margin_cm: float = 0.5,
    orientation: str = 'portrait',
    resize_mode: str = 'cover',      # 'fit' ou 'cover'
    naming: str = 'prefix',          # 'original' ou 'prefix'
    prefix: str = 'image'
) -> dict:
    """
    Converte uma ou mais imagens para PDF.
    - combine=True : gera um único PDF (output_path é o arquivo final)
    - combine=False: gera múltiplos PDFs (output_path é a pasta de destino)
    - resize_mode: 'fit' (mantém proporção, centraliza) ou 'cover' (preenche toda a área, corta excesso)
    - naming: 'original' (usa o nome da imagem) ou 'prefix' (usa o prefixo + contagem)
    """
    if not image_paths:
        raise ValueError("Nenhuma imagem fornecida.")

    output_path = Path(output_path).resolve()
    if combine:
        output_path.parent.mkdir(parents=True, exist_ok=True)
    else:
        output_path.mkdir(parents=True, exist_ok=True)

    margin_pt = margin_cm * 28.3464567
    base_size = A4
    if orientation == 'landscape':
        base_size = (base_size[1], base_size[0])

    stats = {
        'total_images': len(image_paths),
        'output_files': [],
        'combined_file': None,
        'errors': []
    }

    temp_files = []

    try:
        if combine:
            c = canvas.Canvas(str(output_path), pagesize=base_size)
            page_width, page_height = base_size

            for idx, img_path in enumerate(image_paths):
                img_path = Path(img_path)
                if not img_path.exists():
                    stats['errors'].append(f"Imagem não encontrada: {img_path}")
                    continue

                try:
                    img = Image.open(img_path)
                    # Mantém o modo original (incluindo transparência)
                    # Não converte para RGB
                    img_width, img_height = img.size

                    # Área útil (com margem)
                    max_width = page_width - 2 * margin_pt
                    max_height = page_height - 2 * margin_pt

                    if resize_mode == 'cover':
                        # Razão para preencher toda a área (cortando excesso)
                        ratio = max(max_width / img_width, max_height / img_height)
                    else:  # 'fit'
                        ratio = min(max_width / img_width, max_height / img_height)

                    draw_width = img_width * ratio
                    draw_height = img_height * ratio

                    # Centraliza
                    x = (page_width - draw_width) / 2
                    y = (page_height - draw_height) / 2

                    # Salva imagem temporária em PNG (preserva transparência)
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                        img.save(tmp.name, 'PNG')
                        temp_files.append(tmp.name)

                    c.drawImage(tmp.name, x, y, width=draw_width, height=draw_height,
                                preserveAspectRatio=True, mask=None)  # mask=None permite transparência

                    if idx < len(image_paths) - 1:
                        c.showPage()
                except Exception as e:
                    stats['errors'].append(f"Erro ao processar {img_path.name}: {str(e)}")

            c.save()
            stats['combined_file'] = str(output_path)
            stats['output_files'] = [str(output_path)]

        else:
            # Múltiplos PDFs – output_path é a pasta
            for idx, img_path in enumerate(image_paths):
                img_path = Path(img_path)
                if not img_path.exists():
                    stats['errors'].append(f"Imagem não encontrada: {img_path}")
                    continue

                try:
                    img = Image.open(img_path)
                    img_width, img_height = img.size

                    # Nome do arquivo de saída
                    if naming == 'original':
                        # Usa o nome original da imagem, trocando extensão para .pdf
                        base_name = img_path.stem
                    else:
                        # Usa prefixo + contagem
                        base_name = f"{prefix}_{idx+1:04d}"

                    pdf_out = output_path / f"{base_name}.pdf"

                    page_width, page_height = base_size
                    max_width = page_width - 2 * margin_pt
                    max_height = page_height - 2 * margin_pt

                    if resize_mode == 'cover':
                        ratio = max(max_width / img_width, max_height / img_height)
                    else:
                        ratio = min(max_width / img_width, max_height / img_height)

                    draw_width = img_width * ratio
                    draw_height = img_height * ratio

                    x = (page_width - draw_width) / 2
                    y = (page_height - draw_height) / 2

                    c = canvas.Canvas(str(pdf_out), pagesize=base_size)
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                        img.save(tmp.name, 'PNG')
                        temp_files.append(tmp.name)
                    c.drawImage(tmp.name, x, y, width=draw_width, height=draw_height,
                                preserveAspectRatio=True, mask=None)
                    c.save()

                    stats['output_files'].append(str(pdf_out))
                except Exception as e:
                    stats['errors'].append(f"Erro ao processar {img_path.name}: {str(e)}")

    finally:
        for f in temp_files:
            try:
                Path(f).unlink()
            except:
                pass

    return stats

def convert_pdf_to_images(
    pdf_paths: List[str],
    output_dir: str,
    pages_selection: str = 'all',  # 'all' ou '1,3-5,10'
    image_format: str = 'png',     # 'png' ou 'jpg'
    prefix: str = ''
) -> dict:
    """
    Converte páginas de PDF(s) para imagens.

    Args:
        pdf_paths: Lista de caminhos dos PDFs
        output_dir: Pasta de saída para as imagens
        pages_selection: 'all' ou seleção como '1,3-5,10'
        image_format: 'png' ou 'jpg'
        prefix: Prefixo para os nomes das imagens

    Returns:
        dict com estatísticas: total_pdfs, total_images, output_files, errors
    """
    if not pdf_paths:
        raise ValueError("Nenhum PDF fornecido.")

    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)

    stats = {
        'total_pdfs': len(pdf_paths),
        'total_images': 0,
        'output_files': [],
        'errors': []
    }

    def parse_pages(selection: str, total: int) -> list:
        """Converte seleção em lista de números de página (0-based)."""
        if not selection or selection.strip().lower() == 'all':
            return list(range(total))
        pages = []
        parts = [p.strip() for p in selection.split(',') if p.strip()]
        for part in parts:
            if '-' in part:
                start_str, end_str = part.split('-', 1)
                try:
                    start = int(start_str.strip())
                    end = int(end_str.strip())
                except ValueError:
                    raise ValueError(f"Intervalo inválido: {part}")
                if start < 1 or end > total or start > end:
                    raise ValueError(f"Intervalo {start}-{end} inválido (total: {total} páginas)")
                pages.extend(range(start - 1, end))
            else:
                try:
                    p = int(part.strip())
                except ValueError:
                    raise ValueError(f"Página inválida: {part}")
                if p < 1 or p > total:
                    raise ValueError(f"Página {p} inválida (total: {total} páginas)")
                pages.append(p - 1)
        return pages

    # Se 'all', usamos a seleção all para cada PDF
    for pdf_idx, pdf_path in enumerate(pdf_paths):
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            stats['errors'].append(f"Arquivo não encontrado: {pdf_path}")
            continue

        try:
            doc = fitz.open(pdf_path)
            total_pages = doc.page_count

            if pages_selection.strip().lower() == 'all':
                page_indices = list(range(total_pages))
            else:
                page_indices = parse_pages(pages_selection, total_pages)

            prefix_str = f"{prefix}_" if prefix else "page"
            ext = '.png' if image_format == 'png' else '.jpg'

            for idx, page_num in enumerate(page_indices, 1):
                try:
                    page = doc.load_page(page_num)
                    # Aumentar resolução para 150 DPI para boa qualidade
                    matrix = fitz.Matrix(150/72, 150/72)
                    pix = page.get_pixmap(matrix=matrix)
                    # Se jpg, converter para RGB
                    if image_format == 'jpg':
                        img = pix.tobytes('jpeg')
                    else:
                        img = pix.tobytes('png')

                    base_name = f"{prefix_str}_{pdf_path.stem}_{idx:04d}{ext}"
                    output_file = output_path / base_name
                    with open(output_file, 'wb') as f:
                        f.write(img)
                    stats['output_files'].append(str(output_file))
                    stats['total_images'] += 1
                except Exception as e:
                    stats['errors'].append(f"Erro na página {page_num+1} de {pdf_path.name}: {str(e)}")

            doc.close()
        except Exception as e:
            stats['errors'].append(f"Erro ao abrir {pdf_path.name}: {str(e)}")

    return stats

def _display_size_inches(input_path: Path) -> dict:
    """{xref: (largura_in, altura_in)} do tamanho exibido de cada imagem.

    Usa PyMuPDF para ler o retângulo de exibição de cada imagem na página
    (já resolve Form XObjects). Quando o mesmo objeto aparece em vários
    lugares, vale o maior exibidor (não se degrada a maior apresentação).
    Sem informação (imagens inline, anotações etc.) o chamador cai na
    estimativa legada de 300 DPI.
    """
    sizes = {}
    try:
        with fitz.open(str(input_path)) as doc:
            for page in doc:
                for info in page.get_image_info(xrefs=True):
                    xref = info.get('xref') or 0
                    bbox = info.get('bbox') or (0, 0, 0, 0)
                    w_pt = bbox[2] - bbox[0]
                    h_pt = bbox[3] - bbox[1]
                    if xref <= 0 or w_pt <= 0 or h_pt <= 0:
                        continue
                    w_in, h_in = w_pt / 72.0, h_pt / 72.0
                    prev = sizes.get(xref)
                    if prev is None:
                        sizes[xref] = (w_in, h_in)
                    else:
                        sizes[xref] = (max(prev[0], w_in), max(prev[1], h_in))
    except Exception as exc:
        logger.debug('compress: sem mapa de exibicao (%s); usando 300dpi', exc)
    return sizes


def compress(
    input_path: str,
    output_path: str,
    compression_level: str = 'medium',
    jpeg_quality: int = 85,
    remove_metadata: bool = False,
    downscale_images: bool = True
) -> dict:
    input_path = Path(input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Mesmo caminho de entrada e saida: usa sufixo para nao sobrescrever
    if input_path == output_path:
        output_path = input_path.parent / f"{input_path.stem}_compressed{input_path.suffix}"

    level_config = {
        'low': {
            'dpi_target': 150,
            'compress_streams': True,
            'object_stream_mode': pikepdf.ObjectStreamMode.disable,
        },
        'medium': {
            'dpi_target': 100,
            'compress_streams': True,
            'object_stream_mode': pikepdf.ObjectStreamMode.preserve,
        },
        'high': {
            'dpi_target': 72,
            'compress_streams': True,
            'object_stream_mode': pikepdf.ObjectStreamMode.generate,
        }
    }

    config = level_config.get(compression_level, level_config['medium'])
    dpi_target = config['dpi_target'] if downscale_images else None

    original_size = input_path.stat().st_size

    try:
        pdf = pikepdf.Pdf.open(input_path, allow_overwriting_input=True)

        if remove_metadata:
            pdf.docinfo = pdf.make_indirect(pikepdf.Dictionary())
            if '/Metadata' in pdf.Root:
                del pdf.Root.Metadata

        if downscale_images and dpi_target:
            # mapa xref -> tamanho exibido (DPI efetivo por imagem)
            display_inches = _display_size_inches(input_path)
            # Lista primeiro: as trocas de imagem nao podem acontecer
            # durante a iteracao das paginas/imagens.
            targets = []
            for page in pdf.pages:
                for name in page.get_images().keys():
                    targets.append((page, name))
            for i, (page, name) in enumerate(targets, 1):
                report_progress(i, len(targets), 'Reamostrando imagens')
                try:
                    img_obj = page.get_images()[name]
                    pil_image = pikepdf.PdfImage(img_obj).as_pil_image()

                    # DPI efetivo = pixels reais vs polegadas exibidas na
                    # pagina; a escala satisfaz AMBOS os eixos (min) e nunca
                    # amplia. Sem mapa de exibicao: estimativa de 300 DPI.
                    display = display_inches.get(img_obj.objgen[0])
                    if display is not None:
                        w_in, h_in = display
                        scale_factor = min(
                            1.0,
                            w_in * dpi_target / max(1, pil_image.width),
                            h_in * dpi_target / max(1, pil_image.height),
                        )
                    else:
                        scale_factor = min(1.0, dpi_target / 300.0)

                    if scale_factor >= 1.0:
                        # imagem ja esta em resolucao igual/menor que o alvo:
                        # reencodar so perderia qualidade sem ganho de tamanho
                        logger.debug(
                            'compress: %s ja esta em <= %s DPI; mantida',
                            name, dpi_target)
                        continue

                    new_width = max(1, int(pil_image.width * scale_factor))
                    new_height = max(1, int(pil_image.height * scale_factor))
                    pil_image = pil_image.resize((new_width, new_height), Image.LANCZOS)

                    if pil_image.mode != 'RGB' or '/SMask' in img_obj:
                        smask_pil = None
                        if '/SMask' in img_obj:
                            try:
                                smask_pil = pikepdf.PdfImage(
                                    img_obj['/SMask']).as_pil_image()
                            except Exception:
                                smask_pil = None
                        if smask_pil is not None:
                            # mascara de alpha (SMask): compoe sobre branco
                            # para preservar a aparencia antes de virar JPEG
                            if smask_pil.size != pil_image.size:
                                smask_pil = smask_pil.resize(pil_image.size, Image.LANCZOS)
                            rgb = pil_image.convert('RGB')
                            base = Image.new('RGB', rgb.size, (255, 255, 255))
                            base.paste(rgb, mask=smask_pil.convert('L'))
                            pil_image = base
                        elif pil_image.mode in ('RGBA', 'LA') or (
                            pil_image.mode == 'P' and 'transparency' in pil_image.info
                        ):
                            # alpha proprio da imagem: JPEG nao tem alpha e a
                            # conversao direta deixaria as areas transparentes pretas
                            rgba = pil_image.convert('RGBA')
                            base = Image.new('RGB', rgba.size, (255, 255, 255))
                            base.paste(rgba, mask=rgba.getchannel('A'))
                            pil_image = base
                        else:
                            pil_image = pil_image.convert('RGB')

                    img_buffer = io.BytesIO()
                    pil_image.save(img_buffer, format='JPEG', quality=jpeg_quality, optimize=True)

                    # Mutacao IN-PLACE no proprio objeto: a imagem pode viver
                    # dentro de um Form XObject — trocar a entrada nos
                    # resources da pagina nao afetaria as referencias.
                    # write() grava bytes + Filter de forma coerente; as
                    # chaves sao atualizadas para casar com o JPEG novo
                    # (Width/Height) e o SMask antigo (alpha) e descartado.
                    img_obj.write(img_buffer.getvalue(), filter=pikepdf.Name('/DCTDecode'))
                    img_obj[pikepdf.Name('/Width')] = new_width
                    img_obj[pikepdf.Name('/Height')] = new_height
                    img_obj[pikepdf.Name('/ColorSpace')] = pikepdf.Name('/DeviceRGB')
                    img_obj[pikepdf.Name('/BitsPerComponent')] = 8
                    if pikepdf.Name('/SMask') in img_obj:
                        del img_obj[pikepdf.Name('/SMask')]
                except Exception as exc:
                    # nao engole o erro (foi assim que uma falha de API viveu
                    # anos mascarando compressao nula): registra e segue
                    logger.warning('compress: falha ao reamostrar imagem %s: %s', name, exc)

        pdf.save(
            output_path,
            compress_streams=config['compress_streams'],
            stream_decode_level=pikepdf.StreamDecodeLevel.specialized,
            object_stream_mode=config['object_stream_mode'],
        )
        pdf.close()

        final_size = output_path.stat().st_size
        ratio = (final_size / original_size) if original_size > 0 else 1.0

        return {
            'original_size': original_size,
            'compressed_size': final_size,
            'ratio': ratio,
            'output_path': str(output_path)
        }

    except Exception as e:
        raise RuntimeError(f"Erro ao comprimir PDF: {str(e)}")

def validate_pdf(pdf_path: str) -> dict:
    """Analisa a integridade de um PDF (corrupção, truncamento, refs).

    Devolve uma lista de checks com status ok/warn/error e estatísticas.
    `valid` é False quando existe ao menos um check em error — avisos
    (warn) não invalidam o documento.
    """
    path = Path(pdf_path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    checks = []

    def add(check_id, label, status, detail=''):
        checks.append({
            'id': check_id,
            'label': label,
            'status': status,
            'detail': detail,
        })

    def finish(stats):
        return {
            'pdf_path': str(path),
            'valid': not any(c['status'] == 'error' for c in checks),
            'checks': checks,
            'stats': stats,
        }

    size = path.stat().st_size
    stats = {
        'file_size': size,
        'pages': None,
        'pdf_version': None,
        'encrypted': False,
        'repaired': False,
        'producer': None,
    }

    # ---- arquivo ----
    if size == 0:
        add('arquivo', 'Arquivo', 'error', 'arquivo vazio (0 bytes)')
        return finish(stats)

    # ---- cabeçalho e EOF ----
    with open(path, 'rb') as f:
        head = f.read(1024)
        f.seek(max(0, size - 4096))
        tail = f.read()
    m = re.search(br'%PDF-(\d+\.\d+)', head)
    if m:
        stats['pdf_version'] = m.group(1).decode('ascii')
        if not head.startswith(b'%PDF-'):
            add('cabecalho', 'Cabeçalho PDF', 'warn',
                f'cabeçalho %PDF- deslocado (inicia em {m.start()} bytes)')
        else:
            add('cabecalho', 'Cabeçalho PDF', 'ok',
                f'assinatura %PDF-{stats["pdf_version"]} presente')
    else:
        add('cabecalho', 'Cabeçalho PDF', 'error',
            'o arquivo não começa com %PDF- (não é PDF ou está corrompido)')
        return finish(stats)

    if b'%%EOF' not in tail:
        add('eof', 'Fim do arquivo (%%EOF)', 'warn',
            'marcador %%EOF ausente — possível truncamento')
    else:
        add('eof', 'Fim do arquivo (%%EOF)', 'ok', 'marcador presente')

    # ---- abertura (qpdf via pikepdf) ----
    try:
        pdf = pikepdf.open(str(path))
    except pikepdf.PasswordError:
        stats['encrypted'] = True
        add('criptografia', 'Criptografia', 'warn',
            'protegido por senha — o conteúdo não pôde ser verificado')
        return finish(stats)
    except Exception as exc:
        add('abertura', 'Abertura da estrutura', 'error',
            f'falhou ao abrir: {str(exc)[:200]}')
        return finish(stats)

    with pdf:
        add('abertura', 'Abertura da estrutura', 'ok',
            f'{len(pdf.pages)} página(s) resolvidas')
        try:
            if bool(pdf.is_encrypted):
                stats['encrypted'] = True
                add('criptografia', 'Criptografia', 'warn',
                    'documento criptografado (aberto com senha vazia)')
        except Exception:
            pass

        # ---- leitor alternativo (fitz): detecta truncamento/reparo ----
        try:
            with fitz.open(str(path)) as doc:
                stats['pages'] = doc.page_count
                stats['repaired'] = bool(doc.is_repaired)
                stats['encrypted'] = stats['encrypted'] or bool(doc.is_encrypted)
                meta = doc.metadata or {}
                stats['producer'] = meta.get('producer') or meta.get('creator')
                if doc.is_repaired:
                    add('estrutura', 'Estrutura (leitor alternativo)', 'warn',
                        'o arquivo precisou de reparo ao abrir')
                else:
                    add('estrutura', 'Estrutura (leitor alternativo)', 'ok',
                        'abriu sem necessidade de reparo')
        except Exception as exc:
            add('estrutura', 'Estrutura (leitor alternativo)', 'error',
                f'leitor alternativo rejeitou o arquivo: {str(exc)[:200]}')

        # ---- páginas ----
        n_pages = len(pdf.pages)
        if n_pages == 0:
            add('paginas', 'Páginas', 'error', 'o documento não tem páginas')
        else:
            broken_boxes = []
            for i, page in enumerate(pdf.pages, 1):
                try:
                    box = page.mediabox
                    if float(box[2]) <= float(box[0]) or float(box[3]) <= float(box[1]):
                        broken_boxes.append(str(i))
                except Exception:
                    broken_boxes.append(str(i))
            if broken_boxes:
                add('paginas', 'Páginas', 'error',
                    f'página(s) com área inválida ou ilegível: {", ".join(broken_boxes)}')
            else:
                add('paginas', 'Páginas', 'ok',
                    f'{n_pages} página(s) com área válida')

        # ---- fluxos de conteúdo ----
        stream_fail = []
        for i, page in enumerate(pdf.pages, 1):
            try:
                list(pikepdf.parse_content_stream(page))
            except Exception as exc:
                stream_fail.append(f'pág. {i}: {str(exc)[:80]}')
        if stream_fail:
            add('fluxos', 'Fluxos de conteúdo', 'error',
                ' | '.join(stream_fail[:5]))
        else:
            add('fluxos', 'Fluxos de conteúdo', 'ok',
                'todos os comandos de desenho foram analisados')

        # ---- imagens (decodificação real) ----
        img_total = 0
        img_fail = []
        for i, page in enumerate(pdf.pages, 1):
            try:
                names = list(page.get_images().keys())
            except Exception as exc:
                img_fail.append(f'pág. {i}: {str(exc)[:80]}')
                continue
            for name in names:
                img_total += 1
                try:
                    pikepdf.PdfImage(page.get_images()[name]).as_pil_image()
                except Exception as exc:
                    img_fail.append(f'pág. {i} {name}: {str(exc)[:80]}')
        if img_fail:
            add('imagens', 'Imagens', 'error',
                f'{len(img_fail)} de {img_total} ilegível(is) — ' +
                ' | '.join(img_fail[:3]))
        else:
            add('imagens', 'Imagens', 'ok',
                f'{img_total} imagem(ns) decodificadas sem erro')

        # ---- fontes referenciadas ----
        font_total = 0
        font_fail = []
        font_warn = []
        for i, page in enumerate(pdf.pages, 1):
            try:
                res = page.obj.get('/Resources')
                fonts = res.get('/Font') if res is not None else None
                if fonts is None:
                    continue
                for key in fonts.keys():
                    font_total += 1
                    try:
                        fobj = fonts[key]
                        if '/BaseFont' not in fobj and '/DescendantFonts' not in fobj \
                                and '/Subtype' not in fobj:
                            font_warn.append(f'pág. {i} {key}')
                    except Exception as exc:
                        font_fail.append(f'pág. {i} {key}: {str(exc)[:80]}')
            except Exception as exc:
                font_fail.append(f'pág. {i}: {str(exc)[:80]}')
        if font_fail:
            add('fontes', 'Fontes', 'error',
                ' | '.join(font_fail[:4]))
        elif font_warn:
            add('fontes', 'Fontes', 'warn',
                f'fonte(s) incompleta(s): {", ".join(font_warn[:4])}')
        else:
            add('fontes', 'Fontes', 'ok',
                f'{font_total} referência(s) de fonte resolvem')

    return finish(stats)


def protect_password(
    input_path: str,
    output_path: str,
    password: str
) -> dict:

    input_path = Path(input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    if not password:
        raise ValueError("Senha é obrigatória.")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    original_size = input_path.stat().st_size

    try:
        pdf = pikepdf.Pdf.open(input_path)
        encryption = pikepdf.Encryption(
            user=password,
            owner=password,  # mesma senha para simplificar
        )
        pdf.save(output_path, encryption=encryption)
        pdf.close()

        final_size = output_path.stat().st_size
        ratio = (final_size / original_size) if original_size > 0 else 1.0

        return {
            'original_size': original_size,
            'protected_size': final_size,
            'ratio': ratio,
            'output_path': str(output_path),
            'password': password,
        }

    except Exception as e:
        raise RuntimeError(f"Erro ao proteger PDF: {str(e)}")


def remove_password(
    input_path: str,
    output_path: str,
    password: str
) -> dict:
    input_path = Path(input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    if not password:
        raise ValueError("Senha é obrigatória para descriptografar.")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    original_size = input_path.stat().st_size

    try:
        pdf = pikepdf.Pdf.open(input_path, password=password)
        pdf.save(output_path)
        pdf.close()

        final_size = output_path.stat().st_size
        ratio = (final_size / original_size) if original_size > 0 else 1.0

        return {
            'original_size': original_size,
            'unprotected_size': final_size,
            'ratio': ratio,
            'output_path': str(output_path),
        }

    except pikepdf.PasswordError:
        raise ValueError("Senha incorreta. Não foi possível abrir o PDF.")
    except Exception as e:
        raise RuntimeError(f"Erro ao remover senha: {str(e)}")