from flask import Blueprint, request, jsonify
from controllers.word_controller import WordController

word_bp = Blueprint('word', __name__)
controller = WordController()

@word_bp.route('/merge', methods=['POST'])
def merge_documents():
    data = request.json
    if not data.get('docx_paths') or not data.get('output_path'):
        return jsonify({"error": "Campos obrigatórios: docx_paths, output_path"}), 400
    try:
        insert_page_breaks = data.get('insert_page_breaks', True)
        result = controller.merge_documents(
            docx_paths=data['docx_paths'],
            output_path=data['output_path'],
            insert_page_breaks=insert_page_breaks
        )
        return jsonify({"success": True, "output_path": result}), 200
    except Exception as e:
        print(f"Erro no merge: {e}")
        return jsonify({"error": str(e)}), 500