import os
import shutil
import subprocess
import platform
from pathlib import Path
from typing import List, Optional
import zipfile
import fnmatch

try:
    import pyzipper
except ImportError:
    pyzipper = None

try:
    import py7zr
except ImportError:
    py7zr = None

try:
    import rarfile
except ImportError:
    rarfile = None

def _matches_patterns(name: str, patterns: List[str]) -> bool:
    """Verifica se um nome (arquivo ou caminho) corresponde a algum padrão (glob)."""
    if not patterns:
        return True
    for pattern in patterns:
        if fnmatch.fnmatch(name, pattern):
            return True
    return False


def _should_include(rel_path: str, include_patterns: List[str] = None,
                    exclude_patterns: List[str] = None,
                    exclude_hidden: bool = False) -> bool:
    """
    Verifica se um arquivo (pelo caminho relativo) deve ser incluído.
    - include_patterns: se definido, o item deve corresponder a pelo menos um padrão.
    - exclude_patterns: se definido, o item não deve corresponder a nenhum padrão.
    - exclude_hidden: se True, itens com nome começando com '.' são excluídos.
    """
    if exclude_hidden and Path(rel_path).name.startswith('.'):
        return False

    if include_patterns:
        if not _matches_patterns(rel_path, include_patterns):
            return False

    if exclude_patterns:
        if _matches_patterns(rel_path, exclude_patterns):
            return False

    return True


def _collect_files(source_paths: List[str], recursive: bool = True,
                   include_patterns: List[str] = None,
                   exclude_patterns: List[str] = None,
                   exclude_hidden: bool = False) -> List[Path]:
    """
    Coleta todos os arquivos a partir de uma lista de caminhos, aplicando filtros.
    Retorna lista de caminhos absolutos.
    """
    all_files = []
    base_paths = [Path(p) for p in source_paths if Path(p).exists()]

    for base in base_paths:
        if base.is_file():
            rel_path = base.name
            if _should_include(rel_path, include_patterns, exclude_patterns, exclude_hidden):
                all_files.append(base)
        else:  # diretório
            if recursive:
                for root, dirs, files in os.walk(base):
                    root_path = Path(root)
                    # Exclui diretórios ocultos se necessário
                    if exclude_hidden:
                        dirs[:] = [d for d in dirs if not d.startswith('.')]

                    for f in files:
                        if exclude_hidden and f.startswith('.'):
                            continue
                        file_path = root_path / f
                        rel_path = str(file_path.relative_to(base))
                        if _should_include(rel_path, include_patterns, exclude_patterns, exclude_hidden):
                            all_files.append(file_path)
            else:
                for item in base.iterdir():
                    if item.is_file():
                        if exclude_hidden and item.name.startswith('.'):
                            continue
                        rel_path = item.name
                        if _should_include(rel_path, include_patterns, exclude_patterns, exclude_hidden):
                            all_files.append(item)

    return all_files


def _create_zip_with_pyzipper(source_paths: List[str], output_path: Path,
                              password: Optional[str] = None,
                              compression_level: int = 6,
                              compression_method: str = 'deflate') -> str:
    if pyzipper is None:
        raise ImportError("pyzipper não está instalado. Instale com: pip install pyzipper")

    method_map = {
        'deflate': pyzipper.ZIP_DEFLATED,
        'bzip2': pyzipper.ZIP_BZIP2,
        'lzma': pyzipper.ZIP_LZMA,
        'store': pyzipper.ZIP_STORED
    }
    compression = method_map.get(compression_method.lower(), pyzipper.ZIP_DEFLATED)

    with pyzipper.AESZipFile(
        output_path,
        'w',
        compression=compression,
        compresslevel=compression_level
    ) as zf:
        if password:
            zf.setpassword(password.encode('utf-8'))
            zf.encryption = pyzipper.WZ_AES

        for file_path in source_paths:
            path = Path(file_path)
            if path.is_dir():
                for root, dirs, files in os.walk(path):
                    for f in files:
                        full_path = Path(root) / f
                        arcname = full_path.relative_to(path.parent)
                        zf.write(full_path, arcname)
            else:
                zf.write(path, path.name)
    return str(output_path)


def _create_zip_with_subprocess(source_paths: List[str], output_path: Path,
                                password: Optional[str] = None,
                                compression_level: int = 6) -> str:
    if platform.system() == 'Windows':
        cmd = ['7z', 'a', '-tzip', f'-mx={compression_level}']
        if password:
            cmd.append(f'-p{password}')
        cmd.append(str(output_path))
        cmd.extend(source_paths)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Erro ao criar ZIP com 7z: {result.stderr}")
    else:
        cmd = ['zip', '-r', f'-{compression_level}']
        if password:
            cmd.append(f'-P{password}')
        cmd.append(str(output_path))
        cmd.extend(source_paths)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Erro ao criar ZIP com zip: {result.stderr}")
    return str(output_path)


def create_zip(
    source_paths: List[str],
    output_path: str,
    password: Optional[str] = None,
    compression_level: int = 6,
    compression_method: str = 'deflate',
    recursive: bool = True,
    include_patterns: List[str] = None,
    exclude_patterns: List[str] = None,
    exclude_hidden: bool = False
) -> str:
    """
    Cria um arquivo ZIP a partir de uma lista de caminhos.
    Retorna o caminho do arquivo criado.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Normaliza listas de padrões (remove entradas vazias)
    if include_patterns:
        include_patterns = [p.strip() for p in include_patterns if p.strip()]
    if exclude_patterns:
        exclude_patterns = [p.strip() for p in exclude_patterns if p.strip()]

    # Coleta arquivos com filtros
    files_to_archive = _collect_files(
        source_paths,
        recursive=recursive,
        include_patterns=include_patterns,
        exclude_patterns=exclude_patterns,
        exclude_hidden=exclude_hidden
    )

    if not files_to_archive:
        # Mensagem detalhada para ajudar o usuário
        msg = "Nenhum arquivo encontrado para arquivar."
        if include_patterns:
            msg += f" Padrões de inclusão: {include_patterns}"
        if exclude_patterns:
            msg += f" Padrões de exclusão: {exclude_patterns}"
        raise ValueError(msg)

    # Tenta pyzipper, senão fallback
    try:
        return _create_zip_with_pyzipper(
            [str(f) for f in files_to_archive],
            output_path,
            password=password,
            compression_level=compression_level,
            compression_method=compression_method
        )
    except ImportError:
        return _create_zip_with_subprocess(
            [str(f) for f in files_to_archive],
            output_path,
            password=password,
            compression_level=compression_level
        )

def extract_archive(
    archive_path: str,
    extract_dir: str,
    password: Optional[str] = None
) -> str:
    archive_path = Path(archive_path)
    extract_path = Path(extract_dir)
    extract_path.mkdir(parents=True, exist_ok=True)

    ext = archive_path.suffix.lower()
    if ext == '.zip':
        _extract_zip(archive_path, extract_path, password)
    elif ext == '.7z':
        _extract_7z(archive_path, extract_path, password)
    elif ext == '.rar':
        _extract_rar(archive_path, extract_path, password)
    elif ext == '.tar' or archive_path.suffixes[-2:] == ['.tar', '.gz'] or archive_path.suffix == '.tgz':
        _extract_tar(archive_path, extract_path)
    else:
        raise ValueError(f"Formato não suportado: {ext}")

    return str(extract_path)


def _extract_zip(archive_path, extract_path, password):
    try:
        with pyzipper.AESZipFile(archive_path, 'r') as zf:
            if password:
                zf.setpassword(password.encode('utf-8'))
            zf.extractall(extract_path)
    except:
        with zipfile.ZipFile(archive_path, 'r') as zf:
            if password:
                zf.setpassword(password.encode('utf-8'))
            zf.extractall(extract_path)


def _extract_7z(archive_path, extract_path, password):
    if py7zr is None:
        raise ImportError("py7zr não instalado. Instale com: pip install py7zr")
    with py7zr.SevenZipFile(archive_path, mode='r', password=password) as archive:
        archive.extractall(path=extract_path)


def _extract_rar(archive_path, extract_path, password):
    if rarfile is None:
        raise ImportError("rarfile não instalado. Instale com: pip install rarfile")
    with rarfile.RarFile(archive_path) as rf:
        rf.extractall(extract_path, pwd=password)


def _extract_tar(archive_path, extract_path):
    import tarfile
    with tarfile.open(archive_path, 'r:*') as tar:
        tar.extractall(path=extract_path)