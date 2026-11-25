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


def _fmt_bytes(n: float) -> str:
    """1536 -> '1.5 KB' (para mensagens de erro legíveis)."""
    for unidade in ('B', 'KB', 'MB', 'GB', 'TB'):
        if n < 1024 or unidade == 'TB':
            return f"{n:.0f} {unidade}" if unidade == 'B' else f"{n:.1f} {unidade}"
        n /= 1024
    return f"{n:.1f} TB"  # pragma: no cover


def _ensure_disk_space(target_dir, required_bytes: int, operacao: str) -> None:
    """Preflight de disco: falha ANTES de começar se não cabe o resultado.

    `required_bytes` é uma estimativa do chamador (pior caso plausível);
    aqui só comparamos com shutil.disk_usage. Um OSError na medição não
    bloqueia a operação — deixa tentar. ValueError -> 400: ação do
    usuário (liberar espaço ou escolher outro destino), não bug.
    """
    try:
        livre = shutil.disk_usage(str(target_dir)).free
    except OSError:
        return
    if livre < required_bytes:
        raise ValueError(
            f"Espaço insuficiente em disco para {operacao}: "
            f"necessário ≈ {_fmt_bytes(required_bytes)}, "
            f"disponível {_fmt_bytes(livre)}. "
            f"Libere espaço ou escolha outro destino."
        )

def merge(pdf_paths, output_path):
    """
    Mescla uma lista de PDFs em um único arquivo.
    Retorna o caminho do arquivo gerado.
    """
    if not pdf_paths:
        raise ValueError("Lista de PDFs vazia")
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Preflight: a saida da mesclagem regrava todos os streams, entao
    # estima-se ≈ soma dos inputs — falha ANTES de carregar tudo.
    total_in = 0
    for path in pdf_paths:
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {p}")
        total_in += p.stat().st_size
    _ensure_disk_space(output_path.parent, total_in, "a mesclagem dos PDFs")

    writer = PdfWriter()
    for path in pdf_paths:
        path = Path(path)
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

    # Guarda: destino igual a origem ou dentro dela cria laco de
    # realimentacao — os PDFs gerados viram entrada da proxima execucao
    # e o conteudo duplica a cada rodada (recursive pega a subpasta de
    # saida tambem). Rejeita antes de criar qualquer pasta.
    if dest_path == source_path or source_path in dest_path.parents:
        raise ValueError(
            f"A pasta de destino não pode ser igual à origem nem estar "
            f"dentro dela: {dest_dir}"
        )

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
            for iv_idx, (start, end) in enumerate(intervals, 1):
                for page_num in range(start - 1, end):
                    writer.add_page(reader.pages[page_num])
                report_progress(iv_idx, len(intervals))
            
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
            report_progress(idx, len(intervals))
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
    current_size = 0
    part_number = 1
    prefix_str = f"{prefix}_" if prefix else ""

    def _save_part(page_nums):
        nonlocal part_number
        part_writer = PdfWriter()
        for pnum in page_nums:
            part_writer.add_page(reader.pages[pnum])
        part_name = f"{prefix_str}part_{part_number:04d}.pdf"
        part_file = output_path / part_name
        with open(part_file, 'wb') as f:
            part_writer.write(f)
        stats['output_files'].append(str(part_file))
        stats['total_files'] += 1
        part_number += 1

    # Tamanho de cada pagina com UMA serializacao por pagina (O(n)).
    # A versao anterior re-serializava o ACUMULADO a cada passo —
    # O(n²): medido em2026-11,3,75x/3,94x de tempo por dobra de
    # paginas (100->200->400) e timeout de30min em9315 paginas.
    page_sizes = []
    for page_num in range(total_pages):
        single = PdfWriter()
        single.add_page(reader.pages[page_num])
        buf = BytesIO()
        single.write(buf)
        page_sizes.append(buf.tell())
        report_progress(page_num + 1, total_pages * 2)

    for page_num in range(total_pages):
        p_size = page_sizes[page_num]
        # fecha a parte atual antes de estourar o limite (a semantica
        # da versao original e identica: pagina sozinha acima do limite
        # e salva assim mesmo na parte seguinte)
        if current_pages and current_size + p_size > max_size_bytes:
            _save_part(current_pages)
            current_pages = []
            current_size = 0
        current_pages.append(page_num)
        current_size += p_size
        report_progress(total_pages + page_num + 1, total_pages * 2)

    if current_pages:
        _save_part(current_pages)

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

    # Preflight: a extracao regrava cada pagina em arquivo proprio —
    # no caso tipico (recursos por pagina) a soma ≈ tamanho do fonte.
    # Estimativa piso: falha ANTES de criar o primeiro arquivo.
    _ensure_disk_space(output_path, pdf_path.stat().st_size,
                       "a extração de todas as páginas")
    
    stats = {
        'total_pages': total_pages,
        'total_files': 0,
        'output_files': [],
        'errors': []
    }
    
    prefix_str = f"{prefix}_" if prefix else ""
    
    for page_num in range(1, total_pages + 1):
        report_progress(page_num, total_pages)
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
        report_progress(idx, len(page_numbers))
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
        dict com estatísticas: total_pages, remaining_pages, removed_pages, output_path, removed_file, errors
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
        'output_path': None,
        'removed_file': None,
        'errors': []
    }

    # Gerar arquivo sem as páginas removidas
    try:
        writer = PdfWriter()
        for keep_idx, page_num in enumerate(pages_to_keep, 1):
            writer.add_page(reader.pages[page_num - 1])
            report_progress(keep_idx, len(pages_to_keep))
        with open(output_path, 'wb') as f:
            writer.write(f)
        stats['output_path'] = str(output_path)
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
        dict com estatísticas: total_pages, output_path, errors
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
        'output_path': None,
        'errors': []
    }

    try:
        writer = PdfWriter()
        for order_idx, page_num in enumerate(new_order, 1):
            writer.add_page(reader.pages[page_num - 1])
            report_progress(order_idx, len(new_order))
        with open(output_path, 'wb') as f:
            writer.write(f)
        stats['output_path'] = str(output_path)
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


def _parse_selection_0based(selection: str, total: int):
    """Converte selecao '1-3,5' em indices 0-based (pdf2docx).
    'all'/vazio -> None (arquivo completo)."""
    if not selection or selection.strip().lower() == 'all':
        return None
    parts = [p.strip() for p in selection.split(',') if p.strip()]
    if not parts:
        return None
    pages = []
    for part in parts:
        try:
            if '-' in part:
                a, b = part.split('-', 1)
                start, end = int(a.strip()), int(b.strip())
            else:
                start = end = int(part)
        except ValueError:
            raise ValueError(f"Intervalo de páginas inválido: {part}")
        if start < 1 or end > total or start > end:
            raise ValueError(
                f"Intervalo {start}-{end} inválido (total: {total} páginas)")
        pages.extend(range(start - 1, end))
    return pages


def convert_pdf_to_word(pdf_path: str, output_path: str,
                        pages_selection: str = 'all') -> dict:
    """
    Converte um arquivo PDF para Word (.docx) usando pdf2docx.

    pages_selection: 'all' (padrao) ou ex. '1-3,5' — converte somente
    essas paginas (indices 0-based internos do pdf2docx). PDFs muito
    grandes devem ser convertidos por intervalo (o arquivo real de
    9315 paginas levou >53 min sem limite).

    Retorna {"output_path": ...}, {"pages_converted": ...} quando ha
    selecao, e, quando apropriado, {"warning": ...} (PDF sem texto —
    ver _scanned_pdf_warning).
    """
    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")

    # Selecao ANTES do try: ValueError do parse vira 400 (nao 500)
    pages = None
    if pages_selection and pages_selection.strip().lower() != 'all':
        with fitz.open(str(pdf_path)) as d:
            total = d.page_count
        pages = _parse_selection_0based(pages_selection, total)

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cv = None
    try:
        cv = Converter(str(pdf_path))
        if pages is not None:
            cv.convert(str(output_path), pages=pages)
        else:
            cv.convert(str(output_path), start=0, end=None)
    except Exception as e:
        raise RuntimeError(f"Erro ao converter PDF para Word: {str(e)}")
    finally:
        if cv is not None:
            try:
                cv.close()
            except Exception:
                pass

    result = {"output_path": str(output_path)}
    if pages is not None:
        result["pages_converted"] = len(pages)
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
                report_progress(idx + 1, len(image_paths))
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
                report_progress(idx + 1, len(image_paths))
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

    # Total de páginas selecionadas: progresso monotônico entre PDFs
    # (reabre rapidamente só para contar — a renderização é o lento)
    total_units = 0
    for p in pdf_paths:
        try:
            with fitz.open(str(p)) as d0:
                t = d0.page_count
                if pages_selection.strip().lower() == 'all':
                    total_units += t
                else:
                    total_units += len(parse_pages(pages_selection, t))
        except Exception:
            pass
    done_units = 0

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
                done_units += 1
                report_progress(done_units, max(total_units, 1))
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

        skipped_images = 0

        if downscale_images and dpi_target:
            # mapa xref -> tamanho exibido (DPI efetivo por imagem)
            display_inches = _display_size_inches(input_path)
            # Fallback MuPDF: o pikepdf nao decodifica JBIG2/DeviceN e o
            # MuPDF embute o jbig2dec — doc aberto uma vez, fechado apos
            # o loop (antes do save).
            fitz_cache = {'doc': None, 'tried': False}
            # Lista primeiro: as trocas de imagem nao podem acontecer
            # durante a iteracao das paginas/imagens.
            targets = []
            for page in pdf.pages:
                for name in page.get_images().keys():
                    targets.append((page, name))
            for i, (page, name) in enumerate(targets, 1):
                report_progress(i, len(targets), 'Reamostrando imagens')
                img_obj = None
                try:
                    img_obj = page.get_images()[name]
                    try:
                        pil_image = pikepdf.PdfImage(img_obj).as_pil_image()
                    except Exception:
                        pil_image = _fitz_decode(
                            fitz_cache, str(input_path), img_obj)
                        if pil_image is None:
                            raise

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
                    # anos mascarando compressao nula): registra e segue.
                    # Codec indisponivel (JBIG2) NAO e corrupcao: a imagem
                    # original fica intacta no arquivo de saida.
                    skipped_images += 1
                    if _imagem_codec_ausente(img_obj, exc):
                        logger.warning(
                            'compress: imagem %s preservada (codec '
                            'indisponivel neste ambiente): %s', name, exc)
                    else:
                        logger.warning(
                            'compress: falha ao reamostrar imagem %s: %s',
                            name, exc)

        # fecha o doc fitz do fallback de decode ANTES do save
        # (evita trava de arquivo no Windows durante a gravacao)
        if downscale_images and dpi_target:
            try:
                if fitz_cache['doc'] is not None:
                    fitz_cache['doc'].close()
            except Exception:
                pass

        try:
            pdf.save(
                output_path,
                compress_streams=config['compress_streams'],
                stream_decode_level=pikepdf.StreamDecodeLevel.specialized,
                object_stream_mode=config['object_stream_mode'],
            )
        except pikepdf.DependencyError as exc:
            # Codec de stream indisponivel (ex.: jbig2dec em PDFs de
            # scanner com JBIG2): grava com decode generalizado — mantem
            # a maioria do ganho de compressao e PRESERVA o filtro
            # original das imagens nao reamostradas.
            logger.warning(
                'compress: redecodificacao especializada indisponivel '
                '(%s); gravando com nivel generalizado', exc)
            pdf.save(
                output_path,
                compress_streams=config['compress_streams'],
                stream_decode_level=pikepdf.StreamDecodeLevel.generalized,
                object_stream_mode=config['object_stream_mode'],
            )
        pdf.close()

        final_size = output_path.stat().st_size
        ratio = (final_size / original_size) if original_size > 0 else 1.0

        return {
            'original_size': original_size,
            'compressed_size': final_size,
            'ratio': ratio,
            'skipped_images': skipped_images,
            'output_path': str(output_path)
        }

    except Exception as e:
        raise RuntimeError(f"Erro ao comprimir PDF: {str(e)}")

def pdf_info(pdf_path: str) -> dict:
    """Leitura rapida (sync, sem job) da paginacao de um PDF.

    Usada pelas features dividir/extrair/reordenar para exibir a
    contagem de paginas do arquivo selecionado e validar intervalos
    antes de disparar um job.

    Usa fitz (e nao PyPDF2): conta paginas mesmo em PDF criptografado —
    o PyPDF2 instalado nao tem PyCryptodome e falha em AES — e levanta
    erro claro quando o arquivo nao e um PDF valido.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")
    if not path.is_file():
        raise ValueError(f"Caminho não é um arquivo: {path}")
    try:
        with fitz.open(str(path)) as doc:
            try:
                meta = doc.metadata or {}
            except Exception:
                # PDF criptografado pode esconder os metadados
                meta = {}
            return {
                "pages": int(doc.page_count),
                "encrypted": bool(doc.is_encrypted),
                "needs_pass": bool(doc.needs_pass),
                "file_size": path.stat().st_size,
                "title": meta.get("title") or "",
                "producer": meta.get("producer") or meta.get("creator") or "",
            }
    except (FileNotFoundError, ValueError):
        raise
    except Exception as exc:
        # fitz.FileDataError (arquivo que nao e PDF valido) e demais
        # falhas de leitura -> 400 com mensagem clara, nao 500.
        raise ValueError(f"Não foi possível ler o PDF: {str(exc)[:200]}") from exc


# ===== cores: color spaces DeviceN/Separation, shadings e funções =====
# Defeito real: ferramentas baseadas em PDFium substituem tint transforms
# de DeviceN por FunctionType 2 com Domain [0 1] (1 entrada) mesmo com
# 2-3 colorantes — shadings PatternType 2 ficam inavaliáveis em
# Adobe/Chrome (branco/preto com "erro ao ler conteúdo").
#
# Varredura ÚNICA por documento com dedupe por objgen, sem decodificar
# streams de imagem e sem repetir varredura por página: segura para
# arquivos de gigabytes/variações de milhares de páginas.

_PROCESS_TINTS = ('/Cyan', '/Magenta', '/Yellow', '/Black')
_MAX_COLOR_SCAN_DEPTH = 16

_COLOR_PROBLEM_LABEL = {
    'tint': 'tint transform com aridade errada (DeviceN/Separation)',
    'shading': 'shading PatternType 2 com nº de saídas divergente',
    'stitch': 'função Type 3 com subsfunções divergentes',
}


def _is_dict_like(o):
    """Dicionário PDF ou stream — funções Type 0/4 são streams e no
    pikepdf Stream NÃO é subclasse de Dictionary (é dict-like: get,
    items, objgen funcionam)."""
    return isinstance(o, (pikepdf.Dictionary, pikepdf.Stream))


def _obj_ref(obj, parent=None):
    """Identificação curta do objeto para as mensagens (objgen)."""
    for o in (obj, parent):
        if o is None:
            continue
        try:
            og = o.objgen
            if og and og != (0, 0):
                return f'obj {og[0]} {og[1]}'
        except Exception:
            pass
    return 'obj inline'


def _report_span(current, total, span, message=None):
    """Reporta progresso mapeando current/total para o intervalo de
    percentual `span` (inicio, fim) — fases encadeadas de uma mesma
    operação avançam sem que a barra volte (no-op fora de um job)."""
    if not total or total <= 0:
        return
    frac = current / total
    frac = 0.0 if frac < 0 else (1.0 if frac > 1 else frac)
    start, end = span
    pct = start + (end - start) * frac
    report_progress(int(pct), 100, message)


def _func_output_count(fn, depth=0):
    """Nº de saídas de uma função PDF; None quando indeterminável.

    Type 0/4: Range (2 pares por saída — cf. pdf.js). Type 2: C0/C1
    (1 valor por saída; default 1). Type 3: subsfunções quando
    consistentes, senão C0/C1 próprio.
    """
    if depth > 3 or not _is_dict_like(fn):
        return None
    try:
        ftype = int(fn.get('/FunctionType', -1))
        if ftype in (0, 4):
            rng = fn.get('/Range')
            return len(rng) // 2 if rng is not None else None
        if ftype == 2:
            c0 = fn.get('/C0')
            if c0 is not None:
                return len(c0)
            c1 = fn.get('/C1')
            if c1 is not None:
                return len(c1)
            return 1  # default do spec: C0=[0], C1=[1]
        if ftype == 3:
            subs = fn.get('/Functions')
            if subs is not None:
                counts = []
                for s in subs:
                    if isinstance(s, pikepdf.Array):
                        counts.append(len(s))  # arranjo = 1 saída por fn
                    else:
                        counts.append(_func_output_count(s, depth + 1))
                known = [c for c in counts if c is not None]
                if known and len(set(known)) == 1:
                    return known[0]
            c0 = fn.get('/C0')
            if c0 is not None:
                return len(c0)
            c1 = fn.get('/C1')
            if c1 is not None:
                return len(c1)
    except Exception:
        return None
    return None


def _colorspace_components(cs):
    """Nº de componentes de um color space; None quando desconhecido."""
    try:
        if isinstance(cs, pikepdf.Name):
            return {'/DeviceGray': 1, '/DeviceRGB': 3,
                    '/DeviceCMYK': 4}.get(str(cs))
        if isinstance(cs, pikepdf.Array) and len(cs) >= 1:
            head = str(cs[0])
            if head == '/DeviceN':
                if len(cs) >= 2 and isinstance(cs[1], pikepdf.Array):
                    return len(cs[1])
                return None
            if head == '/Separation':
                return 1
            if head == '/CalGray':
                return 1
            if head in ('/CalRGB', '/Lab'):
                return 3
            if head == '/ICCBased' and len(cs) >= 2:
                n = cs[1].get('/N')
                return int(n) if n is not None else None
            return {'/DeviceGray': 1, '/DeviceRGB': 3,
                    '/DeviceCMYK': 4}.get(head)
        if _is_dict_like(cs):
            n = cs.get('/N')  # ICCBased raro como dicionário
            return int(n) if n is not None else None
    except Exception:
        return None
    return None


def _scan_colors(pdf, collect_templates=False, progress_span=(0, 100)):
    """Varredura única do documento por inconsistências de aridade.

    Detecta:
      (a) DeviceN/Separation cujo tint transform tem
          len(Domain)//2 != nº de colorantes (ou sem Domain);
      (b) shading PatternType 2 cuja /Function (Type 2/3/4, direta ou
          arranjo) tem nº de saídas diferente dos componentes do
          /ColorSpace do shading;
      (c) função Type 3 (stitch) com nº de saídas divergente entre
          subsfunções.

    Com collect_templates=True também indexa DeviceN corretos (Type 4
    com Domain na dimensão certa) pela tupla de colorantes — usado pelo
    reparo para reutilizar a transformação original do documento.

    Retorna {'problems', 'suspects', 'templates'}; cada problema tem
    kind/ref/msg/arr/names.
    """
    problems = []
    suspects = []
    templates = {}
    seen = set()

    def _problem(kind, obj, parent, msg, arr=None, names=None, extra=None):
        entry = {
            'kind': kind,
            'ref': _obj_ref(obj, parent),
            'msg': msg,
            'arr': arr,
            'names': names,
        }
        if extra:
            entry.update(extra)
        problems.append(entry)

    def _suspect(obj, parent, msg):
        suspects.append({'ref': _obj_ref(obj, parent), 'msg': msg})

    def check_tint(arr, parent):
        try:
            if len(arr) == 0:
                return  # arrays comuns (nao sao color spaces)
            head = str(arr[0])
            if head == '/DeviceN':
                if len(arr) < 4 or not isinstance(arr[1], pikepdf.Array):
                    _suspect(arr, parent, 'DeviceN malformado')
                    return
                names = tuple(str(x) for x in arr[1])
                n = len(names)
            elif head == '/Separation':
                if len(arr) < 4:
                    _suspect(arr, parent, 'Separation malformado')
                    return
                names = (str(arr[1]),)
                n = 1
            else:
                return
            fn = arr[3]
            if not _is_dict_like(fn):
                _problem('tint', arr, parent, 'tint transform ausente',
                         arr, names)
                return
            ftype = int(fn.get('/FunctionType', -1))
            dom = fn.get('/Domain')
            if dom is None:
                # Sem Domain: Type 4/0 é inválido; os leitores assumem
                # 1 entrada para Type 2 (só quebra quando n != 1).
                if ftype == 2 and n == 1:
                    _suspect(arr, parent,
                             'tint transform sem Domain (assumido 1 entrada)')
                else:
                    _problem('tint', arr, parent,
                             'tint transform sem Domain', arr, names)
                return
            inputs = len(dom) // 2
            if inputs != n:
                _problem('tint', arr, parent,
                         f'Domain com {inputs} entrada(s) para '
                         f'{n} colorante(s)',
                         arr, names)
            elif collect_templates and ftype == 4 and names not in templates:
                templates[names] = arr
        except Exception as exc:
            _suspect(arr, parent,
                     f'color space não analisável: {str(exc)[:60]}')

    def check_shading(d, parent):
        try:
            if int(d.get('/PatternType', -1)) != 2:
                return
            sh = d.get('/Shading')
            if not _is_dict_like(sh):
                return
            stype = int(sh.get('/ShadingType', -1))
            n = _colorspace_components(sh.get('/ColorSpace'))
            fn = sh.get('/Function')
            if fn is None:
                # /Function e obrigatorio so em ShadingType 2/3; nos
                # mesh (4-7) ele e opcional (cada patch carrega o seu).
                if stype in (2, 3):
                    _suspect(d, parent, 'shading PatternType 2 sem /Function')
                return
            if n is None:
                return  # color space sem componentes conhecidos
            if isinstance(fn, pikepdf.Array):
                # Arranjo de funções: cada elemento tem 1 saída e o
                # total é o nº de elementos (semântica do pdf.js).
                for idx, sub in enumerate(fn):
                    c = _func_output_count(sub, 1)
                    if c is not None and c != 1:
                        _problem('shading', d, parent,
                                 f'elemento {idx} do arranjo com {c} '
                                 f'saída(s) (esperado 1)',
                                 extra={'shading': sh, 'fn': fn,
                                        'colorants': n})
                        return
                total = len(fn)
            else:
                total = _func_output_count(fn)
            if total is None:
                _suspect(d, parent,
                         'função do shading sem nº de saídas determinável')
            elif total != n:
                _problem('shading', d, parent,
                         f'função do shading com {total} saída(s) para '
                         f'{n} colorante(s) do color space',
                         extra={'shading': sh, 'fn': fn, 'colorants': n})
        except Exception as exc:
            _suspect(d, parent, f'shading não analisável: {str(exc)[:60]}')

    def check_stitch(d, parent):
        try:
            if int(d.get('/FunctionType', -1)) != 3:
                return
            subs = d.get('/Functions')
            if subs is None:
                _suspect(d, parent, 'função Type 3 sem /Functions')
                return
            counts = []
            for s in subs:
                if isinstance(s, pikepdf.Array):
                    counts.append(len(s))
                else:
                    counts.append(_func_output_count(s, 1))
            known = [c for c in counts if c is not None]
            if len(set(known)) > 1:
                # Alvo da correção: C0/C1 próprio, senão a 1ª subsfunção
                # com contagem determinável.
                target = None
                c0 = d.get('/C0')
                if c0 is None:
                    c0 = d.get('/C1')
                if c0 is not None:
                    target = len(c0)
                if target is None:
                    target = next((c for c in counts if c is not None), None)
                _problem('stitch', d, parent,
                         f'subsfunções com saídas divergentes: '
                         f'{sorted(set(known))}',
                         extra={'fn_dict': d, 'target': target})
            elif any(c is None for c in counts):
                _suspect(d, parent,
                         'subsfunção com nº de saídas indeterminável')
        except Exception as exc:
            _suspect(d, parent, f'função Type 3 não analisável: '
                                f'{str(exc)[:60]}')

    def walk(o, parent, depth=0):
        if depth > _MAX_COLOR_SCAN_DEPTH:
            return
        if isinstance(o, pikepdf.Array):
            # Arrays NAO sao deduped: cada referencia conta como
            # ocorrencia (mesma semantica do reparo de referencia — no
            # arquivo real isso da as 150 ocorrencias esperadas).
            check_tint(o, parent)
            for v in o:
                walk(v, parent, depth + 1)
            return
        if isinstance(o, pikepdf.Dictionary):
            # Apenas Dictionary (nao Stream): espelha o reparo de
            # referencia — streams nao sao descendidos. Dedupe por
            # objgen mantem a varredura unica em segundos.
            try:
                og = o.objgen
            except Exception:
                og = None
            if og and og != (0, 0):
                if og in seen:
                    return
                seen.add(og)
            check_shading(o, parent)
            check_stitch(o, parent)
            for _k, v in o.items():
                walk(v, o, depth + 1)
            return
        # Stream/Name/Number/String: nada a verificar

    try:
        total_objs = len(pdf.objects)
    except Exception:
        total_objs = None
    for idx, obj in enumerate(pdf.objects, 1):
        try:
            walk(obj, None)
        except Exception:
            pass
        if total_objs and idx % 500 == 0:
            _report_span(idx, total_objs, progress_span,
                         'Analisando cores')
    if total_objs:
        _report_span(total_objs, total_objs, progress_span,
                     'Analisando cores')

    return {'problems': problems, 'suspects': suspects,
            'templates': templates}


# ===== scanners compartilhados (validate + repair) =====

def _scan_page_boxes(pdf):
    """Páginas com MediaBox inválido/ilegível (números 1-based)."""
    bad = []
    for i, page in enumerate(pdf.pages, 1):
        try:
            box = page.mediabox
            if float(box[2]) <= float(box[0]) or float(box[3]) <= float(box[1]):
                bad.append(i)
        except Exception:
            bad.append(i)
    return bad


def _scan_content_streams(pdf, progress_span=None):
    """(página, erro) dos fluxos de conteúdo ilegíveis (decode/parse)."""
    fails = []
    n_pages = len(pdf.pages)
    for i, page in enumerate(pdf.pages, 1):
        if progress_span:
            _report_span(i, n_pages, progress_span, 'Analisando fluxos')
        try:
            list(pikepdf.parse_content_stream(page))
        except Exception as exc:
            fails.append((i, str(exc)[:80]))
    return fails


def _imagem_codec_ausente(img, exc=None):
    """Falha de decode por codec/recuso INDISPONIVEL neste ambiente — a
    imagem NÃO está corrompida; outros leitores a exibem:
      - JBIG2 sem jbig2dec (DependencyError / filtro JBIG2Decode);
      - pikepdf recusa transcender imagem com ColorSpace DeviceN/
        Separation (HifiPrintImageNotTranscodableError — JPEGs válidos
        com cores de spot; caso real:7 imagens do arquivo do usuario).
    Usa a classe da exceção (determinístico) + mensagem + filtro."""
    try:
        if exc is not None:
            if isinstance(exc, pikepdf.HifiPrintImageNotTranscodableError):
                return True
            if isinstance(exc, pikepdf.DependencyError):
                return True
    except AttributeError:
        pass
    msg = str(exc or '').lower()
    if 'jbig2dec' in msg or 'not installed' in msg or 'dependencyerror' in msg:
        return True
    try:
        if img is None:
            return False
        filt = img.get('/Filter')
        if isinstance(filt, pikepdf.Array):
            fl = [str(x) for x in filt]
        elif filt is not None:
            fl = [str(filt)]
        else:
            fl = []
        return any('jbig2' in f.lower() for f in fl)
    except Exception:
        return False


def _fitz_decode(cache, pdf_path, img):
    """Decodifica imagem via MuPDF (fitz) — o MuPDF embute o jbig2dec
    e trata ColorSpace DeviceN que o pikepdf recusa/nao suporta.

    Devolve PIL.Image ou None (fitz indisponivel ou nao decodifica).
    `cache` = dict para abrir o documento fitz uma unica vez
    ({'doc': None, 'tried': False})."""
    if not pdf_path:
        return None
    try:
        if cache.get('doc') is None and not cache.get('tried'):
            try:
                cache['doc'] = fitz.open(str(pdf_path))
            except Exception:
                cache['tried'] = True
        doc = cache.get('doc')
        if doc is None:
            return None
        og = img.objgen
        if not og or og == (0, 0):
            return None  # inline: fitz resolve por xref
        # O MuPDF e TOLERANTE: imprime o erro mas devolve um pixmap em
        # branco. Captura os avisos: houve erro de decode -> falha.
        fitz.TOOLS.mupdf_warnings(reset=True)
        pix = fitz.Pixmap(doc, og[0])
        if fitz.TOOLS.mupdf_warnings():
            return None
        if pix.width <= 0 or pix.height <= 0:
            return None
        return Image.open(io.BytesIO(pix.tobytes('png')))
    except Exception:
        return None


def _scan_images(pdf, progress_span=None, pdf_path=None):
    """(total, [(página, nome, erro, codec_ausente)]) — decodificação
    real das imagens; codec_ausente marca falhas de AMBIENTE (JBIG2).
    Fallback: se o pikepdf nao decodifica mas o MuPDF (fitz) consegue,
    a imagem conta como decodificada (ex.: JBIG2/DeviceN)."""
    total = 0
    fails = []
    fitz_cache = {'doc': None, 'tried': False}
    n_pages = len(pdf.pages)
    try:
        for i, page in enumerate(pdf.pages, 1):
            if progress_span:
                _report_span(i, n_pages, progress_span,
                             'Decodificando imagens')
            try:
                imgs = page.get_images()
                names = list(imgs.keys())
            except Exception as exc:
                fails.append((i, '', str(exc)[:80], False))
                continue
            for name in names:
                total += 1
                try:
                    pikepdf.PdfImage(imgs[name]).as_pil_image()
                except Exception as exc:
                    if _fitz_decode(fitz_cache, pdf_path, imgs[name]):
                        continue  # MuPDF decodifica (jbig2/DeviceN...)
                    fails.append((i, str(name), str(exc)[:80],
                                  _imagem_codec_ausente(imgs[name], exc)))
    finally:
        if fitz_cache['doc'] is not None:
            try:
                fitz_cache['doc'].close()
            except Exception:
                pass
    return total, fails


def _scan_fonts(pdf):
    """(total, falhas, avisos) das fontes referenciadas por página."""
    total = 0
    fails = []
    warns = []
    for i, page in enumerate(pdf.pages, 1):
        try:
            res = page.obj.get('/Resources')
            fonts = res.get('/Font') if res is not None else None
            if fonts is None:
                continue
            for key in fonts.keys():
                total += 1
                try:
                    fobj = fonts[key]
                    if '/BaseFont' not in fobj and '/DescendantFonts' not in fobj \
                            and '/Subtype' not in fobj:
                        warns.append(f'pág. {i} {key}')
                except Exception as exc:
                    fails.append(f'pág. {i} {key}: {str(exc)[:80]}')
        except Exception as exc:
            fails.append(f'pág. {i}: {str(exc)[:80]}')
    return total, fails, warns


# ===== correções (repair) =====

def _fix_pages(pdf):
    """MediaBox inválido -> A4; documento sem páginas -> página em branco."""
    fixed = []
    if len(pdf.pages) == 0:
        pdf.add_blank_page(page_size=(595, 842))
        fixed.append('documento sem páginas: página em branco adicionada')
        return fixed
    for i in _scan_page_boxes(pdf):
        pdf.pages[i - 1].obj['/MediaBox'] = pikepdf.Array([0, 0, 595, 842])
        fixed.append(f'pág. {i}: área inválida substituída por A4')
    return fixed


def _fix_images(pdf, progress_span=None, pdf_path=None):
    """Imagem com stream corrompido -> placeholder sólido 8x8.

    O posicionamento vem da matriz do conteúdo (cm), então a caixa de
    desenho permanece — só os samples são substituídos. Detecta e
    corrige no mesmo passe (decode é a fase lenta). Se o pikepdf nao
    decodifica mas o MuPDF (fitz) consegue, a imagem esta INTEIRA —
    nao mexe (ex.: JBIG2/DeviceN).
    """
    fixed = []
    failed = []
    seen = set()
    fitz_cache = {'doc': None, 'tried': False}
    n_pages = len(pdf.pages)
    try:
        for i, page in enumerate(pdf.pages, 1):
            if progress_span:
                _report_span(i, n_pages, progress_span, 'Reparando imagens')
            try:
                imgs = page.get_images()
                names = list(imgs.keys())
            except Exception:
                continue
            for name in names:
                img = imgs[name]
                try:
                    og = img.objgen
                except Exception:
                    og = None
                if og and og != (0, 0):
                    if og in seen:
                        continue
                    seen.add(og)
                try:
                    pikepdf.PdfImage(img).as_pil_image()
                    continue
                except Exception as exc:
                    if _fitz_decode(fitz_cache, pdf_path, img):
                        continue  # MuPDF decodifica: imagem esta inteira
                    if _imagem_codec_ausente(img, exc):
                        # NAO e corrupcao: codec ausente NESTE ambiente —
                        # outros leitores exibem; substituir por placeholder
                        # degradaria conteudo real (nunca piorar).
                        failed.append({
                            'category': 'imagens',
                            'ref': f'pág. {i} {name}',
                            'reason': 'imagem preservada: codec indisponível '
                                      'neste ambiente (ex.: JBIG2)',
                        })
                        continue
                    # corrupcao real: substitui por placeholder
                    ref = f'pág. {i} {name}'
                    try:
                        buf = BytesIO()
                        Image.new('L', (8, 8), 128).save(buf, format='JPEG')
                        img.write(buf.getvalue())
                        img['/Subtype'] = pikepdf.Name('/Image')
                        img['/Width'] = 8
                        img['/Height'] = 8
                        img['/ColorSpace'] = pikepdf.Name('/DeviceGray')
                        img['/BitsPerComponent'] = 8
                        img['/Filter'] = pikepdf.Name('/DCTDecode')
                        for k in ('/DecodeParms', '/SMask', '/Mask', '/Decode',
                                  '/Alternates'):
                            if k in img:
                                del img[k]
                        fixed.append({
                            'ref': ref,
                            'detail': 'imagem ilegível substituída por placeholder '
                                      '8x8 (posicionamento preservado)',
                        })
                    except Exception as exc2:
                        failed.append({
                            'category': 'imagens',
                            'ref': ref,
                            'reason': f'não foi possível substituir: {str(exc2)[:80]}',
                        })
    finally:
        if fitz_cache['doc'] is not None:
            try:
                fitz_cache['doc'].close()
            except Exception:
                pass
    return fixed, failed


def _fix_fonts(pdf):
    """Fonte sem BaseFont/Subtype/DescendantFonts (ou ref quebrada)
    -> Helvetica padrão (mantém válidas as referências dos fluxos)."""
    fixed = []
    failed = []
    for i, page in enumerate(pdf.pages, 1):
        try:
            res = page.obj.get('/Resources')
            fonts = res.get('/Font') if res is not None else None
            if fonts is None:
                continue
            for key in list(fonts.keys()):
                broken = False
                try:
                    fobj = fonts[key]
                    if '/BaseFont' not in fobj and '/DescendantFonts' not in fobj \
                            and '/Subtype' not in fobj:
                        broken = True
                except Exception:
                    broken = True
                if not broken:
                    continue
                try:
                    helv = pikepdf.Dictionary()
                    helv['/Type'] = pikepdf.Name('/Font')
                    helv['/Subtype'] = pikepdf.Name('/Type1')
                    helv['/BaseFont'] = pikepdf.Name('/Helvetica')
                    fonts[key] = helv
                    fixed.append({
                        'ref': f'pág. {i} {key}',
                        'detail': 'fonte inválida substituída por Helvetica',
                    })
                except Exception as exc:
                    failed.append({
                        'category': 'fontes',
                        'ref': f'pág. {i} {key}',
                        'reason': str(exc)[:80],
                    })
        except Exception as exc:
            failed.append({
                'category': 'fontes',
                'ref': f'pág. {i}',
                'reason': str(exc)[:80],
            })
    return fixed, failed


# ===== ajuste de aridade de funções (shading/stitch) =====

def _resize_list(vals, target, fill=0.0):
    if len(vals) >= target:
        return vals[:target]
    return vals + [fill] * (target - len(vals))


def _resize_range(rng, target):
    """Range com 2 valores por saída: corta ou completa com [0, 1]."""
    out = list(rng)
    if len(out) % 2 == 1:
        out = out[: len(out) // 2 * 2]
    out = out[: target * 2]
    while len(out) < target * 2:
        out.append(1.0 if len(out) % 2 == 1 else 0.0)
    return out


def _resize_function(pdf, fn, target, depth=0):
    """Cópia de `fn` com `target` saídas (None = não ajustável com
    segurança — ex.: função amostrada Type 0, cujo passo dos dados é
    fixo).

    Type 2/3: reajusta C0/C1/Range (e subsfunções do stitch).
    Type 4: anexa `pop` (corta saídas) ou `0` (acrescenta) ao programa
    e reajusta o Range — a convenção de stack (y0 no fundo do grupo
    final) torna a cirurgia segura.
    Arranjo de funções: corta ou preenche com constantes.
    """
    if depth > 3 or target < 1:
        return None
    if isinstance(fn, pikepdf.Array):
        items = list(fn)
        if len(items) > target:
            items = items[:target]
        elif len(items) < target:
            dom = None
            if items and _is_dict_like(items[0]):
                dom = items[0].get('/Domain')
            for _ in range(target - len(items)):
                c = pikepdf.Dictionary()
                c['/FunctionType'] = 2
                c['/Domain'] = (pikepdf.Array(list(dom))
                                if dom is not None
                                else pikepdf.Array([0, 1]))
                c['/C0'] = pikepdf.Array([0])
                c['/C1'] = pikepdf.Array([0])
                c['/N'] = 1
                items.append(c)
        return pikepdf.Array(items)
    if not _is_dict_like(fn):
        return None
    try:
        ftype = int(fn.get('/FunctionType', -1))
    except Exception:
        return None
    if ftype == 0:
        return None
    if ftype in (2, 3):
        out = pikepdf.Dictionary()
        for k, v in fn.items():
            out[k] = v
        for key in ('/C0', '/C1'):
            vals = fn.get(key)
            if vals is not None:
                out[key] = pikepdf.Array(
                    _resize_list([float(x) for x in vals], target))
        rng = fn.get('/Range')
        if rng is not None:
            out['/Range'] = pikepdf.Array(
                _resize_range([float(x) for x in rng], target))
        if ftype == 2 and fn.get('/C0') is None and fn.get('/C1') is None:
            # default do spec e 1 saida; declara C0/C1 com `target`
            out['/C0'] = pikepdf.Array([0.0] * target)
            out['/C1'] = pikepdf.Array([1.0] * target)
        if ftype == 3:
            subs = fn.get('/Functions')
            if subs is None:
                return None
            new_subs = []
            for s in subs:
                rs = _resize_function(pdf, s, target, depth + 1)
                if rs is None:
                    return None
                new_subs.append(rs)
            out['/Functions'] = pikepdf.Array(new_subs)
        return out
    if ftype == 4:
        rng = fn.get('/Range')
        dom = fn.get('/Domain')
        if rng is None or dom is None:
            return None
        m = len(rng) // 2
        if m == target:
            return fn
        try:
            prog = fn.read_bytes().decode('ascii', 'replace')
        except Exception:
            return None
        stripped = prog.strip()
        if not stripped.endswith('}'):
            return None
        body = stripped[:-1].rstrip()
        if target < m:
            body += ' pop' * (m - target)
        else:
            body += ' 0' * (target - m)
        body += ' }'
        out = pikepdf.Stream(pdf, body.encode('ascii'))
        out['/FunctionType'] = 4
        out['/Domain'] = pikepdf.Array([float(x) for x in dom])
        out['/Range'] = pikepdf.Array(
            _resize_range([float(x) for x in rng], target))
        return out
    return None


def _fix_stitch_inplace(stitch, target, pdf):
    """Ajusta as subsfunções de um Type 3 (in-place) para `target`
    saídas; False se alguma não for ajustável."""
    subs = stitch.get('/Functions')
    if subs is None or target < 1:
        return False
    new_subs = []
    for s in subs:
        rs = _resize_function(pdf, s, target)
        if rs is None:
            return False
        new_subs.append(rs)
    stitch['/Functions'] = pikepdf.Array(new_subs)
    for key in ('/C0', '/C1'):
        vals = stitch.get(key)
        if vals is not None:
            stitch[key] = pikepdf.Array(
                _resize_list([float(x) for x in vals], target))
    rng = stitch.get('/Range')
    if rng is not None:
        stitch['/Range'] = pikepdf.Array(
            _resize_range([float(x) for x in rng], target))
    return True


def validate_pdf(pdf_path: str, progress_span=(0, 100)) -> dict:
    """Analisa a integridade de um PDF (corrupção, truncamento, refs).

    Devolve uma lista de checks com status ok/warn/error e estatísticas.
    `valid` é False quando existe ao menos um check em error — avisos
    (warn) não invalidam o documento.

    `progress_span` (inicio, fim) mapeia as fases lentas (decodificação
    de imagens e varredura de cores) para um intervalo de percentual —
    usado quando a validação é a última fase de uma operação maior
    (reparo) para a barra não voltar.
    """
    s0, s1 = progress_span
    pages_span = (s0, s0 + (s1 - s0) * 0.75)
    color_span = (s0 + (s1 - s0) * 0.75, s1)
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
        'color_issues': 0,
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
            broken_boxes = [str(i) for i in _scan_page_boxes(pdf)]
            if broken_boxes:
                add('paginas', 'Páginas', 'error',
                    f'página(s) com área inválida ou ilegível: {", ".join(broken_boxes)}')
            else:
                add('paginas', 'Páginas', 'ok',
                    f'{n_pages} página(s) com área válida')

        # ---- fluxos de conteúdo ----
        stream_fail = [f'pág. {i}: {err}'
                       for i, err in _scan_content_streams(pdf)]
        if stream_fail:
            add('fluxos', 'Fluxos de conteúdo', 'error',
                ' | '.join(stream_fail[:5]))
        else:
            add('fluxos', 'Fluxos de conteúdo', 'ok',
                'todos os comandos de desenho foram analisados')

        # ---- imagens (decodificação real) ----
        # Codec indisponível no ambiente (ex.: JBIG2 sem jbig2dec) vira
        # WARN: outros leitores exibem a imagem — não é corrupção.
        img_total, img_fails = _scan_images(pdf, progress_span=pages_span,
                                            pdf_path=str(path))
        reais = [f for f in img_fails if not f[3]]
        codec = [f for f in img_fails if f[3]]
        img_fail = [
            (f'pág. {i} {name}: {err}' if name else f'pág. {i}: {err}')
            for i, name, err, _u in reais
        ]
        if img_fail:
            extra = (f' (+{len(codec)} com codec indisponível)'
                     if codec else '')
            add('imagens', 'Imagens', 'error',
                f'{len(img_fail)} de {img_total} ilegível(is) — ' +
                ' | '.join(img_fail[:3]) + extra)
        elif codec:
            add('imagens', 'Imagens', 'warn',
                f'{len(codec)} de {img_total} imagem(ns) não decodificadas '
                'aqui: codec indisponível no ambiente (ex.: JBIG2) — em '
                'leitores com suporte elas renderizam')
        else:
            add('imagens', 'Imagens', 'ok',
                f'{img_total} imagem(ns) decodificadas sem erro')

        # ---- fontes referenciadas ----
        font_total, font_fail, font_warn = _scan_fonts(pdf)
        if font_fail:
            add('fontes', 'Fontes', 'error',
                ' | '.join(font_fail[:4]))
        elif font_warn:
            add('fontes', 'Fontes', 'warn',
                f'fonte(s) incompleta(s): {", ".join(font_warn[:4])}')
        else:
            add('fontes', 'Fontes', 'ok',
                f'{font_total} referência(s) de fonte resolvem')

        # ---- cores: aridade de DeviceN/Separation, shadings, stitch ----
        # Varredura única (dedupe por objgen), sem decodificar imagens.
        color_scan = _scan_colors(pdf, progress_span=color_span)
        color_problems = color_scan['problems']
        color_suspects = color_scan['suspects']
        stats['color_issues'] = len(color_problems)
        if color_problems:
            by_kind = {}
            for p in color_problems:
                by_kind[p['kind']] = by_kind.get(p['kind'], 0) + 1
            parts = [f'{cnt} {_COLOR_PROBLEM_LABEL[kind]}'
                     for kind, cnt in by_kind.items()]
            refs = ', '.join(list(dict.fromkeys(
                p['ref'] for p in color_problems))[:5])
            detail = (f'{len(color_problems)} ocorrência(s): '
                      + '; '.join(parts) + f'. Ex.: {refs}')
            add('cores', 'Espaços de cor e funções', 'error', detail[:400])
        elif color_suspects:
            msgs = '; '.join(
                f"{s['ref']}: {s['msg']}" for s in color_suspects[:3])
            detail = (f'{len(color_suspects)} suspeita(s) não '
                      f'conclusiva(s): {msgs}')
            add('cores', 'Espaços de cor e funções', 'warn', detail[:400])
        else:
            add('cores', 'Espaços de cor e funções', 'ok',
                'DeviceN/Separation, shadings e funções com aridade '
                'consistente')

    return finish(stats)


def _type4_program(outputs, n_inputs):
    """Gera o corpo de uma função Type 4 (PostScript calculator).

    `outputs` é a lista, na ordem das saídas, de:
      ('in', p)   -> cópia do input p
      ('const', v)-> constante
      ('prod', ps)-> produto de (1 - x_p) para p em ps (vazio => 1)

    Convenção (ISO 32000-1 e pdf.js "outputs: first at bottom, last at
    top"): os inputs são empilhados na ordem e o grupo final de saídas
    fica no topo com y0 no fundo. Para isso o programa:
      1. empilha y0..y(m-1) acima dos n_inputs originais;
      2. `total m roll` rotaciona os (n+m) elementos para [Y, X];
      3. `pop` x n descarta os inputs originais.
    """
    tokens = []
    sp = n_inputs  # altura simulada da stack

    def emit_op(name, pop, push):
        nonlocal sp
        tokens.append(name)
        sp += push - pop

    def emit_const(v):
        nonlocal sp
        if isinstance(v, float) and not v.is_integer():
            tokens.append(repr(v))
        else:
            tokens.append(str(int(v)))
        sp += 1

    def emit_input(p):
        # `i index` copia a posição p: i = altura_antes - 1 - p
        emit_const(sp - 1 - p)
        emit_op('index', 1, 1)

    def emit_one_minus_input(p):
        emit_input(p)
        emit_const(1)
        emit_op('exch', 2, 2)
        emit_op('sub', 2, 1)  # 1 x sub -> 1 - x

    def emit_product(factors):
        if not factors:
            emit_const(1)
            return
        emit_one_minus_input(factors[0])
        for p in factors[1:]:
            emit_one_minus_input(p)
            emit_op('mul', 2, 1)

    for out in outputs:
        kind = out[0]
        if kind == 'in':
            emit_input(out[1])
        elif kind == 'const':
            emit_const(out[1])
        elif kind == 'prod':
            emit_product(out[1])

    total = n_inputs + len(outputs)
    emit_const(total)
    emit_const(len(outputs))
    emit_op('roll', 2, 0)  # consome (n, j) e rotaciona: [X, Y] -> [Y, X]
    for _ in range(n_inputs):
        emit_op('pop', 1, 0)
    if sp != len(outputs):
        raise AssertionError(f'gerador Type 4 inconsistente: {sp} != '
                             f'{len(outputs)}')
    return '{ ' + ' '.join(tokens) + ' }'


def _make_type4_function(pdf, names, alt):
    """Cria um tint transform Type 4 para colorantes de processo.

    /DeviceCMYK -> identidade (cada saída = input correspondente, 0
    quando o colorante não existe). /DeviceRGB -> fórmula
    CMYK->RGB: R=(1-C)(1-K), G=(1-M)(1-K), B=(1-Y)(1-K).
    Retorna None para alternados fora desses casos.
    """
    n = len(names)
    if alt == '/DeviceCMYK':
        outs = [('in', names.index(p)) if p in names else ('const', 0)
                for p in ('/Cyan', '/Magenta', '/Yellow', '/Black')]
        n_out = 4
    elif alt == '/DeviceRGB':
        groups = (('/Cyan', '/Black'), ('/Magenta', '/Black'),
                  ('/Yellow', '/Black'))
        outs = [('prod', [names.index(p) for p in grp if p in names])
                for grp in groups]
        n_out = 3
    else:
        return None

    program = _type4_program(outs, n)
    domain = pikepdf.Array([0, 1] * n)
    rng = pikepdf.Array([0, 1] * n_out)

    stream = pikepdf.Stream(pdf, program.encode('ascii'))
    stream['/FunctionType'] = 4
    stream['/Domain'] = domain
    stream['/Range'] = rng
    return stream


def repair_pdf(input_path: str, output_path: str) -> dict:
    """Repara os problemas de integridade detectados pelo validate_pdf.

    Categorias (o que não dá para corrigir com segurança NUNCA é
    alterado — é reportado em `unrepaired`):
      cabecalho/eof/estrutura -> normalizados pelo próprio save
      paginas  -> MediaBox inválido -> A4; documento sem páginas ->
                  página em branco adicionada
      fluxos   -> conteúdo ilegível (decode falha) -> stream vazio
                  válido (a página fica em branco)
      imagens  -> stream corrompido -> placeholder sólido 8x8 (o
                  posicionamento vem da matriz do conteúdo)
      fontes   -> dict sem BaseFont/Subtype/DescendantFonts (ou ref
                  quebrada) -> Helvetica padrão
      cores    -> (a) tint: template do documento, senão Type 4
                  identidade/CMYK->RGB para tintas de processo;
                  (b) shading: reajusta a função (Type 2/3/4 ou
                  arranjo) para o nº de colorantes;
                  (c) stitch: reajusta as subsfunções
      abertura -> se o pikepdf não abrir, tenta reconstruir via fitz;
                  senão copia byte a byte e reporta

    Grava sempre em output_path (o original nunca é tocado) e re-rodar
    validate_pdf no arquivo corrigido — erros que persistirem aparecem
    em `unrepaired` e em `validation`.
    """
    input_path = Path(input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    output_path = Path(output_path).resolve()
    if output_path == input_path:
        raise ValueError(
            "output_path deve ser diferente de input_path "
            "(o original nunca é alterado)")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    original_size = input_path.stat().st_size

    repaired = []
    unrepaired = []
    issues_before = {}

    # ---------- abertura ----------
    try:
        pdf = pikepdf.open(str(input_path))
    except pikepdf.PasswordError:
        pdf = None
        open_fail = ('criptografia',
                     'protegido por senha — sem a senha não há o que reparar')
    except Exception as exc:
        pdf = None
        open_fail = ('abertura', str(exc)[:200])

    if pdf is None:
        # Melhor esforço: o MuPDF (fitz) reconstrói o xref de alguns
        # arquivos que o qpdf rejeita.
        salvaged = False
        try:
            with fitz.open(str(input_path)) as doc:
                doc.save(str(output_path), garbage=3, deflate=True)
            salvaged = True
        except Exception:
            salvaged = False
        if salvaged:
            repaired.append({
                'category': open_fail[0],
                'ref': 'arquivo',
                'detail': 'estrutura reconstruída pelo leitor '
                          'alternativo (fitz)',
            })
            issues_before[open_fail[0]] = 1
        else:
            # Nada abriu: cópia byte a byte (nunca piorar) + relatório.
            shutil.copyfile(input_path, output_path)
            unrepaired.append({
                'category': open_fail[0],
                'ref': 'arquivo',
                'reason': open_fail[1],
            })
            issues_before[open_fail[0]] = 1
    else:
        with pdf:
            _report_span(1, 1, (0, 5), 'Analisando arquivo')

            # cabecalho/eof: o proprio save regrava normalizado
            with open(input_path, 'rb') as f:
                head = f.read(1024)
                f.seek(max(0, original_size - 4096))
                tail = f.read()
            if re.search(br'%PDF-(\d+\.\d+)', head) \
                    and not head.startswith(b'%PDF-'):
                repaired.append({
                    'category': 'cabecalho', 'ref': 'arquivo',
                    'detail': 'cabeçalho %PDF- reposicionado pelo salvamento',
                })
                issues_before['cabecalho'] = 1
            if b'%%EOF' not in tail:
                repaired.append({
                    'category': 'eof', 'ref': 'arquivo',
                    'detail': 'marcador %%EOF reescrito pelo salvamento',
                })
                issues_before['eof'] = 1
            try:
                with fitz.open(str(input_path)) as d0:
                    if d0.is_repaired:
                        repaired.append({
                            'category': 'estrutura', 'ref': 'arquivo',
                            'detail': 'xref reconstruído pelo salvamento',
                        })
                        issues_before['estrutura'] = 1
            except Exception:
                pass

            # paginas (5-10)
            _report_span(1, 1, (5, 10), 'Reparando páginas')
            page_msgs = _fix_pages(pdf)
            if page_msgs:
                issues_before['paginas'] = len(page_msgs)
            for msg in page_msgs:
                repaired.append({'category': 'paginas', 'ref': 'página(s)',
                                 'detail': msg})

            # fluxos (10-25): conteudo ilegivel -> stream vazio
            stream_fails = _scan_content_streams(pdf,
                                                  progress_span=(10, 25))
            if stream_fails:
                issues_before['fluxos'] = len(stream_fails)
            for i, _err in stream_fails:
                pdf.pages[i - 1].obj['/Contents'] = pikepdf.Stream(
                    pdf, b'q Q\n')
                repaired.append({
                    'category': 'fluxos', 'ref': f'pág. {i}',
                    'detail': 'conteúdo ilegível substituído '
                              '(página em branco)',
                })

            # imagens (25-50): detecta e corrige no mesmo passe
            img_fixed, img_failed = _fix_images(
                pdf, progress_span=(25, 50), pdf_path=str(input_path))
            if img_fixed or img_failed:
                issues_before['imagens'] = len(img_fixed) + len(img_failed)
            for e in img_fixed:
                repaired.append({'category': 'imagens', **e})
            unrepaired.extend(img_failed)

            # fontes (50-55)
            _report_span(1, 1, (50, 55), 'Reparando fontes')
            font_fixed, font_failed = _fix_fonts(pdf)
            if font_fixed or font_failed:
                issues_before['fontes'] = len(font_fixed) + len(font_failed)
            for e in font_fixed:
                repaired.append({'category': 'fontes', **e})
            unrepaired.extend(font_failed)

            # cores (55-70)
            scan = _scan_colors(pdf, collect_templates=True,
                                progress_span=(55, 70))
            templates = scan['templates']
            problems = scan['problems']
            if problems:
                issues_before['cores'] = len(problems)

            # O scan conta por REFERENCIA (150 ocorrencias no arquivo
            # real), mas cada objeto so precisa ser mutado uma vez.
            occ_by_og = {}
            for p in problems:
                if p['kind'] == 'tint' and p['arr'] is not None:
                    try:
                        og = p['arr'].objgen
                    except Exception:
                        og = None
                    if og and og != (0, 0):
                        occ_by_og[og] = occ_by_og.get(og, 0) + 1

            processed = set()
            for idx, p in enumerate(problems, 1):
                _report_span(idx, len(problems), (55, 70),
                             'Reparando cores')
                base = {'category': 'cores', 'ref': p['ref'],
                        'detail': p['msg']}

                # (b) shading: reajusta a função para o nº de colorantes
                if p['kind'] == 'shading':
                    sh = p.get('shading')
                    fn = p.get('fn')
                    n = p.get('colorants')
                    if sh is None or fn is None or not n:
                        unrepaired.append({
                            **base,
                            'reason': 'shading sem referências reparáveis',
                        })
                        continue
                    resized = _resize_function(pdf, fn, n)
                    if resized is None:
                        unrepaired.append({
                            **base,
                            'reason': 'função do shading não é ajustável '
                                      'com segurança',
                        })
                        continue
                    sh['/Function'] = resized
                    repaired.append({
                        **base,
                        'detail': f'função do shading reajustada para '
                                  f'{n} saída(s)',
                    })
                    continue

                # (c) stitch: reajusta as subsfunções
                if p['kind'] == 'stitch':
                    d = p.get('fn_dict')
                    target = p.get('target')
                    if d is None or not target:
                        unrepaired.append({
                            **base,
                            'reason': 'stitch sem alvo de saídas '
                                      'determinável',
                        })
                        continue
                    if _fix_stitch_inplace(d, target, pdf):
                        repaired.append({
                            **base,
                            'detail': f'subsfunções reajustadas para '
                                      f'{target} saída(s)',
                        })
                    else:
                        unrepaired.append({
                            **base,
                            'reason': 'subsfunção não ajustável com '
                                      'segurança',
                        })
                    continue

                # (a) tint transform
                arr = p['arr']
                names = p['names']
                try:
                    og = arr.objgen
                except Exception:
                    og = None
                if og and og != (0, 0):
                    if og in processed:
                        continue  # mesmo objeto visto em outra referencia
                    processed.add(og)
                occurrences = occ_by_og.get(og, 1) if og else 1
                alt = str(arr[2]) if len(arr) > 2 else ''
                template = templates.get(names)

                # 1) template do documento: só se a transformação dele
                #    produzir o nº de componentes do alternado atual.
                if template is not None and template is not arr:
                    want = _colorspace_components(arr[2])
                    got = _func_output_count(template[3])
                    if want is not None and got == want:
                        arr[3] = template[3]
                        if len(template) > 4:
                            if len(arr) > 4:
                                arr[4] = template[4]
                            else:
                                arr.append(template[4])
                        repaired.append({
                            **base,
                            'colorants': list(names),
                            'strategy': 'template',
                            'occurrences': occurrences,
                        })
                        continue

                # 2) fallback: colorantes de processo + alternado conhecido
                if (names and all(x in _PROCESS_TINTS for x in names)
                        and alt in ('/DeviceCMYK', '/DeviceRGB')):
                    fn = _make_type4_function(pdf, names, alt)
                    if fn is not None:
                        arr[3] = fn
                        repaired.append({
                            **base,
                            'colorants': list(names),
                            'strategy': ('identity'
                                         if alt == '/DeviceCMYK'
                                         else 'cmyk2rgb'),
                            'occurrences': occurrences,
                        })
                        continue

                # 3) sem correção segura: não altera nada
                unrepaired.append({
                    **base,
                    'colorants': list(names) if names else None,
                    'occurrences': occurrences,
                    'reason': f'sem template compatível; alternado '
                              f'{alt or "desconhecido"} e colorantes fora '
                              f'das tintas de processo',
                })

            # gravacao (70-80): o save regrava cabecalho/eof/xref
            _report_span(1, 1, (70, 80), 'Gravando arquivo reparado')
            pdf.save(str(output_path))

    # ---------- revalidacao comum (80-100) ----------
    validation = validate_pdf(str(output_path), progress_span=(80, 100))

    # Residuais: o que continuou em error apos o reparo e ainda nao foi
    # reportado vira unrepaired — o relatorio sempre reflete a realidade.
    reported = {u['category'] for u in unrepaired}
    for c in validation['checks']:
        if c['status'] == 'error' and c['id'] not in reported:
            unrepaired.append({
                'category': c['id'],
                'ref': 'validação',
                'reason': 'continua com erro após o reparo: '
                          + c['detail'][:150],
            })
            reported.add(c['id'])

    return {
        'output_path': str(output_path),
        'original_size': original_size,
        'output_size': output_path.stat().st_size,
        'color_issues_before': issues_before.get('cores', 0),
        'issues_before': issues_before,
        'repaired_count': len(repaired),
        'repaired': repaired[:100],
        'unrepaired_count': len(unrepaired),
        'unrepaired': unrepaired[:100],
        'validation': validation,
    }


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
            # Nunca devolver a senha: o job e a resposta ficam em log/memória.
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