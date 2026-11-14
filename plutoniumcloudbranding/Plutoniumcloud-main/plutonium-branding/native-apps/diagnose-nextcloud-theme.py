#!/usr/bin/env python3
"""Read-only bounded diagnosis of the five owned appearance settings."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

EXPECTED = '66e8d2c384e9caff54ddf8530c348685e2edc4d3cf42828bf46cd5f1f58309bb'


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Run using sudo python3.')
    p = Path(__file__).resolve().parent / 'apply-nextcloud-theme.py'
    if hashlib.sha256(p.read_bytes()).hexdigest() != EXPECTED:
        raise RuntimeError('Reviewed theme helper differs; preserve all state.')
    spec = importlib.util.spec_from_file_location('reviewed_stopped_theme', p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    h = m.helper()
    state = json.loads(m.STATE.read_text())
    if set(state.get('before', {})) != set(m.KEYS) or state.get('after') != m.target():
        raise RuntimeError('Protected state format differs.')
    print('Saved phase: ' + str(state.get('phase')), flush=True)
    values = h.occ('config:list', 'theming').get('apps', {}).get('theming', {})
    for key in m.KEYS:
        value = values.get(key)
        report = {'key': key, 'list_present': key in values, 'list_type': type(value).__name__,
                  'list_matches_expected': value == m.AFTER[key],
                  'list_redacted': isinstance(value, str) and ('REMOVED' in value.upper() or value.startswith('***')),
                  'list_matches_before': {'exists': key in values, 'value': value} == state['before'][key]}
        # Key-specific getter reads only a known non-secret appearance field.
        result = subprocess.run(['docker', 'exec', '--user', 'www-data', 'nextcloud-aio-nextcloud', 'php', '/var/www/html/occ',
                                 'config:app:get', 'theming', key, '--no-ansi'], capture_output=True, text=True, timeout=45)
        raw = result.stdout.strip()
        report.update({'getter_exit': result.returncode, 'getter_bytes': len(raw.encode()),
                       'getter_matches_expected': raw == m.AFTER[key],
                       'getter_redacted': 'REMOVED' in raw.upper() or raw.startswith('***')})
        print(json.dumps(report), flush=True)
    try:
        m.health(h)
        print('Existing application HTTPS: healthy', flush=True)
    except Exception:
        print('Existing application HTTPS requires review; raw details withheld.', flush=True)
    print('READ-ONLY THEME DIAGNOSIS COMPLETE. No reset, setting write, state edit or service restart.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('STOPPED: ' + type(error).__name__ + '; preserve all settings/state. Raw diagnostics withheld.', flush=True)
        sys.exit(1)
