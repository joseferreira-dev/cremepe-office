"""Handlers globais de erro da API.

Centraliza a tradução de exceções em respostas JSON no formato
{"error": "..."} — o mesmo formato que o frontend já espera — e
elimina os blocos try/except repetidos em todas as rotas.

Mapeamento de status:
    ValidationError / ValueError          -> 400
    FileNotFoundError                     -> 404
    PermissionError                       -> 403
    ImportError (dependência ausente)      -> 500
    CREMEPEException (status_code da classe) -> 400/404/500
    HTTPException (rota inexistente etc.)  -> seu próprio código
    Qualquer outra exceção                -> 500 (com traceback no log)
"""

import logging

from flask import jsonify
from werkzeug.exceptions import HTTPException

from utils.exceptions import CREMEPEException

logger = logging.getLogger(__name__)


def _error_response(message, status):
    return jsonify({"error": message}), status


def register_error_handlers(app):
    """Registra os handlers globais de erro no app Flask."""

    # --- Erros de domínio definidos pelo projeto ---
    @app.errorhandler(CREMEPEException)
    def handle_domain_error(exc):
        status = getattr(exc, "status_code", 500)
        if status >= 500:
            logger.error("Erro de domínio: %s", exc, exc_info=exc)
        return _error_response(str(exc), status)

    # --- Erros de entrada do usuário (lançados pelos services) ---
    @app.errorhandler(ValueError)
    def handle_value_error(exc):
        return _error_response(str(exc), 400)

    @app.errorhandler(FileNotFoundError)
    def handle_file_not_found(exc):
        return _error_response(str(exc) or "Arquivo não encontrado", 404)

    @app.errorhandler(PermissionError)
    def handle_permission_error(exc):
        return _error_response(str(exc) or "Permissão negada", 403)

    @app.errorhandler(ImportError)
    def handle_import_error(exc):
        return _error_response(f"Dependência ausente: {exc}", 500)

    # --- HTTP: rota inexistente, método errado, JSON malformado ---
    @app.errorhandler(HTTPException)
    def handle_http_error(exc):
        return _error_response(exc.description, exc.code)

    # --- Qualquer outro erro: registra o traceback e devolve 500 ---
    @app.errorhandler(Exception)
    def handle_unexpected_error(exc):
        logger.error("Erro não tratado: %s", exc, exc_info=exc)
        return _error_response(f"Erro interno: {exc}", 500)
