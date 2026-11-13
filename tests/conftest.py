"""Fixtures da suíte pytest.

CRÍTICO: CREMEPE_LOG_DIR é definido ANTES de importar o app — o logging
é configurado no import de app.py e usa esse diretorio.
"""
import os
import tempfile
from pathlib import Path

# Diretorio de log da sessao, definido antes do primeiro import do app
os.environ["CREMEPE_LOG_DIR"] = tempfile.mkdtemp(prefix="cremepe-tests-log-")

import pytest  # noqa: E402
from app import app as flask_app  # noqa: E402  (pythonpath=backend do pyproject)

flask_app.config["TESTING"] = True

# Raiz do repositorio (para testes de integracao que sobem o servidor)
REPO_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture()
def app():
    return flask_app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def log_file():
    """Caminho do backend.log da sessao."""
    return Path(os.environ["CREMEPE_LOG_DIR"]) / "backend.log"


@pytest.fixture()
def pdf_factory(tmp_path):
    """Cria PDFs em branco de N paginas (fixtures dos testes de services)."""
    import pikepdf

    def make(pages=1, name="doc.pdf"):
        path = tmp_path / name
        with pikepdf.new() as pdf:
            for _ in range(pages):
                pdf.add_blank_page()
            pdf.save(str(path))
        return path

    return make


@pytest.fixture()
def progress_collector():
    """Coleta report_progress() de chamadas DIRETAS a services.

    (Em chamadas via API o contextvar pertence a thread do job — nesse
    caso use a funcao fake que chama report_progress dentro do job.)
    """
    from utils import jobs as jobs_mod

    collected = []
    token = jobs_mod._progress.set(
        lambda cur, tot, msg=None: collected.append((cur, tot))
    )
    yield collected
    jobs_mod._progress.reset(token)
