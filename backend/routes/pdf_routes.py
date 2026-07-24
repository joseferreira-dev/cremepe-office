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

@pdf_bp.route('/merge-by-size', methods=['POST'])
def merge_by_size():
    data = request.json
    required = ['source_dir', 'dest_dir', 'max_size_mb']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.merge_by_size(
            source_dir=data['source_dir'],
            dest_dir=data['dest_dir'],
            max_size_mb=float(data['max_size_mb']),
            recursive=data.get('recursive', False),
            sort_by=data.get('sort_by', 'name'),
            prefix=data.get('prefix', '')
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500