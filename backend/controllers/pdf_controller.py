from models.pdf_processor import merge, merge_by_size

class PDFController:
    def merge(self, pdf_paths, output_path):
        return merge(pdf_paths, output_path)
    
    def merge_by_size(self, source_dir, dest_dir, max_size_mb, recursive=False, sort_by='name', prefix=''):
        return merge_by_size(source_dir, dest_dir, max_size_mb, recursive, sort_by, prefix)