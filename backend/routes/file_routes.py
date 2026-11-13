from flask import Blueprint, jsonify
from controllers.file_controller import FileController
from utils.validation import require
from utils.job_routes import as_job
from datetime import datetime, timedelta
import os

file_bp = Blueprint('file', __name__)
controller = FileController()

@file_bp.route('/preview', methods=['POST'])
@require('src_dirs')
@as_job()
def preview_files(data):
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

@file_bp.route('/collect', methods=['POST'])
@require('src_dirs', 'dst_dir')
@as_job()
def collect_files(data):
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

@file_bp.route('/list', methods=['POST'])
@require('dir')
@as_job()
def list_files(data):
    dir_path = data['dir']
    files = [f for f in os.listdir(dir_path) if os.path.isfile(os.path.join(dir_path, f))]
    return jsonify({"success": True, "files": files}), 200

@file_bp.route('/rename-preview', methods=['POST'])
@require('file_paths')
@as_job()
def rename_preview(data):
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

@file_bp.route('/rename', methods=['POST'])
@require('file_paths')
@as_job()
def rename_files(data):
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
    
@file_bp.route('/duplicates', methods=['POST'])
@require('dir')
@as_job()
def find_duplicates(data):
    recursive = data.get('recursive', True)
    match_by = data.get('match_by', 'hash')
    include_hidden = data.get('include_hidden', False)
    groups = controller.find_duplicates(data['dir'], recursive, match_by, include_hidden)
    result = [{'files': group, 'count': len(group)} for group in groups]
    return jsonify({"success": True, "groups": result, "total_groups": len(groups)}), 200

@file_bp.route('/duplicates/remove', methods=['POST'])
@require('groups')
@as_job()
def remove_duplicates(data):
    action = data.get('action', 'delete')
    destination = data.get('destination')
    count = controller.remove_duplicates(data['groups'], action, destination)
    return jsonify({"success": True, "removed_count": count}), 200
    
@file_bp.route('/organize/preview', methods=['POST'])
@require('dir')
@as_job()
def preview_organize(data):
    recursive = data.get('recursive', True)
    move_others = data.get('move_others', False)
    result = controller.preview_organize(
        dir_path=data['dir'],
        recursive=recursive,
        move_others=move_others
    )
    return jsonify({"success": True, "preview": result}), 200

@file_bp.route('/organize', methods=['POST'])
@require('dir')
@as_job()
def organize_files(data):
    result = controller.organize_by_extension(
        dir_path=data['dir'],
        recursive=data.get('recursive', True),
        copy=data.get('copy', False),
        on_conflict=data.get('on_conflict', 'skip'),
        move_others=data.get('move_others', False),
        delete_empty_folders=data.get('delete_empty_folders', False)
    )
    return jsonify({"success": True, "processed_count": result}), 200

@file_bp.route('/rename-by-content/preview', methods=['POST'])
@require('dir')
@as_job()
def preview_rename_by_content(data):
    recursive = data.get('recursive', True)
    pattern = data.get('pattern', 'auto')
    result = controller.rename_by_content(
        dir_path=data['dir'],
        recursive=recursive,
        pattern=pattern,
        dry_run=True
    )
    return jsonify({"success": True, **result}), 200

@file_bp.route('/rename-by-content', methods=['POST'])
@require('dir')
@as_job()
def rename_by_content(data):
    recursive = data.get('recursive', True)
    pattern = data.get('pattern', 'auto')
    result = controller.rename_by_content(
        dir_path=data['dir'],
        recursive=recursive,
        pattern=pattern,
        dry_run=False
    )
    return jsonify({"success": True, **result}), 200
    
@file_bp.route('/attributes', methods=['POST'])
@require('dir')
@as_job()
def set_attributes(data):
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

@file_bp.route('/report', methods=['POST'])
@require('dir')
@as_job()
def generate_report(data):
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

@file_bp.route('/compare', methods=['POST'])
@require('source_dir', 'target_dir')
@as_job()
def compare_directories(data):
    result = controller.compare_directories(
        source_dir=data['source_dir'],
        target_dir=data['target_dir'],
        recursive=data.get('recursive', True),
        include_hidden=data.get('include_hidden', False),
        compare_by_hash=data.get('compare_by_hash', False)
    )
    return jsonify({"success": True, **result}), 200

@file_bp.route('/sync', methods=['POST'])
@require('source_dir', 'target_dir')
@as_job()
def sync_directories(data):
    result = controller.sync_directories(
        source_dir=data['source_dir'],
        target_dir=data['target_dir'],
        recursive=data.get('recursive', True),
        include_hidden=data.get('include_hidden', False),
        compare_by_hash=data.get('compare_by_hash', False),
        action=data.get('action', 'copy_to_target')
    )
    return jsonify({"success": True, **result}), 200

@file_bp.route('/compress', methods=['POST'])
@require('source_paths', 'output_path')
@as_job()
def archive_compress(data):
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

@file_bp.route('/extract', methods=['POST'])
@require('archive_path', 'extract_dir')
@as_job()
def archive_extract(data):
    result = controller.archive_extract(
        archive_path=data['archive_path'],
        extract_dir=data['extract_dir'],
        password=data.get('password')
    )
    return jsonify({"success": True, "extract_dir": result}), 200

@file_bp.route('/split', methods=['POST'])
@require('file_path', 'output_dir')
@as_job()
def split_file(data):
    part_size_mb = data.get('part_size_mb', 100)
    overwrite = data.get('overwrite', False)
    result = controller.split_file(
        file_path=data['file_path'],
        output_dir=data['output_dir'],
        part_size_mb=part_size_mb,
        overwrite=overwrite
    )
    return jsonify({"success": True, **result}), 200

@file_bp.route('/merge', methods=['POST'])
@require('parts_list', 'output_path')
@as_job()
def merge_parts(data):
    overwrite = data.get('overwrite', False)
    result = controller.merge_parts(
        parts_list=data['parts_list'],
        output_path=data['output_path'],
        overwrite=overwrite
    )
    return jsonify({"success": True, **result}), 200
