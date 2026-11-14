#!/usr/bin/env python3
"""Read-only native header branding prerequisites; no settings or files changed."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

INVENTORY_SHA = '1ddfd16b27735e1a49bc31cee8cf4a4175edc1490382da87e440dd999215d7db'


def need(value, message):
    if not value:
        raise RuntimeError(message)


PHP = r'''
$paths=[
 'core/css/header.scss',
 'lib/public/AppFramework/Http/Events/BeforeTemplateRenderedEvent.php',
 'lib/public/Util.php',
 'lib/public/AppFramework/Bootstrap/IRegistrationContext.php',
 'apps/theming/lib/ImageManager.php',
 'apps/theming/src/components/AdminSectionThemingAdvanced.vue'
];
$report=[];
foreach($paths as $name){
 $p='/var/www/html/'.$name;
 if(!is_file($p)){$report[$name]=['present'=>false];continue;}
 $body=file_get_contents($p);$lines=explode("\n",$body);$matches=[];
 foreach($lines as $n=>$line){
  if(preg_match('/BeforeTemplateRenderedEvent|function (getResponse|addStyle|registerEventListener)|logoheader|Navigation bar logo|padding-inline-start|width: 62px|SUPPORTED_IMAGE_KEYS/', $line))
   $matches[]=['line'=>$n+1,'source'=>substr(trim($line),0,240)];
 }
 $report[$name]=['present'=>true,'sha256'=>hash('sha256',$body),'relevant_lines'=>array_slice($matches,0,20)];
}
$parent='/var/www/html/custom_apps';
$report['new_style_app_path']=['persistent_parent_resolved'=>realpath($parent),
 'parent_writable'=>is_writable($parent),
 'proposed_app_exists'=>file_exists($parent.'/plutonium_files_brand')||is_link($parent.'/plutonium_files_brand')];
echo json_encode($report,JSON_THROW_ON_ERROR);
'''


def main():
    need(os.geteuid() == 0, 'Run using sudo python3.')
    p = Path(__file__).resolve().parent / 'inspect-native-themes.py'
    need(hashlib.sha256(p.read_bytes()).hexdigest() == INVENTORY_SHA, 'Reviewed native inventory helper differs.')
    spec = importlib.util.spec_from_file_location('reviewed_header_inventory', p)
    h = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(h)
    for name, digest in h.PORTAL.items():
        file = Path('/srv/homelab-host/portal/app') / name
        need(not file.is_symlink() and hashlib.sha256(file.read_bytes()).hexdigest() == digest,
             'Current portal source differs from accepted Files release; preserve edits.')
    print('Accepted Files/Photos portal source verified.', flush=True)
    apps = h.occ('app:list')
    enabled = apps.get('enabled', {})
    for name in ['theming', 'plutonium_desktop_frame', 'plutonium_files_brand']:
        print('Nextcloud enabled ' + name + ': ' + str(enabled.get(name, 'not enabled')), flush=True)
    need(enabled.get('theming') == '2.9.0' and enabled.get('plutonium_desktop_frame') == '0.1.0', 'Installed native theme/window version changed.')
    need('plutonium_files_brand' not in enabled and 'plutonium_files_brand' not in apps.get('disabled', {}), 'Proposed style app ID already exists; preserve it.')
    status = h.occ('status')
    need(status.get('versionstring') == '34.0.5' and status.get('installed') and not status.get('maintenance'), 'Nextcloud version/readiness changed.')
    values = h.occ('config:list', 'theming').get('apps', {}).get('theming', {})
    for key in ['logoMime', 'logoheaderMime', 'faviconMime']:
        value = None
        if key in values:
            value = h.run(['docker', 'exec', '--user', 'www-data', 'nextcloud-aio-nextcloud', 'php', '/var/www/html/occ',
                           'config:app:get', 'theming', key, '--no-ansi'])
        print(json.dumps({'native_logo_setting': key, 'present': key in values, 'custom_image_configured': bool(value)}), flush=True)
    raw = h.run(['docker', 'exec', '--user', 'www-data', 'nextcloud-aio-nextcloud', 'php', '-r', PHP])
    report = json.loads(raw)
    print('Installed header and public styling API inventory:', flush=True)
    print(json.dumps(report, indent=2), flush=True)
    for host, path in [('cask.plutoniumcloud.com', '/status.php'), ('photos.plutoniumcloud.com', '/photos'),
                       ('auth.plutoniumcloud.com', '/-/health/ready/'), ('plutoniumcloud.com', '/')]:
        h.public(host, path)
    print('READ-ONLY FILES HEADER INVENTORY COMPLETE. No custom logo, CSS, app enablement, account, frame policy or service changes.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('STOPPED: ' + type(error).__name__ + '; preserve settings/source. Raw diagnostics withheld.', flush=True)
        sys.exit(1)
