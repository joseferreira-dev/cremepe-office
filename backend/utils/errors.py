"""Handlers globais de erro da API.

Centraliza a tradução de exceções em respostas JSON no formato
{"error": "..."} — o mesmo formato que o frontend já espera — via
handlers globais do Flask (nenhuma rota precisa de try/except próprio).

Mapeamento de status:
    ValidationError / ValueError          -> 400
    FileNotFoundError                     -> 404
    PermissionError                       -> 403
    ImportError (dependência ausente)      -> 500
    CREMEPEException (status_code da classe) -> 400/404/500
    HTTPException (rota inexistente etc.)  -> seu próprio código
    Qualquer outra exceção                -> 500 (com traceback no log)

describe_exception() é a FONTE ÚNICA desse mapeamento: usada pelos
handlers E pelo sistema de jobs (utils/job_routes.py), que preserva o
status original em job.error_status.
"""

import logging

from flask import jsonify
from werkzeug.exceptions import HTTPException

from utils.exceptions import CREMEPEException

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
