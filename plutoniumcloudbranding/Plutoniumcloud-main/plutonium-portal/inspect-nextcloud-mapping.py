#!/usr/bin/env python3
"""Read-only verification for mapping an existing Nextcloud account."""
import json
import os
import subprocess
import sys
import uuid

def run(args):
    p = subprocess.run(args, text=True, capture_output=True, timeout=90)
    if p.returncode:
        raise RuntimeError('Read-only command failed; sensitive output withheld.')
    return p.stdout

def occ(*args):
    return json.loads(run(['docker','exec','--user','www-data','nextcloud-aio-nextcloud','php','/var/www/html/occ',*args,'--output=json']))

CODE = """
import json
from authentik.core.models import User, Application
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute('SET default_transaction_read_only = on')
users=list(User.objects.filter(username='adrian',is_active=True))
if len(users)!=1:
    raise RuntimeError('Expected one active Adrian identity')
u=users[0]
app=Application.objects.filter(slug='nextcloud').first()
print('MAPPING_REPORT='+json.dumps({'adrian_uuid':str(u.uuid),'adrian_is_superuser':u.is_superuser,'adrian_member':u.groups.filter(name='plutonium-members').exists(),'nextcloud_application_present':app is not None}))
"""
if os.geteuid()!=0:
    sys.exit('Run using sudo python3.')
try:
    apps=occ('app:list')
    print('Nextcloud user_oidc version: '+str(apps.get('enabled',{}).get('user_oidc','not enabled')))
    for account in ['admin','akadmin']:
        data=occ('user:info',account)
        print('Nextcloud '+account+' enabled: '+str(data.get('enabled')))
        print('Nextcloud '+account+' admin-group member: '+str('admin' in data.get('groups',[])))
        print('Nextcloud '+account+' backend: '+str(data.get('backend')))
        if account=='akadmin' and not (data.get('enabled') is True and 'admin' in data.get('groups',[])):
            raise RuntimeError('Recovery administrator not ready')
    raw=run(['docker','exec','homelab-authentik-server','ak','shell','-c',CODE])
    rows=[x.split('=',1)[1] for x in raw.splitlines() if x.startswith('MAPPING_REPORT=')]
    if len(rows)!=1:raise RuntimeError('Incomplete identity report')
    report=json.loads(rows[0])
    identity=str(uuid.UUID(report['adrian_uuid']))
    for key in ['adrian_is_superuser','adrian_member','nextcloud_application_present']:
        print('Identity '+key+': '+str(report[key]))
    if report['adrian_is_superuser'] or not report['adrian_member'] or not report['nextcloud_application_present']:
        raise RuntimeError('Identity prerequisites not satisfied')
    print('Adrian immutable identity UUID: '+identity)
    print('READ-ONLY MAPPING CHECK COMPLETE. No account, provider, ownership or login-setting changes.')
except Exception as error:
    print('STOPPED: '+type(error).__name__+'; sensitive output withheld.')
    sys.exit(1)
