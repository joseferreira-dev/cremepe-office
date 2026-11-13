"""Jobs assíncronos da API + progresso reportável.

O Flask já é threaded por padrão (não bloqueia o health check), então o
job existe como TRANSPORTE DE PROGRESSO: uma operação roda numa thread
e o cliente consulta o percentual intermediário via GET /api/jobs/<id>
— algo impossível numa resposta HTTP única (a barra antes pulava 0->100).

Progresso via ContextVar: o runner do job associa um callback ao
contexto da thread; services chamam report_progress(current, total)
direto no loop, sem assinaturas atravessando route -> controller ->
service (mecanismo que ja existia parcialmente em file_manager com
progress_callback=None — nunca alimentado). Fora de um job,
report_progress e um no-op.
"""
import threading
import time
import uuid
from contextvars import ContextVar

# Callback de progresso da thread atual (None fora de um job)
_progress: ContextVar = ContextVar("job_progress", default=None)

# Idade maxima de um job antes da poda (segundos) e teto de jobs
JOB_MAX_AGE = 3600
JOB_MAX_COUNT = 200


def report_progress(current: int, total: int, message: str = None) -> None:
    """Reporta progresso da operação em andamento (no-op fora de um job).

    current/total em unidades do trabalho (arquivos, paginas...).
    Nunca levanta exceção: falha de progresso não derruba a operação.
    """
    callback = _progress.get()
    if callback is None:
        return
    try:
        callback(current, total, message)
    except Exception:
        pass


def _set_progress(callback):
    """Associa o callback ao contexto da thread atual; devolve o token."""
    return _progress.set(callback)


def _reset_progress(token):
    _progress.reset(token)


class Job:
    """Estado de uma operação executada em background."""

    def __init__(self, job_id: str, label: str):
        self.id = job_id
        self.label = label
        self.status = "queued"  # queued -> running -> done | error
        self.progress = 0
        self.message = None
        self.result = None
        self.error = None
        # Status HTTP original da falha (400/404/500...) — preservado do
        # contrato sincronico; informacao util p/ diagnostico/testes.
        self.error_status = None
        self.created_at = time.time()
        self.finished_at = None
        self._lock = threading.Lock()

    def mark_running(self):
        with self._lock:
            if self.status == "queued":
                self.status = "running"

    def report(self, current: int, total: int, message=None):
        """Recebe report_progress(); atualiza o percentual."""
        with self._lock:
            if self.status not in ("queued", "running"):
                return
            if total and total > 0:
                self.progress = max(0, min(100, int(current * 100 / total)))
            if message is not None:
                self.message = message

    def succeed(self, result) -> None:
        with self._lock:
            self.status = "done"
            self.progress = 100
            self.result = result
            self.finished_at = time.time()

    def fail(self, error: str, status: int = 500) -> None:
        with self._lock:
            self.status = "error"
            self.error = error
            self.error_status = status
            self.finished_at = time.time()

    def to_dict(self) -> dict:
        with self._lock:
            return {
                "job_id": self.id,
                "label": self.label,
                "status": self.status,
                "progress": self.progress,
                "message": self.message,
                "result": self.result,
                "error": self.error,
                "error_status": self.error_status,
            }


class JobManager:
    """Registro de jobs em memória (singleton: jobs)."""

    def __init__(self):
        self._jobs = {}
        self._lock = threading.Lock()

    def create(self, label: str) -> Job:
        with self._lock:
            self._prune()
            job = Job(uuid.uuid4().hex, label)
            self._jobs[job.id] = job
            return job

    def get(self, job_id: str):
        with self._lock:
            return self._jobs.get(job_id)

    def _prune(self):
        """Remove jobs antigos (chamado sob lock)."""
        now = time.time()
        stale = [
            jid for jid, job in self._jobs.items()
            if now - job.created_at > JOB_MAX_AGE
        ]
        for jid in stale:
            del self._jobs[jid]
        # teto absoluto: descarta os mais antigos
        overflow = len(self._jobs) - JOB_MAX_COUNT
        if overflow > 0:
            by_age = sorted(self._jobs.values(), key=lambda j: j.created_at)
            for job in by_age[:overflow]:
                del self._jobs[job.id]


# Singleton usado por as_job (rotas) e report_progress (services)
jobs = JobManager()
