"""Services de dominio (PDF, Word, Excel, arquivos) com fixtures."""
from pathlib import Path

import pytest
from PyPDF2 import PdfReader

from services.pdf_processor import merge, split_custom, split_fixed
from services.excel_processor import batch_convert
from services.file_manager import collect_files


# ===== PDF: merge =====

def test_merge_dois_pdfs_gera_documento_com_todas_as_paginas(pdf_factory, tmp_path):
    p1 = pdf_factory(2, "a.pdf")
    p2 = pdf_factory(3, "b.pdf")
    out = tmp_path / "merged.pdf"

    result = merge([str(p1), str(p2)], str(out))

    assert result == str(out.resolve()) or str(out) == result
    assert out.exists()
    reader = PdfReader(str(out))
    assert len(reader.pages) == 5


def test_merge_lista_vazia_levanta_value_error():
    with pytest.raises(ValueError, match="vazia"):
        merge([], "out.pdf")


def test_merge_arquivo_inexistente_levanta_file_not_found(tmp_path):
    with pytest.raises(FileNotFoundError):
        merge([str(tmp_path / "nao.pdf")], str(tmp_path / "out.pdf"))


# ===== PDF: split por tamanho fixo =====

def test_split_fixed_gera_partes_com_paginas_corretas(pdf_factory, tmp_path):
    src = pdf_factory(4, "doc.pdf")
    out_dir = tmp_path / "partes"

    stats = split_fixed(str(src), str(out_dir), pages_per_file=2)

    assert stats["total_files"] == 2
    files = sorted(out_dir.glob("*.pdf"))
    assert len(files) == 2
    for f in files:
        assert len(PdfReader(str(f)).pages) == 2


def test_split_fixed_paginas_invalidas_levanta_value_error(pdf_factory, tmp_path):
    src = pdf_factory(2, "doc.pdf")
    with pytest.raises(ValueError, match=">= 1"):
        split_fixed(str(src), str(tmp_path), pages_per_file=0)


# ===== PDF: split por intervalos personalizados =====

def test_split_custom_intervalos_validos(pdf_factory, tmp_path):
    src = pdf_factory(4, "doc.pdf")
    out_dir = tmp_path / "intervalos"

    stats = split_custom(str(src), str(out_dir), "1-2, 3-4")

    assert stats["total_files"] == 2
    files = sorted(out_dir.glob("*.pdf"))
    assert len(files) == 2
    for f in files:
        assert len(PdfReader(str(f)).pages) == 2


def test_split_custom_intervalo_invalido_levanta_value_error(pdf_factory, tmp_path):
    src = pdf_factory(4, "doc.pdf")
    with pytest.raises(ValueError, match="Intervalo"):
        split_custom(str(src), str(tmp_path), "abc-def")


def test_split_custom_intervalo_fora_do_total_levanta_value_error(pdf_factory, tmp_path):
    src = pdf_factory(2, "doc.pdf")
    with pytest.raises(ValueError, match="inválido|invalido"):
        split_custom(str(src), str(tmp_path), "5-9")


# ===== PDF: aviso de PDF escaneado no convert-to-word =====
# PDF sem texto gera docx vazio silenciosamente — a resposta carrega
# "warning" para a UI mostrar no log da operacao.

def test_pdf_to_word_avisa_pdf_sem_texto(tmp_path, pdf_factory):
    from services.pdf_processor import convert_pdf_to_word

    src = pdf_factory(2, "branco.pdf")  # paginas em branco = sem texto
    out = tmp_path / "vazio.docx"

    result = convert_pdf_to_word(str(src), str(out))

    assert isinstance(result, dict), result
    assert "warning" in result, f"sem warning: {result}"
    assert "escaneado" in result["warning"], result["warning"]
    assert out.exists(), "docx nao gerado"


def test_pdf_to_word_com_texto_nao_avisa(tmp_path):
    from reportlab.pdfgen import canvas

    from services.pdf_processor import convert_pdf_to_word

    src = tmp_path / "com_texto.pdf"
    c = canvas.Canvas(str(src))
    c.drawString(72, 720, "Relatorio anual de atividades do exercicio")
    c.save()
    out = tmp_path / "com_texto.docx"

    result = convert_pdf_to_word(str(src), str(out))

    assert "warning" not in result, result
    assert out.exists(), "docx nao gerado"


def test_rota_pdf_to_word_expoe_warning(client, pdf_factory, tmp_path):
    """Contrato do frontend: success + output_path + warning na resposta."""
    from helpers import post_sync

    src = pdf_factory(1, "scan.pdf")
    r = post_sync(client, "/api/pdf/convert-to-word", json={
        "pdf_path": str(src),
        "output_path": str(tmp_path / "scan.docx"),
    })

    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body["success"] is True
    assert body["output_path"]
    assert "warning" in body and "escaneado" in body["warning"], body


# ===== PDF: compressão de imagens (compress) =====
# A reamostragem precisa mutar o próprio objeto de imagem (ele pode viver
# dentro de Form XObjects) — a entrada no resources da página não basta.
# Os testes provam efeito real (tamanho), contrato e preservação visual.

def _noise_photo_pdf(tmp_path, name='foto.pdf'):
    """PDF com foto de ruído (pouco comprimível) — compressão tem efeito."""
    from PIL import Image as PILImage
    noise = PILImage.effect_noise((1800, 1200), 40).convert('RGB')
    jpg = tmp_path / 'ruido.jpg'
    noise.save(jpg, format='JPEG', quality=95)
    from reportlab.pdfgen import canvas as _canvas
    from reportlab.lib.pagesizes import A4 as _A4
    c = _canvas.Canvas(str(tmp_path / name), pagesize=_A4)
    c.drawImage(str(jpg), 30, 200, width=535, height=357)
    c.drawString(72, 780, 'PDF com foto de alta densidade')
    c.showPage()
    c.save()
    return tmp_path / name


def _smask_pdf(tmp_path, name='smask.pdf'):
    """Imagem cinza + /SMask (quadrado central opaco) via pikepdf puro."""
    import zlib
    import pikepdf
    from PIL import Image as PILImage
    w = h = 120
    main = PILImage.new('RGB', (w, h), (128, 128, 128))
    mask = PILImage.new('L', (w, h), 0)
    for x in range(30, 90):
        for y in range(30, 90):
            mask.putpixel((x, y), 255)
    pdf = pikepdf.new()
    page = pdf.add_blank_page(page_size=(300, 300))
    img = pdf.make_stream(zlib.compress(main.tobytes()))
    img[pikepdf.Name('/Subtype')] = pikepdf.Name('/Image')
    img[pikepdf.Name('/Width')] = w
    img[pikepdf.Name('/Height')] = h
    img[pikepdf.Name('/ColorSpace')] = pikepdf.Name('/DeviceRGB')
    img[pikepdf.Name('/BitsPerComponent')] = 8
    img[pikepdf.Name('/Filter')] = pikepdf.Name('/FlateDecode')
    sm = pdf.make_stream(zlib.compress(mask.tobytes()))
    sm[pikepdf.Name('/Subtype')] = pikepdf.Name('/Image')
    sm[pikepdf.Name('/Width')] = w
    sm[pikepdf.Name('/Height')] = h
    sm[pikepdf.Name('/ColorSpace')] = pikepdf.Name('/DeviceGray')
    sm[pikepdf.Name('/BitsPerComponent')] = 8
    sm[pikepdf.Name('/Filter')] = pikepdf.Name('/FlateDecode')
    img[pikepdf.Name('/SMask')] = sm
    page.obj.Resources = pikepdf.Dictionary(
        XObject=pikepdf.Dictionary(Im0=img))
    page.obj.Contents = pdf.make_stream(b'q 300 0 0 300 0 0 cm /Im0 Do Q')
    out = tmp_path / name
    pdf.save(str(out))
    pdf.close()
    return out


def test_compress_reamostra_imagens_e_reduz(tmp_path):
    from services.pdf_processor import compress
    src = _noise_photo_pdf(tmp_path)
    in_size = src.stat().st_size
    result = compress(str(src), str(tmp_path / 'out.pdf'), 'high', 75)
    out = Path(result['output_path'])
    assert out.exists()
    assert result['ratio'] < 0.5, result
    assert out.stat().st_size < in_size * 0.5
    # integridade: abre, pagina unica, texto e render preservados
    doc = PdfReader(str(out))
    assert len(doc.pages) == 1
    assert 'alta densidade' in (doc.pages[0].extract_text() or '')
    import fitz
    d = fitz.open(str(out))
    assert d[0].get_pixmap(dpi=36).width > 0
    d.close()


def test_compress_qualidade_afeta_tamanho(tmp_path):
    from services.pdf_processor import compress
    src = _noise_photo_pdf(tmp_path)
    low = compress(str(src), str(tmp_path / 'q30.pdf'), 'high', 30)
    high = compress(str(src), str(tmp_path / 'q85.pdf'), 'high', 85)
    assert low['compressed_size'] < high['compressed_size'], (low, high)


def test_compress_sem_downscale_preserva_imagens(tmp_path):
    from services.pdf_processor import compress
    src = _noise_photo_pdf(tmp_path)
    in_size = src.stat().st_size
    result = compress(str(src), str(tmp_path / 'nods.pdf'), 'high', 75,
                      downscale_images=False)
    # sem reamostragem as imagens nao mudam: quase o mesmo tamanho
    assert result['compressed_size'] > in_size * 0.9, result


def test_compress_remove_metadata_sem_crash(tmp_path):
    import pikepdf
    from services.pdf_processor import compress
    src = tmp_path / 'meta.pdf'
    from reportlab.pdfgen import canvas as _canvas
    from reportlab.lib.pagesizes import A4 as _A4
    c = _canvas.Canvas(str(src), pagesize=_A4)
    c.drawString(72, 720, 'documento com metadados')
    c.save()
    with pikepdf.open(str(src), allow_overwriting_input=True) as p:
        p.docinfo['/Author'] = 'Autor Teste'
        p.docinfo['/Title'] = 'Titulo Secreto'
        p.save(str(src))
    with pikepdf.open(str(src)) as p:
        assert '/Author' in p.docinfo
    # opção já derrubava a operação inteira (docinfo = None inválido)
    result = compress(str(src), str(tmp_path / 'meta_out.pdf'),
                      remove_metadata=True)
    with pikepdf.open(result['output_path']) as p:
        assert '/Author' not in p.docinfo
        assert '/Title' not in p.docinfo


def test_compress_entrada_igual_saida_usa_sufixo(tmp_path):
    from services.pdf_processor import compress
    src = tmp_path / 'mesmo.pdf'
    from reportlab.pdfgen import canvas as _canvas
    from reportlab.lib.pagesizes import A4 as _A4
    c = _canvas.Canvas(str(src), pagesize=_A4)
    c.drawString(72, 720, 'nao deve ser sobrescrito')
    c.save()
    original = src.stat().st_size
    result = compress(str(src), str(src))
    out = Path(result['output_path'])
    assert out != src and out.exists() and '_compressed' in out.name
    assert src.stat().st_size == original


def test_compress_smask_compoe_sobre_branco(tmp_path):
    """SMask: a aparencia (cinza no centro, branco na borda) sobrevive."""
    import pikepdf
    from services.pdf_processor import compress
    src = _smask_pdf(tmp_path)
    result = compress(str(src), str(tmp_path / 'smask_out.pdf'), 'high', 75)
    with pikepdf.open(result['output_path']) as p:
        pil = pikepdf.PdfImage(list(p.pages[0].get_images().values())[0]).as_pil_image()
    centro = pil.getpixel((pil.width // 2, pil.height // 2))[:3]
    borda = pil.getpixel((2, 2))[:3]
    # com SMask aplicado sobre branco: centro cinza, borda branca
    assert 90 < sum(centro) / 3 < 170, centro
    assert sum(borda) / 3 > 200, borda


def test_rota_compress_validacoes_e_contrato(client, tmp_path):
    from helpers import post_sync
    src = _noise_photo_pdf(tmp_path)

    bad = post_sync(client, '/api/pdf/compress', json={
        'input_path': str(src), 'output_path': str(tmp_path / 'x.pdf'),
        'compression_level': 'ultra'})
    assert bad.status_code == 400, bad.status_code

    bad2 = post_sync(client, '/api/pdf/compress', json={
        'input_path': str(src), 'output_path': str(tmp_path / 'x.pdf'),
        'compression_level': 'low', 'jpeg_quality': 500})
    assert bad2.status_code == 400, bad2.status_code

    ok = post_sync(client, '/api/pdf/compress', json={
        'input_path': str(src), 'output_path': str(tmp_path / 'api.pdf'),
        'compression_level': 'medium', 'jpeg_quality': 60})
    assert ok.status_code == 200, ok.get_json()
    body = ok.get_json()
    res = body.get('result', body)
    assert body.get('success') is True
    assert {'original_size', 'compressed_size', 'ratio'} <= set(res)
    assert res['ratio'] < 1


# ===== files: duplicates/remove com validacao amigavel =====
# Cobre: acoes invalidas rejeitadas, validacao de todos os caminhos
# antes de alterar o disco (sem exclusao parcial) e grupos malformados.

def _make_dups(tmp_path):
    """Cria 3 arquivos identicos e devolve (dir, [caminhos])."""
    dup = tmp_path / "dups"
    dup.mkdir()
    paths = []
    for name in ("a.txt", "b.txt", "c.txt"):
        p = dup / name
        p.write_text("conteudo identico", encoding="utf-8")
        paths.append(p)
    return dup, paths


def test_duplicates_remove_valida_antes_de_agir(tmp_path):
    """Lista desatualizada: erro amigavel e NADA e excluido (atomicidade)."""
    from controllers.file_controller import FileController

    dup, paths = _make_dups(tmp_path)
    a, b, c = paths
    ctrl = FileController()
    groups = [[str(a), str(b)], [str(a), str(dup / "nao_existe.pdf")]]

    try:
        ctrl.remove_duplicates(groups, action="delete")
        raise AssertionError("deveria ter falhado com arquivo inexistente")
    except FileNotFoundError as exc:
        assert "refaça a busca" in str(exc), str(exc)

    # validar-antes-de-agir: o primeiro grupo NAO foi excluido
    assert b.exists() and c.exists(), "exclusao parcial aconteceu!"


def test_duplicates_remove_acao_invalida(tmp_path):
    from controllers.file_controller import FileController
    from utils.exceptions import ValidationError

    ctrl = FileController()
    with pytest.raises(ValidationError, match="Ação não suportada"):
        ctrl.remove_duplicates([["a", "b"]], action="explode")
    with pytest.raises(ValidationError, match="destination"):
        ctrl.remove_duplicates([["a", "b"]], action="move")


def test_duplicates_remove_grupo_invalido(tmp_path):
    from controllers.file_controller import FileController
    from utils.exceptions import ValidationError

    ctrl = FileController()
    with pytest.raises(ValidationError, match="Grupo de duplicatas inválido"):
        ctrl.remove_duplicates([["so_um"]], action="delete")
    with pytest.raises(ValidationError, match="Grupo de duplicatas inválido"):
        ctrl.remove_duplicates(["nao_e_lista"], action="delete")


def test_duplicates_remove_funciona(tmp_path):
    from controllers.file_controller import FileController

    dup, paths = _make_dups(tmp_path)
    a, b, _c = paths
    ctrl = FileController()

    count = ctrl.remove_duplicates([[str(a), str(b)]], action="delete")

    assert count == 1, count
    assert not b.exists(), "o duplicado deveria ter sido excluido"
    assert a.exists(), "o original deve ser preservado"


# ===== Progresso real em services (canal ContextVar) =====

def test_collect_files_reporta_progresso(tmp_path, progress_collector):
    src = tmp_path / "origem"
    src.mkdir()
    for i in range(6):
        (src / f"arq{i}.txt").write_text("conteudo", encoding="utf-8")
    dst = tmp_path / "destino"

    processed = collect_files([str(src)], str(dst), copy=True,
                              extensions=[".txt"])

    assert processed == 6
    assert len(list(dst.glob("*.txt"))) == 6
    # reportou progresso com total coerente
    assert progress_collector, "collect_files nao reportou progresso"
    assert progress_collector[-1][0] == 6
    assert progress_collector[-1][1] == 6
    # monotono
    currents = [c for c, _ in progress_collector]
    assert currents == sorted(currents)


def test_batch_convert_reporta_progresso(tmp_path, progress_collector):
    import openpyxl

    src = tmp_path / "xlsx_src"
    dst = tmp_path / "xlsx_dst"
    src.mkdir()
    dst.mkdir()
    for i in range(5):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["col1", "col2"])
        ws.append([i, i * 2])
        wb.save(src / f"arq{i}.xlsx")

    batch_convert(str(src), str(dst), "xlsx", "csv")

    assert len(list(dst.glob("*.csv"))) == 5
    assert progress_collector, "batch_convert nao reportou progresso"
    assert progress_collector[-1] == (5, 5)
    currents = [c for c, _ in progress_collector]
    assert currents == sorted(currents), f"progresso nao monotono: {currents}"


# ===== Word: merge (docxcompose) =====
# Composer()/append() recebem objetos Document (nao strings) e append()
# nao tem o parametro page_break na versao pinada 2.2.0 — page breaks
# sao inseridos manualmente entre os documentos.

def _make_docx(path, text):
    from docx import Document
    d = Document()
    d.add_paragraph(text)
    d.save(str(path))
    return path


def _block_com(*args, **kwargs):
    """Substituto do win32com Dispatch: simula Word AUSENTE."""
    raise RuntimeError("COM desabilitado no teste")


def test_word_convert_txt_nao_depende_do_word(tmp_path, monkeypatch):
    """txt a partir de .docx: conversao pura — Dispatch nunca e chamado."""
    from services.word_processor import convert_document

    monkeypatch.setattr("win32com.client.Dispatch", _block_com)

    src = _make_docx(tmp_path / "puro.docx", "paragrafo um\nparagrafo dois")
    out = tmp_path / "puro.txt"

    result = convert_document(str(src), str(out), "txt")

    assert result == str(out.resolve()) or result == str(out)
    content = out.read_text(encoding="utf-8")
    assert "paragrafo um" in content and "paragrafo dois" in content


def test_word_convert_html_nao_depende_do_word(tmp_path, monkeypatch):
    """html a partir de .docx: conversao pura, com escape e estrutura."""
    from services.word_processor import convert_document

    monkeypatch.setattr("win32com.client.Dispatch", _block_com)

    src = _make_docx(tmp_path / "pagina.docx", "conteudo com <tags> & acentos")
    out = tmp_path / "pagina.html"

    convert_document(str(src), str(out), "html")

    content = out.read_text(encoding="utf-8")
    assert "<!DOCTYPE html>" in content and "<html" in content
    assert "<p>" in content
    # escape correto: o conteudo literal aparece escapado
    assert "&lt;tags&gt;" in content and "&amp; acentos" in content
    assert "<tags>" not in content.replace("<p>", "").replace("</p>", "")


def test_word_convert_pdf_sem_word_mensagem_amigavel(tmp_path, monkeypatch):
    """pdf exige Word: falha com DependencyError acionavel (nao COM cru)."""
    from services.word_processor import convert_document
    from utils.exceptions import DependencyError

    monkeypatch.setattr("win32com.client.Dispatch", _block_com)

    src = _make_docx(tmp_path / "doc.docx", "qualquer conteudo")
    out = tmp_path / "doc.pdf"

    with pytest.raises(DependencyError, match="Microsoft Word"):
        convert_document(str(src), str(out), "pdf")


def test_word_convert_formato_invalido(tmp_path):
    from services.word_processor import convert_document

    src = _make_docx(tmp_path / "x.docx", "texto")
    with pytest.raises(ValueError, match="não suportado|nao suportado"):
        convert_document(str(src), str(tmp_path / "x.out"), "rtf")


def test_word_merge_junta_documentos_com_quebra_de_pagina(tmp_path):
    import zipfile

    from docx import Document
    from services.word_processor import merge_documents

    p1 = _make_docx(tmp_path / "um.docx", "primeiro documento")
    p2 = _make_docx(tmp_path / "dois.docx", "segundo documento")
    out = tmp_path / "juntado.docx"

    merge_documents([str(p1), str(p2)], str(out), insert_page_breaks=True)

    assert out.exists()
    texts = " ".join(p.text for p in Document(str(out)).paragraphs)
    assert "primeiro documento" in texts and "segundo documento" in texts

    with zipfile.ZipFile(out) as z:
        xml = z.read("word/document.xml")
    assert b'w:type="page"' in xml, "insert_page_breaks=True nao gerou quebra"


def test_word_merge_sem_quebra_de_pagina(tmp_path):
    import zipfile

    from docx import Document
    from services.word_processor import merge_documents

    p1 = _make_docx(tmp_path / "a.docx", "conteudo A")
    p2 = _make_docx(tmp_path / "b.docx", "conteudo B")
    out = tmp_path / "juntado2.docx"

    merge_documents([str(p1), str(p2)], str(out), insert_page_breaks=False)

    texts = " ".join(p.text for p in Document(str(out)).paragraphs)
    assert "conteudo A" in texts and "conteudo B" in texts
    with zipfile.ZipFile(out) as z:
        xml = z.read("word/document.xml")
    assert b'w:type="page"' not in xml, "insert_page_breaks=False gerou quebra indevida"


# ===== Word: demais funcionalidades =====
# convert/watermark/filepath usam Word COM (win32com) — sao pulados em
# ambientes sem MS Word; compare/difflib e extract_images sao puros.

_word_cache = {}


def _require_word():
    """Pula o teste se o MS Word (COM) nao estiver disponivel."""
    if "ok" not in _word_cache:
        try:
            import win32com.client
        except ImportError as exc:
            _word_cache["err"] = f"pywin32 ausente: {exc}"
        else:
            try:
                word = win32com.client.Dispatch("Word.Application")
                word.Quit()
                _word_cache["ok"] = True
            except Exception as exc:  # noqa: BLE001
                _word_cache["err"] = str(exc)
    if "err" in _word_cache:
        pytest.skip(f"MS Word (COM) indisponivel: {_word_cache['err']}")


def test_word_convert_docx_para_txt(tmp_path):
    from docx import Document  # noqa: F401  (garante que o DOCX e valido)
    from services.word_processor import convert_document

    # txt a partir de .docx NAO exige mais o Word (conversao pura)
    src = _make_docx(tmp_path / "conv.docx", "texto unico do conversor")
    out = tmp_path / "conv.txt"

    convert_document(str(src), str(out), "txt")

    assert out.exists(), "txt nao gerado"
    content = out.read_text(encoding="utf-8", errors="replace")
    assert "texto unico do conversor" in content, f"conteudo faltando: {content!r}"


def test_word_compare_detecta_diferencas(tmp_path):
    from services.word_processor import compare_documents

    p1 = _make_docx(tmp_path / "cmp1.docx", "linha comum\nlinha so no um")
    p2 = _make_docx(tmp_path / "cmp2.docx", "linha comum\nlinha so no dois")

    result = compare_documents(str(p1), str(p2))

    assert set(result.keys()) == {"differences", "summary"}, result.keys()
    summary = result["summary"]
    assert summary["total_differences"] > 0, summary
    assert summary["added"] + summary["removed"] + summary["modified"] > 0, summary
    assert all("type" in d for d in result["differences"]), result["differences"]
    types = {d["type"] for d in result["differences"]}
    assert types <= {"added", "removed", "modified"}, types


def test_word_extract_images(tmp_path):
    from pathlib import Path

    from PIL import Image
    from docx import Document
    from services.word_processor import extract_images

    # docx com uma imagem real embutida
    png = tmp_path / "fig.png"
    Image.new("RGB", (40, 40), (10, 10, 200)).save(png)
    docx_path = tmp_path / "com_imagem.docx"
    doc = Document()
    doc.add_paragraph("figura anexada")
    doc.add_picture(str(png))
    doc.save(str(docx_path))

    out_dir = tmp_path / "extraidas"
    images = extract_images(str(docx_path), str(out_dir))

    assert len(images) == 1, f"esperava 1 imagem, veio {images}"
    extracted = Path(images[0])
    assert extracted.exists(), "arquivo da imagem nao criado"
    # bytes identicos ao original (python-docx embute sem re-encodar)
    assert extracted.read_bytes() == png.read_bytes(), "bytes da imagem diferem"


def test_word_watermark_texto(tmp_path):
    from docx import Document
    from services.word_processor import add_watermark

    _require_word()
    src = _make_docx(tmp_path / "marc.docx", "conteudo original do documento")
    out = tmp_path / "marcado.docx"

    add_watermark(str(src), str(out), "text", text="CONFIDENCIAL")

    assert out.exists(), "docx marcado nao gerado"
    doc = Document(str(out))
    texts = " ".join(p.text for p in doc.paragraphs)
    # a marca d'agua e forma (WordArt), nao paragrafo — valida que o
    # conteudo original foi preservado no documento de saida
    assert "conteudo original do documento" in texts, texts


def test_word_insert_filepath(tmp_path):
    import zipfile
    from pathlib import Path

    from docx import Document
    from services.word_processor import insert_file_path

    _require_word()
    src = _make_docx(tmp_path / "caminho.docx", "corpo do documento")
    out = tmp_path / "com_caminho.docx"

    insert_file_path(str(src), str(out))

    assert out.exists(), "docx com caminho nao gerado"
    doc = Document(str(out))
    texts = " ".join(p.text for p in doc.paragraphs)
    assert "corpo do documento" in texts, texts

    # o caminho inserido (WordArt) fica em algum XML do pacote
    # (tipicamente word/headerN.xml — a margem do documento)
    expected = str(Path(src).resolve())
    with zipfile.ZipFile(out) as z:
        found = any(
            expected in z.read(name).decode("utf-8", "replace")
            or src.name in z.read(name).decode("utf-8", "replace")
            for name in z.namelist()
            if name.endswith(".xml")
        )
    assert found, "caminho do arquivo nao encontrado em nenhum XML do documento"
