"""OCR de PDF: extrai texto de páginas digitalizadas e gera cópias
pesquisáveis (camada de texto invisível sobre a imagem).

Dois motores, ambos exigidos pelo produto e instalados com o sistema:

  PyMuPDF (fitz) : page.get_textpage_ocr(language=...) ->
                   spans com bbox já em PONTOS PDF e size real
  pytesseract    : image_to_data(lang=...) ->
                   palavras em PIXELS + confiança (converte px->pt
                   multiplicando por 72/dpi)

Os DOIS rodam em cada página digitalizada e vence o de MAIOR COBERTURA
DE TEXTO PLAUSIVEL (critério decidido): fração de tokens plausíveis ×
quantidade de conteúdo. Empate -> PyMuPDF.

Descobertas medidas no ambiente (não supostas):
  - get_textpage_ocr recebe `language` (NÃO `lang`) e defaulta a
    'eng': com 'eng' a acentuação portuguesa sai deformada
    ('Acentuacao: ¢ao'), com 'por+eng' sai correta ('Acentuação: ção').
  - PyMuPDF é wrapper do tesseract, mas os resultados DIVERGEM de
    verdade (mesmo PDF: 'CNPJ' vs 'CNPUJ') — a comparação não é
    redundante.
  - TESSDATA_PREFIX basta para o PyMuPDF (funciona sem o binário no
    PATH); o pytesseract exige tesseract_cmd explícito.
  - render_mode=3 insere texto invisível: fica selecionável e a
    renderização dos pixels fica byte-idêntica.
"""
import io
import os
import shutil
from pathlib import Path

import fitz
from PIL import Image

try:
    import pytesseract
except ImportError:  # opcional: o PyMuPDF cobre se faltar
    pytesseract = None

from utils.exceptions import DependencyError
from utils.jobs import report_progress

# Diretórios conhecidos do Tesseract (Windows instalador + POSIX).
_CANDIDATOS = (
    r"C:\Program Files\Tesseract-OCR",
    r"C:\Program Files (x86)\Tesseract-OCR",
    os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR"),
    "/usr/bin",
    "/usr/local/bin",
    "/opt/homebrew/bin",
)

# Idioma padrão (decidido): cobre português e termos em inglês.
IDIOMA_PADRAO = "por+eng"
DPI_PADRAO = 300

_tesseract_raiz = None


def configurar_tesseract() -> str:
    """Auto-descoberta do Tesseract (idempotente). Devolve a raiz.

    Um único ajuste serve aos DOIS motores: o PyMuPDF lê
    TESSDATA_PREFIX (e o PATH para o binário) e o pytesseract lê
    tesseract_cmd. Sem isso ambos falham com mensagem de
    "não instalado" mesmo com o Tesseract presente.
    """
    global _tesseract_raiz
    if _tesseract_raiz:
        return _tesseract_raiz

    exe = shutil.which("tesseract")
    raiz = str(Path(exe).parent) if exe else None
    if raiz is None:
        for c in _CANDIDATOS:
            nome = "tesseract.exe" if os.name == "nt" else "tesseract"
            if os.path.isfile(os.path.join(c, nome)):
                raiz = c
                break
    if raiz is None:
        raise DependencyError(
            "OCR indisponível: o Tesseract não foi encontrado neste "
            "servidor. Instale com 'choco install tesseract' ou baixe o "
            "instalador em github.com/UB-Mannheim/tesseract/wiki "
            "(inclua os idiomas 'por' e 'eng').")

    # PyMuPDF: tessdata (idiomas) + PATH (binário)
    tessdata = os.path.join(raiz, "tessdata")
    if not os.path.isdir(tessdata) or not os.listdir(tessdata):
        raise DependencyError(
            f"OCR indisponível: pasta de idiomas ausente ou vazia "
            f"({tessdata}). Instale os pacotes 'por' e 'eng'.")
    os.environ["TESSDATA_PREFIX"] = tessdata
    if raiz not in os.environ.get("PATH", "").split(os.pathsep):
        os.environ["PATH"] = raiz + os.pathsep + os.environ.get("PATH", "")

    # pytesseract: caminho explícito do executável (se a lib faltar, o
    # PyMuPDF cobre — o erro só viria se o BINÁRIO do tesseract faltar,
    # tratado acima)
    if pytesseract is not None:
        nome = "tesseract.exe" if os.name == "nt" else "tesseract"
        exe_path = os.path.join(raiz, nome)
        if os.path.isfile(exe_path):
            pytesseract.pytesseract.tesseract_cmd = exe_path

    _tesseract_raiz = raiz
    return raiz


def _plausivel(token: str) -> bool:
    """Token que parece palavra de verdade (não lixo de OCR).

    Heurística sem ground truth: precisa de ao menos um alfanumérico e
    a maioria dos caracteres deve ser alfanumérica ou conector comum
    ('-', '/', ''). Rejeita '###', '@@@', sequências de símbolos.
    """
    t = token.strip(".,;:!?()[]{}\"'“”")
    if not t:
        return False
    if not any(c.isalnum() for c in t):
        return False
    bons = sum(1 for c in t if c.isalnum() or c in "-/'")
    return bons >= max(1, int(len(t) * 0.6))


def _score_texto(texto: str) -> float:
    """Cobertura de texto plausível (critério decidido).

    score = fração de tokens plausíveis × quantidade de conteúdo.
    Premia quem extrai MAIS conteúdo válido — o modo de falha típico
    de OCR é perder conteúdo (medido:88 vs223 chars no mesmo PDF).
    """
    tokens = texto.split()
    if not tokens:
        return 0.0
    plausiveis = sum(1 for t in tokens if _plausivel(t))
    return (plausiveis / len(tokens)) * len(texto)


# ------------------------------------------------------------------ motores

def _ocr_fitz(page, language: str, dpi: int):
    """OCR via PyMuPDF. Devolve {'texto', 'spans'} ou None se falhar.

    `language` é o parâmetro correto (não `lang`); `full=True` força o
    OCR da página inteira — chamamos só em páginas SEM texto, então é
    o caminho do digitalizado. Os bboxes já saem em pontos PDF.
    """
    try:
        tp = page.get_textpage_ocr(dpi=dpi, language=language, full=True)
        dados = page.get_text("dict", textpage=tp)
    except Exception:
        return None

    spans = []
    partes = []
    for bloco in dados.get("blocks", []):
        if bloco.get("type") != 0:
            continue  # bloco de imagem
        for linha in bloco.get("lines", []):
            txt = "".join(sp.get("text", "")
                          for sp in linha.get("spans", []))
            if not txt.strip():
                continue
            sizes = [sp.get("size") for sp in linha.get("spans", [])
                     if sp.get("size")]
            spans.append({
                "bbox": tuple(linha["bbox"]),
                "text": txt,
                "size": (sum(sizes) / len(sizes)) if sizes else 10.0,
            })
            partes.append(txt)
    return {"texto": "\n".join(partes), "spans": spans}


def _ocr_tesseract(page, language: str, dpi: int):
    """OCR via pytesseract. Devolve {'texto', 'spans'} ou None.

    Renderiza a página (fitz) e passa a imagem ao tesseract. Os bboxes
    saem em PIXELS: converte para pontos PDF por `* 72 / dpi`.
    Agrupa as palavras em linhas (block/par/line) para virar um span —
    `insert_textbox` trabalha por caixa de linha.
    """
    if pytesseract is None:
        return None  # lib ausente: o PyMuPDF cobre
    try:
        pix = page.get_pixmap(dpi=dpi)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        dados = pytesseract.image_to_data(
            img, lang=language, output_type=pytesseract.Output.DICT)
    except Exception:
        return None

    escala = 72.0 / dpi  # px -> pontos PDF
    linhas = {}
    for i, token in enumerate(dados["text"]):
        token = token.strip()
        if not token:
            continue
        chave = (dados["block_num"][i], dados["par_num"][i],
                 dados["line_num"][i])
        l, t = dados["left"][i], dados["top"][i]
        w, h = dados["width"][i], dados["height"][i]
        reg = linhas.setdefault(chave, {
            "x0": 10 ** 9, "y0": 10 ** 9, "x1": -1, "y1": -1,
            "palavras": [], "alturas": [],
        })
        reg["x0"] = min(reg["x0"], l)
        reg["y0"] = min(reg["y0"], t)
        reg["x1"] = max(reg["x1"], l + w)
        reg["y1"] = max(reg["y1"], t + h)
        reg["palavras"].append(token)
        reg["alturas"].append(h)

    spans = []
    for chave in sorted(linhas):
        r = linhas[chave]
        if not r["palavras"]:
            continue
        spans.append({
            "bbox": (r["x0"] * escala, r["y0"] * escala,
                     r["x1"] * escala, r["y1"] * escala),
            "text": " ".join(r["palavras"]),
            "size": (sum(r["alturas"]) / len(r["alturas"])) * escala * 0.85,
        })
    return {"texto": "\n".join(s["text"] for s in spans), "spans": spans}


def ocr_pagina(page, language: str = IDIOMA_PADRAO,
               dpi: int = DPI_PADRAO) -> dict:
    """Roda OS DOIS motores numa página e devolve o melhor resultado.

    Critério decidido: maior cobertura de texto plausível
    (`_score_texto`). Empate -> PyMuPDF. O dicionário expõe os dois
    scores para inspeção/teste.
    """
    configurar_tesseract()

    r_fitz = _ocr_fitz(page, language, dpi)
    r_tess = _ocr_tesseract(page, language, dpi)

    cands = []
    if r_fitz is not None:
        cands.append(("pymupdf", r_fitz))
    if r_tess is not None:
        cands.append(("pytesseract", r_tess))
    if not cands:
        raise DependencyError(
            "OCR falhou nos dois motores — verifique se o Tesseract "
            "está instalado com os idiomas 'por' e 'eng'.")

    # max() estável: em empate vence o primeiro (PyMuPDF)
    motor, vencedor = max(cands, key=lambda c: _score_texto(c[1]["texto"]))
    scores = {nome: round(_score_texto(res["texto"]), 2)
              for nome, res in cands}
    return {
        "motor": motor,
        "texto": vencedor["texto"],
        "spans": vencedor["spans"],
        "scores": scores,
        "chars": len(vencedor["texto"]),
    }


# ------------------------------------------------------------------ API

def _parse_paginas(selecao):
    """Normaliza a seleção de páginas em lista1-based.

    Aceita None (todas), lista/tupla de inteiros ou string no formato
    das demais features do projeto: "1-3,5". ValueError do parse vira
   400 via describe_exception.
    """
    if selecao is None:
        return None
    if isinstance(selecao, str):
        nums = []
        for parte in selecao.split(","):
            parte = parte.strip()
            if not parte:
                continue
            if "-" in parte:
                ini, fim = parte.split("-", 1)
                nums.extend(range(int(ini), int(fim) + 1))
            else:
                nums.append(int(parte))
        selecao = nums
    return [int(n) for n in selecao]


def _paginas_abertas(pdf_path, pages):
    """(doc, lista_de_numeros_1based, total)."""
    doc = fitz.open(str(pdf_path))
    total = doc.page_count
    pages = _parse_paginas(pages)
    if pages is None:
        nums = list(range(1, total + 1))
    else:
        nums = [n for n in pages if 1 <= n <= total]
        if not nums:
            doc.close()
            raise ValueError(
                f"Seleção de páginas inválida: {pages} "
                f"(o documento tem {total})")
    return doc, nums, total


def extrair_texto(pdf_path: str, language: str = IDIOMA_PADRAO,
                  dpi: int = DPI_PADRAO, pages=None) -> dict:
    """Extrai o texto do PDF — digitalizado via OCR, nativo via leitura.

    Página com texto nativo não passa por OCR (é mais rápido e mais
    correto); página digitalizada roda os DOIS motores e fica com o
    melhor. `pages` é 1-based (None = todas).
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {pdf_path}")

    doc, nums, total = _paginas_abertas(pdf_path, pages)
    try:
        blocos = []
        motores = {"pymupdf": 0, "pytesseract": 0, "nativo": 0}
        for i, n in enumerate(nums, 1):
            report_progress(i, len(nums), "Extraindo texto (OCR)")
            page = doc[n - 1]
            nativo = page.get_text().strip()
            if nativo:
                # já tem texto: não há o que reconhecer
                res = {"motor": "nativo", "texto": nativo,
                       "spans": [], "scores": {}, "chars": len(nativo)}
            else:
                res = ocr_pagina(page, language, dpi)
            motores[res["motor"]] = motores.get(res["motor"], 0) + 1
            blocos.append({
                "pagina": n,
                "motor": res["motor"],
                "texto": res["texto"],
                "chars": res["chars"],
                "scores": res.get("scores", {}),
            })

        return {
            "pdf_path": str(pdf_path),
            "language": language,
            "dpi": dpi,
            "pages": len(nums),
            "total_pages": total,
            "texto": "\n\n".join(
                f"--- página {b['pagina']} ---\n{b['texto']}"
                for b in blocos),
            "paginas": blocos,
            "motores": motores,
            "chars": sum(b["chars"] for b in blocos),
        }
    finally:
        doc.close()


def _inserir_invisivel(page, spans) -> int:
    """Insere os spans como texto invisível (render_mode=3).

    Retorna quantos foram inseridos.

    Usa `insert_text` ancorado na BASELINE (y1 = fundo da caixa do
    OCR): o texto se estende para cima a partir dela e cobre a caixa.
    `insert_textbox` NÃO serve aqui — o bbox do OCR tem altura MENOR
    que o fontsize (medido: caixa9.4 pt vs size10.8 pt) e o PyMuPDF
    recusa a caixa com ret negativo em todos os spans, o que deixava
    só1 de5 inseridos e a busca falhando.
    """
    inseridos = 0
    for sp in spans:
        texto = (sp.get("text") or "").strip()
        if not texto:
            continue
        rect = fitz.Rect(*sp["bbox"])
        if rect.is_empty or rect.width <= 0 or rect.height <= 0:
            continue
        size = float(sp.get("size") or 0) or max(6.0, rect.height * 0.8)
        try:
            rc = page.insert_text((rect.x0, rect.y1), texto,
                                  fontsize=size, render_mode=3,
                                  color=(0, 0, 0))
        except Exception:
            continue
        if rc:
            inseridos += 1
    return inseridos


def tornar_pesquisavel(input_path: str, output_path: str,
                       language: str = IDIOMA_PADRAO,
                       dpi: int = DPI_PADRAO, pages=None) -> dict:
    """Gera uma CÓPIA do PDF com camada de texto invisível (OCR).

    O original nunca é tocado. Páginas que já têm texto são
    preservadas como estão (não há o que reconhecer); as digitalizadas
    recebem a camada invisível com o motor vencedor da comparação.
    A imagem renderizada permanece byte-idêntica — o OCR só adiciona
    texto selecionável/buscaável.
    """
    input_path = Path(input_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")
    output_path = Path(output_path).resolve()
    if output_path == input_path:
        raise ValueError(
            "output_path deve ser diferente de input_path "
            "(o original nunca é alterado)")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    configurar_tesseract()
    doc, nums, total = _paginas_abertas(input_path, pages)
    try:
        motores = {"pymupdf": 0, "pytesseract": 0, "nativo": 0}
        inseridos_totais = 0
        for i, n in enumerate(nums, 1):
            report_progress(i, len(nums), "Gerando PDF pesquisável")
            page = doc[n - 1]
            if page.get_text().strip():
                motores["nativo"] += 1
                continue
            res = ocr_pagina(page, language, dpi)
            motores[res["motor"]] = motores.get(res["motor"], 0) + 1
            inseridos_totais += _inserir_invisivel(page, res["spans"])

        doc.save(str(output_path), garbage=3, deflate=True)
    finally:
        doc.close()

    return {
        "output_path": str(output_path),
        "input_path": str(input_path),
        "language": language,
        "dpi": dpi,
        "pages": len(nums),
        "total_pages": total,
        "motores": motores,
        "spans_inseridos": inseridos_totais,
        "output_size": output_path.stat().st_size,
    }
