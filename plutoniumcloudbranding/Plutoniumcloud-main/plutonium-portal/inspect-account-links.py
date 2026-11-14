#!/usr/bin/env python3
"""Read-only, selected-field account-linking inventory. Never print secrets."""
import json
import os
import subprocess
import sys

def run(args):
    p = subprocess.run(args, capture_output=True, text=True, timeout=90)
    if p.returncode:
        raise RuntimeError('Read-only command failed; raw output withheld.')
    return p.stdout

def occ(*args):
    return run(['docker', 'exec', '--user', 'www-data', 'nextcloud-aio-nextcloud', 'php', '/var/www/html/occ', *args])

code = """
import json
from authentik.core.models import User
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute('SET default_transaction_read_only = on')
users = list(User.objects.filter(username__iexact='adrian'))
admin = User.objects.filter(username='akadmin', is_active=True).first()
print('LINK_INVENTORY=' + json.dumps({
'adrian_identity_count': len(users),
'adrian_active': bool(users and users[0].is_active),
'adrian_superuser': bool(users and users[0].is_superuser),
'adrian_member': bool(users and users[0].groups.filter(name='plutonium-members').exists()),
'recovery_admin_active': admin is not None,
}))
"""
if os.geteuid() != 0:
    sys.exit('Run with sudo python3.')
try:
    status = json.loads(occ('status', '--output=json'))
    print('Nextcloud version: ' + str(status.get('versionstring')))
    print('Nextcloud installed/not in maintenance: ' + str(status.get('installed') is True and status.get('maintenance') is False))
    apps = json.loads(occ('app:list', '--output=json'))
    print('Nextcloud user_oidc enabled version: ' + str(apps.get('enabled', {}).get('user_oidc', 'not enabled')))
    print('Nextcloud user_oidc disabled version: ' + str(apps.get('disabled', {}).get('user_oidc', 'not installed')))
    users = json.loads(occ('user:list', '--output=json'))
    print('Nextcloud total account count: ' + str(len(users)))
    print('Existing Nextcloud admin ID present: ' + str('admin' in users))
    print('Separate Nextcloud adrian ID present: ' + str('adrian' in users))
    info = json.loads(occ('user:info', 'admin', '--output=json'))
    for name in ['user_id', 'display_name', 'enabled', 'groups', 'backend']:
        if name in info:
            print('Existing Nextcloud admin ' + name + ': ' + json.dumps(info[name]))
    raw = run(['docker', 'exec', 'homelab-authentik-server', 'ak', 'shell', '-c', code])
    reports = [line.split('=', 1)[1] for line in raw.splitlines() if line.startswith('LINK_INVENTORY=')]
    if len(reports) != 1:
        raise RuntimeError('Identity inventory incomplete.')
    report = json.loads(reports[0])
    for name in ['adrian_identity_count', 'adrian_active', 'adrian_superuser', 'adrian_member', 'recovery_admin_active']:
        print('Identity ' + name + ': ' + str(report[name]))
    item = json.loads(run(['docker', 'inspect', 'homelab-immich-server']))[0]
    print('Immich image: ' + str(item['Config']['Image']))
    print('Immich container health: ' + str(item['State'].get('Health', {}).get('Status')))
    print('READ-ONLY ACCOUNT INVENTORY COMPLETE. No accounts, ownership, settings, or files changed.')
except Exception as error:
    print('STOPPED: ' + type(error).__name__ + '; raw diagnostic output withheld.')
    sys.exit(1)
