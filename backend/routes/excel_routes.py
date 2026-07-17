from flask import Blueprint, request, jsonify
from controllers.excel_controller import ExcelController

excel_bp = Blueprint('excel', __name__)
controller = ExcelController()

@excel_bp.route('/merge', methods=['POST'])
def merge():
    data = request.json
    if not data.get('file_paths') or not data.get('output_path'):
        return jsonify({"error": "Campos obrigatórios: file_paths, output_path"}), 400
    try:
        result = controller.merge(data['file_paths'], data['output_path'])
        return jsonify({"success": True, "output_path": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@excel_bp.route('/read', methods=['POST'])
def read():
    data = request.json
    if not data.get('file_path'):
        return jsonify({"error": "Campo obrigatório: file_path"}), 400
    try:
        sheet = data.get('sheet_name', 0)
        result = controller.read_sheet(data['file_path'], sheet)
        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@excel_bp.route('/write', methods=['POST'])
def write():
    data = request.json
    if not data.get('file_path') or not data.get('data'):
        return jsonify({"error": "Campos obrigatórios: file_path, data"}), 400
    try:
        sheet = data.get('sheet_name', 'Sheet1')
        result = controller.write_data(data['file_path'], data['data'], sheet)
        return jsonify({"success": True, "output_path": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500