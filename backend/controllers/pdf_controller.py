from models.pdf_processor import merge, merge_by_size, split_custom, split_fixed

class PDFController:
    def merge(self, pdf_paths, output_path):
        return merge(pdf_paths, output_path)
    
    def merge_by_size(self, source_dir, dest_dir, max_size_mb, recursive=False, sort_by='name', prefix=''):
        return merge_by_size(source_dir, dest_dir, max_size_mb, recursive, sort_by, prefix)
    
    def split_custom(self, pdf_path, output_dir, intervals_str, combine=False, part_prefix="part", combine_name="combined"):
        return split_custom(pdf_path, output_dir, intervals_str, combine, part_prefix, combine_name)

    def split_fixed(self, pdf_path, output_dir, pages_per_file, combine=False, part_prefix="part", combine_name="combined"):
        return split_fixed(pdf_path, output_dir, pages_per_file, combine, part_prefix, combine_name)