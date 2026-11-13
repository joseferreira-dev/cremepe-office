import os

from app import app

if __name__ == '__main__':
    # Produção (backend.exe): somente localhost e NUNCA debug.
    # O debugger do Werkzeug permite execução de código arbitrário e
    # por isso é inaceitável em ambiente de usuário final.
    port = int(os.environ.get('PORT', 5000))
    app.run(host='127.0.0.1', port=port, debug=False)
