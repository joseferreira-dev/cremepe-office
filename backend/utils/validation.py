"""Validação de payload das rotas da API.

Fornece o decorator @require, que unifica a validação de campos
obrigatórios das rotas POST em uma única declaração por rota.
"""

from functools import wraps

from flask import request

from utils.exceptions import ValidationError


def require(*fields):
    """Exige um corpo JSON objeto e os campos obrigatórios informados.

    Decorator de rota que:
      1. Lê o corpo da requisição e garante que é um objeto JSON
         (ausente, malformado ou não-objeto -> 400);
      2. Verifica que todos os ``fields`` estão presentes e não-vazios
         (faltando -> 400, listando TODOS os campos ausentes);
      3. Injeta o dict parseado como primeiro argumento (``data``) da view.

    Exemplo::

        @pdf_bp.route('/merge', methods=['POST'])
        @require('pdf_paths', 'output_path')
        def merge(data):
            result = controller.merge(data['pdf_paths'], data['output_path'])
            ...

    A ordem dos decoradores importa: @route (de cima) registra o wrapper
    gerado por @require, então @require sempre fica abaixo de @route.
    """
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            data = request.get_json(silent=True)
            if not isinstance(data, dict):
                raise ValidationError(
                    "Corpo da requisição deve ser um objeto JSON válido"
                )

            missing = [field for field in fields if not data.get(field)]
            if len(missing) == 1:
                raise ValidationError(f"Campo obrigatório: {missing[0]}")
            if missing:
                raise ValidationError(
                    f"Campos obrigatórios: {', '.join(missing)}"
                )

            return view(data, *args, **kwargs)
        return wrapper
    return decorator
