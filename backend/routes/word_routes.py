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
        return jsonify({"error": str(e)}), 500

@word_bp.route('/convert', methods=['POST'])
def convert_document():
    data = request.json
    if not data.get('input_path') or not data.get('output_path') or not data.get('output_format'):
        return jsonify({"error": "Campos obrigatórios: input_path, output_path, output_format"}), 400
    try:
        result = controller.convert_document(
            input_path=data['input_path'],
            output_path=data['output_path'],
            output_format=data['output_format']
        )
        return jsonify({"success": True, "output_path": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@word_bp.route('/compare', methods=['POST'])
def compare_documents():
    data = request.json
    if not data.get('doc1_path') or not data.get('doc2_path'):
        return jsonify({"error": "Campos obrigatórios: doc1_path, doc2_path"}), 400
    try:
        result = controller.compare_documents(
            doc1_path=data['doc1_path'],
            doc2_path=data['doc2_path']
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500