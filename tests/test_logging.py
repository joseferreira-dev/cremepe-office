"""Logging em arquivo da API (item 2)."""
from helpers import post_sync


def test_log_file_e_criado(log_file):
    assert log_file.exists()
    assert log_file.name == "backend.log"


def test_log_contem_linha_de_inicializacao(log_file):
    content = log_file.read_text(encoding="utf-8")
    assert "Backend iniciado" in content


def test_api_e_logada_e_health_excluido(client, log_file):
    before = log_file.read_text(encoding="utf-8")

    # 3 health checks (polling do Electron) NAO devem aparecer
    for _ in range(3):
        client.get("/api/health")

    # uma chamada de API real deve aparecer
    post_sync(client, "/api/files/list", json={"dir": "/tmp_quirque_nao_existe_"})

    # da o flush nos handlers
    import logging
    for h in logging.getLogger().handlers:
        h.flush()

    after = log_file.read_text(encoding="utf-8")
    new_lines = after[len(before):]

    assert "POST /api/files/list" in new_lines, new_lines[-500:]
    assert "GET /api/health" not in new_lines, \
        "health check (polling de 5s) nao deve poluir o log"


def test_erro_de_execucao_vai_para_o_log_com_traceback(client, log_file, tmp_path):
    """files/list com dir = arquivo (NotADirectoryError) -> [ERROR] no log."""
    fake_file = tmp_path / "nao_e_dir.txt"
    fake_file.write_text("x", encoding="utf-8")

    r = client.post("/api/files/list", json={"dir": str(fake_file)})
    from helpers import wait_job
    job = wait_job(client, r.get_json()["job_id"])
    assert job["status"] == "error"

    import logging
    for h in logging.getLogger().handlers:
        h.flush()

    content = log_file.read_text(encoding="utf-8")
    assert "[ERROR]" in content
    assert "NotADirectoryError" in content


def test_status_da_requisicao_com_job_e_registrado(client, log_file, tmp_path):
    """Com jobs, a requisicao de execucao loga 202 (o erro fica no job)."""
    before_len = len(log_file.read_text(encoding="utf-8"))
    client.post("/api/files/list", json={"dir": str(tmp_path)})

    import logging
    for h in logging.getLogger().handlers:
        h.flush()

    after = log_file.read_text(encoding="utf-8")
    new_lines = after[before_len:]
    assert "POST /api/files/list -> 202" in new_lines, new_lines[-300:]
