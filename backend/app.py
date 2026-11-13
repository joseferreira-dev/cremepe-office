import os
import logging

# Logging configurado ANTES dos imports pesados: se algum import falhar
# (ex.: dependência ausente como pdf2docx), o traceback já vai para o
# arquivo de log em vez de se perder no stderr de um app GUI.
from utils.logger import setup_logging, register_request_logging

log_dir = setup_logging()
logger = logging.getLogger(__name__)

from flask import Flask
from flask_cors import CORS

from routes.file_routes import file_bp
from routes.pdf_routes import pdf_bp
from routes.word_routes import word_bp
from routes.excel_routes import excel_bp
from routes.jobs_routes import jobs_bp
from utils.errors import register_error_handlers

app = Flask(__name__)
CORS(app)

# Handlers globais de erro (utils/errors.py)
register_error_handlers(app)

# Log de cada requisição da API (utils/logger.py)
register_request_logging(app)

# Registra blueprints
app.register_blueprint(file_bp, url_prefix='/api/files')
app.register_blueprint(pdf_bp, url_prefix='/api/pdf')
app.register_blueprint(word_bp, url_prefix='/api/word')
app.register_blueprint(excel_bp, url_prefix='/api/excel')
app.register_blueprint(jobs_bp, url_prefix='/api/jobs')

@app.route('/api/health', methods=['GET'])
def health():
    return {"status": "ok"}, 200

logger.info("Backend iniciado | logs em %s", log_dir)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # Somente localhost: a API não deve ficar exposta na rede local.
    # Debug somente com FLASK_DEBUG=1 (padrão: desligado). Em produção o
    # backend é iniciado por __main__.py (backend.exe), que nunca usa debug.
    debug = os.environ.get('FLASK_DEBUG', '').lower() in ('1', 'true', 'yes')
    logger.info("Servidor em http://127.0.0.1:%s (debug=%s)", port, debug)
    app.run(host='127.0.0.1', port=port, debug=debug)