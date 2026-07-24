from flask import Blueprint, request, jsonify
from controllers.pdf_controller import PDFController

pdf_bp = Blueprint('pdf', __name__)
controller = PDFController()

@pdf_bp.route('/merge', methods=['POST'])
def merge():
    data = request.json
    if not data.get('pdf_paths') or not data.get('output_path'):
        return jsonify({"error": "Campos obrigatórios: pdf_paths, output_path"}), 400
    try:
        result = controller.merge(data['pdf_paths'], data['output_path'])
        return jsonify({"success": True, "output_path": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500