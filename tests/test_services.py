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


# ===== PDF: preflight de disco (item 6) =====
# Estimativa do resultado comparada com shutil.disk_usage ANTES de
# começar: sem isso, um merge/extract de arquivo grande morre no meio
# (disco cheio) deixando saida truncada.

def _disco_com(free_bytes):
    """Substitui shutil.disk_usage devolvendo `free_bytes` livres."""
    from types import SimpleNamespace
    import shutil as _shutil

    def fake(_path):
        return SimpleNamespace(total=free_bytes, used=0, free=free_bytes)
    return _shutil, fake


def test_merge_preflight_recusa_sem_espaco(pdf_factory, tmp_path, monkeypatch):
    p1 = pdf_factory(2, "a.pdf")
    _shutil, fake = _disco_com(free_bytes=10)  # 10 B livres < soma dos inputs
    monkeypatch.setattr(_shutil, "disk_usage", fake)

    with pytest.raises(ValueError, match="Espaço insuficiente"):
        merge([str(p1)], str(tmp_path / "out.pdf"))

    # falhou ANTES de escrever: nao deixou saida truncada
    assert not (tmp_path / "out.pdf").exists()


def test_extract_preflight_recusa_sem_espaco(pdf_factory, tmp_path, monkeypatch):
    from services.pdf_processor import extract_all_pages
    src = pdf_factory(3, "doc.pdf")
    _shutil, fake = _disco_com(free_bytes=1)
    monkeypatch.setattr(_shutil, "disk_usage", fake)

    with pytest.raises(ValueError, match="Espaço insuficiente"):
        extract_all_pages(str(src), str(tmp_path / "paginas"))

    assert list(tmp_path.glob("paginas/*.pdf")) == []


def test_preflight_ignora_oserror_na_mediacao(pdf_factory, tmp_path,
                                               monkeypatch):
    """Sem permissao p/ medir o disco: tenta a operacao em vez de bloquear."""
    import shutil as _shutil

    def quebrado(_path):
        raise OSError("acesso negado ao disco")
    monkeypatch.setattr(_shutil, "disk_usage", quebrado)

    out = tmp_path / "merged.pdf"
    result = merge([str(pdf_factory(1, "a.pdf"))], str(out))
    assert Path(result).exists()


# ===== PDF: merge por tamanho — guarda de destino dentro da origem =====
# Sem o guarda, os PDFs gerados voltam como entrada na proxima execucao
# (laco de realimentacao) e o conteudo duplica a cada rodada.

def test_merge_by_size_recusa_destino_dentro_da_origem(tmp_path):
    from services.pdf_processor import merge_by_size

    src = tmp_path / "origem"
    src.mkdir()

    # destino igual a origem
    with pytest.raises(ValueError, match="destino"):
        merge_by_size(str(src), str(src), 1.0)

    # destino em subpasta da origem (recursive pegaria a saida)
    with pytest.raises(ValueError, match="destino"):
        merge_by_size(str(src), str(src / "saida"), 1.0)

    # rejeitado antes do mkdir: a pasta de saida nem foi criada
    assert not (src / "saida").exists()


def test_merge_by_size_destino_fora_da_origem_funciona(pdf_factory, tmp_path):
    from services.pdf_processor import merge_by_size

    src = tmp_path / "origem"
    src.mkdir()
    pdf_factory(1, "a.pdf").rename(src / "a.pdf")
    pdf_factory(1, "b.pdf").rename(src / "b.pdf")

    dest = tmp_path / "saida"  # irma da origem: permitido
    stats = merge_by_size(str(src), str(dest), 1.0)

    assert stats["merged_groups"] == 1, stats
    assert stats["errors"] == [], stats
    assert list(dest.glob("*.pdf"))


def test_rota_merge_by_size_recusa_destino_dentro_da_origem(client, tmp_path):
    from helpers import post_sync

    src = tmp_path / "origem"
    src.mkdir()
    r = post_sync(client, "/api/pdf/merge-by-size", json={
        "source_dir": str(src),
        "dest_dir": str(src / "saida"),
        "max_size_mb": 1.0,
    })
    assert r.status_code == 400, r.status_code
    assert "destino" in r.get_json()["error"]


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


# ===== PDF: conversao por intervalo de paginas (escala) =====
# O arquivo real de 9315 paginas levou >53 min sem limite; agora o
# usuario escolhe as paginas (e a UI pergunta antes do arquivo inteiro).

def test_convert_to_word_com_selecao_de_paginas(tmp_path):
    import zipfile

    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas as _canvas
    from services.pdf_processor import convert_pdf_to_word

    src = tmp_path / 'paginado.pdf'
    c = _canvas.Canvas(str(src), pagesize=A4)
    for palavra in ('UNO', 'DOS', 'TRES', 'QUATRO'):
        c.drawString(72, 700, palavra)
        c.showPage()
    c.save()
    out = tmp_path / 'sel.docx'

    result = convert_pdf_to_word(str(src), str(out),
                                 pages_selection='2-3')

    assert out.exists()
    assert result['pages_converted'] == 2, result
    with zipfile.ZipFile(out) as z:
        xml = z.read('word/document.xml')
    assert b'DOS' in xml and b'TRES' in xml, xml[:400]
    assert b'UNO' not in xml, xml[:400]


def test_rota_convert_to_word_selecao_e_validacoes(client, tmp_path):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas as _canvas
    from helpers import post_sync

    src = tmp_path / 'dois.pdf'
    c = _canvas.Canvas(str(src), pagesize=A4)
    c.drawString(72, 700, 'primeira')
    c.showPage()
    c.drawString(72, 700, 'segunda')
    c.showPage()
    c.save()
    out = tmp_path / 'dois.docx'

    # selecao valida -> converte so a pagina2
    r = post_sync(client, '/api/pdf/convert-to-word', json={
        'pdf_path': str(src), 'output_path': str(out),
        'pages_selection': '2-2'})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['pages_converted'] == 1, body
    assert out.exists()

    # intervalo fora do total -> 400 (ValueError do parser)
    bad = post_sync(client, '/api/pdf/convert-to-word', json={
        'pdf_path': str(src), 'output_path': str(out),
        'pages_selection': '99-100'})
    assert bad.status_code == 400, bad.status_code
    assert 'inválido' in bad.get_json()['error'], bad.get_json()

    # sintaxe invalida -> 400
    bad2 = post_sync(client, '/api/pdf/convert-to-word', json={
        'pdf_path': str(src), 'output_path': str(out),
        'pages_selection': 'abc'})
    assert bad2.status_code == 400, bad2.status_code


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
    """Imagem cinza + /SMask (quadrado central opaco) via pikepdf puro.

    400px exibidos em 100pt (1,39in => ~288dpi efetivo): com alvo72 a
    imagem E reamostrada (a composicao da mascara roda).
    """
    import zlib
    import pikepdf
    from PIL import Image as PILImage
    w = h = 400
    main = PILImage.new('RGB', (w, h), (128, 128, 128))
    mask = PILImage.new('L', (w, h), 0)
    for x in range(150, 250):
        for y in range(150, 250):
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
    page.obj.Contents = pdf.make_stream(b'q 100 0 0 100 0 0 cm /Im0 Do Q')
    out = tmp_path / name
    pdf.save(str(out))
    pdf.close()
    return out


def _placed_photo_pdf(tmp_path, name, px, display_pt):
    """Foto quadrada px x px exibida em display_pt — DPI efetivo conhecido."""
    from PIL import Image as PILImage
    img = PILImage.new('RGB', (px, px), (30, 90, 200))
    jpg = tmp_path / f'{name}.jpg'
    img.save(jpg, format='JPEG', quality=95)
    from reportlab.pdfgen import canvas as _canvas
    from reportlab.lib.pagesizes import A4 as _A4
    c = _canvas.Canvas(str(tmp_path / name), pagesize=_A4)
    c.drawImage(str(jpg), 50, 50, width=display_pt, height=display_pt)
    c.showPage()
    c.save()
    return tmp_path / name


def test_compress_dpi_efetivo_calculado_pelo_tamanho_exibido(tmp_path):
    """1800px em 216pt (3in => 600dpi efetivo); alvo150 -> ~450px.

    A heuristica antiga (300dpi fixo) produziria 900px.
    """
    import pikepdf
    from services.pdf_processor import compress
    src = _placed_photo_pdf(tmp_path, 'dpi.pdf', 1800, 216)
    result = compress(str(src), str(tmp_path / 'dpi_out.pdf'), 'low', 85)
    with pikepdf.open(result['output_path']) as p:
        w = int(list(p.pages[0].get_images().values())[0].Width)
    assert 430 <= w <= 470, w


def test_compress_mantem_imagem_dentro_do_alvo(tmp_path):
    """100px em 144pt (2in => 50dpi efetivo); alvo100 -> mantida intacta.

    Escala >1: sem resize e sem reencodar (a heuristica antiga daria33px).
    """
    import pikepdf
    from services.pdf_processor import compress
    src = _placed_photo_pdf(tmp_path, 'pequena.pdf', 100, 144)
    result = compress(str(src), str(tmp_path / 'pequena_out.pdf'), 'medium', 85)
    with pikepdf.open(result['output_path']) as p:
        w = int(list(p.pages[0].get_images().values())[0].Width)
    assert w == 100, w


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
    import pymupdf
    d = pymupdf.open(str(out))
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


# ===== PDF: validação de integridade (validate) =====
# Cenários reais de corrupção: vazio, lixo, truncamento, stream de
# imagem corrompido, EOF ausente e criptografia.

def test_validate_pdf_integro(tmp_path, pdf_factory):
    from services.pdf_processor import validate_pdf
    src = pdf_factory(2, 'integro.pdf')
    r = validate_pdf(str(src))
    assert r['valid'] is True, r
    assert r['stats']['pages'] == 2
    assert r['stats']['pdf_version']
    assert r['stats']['file_size'] > 0
    assert all(c['status'] == 'ok' for c in r['checks']), r['checks']
    ids = [c['id'] for c in r['checks']]
    for expected in ('cabecalho', 'eof', 'abertura', 'estrutura',
                     'paginas', 'fluxos', 'imagens', 'fontes'):
        assert expected in ids, ids


def test_validate_pdf_vazio(tmp_path):
    from services.pdf_processor import validate_pdf
    src = tmp_path / 'vazio.pdf'
    src.write_bytes(b'')
    r = validate_pdf(str(src))
    assert r['valid'] is False
    erro = [c for c in r['checks'] if c['status'] == 'error']
    assert erro and erro[0]['id'] == 'arquivo', r['checks']


def test_validate_pdf_lixo(tmp_path):
    from services.pdf_processor import validate_pdf
    src = tmp_path / 'lixo.pdf'
    src.write_bytes(b'isto nao e um arquivo pdf ' * 200)
    r = validate_pdf(str(src))
    assert r['valid'] is False
    assert any(c['id'] == 'cabecalho' and c['status'] == 'error'
               for c in r['checks']), r['checks']


def test_validate_pdf_truncado(tmp_path):
    """Truncamento em PDF com conteúdo: um dos leitores rejeita.

    (PDF em branco seria reconstruível pelos dois leitores — só avisos.)
    """
    from services.pdf_processor import validate_pdf
    from reportlab.pdfgen import canvas as _canvas
    from reportlab.lib.pagesizes import A4 as _A4
    src = tmp_path / 'inteiro.pdf'
    c = _canvas.Canvas(str(src), pagesize=_A4)
    for i in range(3):
        c.drawString(72, 720, f'pagina {i} com conteudo para truncar')
        c.showPage()
    c.save()
    data = src.read_bytes()
    trunc = tmp_path / 'truncado.pdf'
    trunc.write_bytes(data[: int(len(data) * 0.5)])
    r = validate_pdf(str(trunc))
    assert r['valid'] is False, r
    erros = [c['id'] for c in r['checks'] if c['status'] == 'error']
    assert erros, r['checks']


# ===== Junção bruta (concatenação byte a byte) =====
# Causa real: PDFs numerados a partir de1 colados com copy /b -> os
# objetos colidem, o leitor só enxerga o último segmento e as páginas
# dos anteriores somem em silêncio. validate_pdf olhava só as pontas
# (1024 bytes) e devolvia valid=True com conteúdo perdido.

def _mk_pdf_bytes(tmp_path, nome, n_paginas, marca):
    """PDF pequeno com objetos numerados a partir de1 (padrão pikepdf)."""
    import pikepdf
    p = tmp_path / nome
    with pikepdf.new() as pdf:
        for i in range(n_paginas):
            page = pdf.add_blank_page(page_size=(595, 842))
            stream = f"BT /F1 14 Tf 72 720 Td ({marca} p{i+1}) Tj ET"
            page.obj['/Contents'] = pdf.make_indirect(
                pikepdf.Stream(pdf, stream.encode()))
        pdf.save(str(p))
    return p


def _concatena(tmp_path, nome, fontes):
    """Cola PDFs byte a byte (o que o usuario fez com copy /b)."""
    destino = tmp_path / nome
    destino.write_bytes(b''.join(f.read_bytes() for f in fontes))
    return destino


def test_validate_detecta_juncao_bruta(tmp_path):
    """Colagem byte a byte: valid=False com check de error (antes
    devolvia valid=True tendo perdido3 das4 paginas)."""
    from services.pdf_processor import validate_pdf
    fontes = [_mk_pdf_bytes(tmp_path, 'a.pdf', 2, 'ALPHA'),
              _mk_pdf_bytes(tmp_path, 'b.pdf', 1, 'BETA'),
              _mk_pdf_bytes(tmp_path, 'c.pdf', 1, 'GAMMA')]
    colado = _concatena(tmp_path, 'colado.pdf', fontes)

    r = validate_pdf(str(colado))

    assert r['valid'] is False, r
    chk = [c for c in r['checks'] if c['id'] == 'concatenacao']
    assert chk, [c['id'] for c in r['checks']]
    assert chk[0]['status'] == 'error', chk
    assert '3 PDFs colados' in chk[0]['detail'], chk


def test_validate_pdf_integro_marcado_como_juncao_ok(tmp_path, pdf_factory):
    """PDF normal: um unico cabecalho -> check de juncao em ok
    (nao pode ser falso positivo de erro)."""
    from services.pdf_processor import validate_pdf
    src = pdf_factory(2, 'legal.pdf')
    r = validate_pdf(str(src))
    chk = [c for c in r['checks'] if c['id'] == 'concatenacao']
    assert chk and chk[0]['status'] == 'ok', r['checks']
    assert r['valid'] is True, r


def test_validate_pdf_embutido_nao_vira_erro(tmp_path):
    """Conteudo com %PDF- literal (PDF embutido em stream): dois
    cabecalhos mas o segundo NAO vem apos %%EOF -> warn, nao error.

    Guarda contra falso positivo que marcaria arquivo integro como
    corrompido.
    """
    from services.pdf_processor import validate_pdf
    import pikepdf
    src = tmp_path / 'embutido.pdf'
    with pikepdf.new() as pdf:
        page = pdf.add_blank_page(page_size=(595, 842))
        # stream cru (sem filtro) contendo o marcador literal
        page.obj['/Contents'] = pdf.make_indirect(pikepdf.Stream(
            pdf, b'BT (anexo: %PDF-1.4 interno) Tj ET'))
        pdf.save(str(src), compress_streams=False)

    dados = src.read_bytes()
    assert dados.count(b'%PDF-') >= 2, 'fixture deveria ter2 cabecalhos'

    r = validate_pdf(str(src))
    chk = [c for c in r['checks'] if c['id'] == 'concatenacao']
    assert chk, [c['id'] for c in r['checks']]
    assert chk[0]['status'] == 'warn', chk
    assert r['valid'] is True, r  # warn nao invalida


def test_repair_recupera_juncao_bruta(tmp_path):
    """O reparo separa os segmentos e funde com renumeracao — recupera
    TODAS as paginas (antes: falso sucesso com1 pagina)."""
    from services.pdf_processor import repair_pdf, validate_pdf
    import pymupdf
    fontes = [_mk_pdf_bytes(tmp_path, 'a.pdf', 2, 'ALPHA'),
              _mk_pdf_bytes(tmp_path, 'b.pdf', 1, 'BETA'),
              _mk_pdf_bytes(tmp_path, 'c.pdf', 1, 'GAMMA')]
    colado = _concatena(tmp_path, 'colado.pdf', fontes)
    originais = colado.read_bytes()

    # confirmacao do problema: so1 pagina antes do reparo
    with pymupdf.open(str(colado)) as d:
        assert d.page_count == 1, d.page_count

    saida = tmp_path / 'recuperado.pdf'
    rep = repair_pdf(str(colado), str(saida))

    # as4 paginas de volta, na ordem original
    with pymupdf.open(str(saida)) as d:
        assert d.page_count == 4, d.page_count
        textos = [d[i].get_text().strip() for i in range(d.page_count)]
    assert textos == ['ALPHA p1', 'ALPHA p2', 'BETA p1', 'GAMMA p1'], textos

    # relatorio honesto + arquivo final integro
    assert any(x.get('category') == 'concatenacao' for x in rep['repaired']), \
        rep['repaired']
    assert rep['validation']['valid'] is True, rep['validation']
    chk = [c for c in rep['validation']['checks']
           if c['id'] == 'concatenacao']
    assert chk and chk[0]['status'] == 'ok', chk

    # o original nunca e tocado
    assert colado.read_bytes() == originais

    # nenhum temporario do fundido vazando
    import tempfile as _tf
    from pathlib import Path as _P
    sobrando = list(_P(_tf.gettempdir()).glob('cremepe-fundido-*'))
    assert not sobrando, sobrando


def test_validate_pdf_imagem_corrompida(tmp_path):
    from services.pdf_processor import validate_pdf
    import pikepdf
    src = _placed_photo_pdf(tmp_path, 'img.pdf', 200, 100)
    corrompido = tmp_path / 'img_ruim.pdf'
    with pikepdf.open(str(src)) as pdf:
        img = list(pdf.pages[0].get_images().values())[0]
        img.write(b'\xff\xd8\xff\xe0' + b'lixo nao e um jpeg valido',
                  filter=pikepdf.Name('/DCTDecode'))
        pdf.save(str(corrompido))
    r = validate_pdf(str(corrompido))
    assert r['valid'] is False, r
    assert any(c['id'] == 'imagens' and c['status'] == 'error'
               for c in r['checks']), r['checks']


def test_validate_pdf_sem_eof(tmp_path, pdf_factory):
    """EOF ausente é aviso (o pikepdf/qpdf ainda reconstroi)."""
    from services.pdf_processor import validate_pdf
    src = pdf_factory(1, 'sem_eof.pdf')
    data = src.read_bytes().replace(b'%%EOF', b'')
    alt = tmp_path / 'sem_eof.pdf'
    alt.write_bytes(data)
    r = validate_pdf(str(alt))
    assert any(c['id'] == 'eof' and c['status'] == 'warn'
               for c in r['checks']), r['checks']
    assert r['valid'] is True, r


def test_validate_pdf_criptografado(tmp_path, pdf_factory):
    from services.pdf_processor import validate_pdf
    import pikepdf
    src = pdf_factory(1, 'normal.pdf')
    cifrado = tmp_path / 'cifrado.pdf'
    with pikepdf.open(str(src)) as pdf:
        pdf.save(str(cifrado),
                 encryption=pikepdf.Encryption(user='segredo', owner='dono'))
    r = validate_pdf(str(cifrado))
    assert r['stats']['encrypted'] is True, r
    assert any(c['id'] == 'criptografia' and c['status'] == 'warn'
               for c in r['checks']), r['checks']
    assert r['valid'] is True, r


def test_rota_validate_contrato_e_404(client, pdf_factory, tmp_path):
    from helpers import post_sync
    src = pdf_factory(1, 'rota.pdf')
    r = post_sync(client, '/api/pdf/validate', json={'pdf_path': str(src)})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['valid'] is True
    assert isinstance(body['checks'], list) and body['checks']
    assert 'stats' in body and 'pages' in body['stats']

    missing = post_sync(client, '/api/pdf/validate',
                        json={'pdf_path': str(tmp_path / 'nao_existe.pdf')})
    assert missing.status_code == 404, missing.status_code


# ===== pdf/info: contagem de paginas (sync) para validar antes do job =====

def test_rota_pdf_info_paginas_e_status(client, pdf_factory, tmp_path):
    import pymupdf

    from helpers import post_sync

    src = pdf_factory(4, 'info.pdf')
    ok = post_sync(client, '/api/pdf/info', json={'pdf_path': str(src)})
    assert ok.status_code == 200, ok.get_json()
    body = ok.get_json()
    assert body['success'] is True
    assert body['pages'] == 4
    assert body['encrypted'] is False
    assert body['file_size'] == src.stat().st_size

    # criptografado: conta as paginas mesmo sem a senha (fitz; o PyPDF2
    # instalado nao tem PyCryptodome e falharia em AES)
    enc = tmp_path / 'info_enc.pdf'
    doc = pymupdf.open(str(src))
    doc.save(str(enc), encryption=pymupdf.PDF_ENCRYPT_AES_256,
             owner_pw='segredo', user_pw='segredo')
    doc.close()
    ok_enc = post_sync(client, '/api/pdf/info', json={'pdf_path': str(enc)})
    assert ok_enc.status_code == 200, ok_enc.get_json()
    assert ok_enc.get_json()['pages'] == 4
    assert ok_enc.get_json()['encrypted'] is True

    # inexistente -> 404 (handlers globais)
    missing = post_sync(client, '/api/pdf/info',
                        json={'pdf_path': str(tmp_path / 'nao_existe.pdf')})
    assert missing.status_code == 404, missing.status_code

    # arquivo que nao e PDF -> 400 com mensagem (ValueError do servico)
    lixo = tmp_path / 'lixo.pdf'
    lixo.write_bytes(b'isto nao e um pdf')
    bad = post_sync(client, '/api/pdf/info', json={'pdf_path': str(lixo)})
    assert bad.status_code == 400, bad.status_code
    assert bad.get_json()['error']


# ===== PDF: cores DeviceN — deteccao e reparo de aridade =====
# Defeito real (ferramenta baseada em PDFium): tint transform FunctionType
# com Domain [0 1] (1 entrada) para 2-3 colorantes deixa os shadings
# PatternType 2 inaveis em Adobe/Chrome (branco/preto). No arquivo real do
# usuario o check acusa 150 ocorrencias no original e o corrigido passa
# limpo (verificado contra C:\Users\gjose\Desktop\Work\*.pdf).

def _mk(items):
    """Dictionary via atribuicao — kwargs do pikepdf nao grava chaves '/'."""
    import pikepdf
    d = pikepdf.Dictionary()
    for k, v in items.items():
        d[k] = v
    return d


def _type2(fn_type2_c0, domain=(0, 1)):
    import pikepdf
    return _mk({
        '/FunctionType': 2,
        '/Domain': pikepdf.Array(list(domain)),
        '/C0': pikepdf.Array(list(fn_type2_c0)),
        '/C1': pikepdf.Array([1] * len(fn_type2_c0)),
        '/N': 1,
    })


def _make_broken_devicen_pdf(path, colorants=('/Cyan', '/Magenta'),
                             alt='/DeviceCMYK', with_template=False,
                             shading_outputs=None, with_stitch=False,
                             broken_tint=True, shading_fn_type4=False):
    """1 pagina com DeviceN de tint transform Type 2 Domain [0 1]
    (1 entrada) para N colorantes, dentro de shading PatternType 2.

    shading_outputs: nº de saidas da funcao do shading (default N —
    correto); passar outro valor gera o caso (b) de deteccao.
    with_template: inclui um DeviceN CORRETO (Type 4) com a mesma tupla
    de colorantes p/ servir de template no reparo.
    with_stitch: inclui funcao Type 3 com subsfuncoes de saidas
    divergentes (caso (c)).
    broken_tint=False: o tint transform e correto (Type 4) — usado p/ isolar
    a deteccao de shading/stitch sem o caso (a).
    shading_fn_type4: a funcao do shading e Type 4 (programa) em vez de
    Type 2 — exercita o ajuste de programa (pop/zeros).
    """
    import pikepdf

    n = len(colorants)
    shading_outputs = n if shading_outputs is None else shading_outputs
    with pikepdf.new() as pdf:
        root = pdf.trailer['/Root']
        names = pikepdf.Array([pikepdf.Name(c) for c in colorants])

        if with_template:
            good_fn = pikepdf.Stream(pdf, b'{ pop 0 0 0 }')
            good_fn['/FunctionType'] = 4
            good_fn['/Domain'] = pikepdf.Array([0, 1] * n)
            good_fn['/Range'] = pikepdf.Array([0, 1, 0, 1, 0, 1, 0, 1])
            root['/GoodCS'] = pdf.make_indirect(pikepdf.Array(
                [pikepdf.Name('/DeviceN'), names,
                 pikepdf.Name(alt), good_fn]))

        if broken_tint:
            # tint transform QUEBRADO: Type 2 com Domain [0 1]
            tint = _type2([0, 0, 0, 0])
        else:
            tint = pikepdf.Stream(pdf, b'{ pop 0 0 0 }')
            tint['/FunctionType'] = 4
            tint['/Domain'] = pikepdf.Array([0, 1] * n)
            tint['/Range'] = pikepdf.Array([0, 1, 0, 1, 0, 1, 0, 1])
        devicen = pikepdf.Array(
            [pikepdf.Name('/DeviceN'), names, pikepdf.Name(alt),
             tint])

        if shading_fn_type4:
            # 1 entrada (axial) -> `shading_outputs` saidas
            sh_fn = pikepdf.Stream(pdf, b'{ 0 0 0 }')
            sh_fn['/FunctionType'] = 4
            sh_fn['/Domain'] = pikepdf.Array([0, 1])
            sh_fn['/Range'] = pikepdf.Array([0, 1] * shading_outputs)
        else:
            sh_fn = _type2([0] * shading_outputs)
        shading = _mk({
            '/ShadingType': 2,
            '/ColorSpace': devicen,
            '/Function': sh_fn,
            '/Coords': pikepdf.Array([0, 0, 595, 842]),
        })
        pattern = pdf.make_indirect(
            _mk({'/PatternType': 2, '/Shading': shading}))
        page = pdf.add_blank_page(page_size=(595, 842))
        page.obj['/Resources'] = _mk(
            {'/Pattern': _mk({'/P1': pattern})})
        page.obj['/Contents'] = pikepdf.Stream(
            pdf, b'/Pattern cs /P1 scn 0 0 100 100 re f\n')

        if with_stitch:
            # Type 3 com subsfuncoes de2 e 4 saidas (inconsistente)
            root['/StitchFn'] = pdf.make_indirect(_mk({
                '/FunctionType': 3,
                '/Domain': pikepdf.Array([0, 1]),
                '/Functions': pikepdf.Array(
                    [_type2([0, 0]), _type2([0, 0, 0, 0])]),
                '/Bounds': pikepdf.Array([0.5]),
                '/Encode': pikepdf.Array([0, 1, 0, 1]),
            }))

        pdf.save(str(path))


def _eval_type4(program, inputs, n_out):
    """Mini-avaliador do conjunto de operadores que o gerador emite
    (const/index/roll/pop/exch/add/sub/mul) — valida a funcao Type 4
    gerada pelo reparo sem depender de um renderizador."""
    st = list(inputs)
    for t in program.strip().strip('{}').split():
        if t == 'index':
            k = int(st.pop())
            st.append(st[-1 - k])
        elif t == 'roll':
            j = int(st.pop())
            n = int(st.pop())
            sub = st[-n:]
            mod = ((j % n) + n) % n
            if mod and n > 1:
                st[-n:] = [sub[(k - mod) % n] for k in range(n)]
        elif t == 'pop':
            st.pop()
        elif t == 'exch':
            st[-1], st[-2] = st[-2], st[-1]
        elif t == 'add':
            b = st.pop()
            st[-1] += b
        elif t == 'sub':
            b = st.pop()
            st[-1] -= b
        elif t == 'mul':
            b = st.pop()
            st[-1] *= b
        else:
            st.append(float(t))
    return st[-n_out:]


def _tint_programs(path):
    """Programas Type 4 dos tint transforms DeviceN do arquivo."""
    import pikepdf
    progs = []
    seen = set()

    def walk(o, depth=0):
        if depth > 16:
            return
        if isinstance(o, pikepdf.Array) and len(o) >= 4 \
                and str(o[0]) == '/DeviceN':
            fn = o[3]
            if hasattr(fn, 'read_bytes'):
                progs.append(fn.read_bytes().decode('ascii', 'replace'))
            return
        if isinstance(o, pikepdf.Dictionary):
            try:
                og = o.objgen
                if og and og != (0, 0):
                    if og in seen:
                        return
                    seen.add(og)
            except Exception:
                pass
            for _k, v in o.items():
                walk(v, depth + 1)
            return
        if isinstance(o, pikepdf.Array):
            for v in o:
                walk(v, depth + 1)

    with pikepdf.open(str(path)) as pdf:
        for obj in pdf.objects:
            walk(obj)
    return progs


def _cores_check(result):
    return [c for c in result['checks'] if c['id'] == 'cores'][0]


def test_validate_pdf_acusa_devicen_com_aridade_errada(tmp_path):
    from services.pdf_processor import validate_pdf
    src = tmp_path / 'devicen_quebrado.pdf'
    _make_broken_devicen_pdf(src)

    r = validate_pdf(str(src))
    cores = _cores_check(r)
    assert cores['status'] == 'error', r['checks']
    assert 'ocorrência' in cores['detail'] and 'DeviceN' in cores['detail']
    assert r['valid'] is False
    assert r['stats']['color_issues'] >= 1


def test_repair_pdf_corrige_fallback_e_revalida(tmp_path):
    import pymupdf
    from services.pdf_processor import repair_pdf
    src = tmp_path / 'devicen_quebrado.pdf'
    fixed = tmp_path / 'corrigido.pdf'
    _make_broken_devicen_pdf(src)
    before = src.read_bytes()

    rep = repair_pdf(str(src), str(fixed))

    # original intocavel; saida sempre gravada
    assert src.read_bytes() == before
    assert rep['repaired_count'] == 1
    assert rep['unrepaired_count'] == 0
    assert rep['repaired'][0]['strategy'] == 'identity'
    assert rep['validation']['valid'] is True, rep['validation']
    assert _cores_check(rep['validation'])['status'] == 'ok'
    assert rep['validation']['stats']['color_issues'] == 0

    # abre no fitz e a funcao gerada faz a identidade CMYK certa
    with pymupdf.open(str(fixed)) as doc:
        assert doc.page_count == 1
    prog = _tint_programs(fixed)[0]
    assert _eval_type4(prog, [0.3, 0.7], 4) == [0.3, 0.7, 0.0, 0.0]


def test_repair_pdf_usa_template_do_documento(tmp_path):
    from services.pdf_processor import repair_pdf
    src = tmp_path / 'devicen_com_template.pdf'
    fixed = tmp_path / 'corrigido.pdf'
    _make_broken_devicen_pdf(src, with_template=True)

    rep = repair_pdf(str(src), str(fixed))

    assert rep['repaired_count'] == 1
    assert rep['repaired'][0]['strategy'] == 'template'
    assert rep['validation']['valid'] is True, rep['validation']


def test_repair_pdf_gera_cmyk_para_rgb(tmp_path):
    from services.pdf_processor import repair_pdf
    src = tmp_path / 'devicen_rgb.pdf'
    fixed = tmp_path / 'corrigido.pdf'
    _make_broken_devicen_pdf(
        src, colorants=('/Cyan', '/Magenta', '/Yellow', '/Black'),
        alt='/DeviceRGB')

    rep = repair_pdf(str(src), str(fixed))

    assert rep['repaired_count'] == 1
    assert rep['repaired'][0]['strategy'] == 'cmyk2rgb'
    assert rep['validation']['valid'] is True, rep['validation']
    # R=(1-C)(1-K), G=(1-M)(1-K), B=(1-Y)(1-K)
    prog = _tint_programs(fixed)[0]
    outs = _eval_type4(prog, [0.2, 0.4, 0.6, 0.8], 3)
    esperado = [(1 - 0.2) * (1 - 0.8), (1 - 0.4) * (1 - 0.8),
                (1 - 0.6) * (1 - 0.8)]
    assert all(abs(a - b) < 1e-9 for a, b in zip(outs, esperado)), outs


def test_validate_pdf_saudavel_sem_falso_positivo(tmp_path, pdf_factory):
    from services.pdf_processor import repair_pdf, validate_pdf
    src = pdf_factory(2, 'saudavel.pdf')

    r = validate_pdf(str(src))
    assert _cores_check(r)['status'] == 'ok', r['checks']
    assert r['stats']['color_issues'] == 0

    # reparo em PDF saudavel: nao altera nada e nao toca no original
    before = src.read_bytes()
    out = tmp_path / 'copia.pdf'
    rep = repair_pdf(str(src), str(out))
    assert rep['repaired_count'] == 0
    assert rep['unrepaired_count'] == 0
    assert rep['validation']['valid'] is True
    assert src.read_bytes() == before
    assert out.exists()


def test_repair_pdf_sem_correcao_segura_nao_altera(tmp_path):
    from services.pdf_processor import repair_pdf
    src = tmp_path / 'spot_sem_template.pdf'
    fixed = tmp_path / 'saida.pdf'
    # colorantes de spot (fora das tintas de processo) e sem template:
    # nao da para corrigir com seguranca -> nao altera, reporta
    _make_broken_devicen_pdf(
        src, colorants=('/SpotRed', '/SpotBlue'), alt='/DeviceCMYK')
    before = src.read_bytes()

    rep = repair_pdf(str(src), str(fixed))

    assert rep['repaired_count'] == 0
    assert rep['unrepaired_count'] == 1
    assert 'sem template' in rep['unrepaired'][0]['reason']
    # nunca piora: continua acusando (nao finge conserto)
    assert rep['validation']['valid'] is False
    assert src.read_bytes() == before


def test_validate_pdf_detecta_shading_com_funcao_divergente(tmp_path):
    from services.pdf_processor import validate_pdf
    src = tmp_path / 'shading_divergente.pdf'
    # DeviceN CORRETO (2 colorantes) mas funcao do shading com 4 saidas
    _make_broken_devicen_pdf(src, shading_outputs=4, broken_tint=False)

    r = validate_pdf(str(src))
    cores = _cores_check(r)
    assert cores['status'] == 'error', r['checks']
    assert 'shading' in cores['detail']
    assert 'DeviceN/Separation' not in cores['detail']
    assert r['valid'] is False


def test_validate_pdf_detecta_stitch_divergente(tmp_path):
    from services.pdf_processor import validate_pdf
    src = tmp_path / 'stitch_divergente.pdf'
    _make_broken_devicen_pdf(src, with_stitch=True, broken_tint=False)

    r = validate_pdf(str(src))
    cores = _cores_check(r)
    assert cores['status'] == 'error', r['checks']
    assert 'Type 3' in cores['detail']
    assert r['valid'] is False


def test_rota_pdf_repair_contrato_e_erros(client, tmp_path):
    from helpers import post_sync
    src = tmp_path / 'q.pdf'
    fixed = tmp_path / 'q_corrigido.pdf'
    _make_broken_devicen_pdf(src)

    # job: repara, devolve o relatorio e grava a saida
    r = post_sync(client, '/api/pdf/repair', json={
        'input_path': str(src), 'output_path': str(fixed)})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['repaired_count'] == 1
    assert body['color_issues_before'] == 1
    assert body['validation']['valid'] is True
    assert fixed.exists()

    # original intocavel
    assert (tmp_path / 'q.pdf').exists()

    # output igual ao input -> 400 (nunca alterar o original)
    same = post_sync(client, '/api/pdf/repair', json={
        'input_path': str(src), 'output_path': str(src)})
    assert same.status_code == 400, same.status_code

    # inexistente -> 404
    miss = post_sync(client, '/api/pdf/repair', json={
        'input_path': str(tmp_path / 'nao.pdf'),
        'output_path': str(fixed)})
    assert miss.status_code == 404, miss.status_code


def test_repair_pdf_reporta_progresso_por_fases(tmp_path,
                                                 progress_collector):
    from services.pdf_processor import repair_pdf
    src = tmp_path / 'q.pdf'
    _make_broken_devicen_pdf(src)

    rep = repair_pdf(str(src), str(tmp_path / 'out.pdf'))

    # collector: [(current, total)] — o span vira percentual
    # current*100/total. Fases encadeadas: varredura 0-30, mutacao
    # 30-45, gravacao 45-55, revalidacao 55-100 (a barra so avanca).
    assert progress_collector, 'reparo nao reportou progresso'
    pcts = [cur * 100 // tot for cur, tot in progress_collector]
    assert pcts == sorted(pcts), pcts
    assert max(pcts) >= 55, pcts
    assert rep['validation']['valid'] is True


def test_repair_pdf_corrige_paginas_fluxos_imagens_fontes(tmp_path):
    """Corrige TODAS as categorias de erro de validate de uma vez."""
    import pikepdf
    from services.pdf_processor import repair_pdf, validate_pdf
    src = tmp_path / 'defeitos.pdf'
    fixed = tmp_path / 'corrigido.pdf'
    with pikepdf.new() as pdf:
        page = pdf.add_blank_page(page_size=(595, 842))
        # paginas: MediaBox invalido (0 x 0)
        page.obj['/MediaBox'] = pikepdf.Array([0, 0, 0, 0])
        # fluxos: conteudo com Filter FlateDecode corrompido
        s = pikepdf.Stream(pdf, b'isto-nao-e-zlib')
        s['/Filter'] = pikepdf.Name('/FlateDecode')
        page.obj['/Contents'] = s
        # imagens: DCTDecode com stream lixo
        img = pikepdf.Stream(pdf, b'lixo-jpeg')
        img['/Subtype'] = pikepdf.Name('/Image')
        img['/Width'] = 10
        img['/Height'] = 10
        img['/ColorSpace'] = pikepdf.Name('/DeviceRGB')
        img['/BitsPerComponent'] = 8
        img['/Filter'] = pikepdf.Name('/DCTDecode')
        img = pdf.make_indirect(img)
        # fontes: dict incompleto (aviso no validate)
        page.obj['/Resources'] = _mk({
            '/XObject': _mk({'/Im1': img}),
            '/Font': _mk({'/F1': pikepdf.Dictionary()}),
        })
        pdf.save(str(src))

    r = validate_pdf(str(src))
    assert r['valid'] is False, r['checks']
    erros = {c['id'] for c in r['checks'] if c['status'] == 'error'}
    assert {'paginas', 'fluxos', 'imagens'} <= erros, erros
    assert any(c['id'] == 'fontes' and c['status'] == 'warn'
               for c in r['checks']), r['checks']

    rep = repair_pdf(str(src), str(fixed))

    cats = {e['category'] for e in rep['repaired']}
    assert {'paginas', 'fluxos', 'imagens', 'fontes'} <= cats, cats
    assert rep['validation']['valid'] is True, rep['validation']
    for c in rep['validation']['checks']:
        assert c['status'] == 'ok', c

    # imagem: placeholder 8x8 no mesmo XObject (posicao preservada)
    with pikepdf.open(str(fixed)) as p2:
        xobj = p2.pages[0].obj['/Resources']['/XObject']
        assert int(xobj['/Im1']['/Width']) == 8
        assert int(xobj['/Im1']['/Height']) == 8
    # original intacto
    assert src.exists()


def test_repair_pdf_corrige_shading_e_stitch(tmp_path):
    from services.pdf_processor import repair_pdf, validate_pdf
    src = tmp_path / 'cores_divergentes.pdf'
    fixed = tmp_path / 'corrigido.pdf'
    # (b) shading com funcao de 4 saidas p/ 2 colorantes +
    # (c) stitch com subsfuncoes de 2 e 4 saidas
    _make_broken_devicen_pdf(src, shading_outputs=4, with_stitch=True,
                             broken_tint=False)

    r = validate_pdf(str(src))
    assert r['valid'] is False, r['checks']
    cores = _cores_check(r)
    assert 'shading' in cores['detail'] and 'Type 3' in cores['detail']

    rep = repair_pdf(str(src), str(fixed))

    details = [e.get('detail', '') for e in rep['repaired']]
    assert any('shading' in d for d in details), details
    assert any('subsfunções' in d for d in details), details
    assert rep['validation']['valid'] is True, rep['validation']
    assert _cores_check(rep['validation'])['status'] == 'ok'


def test_repair_pdf_ajusta_funcao_shading_type4(tmp_path):
    import pikepdf
    from services.pdf_processor import repair_pdf, validate_pdf
    src = tmp_path / 'shading_type4.pdf'
    fixed = tmp_path / 'corrigido.pdf'
    # funcao Type 4 (programa) com 4 saidas p/ 2 colorantes
    _make_broken_devicen_pdf(src, shading_outputs=4, broken_tint=False,
                             shading_fn_type4=True)

    r = validate_pdf(str(src))
    assert r['valid'] is False, r['checks']
    assert 'shading' in _cores_check(r)['detail']

    rep = repair_pdf(str(src), str(fixed))
    assert rep['validation']['valid'] is True, rep['validation']

    # o programa ganhou `pop` para cortar as saidas excedentes
    with pikepdf.open(str(fixed)) as p2:
        progs = []

        def walk(o, depth=0):
            if depth > 16:
                return
            if isinstance(o, pikepdf.Dictionary) \
                    and int(o.get('/PatternType', -1)) == 2:
                fn = o['/Shading']['/Function']
                if hasattr(fn, 'read_bytes'):
                    progs.append(fn.read_bytes().decode('ascii', 'replace'))
                return
            if isinstance(o, (pikepdf.Dictionary, pikepdf.Stream)):
                for _k, v in o.items():
                    walk(v, depth + 1)
                return
            if isinstance(o, pikepdf.Array):
                for v in o:
                    walk(v, depth + 1)

        for obj in p2.objects:
            walk(obj)
    assert progs and 'pop' in progs[0], progs


def test_repair_pdf_arquivo_inabrivel_copia_e_reporta(tmp_path):
    from reportlab.lib.pagesizes import A4 as _A4
    from reportlab.pdfgen import canvas as _canvas
    from services.pdf_processor import repair_pdf
    src = tmp_path / 'inteiro.pdf'
    c = _canvas.Canvas(str(src), pagesize=_A4)
    for i in range(3):
        c.drawString(72, 720, f'pagina {i} com conteudo para truncar')
        c.showPage()
    c.save()
    data = src.read_bytes()
    trunc = tmp_path / 'truncado.pdf'
    trunc.write_bytes(data[: int(len(data) * 0.5)])
    fixed = tmp_path / 'saida.pdf'
    before = trunc.read_bytes()

    rep = repair_pdf(str(trunc), str(fixed))

    # nada abriu (qpdf e MuPDF rejeitam): copia byte a byte + relatorio
    assert fixed.read_bytes() == before
    assert rep['repaired_count'] == 0
    assert rep['unrepaired_count'] >= 1
    assert rep['unrepaired'][0]['category'] in ('abertura', 'arquivo')
    # nunca piora: continua com o mesmo erro de abertura
    assert rep['validation']['valid'] is False
    assert trunc.read_bytes() == before


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


# ===== rename-by-content: skipped vem como {path, reason} =====
# O front renderiza item.path/item.reason — strings viravam "undefined"
# na tabela de preview (bug de contrato).

def test_rename_by_content_preview_skipped_com_path_e_motivo(client,
                                                             tmp_path):
    from helpers import post_sync

    d = tmp_path / 'rbc'
    d.mkdir()
    (d / 'relatorio.txt').write_text('relatorio', encoding='utf-8')
    (d / 'foto.xyz').write_bytes(b'conteudo')

    r = post_sync(client, '/api/files/rename-by-content/preview',
                  json={'dir': str(d), 'pattern': 'auto'})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True

    # skipped: dicts com path+reason (antes: strings -> undefined no front)
    assert body['skipped'], body
    for sk in body['skipped']:
        assert isinstance(sk, dict) and 'path' in sk and 'reason' in sk, sk
    foto = [s for s in body['skipped'] if s['path'].endswith('foto.xyz')]
    assert foto, body['skipped']
    assert foto[0]['reason'] == 'extensão não suportada', foto

    # renamed continua com original/new
    if body['renamed']:
        entry = body['renamed'][0]
        assert 'original' in entry and 'new' in entry, entry


# ===== Arquivos: archive com senha e tar (filter='data') =====
# O fluxo com senha nao tinha NENHUM teste (nem pytest nem audit) e o
# extractall do tar dependia do default implicito do Python.

def test_archive_zip_com_password_cria_e_extrai(tmp_path):
    import pyzipper
    from services.file_archive_manager import create_zip, extract_archive

    src = tmp_path / 'dados'
    src.mkdir()
    (src / 'a.txt').write_text('conteudo confidencial', encoding='utf-8')
    out = tmp_path / 'secreto.zip'

    create_zip([str(src / 'a.txt')], str(out), password='segredo123')

    dest = tmp_path / 'extraido'
    extract_archive(str(out), str(dest), password='segredo123')
    assert (dest / 'a.txt').read_text(encoding='utf-8') == \
        'conteudo confidencial'

    # sem a senha a extracao falha (erro honesto, sem mascaramento)
    with pytest.raises(Exception):
        extract_archive(str(out), str(tmp_path / 'sem_senha'), password=None)

    # o zip realmente esta criptografado (pyzipper AES)
    with pyzipper.AESZipFile(str(out), 'r') as zf:
        assert zf.getinfo('a.txt').flag_bits & 0x1, 'flag de cripto ausente'


def test_archive_tar_extrai_e_bloqueia_tar_slip(tmp_path):
    import io
    import tarfile as tf
    from services.file_archive_manager import extract_archive

    # tar normal: extrai com filter='data'
    orig = tmp_path / 't.txt'
    orig.write_text('ola', encoding='utf-8')
    tar_path = tmp_path / 'arq.tar'
    with tf.open(str(tar_path), 'w') as tar:
        tar.add(str(orig), arcname='t.txt')
    dest = tmp_path / 'out'
    extract_archive(str(tar_path), str(dest))
    assert (dest / 't.txt').read_text(encoding='utf-8') == 'ola'

    # tar-slip: entrada ../ saindo do destino -> filter='data' bloqueia
    mal = tmp_path / 'mal.tar'
    with tf.open(str(mal), 'w') as tar:
        info = tf.TarInfo(name='../fora.txt')
        payload = b'vazamento'
        info.size = len(payload)
        tar.addfile(info, io.BytesIO(payload))
    with pytest.raises(Exception):
        extract_archive(str(mal), str(tmp_path / 'saida'))
    assert not (tmp_path / 'fora.txt').exists()


# ===== Arquivos: cobertura de rotas (organize/report/compare/sync) =====
# Antes so cobertos pelo audit funcional (sem regressao fina em pytest).

def test_rota_organize_preview_e_executa(client, tmp_path):
    from helpers import post_sync
    src = tmp_path / 'org'
    src.mkdir()
    (src / 'foto.png').write_bytes(b'png')
    (src / 'texto.txt').write_text('t', encoding='utf-8')

    prev = post_sync(client, '/api/files/organize/preview',
                     json={'dir': str(src)})
    assert prev.status_code == 200, prev.get_json()
    groups = prev.get_json()['preview']
    assert groups, 'preview vazio'
    for g in groups:
        assert {'folder', 'files', 'count'} <= set(g), g

    run = post_sync(client, '/api/files/organize', json={'dir': str(src)})
    assert run.status_code == 200, run.get_json()
    assert run.get_json()['processed_count'] == 2

    # movidos para subpastas por extensao (nome: extensao maiuscula)
    assert not (src / 'foto.png').exists()
    moved = list(src.rglob('foto.png'))
    assert moved and moved[0].parent != src, list(src.iterdir())
    assert (src / 'TXT' / 'texto.txt').exists() or \
        (src / 'txt' / 'texto.txt').exists(), list(src.iterdir())


def test_rota_report_txt_e_csv(client, tmp_path):
    from helpers import post_sync
    src = tmp_path / 'estrutura'
    (src / 'sub').mkdir(parents=True)
    (src / 'arq.txt').write_text('oi', encoding='utf-8')

    r = post_sync(client, '/api/files/report',
                  json={'dir': str(src), 'format': 'txt'})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert 'content' in body, body
    assert 'Relatório de estrutura' in body['content'], body

    out = tmp_path / 'rel.csv'
    r2 = post_sync(client, '/api/files/report', json={
        'dir': str(src), 'format': 'csv', 'output_path': str(out)})
    assert r2.status_code == 200, r2.get_json()
    assert r2.get_json()['saved_path'] == str(out)
    assert out.exists()
    assert out.read_text(encoding='utf-8').startswith('Tipo')


def test_rota_compare_e_sync(client, tmp_path):
    from helpers import post_sync
    a = tmp_path / 'a'
    b = tmp_path / 'b'
    a.mkdir()
    b.mkdir()
    (a / 'igual.txt').write_text('1', encoding='utf-8')
    (a / 'so_origem.txt').write_text('2', encoding='utf-8')
    (b / 'igual.txt').write_text('1', encoding='utf-8')

    r = post_sync(client, '/api/files/compare', json={
        'source_dir': str(a), 'target_dir': str(b),
        'compare_by_hash': True})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['total_source'] == 2 and body['total_target'] == 1, body
    assert len(body['identical']) == 1, body
    assert len(body['only_in_source']) == 1, body
    assert len(body['only_in_target']) == 0, body
    assert len(body['modified_in_source']) == 0, body

    # sync copy_to_target copia so o que falta (comparacao por hash)
    s = post_sync(client, '/api/files/sync', json={
        'source_dir': str(a), 'target_dir': str(b),
        'action': 'copy_to_target', 'compare_by_hash': True})
    assert s.status_code == 200, s.get_json()
    sb = s.get_json()
    assert sb['copied'] == 1, sb
    assert (b / 'so_origem.txt').exists()


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


def test_split_custom_reporta_progresso(tmp_path, pdf_factory,
                                        progress_collector):
    from services.pdf_processor import split_custom
    src = pdf_factory(6, 'gde.pdf')
    out = tmp_path / 'partes'

    stats = split_custom(str(src), str(out), '1-3, 4-6')

    assert stats['total_files'] == 2
    assert progress_collector, 'split_custom nao reportou progresso'
    pcts = [c * 100 // t for c, t in progress_collector]
    assert pcts == sorted(pcts), pcts
    assert max(pcts) >= 50, pcts


def test_rename_by_content_reporta_progresso(tmp_path, progress_collector):
    from controllers.file_controller import FileController
    d = tmp_path / 'rbc_prog'
    d.mkdir()
    (d / 'a.txt').write_text('x', encoding='utf-8')
    (d / 'b.xyz').write_bytes(b'y')

    FileController().rename_by_content(dir_path=str(d), dry_run=True)

    assert progress_collector, 'rename_by_content nao reportou progresso'
    pcts = [c * 100 // t for c, t in progress_collector]
    assert pcts == sorted(pcts), pcts
    assert max(pcts) >= 50, pcts  # 2 arquivos -> 50/100


def test_compare_hash_reporta_progresso(tmp_path, progress_collector):
    from services.file_comparator import compare_folders
    a = tmp_path / 'cmp_a'
    b = tmp_path / 'cmp_b'
    a.mkdir()
    b.mkdir()
    (a / 'f.txt').write_text('1', encoding='utf-8')
    (b / 'f.txt').write_text('1', encoding='utf-8')

    compare_folders(str(a), str(b), compare_by_hash=True)

    assert progress_collector, 'compare (hash) nao reportou progresso'
    pcts = [c * 100 // t for c, t in progress_collector]
    assert pcts == sorted(pcts), pcts
    assert max(pcts) >= 50, pcts  # origem+destino -> 50/100


def test_extract_archive_reporta_progresso(tmp_path, progress_collector):
    from services.file_archive_manager import create_zip, extract_archive
    src = tmp_path / 'prog_src'
    src.mkdir()
    (src / 'a.txt').write_text('a', encoding='utf-8')
    (src / 'b.txt').write_text('b', encoding='utf-8')
    z = tmp_path / 'prog.zip'
    create_zip([str(src / 'a.txt'), str(src / 'b.txt')], str(z))
    progress_collector.clear()  # so o que a extracao reportar

    dest = tmp_path / 'prog_out'
    extract_archive(str(z), str(dest))

    assert progress_collector, 'extract nao reportou progresso'
    pcts = [c * 100 // t for c, t in progress_collector]
    assert pcts == sorted(pcts), pcts
    assert max(pcts) >= 50, pcts  # 2 membros -> 50/100
    assert (dest / 'a.txt').exists() and (dest / 'b.txt').exists()


def test_extract_7z_reporta_progresso_por_arquivo(tmp_path,
                                                   progress_collector):
    """7z: o py7zr chama o callback numa thread SEPARADA — sem capturar o
    reporter da thread do job, o progresso seria no-op silencioso."""
    import py7zr
    from services.file_archive_manager import extract_archive

    d = tmp_path / 'fonte7z'
    d.mkdir()
    for i in range(8):
        (d / f'f{i}.txt').write_text(f'conteudo {i}' * 100, encoding='utf-8')
    z = tmp_path / 'arq.7z'
    with py7zr.SevenZipFile(str(z), 'w') as arc:
        arc.writeall(str(d), 'fonte7z')

    dest = tmp_path / 'saida7z'
    extract_archive(str(z), str(dest))

    assert progress_collector, 'extract (7z) nao reportou progresso'
    pcts = [c * 100 // t for c, t in progress_collector]
    assert pcts == sorted(pcts), f'progresso nao monotono: {pcts}'
    # 8 arquivos: total vem do list(), cada report_end avanca um
    assert progress_collector[-1] == (8, 8), progress_collector
    assert len(list(dest.rglob('*.txt'))) == 8


def test_extract_rar_reporta_progresso_membro_a_membro(tmp_path,
                                                        progress_collector,
                                                        monkeypatch):
    """rar: sem ferramenta .rar no ambiente, valida o LOOP com mock —
    infolist + extract por membro reportando como zip/tar."""
    import rarfile
    from services.file_archive_manager import _extract_rar

    class Membro:
        def __init__(self, nome):
            self.filename = nome

    extratidos = []

    class FakeRar:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def infolist(self):
            return [Membro(f'f{i}.rar') for i in range(5)]

        def extract(self, member, path=None, pwd=None):
            extratidos.append(member.filename)

    monkeypatch.setattr(rarfile, 'RarFile', FakeRar)
    _extract_rar('qualq.rar', str(tmp_path), None)

    assert extratidos == [f'f{i}.rar' for i in range(5)]
    assert progress_collector, 'extract (rar) nao reportou progresso'
    assert progress_collector[-1] == (5, 5), progress_collector


def test_set_attributes_reporta_progresso(tmp_path, progress_collector):
    from controllers.file_controller import FileController
    d = tmp_path / 'attr_prog'
    d.mkdir()
    (d / 'x.txt').write_text('x', encoding='utf-8')
    (d / 'y.txt').write_text('y', encoding='utf-8')

    n = FileController().set_attributes(
        dir_path=str(d), options={'readonly': False})

    assert n == 2
    assert progress_collector, 'set_attributes nao reportou progresso'
    pcts = [c * 100 // t for c, t in progress_collector]
    assert pcts == sorted(pcts), pcts
    assert max(pcts) >= 50, pcts  # 2 arquivos -> 50/100


# ===== PDF: remove/reorder devolvem output_path (padrao) =====
# Antes devolviam output_file (chave heterogenea vs todas as demais
# features, que usam output_path).

def test_remove_e_reorder_devolvem_output_path(client, tmp_path, pdf_factory):
    from helpers import post_sync
    src = pdf_factory(4, 'doc.pdf')

    out1 = tmp_path / 'menos.pdf'
    r = post_sync(client, '/api/pdf/remove-pages', json={
        'pdf_path': str(src), 'output_path': str(out1),
        'pages_to_remove_str': '4'})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['output_path'] == str(out1), body
    assert 'output_file' not in body, body

    out2 = tmp_path / 'reord.pdf'
    r2 = post_sync(client, '/api/pdf/reorder-pages', json={
        'pdf_path': str(src), 'output_path': str(out2),
        'new_order_str': '4,3,2,1'})
    assert r2.status_code == 200, r2.get_json()
    body2 = r2.get_json()
    assert body2['output_path'] == str(out2), body2
    assert 'output_file' not in body2, body2


# ===== PDF: split-by-size (sem O(n²)) e codec JBIG2 =====

def _make_jbig2_pdf(path):
    """PDF sintetico com imagem JBIG2 (bytes invalidos): este ambiente
    nao tem jbig2dec — mesma condicao dos PDFs de scanner reais
    (357 imagens JBIG2 no arquivo real do usuario)."""
    import pikepdf
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas as _canvas
    base = path.parent / '_base_jb2.pdf'
    c = _canvas.Canvas(str(base), pagesize=A4)
    c.drawString(72, 700, 'pagina com imagem')
    c.showPage()
    c.save()
    with pikepdf.open(str(base)) as pdf:
        img = pikepdf.Stream(pdf, b'\x00' * 128)
        img['/Subtype'] = pikepdf.Name('/Image')
        img['/Width'] = 64
        img['/Height'] = 64
        img['/ColorSpace'] = pikepdf.Name('/DeviceGray')
        img['/BitsPerComponent'] = 1
        img['/Filter'] = pikepdf.Name('/JBIG2Decode')
        img = pdf.make_indirect(img)
        page = pdf.pages[0]
        res = page.obj.get('/Resources') or pikepdf.Dictionary()
        xo = res.get('/XObject') or pikepdf.Dictionary()
        xo['/ImJB'] = img
        res['/XObject'] = xo
        page.obj['/Resources'] = res
        page.obj['/Contents'] = pikepdf.Stream(
            pdf, b'q 100 0 0 100 50 50 cm /ImJB Do Q\n')
        pdf.save(str(path))
    base.unlink(missing_ok=True)


def test_split_by_size_partes_conservam_paginas(tmp_path, pdf_factory):
    from PyPDF2 import PdfReader
    from services.pdf_processor import split_by_size
    src = pdf_factory(8, 'gde.pdf')

    # limite minusculo: cada pagina sozinha excede ->8 partes de1 pagina
    out1 = tmp_path / 'p1'
    stats = split_by_size(str(src), str(out1), max_size_mb=0.00001)
    assert stats['total_files'] == 8, stats
    files1 = list(out1.glob('*.pdf'))
    assert sum(len(PdfReader(str(f)).pages) for f in files1) == 8

    # limite agrupador (3 paginas por parte): NADA de pagina se perde
    single_max = max(f.stat().st_size for f in files1)
    out2 = tmp_path / 'p2'
    stats2 = split_by_size(str(src), str(out2),
                           max_size_mb=(single_max * 3) / (1024 * 1024))
    assert 1 <= stats2['total_files'] <= 4, stats2
    files2 = list(out2.glob('*.pdf'))
    assert sum(len(PdfReader(str(f)).pages) for f in files2) == 8
    assert stats2['errors'] == []


def test_compress_tolera_imagem_jbig2(tmp_path):
    import pikepdf
    from services.pdf_processor import compress
    src = tmp_path / 'com_jbig2.pdf'
    _make_jbig2_pdf(src)
    out = tmp_path / 'comprimido.pdf'

    r = compress(str(src), str(out), compression_level='medium',
                 jpeg_quality=85, downscale_images=True)

    # antes: DependencyError jbig2dec derrubava o job inteiro
    assert out.exists()
    assert r['skipped_images'] >= 1, r
    # a imagem JBIG2 foi PRESERVADA (filtro original) na saida
    with pikepdf.open(str(out)) as p2:
        img = list(p2.pages[0].get_images().values())[0]
        assert 'JBIG2' in str(img.get('/Filter')), img.get('/Filter')


def test_repair_preserva_imagem_de_codec_ausente(tmp_path):
    import pikepdf
    from services.pdf_processor import repair_pdf
    src = tmp_path / 'jb2.pdf'
    fixed = tmp_path / 'jb2_fix.pdf'
    _make_jbig2_pdf(src)

    rep = repair_pdf(str(src), str(fixed))

    # NAO substitui por placeholder: codec ausente NAO e corrupcao
    assert rep['repaired_count'] == 0, rep
    assert rep['unrepaired_count'] == 1, rep
    assert 'codec' in rep['unrepaired'][0]['reason'], rep['unrepaired']
    with pikepdf.open(str(fixed)) as p2:
        img = list(p2.pages[0].get_images().values())[0]
        assert 'JBIG2' in str(img.get('/Filter'))
        # read_raw_bytes: read_bytes tentaria DECODIFICAR (JBIG2)
        assert len(img.read_raw_bytes()) == 128  # bytes intactos
    # validacao final: imagens vira WARN (codec) -> nao invalida
    assert rep['validation']['valid'] is True, rep['validation']
    img_check = [c for c in rep['validation']['checks']
                 if c['id'] == 'imagens'][0]
    assert img_check['status'] == 'warn', img_check


def test_validate_imagem_de_codec_ausente_vira_warn(tmp_path):
    from services.pdf_processor import validate_pdf
    src = tmp_path / 'jb2.pdf'
    _make_jbig2_pdf(src)

    r = validate_pdf(str(src))

    img_check = [c for c in r['checks'] if c['id'] == 'imagens'][0]
    assert img_check['status'] == 'warn', r['checks']  # era error
    assert 'codec' in img_check['detail'], img_check
    assert r['valid'] is True, r['checks']  # warn nao invalida


def _make_raw_image_pdf(path, size=8):
    """PDF com imagem RAW (sem filtro) — pikepdf e fitz decodificam;
    usado com monkeypatch para simular pikepdf inoperante."""
    import pikepdf
    from PIL import Image
    raw = Image.new('RGB', (size, size), (10, 20, 30)).tobytes()
    with pikepdf.new() as pdf:
        img = pikepdf.Stream(pdf, raw)
        img['/Subtype'] = pikepdf.Name('/Image')
        img['/Width'] = size
        img['/Height'] = size
        img['/BitsPerComponent'] = 8
        img['/ColorSpace'] = pikepdf.Name('/DeviceRGB')
        img = pdf.make_indirect(img)
        page = pdf.add_blank_page(page_size=(200, 200))
        page.obj['/Resources'] = _mk({'/XObject': _mk({'/Im1': img})})
        page.obj['/Contents'] = pikepdf.Stream(
            pdf, b'q 50 0 0 50 10 10 cm /Im1 Do Q')
        pdf.save(str(path))
    return path


class _PikepdfInoperante:
    """Simula pikepdf sem decode (as_pil_image sempre falha)."""

    def __init__(self, *args, **kwargs):
        pass

    def as_pil_image(self):
        raise RuntimeError('pikepdf simulado como inoperante')


def test_scan_images_fallback_fitz_decodifica(tmp_path, monkeypatch):
    """pikepdf nao decodifica mas o MuPDF (fitz) consegue -> a imagem
    conta como decodificada (sem falso positivo no validate)."""
    import pikepdf as _pk
    from services import pdf_processor as pp
    src = _make_raw_image_pdf(tmp_path / 'raw.pdf')

    monkeypatch.setattr(_pk, 'PdfImage', _PikepdfInoperante)
    with _pk.open(str(src)) as pdf:
        total, fails = pp._scan_images(pdf, pdf_path=str(src))
    assert total == 1
    assert fails == [], fails  # fitz decodificou no fallback

    # se o fitz TAMBEM falha -> vira falha real (nao codec)
    def pixmap_quebrado(*args, **kwargs):
        raise RuntimeError('fitz simulado como inoperante')
    monkeypatch.setattr(pp.pymupdf, 'Pixmap', pixmap_quebrado)
    with _pk.open(str(src)) as pdf:
        total2, fails2 = pp._scan_images(pdf, pdf_path=str(src))
    assert len(fails2) == 1, fails2
    assert fails2[0][3] is False  # codec_ausente=False -> error


def test_compress_fallback_fitz_reamostra(tmp_path, monkeypatch):
    """Com o decode do pikepdf inoperante, o compress usa o MuPDF e
    reencodra a imagem (skipped_images == 0)."""
    import pikepdf as _pk
    from services import pdf_processor as pp
    src = _make_raw_image_pdf(tmp_path / 'raw_grande.jpg', size=1000)

    monkeypatch.setattr(_pk, 'PdfImage', _PikepdfInoperante)
    out = tmp_path / 'out.pdf'
    r = pp.compress(str(src), str(out), compression_level='medium',
                    jpeg_quality=85, downscale_images=True)

    assert out.exists()
    assert r['skipped_images'] == 0, r  # fitz fallback decodificou
    with _pk.open(str(out)) as p2:
        img2 = list(p2.pages[0].get_images().values())[0]
        # reencodada como JPEG (o original era raw sem filtro)
        assert 'DCTDecode' in str(img2.get('/Filter')), img2.get('/Filter')


def test_repair_nao_mexe_em_imagem_que_o_fitz_decodifica(tmp_path,
                                                          monkeypatch):
    """pikepdf inoperante + fitz decodifica -> imagem INTEIRA: repair
    nao coloca placeholder nem reporta problema."""
    import pikepdf as _pk
    from services import pdf_processor as pp
    src = _make_raw_image_pdf(tmp_path / 'raw.pdf')
    monkeypatch.setattr(_pk, 'PdfImage', _PikepdfInoperante)

    out = tmp_path / 'out.pdf'
    rep = pp.repair_pdf(str(src), str(out))

    assert rep['repaired_count'] == 0, rep
    assert rep['unrepaired_count'] == 0, rep
    assert rep['validation']['valid'] is True, rep['validation']
    # pixels intactos (o save pode recomprimir o raw em Flate — o
    # placeholder JPEG nao inflaria para os192 bytes originais)
    import zlib
    with _pk.open(str(out)) as p2:
        img = list(p2.pages[0].get_images().values())[0]
        assert int(img['/Width']) == 8 and int(img['/Height']) == 8
        dados = img.read_raw_bytes()
        if 'Flate' in str(img.get('/Filter') or ''):
            dados = zlib.decompress(dados)
        assert len(dados) == 192  # 8x8x3 raw originais


def test_validate_imagem_com_cor_de_spot_nao_vira_erro(tmp_path):
    """pikepdf recusa transcender imagem com ColorSpace DeviceN
    (HifiPrintImageNotTranscodableError): JPEG VALIDO com cores de
    spot, nao corrupcao — caso real das7 imagens do arquivo do usuario.
    O fitz TAMBEM nao decodifica o sintetico -> warn (classificacao)."""
    import io

    import pikepdf
    from PIL import Image
    from services.pdf_processor import validate_pdf

    buf = io.BytesIO()
    Image.new('RGB', (8, 8), (10, 20, 30)).save(buf, format='JPEG')
    src = tmp_path / 'spot_img.pdf'
    with pikepdf.new() as pdf:
        img = pikepdf.Stream(pdf, buf.getvalue())
        img['/Subtype'] = pikepdf.Name('/Image')
        img['/Width'] = 8
        img['/Height'] = 8
        img['/BitsPerComponent'] = 8
        img['/Filter'] = pikepdf.Name('/DCTDecode')
        img['/ColorSpace'] = pikepdf.Array([
            pikepdf.Name('/DeviceN'),
            pikepdf.Array([pikepdf.Name('/SpotRed')]),
            pikepdf.Name('/DeviceCMYK'),
            _mk({'/FunctionType': 2, '/Domain': pikepdf.Array([0, 1]),
                 '/C0': pikepdf.Array([0, 0, 0, 0]),
                 '/C1': pikepdf.Array([1, 1, 1, 1]), '/N': 1}),
        ])
        img = pdf.make_indirect(img)
        page = pdf.add_blank_page(page_size=(200, 200))
        page.obj['/Resources'] = _mk({'/XObject': _mk({'/Im1': img})})
        page.obj['/Contents'] = pikepdf.Stream(
            pdf, b'q 50 0 0 50 10 10 cm /Im1 Do Q\n')
        pdf.save(str(src))

    r = validate_pdf(str(src))

    img_check = [c for c in r['checks'] if c['id'] == 'imagens'][0]
    assert img_check['status'] == 'warn', r['checks']
    assert 'codec' in img_check['detail'], img_check
    assert r['valid'] is True, r['checks']


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


# ===== WORD: contratos das rotas =====
# As 6 funcionalidades tinham testes de servico mas NENHUM teste de
# rota (require + job + shape da resposta).

def test_rota_word_merge(client, tmp_path):
    from helpers import post_sync
    p1 = _make_docx(tmp_path / 'um.docx', 'conteudo um')
    p2 = _make_docx(tmp_path / 'dois.docx', 'conteudo dois')
    out = tmp_path / 'juntado.docx'

    r = post_sync(client, '/api/word/merge', json={
        'docx_paths': [str(p1), str(p2)], 'output_path': str(out)})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['output_path'] == str(out)
    assert out.exists()


def test_rota_word_convert_txt(client, tmp_path):
    from helpers import post_sync
    doc = _make_docx(tmp_path / 'origem.docx', 'texto para converter')
    out = tmp_path / 'origem.txt'

    r = post_sync(client, '/api/word/convert', json={
        'input_path': str(doc), 'output_path': str(out),
        'output_format': 'txt'})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['output_path'] == str(out)
    assert out.exists()
    assert 'texto para converter' in out.read_text(encoding='utf-8')


def test_rota_word_compare(client, tmp_path):
    from helpers import post_sync
    d1 = _make_docx(tmp_path / 'a.docx', 'linha comum')
    d2 = _make_docx(tmp_path / 'b.docx', 'outra linha')

    r = post_sync(client, '/api/word/compare', json={
        'doc1_path': str(d1), 'doc2_path': str(d2)})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    summary = body['summary']
    assert {'added', 'removed', 'modified'} <= set(summary), summary
    assert isinstance(body['differences'], list), body
    assert summary['added'] + summary['removed'] + summary['modified'] >= 1, \
        summary


def test_rota_word_extract_images(client, tmp_path):
    from helpers import post_sync
    doc = _make_docx(tmp_path / 'sem_img.docx', 'texto sem imagens')
    out_dir = tmp_path / 'imgs'

    # documento sem imagens -> 400 com mensagem (ValueError do servico
    # vira error_status do job); o caminho feliz esta coberto no teste
    # de servico test_word_extract_images
    r = post_sync(client, '/api/word/extract-images', json={
        'input_path': str(doc), 'output_dir': str(out_dir)})
    assert r.status_code == 400, r.status_code
    assert 'imagem' in r.get_json()['error'].lower(), r.get_json()


def test_rota_word_watermark(client, tmp_path):
    from helpers import post_sync
    doc = _make_docx(tmp_path / 'marca.docx', 'documento a marcar')
    out = tmp_path / 'marcado.docx'

    r = post_sync(client, '/api/word/watermark', json={
        'input_path': str(doc), 'output_path': str(out),
        'text': 'CONFIDENCIAL'})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['output_path'] == str(out)
    assert out.exists()


def test_rota_word_watermark_preview(client):
    from helpers import post_sync
    # rota aceita corpo vazio (posicoes default de A4)
    r = post_sync(client, '/api/word/watermark/preview', json={})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert 'left' in body and 'top' in body, body


def test_rota_word_filepath(client, tmp_path):
    from helpers import post_sync
    doc = _make_docx(tmp_path / 'doc.docx', 'conteudo do doc')
    out = tmp_path / 'doc_com_caminho.docx'

    r = post_sync(client, '/api/word/filepath', json={
        'input_path': str(doc), 'output_path': str(out)})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['output_path'] == str(out)
    assert out.exists()


# ===== EXCEL: rota de leitura (preview de colunas) =====
# Contrato da rota /api/excel/read usada pelo botao "Visualizar colunas"
# da feature dividir-por-coluna (bug original: a rota nao existia e o
# clique falhava em runtime).

def test_rota_excel_read_preview_colunas(client, tmp_path):
    from openpyxl import Workbook

    from helpers import post_sync

    wb = Workbook()
    ws = wb.active
    ws.append(["Estado", "Cidade"])
    ws.append(["SP", "Sao Paulo"])
    ws.append(["RJ", "Rio de Janeiro"])
    src = tmp_path / "estados.xlsx"
    wb.save(src)

    ok = post_sync(client, "/api/excel/read", json={"file_path": str(src)})
    assert ok.status_code == 200, ok.get_json()
    body = ok.get_json()
    assert body["success"] is True
    assert body["headers"] == ["Estado", "Cidade"]
    assert body["data"] == [
        {"Estado": "SP", "Cidade": "Sao Paulo"},
        {"Estado": "RJ", "Cidade": "Rio de Janeiro"},
    ]
    assert body["total_rows"] == 2

    # max_rows limita a devolucao (total_rows continua o total do arquivo)
    capped = post_sync(client, "/api/excel/read",
                       json={"file_path": str(src), "max_rows": 1})
    assert capped.status_code == 200, capped.get_json()
    assert len(capped.get_json()["data"]) == 1
    assert capped.get_json()["total_rows"] == 2

    # campo obrigatorio ausente -> 400 imediato (sem job)
    missing = post_sync(client, "/api/excel/read", json={})
    assert missing.status_code == 400, missing.status_code

    # arquivo inexistente -> 404 (handler global FileNotFoundError)
    notfound = post_sync(
        client, "/api/excel/read", json={"file_path": str(tmp_path / "nao.xlsx")}
    )
    assert notfound.status_code == 404, notfound.status_code

    # formato fora de .xlsx/.csv -> 400 (ValueError)
    txt = tmp_path / "notas.txt"
    txt.write_text("texto qualquer", encoding="utf-8")
    bad = post_sync(client, "/api/excel/read", json={"file_path": str(txt)})
    assert bad.status_code == 400, bad.status_code


# ===== EXCEL: contratos das demais rotas =====
# convert-batch/merge-all/extract-cells/split-by-column/split-sheets:
# 4 funcionalidades sem NENHUM teste de pytest antes (so audit).

def test_rota_excel_convert_batch(client, tmp_path):
    from openpyxl import Workbook

    from helpers import post_sync

    src = tmp_path / 'para_csv'
    src.mkdir()
    wb = Workbook()
    ws = wb.active
    ws.append(['Nome'])
    ws.append(['Ana'])
    wb.save(src / 'lista.xlsx')

    dest = tmp_path / 'csv'
    r = post_sync(client, '/api/excel/convert-batch', json={
        'source_dir': str(src), 'dest_dir': str(dest),
        'input_format': 'xlsx', 'output_format': 'csv'})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['processed'] == 1, body
    assert body['errors'] == [], body
    csvs = list(dest.glob('*.csv'))
    assert len(csvs) == 1, list(dest.iterdir())
    texto = csvs[0].read_text(encoding='utf-8-sig', errors='replace')
    assert 'Ana' in texto, texto


def test_rota_excel_merge_all_combina_abas(client, tmp_path):
    from openpyxl import Workbook, load_workbook

    from helpers import post_sync

    src = tmp_path / 'planilhas'
    src.mkdir()
    for nome, estado in (('a.xlsx', 'SP'), ('b.xlsx', 'RJ')):
        wb = Workbook()
        ws = wb.active
        ws.append(['Estado'])
        ws.append([estado])
        wb.save(src / nome)

    out = tmp_path / 'mescladas.xlsx'
    r = post_sync(client, '/api/excel/merge-all', json={
        'source_dir': str(src), 'dest_file': str(out), 'mode': 'sheets'})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['processed'] == 2, body
    assert body['errors'] == [], body
    assert out.exists()
    wb2 = load_workbook(str(out))
    assert len(wb2.sheetnames) >= 2, wb2.sheetnames
    valores = [c.value for ws in wb2.worksheets
               for row in ws.iter_rows() for c in row]
    assert 'SP' in valores and 'RJ' in valores, valores


def test_rota_excel_extract_cells(client, tmp_path):
    from openpyxl import Workbook

    from helpers import post_sync

    src = tmp_path / 'celulas'
    src.mkdir()
    wb = Workbook()
    ws = wb.active
    ws['A1'] = 'Titulo'
    ws['B2'] = 42
    wb.save(src / 'dados.xlsx')

    csv_out = tmp_path / 'celulas.csv'
    r = post_sync(client, '/api/excel/extract-cells', json={
        'source_dir': str(src),
        'fields': [{'name': 'titulo', 'source': 'A1'},
                   {'name': 'valor', 'source': 'B2'}],
        'output_file': str(csv_out)})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['results'], body
    assert body['errors'] == [], body
    assert csv_out.exists()
    texto = csv_out.read_text(encoding='utf-8-sig', errors='replace')
    assert 'Titulo' in texto and '42' in texto, texto


def test_rota_excel_split_by_column(client, tmp_path):
    from openpyxl import Workbook

    from helpers import post_sync

    src = tmp_path / 'vendas.xlsx'
    wb = Workbook()
    ws = wb.active
    ws.append(['Estado', 'Valor'])
    ws.append(['SP', 10])
    ws.append(['RJ', 20])
    ws.append(['SP', 30])
    wb.save(src)

    out = tmp_path / 'grupos'
    r = post_sync(client, '/api/excel/split-by-column', json={
        'input_file': str(src), 'output_dir': str(out),
        'column': 'Estado'})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['total_rows'] == 3, body
    assert body['total_groups'] == 2, body
    assert len(body['output_files']) == 2, body
    assert body['errors'] == [], body
    assert len(list(out.glob('*.xlsx'))) == 2, list(out.iterdir())


def test_rota_excel_split_sheets(client, tmp_path):
    from openpyxl import Workbook

    from helpers import post_sync

    src = tmp_path / 'duas_abas.xlsx'
    wb = Workbook()
    wb.active.title = 'Primeira'
    wb.active.append(['a'])
    ws2 = wb.create_sheet('Segunda')
    ws2.append(['b'])
    wb.save(src)

    out = tmp_path / 'abas'
    r = post_sync(client, '/api/excel/split-sheets', json={
        'input_file': str(src), 'output_dir': str(out)})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['success'] is True
    assert body['processed'] == 2, body
    assert len(body['files']) == 2, body
    assert body['errors'] == [], body
    assert len(list(out.glob('*.xlsx'))) == 2, list(out.iterdir())
