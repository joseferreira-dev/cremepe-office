from flask import Blueprint, request, jsonify
from controllers.file_controller import FileController
from datetime import datetime, timedelta
import os

file_bp = Blueprint('file', __name__)
controller = FileController()

@file_bp.route('/preview', methods=['POST'])
def preview_files():
    data = request.json
    if not data.get('src_dirs'):
        return jsonify({"error": "Campo 'src_dirs' (lista) obrigatório"}), 400
    try:
        extensions = data.get('extensions')
        if extensions and isinstance(extensions, str):
            extensions = [e.strip() for e in extensions.split(',') if e.strip()]
        days_back = data.get('days_back')
        if days_back:
            days_back = int(days_back)
        result = controller.preview_files(
            src_dirs=data['src_dirs'],
            recursive=data.get('recursive', True),
            extensions=extensions,
            include_hidden=data.get('include_hidden', False),
            days_back=days_back
        )
        return jsonify({"success": True, "files": result, "count": len(result)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/collect', methods=['POST'])
def collect_files():
    data = request.json
    if not data.get('src_dirs') or not data.get('dst_dir'):
        return jsonify({"error": "Campos obrigatórios: src_dirs (lista), dst_dir"}), 400
    try:
        extensions = data.get('extensions')
        if extensions and isinstance(extensions, str):
            extensions = [e.strip() for e in extensions.split(',') if e.strip()]
        days_back = data.get('days_back')
        if days_back:
            days_back = int(days_back)
        result = controller.collect_files(
            src_dirs=data['src_dirs'],
            dst_dir=data['dst_dir'],
            recursive=data.get('recursive', True),
            overwrite=data.get('overwrite', False),
            delete_empty_dirs=data.get('delete_empty_dirs', False),
            copy=data.get('copy', False),
            preserve_structure=data.get('preserve_structure', False),
            extensions=extensions,
            include_hidden=data.get('include_hidden', False),
            days_back=days_back,
            on_conflict=data.get('on_conflict', 'skip')
        )
        return jsonify({"success": True, "processed_count": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/list', methods=['POST'])
def list_files():
    data = request.json
    if not data.get('dir'):
        return jsonify({"error": "Campo 'dir' obrigatório"}), 400
    dir_path = data['dir']
    try:
        files = [f for f in os.listdir(dir_path) if os.path.isfile(os.path.join(dir_path, f))]
        return jsonify({"success": True, "files": files}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/rename-preview', methods=['POST'])
def rename_preview():
    data = request.json
    if not data.get('file_paths'):
        return jsonify({"error": "Campo 'file_paths' obrigatório"}), 400
    try:
        extensions = data.get('extensions')
        if extensions and isinstance(extensions, str):
            extensions = [e.strip() for e in extensions.split(',') if e.strip()]
        result = controller.preview_rename(
            file_paths=data['file_paths'],
            prefix=data.get('prefix', ''),
            suffix=data.get('suffix', ''),
            start_number=data.get('start_number', 1),
            use_original_name=data.get('use_original_name', False),
            extensions=extensions,
            regex_pattern=data.get('regex_pattern'),
            regex_replacement=data.get('regex_replacement', ''),
            case_conversion=data.get('case_conversion', 'none'),
            remove_accents=data.get('remove_accents', False),
            replace_spaces_with=data.get('replace_spaces_with')
        )
        return jsonify({"success": True, "preview": result, "count": len(result)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/rename', methods=['POST'])
def rename_files():
    data = request.json
    if not data.get('file_paths'):
        return jsonify({"error": "Campo 'file_paths' obrigatório"}), 400
    try:
        extensions = data.get('extensions')
        if extensions and isinstance(extensions, str):
            extensions = [e.strip() for e in extensions.split(',') if e.strip()]
        result = controller.rename_files(
            file_paths=data['file_paths'],
            prefix=data.get('prefix', ''),
            suffix=data.get('suffix', ''),
            start_number=data.get('start_number', 1),
            use_original_name=data.get('use_original_name', False),
            extensions=extensions,
            regex_pattern=data.get('regex_pattern'),
            regex_replacement=data.get('regex_replacement', ''),
            case_conversion=data.get('case_conversion', 'none'),
            remove_accents=data.get('remove_accents', False),
            replace_spaces_with=data.get('replace_spaces_with')
        )
        return jsonify({"success": True, "renamed_count": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@file_bp.route('/duplicates', methods=['POST'])
def find_duplicates():
    data = request.json
    if not data.get('dir'):
        return jsonify({"error": "Campo 'dir' obrigatório"}), 400
    try:
        recursive = data.get('recursive', True)
        match_by = data.get('match_by', 'hash')
        include_hidden = data.get('include_hidden', False)
        groups = controller.find_duplicates(data['dir'], recursive, match_by, include_hidden)
        result = [{'files': group, 'count': len(group)} for group in groups]
        return jsonify({"success": True, "groups": result, "total_groups": len(groups)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/duplicates/remove', methods=['POST'])
def remove_duplicates():
    data = request.json
    if not data.get('groups'):
        return jsonify({"error": "Campo 'groups' obrigatório"}), 400
    try:
        action = data.get('action', 'delete')
        destination = data.get('destination')
        count = controller.remove_duplicates(data['groups'], action, destination)
        return jsonify({"success": True, "removed_count": count}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@file_bp.route('/organize/preview', methods=['POST'])
def preview_organize():
    data = request.json
    if not data.get('dir'):
        return jsonify({"error": "Campo 'dir' obrigatório"}), 400
    try:
        recursive = data.get('recursive', True)
        move_others = data.get('move_others', False)
        result = controller.preview_organize(
            dir_path=data['dir'],
            recursive=recursive,
            move_others=move_others
        )
        return jsonify({"success": True, "preview": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/organize', methods=['POST'])
def organize_files():
    data = request.json
    if not data.get('dir'):
        return jsonify({"error": "Campo 'dir' obrigatório"}), 400
    try:
        result = controller.organize_by_extension(
            dir_path=data['dir'],
            recursive=data.get('recursive', True),
            copy=data.get('copy', False),
            on_conflict=data.get('on_conflict', 'skip'),
            move_others=data.get('move_others', False),
            delete_empty_folders=data.get('delete_empty_folders', False)
        )
        return jsonify({"success": True, "processed_count": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/rename-by-content/preview', methods=['POST'])
def preview_rename_by_content():
    data = request.json
    if not data.get('dir'):
        return jsonify({"error": "Campo 'dir' obrigatório"}), 400
    try:
        recursive = data.get('recursive', True)
        pattern = data.get('pattern', 'auto')
        result = controller.rename_by_content(
            dir_path=data['dir'],
            recursive=recursive,
            pattern=pattern,
            dry_run=True
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/rename-by-content', methods=['POST'])
def rename_by_content():
    data = request.json
    if not data.get('dir'):
        return jsonify({"error": "Campo 'dir' obrigatório"}), 400
    try:
        recursive = data.get('recursive', True)
        pattern = data.get('pattern', 'auto')
        result = controller.rename_by_content(
            dir_path=data['dir'],
            recursive=recursive,
            pattern=pattern,
            dry_run=False
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@file_bp.route('/attributes', methods=['POST'])
def set_attributes():
    data = request.json
    if not data.get('dir'):
        return jsonify({"error": "Campo 'dir' obrigatório"}), 400
    try:
        recursive = data.get('recursive', True)
        options = {
            'readonly': data.get('readonly'),
            'hidden': data.get('hidden'),
            'system': data.get('system'),
            'modification_date': data.get('modification_date'),
            'creation_date': data.get('creation_date'),
            'permissions': data.get('permissions')
        }
        # Remove None para não sobrescrever com valor nulo
        options = {k: v for k, v in options.items() if v is not None}
        count = controller.set_attributes(
            dir_path=data['dir'],
            recursive=recursive,
            options=options
        )
        return jsonify({"success": True, "processed_count": count}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/report', methods=['POST'])
def generate_report():
    data = request.json
    if not data.get('dir'):
        return jsonify({"error": "Campo 'dir' obrigatório"}), 400
    try:
        recursive = data.get('recursive', True)
        include_files = data.get('include_files', True)
        output_format = data.get('format', 'txt')
        output_path = data.get('output_path')  # opcional
        result = controller.generate_report(
            dir_path=data['dir'],
            recursive=recursive,
            include_files=include_files,
            output_format=output_format,
            output_path=output_path
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/compare', methods=['POST'])
def compare_directories():
    data = request.json
    if not data.get('source_dir') or not data.get('target_dir'):
        return jsonify({"error": "Campos obrigatórios: source_dir, target_dir"}), 400
    try:
        result = controller.compare_directories(
            source_dir=data['source_dir'],
            target_dir=data['target_dir'],
            recursive=data.get('recursive', True),
            include_hidden=data.get('include_hidden', False),
            compare_by_hash=data.get('compare_by_hash', False)
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/sync', methods=['POST'])
def sync_directories():
    data = request.json
    if not data.get('source_dir') or not data.get('target_dir'):
        return jsonify({"error": "Campos obrigatórios: source_dir, target_dir"}), 400
    try:
        result = controller.sync_directories(
            source_dir=data['source_dir'],
            target_dir=data['target_dir'],
            recursive=data.get('recursive', True),
            include_hidden=data.get('include_hidden', False),
            compare_by_hash=data.get('compare_by_hash', False),
            action=data.get('action', 'copy_to_target')
        )
        return jsonify({"success": True, **result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/archive/compress', methods=['POST'])
def archive_compress():
    data = request.json
    if not data.get('source_paths') or not data.get('output_path'):
        return jsonify({"error": "Campos obrigatórios: source_paths, output_path"}), 400
    try:
        result = controller.archive_compress(
            source_paths=data['source_paths'],
            output_path=data['output_path'],
            password=data.get('password'),
            compression_level=data.get('compression_level', 6),
            compression_method=data.get('compression_method', 'deflate'),
            recursive=data.get('recursive', True),
            include_patterns=data.get('include_patterns'),
            exclude_patterns=data.get('exclude_patterns'),
            exclude_hidden=data.get('exclude_hidden', False)
        )
        return jsonify({"success": True, "output_path": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@file_bp.route('/archive/extract', methods=['POST'])
def archive_extract():
    data = request.json
    if not data.get('archive_path') or not data.get('extract_dir'):
        return jsonify({"error": "Campos obrigatórios: archive_path, extract_dir"}), 400
    try:
        result = controller.archive_extract(
            archive_path=data['archive_path'],
            extract_dir=data['extract_dir'],
            password=data.get('password')
        )
        return jsonify({"success": True, "extract_dir": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500