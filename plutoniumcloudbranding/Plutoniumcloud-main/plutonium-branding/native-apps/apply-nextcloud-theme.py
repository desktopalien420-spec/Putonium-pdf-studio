#!/usr/bin/env python3
"""Supported native Nextcloud text/color branding, with a scoped before-state."""
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = Path('/var/lib/homelab-nextcloud-theme')
STATE = ROOT / 'state.json'
INVENTORY_SHA = '1ddfd16b27735e1a49bc31cee8cf4a4175edc1490382da87e440dd999215d7db'
AFTER = {'name': 'Plutonium Cloud', 'url': 'https://plutoniumcloud.com',
         'slogan': 'Your files. Your space.', 'primary_color': '#b8b8b8', 'background_color': '#0a0a0a'}
KEYS = tuple(AFTER)


class Stop(RuntimeError):
    pass


def need(value, message):
    if not value:
        raise Stop(message)


def helper():
    p = HERE / 'inspect-native-themes.py'
    need(hashlib.sha256(p.read_bytes()).hexdigest() == INVENTORY_SHA, 'Reviewed inventory helper differs.')
    spec = importlib.util.spec_from_file_location('reviewed_theme_inventory', p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def save(state):
    target = STATE.with_suffix('.json.new')
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(state, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(target, STATE)


def read(h):
    values = h.occ('config:list', 'theming').get('apps', {}).get('theming')
    need(isinstance(values, dict), 'Native theme configuration format differs.')
    result = {}
    for key in KEYS:
        # config:list deliberately masks values such as URL. Use its keys only for
        # presence, then read exactly the five reviewed non-secret appearance fields.
        value = None
        if key in values:
            value = h.run(['docker', 'exec', '--user', 'www-data', 'nextcloud-aio-nextcloud', 'php', '/var/www/html/occ',
                           'config:app:get', 'theming', key, '--no-ansi'])
            need(isinstance(value, str) and len(value) < 1024, 'Native appearance getter format differs.')
        result[key] = {'exists': key in values, 'value': value}
    return result


def target():
    return {k: {'exists': True, 'value': v} for k, v in AFTER.items()}


def validate_state(state):
    need(set(state.get('before', {})) == set(KEYS) and state.get('after') == target(), 'Protected theme state differs.')
    for value in state['before'].values():
        need(isinstance(value, dict) and set(value) == {'exists', 'value'} and type(value['exists']) is bool,
             'Protected before-value format differs.')
        need(isinstance(value['value'], str) if value['exists'] else value['value'] is None,
             'Protected before-value type differs.')


def validate_resume(state, current):
    validate_state(state)
    need(state.get('phase') in ['prepared', 'applied_verification_pending'], 'This theme phase is not a partial update; preserve it.')
    need(set(current) == set(KEYS), 'Current owned theme keys differ.')
    for key in KEYS:
        need(current[key] in [state['before'][key], state['after'][key]], 'Newer appearance changes detected; resume refused.')


def apply_remaining(h, state, current):
    expected = dict(current)
    for key in KEYS:
        need(read(h) == expected, 'Concurrent owned theme change detected; preserve it.')
        if expected[key] == state['after'][key]:
            continue
        set_value(h, key, state['after'][key])
        expected[key] = state['after'][key]
        need(read(h) == expected, 'Native text/color setting did not persist exactly.')


def set_value(h, key, before):
    need(key in KEYS and set(before) == {'exists', 'value'}, 'Unreviewed theme setting refused.')
    args = ['docker', 'exec', '--user', 'www-data', 'nextcloud-aio-nextcloud', 'php', '/var/www/html/occ',
            'theming:config', key]
    if before['exists']:
        need(isinstance(before['value'], str), 'Unexpected theme value.')
        args.append(before['value'])
    else:
        args.append('--reset')
    # Native theming command performs its normal cache invalidation; no whole-config restore.
    h.run(args + ['--no-interaction', '--no-ansi'])


def health(h):
    for host, path in [('cask.plutoniumcloud.com', '/status.php'), ('photos.plutoniumcloud.com', '/photos'),
                       ('auth.plutoniumcloud.com', '/-/health/ready/'), ('plutoniumcloud.com', '/')]:
        h.public(host, path)


def rollback(h, state):
    validate_state(state)
    current = read(h)
    for key in KEYS:
        need(current[key] in [state['before'][key], state['after'][key]], 'Newer appearance changes detected; no overwrite attempted.')
    for key in KEYS:
        if current[key] != state['before'][key]:
            # Check again just before each write; concurrent newer edits remain protected.
            now = read(h)[key]
            need(now in [state['before'][key], state['after'][key]], 'Concurrent theme change detected; preserve it.')
            if now != state['before'][key]:
                set_value(h, key, state['before'][key])
    need(read(h) == state['before'], 'Native reset did not restore exact owned before-values; preserve state for review.')
    state['phase'] = 'appearance_restored_verification_pending'
    save(state)
    print('Previous native theme values restored; checking existing HTTPS...', flush=True)
    health(h)
    state['phase'] = 'rolled_back'
    save(state)
    print('NEXTCLOUD THEME ROLLED BACK. Only owned text/color settings restored; no restart.', flush=True)


def preflight(h, resuming=False):
    if resuming:
        need(STATE.is_file(), 'No protected partial theme record exists.')
    else:
        need(not ROOT.exists(), 'Theme update record exists; preserve it instead of repeating install.')
    # Inventory was already user-verified; repeat only relevant guards at application time.
    for name, digest in h.PORTAL.items():
        p = Path('/srv/homelab-host/portal/app') / name
        need(not p.is_symlink() and hashlib.sha256(p.read_bytes()).hexdigest() == digest, 'Accepted portal source changed; preserve it.')
    status = h.occ('status')
    need(status.get('versionstring') == '34.0.5' and status.get('installed') is True and status.get('maintenance') is False,
         'Nextcloud version/readiness changed.')
    apps = h.occ('app:list').get('enabled', {})
    need(apps.get('theming') == '2.9.0' and apps.get('plutonium_desktop_frame') == '0.1.0', 'Native theme/window app version changed.')
    help_text = h.run(['docker', 'exec', '--user', 'www-data', 'nextcloud-aio-nextcloud', 'php', '/var/www/html/occ',
                       'help', 'theming:config', '--no-ansi'])
    need(all(k in help_text for k in KEYS) and '--reset' in help_text, 'Installed native theme CLI differs.')
    before = read(h)
    if not resuming:
        need(all(not v['exists'] for v in before.values()), 'Theme was customized after inventory; review rather than overwrite.')
    health(h)
    return before


def main():
    need(os.geteuid() == 0, 'Run using sudo python3.')
    need(len(sys.argv) == 2 and sys.argv[1] in ['check', 'install', 'resume', 'rollback'], 'Choose check, install, resume or rollback.')
    mode = sys.argv[1]
    lock = os.open('/run/lock/homelab-nextcloud-theme.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    h = helper()
    if mode == 'rollback':
        need(STATE.is_file(), 'No protected Nextcloud theme record exists.')
        rollback(h, json.loads(STATE.read_text()))
        return
    resuming = mode == 'resume'
    before = preflight(h, resuming=resuming)
    print('Verified installed native CLI, owned appearance values, accepted Files/Photos release and existing HTTPS.', flush=True)
    if mode == 'check':
        print('READ-ONLY NEXTCLOUD THEME PREFLIGHT PASSED. No theme changes or restarts.', flush=True)
        return
    if resuming:
        state = json.loads(STATE.read_text())
        validate_resume(state, before)
        print('Verified partial update against original protected backup; completing only remaining approved appearance settings.', flush=True)
    else:
        ROOT.mkdir(mode=0o700)
        state = {'phase': 'prepared', 'before': before, 'after': target()}
        save(state)
    try:
        apply_remaining(h, state, before)
        state['phase'] = 'applied_verification_pending'
        save(state)
        health(h)
        state['phase'] = 'awaiting_browser_acceptance'
        save(state)
    except Exception:
        print('Theme verification failed; attempting scoped native settings rollback.', flush=True)
        rollback(h, state)
        raise Stop('New theme did not pass verification; prior owned settings restored.')
    print('NEXTCLOUD NATIVE THEME READY. Five supported text/color settings verified; existing HTTPS healthy.', flush=True)
    print('No service restart, custom CSS plugin, logo replacement, user preference, account, auth, proxy or network changes.', flush=True)
    print('Reload Files and verify ordinary/recovery sign-in plus existing files. Immich theme is a separate step.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('STOPPED: ' + (str(error) if isinstance(error, Stop) else type(error).__name__ + '; sensitive output withheld.'), flush=True)
        print('Preserve state and paste this bounded output. Do not repeat install or print live configuration.', flush=True)
        sys.exit(1)
