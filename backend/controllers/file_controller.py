from pathlib import Path
import re
import unicodedata
import hashlib
from collections import defaultdict

from models.file_manager import collect_files, rename_files_in_batch
from datetime import datetime, timedelta

class FileController:
    def collect_files(self, src_dirs, dst_dir, recursive=True, overwrite=False,
                      delete_empty_dirs=False, copy=False, preserve_structure=False,
                      extensions=None, include_hidden=False, days_back=None,
                      on_conflict='skip'):
        min_mtime = None
        if days_back is not None:
            min_mtime = datetime.now() - timedelta(days=days_back)
        return collect_files(
            src_dirs=src_dirs,
            dst_dir=dst_dir,
            recursive=recursive,
            overwrite=overwrite,
            delete_empty_dirs=delete_empty_dirs,
            copy=copy,
            preserve_structure=preserve_structure,
            extensions=extensions,
            include_hidden=include_hidden,
            min_mtime=min_mtime,
            on_conflict=on_conflict,
            progress_callback=None
        )

    def preview_files(self, src_dirs, recursive=True, extensions=None,
                      include_hidden=False, days_back=None):
        from pathlib import Path
        all_files = []
        for src_dir in src_dirs:
            src_path = Path(src_dir)
            if not src_path.exists():
                raise FileNotFoundError(f"Diretório não encontrado: {src_dir}")
            if recursive:
                files = list(src_path.rglob("*"))
            else:
                files = list(src_path.glob("*"))
            for f in files:
                if f.is_file():
                    all_files.append((src_path, f))

        min_mtime = None
        if days_back is not None:
            min_mtime = datetime.now() - timedelta(days=days_back)

        result = []
        for src_root, file_path in all_files:
            if extensions:
                if not any(file_path.suffix.lower() == ext.lower() for ext in extensions):
                    continue
            if not include_hidden and file_path.name.startswith('.'):
                continue
            if min_mtime:
                if datetime.fromtimestamp(file_path.stat().st_mtime) < min_mtime:
                    continue
            result.append({
                'path': str(file_path),
                'relative': str(file_path.relative_to(src_root)) if src_root != file_path.parent else file_path.name,
                'size': file_path.stat().st_size,
                'modified': datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
            })
        return result

    def rename_files(self, file_paths, prefix='', suffix='', start_number=1,
                     use_original_name=False, extensions=None,
                     regex_pattern=None, regex_replacement='',
                     case_conversion='none', remove_accents=False,
                     replace_spaces_with=None):
        return rename_files_in_batch(
            file_paths,
            prefix=prefix,
            suffix=suffix,
            start_number=start_number,
            use_original_name=use_original_name,
            extensions=extensions,
            regex_pattern=regex_pattern,
            regex_replacement=regex_replacement,
            case_conversion=case_conversion,
            remove_accents=remove_accents,
            replace_spaces_with=replace_spaces_with,
            progress_callback=None
        )

    def preview_rename(self, file_paths, prefix='', suffix='', start_number=1,
                       use_original_name=False, extensions=None,
                       regex_pattern=None, regex_replacement='',
                       case_conversion='none', remove_accents=False,
                       replace_spaces_with=None):
        """
        Retorna uma lista com os nomes originais e os novos nomes (sem renomear).
        """
        # Reutiliza a lógica de renomeação, mas sem renomear de fato.
        # Vamos simular o novo nome para cada arquivo.
        result = []
        counter = start_number
        for file_path in file_paths:
            path = Path(file_path)
            if not path.exists() or not path.is_file():
                continue

            # Aplica os mesmos filtros e transformações (código duplicado da função rename)
            stem = path.stem
            ext = path.suffix

            if extensions:
                if not any(path.suffix.lower() == ext.lower() for ext in extensions):
                    continue

            if regex_pattern:
                try:
                    stem = re.sub(regex_pattern, regex_replacement, stem)
                except re.error:
                    raise ValueError(f"Regex inválido: {regex_pattern}")

            if remove_accents:
                stem = ''.join(
                    c for c in unicodedata.normalize('NFKD', stem)
                    if not unicodedata.combining(c)
                )

            if replace_spaces_with is not None:
                stem = stem.replace(' ', replace_spaces_with)

            if case_conversion == 'lower':
                stem = stem.lower()
            elif case_conversion == 'upper':
                stem = stem.upper()
            elif case_conversion == 'title':
                stem = stem.title()

            if use_original_name:
                new_name = f"{prefix}{stem}{suffix}{ext}"
            else:
                new_name = f"{prefix}{counter:04d}{suffix}{ext}"
                counter += 1

            # Verifica se já existe (se sim, adiciona sufixo)
            new_path = path.parent / new_name
            if new_path.exists():
                base = new_path.stem
                i = 1
                while new_path.exists():
                    new_name = f"{base}_{i}{ext}"
                    new_path = path.parent / new_name
                    i += 1

            result.append({
                'original': str(path.name),
                'new': new_name,
                'path': str(path)
            })

        return result
    
    def find_duplicates(self, dir_path, recursive=True, match_by='hash', include_hidden=False):
        """
        Escaneia um diretório e retorna grupos de arquivos duplicados.
        match_by: 'hash' (MD5) ou 'name' (nome exato)
        Retorna lista de grupos, cada grupo é uma lista de caminhos.
        """
        from pathlib import Path
        src_path = Path(dir_path)
        if not src_path.exists():
            raise FileNotFoundError(f"Diretório não encontrado: {dir_path}")

        files = []
        if recursive:
            files = list(src_path.rglob("*"))
        else:
            files = list(src_path.glob("*"))
        files = [f for f in files if f.is_file() and (include_hidden or not f.name.startswith('.'))]

        groups = defaultdict(list)
        if match_by == 'hash':
            for f in files:
                with open(f, 'rb') as file:
                    file_hash = hashlib.md5(file.read()).hexdigest()
                groups[file_hash].append(str(f))
        else:  # name
            for f in files:
                groups[f.name].append(str(f))

        # Filtra apenas grupos com mais de um arquivo
        duplicate_groups = [group for group in groups.values() if len(group) > 1]
        return duplicate_groups
    
    def remove_duplicates(self, groups, action='delete', destination=None):
        """
        groups: lista de grupos (listas de caminhos)
        action: 'delete' (exclui todos exceto o primeiro), 'move' (move para destination)
        Retorna número de arquivos removidos/movidos.
        """
        import os
        import shutil
        count = 0
        for group in groups:
            # Preserva o primeiro como original
            original = group[0]
            for dup in group[1:]:
                if action == 'delete':
                    os.remove(dup)
                elif action == 'move' and destination:
                    dest_path = Path(destination) / Path(dup).name
                    shutil.move(dup, dest_path)
                count += 1
        return count