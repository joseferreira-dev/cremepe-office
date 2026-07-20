from typing import List, Optional
from models.word_processor import merge_documents, convert_document

class WordController:
    def merge_documents(self, docx_paths: List[str], output_path: str, insert_page_breaks: bool = True) -> str:
        return merge_documents(docx_paths, output_path, insert_page_breaks)

    def convert_document(self, input_path: str, output_path: str, output_format: str) -> str:
        return convert_document(input_path, output_path, output_format)