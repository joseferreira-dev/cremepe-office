"""Handlers globais de erro da API.

Centraliza a tradução de exceções em respostas JSON no formato
{"error": "..."} — o mesmo formato que o frontend já espera — via
handlers globais do Flask (nenhuma rota precisa de try/except próprio).

Mapeamento de status:
    ValidationError / ValueError          -> 400
    zipfile.BadZipFile (entrada inválida) -> 400
    FileNotFoundError                     -> 404
    PermissionError                       -> 403
    FileExistsError (saída já existe)     -> 409
    pikepdf.DependencyError (codec ausente) -> 409
    ImportError (dependência ausente)      -> 500
    CREMEPEException (status_code da classe) -> 400/404/500
    HTTPException (rota inexistente etc.)  -> seu próprio código
    Qualquer outra exceção                -> 500 (com traceback no log)

Erros OPERACIONAIS conhecidos (saída já existe, zip corrompido, codec
ausente) não são 500 "Erro interno": são estados que o usuário ou o
ambiente resolve, então recebem status específico. RuntimeError genérico
continua 500 — mapeá-lo para 400 esconderia bugs reais atrás de um
"bad request".

describe_exception() é a FONTE ÚNICA desse mapeamento: usada pelos
handlers E pelo sistema de jobs (utils/job_routes.py), que preserva o
status original em job.error_status.
"""

import logging
import zipfile

from flask import jsonify
from werkzeug.exceptions import HTTPException

from utils.exceptions import CREMEPEException

# BadZipFile do pyzipper (AES) é uma cópia INDEPENDENTE — não herda da
# do zipfile padrão. O /extract tenta pyzipper primeiro e propaga o erro
# dele, então as duas classes precisam do mesmo mapeamento 400.
# pyzipper é opcional no projeto (import guardado).
try:
    from pyzipper.zipfile import BadZipFile as _PyzipperBadZipFile
    _BAD_ZIP_ERRORS = (zipfile.BadZipFile, _PyzipperBadZipFile)
except Exception:  # pragma: no cover - pyzipper ausente
    _BAD_ZIP_ERRORS = (zipfile.BadZipFile,)

# Codec de stream ausente no ambiente (ex.: jbig2dec em PDF de scanner):
# limitação do SERVIDOR, não bug nem erro de entrada -> 409.
try:
    from pikepdf import DependencyError as _PikepdfDependencyError
except Exception:  # pragma: no cover - pikepdf ausente
    _PikepdfDependencyError = None

logger = logging.getLogger(__name__)


def describe_exception(exc) -> tuple:
    """(mensagem, status) para uma exceção — fonte única do mapeamento."""
    if isinstance(exc, HTTPException):
        return exc.description, exc.code
    if isinstance(exc, CREMEPEException):
        return str(exc), getattr(exc, "status_code", 500)
    if isinstance(exc, FileNotFoundError):
        return str(exc) or "Arquivo não encontrado", 404
    if isinstance(exc, PermissionError):
        return str(exc) or "Permissão negada", 403
    if isinstance(exc, FileExistsError):
        # Conflito: o arquivo de saída pedido já existe (rename/split
        # sem overwrite) — o usuário resolve escolhendo outro nome.
        return str(exc) or "Arquivo de saída já existe", 409
    if isinstance(exc, _BAD_ZIP_ERRORS):
        # Entrada inválida: o usuário indicou um zip corrompido/não-zip.
        return str(exc) or "Arquivo ZIP inválido ou corrompido", 400
    if _PikepdfDependencyError is not None and isinstance(
            exc, _PikepdfDependencyError):
        # Estado do ambiente (codec ausente): nem bug (500) nem entrada
        # do usuário (400) — o servidor não pode processar este arquivo.
        return str(exc) or "Codec de decodificação indisponível", 409
    if isinstance(exc, ValueError):
        return str(exc), 400
    if isinstance(exc, ImportError):
        return f"Dependência ausente: {exc}", 500
    return f"Erro interno: {exc}", 500


def _error_response(message, status):
    return jsonify({"error": message}), status


def register_error_handlers(app):
    """Registra os handlers globais de erro no app Flask."""

    def respond(exc):
        message, status = describe_exception(exc)
        return _error_response(message, status)

    # --- Erros de domínio definidos pelo projeto ---
    @app.errorhandler(CREMEPEException)
    def handle_domain_error(exc):
        _, status = describe_exception(exc)
        if status >= 500:
            logger.error("Erro de domínio: %s", exc, exc_info=exc)
        return respond(exc)

    # --- Erros de entrada do usuário (lançados pelos services) ---
    @app.errorhandler(ValueError)
    def handle_value_error(exc):
        return respond(exc)

    @app.errorhandler(FileNotFoundError)
    def handle_file_not_found(exc):
        return respond(exc)

    @app.errorhandler(PermissionError)
    def handle_permission_error(exc):
        return respond(exc)

    @app.errorhandler(ImportError)
    def handle_import_error(exc):
        return respond(exc)

    # --- HTTP: rota inexistente, método errado, JSON malformado ---
    @app.errorhandler(HTTPException)
    def handle_http_error(exc):
        return respond(exc)

    # --- Qualquer outro erro: registra o traceback e devolve 500 ---
    @app.errorhandler(Exception)
    def handle_unexpected_error(exc):
        logger.error("Erro não tratado: %s", exc, exc_info=exc)
        return respond(exc)
