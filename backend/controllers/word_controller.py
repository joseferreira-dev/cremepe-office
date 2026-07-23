from typing import List, Optional
from models.word_processor import (
    merge_documents,
    convert_document,
    compare_documents,
    extract_images,
    add_watermark,
    preview_watermark_position,
    insert_file_path
)

class WordController:
    def merge_documents(self, docx_paths: List[str], output_path: str, insert_page_breaks: bool = True) -> str:
        return merge_documents(docx_paths, output_path, insert_page_breaks)

    def convert_document(self, input_path: str, output_path: str, output_format: str) -> str:
        return convert_document(input_path, output_path, output_format)

    def compare_documents(self, doc1_path: str, doc2_path: str) -> dict:
        return compare_documents(doc1_path, doc2_path)

    def extract_images(self, input_path: str, output_dir: str, prefix: Optional[str] = None) -> List[str]:
        return extract_images(input_path, output_dir, prefix)

    def add_watermark(
        self,
        input_path: str,
        output_path: str,
        content_type: str,
        text: Optional[str] = None,
        image_path: Optional[str] = None,
        position: str = 'center',
        width_cm: float = 5.0,
        height_cm: float = 5.0,
        transparency: float = 0.5,
        margin_left_cm: float = 0.0,
        margin_top_cm: float = 0.0
    ) -> str:
        return add_watermark(
            input_path, output_path, content_type, text, image_path,
            position, width_cm, height_cm, transparency,
            margin_left_cm, margin_top_cm
        )

    def preview_watermark_position(
        self,
        page_width_cm: float = 21.0,
        page_height_cm: float = 29.7,
        position: str = 'center',
        width_cm: float = 5.0,
        height_cm: float = 5.0,
        margin_left_cm: float = 0.0,
        margin_top_cm: float = 0.0
    ) -> dict:
        return preview_watermark_position(
            page_width_cm, page_height_cm, position,
            width_cm, height_cm, margin_left_cm, margin_top_cm
        )

    def insert_file_path(
        self,
        input_path: str,
        output_path: str,
        position: str = 'right',
        margin_cm: float = 1.0,
        font_size: int = 12,
        color: str = '#000000',
        bold: bool = False,
        italic: bool = False,
        transparency: float = 0.5,
        use_full_path: bool = True
    ) -> str:
        return insert_file_path(
            input_path, output_path, position, margin_cm,
            font_size, color, bold, italic, transparency, use_full_path
        )