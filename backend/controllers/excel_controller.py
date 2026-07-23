from models.excel_processor import batch_convert

class ExcelController:
    def convert_batch(self, source_dir, dest_dir, input_format, output_format,
                      recursive=False, overwrite=False):
        return batch_convert(source_dir, dest_dir, input_format, output_format,
                             recursive, overwrite)