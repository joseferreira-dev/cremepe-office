from flask import Blueprint, request, jsonify
from controllers.word_controller import WordController

word_bp = Blueprint('word', __name__)
controller = WordController()

@word_bp.route('/convert-to-pdf', methods=['POST'])
def convert_to_pdf():
    data = request.json
    if not data.get('docx_path'):
        return jsonify({"error": "Campo obrigatório: docx_path"}), 400
    try:
        output = data.get('output_path')
        result = controller.convert_to_pdf(data['docx_path'], output)
        return jsonify({"success": True, "output_path": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@word_bp.route('/extract-text', methods=['POST'])
def extract_text():
    data = request.json
    if not data.get('docx_path'):
        return jsonify({"error": "Campo obrigatório: docx_path"}), 400
    try:
        result = controller.extract_text(data['docx_path'])
        return jsonify({"success": True, "text": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500