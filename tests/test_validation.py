"""Validacao @require das 47 rotas POST da API."""
from helpers import post_sync


def _post_rules(app):
    return sorted(
        r.rule for r in app.url_map.iter_rules() if "POST" in r.methods
    )


def test_sao_47_rotas_post(app):
    assert len(_post_rules(app)) == 47


def test_todas_as_rotas_validam_corpo_vazio(app, client):
    """{} -> 400 com mensagem, exceto watermark/preview (sem campos)."""
    for rule in _post_rules(app):
        r = post_sync(client, rule, json={})
        if rule.endswith("watermark/preview"):
            assert r.status_code == 200, f"{rule} deveria aceitar corpo vazio"
        else:
            assert r.status_code == 400, f"{rule} deveria exigir campos"
            assert r.get_json()["error"].startswith("Campo"), \
                f"{rule}: {r.get_json()}"


def test_mensagem_singular_para_campo_unico(client):
    r = post_sync(client, "/api/files/list", json={})
    assert r.get_json()["error"] == "Campo obrigatório: dir"


def test_mensagem_plural_lista_todos_os_faltantes(client):
    r = post_sync(client, "/api/pdf/merge", json={})
    assert r.get_json()["error"] == \
        "Campos obrigatórios: pdf_paths, output_path"


def test_mensagem_lista_somente_o_que_falta(client):
    r = post_sync(client, "/api/pdf/merge",
                  json={"pdf_paths": ["qualquer.pdf"]})
    assert r.get_json()["error"] == "Campo obrigatório: output_path"


def test_valor_falsy_e_tratado_como_ausente(client):
    r = post_sync(client, "/api/files/list", json={"dir": ""})
    assert r.status_code == 400

    r = post_sync(client, "/api/pdf/split-fixed", json={
        "pdf_path": "x.pdf", "output_dir": "d", "pages_per_file": 0,
    })
    assert r.status_code == 400


def test_validacao_inline_de_compressao(client):
    r = post_sync(client, "/api/pdf/compress", json={
        "input_path": "a.pdf", "output_path": "b.pdf",
        "compression_level": "invalido",
    })
    assert r.status_code == 400
    assert "compressão" in r.get_json()["error"]


def test_validacao_de_tipo_extract_cells(client):
    r = post_sync(client, "/api/excel/extract-cells",
                  json={"source_dir": "d", "fields": "nao-lista"})
    assert r.status_code == 400
    assert "lista" in r.get_json()["error"]


def test_campos_extras_sao_ignorados(client, tmp_path):
    r = post_sync(client, "/api/files/list",
                  json={"dir": str(tmp_path), "campo_desconhecido": 123})
    assert r.status_code == 200
    assert r.get_json()["success"] is True


def test_validacao_de_campos_e_sincrona_e_rapida(client):
    """{} deve responder 400 IMEDIATO (sem passar por job/polling)."""
    import time

    t0 = time.time()
    r = client.post("/api/pdf/merge", json={})
    elapsed = time.time() - t0
    assert r.status_code == 400
    assert "job_id" not in r.get_json()
    assert elapsed < 0.1, f"validacao demorou {elapsed:.3f}s"


def test_sucesso_files_list(client, tmp_path):
    r = post_sync(client, "/api/files/list", json={"dir": str(tmp_path)})
    assert r.status_code == 200
    body = r.get_json()
    assert body["success"] is True
    assert body["files"] == []


def test_sucesso_pdf_merge(client, pdf_factory, tmp_path):
    p1 = pdf_factory(1, "a.pdf")
    p2 = pdf_factory(1, "b.pdf")
    out = tmp_path / "merged.pdf"
    r = post_sync(client, "/api/pdf/merge", json={
        "pdf_paths": [str(p1), str(p2)], "output_path": str(out),
    })
    assert r.status_code == 200
    assert out.exists()
