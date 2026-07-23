from models.excel_processor import (
    batch_convert,
    extract_cells_from_directory,
    merge_all_files,
    split_by_column,
    split_sheets_to_files
)

class ExcelController:
    def convert_batch(self, source_dir, dest_dir, input_format, output_format,
                      recursive=False, overwrite=False):
        return batch_convert(source_dir, dest_dir, input_format, output_format,
                             recursive, overwrite)
    
    def merge_all(self, source_dir, dest_file, mode='sheets', include_header=True, recursive=False):
        return merge_all_files(source_dir, dest_file, mode, include_header, recursive)

    def extract_cells(self, source_dir, fields, recursive=False, output_file=None):
        return extract_cells_from_directory(source_dir, fields, recursive, output_file)
    
    def split_by_column(self, input_file, output_dir, column, output_format='xlsx', include_header=True):
        return split_by_column(input_file, output_dir, column, output_format, include_header)
    
    def split_sheets(self, input_file, output_dir, output_format='xlsx'):
        return split_sheets_to_files(input_file, output_dir, output_format)