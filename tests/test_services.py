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
