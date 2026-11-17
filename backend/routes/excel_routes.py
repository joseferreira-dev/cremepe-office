from flask import Blueprint, jsonify
from controllers.excel_controller import ExcelController
from utils.validation import require
from utils.job_routes import as_job

excel_bp = Blueprint('excel', __name__)
controller = ExcelController()

@excel_bp.route('/convert-batch', methods=['POST'])
@require('source_dir', 'dest_dir', 'input_format', 'output_format')
@as_job()
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
@as_job()
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
@as_job()
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
@as_job()
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
@as_job()
def split_sheets(data):
    result = controller.split_sheets(
        input_file=data['input_file'],
        output_dir=data['output_dir'],
        output_format=data.get('output_format', 'xlsx')
    )
    return jsonify({"success": True, **result}), 200

# Leitura rapida (sync, sem job): preview de cabecalhos para o botao
# "Visualizar colunas" da feature dividir-por-coluna.
@excel_bp.route('/read', methods=['POST'])
@require('file_path')
def read_excel(data):
    result = controller.read(
        file_path=data['file_path'],
        max_rows=data.get('max_rows', 50)
    )
    return jsonify({"success": True, **result}), 200
