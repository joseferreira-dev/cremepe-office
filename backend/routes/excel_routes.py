from flask import Blueprint, jsonify
from controllers.excel_controller import ExcelController
from utils.validation import require

excel_bp = Blueprint('excel', __name__)
controller = ExcelController()

@excel_bp.route('/convert-batch', methods=['POST'])
@require('source_dir', 'dest_dir', 'input_format', 'output_format')
def convert_batch(data):
    result = controller.convert_batch(
        source_dir=data['source_dir'],
        dest_dir=data['dest_dir'],
        input_format=data['input_format'].lower(),
        output_format=data['output_format'].lower(),
        recursive=data.get('recursive', False),
        overwrite=data.get('overwrite', False)
    )
    return jsonify({"success": True, **result}), 200
    
@excel_bp.route('/merge-all', methods=['POST'])
@require('source_dir', 'dest_file')
def merge_all(data):
    result = controller.merge_all(
        source_dir=data['source_dir'],
        dest_file=data['dest_file'],
        mode=data.get('mode', 'sheets'),
        include_header=data.get('include_header', True),
        recursive=data.get('recursive', False)
    )
    return jsonify({"success": True, **result}), 200
    
@excel_bp.route('/extract-cells', methods=['POST'])
@require('source_dir')
def extract_cells(data):
    if not data.get('fields') or not isinstance(data['fields'], list):
        return jsonify({"error": "Campo 'fields' deve ser uma lista"}), 400

    result = controller.extract_cells(
        source_dir=data['source_dir'],
        fields=data['fields'],
        recursive=data.get('recursive', False),
        output_file=data.get('output_file')
    )
    return jsonify({"success": True, **result}), 200
    
@excel_bp.route('/split-by-column', methods=['POST'])
@require('input_file', 'output_dir', 'column')
def split_by_column(data):
    result = controller.split_by_column(
        input_file=data['input_file'],
        output_dir=data['output_dir'],
        column=data['column'],
        output_format=data.get('output_format', 'xlsx'),
        include_header=data.get('include_header', True)
    )
    return jsonify({"success": True, **result}), 200
    
@excel_bp.route('/split-sheets', methods=['POST'])
@require('input_file', 'output_dir')
def split_sheets(data):
    result = controller.split_sheets(
        input_file=data['input_file'],
        output_dir=data['output_dir'],
        output_format=data.get('output_format', 'xlsx')
    )
    return jsonify({"success": True, **result}), 200
