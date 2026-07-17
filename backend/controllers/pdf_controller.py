from models.pdf_processor import merge_pdfs, split_pdf

class PDFController:
    def merge(self, pdf_paths, output_path):
        return merge_pdfs(pdf_paths, output_path)

    def split(self, pdf_path, output_dir, pages_per_file=1):
        return split_pdf(pdf_path, output_dir, pages_per_file)