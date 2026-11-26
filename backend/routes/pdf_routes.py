from flask import Blueprint, jsonify
from controllers.pdf_controller import PDFController
from utils.validation import require
from utils.job_routes import as_job

pdf_bp = Blueprint('pdf', __name__)
controller = PDFController()

@pdf_bp.route('/merge', methods=['POST'])
@require('pdf_paths', 'output_path')
@as_job()
def merge(data):
    result = controller.merge(data['pdf_paths'], data['output_path'])
    return jsonify({"success": True, "output_path": result}), 200

@pdf_bp.route('/merge-by-size', methods=['POST'])
@require('source_dir', 'dest_dir', 'max_size_mb')
@as_job()
def merge_by_size(data):
    result = controller.merge_by_size(
        source_dir=data['source_dir'],
        dest_dir=data['dest_dir'],
        max_size_mb=float(data['max_size_mb']),
        recursive=data.get('recursive', False),
        sort_by=data.get('sort_by', 'name'),
        prefix=data.get('prefix', '')
    )
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/split-custom', methods=['POST'])
@require('pdf_path', 'output_dir', 'intervals_str')
@as_job()
def split_custom(data):
    result = controller.split_custom(
        pdf_path=data['pdf_path'],
        output_dir=data['output_dir'],
        intervals_str=data['intervals_str'],
        combine=data.get('combine', False),
        part_prefix=data.get('part_prefix', 'part'),
        combine_name=data.get('combine_name', 'combined')
    )
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/split-fixed', methods=['POST'])
@require('pdf_path', 'output_dir', 'pages_per_file')
@as_job()
def split_fixed(data):
    result = controller.split_fixed(
        pdf_path=data['pdf_path'],
        output_dir=data['output_dir'],
        pages_per_file=int(data['pages_per_file']),
        combine=data.get('combine', False),
        part_prefix=data.get('part_prefix', 'part'),
        combine_name=data.get('combine_name', 'combined')
    )
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/split-by-size', methods=['POST'])
@require('pdf_path', 'output_dir', 'max_size_mb')
@as_job()
def split_by_size(data):
    result = controller.split_by_size(
        pdf_path=data['pdf_path'],
        output_dir=data['output_dir'],
        max_size_mb=float(data['max_size_mb']),
        prefix=data.get('prefix', '')
    )
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/extract-all-pages', methods=['POST'])
@require('pdf_path', 'output_dir')
@as_job()
def extract_all_pages(data):
    result = controller.extract_all_pages(
        pdf_path=data['pdf_path'],
        output_dir=data['output_dir'],
        prefix=data.get('prefix', '')
    )
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/extract-selected-pages', methods=['POST'])
@require('pdf_path', 'output_dir', 'pages_selection')
@as_job()
def extract_selected_pages(data):
    result = controller.extract_selected_pages(
        pdf_path=data['pdf_path'],
        output_dir=data['output_dir'],
        pages_selection=data['pages_selection'],
        prefix=data.get('prefix', ''),
        combine=data.get('combine', False),
        combine_name=data.get('combine_name')
    )
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/remove-pages', methods=['POST'])
@require('pdf_path', 'output_path', 'pages_to_remove_str')
@as_job()
def remove_pages(data):
    result = controller.remove_pages(
        pdf_path=data['pdf_path'],
        output_path=data['output_path'],
        pages_to_remove_str=data['pages_to_remove_str'],
        save_removed=data.get('save_removed', False),
        removed_output_path=data.get('removed_output_path')
    )
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/reorder-pages', methods=['POST'])
@require('pdf_path', 'output_path', 'new_order_str')
@as_job()
def reorder_pages(data):
    result = controller.reorder_pages(
        pdf_path=data['pdf_path'],
        output_path=data['output_path'],
        new_order_str=data['new_order_str']
    )
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/add-page-numbers', methods=['POST'])
@require('input_path', 'output_path')
@as_job()
def add_page_numbers(data):
    end_page = data.get('end_page')
    if end_page is not None:
        end_page = int(end_page)

    result = controller.add_page_numbers(
        input_path=data['input_path'],
        output_path=data['output_path'],
        start_page=int(data.get('start_page', 1)),
        end_page=end_page,
        start_number=int(data.get('start_number', 1)),
        color=data.get('color', '#000000'),
        background_color=data.get('background_color'),
        position=data.get('position', 'bottom-center'),
        font_size=int(data.get('font_size', 12)),
        show_background=data.get('show_background', False),
        margin_cm=float(data.get('margin_cm', 1.0))
    )
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/convert-to-word', methods=['POST'])
@require('pdf_path', 'output_path')
@as_job()
def convert_to_word(data):
    result = controller.convert_to_word(
        pdf_path=data['pdf_path'],
        output_path=data['output_path'],
        pages_selection=data.get('pages_selection', 'all')
    )
    # result pode conter {"warning": ...} (PDF escaneado sem texto)
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/convert-images-to-pdf', methods=['POST'])
@require('image_paths', 'output_path')
@as_job()
def images_to_pdf(data):
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

@pdf_bp.route('/convert-pdf-to-images', methods=['POST'])
@require('pdf_paths', 'output_dir')
@as_job()
def pdf_to_images(data):
    result = controller.convert_pdf_to_images(
        pdf_paths=data['pdf_paths'],
        output_dir=data['output_dir'],
        pages_selection=data.get('pages_selection', 'all'),
        image_format=data.get('image_format', 'png'),
        prefix=data.get('prefix', '')
    )
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/compress', methods=['POST'])
@require('input_path', 'output_path')
@as_job()
def compress(data):
    compression_level = data.get('compression_level', 'medium')
    if compression_level not in ('low', 'medium', 'high'):
        return jsonify({"error": "Nível de compressão inválido. Use 'low', 'medium' ou 'high'"}), 400

    jpeg_quality = int(data.get('jpeg_quality', 85))
    if jpeg_quality < 1 or jpeg_quality > 100:
        return jsonify({"error": "Qualidade JPEG deve estar entre 1 e 100"}), 400

    remove_metadata = data.get('remove_metadata', False)
    downscale_images = data.get('downscale_images', True)

    result = controller.compress(
        input_path=data['input_path'],
        output_path=data['output_path'],
        compression_level=compression_level,
        jpeg_quality=jpeg_quality,
        remove_metadata=remove_metadata,
        downscale_images=downscale_images
    )
    return jsonify({"success": True, **result}), 200

@pdf_bp.route('/protect-password', methods=['POST'])
@require('input_path', 'output_path', 'password')
@as_job()
def protect_password(data):
    result = controller.protect_password(
        input_path=data['input_path'],
        output_path=data['output_path'],
        password=data['password']
    )
    return jsonify({"success": True, **result}), 200


@pdf_bp.route('/remove-password', methods=['POST'])
@require('input_path', 'output_path', 'password')
@as_job()
def remove_password(data):
    result = controller.remove_password(
        input_path=data['input_path'],
        output_path=data['output_path'],
        password=data['password']
    )
    return jsonify({"success": True, **result}), 200


@pdf_bp.route('/validate', methods=['POST'])
@require('pdf_path')
@as_job()
def validate(data):
    result = controller.validate(pdf_path=data['pdf_path'])
    return jsonify({"success": True, **result}), 200


# Leitura rapida (sync, sem job): contagem de paginas para as features
# dividir/extrair/reordenar exibirem a paginacao e validarem intervalos
# antes de disparar um job.
@pdf_bp.route('/info', methods=['POST'])
@require('pdf_path')
def info(data):
    result = controller.info(pdf_path=data['pdf_path'])
    return jsonify({"success": True, **result}), 200


# Reparo de aridade de color spaces (DeviceN/Separation) — job porque o
# varrimento + revalidacao de arquivos grandes pode demorar minutos.
@pdf_bp.route('/repair', methods=['POST'])
@require('input_path', 'output_path')
@as_job()
def repair(data):
    result = controller.repair(
        input_path=data['input_path'],
        output_path=data['output_path'],
    )
    return jsonify({"success": True, **result}), 200


# --- OCR (item10) ---
# Extração de texto: digitalizado via OCR (dois motores comparados),
# nativo via leitura. Job porque roda o OCR em todas as páginas.
@pdf_bp.route('/ocr-text', methods=['POST'])
@require('pdf_path')
@as_job()
def ocr_text(data):
    result = controller.ocr_text(
        pdf_path=data['pdf_path'],
        language=data.get('language', 'por+eng'),
        dpi=int(data.get('dpi', 300)),
        pages=data.get('pages'),
    )
    return jsonify({"success": True, **result}), 200


# PDF pesquisável: cópia com camada de texto invisível sobre a imagem
# (busca/seleção passam a funcionar; a renderização fica idêntica).
@pdf_bp.route('/ocr-searchable', methods=['POST'])
@require('input_path', 'output_path')
@as_job()
def ocr_searchable(data):
    result = controller.ocr_searchable(
        input_path=data['input_path'],
        output_path=data['output_path'],
        language=data.get('language', 'por+eng'),
        dpi=int(data.get('dpi', 300)),
        pages=data.get('pages'),
    )
    return jsonify({"success": True, **result}), 200
