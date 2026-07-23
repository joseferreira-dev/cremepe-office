import os
import re
import time
import tempfile
import difflib
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import pythoncom
import win32com.client
from docx import Document
from docxcompose.composer import Composer

# ==================== CONVERSÃO .doc -> .docx ====================
def convert_doc_to_docx(doc_path: Path) -> Path:
    """Converte .doc para .docx usando Word COM."""
    if not doc_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {doc_path}")
    temp_dir = Path(tempfile.gettempdir())
    docx_path = temp_dir / f"{doc_path.stem}_converted.docx"
    pythoncom.CoInitialize()
    word = None
    try:
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        word.DisplayAlerts = False
        doc = word.Documents.Open(str(doc_path))
        doc.SaveAs(str(docx_path), FileFormat=16)  # wdFormatDocumentDefault
        doc.Close(SaveChanges=False)
    except Exception as e:
        raise RuntimeError(f"Erro ao converter .doc para .docx: {str(e)}")
    finally:
        if word:
            word.Quit()
        pythoncom.CoUninitialize()
    return docx_path

# ==================== MERGE ====================
def merge_documents(docx_paths: List[str], output_path: str, insert_page_breaks: bool = True) -> str:
    """Junta documentos usando docxcompose."""
    if not docx_paths:
        raise ValueError("Lista de documentos vazia")
    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_files = []
    docx_files = []
    try:
        for path in docx_paths:
            src_path = Path(path).resolve()
            if not src_path.exists():
                raise FileNotFoundError(f"Arquivo não encontrado: {src_path}")
            if src_path.suffix.lower() == '.doc':
                docx_temp = convert_doc_to_docx(src_path)
                temp_files.append(docx_temp)
                docx_files.append(str(docx_temp))
            else:
                docx_files.append(str(src_path))
        composer = Composer(docx_files[0])
        for i, doc_path in enumerate(docx_files[1:], start=1):
            composer.append(doc_path, page_break=insert_page_breaks)
        composer.save(str(output_path))
        return str(output_path)
    finally:
        for temp_file in temp_files:
            try:
                if temp_file.exists():
                    temp_file.unlink()
            except:
                pass

# ==================== CONVERSÃO COM WORD (HTML, TXT, DOC, PDF) ====================
def convert_with_word(input_path: Path, output_path: Path, format_code: int) -> None:
    """Converte usando Word COM."""
    pythoncom.CoInitialize()
    word = None
    try:
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        word.DisplayAlerts = False
        doc = word.Documents.Open(str(input_path))
        doc.SaveAs(str(output_path), FileFormat=format_code)
        doc.Close(SaveChanges=False)
    except Exception as e:
        raise RuntimeError(f"Erro na conversão com Word: {str(e)}")
    finally:
        if word:
            word.Quit()
        pythoncom.CoUninitialize()

# ==================== FUNÇÃO PRINCIPAL DE CONVERSÃO ====================
def convert_document(input_path: str, output_path: str, output_format: str) -> str:
    """Converte um documento para o formato especificado."""
    input_path = Path(input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    temp_docx = None
    if input_path.suffix.lower() == '.doc':
        temp_docx = convert_doc_to_docx(input_path)
        input_path = temp_docx

    try:
        format_map = {
            'html': 10,   # wdFormatHTML
            'txt': 2,     # wdFormatText
            'doc': 0,     # wdFormatDocument
            'pdf': 17     # wdFormatPDF
        }
        if output_format not in format_map:
            raise ValueError(f"Formato não suportado: {output_format}")

        convert_with_word(input_path, output_path, format_map[output_format])
        result = str(output_path)

    finally:
        if temp_docx and temp_docx.exists():
            try:
                temp_docx.unlink()
            except:
                pass

    return result

# ==================== COMPARAÇÃO DE DOCUMENTOS ====================
def extract_paragraphs(docx_path: Path) -> List[str]:
    """Extrai texto de cada parágrafo de um documento .docx."""
    doc = Document(docx_path)
    paragraphs = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            paragraphs.append(text)
    return paragraphs

def compare_documents(doc1_path: str, doc2_path: str) -> Dict:
    """Compara dois documentos Word e retorna as diferenças."""
    doc1_path = Path(doc1_path).resolve()
    doc2_path = Path(doc2_path).resolve()

    if not doc1_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {doc1_path}")
    if not doc2_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {doc2_path}")

    temp_doc1 = None
    temp_doc2 = None
    try:
        if doc1_path.suffix.lower() == '.doc':
            temp_doc1 = convert_doc_to_docx(doc1_path)
            doc1_path = temp_doc1
        if doc2_path.suffix.lower() == '.doc':
            temp_doc2 = convert_doc_to_docx(doc2_path)
            doc2_path = temp_doc2

        paragraphs1 = extract_paragraphs(doc1_path)
        paragraphs2 = extract_paragraphs(doc2_path)

        matcher = difflib.SequenceMatcher(None, paragraphs1, paragraphs2)
        differences = []
        added_count = 0
        removed_count = 0
        modified_count = 0

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                continue
            elif tag == 'delete':
                removed = paragraphs1[i1:i2]
                differences.append({
                    'type': 'removed',
                    'text': '\n'.join(removed),
                    'count': len(removed)
                })
                removed_count += len(removed)
            elif tag == 'insert':
                added = paragraphs2[j1:j2]
                differences.append({
                    'type': 'added',
                    'text': '\n'.join(added),
                    'count': len(added)
                })
                added_count += len(added)
            elif tag == 'replace':
                removed = paragraphs1[i1:i2]
                added = paragraphs2[j1:j2]
                differences.append({
                    'type': 'modified',
                    'old_text': '\n'.join(removed),
                    'new_text': '\n'.join(added),
                    'count': max(len(removed), len(added))
                })
                modified_count += max(len(removed), len(added))

        return {
            'differences': differences,
            'summary': {
                'added': added_count,
                'removed': removed_count,
                'modified': modified_count,
                'total_differences': len(differences)
            }
        }
    finally:
        if temp_doc1 and temp_doc1.exists():
            try:
                temp_doc1.unlink()
            except:
                pass
        if temp_doc2 and temp_doc2.exists():
            try:
                temp_doc2.unlink()
            except:
                pass

# ==================== EXTRAIR IMAGENS ====================
def _get_extension_from_content_type(content_type: str) -> str:
    ext_map = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/gif': '.gif',
        'image/bmp': '.bmp',
        'image/tiff': '.tiff',
        'image/webp': '.webp',
        'image/vnd.microsoft.icon': '.ico',
        'image/svg+xml': '.svg'
    }
    return ext_map.get(content_type, '.bin')

def extract_images(input_path: str, output_dir: str, prefix: Optional[str] = None) -> List[str]:
    """Extrai todas as imagens de um documento Word."""
    input_path = Path(input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    temp_docx = None
    if input_path.suffix.lower() == '.doc':
        temp_docx = convert_doc_to_docx(input_path)
        input_path = temp_docx

    try:
        doc = Document(input_path)
        images = []
        counter = 1

        for rel in doc.part.rels.values():
            if "image" in rel.target_ref:
                image_blob = rel.target_part.blob
                content_type = rel.target_part.content_type
                ext = _get_extension_from_content_type(content_type)
                if ext:
                    filename = f"{prefix or input_path.stem}_img_{counter:04d}{ext}"
                    output_path = output_dir / filename
                    with open(output_path, 'wb') as f:
                        f.write(image_blob)
                    images.append(str(output_path))
                    counter += 1

        package = doc.part.package
        for part in package.iter_parts():
            if 'image' in part.content_type:
                image_blob = part.blob
                content_type = part.content_type
                ext = _get_extension_from_content_type(content_type)
                if ext:
                    part_name = part.partname.split('/')[-1]
                    filename = f"{prefix or input_path.stem}_img_{counter:04d}_{part_name}{ext}"
                    output_path = output_dir / filename
                    with open(output_path, 'wb') as f:
                        f.write(image_blob)
                    images.append(str(output_path))
                    counter += 1

        if not images:
            raise ValueError("Nenhuma imagem encontrada no documento.")

        return images
    finally:
        if temp_docx and temp_docx.exists():
            try:
                temp_docx.unlink()
            except:
                pass

# ==================== MARCA D'ÁGUA ====================
def add_watermark(
    input_path: str,
    output_path: str,
    content_type: str,
    text: Optional[str] = None,
    image_path: Optional[str] = None,
    position: str = 'center',
    width_cm: float = 5.0,
    height_cm: float = 5.0,
    transparency: float = 0.5,
    margin_left_cm: float = 0.0,
    margin_top_cm: float = 0.0
) -> str:
    """Insere marca d'água (texto ou imagem) com posição exata relativa à página."""
    input_path = Path(input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    temp_docx = None
    if input_path.suffix.lower() == '.doc':
        temp_docx = convert_doc_to_docx(input_path)
        input_path = temp_docx

    pythoncom.CoInitialize()
    word = None
    try:
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        word.DisplayAlerts = False

        doc = word.Documents.Open(str(input_path))

        page_width = doc.PageSetup.PageWidth
        page_height = doc.PageSetup.PageHeight

        width_pt = width_cm * 28.3464567
        height_pt = height_cm * 28.3464567

        margin_left_pt = margin_left_cm * 28.3464567
        margin_top_pt = margin_top_cm * 28.3464567

        base_positions = {
            'top-left': (0, 0),
            'top-center': ((page_width - width_pt) / 2, 0),
            'top-right': (page_width - width_pt, 0),
            'center-left': (0, (page_height - height_pt) / 2),
            'center': ((page_width - width_pt) / 2, (page_height - height_pt) / 2),
            'center-right': (page_width - width_pt, (page_height - height_pt) / 2),
            'bottom-left': (0, page_height - height_pt),
            'bottom-center': ((page_width - width_pt) / 2, page_height - height_pt),
            'bottom-right': (page_width - width_pt, page_height - height_pt)
        }
        left_base, top_base = base_positions.get(position, (0, 0))
        left = left_base + margin_left_pt
        top = top_base + margin_top_pt

        for section in doc.Sections:
            header = section.Headers(1)
            if content_type == 'text':
                if not text:
                    raise ValueError("Texto obrigatório")
                shape = header.Shapes.AddTextEffect(
                    PresetTextEffect=0,
                    Text=text,
                    FontName="Arial",
                    FontSize=36,
                    FontBold=False,
                    FontItalic=False,
                    Left=left,
                    Top=top
                )
                shape.Width = width_pt
                shape.Height = height_pt
                shape.Fill.Transparency = 1.0 - transparency
                shape.Fill.ForeColor.RGB = 0
                shape.Line.Visible = False
            else:
                if not image_path or not Path(image_path).exists():
                    raise FileNotFoundError(f"Imagem não encontrada: {image_path}")
                shape = header.Shapes.AddPicture(
                    FileName=str(Path(image_path).resolve()),
                    LinkToFile=False,
                    SaveWithDocument=True,
                    Left=left,
                    Top=top,
                    Width=width_pt,
                    Height=height_pt
                )
                shape.Fill.Transparency = 1.0 - transparency

            shape.RelativeHorizontalPosition = 1
            shape.RelativeVerticalPosition = 1
            shape.LockAnchor = True
            shape.ZOrder(3)

        ext = output_path.suffix.lower()
        save_format = 0 if ext == '.doc' else 16
        doc.SaveAs(str(output_path), FileFormat=save_format)
        doc.Close(SaveChanges=False)

        return str(output_path)

    except Exception as e:
        raise RuntimeError(f"Erro ao inserir marca d'água: {str(e)}")
    finally:
        if word:
            word.Quit()
        pythoncom.CoUninitialize()
        if temp_docx and temp_docx.exists():
            try:
                temp_docx.unlink()
            except:
                pass

def preview_watermark_position(
    page_width_cm: float = 21.0,
    page_height_cm: float = 29.7,
    position: str = 'center',
    width_cm: float = 5.0,
    height_cm: float = 5.0,
    margin_left_cm: float = 0.0,
    margin_top_cm: float = 0.0
) -> dict:
    base_positions = {
        'top-left': (0, 0),
        'top-center': ((page_width_cm - width_cm) / 2, 0),
        'top-right': (page_width_cm - width_cm, 0),
        'center-left': (0, (page_height_cm - height_cm) / 2),
        'center': ((page_width_cm - width_cm) / 2, (page_height_cm - height_cm) / 2),
        'center-right': (page_width_cm - width_cm, (page_height_cm - height_cm) / 2),
        'bottom-left': (0, page_height_cm - height_cm),
        'bottom-center': ((page_width_cm - width_cm) / 2, page_height_cm - height_cm),
        'bottom-right': (page_width_cm - width_cm, page_height_cm - height_cm)
    }
    left_base, top_base = base_positions.get(position, (0, 0))
    left = left_base + margin_left_cm
    top = top_base + margin_top_cm

    return {
        'left': left,
        'top': top,
        'width': width_cm,
        'height': height_cm,
        'page_width': page_width_cm,
        'page_height': page_height_cm
    }

# ==================== CAMINHO DO ARQUIVO (CORRIGIDO) ====================
def insert_file_path(
    input_path: str,
    output_path: str,
    position: str = 'right',
    margin_cm: float = 1.0,
    font_size: int = 8,
    color: str = '#000000',
    bold: bool = False,
    italic: bool = False,
    transparency: float = 0.5,
    use_full_path: bool = True
) -> str:
    """
    Insere o caminho do arquivo nas margens do documento Word
    utilizando WordArt.

    Posições suportadas:
        - top
        - bottom
        - left
        - right
    """

    input_path = Path(input_path).resolve()

    if not input_path.exists():
        raise FileNotFoundError(
            f"Arquivo não encontrado: {input_path}"
        )

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    temp_docx = None

    if input_path.suffix.lower() == '.doc':
        temp_docx = convert_doc_to_docx(input_path)
        input_path = temp_docx

    text_to_insert = (
        str(input_path)
        if use_full_path
        else input_path.name
    )

    position = position.lower().strip()

    if position not in (
        'top',
        'bottom',
        'left',
        'right'
    ):
        raise ValueError(
            "Posição inválida. Use: top, bottom, left ou right."
        )

    CM_TO_PT = 28.3464567
    margin_pt = margin_cm * CM_TO_PT

    pythoncom.CoInitialize()

    word = None
    doc = None

    try:

        word = win32com.client.Dispatch(
            "Word.Application"
        )

        word.Visible = False
        word.DisplayAlerts = False

        doc = word.Documents.Open(
            str(input_path)
        )

        page_width = doc.PageSetup.PageWidth
        page_height = doc.PageSetup.PageHeight

        # =====================================================
        # ESTIMATIVA DO TAMANHO DO TEXTO
        # =====================================================

        estimated_width = (
            len(text_to_insert)
            * font_size
            * 0.55
        )

        text_width = max(
            100,
            estimated_width
        )

        text_height = max(
            font_size * 2.0,
            20
        )

        max_text_width = (
            page_width
            - (margin_pt * 2)
        )

        text_width = min(
            text_width,
            max_text_width
        )

        # =====================================================
        # INSERÇÃO APENAS NA ÚLTIMA SEÇÃO (ÚLTIMA PÁGINA)
        # =====================================================

        # Obtém a última seção do documento
        last_section_index = doc.Sections.Count
        last_section = doc.Sections(last_section_index)

        # Usa apenas a última seção (em vez de percorrer todas)
        section = last_section
        header = section.Headers(1)

        # =================================================
        # POSIÇÃO SUPERIOR
        # =================================================

        if position == 'top':

            shape = header.Shapes.AddTextEffect(
                PresetTextEffect=0,
                Text=text_to_insert,
                FontName="Arial",
                FontSize=font_size,
                FontBold=bold,
                FontItalic=italic,
                Left=0,
                Top=0
            )

            shape.RelativeHorizontalPosition = 1
            shape.RelativeVerticalPosition = 1

            shape.Rotation = 0

            shape.Left = (
                page_width
                - shape.Width
            ) / 2

            shape.Top = margin_pt

        # =================================================
        # POSIÇÃO INFERIOR
        # =================================================

        elif position == 'bottom':

            shape = header.Shapes.AddTextEffect(
                PresetTextEffect=0,
                Text=text_to_insert,
                FontName="Arial",
                FontSize=font_size,
                FontBold=bold,
                FontItalic=italic,
                Left=0,
                Top=0
            )

            shape.RelativeHorizontalPosition = 1
            shape.RelativeVerticalPosition = 1

            shape.Rotation = 0

            shape.Left = (
                page_width
                - shape.Width
            ) / 2

            shape.Top = (
                page_height
                - margin_pt
                - shape.Height
            )

        # =================================================
        # POSIÇÃO ESQUERDA
        # =================================================

        elif position == 'left':

            shape = header.Shapes.AddTextEffect(
                PresetTextEffect=0,
                Text=text_to_insert,
                FontName="Arial",
                FontSize=font_size,
                FontBold=bold,
                FontItalic=italic,
                Left=0,
                Top=0
            )

            shape.RelativeHorizontalPosition = 1
            shape.RelativeVerticalPosition = 1

            shape.Rotation = 270

            shape.Left = margin_pt

            shape.Top = (
                page_height
                - shape.Height
            ) / 2

        # =================================================
        # POSIÇÃO DIREITA
        # =================================================

        else:

            shape = header.Shapes.AddTextEffect(
                PresetTextEffect=0,
                Text=text_to_insert,
                FontName="Arial",
                FontSize=font_size,
                FontBold=bold,
                FontItalic=italic,
                Left=0,
                Top=0
            )

            shape.RelativeHorizontalPosition = 1
            shape.RelativeVerticalPosition = 1

            shape.Rotation = 90

            shape.Left = (
                page_width
                - margin_pt
                - shape.Width
            )

            shape.Top = (
                page_height
                - shape.Height
            ) / 2

        # =================================================
        # CONFIGURAÇÕES DO WORDART
        # =================================================

        shape.LockAnchor = True

        shape.LockAspectRatio = False

        # =================================================
        # COR DO TEXTO
        # =================================================

        try:

            hex_color = color.replace(
                '#',
                ''
            )

            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)

            rgb = (
                r
                + (g << 8)
                + (b << 16)
            )

            shape.Fill.ForeColor.RGB = rgb

            shape.Fill.Visible = True

            shape.Line.Visible = False

        except Exception:

            shape.Fill.ForeColor.RGB = (
                128
                + (128 << 8)
                + (128 << 16)
            )

            shape.Fill.Visible = True

            shape.Line.Visible = False

        # =================================================
        # CAMADA
        # =================================================

        shape.ZOrder(3)

        # =====================================================
        # SALVAMENTO
        # =====================================================

        ext = output_path.suffix.lower()

        save_format = (
            0
            if ext == '.doc'
            else 16
        )

        doc.SaveAs(
            str(output_path),
            FileFormat=save_format
        )

        doc.Close(
            SaveChanges=False
        )

        doc = None

        return str(output_path)

    except Exception as e:

        raise RuntimeError(
            f"Erro ao inserir caminho do arquivo: {str(e)}"
        )

    finally:

        if doc is not None:

            try:

                doc.Close(
                    SaveChanges=False
                )

            except Exception:

                pass

        if word:

            try:

                word.Quit()

            except Exception:

                pass

        pythoncom.CoUninitialize()

        if temp_docx and temp_docx.exists():

            try:

                temp_docx.unlink()

            except Exception:

                pass