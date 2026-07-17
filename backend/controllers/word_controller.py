from models.word_processor import convert_docx_to_pdf, extract_text_from_docx

class WordController:
    def convert_to_pdf(self, docx_path, output_path=None):
        return convert_docx_to_pdf(docx_path, output_path)

    def extract_text(self, docx_path):
        return extract_text_from_docx(docx_path)