from models.excel_processor import merge_excel_files, read_excel_sheet, write_excel_file

class ExcelController:
    def merge(self, file_paths, output_path):
        return merge_excel_files(file_paths, output_path)

    def read_sheet(self, file_path, sheet_name=0):
        return read_excel_sheet(file_path, sheet_name)

    def write_data(self, file_path, data, sheet_name='Sheet1'):
        return write_excel_file(file_path, data, sheet_name)