"""Helpers da suíte — entendem o contrato async da API.

POSTs de execução respondem 202 {job_id}; validação de campos continua
400 imediato. post_sync faz o polling e devolve uma resposta
TRANSPARENTE (status_code + get_json) preservando o contrato original:
  - validação (400) -> repassa direto (sem job)
  - job done       -> 200 + result
  - job error      -> error_status (400/404/500 original) + {error}
"""
import time


class FakeResponse:
    """Minimalmente compatível com a resposta do Flask test_client."""

    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body

    def get_json(self):
        return self._body

    @property
    def is_json(self):
        return True


def post_sync(client, url, json=None, timeout=30, **kwargs):
    """POST que acompanha jobs até terminarem; devolve resposta síncrona."""
    r = client.post(url, json=json, **kwargs)
    if r.status_code != 202:
        return r
    job = wait_job(client, r.get_json()["job_id"], timeout=timeout)
    if job["status"] == "done":
        return FakeResponse(200, job["result"])
    return FakeResponse(job.get("error_status") or 500, {"error": job["error"]})


def wait_job(client, job_id, timeout=30):
    """Espera um job terminar e devolve o dict final."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = client.get(f"/api/jobs/{job_id}").get_json()
        if job["status"] in ("done", "error"):
            return job
        time.sleep(0.05)
    raise TimeoutError(f"job {job_id} nao terminou em {timeout}s")
