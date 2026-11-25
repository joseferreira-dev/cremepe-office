from flask import Blueprint, jsonify

from utils.jobs import jobs

jobs_bp = Blueprint('jobs', __name__)


@jobs_bp.route('/<job_id>', methods=['GET'])
def get_job(job_id):
    """Status de um job: usado pelo frontend para acompanhar progresso."""
    job = jobs.get(job_id)
    if job is None:
        return jsonify({"error": "Job não encontrado ou expirado"}), 404
    return jsonify(job.to_dict()), 200


@jobs_bp.route('/<job_id>/cancel', methods=['POST'])
def cancel_job(job_id):
    """Cancela um job (cooperativo: encerra no proximo report_progress).

    Job na fila vira 'cancelled' na hora; em andamento recebe o pedido
    (flag) e o runner encerra no proximo ponto de progresso; ja
    finalizado: no-op (devolve o status atual).
    """
    job = jobs.get(job_id)
    if job is None:
        return jsonify({"error": "Job não encontrado ou expirado"}), 404
    job.request_cancel()
    return jsonify({"success": True, "status": job.status,
                    "cancel_requested": True}), 200
