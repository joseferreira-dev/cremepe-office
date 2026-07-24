from models.pdf_processor import (
    extract_all_pages,
    extract_selected_pages,
    merge, merge_by_size,
    remove_pages,
    reorder_pages,
    split_by_size,
    split_custom,
    split_fixed
)

class PDFController:
    def merge(self, pdf_paths, output_path):
        return merge(pdf_paths, output_path)
    
    def merge_by_size(self, source_dir, dest_dir, max_size_mb, recursive=False, sort_by='name', prefix=''):
        return merge_by_size(source_dir, dest_dir, max_size_mb, recursive, sort_by, prefix)
    
    def split_custom(self, pdf_path, output_dir, intervals_str, combine=False, part_prefix="part", combine_name="combined"):
        return split_custom(pdf_path, output_dir, intervals_str, combine, part_prefix, combine_name)

    def split_fixed(self, pdf_path, output_dir, pages_per_file, combine=False, part_prefix="part", combine_name="combined"):
        return split_fixed(pdf_path, output_dir, pages_per_file, combine, part_prefix, combine_name)
    
    def split_by_size(self, pdf_path, output_dir, max_size_mb, prefix=''):
        return split_by_size(pdf_path, output_dir, max_size_mb, prefix)

    def extract_all_pages(self, pdf_path, output_dir, prefix=''):
        return extract_all_pages(pdf_path, output_dir, prefix)
    
    def extract_selected_pages(self, pdf_path, output_dir, pages_selection, prefix='', combine=False, combine_name=None):
        return extract_selected_pages(pdf_path, output_dir, pages_selection, prefix, combine, combine_name)

    def remove_pages(self, pdf_path, output_path, pages_to_remove_str, save_removed=False, removed_output_path=None):
        return remove_pages(pdf_path, output_path, pages_to_remove_str, save_removed, removed_output_path)

    def reorder_pages(self, pdf_path, output_path, new_order_str):
        return reorder_pages(pdf_path, output_path, new_order_str)