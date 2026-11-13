"""Integracao com servidor real (spawn) — marcados como slow.

Cobre as garantias que so se provam com o processo de verdade:
  - bind em 127.0.0.1 (item 3): localhost responde, IP da rede NAO
  - debug condicional (item 3): off por padrao, on com FLASK_DEBUG=1
  - nao-bloqueio (item 9): health responde durante operacao longa
"""
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

import pytest

from conftest import REPO_ROOT

pytestmark = pytest.mark.slow


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def local_ip():
    """IP da interface de rede local (UDP connect nao envia pacotes)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def spawn_server(port, extra_env=None, log_name="spawn.log"):
    """Sobe backend/app.py como subprocesso; devolve (proc, stdout_path)."""
    log_path = os.path.join(os.environ["TEMP"], f"cremepe_{log_name}")
    env = {**os.environ, "PORT": str(port)}
    env.pop("FLASK_DEBUG", None)  # padrao: sem debug
    if extra_env:
        env.update(extra_env)
    out = open(log_path, "w", encoding="utf-8")
    proc = subprocess.Popen(
        [sys.executable, str(REPO_ROOT / "backend" / "app.py")],
        cwd=str(REPO_ROOT), env=env, stdout=out, stderr=subprocess.STDOUT,
    )
    proc._out_path = log_path
    return proc, log_path


def kill_server(proc):
    if proc.poll() is None:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)],
                           capture_output=True)
        else:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
    # fecha o handle de stdout
    if getattr(proc, "_out_f", None):
        pass
    try:
        proc.stdout.close()
    except Exception:
        pass


def wait_health(port, timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(
                f"http://127.0.0.1:{port}/api/health", timeout=1
            ) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.4)
    return False


def read_stdout(proc):
    try:
        with open(proc._out_path, encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return ""


def test_bind_apenas_localhost_e_debug_off():
    """Item 3:127.0.0.1 responde; IP da rede NAO; debug desligado."""
    port = free_port()
    proc, _ = spawn_server(port, log_name="bind.log")
    try:
        assert wait_health(port), "servidor nao subiu"
        assert urllib.request.urlopen(
            f"http://127.0.0.1:{port}/api/health", timeout=3
        ).status == 200

        ip = local_ip()
        if ip:
            assert not _port_open(ip, port), \
                f"API EXPOSTA na rede ({ip}:{port})!"
        else:
            pytest.skip("sem interface de rede para checar exposicao")

        out = read_stdout(proc)
        assert "Debug mode: off" in out, out[-500:]
        assert "Debugger is active" not in out
    finally:
        kill_server(proc)


def test_flask_debug_1_liga_debug():
    """Item 3: FLASK_DEBUG=1 liga reloader/debugger (dev)."""
    port = free_port()
    proc, _ = spawn_server(port, extra_env={"FLASK_DEBUG": "1"},
                           log_name="debug.log")
    try:
        assert wait_health(port), "servidor nao subiu"
        out = read_stdout(proc)
        assert "Debug mode: on" in out, out[-500:]
    finally:
        kill_server(proc)


def test_health_nao_bloqueia_durante_operacao_longa():
    """Item 9: Flask threaded — health responde durante op longa.

    Com jobs, o POST responde 202 na hora; a operacao longa roda na
    thread do job. Medimos a duracao do JOB via polling — durante ela,
    o health precisa continuar respondendo rapido.
    """
    port = free_port()
    proc, _ = spawn_server(port, log_name="nblock.log")
    try:
        assert wait_health(port), "servidor nao subiu"

        payload = json.dumps({
            "dir": str(REPO_ROOT), "recursive": True, "include_files": False,
        }).encode()
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/files/report",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            assert r.status == 202, f"esperava 202, veio {r.status}"
            job_id = json.loads(r.read())["job_id"]

        # durante a execucao do job, mede o health
        lat = []
        t0 = time.time()
        job_status = "running"
        while job_status not in ("done", "error") and time.time() - t0 < 120:
            t_ping = time.time()
            with urllib.request.urlopen(
                f"http://127.0.0.1:{port}/api/health", timeout=3
            ) as r:
                lat.append((r.status, time.time() - t_ping))
            with urllib.request.urlopen(
                f"http://127.0.0.1:{port}/api/jobs/{job_id}", timeout=3
            ) as r:
                job_status = json.loads(r.read())["status"]
            time.sleep(0.4)
        job_duration = time.time() - t0

        assert job_status == "done", f"job terminou em {job_status}"
        assert all(s == 200 for s, _ in lat), f"health falhou: {lat}"
        assert max(d for _, d in lat) < 2.0, \
            f"health lentissimo durante op longa: {lat}"
        # a operacao longa de fato demorou (senao o teste nada prova)
        assert job_duration >= 0.4, \
            f"operacao longa rapida demais para provar: {job_duration:.3f}s"
        assert len(lat) >= 2, f"poucos pings durante o job: {lat}"
    finally:
        kill_server(proc)


def _port_open(host, port, timeout=0.6):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False
