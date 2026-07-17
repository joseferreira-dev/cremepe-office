import os
from pathlib import Path
from docx import Document
import subprocess
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm

def convert_docx_to_pdf(docx_path, output_path=None):
    """
    Converte um arquivo .docx para PDF.
    Se output_path não for fornecido, salva no mesmo diretório com extensão .pdf.
    """
    docx_path = Path(docx_path)
    if not docx_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {docx_path}")
    
    if output_path is None:
        output_path = docx_path.with_suffix('.pdf')
    else:
        output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = Document(docx_path)
    # Extrai texto de todos os parágrafos
    text = "\n".join([p.text for p in doc.paragraphs])

    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4
    # Configura fonte
    c.setFont("Helvetica", 12)
    # Escreve o texto linha a linha
    y = height - 20
    for line in text.split('\n'):
        if y < 20:
            c.showPage()
            y = height - 20
        c.drawString(20, y, line[:100])  # Limita para não estourar
        y -= 15
    c.save()
    return str(output_path)

def extract_text_from_docx(docx_path):
    """
    Extrai e retorna todo o texto de um arquivo .docx.
    """
    docx_path = Path(docx_path)
    if not docx_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {docx_path}")
    doc = Document(docx_path)
    return "\n".join([p.text for p in doc.paragraphs])