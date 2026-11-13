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
