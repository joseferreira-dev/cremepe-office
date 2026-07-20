import tempfile
from pathlib import Path
from typing import List
import pythoncom
import win32com.client
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
    """
    Converte um documento para o formato especificado.
    output_format: 'html', 'txt', 'doc', 'pdf'
    """
    input_path = Path(input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Converte .doc para .docx temporário se necessário
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