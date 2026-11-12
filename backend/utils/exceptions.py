"""Exceções de domínio do CREMEPE Office.

Todas as exceções específicas do projeto herdam de CREMEPEException,
o que permite aos handlers globais de erro (utils/errors.py) traduzi-las
em respostas HTTP adequadas sem repetir try/except em cada rota.
"""


class CREMEPEException(Exception):
    """Base exception para o projeto."""

    status_code = 500

    def __init__(self, message=None):
        super().__init__(message or self.__class__.__name__)
        self.message = str(self)


class ValidationError(CREMEPEException):
    """Dados de entrada inválidos (HTTP 400)."""

    status_code = 400


class NotFoundError(CREMEPEException):
    """Recurso (arquivo/pasta) não encontrado (HTTP 404)."""

    status_code = 404


class FileOperationError(CREMEPEException):
    """Falha em operação com arquivos (HTTP 500)."""


class PDFOperationError(CREMEPEException):
    """Falha em operação com PDF (HTTP 500)."""


class DependencyError(CREMEPEException):
    """Dependência opcional ausente no ambiente (HTTP 500)."""

    status_code = 500
