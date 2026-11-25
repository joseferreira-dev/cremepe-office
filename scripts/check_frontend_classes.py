"""Verifica que toda classe usada nos templates existe no CSS gerado.

Roda depois de `npm run build:css`. Qualquer classe sem estilo vira
erro — pegsa utilitarios legados esquecidos e typos.

Uso: python scripts/check_frontend_classes.py
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Hooks sem estilo: classes usadas APENAS como alvo de JS (delegacao)
# ou wrappers de markup, sem regra de CSS proposital.
ALLOW_NO_STYLE = {
    'page', 'active',          # wrapper de tela (sem estilo proprio)
    'splash-container', 'spinner', 'message', 'version', 'logo',  # splash (css inline)
    # delegacao de eventos (alvos de querySelector)
    'btn-open-card', 'remove-card-btn', 'remove-field-btn',
    'btn-src-select', 'btn-src-remove', 'feature-checkbox',
    'pdf-item', 'pdf-items', 'src-dir-input',
    'field-name', 'field-source', 'field-source-container', 'field-type',
    'progress-cancel',
}


def template_tokens():
    files = [ROOT / 'frontend/index.html', ROOT / 'frontend/splash.html']
    files += sorted((ROOT / 'frontend/js').rglob('*.ts'))
    files += sorted((ROOT / 'frontend/js').rglob('*.js'))
    toks = set()
    for p in files:
        txt = p.read_text(encoding='utf-8', errors='replace')
        for m in re.finditer(r'class="([^"]*)"', txt):
            # remove interpolacoes ${...} antes de fatiar (evita pegar
            # pedacos da expressao JS como se fossem classes)
            clean = re.sub(r'\$\{[^}]*\}', ' ', m.group(1))
            for t in clean.split():
                if '${' in t or '}' in t:
                    continue
                if t.endswith('-'):
                    continue  # fragmento de interpolacao (ex.: module- de module-${...})
                toks.add(t)
    return toks


def css_has(css: str, token: str) -> bool:
    # classes no CSS minificado vêm escapadas: md:col-span-6 -> .md\:col-span-6
    esc = (token.replace('\\', '\\\\').replace(':', '\\:')
                .replace('/', '\\/').replace('.', '\\.'))
    needle = '.' + esc
    i = css.find(needle)
    while i != -1:
        nxt = css[i + len(needle):i + len(needle) + 1]
        # fim do nome da classe (qualquer coisa que nao seja identificador)
        if not (nxt.isalnum() or nxt in '_-'):
            return True
        i = css.find(needle, i + 1)
    return False


def main():
    css_path = ROOT / 'frontend/css/tailwind.css'
    if not css_path.exists():
        print('ERRO: frontend/css/tailwind.css nao existe (rode npm run build:css)')
        return 1
    css = css_path.read_text(encoding='utf-8', errors='replace')

    missing = sorted(
        t for t in template_tokens()
        if t not in ALLOW_NO_STYLE and not css_has(css, t)
    )
    if missing:
        print(f'ERRO: {len(missing)} classes sem estilo no CSS gerado:')
        for t in missing:
            print('  -', t)
        return 1
    print(f'OK: todas as classes dos templates existem no CSS ({len(template_tokens())} verificadas).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
