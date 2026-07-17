class CREMEPEException(Exception):
    """Base exception para o projeto."""
    pass

class FileOperationError(CREMEPEException):
    pass

class PDFOperationError(CREMEPEException):
    pass