"""Rotas de arquivos (blueprint /api/files) — contrato HTTP dos12 endpoints.

Cada teste monta um workspace em tmp_path, dispara a rota e valida o
corpo (formato {success, ...}) + o efeito no disco. Rotas sao @as_job,
entao usa post_sync (helpers) que acompanha o job e devolve a resposta
translucida (200 + result, ou error_status + {error}).
"""
import time
import zipfile
from pathlib import Path

from helpers import post_sync


def _dir_com_arquivos(tmp_path, nome, n=3, conteudo=b"conteudo"):
    """Pasta com n arquivos de conteudo IDENTICO (para duplicados)."""
    d = tmp_path / nome
    d.mkdir()
    for i in range(n):
        (d / f"arq{i}.txt").write_bytes(conteudo)
    return d


# ===== preview / list / collect =====

def test_preview_lista_arquivos_com_metadados(client, tmp_path):
    d = _dir_com_arquivos(tmp_path, "origem", n=3)
    (d / "doc.pdf").write_bytes(b"%PDF-1.4")

    r = post_sync(client, "/api/files/preview",
                  json={"src_dirs": [str(d)], "recursive": False})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body["success"] is True
    assert body["count"] == 4, body
    f0 = body["files"][0]
    assert {"path", "relative", "size", "modified"} <= set(f0), f0
    # filtro de extensao
    r2 = post_sync(client, "/api/files/preview",
                   json={"src_dirs": [str(d)], "extensions": ".pdf"})
    assert r2.get_json()["count"] == 1, r2.get_json()


def test_preview_diretorio_inexistente_vira_404(client, tmp_path):
    r = post_sync(client, "/api/files/preview",
                  json={"src_dirs": [str(tmp_path / "nao_existe")]})
    assert r.status_code == 404
    assert "não encontrado" in r.get_json()["error"]


def test_list_devolve_apenas_arquivos(client, tmp_path):
    d = tmp_path / "lista"
    d.mkdir()
    (d / "a.txt").write_text("x", encoding="utf-8")
    (d / "b.txt").write_text("y", encoding="utf-8")
    (d / "sub").mkdir()  # pasta NAO deve aparecer

    r = post_sync(client, "/api/files/list", json={"dir": str(d)})
    assert r.status_code == 200, r.get_json()
    assert sorted(r.get_json()["files"]) == ["a.txt", "b.txt"]


def test_collect_move_arquivos_para_destino(client, tmp_path):
    d = _dir_com_arquivos(tmp_path, "para_colher", n=2)
    dst = tmp_path / "recolhido"

    r = post_sync(client, "/api/files/collect",
                  json={"src_dirs": [str(d)], "dst_dir": str(dst)})
    assert r.status_code == 200, r.get_json()
    assert r.get_json()["processed_count"] == 2
    assert sorted(p.name for p in dst.iterdir()) == ["arq0.txt", "arq1.txt"]
    assert list(d.iterdir()) == []  # move (copy=False) esvazia a origem


# ===== rename-preview / rename =====

def test_rename_preview_mostra_sem_alterar(client, tmp_path):
    d = _dir_com_arquivos(tmp_path, "ren", n=1)
    alvo = next(d.iterdir())

    r = post_sync(client, "/api/files/rename-preview",
                  json={"file_paths": [str(alvo)], "prefix": "novo_"})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body["count"] == 1
    assert "novo_" in str(body["preview"])
    assert alvo.exists(), "preview nao pode renomear de verdade"


def test_rename_aplica_prefixo(client, tmp_path):
    d = tmp_path / "ren2"
    d.mkdir()
    (d / "velho.txt").write_text("x", encoding="utf-8")

    r = post_sync(client, "/api/files/rename",
                  json={"file_paths": [str(d / "velho.txt")],
                        "prefix": "novo_"})
    assert r.status_code == 200, r.get_json()
    assert r.get_json()["renamed_count"] == 1
    assert (d / "novo_0001.txt").exists()
    assert not (d / "velho.txt").exists()


# ===== duplicates / duplicates/remove =====

def test_duplicates_agrupa_por_hash_e_remove(client, tmp_path):
    d = _dir_com_arquivos(tmp_path, "dups", n=2, conteudo=b"igual")
    (d / "unico.txt").write_bytes(b"diferente")

    r = post_sync(client, "/api/files/duplicates",
                  json={"dir": str(d), "match_by": "hash",
                        "recursive": False})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body["total_groups"] == 1, body
    assert body["groups"][0]["count"] == 2

    grupos = [g["files"] for g in body["groups"]]
    r2 = post_sync(client, "/api/files/duplicates/remove",
                   json={"groups": grupos, "action": "delete"})
    assert r2.status_code == 200, r2.get_json()
    assert r2.get_json()["removed_count"] == 1  # mantem o1o de cada grupo
    assert len(list(d.glob("*.txt"))) == 2  # unico + sobrevivente


# ===== attributes =====

def test_attributes_marca_somente_leitura(client, tmp_path):
    import os
    d = _dir_com_arquivos(tmp_path, "attr", n=2)

    r = post_sync(client, "/api/files/attributes",
                  json={"dir": str(d), "readonly": True, "recursive": False})
    assert r.status_code == 200, r.get_json()
    assert r.get_json()["processed_count"] == 2
    for f in d.iterdir():
        assert os.stat(f).st_file_attributes & 0x1, f"{f} nao virou readonly"


# ===== compress / extract (zip ida e volta) =====

def test_compress_e_extract_roundtrip(client, tmp_path):
    d = _dir_com_arquivos(tmp_path, "zip_src", n=2)
    zpath = tmp_path / "saida.zip"

    r = post_sync(client, "/api/files/compress",
                  json={"source_paths": [str(d)], "output_path": str(zpath)})
    assert r.status_code == 200, r.get_json()
    assert r.get_json()["output_path"] == str(zpath)
    assert zpath.exists()
    with zipfile.ZipFile(str(zpath)) as zf:
        assert zf.testzip() is None
        nomes = zf.namelist()
    assert any("arq0.txt" in n for n in nomes), nomes

    destino = tmp_path / "descompactado"
    r2 = post_sync(client, "/api/files/extract",
                   json={"archive_path": str(zpath),
                         "extract_dir": str(destino)})
    assert r2.status_code == 200, r2.get_json()
    assert r2.get_json()["extract_dir"] == str(destino)
    assert any(p.name == "arq0.txt" for p in destino.rglob("*.txt"))


def test_extract_aceita_password_em_zip_criptografado(client, tmp_path):
    """Contrato do campo password (o audit cobre o caminho sem senha)."""
    import pyzipper
    zpath = tmp_path / "secreto.zip"
    with pyzipper.AESZipFile(str(zpath), "w",
                             encryption=pyzipper.WZ_AES) as zf:
        zf.setpassword(b"segredo123")
        zf.writestr("oculto.txt", b"top secret")

    destino = tmp_path / "sem_senha"
    r = post_sync(client, "/api/files/extract",
                  json={"archive_path": str(zpath),
                        "extract_dir": str(destino)})
    assert r.status_code == 400, r.get_json()  # senha errada/ausente: 4xx
    assert "error" in r.get_json()


# ===== split / merge (ida e volta do binario) =====

def test_split_e_merge_roundtrip(client, tmp_path):
    src = tmp_path / "grande.bin"
    src.write_bytes(b"x" * (1024 * 1024 + 10))  # 1 MiB + 10 => 2 partes
    partes = tmp_path / "partes"

    r = post_sync(client, "/api/files/split",
                  json={"file_path": str(src), "output_dir": str(partes),
                        "part_size_mb": 1})
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body["count"] == 2, body
    assert all(Path(p).exists() for p in body["parts"])
    total = sum(Path(p).stat().st_size for p in body["parts"])
    assert total == src.stat().st_size

    remontado = tmp_path / "remontado.bin"
    r2 = post_sync(client, "/api/files/merge",
                   json={"parts_list": body["parts"],
                         "output_path": str(remontado)})
    assert r2.status_code == 200, r2.get_json()
    assert r2.get_json()["output_path"] == str(remontado)
    assert remontado.read_bytes() == src.read_bytes()


def test_merge_parte_inexistente_vira_404(client, tmp_path):
    r = post_sync(client, "/api/files/merge",
                  json={"parts_list": [str(tmp_path / "nao.part0001.bin")],
                        "output_path": str(tmp_path / "out.bin")})
    assert r.status_code == 404, r.get_json()


# ===== validacao de campos obrigatorios (400 imediato, sem job) =====

def test_campos_obrigatorios_ausentes_viram_400(client):
    casos = [
        ("/api/files/preview", {}),
        ("/api/files/collect", {"src_dirs": ["x"]}),
        ("/api/files/list", {}),
        ("/api/files/rename-preview", {}),
        ("/api/files/rename", {}),
        ("/api/files/duplicates", {}),
        ("/api/files/duplicates/remove", {}),
        ("/api/files/attributes", {}),
        ("/api/files/compress", {"source_paths": ["x"]}),
        ("/api/files/extract", {"archive_path": "x.zip"}),
        ("/api/files/split", {"file_path": "x.bin"}),
        ("/api/files/merge", {"parts_list": ["a"]}),
    ]
    for url, payload in casos:
        r = client.post(url, json=payload)
        assert r.status_code == 400, f"{url} -> {r.status_code}"
        assert "error" in r.get_json(), url
