"""Configuração de logging do backend.

- Arquivo com rotação em CREMEPE_LOG_DIR (ou diretório default por plataforma)
- Console (stdout) — capturado pelo Electron via pipe quando em produção
- Registro de requisições da API (método, rota, status, duração)

Uso em app.py:
    from utils.logger import setup_logging, register_request_logging
    log_dir = setup_logging()
    register_request_logging(app)
"""

import logging
import os
import sys
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

MAX_BYTES = 5 * 1024 * 1024  # 5 MB por arquivo
BACKUP_COUNT = 3

_configured = False


def _default_log_dir() -> Path:
    """Diretório default de logs por plataforma (usuário não-admin pode escrever)."""
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(base) / "CREMEPE Office" / "logs"
    base = os.environ.get("XDG_STATE_HOME") or str(Path.home() / ".local" / "state")
    return Path(base) / "cremepe-office" / "logs"


def setup_logging() -> Path:
    """Configura log em arquivo (com rotação) + console. Idempotente.

    Retorna o diretório efetivo de logs.
    """
    global _configured

    log_dir = Path(os.environ.get("CREMEPE_LOG_DIR") or _default_log_dir())
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        # Fallback: diretório temporário (nunca derrubar o app por causa de log)
        import tempfile
        log_dir = Path(tempfile.gettempdir()) / "cremepe-office-logs"
        log_dir.mkdir(parents=True, exist_ok=True)

    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)

    if not _configured:
        formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)

        # Remove handlers pré-existentes: bibliotecas como pdf2docx chamam
        # logging.basicConfig() no import e configuram formato/destino próprios,
        # o que duplicaria cada linha no console e no arquivo.
        for h in root.handlers[:]:
            root.removeHandler(h)

        file_handler = RotatingFileHandler(
            log_dir / "backend.log",
            maxBytes=MAX_BYTES,
            backupCount=BACKUP_COUNT,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)

        # Console: capturado pelo Electron (pipe) em produção, visível em dev.
        # Em ambiente sem stdout (pythonw), grava apenas no arquivo.
        console_stream = sys.stdout or sys.stderr
        if console_stream is not None:
            console_handler = logging.StreamHandler(console_stream)
            console_handler.setFormatter(formatter)
            root.addHandler(console_handler)

        # Requisições do Werkzeug são redundantes com register_request_logging
        logging.getLogger("werkzeug").setLevel(logging.WARNING)

        _configured = True

    return log_dir


def register_request_logging(app, skip_paths=("/api/health",)):
    """Loga cada requisição da API: método, rota, status e duração.

    O health check é excluído (polling do Electron a cada 5s encheria o log).
    Nível WARNING para respostas >= 500.
    """
    from flask import g, request

    api_logger = logging.getLogger("api")

    @app.before_request
    def _mark_request_start():
        g._request_start = time.perf_counter()

    @app.after_request
    def _log_request(response):
        if request.path in skip_paths:
            return response

        duration_ms = -1.0
        start = getattr(g, "_request_start", None)
        if start is not None:
            duration_ms = (time.perf_counter() - start) * 1000

        level = logging.WARNING if response.status_code >= 500 else logging.INFO
        api_logger.log(
            level,
            "%s %s -> %s (%.0f ms)",
            request.method,
            request.path,
            response.status_code,
            duration_ms,
        )
        return response
