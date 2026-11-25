"""Jobs assincronos + progresso real."""
import time

from utils import jobs as jobs_mod
from utils.jobs import Job, report_progress

from helpers import post_sync, wait_job


# ===== Ciclo de vida =====

def test_post_devolve_202_e_job_id(client, tmp_path):
    r = client.post("/api/files/list", json={"dir": str(tmp_path)})
    assert r.status_code == 202
    body = r.get_json()
    assert body["job_id"]
    assert body["status"] in ("queued", "running")


def test_job_termina_done_com_progresso_100(client, tmp_path):
    r = client.post("/api/files/list", json={"dir": str(tmp_path)})
    job = wait_job(client, r.get_json()["job_id"])
    assert job["status"] == "done"
    assert job["progress"] == 100


def test_shape_do_result_e_identico_ao_sincrono(client, tmp_path):
    """As features nao mudam: result tem {success, files}."""
    r = post_sync(client, "/api/files/list", json={"dir": str(tmp_path)})
    body = r.get_json()
    assert body["success"] is True
    assert isinstance(body["files"], list)
    # o resultado NUNCA carrega o envelope do job (evita polling infinito)
    assert "job_id" not in body
    assert "status" not in body or body["status"] != "queued"


def test_job_inexistente_vira_404_json(client):
    r = client.get("/api/jobs/naoexiste123")
    assert r.status_code == 404
    assert r.is_json
    assert "error" in r.get_json()


# ===== Erros preservam status original =====

def test_excecao_de_service_preserva_404(client, tmp_path):
    r = client.post("/api/pdf/merge", json={
        "pdf_paths": [str(tmp_path / "nao.pdf")],
        "output_path": str(tmp_path / "out.pdf"),
    })
    job = wait_job(client, r.get_json()["job_id"])
    assert job["status"] == "error"
    assert job["error_status"] == 404
    assert "não encontrado" in job["error"]


def test_validacao_inline_preserva_400(client):
    r = client.post("/api/pdf/compress", json={
        "input_path": "a.pdf", "output_path": "b.pdf",
        "compression_level": "invalido",
    })
    job = wait_job(client, r.get_json()["job_id"])
    assert job["status"] == "error"
    assert job["error_status"] == 400
    assert "compressão" in job["error"]


# ===== report_progress: unidade do progresso =====

def test_report_fora_de_job_e_no_op():
    # nao levanta e nao faz nada
    report_progress(1, 2)


def test_job_report_calcula_percentual():
    job = Job("id1", "teste")
    job.mark_running()
    job.report(3, 10)
    assert job.to_dict()["progress"] == 30
    job.report(10, 10)
    assert job.to_dict()["progress"] == 100


def test_job_report_com_total_zero_nao_quebra():
    job = Job("id2", "teste")
    job.report(1, 0)
    assert job.to_dict()["progress"] == 0


def test_job_report_ignora_apos_concluir():
    job = Job("id3", "teste")
    job.succeed({"ok": True})
    job.report(5, 10)
    assert job.to_dict()["progress"] == 100
    assert job.to_dict()["status"] == "done"


def test_report_progress_atualiza_job_via_contextvar():
    """O contextvar associado pelo runner e o canal do progresso."""
    collected = []
    token = jobs_mod._progress.set(
        lambda cur, tot, msg=None: collected.append((cur, tot))
    )
    try:
        report_progress(1, 4)
        report_progress(4, 4)
    finally:
        jobs_mod._progress.reset(token)
    assert collected == [(1, 4), (4, 4)]


def test_progresso_intermediario_visivel_durante_execucao(client, monkeypatch):
    """Polling ve % INTERMEDIÁRIO real: service fake reporta e demora.

    Substitui a instanciacao do controller (routes.pdf_routes.controller)
    por um fake que reporta progresso (1/4 -> 4/4) com sleeps — o
    polling deve observar valores intermediarios entre 0 e 100, e nao
    apenas o salto final.
    """
    from routes import pdf_routes

    def fake_merge(pdf_paths, output_path):
        report_progress(1, 4)
        time.sleep(0.35)
        report_progress(2, 4)
        time.sleep(0.35)
        report_progress(4, 4)
        return output_path

    # patch na INSTANCIA (functions em instancia nao ganham self)
    monkeypatch.setattr(pdf_routes.controller, "merge", fake_merge)

    r = client.post("/api/pdf/merge", json={
        "pdf_paths": ["a.pdf", "b.pdf"], "output_path": "out.pdf",
    })
    assert r.status_code == 202
    job_id = r.get_json()["job_id"]

    # observa todos os valores de progresso reportados no polling
    seen = []
    deadline = time.time() + 15
    while time.time() < deadline:
        job = client.get(f"/api/jobs/{job_id}").get_json()
        seen.append(job["progress"])
        if job["status"] in ("done", "error"):
            break
        time.sleep(0.08)

    assert job["status"] == "done", job
    assert any(0 < p < 100 for p in seen), \
        f"nunca viu progresso intermediario: {seen}"
    assert seen[-1] == 100


# ===== Podagem do JobManager =====

def test_jobmanager_poda_jobs_antigos(monkeypatch):
    mgr = jobs_mod.JobManager()
    job = mgr.create("antigo")
    # simula idade maxima excedida
    job.created_at = time.time() - (jobs_mod.JOB_MAX_AGE + 10)
    novo = mgr.create("novo")
    assert mgr.get(job.id) is None  # podado
    assert mgr.get(novo.id) is not None


def test_jobmanager_respeita_teto_de_jobs(monkeypatch):
    mgr = jobs_mod.JobManager()
    monkeypatch.setattr(jobs_mod, "JOB_MAX_COUNT", 5)
    ids = [mgr.create(f"j{i}").id for i in range(8)]
    # os3 mais antigos sairam; os5 mais recentes ficaram
    assert mgr.get(ids[0]) is None
    assert mgr.get(ids[2]) is None
    assert mgr.get(ids[7]) is not None


# ===== Cancelamento =====

def test_cancel_mecanismo_cooperativo():
    """request_cancel faz report_progress levantar JobCancelled e um
    job na fila vira 'cancelled' na hora."""
    from utils.jobs import JobCancelled

    job = jobs_mod.jobs.create("teste-cancel-report")
    token = jobs_mod._progress.set(job.report)
    try:
        job.request_cancel()
        try:
            report_progress(1, 10)
            raise AssertionError("report_progress nao levantou JobCancelled")
        except JobCancelled:
            pass
    finally:
        jobs_mod._progress.reset(token)

    fila = jobs_mod.jobs.create("teste-cancel-fila")
    fila.request_cancel()
    assert fila.status == "cancelled"


def test_rota_cancel_job(client):
    job = jobs_mod.jobs.create("teste-cancel-rota")
    r = client.post(f"/api/jobs/{job.id}/cancel")
    assert r.status_code == 200
    body = r.get_json()
    assert body["success"] is True
    assert body["status"] == "cancelled"

    # id inexistente -> 404
    r2 = client.post("/api/jobs/naoexiste999/cancel")
    assert r2.status_code == 404

    # job finalizado: no-op devolve o status atual (done)
    pronto = jobs_mod.jobs.create("teste-cancel-done")
    pronto.mark_running()
    pronto.succeed({"ok": True})
    r3 = client.post(f"/api/jobs/{pronto.id}/cancel")
    assert r3.status_code == 200
    assert r3.get_json()["status"] == "done"


def test_cancel_e2e_encerra_job_em_andamento(client, monkeypatch):
    """POST /pdf/split-fixed com service lento: cancela no meio e o
    job termina como 'cancelled' (o runner intercepta JobCancelled)."""
    import time as _time

    import controllers.pdf_controller as pc
    from utils.jobs import report_progress

    def lento(*args, **kwargs):
        for i in range(200):
            report_progress(i + 1, 200)
            _time.sleep(0.02)  # ~4s no total
        return {"total_pages": 200, "total_files": 1,
                "output_files": [], "errors": []}

    monkeypatch.setattr(pc, "split_fixed", lento)

    r = client.post("/api/pdf/split-fixed",
                    json={"pdf_path": "qualquer.pdf",
                          "output_dir": "/tmp/x", "pages_per_file": 10})
    assert r.status_code == 202
    job_id = r.get_json()["job_id"]

    # espera o progresso comecar (2o report -> progress >= 1)
    for _ in range(200):
        job = client.get(f"/api/jobs/{job_id}").get_json()
        if job["progress"] > 0:
            break
        _time.sleep(0.02)
    c = client.post(f"/api/jobs/{job_id}/cancel")
    assert c.status_code == 200, c.get_json()

    # termina como cancelled (cooperativo, no proximo report)
    for _ in range(300):
        job = client.get(f"/api/jobs/{job_id}").get_json()
        if job["status"] in ("done", "error", "cancelled"):
            break
        _time.sleep(0.02)
    assert job["status"] == "cancelled", job
