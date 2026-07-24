from models.pdf_processor import merge_pdfs

class PDFController:
    def merge(self, pdf_paths, output_path):
        return merge_pdfs(pdf_paths, output_path)