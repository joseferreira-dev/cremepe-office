from models.excel_processor import (
    batch_convert,
    extract_cells,
    merge_all_files
)

class ExcelController:
    def convert_batch(self, source_dir, dest_dir, input_format, output_format,
                      recursive=False, overwrite=False):
        return batch_convert(source_dir, dest_dir, input_format, output_format,
                             recursive, overwrite)
    
    def merge_all(self, source_dir, dest_file, mode='sheets', include_header=True, recursive=False):
        return merge_all_files(source_dir, dest_file, mode, include_header, recursive)
    
    def extract_cells(self, source_dir, output_csv, cell_mappings, recursive=False):
        return extract_cells(source_dir, output_csv, cell_mappings, recursive)