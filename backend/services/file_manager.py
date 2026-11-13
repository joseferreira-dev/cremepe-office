import os
import shutil
import re
import unicodedata
from pathlib import Path
from typing import List, Callable, Optional, Union
from datetime import datetime, timedelta

# ===================== COLETA =====================
def collect_files(
    src_dirs: List[str],
    dst_dir: str,
    recursive: bool = True,
    overwrite: bool = False,
    delete_empty_dirs: bool = False,
    copy: bool = False,
    preserve_structure: bool = False,
    extensions: List[str] = None,
    include_hidden: bool = False,
    min_mtime: Union[datetime, None] = None,
    on_conflict: str = 'skip',  # 'skip', 'overwrite', 'rename'
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> int:
    """
    Coleta arquivos de uma ou mais pastas origem para um destino.
    Retorna o número de arquivos processados.
    """
    dst_path = Path(dst_dir)
    dst_path.mkdir(parents=True, exist_ok=True)

    # Coleta todos os arquivos das origens
    all_files = []
    for src_dir in src_dirs:
        src_path = Path(src_dir)
        if not src_path.exists():
            raise FileNotFoundError(f"Diretório origem não encontrado: {src_dir}")
        if recursive:
            files = list(src_path.rglob("*"))
        else:
            files = list(src_path.glob("*"))
        for f in files:
            if f.is_file():
                all_files.append((src_path, f))
    
    # Aplica filtros
    filtered = []
    for src_root, file_path in all_files:
        # Extensão
        if extensions:
            if not any(file_path.suffix.lower() == ext.lower() for ext in extensions):
                continue
        # Oculto
        if not include_hidden and file_path.name.startswith('.'):
            continue
        # Data de modificação
        if min_mtime:
            if datetime.fromtimestamp(file_path.stat().st_mtime) < min_mtime:
                continue
        filtered.append((src_root, file_path))

    total = len(filtered)
    processed = 0

    for idx, (src_root, file_path) in enumerate(filtered):
        # Determina destino
        if preserve_structure:
            rel_path = file_path.relative_to(src_root)
            dest_file = dst_path / rel_path
        else:
            dest_file = dst_path / file_path.name

        dest_file.parent.mkdir(parents=True, exist_ok=True)

        # Conflito
        if dest_file.exists():
            if on_conflict == 'skip':
                if progress_callback:
                    progress_callback(idx + 1, total)
                continue
            elif on_conflict == 'rename':
                base = dest_file.stem
                ext = dest_file.suffix
                counter = 1
                while dest_file.exists():
                    new_name = f"{base}_{counter}{ext}"
                    dest_file = dest_file.parent / new_name
                    counter += 1
            # 'overwrite' sobrescreve

        # Copia ou move
        if copy:
            shutil.copy2(str(file_path), str(dest_file))
        else:
            shutil.move(str(file_path), str(dest_file))
        processed += 1

        if progress_callback:
            progress_callback(idx + 1, total)

    # Exclui pastas vazias (se mover e delete_empty_dirs=True)
    if not copy and delete_empty_dirs:
        for src_dir in src_dirs:
            for root, dirs, files in os.walk(src_dir, topdown=False):
                try:
                    if not os.listdir(root):
                        os.rmdir(root)
                except OSError:
                    pass

    return processed

# ===================== RENOMEAR =====================
def rename_files_in_batch(
    file_paths: List[str],
    prefix: str = "",
    suffix: str = "",
    start_number: int = 1,
    use_original_name: bool = False,
    extensions: List[str] = None,                     # novo: filtrar por extensão
    regex_pattern: str = None,                        # novo: padrão regex para substituir
    regex_replacement: str = "",                      # novo: substituição
    case_conversion: str = 'none',                    # 'none', 'lower', 'upper', 'title'
    remove_accents: bool = False,                     # novo: remover acentos
    replace_spaces_with: str = None,                  # novo: substituir espaços por outro caractere
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> int:
    """
    Renomeia uma lista de arquivos aplicando transformações.
    Retorna o número de arquivos renomeados.
    """
    renamed_count = 0
    total = len(file_paths)
    counter = start_number

    for idx, file_path in enumerate(file_paths):
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            continue

        # Filtro por extensão
        if extensions:
            if not any(path.suffix.lower() == ext.lower() for ext in extensions):
                if progress_callback:
                    progress_callback(idx + 1, total)
                continue

        # Nome base (sem extensão) e extensão
        stem = path.stem
        ext = path.suffix

        # 1) Aplica substituição regex (se fornecida)
        if regex_pattern:
            try:
                stem = re.sub(regex_pattern, regex_replacement, stem)
            except re.error:
                raise ValueError(f"Regex inválido: {regex_pattern}")

        # 2) Remove acentos
        if remove_accents:
            stem = ''.join(
                c for c in unicodedata.normalize('NFKD', stem)
                if not unicodedata.combining(c)
            )

        # 3) Substitui espaços
        if replace_spaces_with is not None:
            stem = stem.replace(' ', replace_spaces_with)

        # 4) Converte caixa
        if case_conversion == 'lower':
            stem = stem.lower()
        elif case_conversion == 'upper':
            stem = stem.upper()
        elif case_conversion == 'title':
            stem = stem.title()

        # 5) Monta nome final com prefixo/sufixo e numeração
        if use_original_name:
            new_name = f"{prefix}{stem}{suffix}{ext}"
        else:
            new_name = f"{prefix}{counter:04d}{suffix}{ext}"
            counter += 1

        new_path = path.parent / new_name

        # Se conflito, renomeia com sufixo numérico
        if new_path.exists():
            base = new_path.stem
            i = 1
            while new_path.exists():
                new_name = f"{base}_{i}{ext}"
                new_path = path.parent / new_name
                i += 1

        path.rename(new_path)
        renamed_count += 1
        if progress_callback:
            progress_callback(idx + 1, total)

    return renamed_count