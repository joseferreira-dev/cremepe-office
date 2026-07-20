import os
import tempfile
from pathlib import Path
from typing import List
import pythoncom
import win32com.client
from docx import Document
from docxcompose.composer import Composer

def convert_doc_to_docx(doc_path: Path) -> Path:
    """
    Converte um arquivo .doc para .docx usando Microsoft Word (via COM).
    Retorna o caminho do arquivo .docx temporário.
    """
    if not doc_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {doc_path}")

    # Cria um arquivo temporário .docx
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

def merge_documents(docx_paths: List[str], output_path: str, insert_page_breaks: bool = True) -> str:
    """
    Junta documentos Word (DOC/DOCX) preservando formatação, imagens e estilos.
    Usa docxcompose para mesclagem robusta.
    """
    if not docx_paths:
        raise ValueError("Lista de documentos vazia")

    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    temp_files = []
    docx_files = []

    try:
        # Converte todos os .doc para .docx temporários
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

        # Carrega os documentos
        docs = [Document(doc_path) for doc_path in docx_files]

        # O primeiro documento é a base
        composer = Composer(docs[0])

        # Adiciona os demais documentos
        for i, doc in enumerate(docs[1:], start=1):
            # Adiciona o documento
            composer.append(doc)

            # Se deseja quebra de página, insere uma quebra de página após o documento adicionado
            if insert_page_breaks:
                # Obtém o último parágrafo do documento composto e insere uma quebra de página
                composer.doc.add_page_break()

        # Salva o documento final
        composer.save(str(output_path))

        return str(output_path)

    finally:
        # Limpa arquivos temporários
        for temp_file in temp_files:
            try:
                if temp_file.exists():
                    temp_file.unlink()
            except:
                pass