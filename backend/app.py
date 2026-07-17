import os
from flask import Flask
from flask_cors import CORS

from routes.file_routes import file_bp
from routes.pdf_routes import pdf_bp
from routes.word_routes import word_bp
from routes.excel_routes import excel_bp

app = Flask(__name__)
CORS(app)

# Registra blueprints
app.register_blueprint(file_bp, url_prefix='/api/files')
app.register_blueprint(pdf_bp, url_prefix='/api/pdf')
app.register_blueprint(word_bp, url_prefix='/api/word')
app.register_blueprint(excel_bp, url_prefix='/api/excel')

@app.route('/api/health', methods=['GET'])
def health():
    return {"status": "ok"}, 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)