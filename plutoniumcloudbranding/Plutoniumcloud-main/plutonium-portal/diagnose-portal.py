#!/usr/bin/env python3
"""Read-only portal preflight with bounded, credential-free diagnostics."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("portal_review", here / "deploy-portal.py")
portal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(portal)

def checked_run(args, text=None, timeout=60):
    args = [str(x) for x in args]
    result = subprocess.run(args, input=text, text=True, capture_output=True, timeout=timeout)
    if result.returncode:
        # Never print raw output, command arguments, environment or exception text.
        combined = result.stdout + "\n" + result.stderr
        classes = sorted(set(re.findall(r"\b(?:AttributeError|FieldError|ImportError|ModuleNotFoundError|ProgrammingError|OperationalError|TypeError|NameError|SyntaxError|PermissionError|ReadOnlySqlTransaction)\b", combined)))
        print("Failed subprocess: " + args[0] + "; exit=" + str(result.returncode), flush=True)
        print("Recognized error classes: " + (", ".join(classes) or "none"), flush=True)
        raise RuntimeError("Subprocess failed; raw output retained only in memory and withheld.")
    return result.stdout.strip()

if os.geteuid() != 0:
    sys.exit("Run with sudo python3.")
try:
    proxy = portal.load_proxy_helper()
    proxy.run = checked_run
    for name, action in [("storage", proxy.verify_mount), ("proxy container", proxy.verify_proxy), ("identity readiness", proxy.identity_health), ("existing HTTPS services", lambda: portal.healthy_apps(proxy))]:
        print("Checking: " + name, flush=True)
        action()
    # Catch only inside our own check; print exception class and our source line,
    # never exception messages or database values.
    source = portal.IDP_CHECK
    wrapper = "import json, traceback\ntry:\n    exec(compile(" + repr(source) + ", '<portal-preflight>', 'exec'))\nexcept Exception as e:\n    frames = traceback.extract_tb(e.__traceback__)\n    lines = [f.lineno for f in frames if f.filename == '<portal-preflight>']\n    print('PORTAL_DIAGNOSTIC=' + json.dumps({'exception': type(e).__name__, 'check_line': lines[-1] if lines else None}))\n"
    print("Checking: identity application/group/outpost", flush=True)
    raw = checked_run(['docker', 'exec', 'homelab-authentik-server', 'ak', 'shell', '-c', wrapper], timeout=90)
    reports = [line for line in raw.splitlines() if line.startswith(('PORTAL_CHECK=', 'PORTAL_DIAGNOSTIC='))]
    if not reports:
        raise RuntimeError("Identity shell returned no structured report.")
    for line in reports:
        label, payload = line.split('=', 1)
        parsed = json.loads(payload)
        if label == 'PORTAL_DIAGNOSTIC':
            print('Identity check exception: ' + str(parsed.get('exception')) + '; check source line: ' + str(parsed.get('check_line')), flush=True)
        else:
            for key, value in parsed.items():
                if key in source and type(value) is bool:
                    print('Identity preflight: ' + key + ' = ' + str(value), flush=True)
    print('READ-ONLY DIAGNOSTIC COMPLETE. No deployment or account changes.', flush=True)
except Exception as e:
    print('DIAGNOSTIC STOPPED: ' + type(e).__name__ + '. Raw output withheld.', flush=True)
    sys.exit(1)
