import os
from pathlib import Path
from PyPDF2 import PdfReader, PdfWriter

def merge_pdfs(pdf_paths, output_path):
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

def split_pdf(pdf_path, output_dir, pages_per_file=1):
    """
    Divide um PDF em múltiplos arquivos, cada um com `pages_per_file` páginas.
    Retorna lista de caminhos gerados.
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)
    output_files = []

    for start in range(0, total_pages, pages_per_file):
        writer = PdfWriter()
        end = min(start + pages_per_file, total_pages)
        for i in range(start, end):
            writer.add_page(reader.pages[i])
        out_name = f"{pdf_path.stem}_part_{start//pages_per_file + 1}.pdf"
        out_path = output_dir / out_name
        with open(out_path, 'wb') as f:
            writer.write(f)
        output_files.append(str(out_path))
    
    return output_files