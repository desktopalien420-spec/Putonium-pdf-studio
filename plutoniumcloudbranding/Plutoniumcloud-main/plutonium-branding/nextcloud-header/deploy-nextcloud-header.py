#!/usr/bin/env python3
"""Scoped native Files-header style app; no core, portal or framing edits."""
import base64
import fcntl
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = Path('/var/lib/homelab-nextcloud-files-header')
STATE = ROOT / 'state.json'
APP_ID = 'plutonium_files_brand'
CONTAINER = 'nextcloud-aio-nextcloud'
INVENTORY_SHA = '1ddfd16b27735e1a49bc31cee8cf4a4175edc1490382da87e440dd999215d7db'
META = {'payload': '7f87487d06f841cc92e48b0db7da42d03f3165f6c7879b5dde81f4c7d25eb9d7', 'files': {'nextcloud-app/appinfo/info.xml': 'e8d5b66258b77cdfd1c60c82f88c0b2fc940a68c85f04729cf0673c70484100a', 'nextcloud-app/css/header.css': '1783d9c92153bed88460c4902e4c8459f0a44f09f52e53d88a1fcd7ea3ee076d', 'nextcloud-app/img/orbit.svg': '753cda5666bea7c36b65af2b07c753acf2e90830e22afb9e0e58faa4596c3aef', 'nextcloud-app/img/wordmark.svg': '0cf32e80cd2419302d9b54feb668ce948389445824872613b3bd0b287461b9df', 'nextcloud-app/lib/AppInfo/Application.php': 'eeaf0a06fdfaa59bc62b52c193850947e5b4d3ff843d0c46e3471aa213a7edc0', 'nextcloud-app/lib/Listener/HeaderStyleListener.php': '2887a52d9346ae4a8d185121958d22a6a5b5f6e4b97f88596643c3ca30e3aab3', 'listener-fixture.php': '9ac1a604b7fc55ac6771c24691fd600c93d25ec122456a49303fb6c818d0b6d1'}}
SOURCES = {
 'core/css/header.scss': '9b18ad5b1e219750baf00334374165dc83619740f6d49bbf2353db9235dd8d0c',
 'lib/public/AppFramework/Http/Events/BeforeTemplateRenderedEvent.php': 'dd2d527d97e8a0cc50719c3f69d022738a86d55ed9a760a39c1caef79baeb2b3',
 'lib/public/Util.php': '0813286a5c7be369c555fc8df9396055ecc30b2ee4aed976ffb4952b0d59ddd1',
 'lib/public/AppFramework/Bootstrap/IRegistrationContext.php': 'c24694b9aface5ad4fb1104d08e157b20c2bb25a2576a269037494e2157e74a1',
}
THEME_KEYS = ['name', 'url', 'slogan', 'primary_color', 'background_color', 'logoMime', 'logoheaderMime', 'faviconMime']


class Stop(RuntimeError):
    pass


def need(value, message):
    if not value:
        raise Stop(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def helper():
    p = HERE / 'inspect-native-themes.py'
    need(sha(p.read_bytes()) == INVENTORY_SHA, 'Reviewed native helper differs.')
    spec = importlib.util.spec_from_file_location('reviewed_files_header_native', p)
    h = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(h)
    return h


def run(args, text=None):
    result = subprocess.run(args, input=text, capture_output=True, text=True, timeout=90)
    need(result.returncode == 0, 'Native action failed; sensitive diagnostic output withheld.')
    return result.stdout.strip()


def php(code, payload):
    return run(['docker', 'exec', '-i', '--user', 'www-data', CONTAINER, 'php', '-r', code], json.dumps(payload))


def save(state):
    p = STATE.with_suffix('.json.new')
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(state, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(p, STATE)


def unpack():
    raw = (HERE / 'nextcloud-header-update.tar').read_bytes()
    need(sha(raw) == META['payload'], 'Reviewed header archive differs.')
    data = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        members = archive.getmembers()
        need(len(members) == len(META['files']) and {m.name for m in members} == set(META['files']), 'Header source paths differ.')
        for member in members:
            need(member.isfile() and member.size < 131072, 'Unexpected header archive entry.')
            body = archive.extractfile(member).read()
            need(sha(body) == META['files'][member.name], 'Header source bytes differ.')
            data[member.name] = body
    return data


def app_files(data):
    return {name[len('nextcloud-app/'):]: value for name, value in data.items() if name.startswith('nextcloud-app/')}


def listing(h):
    data = h.occ('app:list')
    need(isinstance(data.get('enabled'), dict), 'Native app listing format differs.')
    return data


def appearance(h):
    # List reports presence only; exact known-key getters avoid URL redaction bugs.
    values = h.occ('config:list', 'theming').get('apps', {}).get('theming')
    need(isinstance(values, dict), 'Native appearance inventory differs.')
    result = {}
    for key in THEME_KEYS:
        value = h.run(['docker', 'exec', '--user', 'www-data', CONTAINER, 'php', '/var/www/html/occ',
                       'config:app:get', 'theming', key, '--no-ansi']) if key in values else None
        result[key] = {'exists': key in values, 'value': value}
    return result


def portal(h):
    for name, digest in h.PORTAL.items():
        p = Path('/srv/homelab-host/portal/app') / name
        need(not p.is_symlink() and sha(p.read_bytes()) == digest, 'Accepted portal source changed; preserve edits.')


def health(h):
    for host, path in [('cask.plutoniumcloud.com', '/status.php'), ('photos.plutoniumcloud.com', '/photos'),
                       ('auth.plutoniumcloud.com', '/-/health/ready/'), ('plutoniumcloud.com', '/')]:
        h.public(host, path)


PREFLIGHT = r'''
$sources=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
foreach($sources as $name=>$hash){if(hash_file('sha256','/var/www/html/'.$name)!==$hash)throw new RuntimeException('Native source changed');}
$p='/var/www/html/custom_apps';
if(realpath($p)!==$p || !is_writable($p))throw new RuntimeException('Persistent app path differs');
if(file_exists($p.'/plutonium_files_brand') || is_link($p.'/plutonium_files_brand'))throw new RuntimeException('App path occupied');
echo 'HEADER_NATIVE_PREREQUISITES_PASSED';
'''
WRITE = r'''
$p=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$parent='/var/www/html/custom_apps';$root=$parent.'/plutonium_files_brand';
$allowed=['appinfo/info.xml','lib/AppInfo/Application.php','lib/Listener/HeaderStyleListener.php','css/header.css','img/wordmark.svg','img/orbit.svg'];
if(realpath($parent)!==$parent || file_exists($root) || is_link($root))throw new RuntimeException('App directory occupied');
if(count($p['files'])!==count($allowed) || array_diff(array_keys($p['files']),$allowed))throw new RuntimeException('App file paths differ');
foreach($allowed as $name){$data=base64_decode($p['files'][$name],true);if($data===false || hash('sha256',$data)!==$p['hashes'][$name])throw new RuntimeException('App bytes differ');}
if(!mkdir($root,0750))throw new RuntimeException('App directory creation failed');
foreach($allowed as $name){
 $file=$root.'/'.$name;$dir=dirname($file);
 if(!is_dir($dir) && !mkdir($dir,0750,true))throw new RuntimeException('Subdirectory creation failed');
 $stream=fopen($file,'xb');if($stream===false)throw new RuntimeException('File exists');
 $data=base64_decode($p['files'][$name],true);if(fwrite($stream,$data)!==strlen($data))throw new RuntimeException('Incomplete source write');
 fflush($stream);if(function_exists('fsync'))fsync($stream);fclose($stream);chmod($file,0640);
}
echo 'HEADER_APP_SOURCE_STAGED';
'''
VERIFY = r'''
$hashes=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$root='/var/www/html/custom_apps/plutonium_files_brand';
if(is_link($root) || realpath($root)!==$root)throw new RuntimeException('App path changed');
foreach($hashes as $name=>$hash){$p=$root.'/'.$name;if(is_link($p) || hash_file('sha256',$p)!==$hash)throw new RuntimeException('App source changed');}
echo 'HEADER_APP_SOURCE_VERIFIED';
'''


def verify_source(data):
    need(php(VERIFY, {name: sha(body) for name, body in app_files(data).items()}) == 'HEADER_APP_SOURCE_VERIFIED', 'Native header app verification failed.')


def preflight(h, data):
    need(not ROOT.exists(), 'Header state exists; preserve it instead of repeating install.')
    portal(h)
    apps = listing(h)
    need(APP_ID not in apps['enabled'] and APP_ID not in apps.get('disabled', {}), 'Header app ID already exists.')
    need(apps['enabled'].get('theming') == '2.9.0' and apps['enabled'].get('plutonium_desktop_frame') == '0.1.0', 'Native theme/framing version differs.')
    status = h.occ('status')
    need(status.get('versionstring') == '34.0.5' and status.get('installed') and not status.get('maintenance'), 'Nextcloud version/readiness differs.')
    item = json.loads(run(['docker', 'inspect', CONTAINER]))[0]
    need(item['State'].get('Health', {}).get('Status') == 'healthy' and item['Image'] == 'sha256:78d2a376d482277af7db66967dfd767c061fb322062a6f88b20b70ba96d60893', 'Native app image/readiness differs.')
    need(any(m.get('Destination') == '/var/www/html' and m.get('Type') == 'volume' and m.get('Name') == 'nextcloud_aio_nextcloud' and m.get('RW') is True for m in item['Mounts']), 'Persistent app volume differs.')
    need(not any(m.get('Destination', '').startswith('/var/www/html/custom_apps') for m in item['Mounts']), 'A separate custom-app mount requires review.')
    for name, admin in [('admin', False), ('akadmin', True)]:
        value = h.occ('user:info', name)
        need(value.get('enabled') is True and ('admin' in value.get('groups', [])) is admin, 'Daily/recovery privilege baseline differs.')
    before = appearance(h)
    need(all(not before[k]['exists'] for k in ['logoMime', 'logoheaderMime', 'faviconMime']), 'Custom native branding appeared after inventory; preserve it.')
    need(php(PREFLIGHT, SOURCES) == 'HEADER_NATIVE_PREREQUISITES_PASSED', 'Native header source/storage check failed.')
    for name, body in app_files(data).items():
        if name.endswith('.php'):
            run(['docker', 'exec', '-i', '--user', 'www-data', CONTAINER, 'php', '-l'], body.decode())
    need(php(data['listener-fixture.php'].decode(), {'listener': data['nextcloud-app/lib/Listener/HeaderStyleListener.php'].decode()}) == 'FILES_HEADER_SCOPE_TESTS_PASSED', 'Native PHP header scope fixture failed.')
    health(h)
    print('Verified native PHP syntax and 16 listener scope cases, header hooks, absent custom logos, daily/recovery roles, private source and HTTPS.', flush=True)
    return before


def verify(h, state, data):
    verify_source(data)
    apps = listing(h)['enabled']
    need(apps.get(APP_ID) == '0.1.0' and apps.get('plutonium_desktop_frame') == '0.1.0', 'Header/framing app enablement differs.')
    need(appearance(h) == state['appearance_before'], 'Native appearance settings changed; preserve them for review.')
    portal(h)
    # Static app assets can be served under custom_apps or apps according to native mapping.
    delivered = False
    for prefix in ['/custom_apps/', '/apps/']:
        try:
            for name in ['css/header.css', 'img/wordmark.svg', 'img/orbit.svg']:
                _, body = h.public('cask.plutoniumcloud.com', prefix + APP_ID + '/' + name)
                need(sha(body) == sha(data['nextcloud-app/' + name]), 'Served header asset differs.')
            delivered = True
            break
        except Exception:
            continue
    need(delivered, 'Header CSS/assets were not verified over trusted HTTPS; no validation bypass.')
    health(h)


def rollback(h, state, data):
    need(state.get('payload') == META['payload'] and state.get('app_id') == APP_ID, 'Protected header state differs.')
    apps = listing(h)['enabled']
    if APP_ID in apps:
        need(apps[APP_ID] == '0.1.0', 'A newer branding app version exists; no disable attempted.')
        verify_source(data)
        run(['docker', 'exec', '--user', 'www-data', CONTAINER, 'php', '/var/www/html/occ', 'app:disable', APP_ID, '--no-interaction'])
    state['phase'] = 'disabled_verification_pending'
    save(state)
    print('Only the Files header style app is disabled; source retained. Checking native health...', flush=True)
    need(APP_ID not in listing(h)['enabled'], 'Header app disablement not verified.')
    health(h)
    state['phase'] = 'rolled_back_source_retained'
    save(state)
    print('FILES HEADER ROLLED BACK. Native header restored on reload; Files framing and theme settings retained.', flush=True)


def main():
    need(os.geteuid() == 0, 'Run using sudo python3.')
    need(len(sys.argv) == 2 and sys.argv[1] in ['check', 'install', 'rollback'], 'Choose check, install or rollback.')
    mode = sys.argv[1]
    lock = os.open('/run/lock/homelab-nextcloud-files-header.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    h = helper()
    data = unpack()
    if mode == 'rollback':
        need(STATE.is_file(), 'No protected Files header deployment exists.')
        rollback(h, json.loads(STATE.read_text()), data)
        return
    before = preflight(h, data)
    if mode == 'check':
        print('READ-ONLY FILES HEADER PREFLIGHT PASSED. No app enablement, logo/style settings or service changes.', flush=True)
        return
    ROOT.mkdir(mode=0o700)
    state = {'phase': 'prepared', 'app_id': APP_ID, 'payload': META['payload'], 'appearance_before': before}
    save(state)
    try:
        native = app_files(data)
        php(WRITE, {'files': {n: base64.b64encode(b).decode() for n, b in native.items()}, 'hashes': {n: sha(b) for n, b in native.items()}})
        verify_source(data)
        state['phase'] = 'source_staged'
        save(state)
        run(['docker', 'exec', '--user', 'www-data', CONTAINER, 'php', '/var/www/html/occ', 'app:enable', APP_ID, '--no-interaction'])
        state['phase'] = 'enabled_verification_pending'
        save(state)
        verify(h, state, data)
        state['phase'] = 'awaiting_browser_acceptance'
        save(state)
    except Exception:
        print('Header verification failed; attempting to disable only this new style app.', flush=True)
        rollback(h, state, data)
        raise Stop('Header did not pass verification; style app disabled and source retained.')
    print('PLUTONIUM FILES HEADER READY. Style app/assets and unchanged native settings verified; existing HTTPS healthy.', flush=True)
    print('No core/portal/framing edits, restarts, account, proxy, SSH, firewall or storage layout changes.', flush=True)
    print('Reload Files; verify wide wordmark, compact orbit, home-link/menu behavior and existing files.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('STOPPED: ' + (str(error) if isinstance(error, Stop) else type(error).__name__ + '; raw diagnostic output withheld.'), flush=True)
        print('Preserve source/state and paste bounded output. Do not repeat install or print live configuration.', flush=True)
        sys.exit(1)
