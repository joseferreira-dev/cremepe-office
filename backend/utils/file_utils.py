import os
from pathlib import Path

def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)

def list_files_in_dir(directory, recursive=False):
    directory = Path(directory)
    if not directory.exists():
        return []
    if recursive:
        return [str(p) for p in directory.rglob('*') if p.is_file()]
    else:
        return [str(p) for p in directory.glob('*') if p.is_file()]