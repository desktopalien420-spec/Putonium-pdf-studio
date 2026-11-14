#!/usr/bin/env python3
"""Read-only Authentik branding prerequisites; no CSS/settings/assets applied."""
import hashlib
import http.client
import json
import os
from pathlib import Path
import subprocess
import sys

FIELDS=['branding_title','branding_logo','branding_favicon','branding_default_flow_background','branding_custom_css']

def need(value,message):
    if not value:raise RuntimeError(message)

def run(args):
    p=subprocess.run(args,capture_output=True,text=True,timeout=90)
    need(p.returncode==0,'Read-only command failed; raw diagnostic output withheld.')
    return p.stdout

def public_brand():
    c=http.client.HTTPConnection('127.0.0.1',9000,timeout=15)
    try:
        c.request('GET','/api/v3/core/brands/current/',headers={'Host':'auth.plutoniumcloud.com'})
        r=c.getresponse();data=r.read(1048576);need(r.status==200,'Public brand metadata unavailable.')
        return json.loads(data)
    finally:c.close()

CODE=r"""
import hashlib,json
from pathlib import Path
from authentik.brands.models import Brand
from authentik.flows.models import Flow
from authentik.admin.files.manager import get_file_manager
from authentik.admin.files.usage import FileUsage
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute('SET default_transaction_read_only = on')
b=Brand.objects.get(domain=__DOMAIN__)
f=b.flow_authentication or Flow.objects.get(slug='default-authentication-flow')
m=get_file_manager(FileUsage.MEDIA)
backend=m.management_backend
fields=__FIELDS__
report={
'brand_uuid':str(b.pk),'matched_domain':b.domain,'brand_is_default':b.default,
'brand_title':b.branding_title,'custom_css_present':bool(b.branding_custom_css),
'custom_css_sha256':hashlib.sha256(b.branding_custom_css.encode()).hexdigest(),
'required_fields_available':all(hasattr(b,x) for x in fields),
'authentication_flow_slug':f.slug,'authentication_flow_uuid':str(f.pk),
'authentication_flow_designation':f.designation,'authentication_flow_title':f.title,
'media_backend':getattr(backend,'name',None),'media_base_path':str(backend.base_path) if getattr(backend,'name',None)=='file' else None,
'media_base_path_resolved':str(backend.base_path.resolve()) if getattr(backend,'name',None)=='file' else None,
'media_manageable':m.manageable,
}
print('BRAND_REPORT='+json.dumps(report))
"""

def inventory():
    for name in ['homelab-authentik-server','homelab-authentik-worker']:
        item=json.loads(run(['docker','inspect',name]))[0]
        need(item['State']['Status']=='running' and item['State'].get('Health',{}).get('Status')=='healthy','Identity container is not healthy.')
        need(item['Config']['Image'].startswith('ghcr.io/goauthentik/server:2026.8.5@'),'Installed identity version differs; recheck theme compatibility.')
        need(any(x.get('Source')=='/srv/homelab-host/authentik/data' and x.get('Destination')=='/data' and x.get('RW') is True for x in item.get('Mounts',[])),'Identity data mount differs; preserve it.')
    value=public_brand();domain=value.get('matched_domain')
    need(isinstance(domain,str) and 0<len(domain)<256,'Current brand domain is missing.')
    code=CODE.replace('__DOMAIN__',repr(domain)).replace('__FIELDS__',repr(FIELDS))
    raw=run(['docker','exec','homelab-authentik-server','ak','shell','-c',code])
    lines=[x.split('=',1)[1] for x in raw.splitlines() if x.startswith('BRAND_REPORT=')]
    need(len(lines)==1,'Brand inventory incomplete.')
    return json.loads(lines[0])

if __name__=='__main__':
    if os.geteuid()!=0:sys.exit('Run using sudo python3.')
    try:
        report=inventory()
        for key,value in report.items():print(key+': '+str(value),flush=True)
        need(report['required_fields_available'] is True,'Expected branding fields unavailable.')
        need(report['media_backend']=='file' and report['media_base_path_resolved']=='/data/media/public' and report['media_manageable'] is True,'Media storage requires review before staging theme assets.')
        need(report['authentication_flow_designation']=='authentication','Authentication flow requires review.')
        print('READ-ONLY BRANDING INVENTORY COMPLETE. No brand, flow, account, file or service changes.',flush=True)
    except Exception as error:
        print('STOPPED: '+type(error).__name__+'; sensitive diagnostic output withheld.',flush=True)
        sys.exit(1)
