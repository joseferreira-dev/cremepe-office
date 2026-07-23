from flask import Blueprint, request, jsonify
from controllers.excel_controller import ExcelController

excel_bp = Blueprint('excel', __name__)
controller = ExcelController()

@excel_bp.route('/convert-batch', methods=['POST'])
def convert_batch():
    data = request.json
    required = ['source_dir', 'dest_dir', 'input_format', 'output_format']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.convert_batch(
            source_dir=data['source_dir'],
            dest_dir=data['dest_dir'],
            input_format=data['input_format'].lower(),
            output_format=data['output_format'].lower(),
            recursive=data.get('recursive', False),
            overwrite=data.get('overwrite', False)
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500