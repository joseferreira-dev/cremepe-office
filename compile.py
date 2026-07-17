import os
import sys
from pathlib import Path

# Extensões de arquivo que serão incluídas (você pode ajustar)
INCLUDE_EXTENSIONS = {
    '.py', '.js', '.html', '.css', '.json', '.txt', '.md',
    '.sh', '.bat', '.yml', '.yaml', '.ini', '.cfg', '.conf'
}

# Pastas a serem ignoradas (nomes exatos ou padrões)
IGNORE_DIRS = {
    '__pycache__', '.git', 'node_modules', '.vscode', '.idea',
    'venv', 'env', '.env', 'dist', 'build', 'target',
    'logs', 'tmp', 'temp', '.pytest_cache', '.mypy_cache'
}

# Arquivos a serem ignorados (nomes exatos)
IGNORE_FILES = {
    '.gitkeep', '.DS_Store', 'Thumbs.db', 'desktop.ini', 'project_snapshot.txt',
    'compile.py', 'package-lock.json'
}

def should_ignore_dir(dir_name: str) -> bool:
    """Verifica se o diretório deve ser ignorado."""
    return dir_name in IGNORE_DIRS

def should_ignore_file(file_name: str) -> bool:
    """Verifica se o arquivo deve ser ignorado."""
    if file_name in IGNORE_FILES:
        return True
    # Ignora arquivos .pyc, .pyo, .so, etc.
    if file_name.endswith(('.pyc', '.pyo', '.so', '.dll', '.exe')):
        return True
    return False

def generate_tree(start_path: Path, prefix: str = "", is_last: bool = True) -> str:
    """Gera uma representação em árvore do diretório (apenas estrutura, sem conteúdo)."""
    output = []
    items = list(start_path.iterdir())
    # Ordenar: pastas primeiro, depois arquivos
    dirs = sorted([p for p in items if p.is_dir() and not should_ignore_dir(p.name)])
    files = sorted([p for p in items if p.is_file() and not should_ignore_file(p.name) and p.suffix in INCLUDE_EXTENSIONS])
    
    # Processar pastas
    for i, d in enumerate(dirs):
        is_last_dir = (i == len(dirs) - 1) and not files
        output.append(f"{prefix}{'└── ' if is_last_dir else '├── '}{d.name}/")
        extension = "    " if is_last_dir else "│   "
        output.append(generate_tree(d, prefix + extension, is_last_dir))
    
    # Processar arquivos
    for i, f in enumerate(files):
        is_last_file = (i == len(files) - 1)
        output.append(f"{prefix}{'└── ' if is_last_file else '├── '}{f.name}")
    
    return "\n".join(output)

def collect_file_contents(start_path: Path, base_path: Path) -> list:
    """Coleta o caminho e conteúdo de todos os arquivos relevantes."""
    contents = []
    for root, dirs, files in os.walk(start_path):
        # Remover diretórios ignorados in-place
        dirs[:] = [d for d in dirs if not should_ignore_dir(d)]
        
        for file in files:
            if should_ignore_file(file):
                continue
            file_path = Path(root) / file
            # Verifica extensão
            if file_path.suffix not in INCLUDE_EXTENSIONS:
                continue
            rel_path = file_path.relative_to(base_path)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                contents.append((str(rel_path), content))
            except Exception as e:
                contents.append((str(rel_path), f"[ERRO ao ler arquivo: {e}]"))
    return contents

def main():
    # Define o diretório raiz (argumento opcional)
    if len(sys.argv) > 1:
        root_dir = Path(sys.argv[1]).resolve()
    else:
        root_dir = Path.cwd()
    
    if not root_dir.exists() or not root_dir.is_dir():
        print(f"Erro: '{root_dir}' não é um diretório válido.")
        sys.exit(1)
    
    output_file = root_dir / "project_snapshot.txt"
    
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write(f"# Snapshot do projeto: {root_dir.name}\n")
        out.write(f"# Gerado em: {root_dir}\n\n")
        
        # 1. Estrutura de pastas (árvore)
        out.write("## ESTRUTURA DE DIRETÓRIOS\n\n")
        out.write(generate_tree(root_dir))
        out.write("\n\n")
        
        # 2. Conteúdo dos arquivos
        out.write("## CONTEÚDO DOS ARQUIVOS\n\n")
        files_content = collect_file_contents(root_dir, root_dir)
        for rel_path, content in files_content:
            out.write(f"\n### {rel_path}\n\n")
            out.write("```\n")
            out.write(content)
            if not content.endswith('\n'):
                out.write('\n')
            out.write("```\n\n")
    
    print(f"Snapshot gerado com sucesso em: {output_file}")

if __name__ == "__main__":
    main()