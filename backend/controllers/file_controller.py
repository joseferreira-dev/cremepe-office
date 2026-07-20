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
        result = []
        counter = start_number
        for file_path in file_paths:
            path = Path(file_path)
            if not path.exists() or not path.is_file():
                continue

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
        else:
            for f in files:
                groups[f.name].append(str(f))

        duplicate_groups = [group for group in groups.values() if len(group) > 1]
        return duplicate_groups
    
    def remove_duplicates(self, groups, action='delete', destination=None):
        import os
        import shutil
        count = 0
        for group in groups:
            original = group[0]
            for dup in group[1:]:
                if action == 'delete':
                    os.remove(dup)
                elif action == 'move' and destination:
                    dest_path = Path(destination) / Path(dup).name
                    shutil.move(dup, dest_path)
                count += 1
        return count
    
    # ========== ORGANIZAR POR EXTENSÃO (sem ocultos) ==========
    def organize_by_extension(
        self,
        dir_path: str,
        recursive: bool = True,
        copy: bool = False,
        on_conflict: str = 'skip',
        move_others: bool = False,
        delete_empty_folders: bool = False
    ) -> int:
        """
        Organiza arquivos de um diretório movendo-os para subpastas
        com base em suas extensões. Ignora arquivos ocultos.
        move_others: se True, arquivos sem extensão vão para pasta 'OUTROS'.
        delete_empty_folders: se True, remove pastas vazias após a organização.
        Retorna o número de arquivos processados.
        """
        from pathlib import Path
        import shutil
        import os

        src_path = Path(dir_path)
        if not src_path.exists():
            raise FileNotFoundError(f"Diretório não encontrado: {dir_path}")

        # Coletar arquivos (excluindo ocultos)
        if recursive:
            files = list(src_path.rglob("*"))
        else:
            files = list(src_path.glob("*"))
        files = [f for f in files if f.is_file() and not f.name.startswith('.')]

        processed = 0
        for file_path in files:
            ext = file_path.suffix.lower()
            if ext:
                folder_name = ext[1:].upper()
            else:
                if move_others:
                    folder_name = "OUTROS"
                else:
                    continue  # ignora arquivos sem extensão se move_others for False

            dest_dir = src_path / folder_name
            dest_dir.mkdir(parents=True, exist_ok=True)

            dest_file = dest_dir / file_path.name
            if dest_file.exists():
                if on_conflict == 'skip':
                    continue
                elif on_conflict == 'rename':
                    base = dest_file.stem
                    counter = 1
                    while dest_file.exists():
                        new_name = f"{base}_{counter}{ext}" if ext else f"{base}_{counter}"
                        dest_file = dest_dir / new_name
                        counter += 1
                # 'overwrite' sobrescreve

            if copy:
                shutil.copy2(str(file_path), str(dest_file))
            else:
                shutil.move(str(file_path), str(dest_file))
            processed += 1

        # Excluir pastas vazias (se solicitado)
        if delete_empty_folders and not copy:
            # Percorre de baixo para cima, excluindo pastas vazias (exceto a raiz)
            for root, dirs, files in os.walk(src_path, topdown=False):
                # Não remove a raiz
                if root == str(src_path):
                    continue
                try:
                    if not os.listdir(root):
                        os.rmdir(root)
                except OSError:
                    pass

        return processed

    def preview_organize(
        self,
        dir_path: str,
        recursive: bool = True,
        move_others: bool = False
    ):
        """
        Retorna uma pré-visualização dos arquivos organizados por extensão.
        Ignora arquivos ocultos.
        move_others: se True, arquivos sem extensão vão para 'OUTROS'.
        """
        from pathlib import Path
        from collections import defaultdict

        src_path = Path(dir_path)
        if not src_path.exists():
            raise FileNotFoundError(f"Diretório não encontrado: {dir_path}")

        if recursive:
            files = list(src_path.rglob("*"))
        else:
            files = list(src_path.glob("*"))
        files = [f for f in files if f.is_file() and not f.name.startswith('.')]

        groups = defaultdict(list)
        for f in files:
            ext = f.suffix.lower()
            if ext:
                folder_name = ext[1:].upper()
            else:
                if move_others:
                    folder_name = "OUTROS"
                else:
                    continue  # ignora sem extensão se move_others False
            groups[folder_name].append(str(f))

        result = [
            {
                'folder': folder_name,
                'files': paths,
                'count': len(paths)
            }
            for folder_name, paths in groups.items()
        ]
        return result
    
    def rename_by_content(
        self,
        dir_path: str,
        recursive: bool = True,
        pattern: str = 'auto',
        dry_run: bool = False
    ) -> dict:
        """
        Renomeia arquivos com base em metadados de conteúdo.
        Retorna dict com {'renamed': [], 'errors': [], 'skipped': []}
        """
        from models.file_metadata import get_image_metadata, get_audio_metadata, get_text_metadata, generate_new_name
        from pathlib import Path
        import os

        src_path = Path(dir_path)
        if not src_path.exists():
            raise FileNotFoundError(f"Diretório não encontrado: {dir_path}")

        files = []
        if recursive:
            files = list(src_path.rglob("*"))
        else:
            files = list(src_path.glob("*"))
        # Ignora arquivos ocultos (nomes começando com '.')
        files = [f for f in files if f.is_file() and not f.name.startswith('.')]

        result = {'renamed': [], 'errors': [], 'skipped': []}
        for file_path in files:
            ext = file_path.suffix.lower()
            metadata = None
            if ext in ['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.webp']:
                metadata = get_image_metadata(file_path, use_mtime_fallback=True)
            elif ext in ['.mp3', '.flac', '.ogg', '.wma', '.m4a']:
                metadata = get_audio_metadata(file_path)
            elif ext in ['.txt', '.log', '.csv', '.md', '.json', '.xml']:
                metadata = get_text_metadata(file_path)
            else:
                result['skipped'].append(str(file_path))
                continue

            if metadata is None:
                result['skipped'].append(str(file_path))
                continue

            new_name = generate_new_name(file_path, metadata, pattern)
            if new_name is None:
                result['skipped'].append(str(file_path))
                continue

            new_full = file_path.parent / (new_name + ext)
            if new_full.exists():
                counter = 1
                while new_full.exists():
                    new_full = file_path.parent / f"{new_name}_{counter}{ext}"
                    counter += 1

            if dry_run:
                result['renamed'].append({'original': str(file_path), 'new': str(new_full)})
            else:
                try:
                    os.rename(str(file_path), str(new_full))
                    result['renamed'].append({'original': str(file_path), 'new': str(new_full)})
                except Exception as e:
                    result['errors'].append({'file': str(file_path), 'error': str(e)})

        return result
    
    def set_attributes(
        self,
        dir_path: str,
        recursive: bool = True,
        options: dict = None
    ) -> int:
        """
        Aplica atributos a todos os arquivos de um diretório.
        options: dict com:
            readonly: bool
            hidden: bool
            system: bool
            modification_date: str (ISO format, ex: '2026-07-20T14:30:00')
            creation_date: str (ISO format)
            permissions: str (ex: '755')
        Retorna número de arquivos processados.
        """
        from pathlib import Path
        import os
        from datetime import datetime
        from models.file_attributes import apply_attributes

        src_path = Path(dir_path)
        if not src_path.exists():
            raise FileNotFoundError(f"Diretório não encontrado: {dir_path}")

        if recursive:
            files = list(src_path.rglob("*"))
        else:
            files = list(src_path.glob("*"))
        files = [f for f in files if f.is_file() and not f.name.startswith('.')]

        # Converter strings de data para datetime
        if options:
            if 'modification_date' in options and options['modification_date']:
                options['modification_date'] = datetime.fromisoformat(options['modification_date'])
            else:
                options['modification_date'] = None
            if 'creation_date' in options and options['creation_date']:
                options['creation_date'] = datetime.fromisoformat(options['creation_date'])
            else:
                options['creation_date'] = None
        else:
            options = {}

        processed = 0
        for f in files:
            try:
                apply_attributes(f, options)
                processed += 1
            except Exception:
                # Se falhar em um arquivo, continua
                pass
        return processed