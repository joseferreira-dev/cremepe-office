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

@pdf_bp.route('/split', methods=['POST'])
def split():
    data = request.json
    if not data.get('pdf_path') or not data.get('output_dir'):
        return jsonify({"error": "Campos obrigatórios: pdf_path, output_dir"}), 400
    try:
        pages_per = data.get('pages_per_file', 1)
        result = controller.split(data['pdf_path'], data['output_dir'], pages_per)
        return jsonify({"success": True, "output_files": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500