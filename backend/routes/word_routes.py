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

@word_bp.route('/extract-images', methods=['POST'])
def extract_images():
    data = request.json
    if not data.get('input_path') or not data.get('output_dir'):
        return jsonify({"error": "Campos obrigatórios: input_path, output_dir"}), 400
    try:
        prefix = data.get('prefix')
        result = controller.extract_images(
            input_path=data['input_path'],
            output_dir=data['output_dir'],
            prefix=prefix
        )
        return jsonify({"success": True, "images": result, "count": len(result)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@word_bp.route('/watermark', methods=['POST'])
def add_watermark():
    data = request.json
    if not data.get('input_path') or not data.get('output_path'):
        return jsonify({"error": "Campos obrigatórios: input_path, output_path"}), 400
    try:
        result = controller.add_watermark(
            input_path=data['input_path'],
            output_path=data['output_path'],
            content_type=data.get('content_type', 'text'),
            text=data.get('text'),
            image_path=data.get('image_path'),
            position=data.get('position', 'center'),
            width_cm=data.get('width_cm', 5.0),
            height_cm=data.get('height_cm', 5.0),
            transparency=data.get('transparency', 0.5),
            margin_left_cm=data.get('margin_left_cm', 0.0),
            margin_top_cm=data.get('margin_top_cm', 0.0)
        )
        return jsonify({"success": True, "output_path": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@word_bp.route('/watermark/preview', methods=['POST'])
def preview_watermark():
    data = request.json
    try:
        result = controller.preview_watermark_position(
            page_width_cm=data.get('page_width_cm', 21.0),
            page_height_cm=data.get('page_height_cm', 29.7),
            position=data.get('position', 'center'),
            width_cm=data.get('width_cm', 5.0),
            height_cm=data.get('height_cm', 5.0),
            margin_left_cm=data.get('margin_left_cm', 0.0),
            margin_top_cm=data.get('margin_top_cm', 0.0)
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@word_bp.route('/filepath', methods=['POST'])
def insert_file_path():
    data = request.json
    if not data.get('input_path') or not data.get('output_path'):
        return jsonify({"error": "Campos obrigatórios: input_path, output_path"}), 400
    try:
        result = controller.insert_file_path(
            input_path=data['input_path'],
            output_path=data['output_path'],
            position=data.get('position', 'right'),
            margin_cm=data.get('margin_cm', 1.0),
            font_size=data.get('font_size', 12),
            color=data.get('color', '#000000'),
            bold=data.get('bold', False),
            italic=data.get('italic', False),
            transparency=data.get('transparency', 0.5),
            use_full_path=data.get('use_full_path', True)
        )
        return jsonify({"success": True, "output_path": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500