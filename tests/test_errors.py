"""Erros globais da API (item 1) + describe_exception (fonte unica)."""
from werkzeug.exceptions import BadRequest, NotFound

from utils.exceptions import NotFoundError, ValidationError
from utils.errors import describe_exception

from helpers import post_sync


# ===== describe_exception: mapeamento excecao -> (mensagem, status) =====

def test_describe_value_error_e_400():
    msg, status = describe_exception(ValueError("intervalo invalido"))
    assert status == 400
    assert "intervalo invalido" in msg


def test_describe_file_not_found_e_404():
    msg, status = describe_exception(FileNotFoundError("C:\\nao\\existe.pdf"))
    assert status == 404
    assert "nao\\existe.pdf" in msg


def test_describe_permission_error_e_403():
    _, status = describe_exception(PermissionError("acesso negado"))
    assert status == 403


def test_describe_import_error_vira_500_com_contexto():
    msg, status = describe_exception(ImportError("py7zr nao instalado"))
    assert status == 500
    assert msg.startswith("Dependência ausente:")


def test_describe_cremepe_exception_usa_status_da_classe():
    _, status = describe_exception(NotFoundError("planilha nao encontrada"))
    assert status == 404
    _, status = describe_exception(ValidationError("campo invalido"))
    assert status == 400


def test_describe_http_exception_usa_proprio_codigo():
    msg, status = describe_exception(NotFound())
    assert status == 404
    assert isinstance(msg, str) and msg


def test_describe_excecao_generica_vira_500():
    msg, status = describe_exception(RuntimeError("boom"))
    assert status == 500
    assert msg.startswith("Erro interno:")


# ===== API: respostas de erro em JSON (formato {error}) =====

def test_health_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.get_json() == {"status": "ok"}


def test_rota_inexistente_vira_404_json(client):
    r = client.get("/api/rota-que-nao-existe")
    assert r.status_code == 404
    assert r.is_json
    assert "error" in r.get_json()


def test_metodo_errado_vira_405_json(client):
    r = client.get("/api/pdf/merge")  # rota so aceita POST
    assert r.status_code == 405
    assert r.is_json
    assert "error" in r.get_json()


def test_json_malformado_vira_400_json(client):
    r = client.post("/api/pdf/merge", data="{isso nao e json",
                    content_type="application/json")
    assert r.status_code == 400
    assert r.is_json
    assert "error" in r.get_json()


def test_json_nao_objeto_vira_400(client):
    r = client.post("/api/pdf/merge", json=["lista", "nao", "objeto"])
    assert r.status_code == 400
    assert "objeto JSON" in r.get_json()["error"]


def test_json_null_vira_400(client):
    r = client.post("/api/pdf/merge", json=None)
    assert r.status_code == 400
    assert "objeto JSON" in r.get_json()["error"]


def test_erro_de_execucao_preserva_404_via_job(client, tmp_path):
    """FileNotFoundError do service: contrato async preserva o status 404."""
    r = post_sync(client, "/api/pdf/merge", json={
        "pdf_paths": [str(tmp_path / "nao_existe.pdf")],
        "output_path": str(tmp_path / "out.pdf"),
    })
    assert r.status_code == 404
    assert "não encontrado" in r.get_json()["error"]
