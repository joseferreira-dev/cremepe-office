"""Services de dominio com fixtures (item 10 — roadmap: merge/split PDF)."""
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


# ===== Word: merge (regressao do bug docxcompose achado na auditoria) =====
# Composer()/append() recebem objetos Document (nao strings) e append()
# nao tem o parametro page_break na versao pinada 2.2.0 — os dois bugs
# faziam a funcionalidade "juntar documentos" falhar por completo.

def _make_docx(path, text):
    from docx import Document
    d = Document()
    d.add_paragraph(text)
    d.save(str(path))
    return path


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


# ===== Word: demais funcionalidades (cobertura da auditoria) =====
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

    _require_word()
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
