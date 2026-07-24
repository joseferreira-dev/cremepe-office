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

@pdf_bp.route('/split-custom', methods=['POST'])
def split_custom():
    data = request.json
    required = ['pdf_path', 'output_dir', 'intervals_str']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.split_custom(
            pdf_path=data['pdf_path'],
            output_dir=data['output_dir'],
            intervals_str=data['intervals_str'],
            combine=data.get('combine', False),
            part_prefix=data.get('part_prefix', 'part'),
            combine_name=data.get('combine_name', 'combined')
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pdf_bp.route('/split-fixed', methods=['POST'])
def split_fixed():
    data = request.json
    required = ['pdf_path', 'output_dir', 'pages_per_file']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.split_fixed(
            pdf_path=data['pdf_path'],
            output_dir=data['output_dir'],
            pages_per_file=int(data['pages_per_file']),
            combine=data.get('combine', False),
            part_prefix=data.get('part_prefix', 'part'),
            combine_name=data.get('combine_name', 'combined')
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pdf_bp.route('/split-by-size', methods=['POST'])
def split_by_size():
    data = request.json
    required = ['pdf_path', 'output_dir', 'max_size_mb']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.split_by_size(
            pdf_path=data['pdf_path'],
            output_dir=data['output_dir'],
            max_size_mb=float(data['max_size_mb']),
            prefix=data.get('prefix', '')
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pdf_bp.route('/extract-all-pages', methods=['POST'])
def extract_all_pages():
    data = request.json
    required = ['pdf_path', 'output_dir']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.extract_all_pages(
            pdf_path=data['pdf_path'],
            output_dir=data['output_dir'],
            prefix=data.get('prefix', '')
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pdf_bp.route('/extract-selected-pages', methods=['POST'])
def extract_selected_pages():
    data = request.json
    required = ['pdf_path', 'output_dir', 'pages_selection']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.extract_selected_pages(
            pdf_path=data['pdf_path'],
            output_dir=data['output_dir'],
            pages_selection=data['pages_selection'],
            prefix=data.get('prefix', ''),
            combine=data.get('combine', False),
            combine_name=data.get('combine_name')
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pdf_bp.route('/remove-pages', methods=['POST'])
def remove_pages():
    data = request.json
    required = ['pdf_path', 'output_path', 'pages_to_remove_str']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.remove_pages(
            pdf_path=data['pdf_path'],
            output_path=data['output_path'],
            pages_to_remove_str=data['pages_to_remove_str'],
            save_removed=data.get('save_removed', False),
            removed_output_path=data.get('removed_output_path')
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pdf_bp.route('/reorder-pages', methods=['POST'])
def reorder_pages():
    data = request.json
    required = ['pdf_path', 'output_path', 'new_order_str']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.reorder_pages(
            pdf_path=data['pdf_path'],
            output_path=data['output_path'],
            new_order_str=data['new_order_str']
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pdf_bp.route('/convert-to-word', methods=['POST'])
def convert_to_word():
    data = request.json
    required = ['pdf_path', 'output_path']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.convert_to_word(
            pdf_path=data['pdf_path'],
            output_path=data['output_path']
        )
        return jsonify({"success": True, "output_path": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Substitua as duas rotas por estas:

@pdf_bp.route('/convert-images-to-pdf', methods=['POST'])
def images_to_pdf():
    data = request.json
    required = ['image_paths', 'output_path']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.convert_images_to_pdf(
            image_paths=data['image_paths'],
            output_path=data['output_path'],
            combine=data.get('combine', True),
            margin_cm=float(data.get('margin_cm', 0.5)),
            orientation=data.get('orientation', 'portrait'),
            resize_mode=data.get('resize_mode', 'cover'),
            naming=data.get('naming', 'prefix'),
            prefix=data.get('prefix', 'image')
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pdf_bp.route('/convert-pdf-to-images', methods=['POST'])
def pdf_to_images():
    data = request.json
    required = ['pdf_paths', 'output_dir']
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Campo obrigatório: {field}"}), 400

    try:
        result = controller.convert_pdf_to_images(
            pdf_paths=data['pdf_paths'],
            output_dir=data['output_dir'],
            pages_selection=data.get('pages_selection', 'all'),
            image_format=data.get('image_format', 'png'),
            prefix=data.get('prefix', '')
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pdf_bp.route('/compress', methods=['POST'])
def compress():
    data = request.json
    if not data.get('input_path') or not data.get('output_path'):
        return jsonify({"error": "Campos obrigatórios: input_path, output_path"}), 400

    compression_level = data.get('compression_level', 'medium')
    if compression_level not in ('low', 'medium', 'high'):
        return jsonify({"error": "Nível de compressão inválido. Use 'low', 'medium' ou 'high'"}), 400

    jpeg_quality = int(data.get('jpeg_quality', 85))
    if jpeg_quality < 1 or jpeg_quality > 100:
        return jsonify({"error": "Qualidade JPEG deve estar entre 1 e 100"}), 400

    remove_metadata = data.get('remove_metadata', False)
    downscale_images = data.get('downscale_images', True)

    try:
        result = controller.compress(
            input_path=data['input_path'],
            output_path=data['output_path'],
            compression_level=compression_level,
            jpeg_quality=jpeg_quality,
            remove_metadata=remove_metadata,
            downscale_images=downscale_images
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pdf_bp.route('/protect-password', methods=['POST'])
def protect_password():
    data = request.json
    if not data.get('input_path') or not data.get('output_path') or not data.get('password'):
        return jsonify({"error": "Campos obrigatórios: input_path, output_path, password"}), 400

    try:
        result = controller.protect_password(
            input_path=data['input_path'],
            output_path=data['output_path'],
            password=data['password']
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@pdf_bp.route('/remove-password', methods=['POST'])
def remove_password():
    data = request.json
    if not data.get('input_path') or not data.get('output_path') or not data.get('password'):
        return jsonify({"error": "Campos obrigatórios: input_path, output_path, password"}), 400

    try:
        result = controller.remove_password(
            input_path=data['input_path'],
            output_path=data['output_path'],
            password=data['password']
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500