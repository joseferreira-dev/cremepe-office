from models.pdf_processor import (
    compress,
    convert_images_to_pdf,
    convert_pdf_to_images,
    convert_pdf_to_word,
    extract_all_pages,
    extract_selected_pages,
    merge, merge_by_size,
    protect_password,
    remove_pages,
    remove_password,
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

    def convert_to_word(self, pdf_path, output_path):
        return convert_pdf_to_word(pdf_path, output_path)

    def convert_images_to_pdf(self, image_paths, output_path, combine=True, margin_cm=0.5,
                            orientation='portrait', resize_mode='cover', naming='prefix',
                            prefix='image'):
        return convert_images_to_pdf(
            image_paths, output_path, combine, margin_cm,
            orientation, resize_mode, naming, prefix
        )

    def convert_pdf_to_images(self, pdf_paths, output_dir, pages_selection='all', image_format='png', prefix=''):
        return convert_pdf_to_images(pdf_paths, output_dir, pages_selection, image_format, prefix)

    def compress(self, input_path, output_path, compression_level='medium', 
                    jpeg_quality=85, remove_metadata=False, downscale_images=True):
        return compress(input_path, output_path, compression_level, jpeg_quality, remove_metadata, downscale_images)

    def protect_password(self, input_path, output_path, password):
        return protect_password(input_path, output_path, password)

    def remove_password(self, input_path, output_path, password):
        return remove_password(input_path, output_path, password)