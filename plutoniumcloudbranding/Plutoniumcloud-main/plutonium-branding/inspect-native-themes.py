#!/usr/bin/env python3
"""Read-only installed native theme inventory; no changes to settings or CSS."""
import hashlib
import http.client
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import sys

# Accepted Files-window release. Do not inspect/modify older portal releases.
PORTAL = {'server.cjs': '3c057b6ef4c987375f4e66d5f083c40196c94f41f1d26fc4250a4235d5ce52ee', 'public/app.js': '4a53ced413dcfb5dc9dfa195377e86047db9bfdc25199c1652f1d252d0e5815f', 'public/styles.css': '160e74c7bbb800489b4f97774d6e04afffac2807e6e62edb9a3644c7ff6fabe4', 'public/window-model.mjs': 'e0f3d41f785974bc0aeb18d59bf9ca4143587cade3212895461690d8b13d3438', 'public/desktop-window.mjs': '2fb3189569a511249caca2b6e1f39cc24ae537aa6df7376ac2aeb8fa2f7dce7f'}


class Stop(RuntimeError):
    pass


def need(value, message):
    if not value:
        raise Stop(message)


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=90)
    need(result.returncode == 0, 'Read-only command failed; raw output withheld.')
    return result.stdout.strip()


def occ(*args):
    return json.loads(run(['docker', 'exec', '--user', 'www-data', 'nextcloud-aio-nextcloud', 'php', '/var/www/html/occ', *args, '--output=json']))


def public(host, path):
    with socket.create_connection(('192.168.8.153', 443), timeout=15) as raw:
        with ssl.create_default_context().wrap_socket(raw, server_hostname=host) as conn:
            conn.sendall(('GET ' + path + ' HTTP/1.1\r\nHost: ' + host + '\r\nConnection: close\r\n\r\n').encode())
            response = http.client.HTTPResponse(conn)
            response.begin()
            body = response.read(1048576)
            need(response.status == 200, 'Existing trusted HTTPS endpoint requires review: ' + host + path)
            return response.headers, body


def inventory():
    need(os.geteuid() == 0, 'Run using sudo python3.')
    for name, digest in PORTAL.items():
        p = Path('/srv/homelab-host/portal/app') / name
        need(not p.is_symlink() and hashlib.sha256(p.read_bytes()).hexdigest() == digest,
             'Portal source differs from the accepted Files-window release; preserve edits.')
    print('Accepted Files/Photos portal source verified.', flush=True)
    for name in ['nextcloud-aio-nextcloud', 'homelab-immich-server', 'homelab-portal-web']:
        item = json.loads(run(['docker', 'inspect', name]))[0]
        need(item['State']['Running'] and item['State'].get('Health', {}).get('Status') == 'healthy', 'Required app container is not healthy.')
        report = {'container': name, 'healthy': True, 'image_id': item['Image']}
        if name == 'homelab-immich-server':
            # Report only presence, never the path or any other environment variable.
            report['file_configuration_override_present'] = any(
                value.startswith('IMMICH_CONFIG_FILE=') and bool(value.partition('=')[2])
                for value in item['Config'].get('Env', []))
        print(json.dumps(report), flush=True)
    apps = occ('app:list').get('enabled', {})
    need(apps.get('plutonium_desktop_frame') == '0.1.0', 'Accepted native Files integration is not enabled.')
    for name in ['theming', 'theming_customcss', 'user_oidc', 'plutonium_desktop_frame']:
        print('Nextcloud enabled ' + name + ': ' + str(apps.get(name, 'not enabled')), flush=True)
    _, body = public('cask.plutoniumcloud.com', '/status.php')
    status = json.loads(body)
    need(status.get('versionstring') == '34.0.5' and status.get('installed') and not status.get('maintenance'),
         'Nextcloud baseline changed; review installed theme compatibility.')
    print('Nextcloud version: ' + status['versionstring'], flush=True)
    data = occ('config:list', 'theming')
    settings = data.get('apps', {}).get('theming')
    need(isinstance(settings, dict), 'Nextcloud theming inventory format differs.')
    print('Nextcloud theming setting keys: ' + json.dumps(sorted(settings)), flush=True)
    visible = ['name', 'url', 'slogan', 'color', 'primary_color', 'background_color', 'backgroundMime', 'logoMime', 'cachebuster', 'disable-user-theming', 'enabledThemes', 'defaultTheme']
    for name in visible:
        if name in settings:
            value = settings[name]
            need(isinstance(value, (str, int, bool)) and len(str(value)) < 512, 'Unexpected theme field; preserve existing customization.')
            print('Nextcloud theming ' + name + ': ' + json.dumps(value), flush=True)
    for name in ['logo', 'logoheader', 'favicon', 'background', 'background_image', 'imprintUrl', 'privacyUrl', 'custom_css', 'customCss']:
        if name in settings:
            raw = json.dumps(settings[name], sort_keys=True).encode()
            print(json.dumps({'theme_field': name, 'configured': bool(settings[name]), 'value_sha256': hashlib.sha256(raw).hexdigest()}), flush=True)
    print('Installed native theming CLI help:', flush=True)
    help_text = run(['docker', 'exec', '--user', 'www-data', 'nextcloud-aio-nextcloud', 'php', '/var/www/html/occ', 'help', 'theming:config', '--no-ansi'])
    need(len(help_text) < 16000, 'Unexpectedly large native theme help; preserve current state.')
    print(help_text, flush=True)
    _, body = public('photos.plutoniumcloud.com', '/api/server/version')
    version = json.loads(body)
    need([version.get(x) for x in ['major', 'minor', 'patch']] == [3, 3, 6], 'Immich version changed; recheck supported CSS variables.')
    print('Immich version: 3.3.6', flush=True)
    headers, css = public('photos.plutoniumcloud.com', '/custom.css')
    need('text/css' in headers.get('Content-Type', ''), 'Native custom.css response type differs.')
    print(json.dumps({'immich_custom_css_bytes': len(css), 'immich_custom_css_sha256': hashlib.sha256(css).hexdigest(), 'custom_css_present': bool(css.strip())}), flush=True)
    for host, path in [('auth.plutoniumcloud.com', '/-/health/ready/'), ('plutoniumcloud.com', '/')]:
        public(host, path)
    print('READ-ONLY NATIVE THEME INVENTORY COMPLETE. No theme, account, CSS, source deployment or service changes.', flush=True)


if __name__ == '__main__':
    try:
        inventory()
    except Exception as error:
        print('STOPPED: ' + (str(error) if isinstance(error, Stop) else type(error).__name__ + '; sensitive details withheld.'), flush=True)
        print('Preserve current settings and paste this bounded output. No rollback needed for this inventory.', flush=True)
        sys.exit(1)
