# Funções auxiliares para PDF (ex: contagem de páginas, validação)
def get_pdf_page_count(pdf_path):
    from PyPDF2 import PdfReader
    reader = PdfReader(pdf_path)
    return len(reader.pages)