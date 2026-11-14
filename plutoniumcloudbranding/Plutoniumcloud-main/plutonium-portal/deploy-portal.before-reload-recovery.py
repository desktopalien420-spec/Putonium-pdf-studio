#!/usr/bin/env python3
"""Deploy only a private, gateway-authenticated portal. No application-account migration."""
import fcntl
import hashlib
import http.client
import importlib.util
import io
import json
import os
import re
import secrets
import socket
import sys
import tarfile
import time
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = Path('/srv/homelab-host/portal')
ROOT = Path('/var/lib/homelab-portal')
STATE = ROOT / 'state.json'
PROJECT = 'homelab-portal'
HOST = 'plutoniumcloud.com'
IMAGE = 'docker.io/library/node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8'
ARCHIVE_SHA256 = '0f1c06c2f6fd6d3409523e8090a4debc3da1ac249f42ac879bd262a5bfa3bf28'
PROXY_HELPER_SHA256 = 'e9bcb425efd8d02468f1bd4bfc396cfd6fbf43b9d8c877b172650effa7b5a2e1'
FILES = {'server.cjs', 'public/index.html', 'public/desktop.html', 'public/styles.css', 'public/app.js', 'public/mark.svg'}

PROXY_BLOCK = '''
# BEGIN homelab-portal private gateway
plutoniumcloud.com {
    bind 192.168.8.153
    tls {
        dns cloudflare {env.CF_API_TOKEN}
        resolvers 1.1.1.1 1.0.0.1
        propagation_delay 30s
        propagation_timeout -1
    }
    @outside not remote_ip 192.168.8.0/24 127.0.0.1 ::1 172.16.0.0/12
    respond @outside "Private access only" 403
    header Cache-Control "no-store"
    route {
        request_header -X-Portal-Bridge-Key
        request_header -X-Authentik-Uid
        request_header -X-Authentik-Username
        request_header -X-Authentik-Name
        request_header -X-Authentik-Groups
        request_header -Authorization
        reverse_proxy /outpost.goauthentik.io/* 127.0.0.1:9000
        @entrance path / /index.html /styles.css /mark.svg
        handle @entrance {
            reverse_proxy 127.0.0.1:13000 {
                header_up X-Portal-Bridge-Key BRIDGE_SECRET
            }
        }
        handle {
            forward_auth 127.0.0.1:9000 {
                uri /outpost.goauthentik.io/auth/caddy
                copy_headers X-Authentik-Username X-Authentik-Groups X-Authentik-Name X-Authentik-Uid
            }
            reverse_proxy 127.0.0.1:13000 {
                header_up X-Portal-Bridge-Key BRIDGE_SECRET
            }
        }
    }
}
# END homelab-portal private gateway
'''

# Read only the installed identity database; no passwords, tokens or signing keys emitted.
IDP_CHECK = '''
import json
from authentik.core.models import Application, Group, User
from authentik.providers.proxy.models import ProxyProvider
from authentik.policies.models import PolicyBinding
from authentik.outposts.models import Outpost
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("SET default_transaction_read_only = on")
result = {}
app = Application.objects.filter(slug="plutonium-cloud").first()
result["application_exists"] = app is not None
provider = ProxyProvider.objects.filter(pk=app.provider_id).first() if app else None
result["proxy_provider_exists"] = provider is not None
result["single_application_mode"] = bool(provider and provider.mode == "forward_single")
result["correct_external_host"] = bool(provider and provider.external_host.rstrip("/") == "https://plutoniumcloud.com")
group = Group.objects.filter(name="plutonium-members").first()
result["ordinary_member_group"] = bool(group and not group.is_superuser and not getattr(group, "parent_id", None))
bindings = list(PolicyBinding.objects.filter(target=app)) if app else []
result["only_enabled_members_binding"] = bool(group and len(bindings) == 1 and bindings[0].group_id == group.pk and bindings[0].enabled and not bindings[0].negate and bindings[0].policy_id is None and bindings[0].user_id is None and not bindings[0].failure_result)
result["initial_admin_is_member"] = bool(group and User.objects.filter(username="akadmin", groups=group, is_active=True).exists())
outposts = list(Outpost.objects.filter(providers=provider)) if provider else []
result["assigned_to_embedded_outpost"] = any(o.managed == "goauthentik.io/outposts/embedded" for o in outposts)
result["permanent_outpost_host"] = any(o.managed == "goauthentik.io/outposts/embedded" and o.config.authentik_host.rstrip("/") == "https://auth.plutoniumcloud.com" and not o.config.authentik_host_insecure for o in outposts)
print("PORTAL_CHECK=" + json.dumps(result))
'''

class Stop(RuntimeError):
    pass

def need(value, text):
    if not value:
        raise Stop(text)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def load_proxy_helper():
    file = HERE / 'private-https.py'
    need(digest(file.read_bytes()) == PROXY_HELPER_SHA256, 'Reviewed proxy helper differs; preserve current files.')
    spec = importlib.util.spec_from_file_location('reviewed_private_https', file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def save(state):
    p = ROOT / 'state.json.new'
    p.write_text(json.dumps(state, indent=2))
    p.chmod(0o600)
    os.replace(p, STATE)

def compose(*args):
    return ['docker', 'compose', '-p', PROJECT, '--env-file', BASE / 'secrets.env', '-f', BASE / 'compose.json', *args]

def integration_check(proxy):
    raw = proxy.run(['docker', 'exec', 'homelab-authentik-server', 'ak', 'shell', '-c', IDP_CHECK], timeout=90)
    lines = [x for x in raw.splitlines() if x.startswith('PORTAL_CHECK=')]
    need(len(lines) == 1, 'Identity integration check did not return a complete report. No identity objects changed.')
    report = json.loads(lines[0].split('=', 1)[1])
    for name, value in report.items():
        print('Identity preflight: ' + name + ' = ' + str(value), flush=True)
    need(len(report) == 9 and all(value is True for value in report.values()), 'Identity app/group/outpost configuration needs correction before deployment.')
    conn = http.client.HTTPConnection('127.0.0.1', 9000, timeout=15)
    try:
        conn.request('GET', '/outpost.goauthentik.io/auth/caddy', headers={'Host': HOST, 'X-Forwarded-Host': HOST, 'X-Forwarded-Proto': 'https', 'X-Forwarded-Uri': '/desktop', 'X-Forwarded-Method': 'GET'})
        response = conn.getresponse()
        response.read(65536)
        target = urllib.parse.urlsplit(response.getheader('Location', ''))
        need(response.status in [302, 303] and target.scheme == 'https' and target.hostname == 'auth.plutoniumcloud.com', 'Embedded gateway has not loaded the portal configuration or has an incorrect login redirect.')
    finally:
        conn.close()
    print('Live gateway recognizes the portal and redirects to the correct HTTPS login host.', flush=True)

def local_request(path, headers=None):
    conn = http.client.HTTPConnection('127.0.0.1', 13000, timeout=10)
    try:
        conn.request('GET', path, headers=headers or {})
        response = conn.getresponse()
        return response.status, response.read(131072)
    finally:
        conn.close()

def backend_checks():
    status, body = local_request('/healthz')
    need(status == 200 and json.loads(body).get('ready') is True, 'Private portal backend not ready.')
    status, _ = local_request('/api/me', {'X-Authentik-Uid': 'forged', 'X-Authentik-Username': 'akadmin', 'X-Authentik-Groups': 'plutonium-members|plutonium-admins'})
    need(status == 403, 'Backend gateway-key bypass test failed; preserve private bind and stop.')

def healthy_apps(proxy):
    proxy.existing_apps()
    status, _, _ = proxy.https('auth.plutoniumcloud.com', '/-/health/ready/')
    need(status == 200, 'Existing identity HTTPS is not healthy.')

def rollback(proxy, state):
    before = (ROOT / 'Caddyfile.before').read_bytes()
    need(digest(before) == state['before_sha256'], 'Proxy backup differs; preserved for review.')
    current = digest(proxy.CADDY.read_bytes())
    need(current in [state['before_sha256'], state['after_sha256']], 'Shared proxy has unrelated newer edits; merge manually rather than overwriting.')
    if current == state['after_sha256']:
        proxy.validate(before)
        proxy.write_in_place(before, state['after_sha256'])
        proxy.reload_proxy()
    healthy_apps(proxy)
    info = proxy.run(['docker', 'ps', '-aq', '--filter', 'name=^homelab-portal-web$'])
    if info:
        item = json.loads(proxy.run(['docker', 'inspect', 'homelab-portal-web']))[0]
        need((item.get('Config', {}).get('Labels') or {}).get('com.docker.compose.project') == PROJECT, 'Container name belongs to another project.')
    proxy.run(compose('down', '--timeout', '30'), timeout=90)
    state['phase'] = 'rolled_back_data_retained'
    save(state)
    print('PORTAL STOPPED. Original proxy restored; portal files/key and all existing services/accounts retained.', flush=True)

def verify_portal(proxy, state):
    need(digest(proxy.CADDY.read_bytes()) == state['after_sha256'], 'Shared proxy changed; preserve new edits.')
    backend_checks()
    deadline = time.monotonic() + 180
    while True:
        try:
            healthy_apps(proxy)
        except Exception:
            print('Existing HTTPS regression; restoring only this portal change.', flush=True)
            rollback(proxy, state)
            raise Stop('Portal change rolled back after existing-service check failed.')
        try:
            status, _, body = proxy.https(HOST, '/')
            need(status == 200 and b'Continue to secure sign-in.' in body, 'Portal entrance is not ready.')
            break
        except Exception:
            if time.monotonic() >= deadline:
                state['phase'] = 'certificate_pending'
                save(state)
                raise Stop('Portal trusted certificate/entrance not ready yet. Existing apps remain healthy. Preserve files; use resume, not another install.')
            print('Waiting for trusted private portal HTTPS; certificate validation remains enabled...', flush=True)
            time.sleep(10)
    # Test authentication through the real proxy with no browser cookies or trusted key.
    forged = {'X-Authentik-Uid': 'forged', 'X-Authentik-Username': 'akadmin', 'X-Authentik-Groups': 'plutonium-members|plutonium-admins', 'X-Portal-Bridge-Key': 'forged', 'Authorization': 'Bearer forged'}
    import ssl
    for path in ['/desktop', '/desktop.html', '/api/me', '/app.js']:
        for headers in [{}, forged]:
            with socket.create_connection(('192.168.8.153', 443), timeout=12) as raw:
                with ssl.create_default_context().wrap_socket(raw, server_hostname=HOST) as secure:
                    fields = '\r\n'.join(k + ': ' + v for k, v in headers.items())
                    request = 'GET ' + path + ' HTTP/1.1\r\nHost: ' + HOST + '\r\n' + (fields + '\r\n' if fields else '') + 'Connection: close\r\n\r\n'
                    secure.sendall(request.encode())
                    response = http.client.HTTPResponse(secure)
                    response.begin()
                    response.read(262144)
                    if response.status not in [302, 303, 401, 403]:
                        rollback(proxy, state)
                        raise Stop('Anonymous/forged-header authorization check failed; portal rolled back.')
                    if path in ['/desktop', '/desktop.html'] and response.status not in [302, 303]:
                        raise Stop('Browser desktop request did not redirect to login; keep the portal private and review gateway configuration.')
                    location = response.getheader('Location')
                    if location:
                        target = urllib.parse.urlsplit(location)
                        need(not target.scheme or target.scheme == 'https', 'Authentication redirect is not HTTPS; keep portal private and review.')
                        need(not target.hostname or target.hostname in [HOST, 'auth.plutoniumcloud.com'], 'Unexpected authentication redirect host; review configuration.')
    status, _, _ = proxy.https(HOST, '/outpost.goauthentik.io/ping')
    need(status == 204, 'Embedded gateway route not available on the portal hostname.')
    state['phase'] = 'private_portal_ready'
    save(state)
    print('PRIVATE AUTHENTICATED PORTAL READY: https://' + HOST, flush=True)
    print('Anonymous and forged-identity requests blocked. Existing identity/Nextcloud/Immich HTTPS healthy.', flush=True)
    print('Next: real browser login test. Service account linking, VMs, chat and public internet access remain pending.', flush=True)

def main():
    need(os.geteuid() == 0, 'Run using sudo python3.')
    os.umask(0o077)
    mode = sys.argv[1] if len(sys.argv) == 2 else ''
    need(mode in ['install', 'resume', 'rollback', 'check'], 'Use install, resume, rollback, or check.')
    lock = os.open('/run/lock/homelab-portal.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise Stop('Another portal operation is running.')
    proxy = load_proxy_helper()
    proxy.verify_mount()
    proxy.verify_proxy()
    if mode == 'rollback':
        need(STATE.is_file(), 'No owned portal deployment record found.')
        rollback(proxy, json.loads(STATE.read_text()))
        return
    proxy.identity_health()
    healthy_apps(proxy)
    integration_check(proxy)
    if mode == 'check':
        print('READ-ONLY PORTAL INTEGRATION CHECK PASSED. No service, account, or proxy changes.', flush=True)
        return
    if mode == 'resume':
        need(STATE.is_file(), 'No existing deployment to resume.')
        state = json.loads(STATE.read_text())
        need(state.get('phase') in ['proxy_applied', 'certificate_pending', 'private_portal_ready'], 'Saved phase needs review; do not recreate data.')
        verify_portal(proxy, state)
        return
    need(not BASE.exists() and not ROOT.exists(), 'Portal state/data already exists. Use check/resume or inspect; never recreate keys.')
    need(not proxy.run(['docker', 'ps', '-aq', '--filter', 'name=^homelab-portal-web$']), 'Portal container name is already occupied.')
    need(not proxy.run(['docker', 'network', 'ls', '--filter', 'label=com.docker.compose.project=' + PROJECT, '--format', '{{.Name}}']), 'Existing portal project network needs review.')
    sock = socket.socket()
    try:
        sock.bind(('127.0.0.1', 13000))
    except OSError:
        raise Stop('Private portal port 13000 is occupied.')
    finally:
        sock.close()
    payload = (HERE / 'portal-app.tar').read_bytes()
    need(digest(payload) == ARCHIVE_SHA256, 'Reviewed portal source archive differs; no extraction performed.')
    before = proxy.CADDY.read_bytes()
    need(not re.search(rb'(?m)^\s*(?:https://)?plutoniumcloud\.com\s*\{', before), 'Root domain already configured; do not replace it.')
    need((proxy.CADDY.stat().st_mode & 0o077) == 0, 'Proxy configuration must be root-private before adding a gateway secret.')
    key = secrets.token_hex(32)
    after = before + b'\n' + PROXY_BLOCK.replace('BRIDGE_SECRET', key).encode()
    proxy.validate(after)
    ROOT.mkdir(mode=0o700)
    BASE.mkdir(mode=0o700)
    (ROOT / 'Caddyfile.before').write_bytes(before)
    (ROOT / 'Caddyfile.before').chmod(0o600)
    state = {'project': PROJECT, 'phase': 'prepared', 'before_sha256': digest(before), 'after_sha256': digest(after), 'payload_sha256': ARCHIVE_SHA256}
    save(state)
    app = BASE / 'app'
    app.mkdir(mode=0o755)
    app.chmod(0o755)
    with tarfile.open(fileobj=io.BytesIO(payload), mode='r:') as archive:
        entries = archive.getmembers()
        need({m.name for m in entries} == FILES and len(entries) == len(FILES), 'Archive file list differs.')
        for entry in entries:
            need(entry.isfile() and entry.size < 2 * 1024**2, 'Unexpected archive entry type or size.')
            target = app / entry.name
            target.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
            target.parent.chmod(0o755)
            target.write_bytes(archive.extractfile(entry).read())
            target.chmod(0o644)
    (BASE / 'secrets.env').write_text('PC_BRIDGE_KEY=' + key + '\n')
    (BASE / 'secrets.env').chmod(0o600)
    key = None
    config = {'name': PROJECT, 'services': {'web': {'container_name': 'homelab-portal-web', 'image': IMAGE, 'user': '1000:1000', 'working_dir': '/app', 'command': ['node', 'server.cjs'], 'restart': 'unless-stopped', 'read_only': True, 'cap_drop': ['ALL'], 'security_opt': ['no-new-privileges:true'], 'pids_limit': 128, 'mem_limit': '256m', 'cpus': 1.0, 'environment': {'PC_BRIDGE_KEY': '${PC_BRIDGE_KEY}', 'NODE_ENV': 'production'}, 'ports': ['127.0.0.1:13000:3000'], 'volumes': [{'type': 'bind', 'source': str(app), 'target': '/app', 'read_only': True, 'bind': {'create_host_path': False}}], 'healthcheck': {'test': ['CMD', 'node', '-e', "require('http').get('http://127.0.0.1:3000/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"], 'interval': '10s', 'timeout': '5s', 'retries': 6, 'start_period': '10s'}, 'logging': {'driver': 'local', 'options': {'max-size': '10m', 'max-file': '3'}}}}}
    (BASE / 'compose.json').write_text(json.dumps(config, indent=2))
    (BASE / 'compose.json').chmod(0o600)
    proxy.run(compose('config', '--quiet'))
    state['phase'] = 'starting_backend'
    save(state)
    print('Starting only the new, loopback-bound portal backend...', flush=True)
    proxy.run(['docker', 'pull', IMAGE], timeout=1800)
    proxy.run(compose('up', '-d', '--wait', '--wait-timeout', '120'), timeout=150)
    backend_checks()
    proxy.write_in_place(after, state['before_sha256'])
    state['phase'] = 'proxy_written'
    save(state)
    try:
        proxy.reload_proxy()
    except Exception:
        rollback(proxy, state)
        raise Stop('Proxy reload failed; portal rolled back.')
    state['phase'] = 'proxy_applied'
    save(state)
    print('Private portal gateway applied. Verifying TLS and authentication boundaries...', flush=True)
    verify_portal(proxy, state)

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('STOPPED: ' + (str(error) if type(error).__name__ == 'Stop' else type(error).__name__ + '; sensitive diagnostics withheld.'), flush=True)
        print('Retain all files and paste output. Do not repeat install or print live proxy/environment files.', flush=True)
        sys.exit(1)
