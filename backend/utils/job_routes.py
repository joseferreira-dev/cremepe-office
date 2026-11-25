"""Decorator @as_job: executa uma view em background e devolve 202+job_id.

Ordem dos decoradores da rota (importante):

    @bp.route('/x', methods=['POST'])
    @require('a', 'b')      # valida SINCRONAMENTO (request context) -> 400 imediato
    @as_job()               # execucao em thread -> {job_id}, 202
    def view(data):
        ...

@require fica ACIMA de @as_job: o require roda no thread da requisicao
(erros de validacao continuam 400 imediatos) e so chama o as_job em
seguida, que spawna a thread e responde 202 na hora.

A view roda na thread com um app context PROPRIO (jsonify exige app
context; nenhuma view acessa request/g — elas recebem apenas o payload
já validado). O resultado (response, status) e capturado como
job.result, ou transformado em job.error quando status >= 400 —
preservando as mensagens de erro que o frontend ja exibe.
"""
import logging
import threading
from functools import wraps

from flask import jsonify

from utils.errors import describe_exception
from utils.jobs import JobCancelled, jobs, _set_progress, _reset_progress

logger = logging.getLogger(__name__)


def as_job(label: str = None):
    """Roda a view numa thread; resposta imediata {job_id, status}: 202."""

    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            from flask import current_app, has_app_context

            # Captura o app (existe em toda requisicao de rota) — o runner
            # precisa dele para criar um app context na thread.
            flask_app = current_app._get_current_object() if has_app_context() else None
            job_label = label or f"{view.__module__.rsplit('.', 1)[-1]}.{view.__name__}"
            job = jobs.create(job_label)

            def runner():
                token = _set_progress(job.report)
                try:
                    if flask_app is None:
                        # inatingivel: toda rota roda com app context
                        job.fail("Sem contexto Flask para executar a operação")
                        return
                    with flask_app.app_context():
                        # cancelado ANTES de comecar: nem inicia
                        if job.status == "cancelled":
                            return
                        job.mark_running()
                        try:
                            rv = view(*args, **kwargs)
                        except JobCancelled:
                            # pedido do usuario via report_progress
                            job.cancelled()
                            logger.info("Job %s (%s) cancelado pelo usuario",
                                        job.id, job.label)
                            return
                        except Exception as exc:
                            logger.error(
                                "Job %s (%s) falhou: %s",
                                job.id, job.label, exc, exc_info=exc,
                            )
                            # mesma (mensagem, status) do contrato sincronico
                            message, status = describe_exception(exc)
                            job.fail(message, status=status)
                            return
                        _finish_job(job, rv)
                finally:
                    _reset_progress(token)

            threading.Thread(
                target=runner, daemon=True, name=f"job-{job.id[:8]}"
            ).start()

            return jsonify({"job_id": job.id, "status": job.status}), 202

        return wrapper

    return decorator


def _finish_job(job, rv) -> None:
    """Captura o retorno da view ((response, status) ou response)."""
    # O status VERDADEIRO e o do tuple (e o que o Flask aplica no fim);
    # o proprio Response de jsonify nasce com status_code=200, entao o
    # tuple tem precedencia — sem isso uma validacao 400 viraria 'done'.
    if isinstance(rv, tuple) and len(rv) == 2 and isinstance(rv[1], int):
        body, status = rv
    elif hasattr(rv, "get_json"):
        body, status = rv, rv.status_code
    else:
        body, status = rv, 200

    # jsonify devolve um Response; extrai o corpo serializado
    if hasattr(body, "get_json"):
        data = body.get_json(silent=True) or {}
    else:
        data = body

    if isinstance(status, int) and status >= 400:
        # validacoes inline da view (ex.: nivel de compressao) -> mesmo
        # formato {error} que o frontend ja trata via throw; o status
        # original (400 aqui) e preservado em error_status
        message = data.get("error") if isinstance(data, dict) else str(data)
        job.fail(message, status=status)
    else:
        job.succeed(data)
