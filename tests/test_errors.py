"""Erros globais da API + describe_exception (fonte unica)."""
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


# ===== describe_exception: erros operacionais (item 5) =====

def test_describe_file_exists_e_409():
    """Saida ja existe (split/rename sem overwrite): conflito, nao 500."""
    msg, status = describe_exception(
        FileExistsError("Parte ja existe: out.part0001.bin"))
    assert status == 409
    assert "Parte ja existe" in msg


def test_describe_bad_zip_e_400_tanto_zipfile_quanto_pyzipper():
    import zipfile as zf
    msg, status = describe_exception(zf.BadZipFile("File is not a zip file"))
    assert status == 400
    assert "not a zip file" in msg

    # pyzipper (usado no /extract) levanta a classe PROPRIA, que nao
    # herda da do zipfile — precisa do mesmo mapeamento.
    try:
        from pyzipper.zipfile import BadZipFile as PyBadZip
    except Exception:
        return  # pyzipper opcional ausente
    _, status2 = describe_exception(PyBadZip("File is not a zip file"))
    assert status2 == 400


def test_describe_pikepdf_dependency_error_e_409():
    """Codec ausente (jbig2dec): estado do ambiente, nem 500 nem 400."""
    import pikepdf
    msg, status = describe_exception(
        pikepdf.DependencyError("jbig2dec - not installed or not found"))
    assert status == 409
    assert "jbig2dec" in msg


def test_describe_runtime_error_operacional_continua_500():
    """RuntimeError generico NAO vira 400: esconderia bugs reais."""
    _, status = describe_exception(RuntimeError("Erro ao comprimir PDF: x"))
    assert status == 500


# ===== API: respostas de erro em JSON (formato {error}) =====

def test_health_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.get_json() == {"success": True, "status": "ok"}


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


def test_split_partes_existente_vira_409_via_job(client, tmp_path):
    """FileExistsError do splitter: contrato async preserva 409 (conflito)."""
    src = tmp_path / "grande.bin"
    src.write_bytes(b"x" * (1024 * 1024 + 10))  # 1 MiB + 10 => 2 partes
    out = tmp_path / "partes"

    r1 = post_sync(client, "/api/files/split", json={
        "file_path": str(src), "output_dir": str(out), "part_size_mb": 1,
    })
    assert r1.status_code == 200, r1.get_json()

    # segunda vez sem overwrite: partes ja existem -> 409
    r2 = post_sync(client, "/api/files/split", json={
        "file_path": str(src), "output_dir": str(out), "part_size_mb": 1,
    })
    assert r2.status_code == 409, r2.get_json()
    assert "existe" in r2.get_json()["error"]


def test_extract_zip_corrompido_vira_400_via_job(client, tmp_path):
    """BadZipFile do /extract: contrato async preserva 400 (entrada ruim)."""
    bad = tmp_path / "ruim.zip"
    bad.write_bytes(b"nao sou um zip de verdade")

    r = post_sync(client, "/api/files/extract", json={
        "archive_path": str(bad), "extract_dir": str(tmp_path / "saida"),
    })
    assert r.status_code == 400, r.get_json()
    assert "error" in r.get_json()
