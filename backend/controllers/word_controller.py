from typing import List, Optional
from models.word_processor import merge_documents, convert_document, compare_documents

class WordController:
    def merge_documents(self, docx_paths: List[str], output_path: str, insert_page_breaks: bool = True) -> str:
        return merge_documents(docx_paths, output_path, insert_page_breaks)

    def convert_document(self, input_path: str, output_path: str, output_format: str) -> str:
        return convert_document(input_path, output_path, output_format)

    def compare_documents(self, doc1_path: str, doc2_path: str) -> dict:
        from models.word_processor import compare_documents as compare
        return compare(doc1_path, doc2_path)