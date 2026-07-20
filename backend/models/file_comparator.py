import os
import hashlib
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional

def get_file_hash(filepath: Path, chunk_size=8192) -> str:
    """Calcula o hash MD5 de um arquivo."""
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(chunk_size), b''):
            hasher.update(chunk)
    return hasher.hexdigest()

def scan_directory(
    dir_path: str,
    recursive: bool = True,
    include_hidden: bool = False
) -> Dict[str, dict]:
    """
    Escaneia um diretório e retorna um dicionário com informações de cada arquivo.
    Chave: caminho relativo (usando / como separador).
    Valor: dict com 'path', 'size', 'mtime', 'hash' (calculado se necessário).
    """
    base_path = Path(dir_path)
    if not base_path.exists():
        raise FileNotFoundError(f"Diretório não encontrado: {dir_path}")

    files = {}
    if recursive:
        all_files = list(base_path.rglob("*"))
    else:
        all_files = list(base_path.glob("*"))

    for f in all_files:
        if not f.is_file():
            continue
        if not include_hidden and f.name.startswith('.'):
            continue
        rel_path = str(f.relative_to(base_path)).replace('\\', '/')
        stat = f.stat()
        files[rel_path] = {
            'path': str(f),
            'size': stat.st_size,
            'mtime': stat.st_mtime,
            'hash': None  # será preenchido sob demanda
        }
    return files

def compare_folders(
    source_dir: str,
    target_dir: str,
    recursive: bool = True,
    include_hidden: bool = False,
    compare_by_hash: bool = False
) -> Dict[str, any]:
    """
    Compara duas pastas e retorna diferenças.
    Retorna:
        {
            'only_in_source': [caminhos],
            'only_in_target': [caminhos],
            'modified_in_source': [caminhos],
            'identical': [caminhos],
            'source_files': dict,  # todos os arquivos da origem (para uso futuro)
            'target_files': dict,  # todos os arquivos do destino
            'total_source': int,
            'total_target': int
        }
    """
    source_files = scan_directory(source_dir, recursive, include_hidden)
    target_files = scan_directory(target_dir, recursive, include_hidden)

    # Preencher hashes se necessário
    if compare_by_hash:
        for rel_path, info in source_files.items():
            info['hash'] = get_file_hash(Path(info['path']))
        for rel_path, info in target_files.items():
            info['hash'] = get_file_hash(Path(info['path']))

    only_in_source = []
    only_in_target = []
    modified_in_source = []
    identical = []

    all_paths = set(source_files.keys()) | set(target_files.keys())

    for rel_path in all_paths:
        in_src = rel_path in source_files
        in_tgt = rel_path in target_files

        if in_src and not in_tgt:
            only_in_source.append(rel_path)
        elif not in_src and in_tgt:
            only_in_target.append(rel_path)
        else:
            # em ambos – comparar
            src_info = source_files[rel_path]
            tgt_info = target_files[rel_path]
            if compare_by_hash:
                if src_info['hash'] == tgt_info['hash']:
                    identical.append(rel_path)
                else:
                    modified_in_source.append(rel_path)
            else:
                # comparar por data/hora e tamanho
                if src_info['size'] == tgt_info['size'] and src_info['mtime'] == tgt_info['mtime']:
                    identical.append(rel_path)
                else:
                    modified_in_source.append(rel_path)

    return {
        'only_in_source': only_in_source,
        'only_in_target': only_in_target,
        'modified_in_source': modified_in_source,
        'identical': identical,
        'source_files': source_files,
        'target_files': target_files,
        'total_source': len(source_files),
        'total_target': len(target_files)
    }

def sync_folders(
    source_dir: str,
    target_dir: str,
    recursive: bool = True,
    include_hidden: bool = False,
    compare_by_hash: bool = False,
    action: str = 'copy_to_target'  # 'copy_to_target', 'mirror'
) -> Dict[str, any]:
    """
    Sincroniza a pasta destino com a origem.
    action: 'copy_to_target' copia apenas novos/atualizados para destino.
            'mirror' remove arquivos que estão apenas no destino.
    Retorna resumo das operações.
    """
    comparison = compare_folders(source_dir, target_dir, recursive, include_hidden, compare_by_hash)

    source_path = Path(source_dir)
    target_path = Path(target_dir)
    target_path.mkdir(parents=True, exist_ok=True)

    copied = 0
    removed = 0
    skipped = 0

    # Copiar arquivos novos ou modificados para destino
    for rel_path in comparison['only_in_source'] + comparison['modified_in_source']:
        src_file = Path(comparison['source_files'][rel_path]['path'])
        dest_file = target_path / rel_path
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copy2(str(src_file), str(dest_file))
            copied += 1
        except Exception:
            skipped += 1

    # Se mirror, remover arquivos que estão apenas no destino
    if action == 'mirror':
        for rel_path in comparison['only_in_target']:
            dest_file = target_path / rel_path
            try:
                if dest_file.exists():
                    dest_file.unlink()
                    removed += 1
            except Exception:
                pass
        # Remover pastas vazias no destino (após exclusão)
        for root, dirs, files in os.walk(target_path, topdown=False):
            # Não remove a raiz
            if root == str(target_path):
                continue
            try:
                if not os.listdir(root):
                    os.rmdir(root)
            except OSError:
                pass

    return {
        'copied': copied,
        'removed': removed,
        'skipped': skipped,
        'total_source': comparison['total_source'],
        'total_target': comparison['total_target']
    }