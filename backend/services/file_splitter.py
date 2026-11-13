import os
import shutil
from pathlib import Path
from typing import List, Optional

def split_file(
    file_path: str,
    output_dir: str,
    part_size_mb: int = 100,
    overwrite: bool = False
) -> List[str]:
    """
    Divide um arquivo em partes menores.
    Retorna lista de caminhos das partes criadas.
    """
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    part_size = part_size_mb * 1024 * 1024  # em bytes
    file_size = file_path.stat().st_size
    part_number = 1
    parts = []

    with open(file_path, 'rb') as infile:
        while True:
            part_name = f"{file_path.stem}.part{part_number:04d}{file_path.suffix}"
            part_path = output_dir / part_name

            if part_path.exists() and not overwrite:
                raise FileExistsError(f"Parte já existe: {part_path}")

            with open(part_path, 'wb') as outfile:
                bytes_read = 0
                while bytes_read < part_size:
                    chunk = infile.read(min(part_size - bytes_read, 1024 * 1024))  # 1 MB chunks
                    if not chunk:
                        break
                    outfile.write(chunk)
                    bytes_read += len(chunk)
                if bytes_read == 0:
                    # Se a última parte está vazia, remove e sai
                    part_path.unlink()
                    break
                parts.append(str(part_path))
                if bytes_read < part_size:
                    # Fim do arquivo
                    break
            part_number += 1

    return parts


def merge_parts(
    parts_list: List[str],
    output_path: str,
    overwrite: bool = False
) -> str:
    """
    Monta um arquivo a partir de partes.
    Retorna o caminho do arquivo remontado.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_path.exists() and not overwrite:
        raise FileExistsError(f"Arquivo de saída já existe: {output_path}")

    # Ordena as partes numericamente (assumindo ordem dos .partNNNN)
    parts_list = sorted(parts_list, key=lambda p: int(Path(p).stem.split('.part')[-1]))

    with open(output_path, 'wb') as outfile:
        for part in parts_list:
            part_path = Path(part)
            if not part_path.exists():
                raise FileNotFoundError(f"Parte não encontrada: {part}")
            with open(part_path, 'rb') as infile:
                shutil.copyfileobj(infile, outfile)

    return str(output_path)