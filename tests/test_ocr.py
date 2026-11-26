"""OCR (item10): extracao de texto + PDF pesquisavel.

Cobre o servico (dois motores comparados, criterio de maior cobertura)
e as rotas /pdf/ocr-text e /pdf/ocr-searchable.
"""
import fitz
import pytest
from helpers import post_sync


def _digitalizado(tmp_path, nome="scan.pdf", linhas=None):
    """PDF 'digitalizado' de verdade: imagem embutida, SEM texto."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4

    linhas = linhas or [
        "CREMEPE OFFICE - OCR",
        "protocolo 10717-2026",
        "CNPJ 69.199.762/0001-65",
    ]
    vet = tmp_path / "vet.pdf"
    c = canvas.Canvas(str(vet), pagesize=A4)
    for i, l in enumerate(linhas):
        c.drawString(60, 750 - i * 30, l)
    c.save()

    doc = fitz.open(str(vet))
    page = doc[0]
    img = page.get_pixmap(dpi=200).tobytes("png")
    doc.close()

    scan = tmp_path / nome
    d2 = fitz.open()
    np_ = d2.new_page(width=595, height=842)
    np_.insert_image(np_.rect, stream=img)
    d2.save(str(scan))
    d2.close()
    return scan


# ===== servico: motores e criterio =====

def test_ocr_pagina_compara_os_dois_motores(tmp_path):
    """Ambos os motores rodam e o vencedor tem score exposto."""
    from services.pdf_ocr import ocr_pagina, configurar_tesseract

    configurar_tesseract()
    scan = _digitalizado(tmp_path)
    doc = fitz.open(str(scan))
    try:
        res = ocr_pagina(doc[0])
    finally:
        doc.close()

    assert res["motor"] in ("pymupdf", "pytesseract"), res
    assert res["chars"] > 20, res
    # os DOIS scores existem (criterio decidido: comparar)
    assert {"pymupdf", "pytesseract"} == set(res["scores"]), res["scores"]
    # o vencedor e o de MAIOR score (empate -> pymupdf, que vem1o)
    assert res["scores"][res["motor"]] == max(res["scores"].values()), res
    assert res["spans"], res


def test_ocr_criterio_maior_cobertura():
    """Unidade do criterio: fração de tokens plausíveis x conteúdo."""
    from services.pdf_ocr import _score_texto, _plausivel

    # tokens plausiveis contam; lixo nao
    assert _plausivel("protocolo")
    assert _plausivel("69.199.762/0001-65")  # numeros com pontuacao
    assert not _plausivel("###")
    assert not _plausivel("")

    # mesmo comprimento, mas um com mais lixo -> perde
    limpo = "protocolo numero documento arquivo texto"
    sujo = "protocolo ### numero ??? documento @@@"
    assert _score_texto(limpo) > _score_texto(sujo)

    # conteudo maior com a mesma fracao de plausibilidade vence
    assert _score_texto(limpo) < _score_texto(limpo + " " + limpo)
    assert _score_texto("") == 0.0


def test_extrair_texto_usa_melhor_motor(tmp_path):
    from services.pdf_ocr import extrair_texto

    scan = _digitalizado(tmp_path)
    r = extrair_texto(str(scan))

    assert r["pages"] == 1
    assert r["chars"] > 20
    assert "pymupdf" in r["motores"] or "pytesseract" in r["motores"]
    assert "--- página 1 ---" in r["texto"]
    # o texto reconhecido tem o protocolo
    assert "10717-2026" in r["texto"], r["texto"]


def test_extrair_texto_nao_roda_ocr_em_pdf_nativo(tmp_path):
    """PDF com texto nativo: usa o texto (rápido e perfeito), sem OCR."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from services.pdf_ocr import extrair_texto

    # texto VETORIAL real (o pdf_factory cria paginas em branco, que
    # nao tem texto e cairiam no OCR)
    src = tmp_path / "nativo.pdf"
    c = canvas.Canvas(str(src), pagesize=A4)
    for i in range(2):
        c.drawString(60, 750, f"pagina {i + 1} com texto nativo")
        c.showPage()
    c.save()

    r = extrair_texto(str(src))

    assert r["motores"].get("nativo", 0) == 2, r["motores"]
    assert r["motores"].get("pymupdf", 0) == 0
    assert r["motores"].get("pytesseract", 0) == 0
    assert "texto nativo" in r["texto"], r["texto"]


def test_extrair_texto_selecao_de_paginas(tmp_path, pdf_factory):
    from services.pdf_ocr import extrair_texto

    src = pdf_factory(3, "tres.pdf")
    r = extrair_texto(str(src), pages=[2])
    assert r["pages"] == 1
    assert r["total_pages"] == 3
    assert r["paginas"][0]["pagina"] == 2

    with pytest.raises(ValueError, match="inválida"):
        extrair_texto(str(src), pages=[99])


def test_extrair_texto_arquivo_inexistente(tmp_path):
    from services.pdf_ocr import extrair_texto

    with pytest.raises(FileNotFoundError):
        extrair_texto(str(tmp_path / "nao.pdf"))


# ===== PDF pesquisavel =====

def test_pdf_pesquisavel_tem_camada_invisivel(tmp_path):
    """Cópia com texto selecionável E renderização byte-idêntica."""
    from services.pdf_ocr import tornar_pesquisavel

    scan = _digitalizado(tmp_path)
    saida = tmp_path / "pesquisavel.pdf"

    rep = tornar_pesquisavel(str(scan), str(saida))

    assert rep["output_path"] == str(saida)
    assert rep["spans_inseridos"] > 0, rep
    assert saida.exists()

    orig = fitz.open(str(scan))
    novo = fitz.open(str(saida))
    try:
        texto = novo[0].get_text()
        assert "10717-2026" in texto, texto  # busca/selecao funciona
        assert len(novo[0].search_for("protocolo")) >= 1

        # a imagem permanece identica (invisivel nao altera pixels)
        a = orig[0].get_pixmap(dpi=72).samples
        b = novo[0].get_pixmap(dpi=72).samples
        assert a == b, "a camada invisivel alterou a renderizacao"
    finally:
        orig.close()
        novo.close()


def test_pdf_pesquisavel_nao_altera_o_original(tmp_path):
    from services.pdf_ocr import tornar_pesquisavel

    scan = _digitalizado(tmp_path)
    antes = scan.read_bytes()

    tornar_pesquisavel(str(scan), str(tmp_path / "out.pdf"))

    assert scan.read_bytes() == antes, "o original foi alterado"


def test_pdf_pesquisavel_recusa_mesmo_arquivo(tmp_path):
    from services.pdf_ocr import tornar_pesquisavel

    scan = _digitalizado(tmp_path)
    with pytest.raises(ValueError, match="diferente"):
        tornar_pesquisavel(str(scan), str(scan))


# ===== rotas =====

def test_rota_ocr_text(client, tmp_path):
    scan = _digitalizado(tmp_path)
    r = post_sync(client, "/api/pdf/ocr-text",
                  json={"pdf_path": str(scan)})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body["success"] is True
    assert body["chars"] > 20, body
    assert "10717-2026" in body["texto"], body["texto"]
    assert body["motores"], body
    assert body["pages"] == 1


def test_rota_ocr_text_validacao(client):
    r = client.post("/api/pdf/ocr-text", json={})
    assert r.status_code == 400
    assert "error" in r.get_json()


def test_rota_ocr_searchable(client, tmp_path):
    scan = _digitalizado(tmp_path)
    saida = tmp_path / "saida_pesquisavel.pdf"

    r = post_sync(client, "/api/pdf/ocr-searchable",
                  json={"input_path": str(scan),
                        "output_path": str(saida)})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body["success"] is True
    assert body["spans_inseridos"] > 0, body
    assert saida.exists()

    doc = fitz.open(str(saida))
    try:
        assert "10717-2026" in doc[0].get_text()
    finally:
        doc.close()


def test_rota_ocr_searchable_validacao(client):
    r = client.post("/api/pdf/ocr-searchable", json={"input_path": "x.pdf"})
    assert r.status_code == 400
    assert "error" in r.get_json()
