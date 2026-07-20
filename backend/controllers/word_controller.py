from typing import List
from models.word_processor import merge_documents

class WordController:
    def merge_documents(self, docx_paths: List[str], output_path: str, insert_page_breaks: bool = True) -> str:
        return merge_documents(docx_paths, output_path, insert_page_breaks)