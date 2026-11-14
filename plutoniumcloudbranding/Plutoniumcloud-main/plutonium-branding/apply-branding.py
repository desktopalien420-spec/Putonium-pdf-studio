#!/usr/bin/env python3
"""Guarded Authentik presentation update. Never edit authentication behavior."""
import base64
import fcntl
import hashlib
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import time
import urllib.parse
import xml.etree.ElementTree as ET

HERE=Path(__file__).resolve().parent
ROOT=Path('/var/lib/homelab-authentik-branding')
STATE=ROOT/'state.json'
META={'files': {'authentik.css': 'f8d8b91312e191a776de4c71fbfabb56b3b446f4e9cf0805ad1a4ff68d877163', 'assets/wordmark.svg': 'cfb234284ecb332b86730537ffdb9cd863d209cb89b15e7729a64f533c3eb2d0', 'assets/favicon.svg': '952d266caa5ec88e241bf51f1fae6eeee7ebad814dc1b4601e649159d486de80', 'assets/background.svg': '8b2992162a05a8acc7709e741d7fc28c5769a142c89b3b0b6557ec81f22692de'}, 'payload': 'b726538f2133844ba542384f15808db69953f6b098fff74bfc1061f4f575bc16', 'inventory_helper': '0430093b385a5dcee14b4413643f798aa286b5d299794edf88ae349df50f09ba'}
PROXY_HELPER_SHA='e9bcb425efd8d02468f1bd4bfc396cfd6fbf43b9d8c877b172650effa7b5a2e1'
BRAND='b9830098-cdee-4507-88a5-f243539c020d'
FLOW='38a85953-27b3-47b3-8c74-73b31be08093'
PREFIX='plutonium-cloud-m2-20261108-v1/'
FIELDS=['branding_title','branding_logo','branding_favicon','branding_default_flow_background','branding_custom_css']

class Stop(RuntimeError):pass

def need(value,message):
    if not value:raise Stop(message)

def sha(data):return hashlib.sha256(data).hexdigest()

def load(file,expected,name):
    need(sha(file.read_bytes())==expected,'Reviewed dependency differs: '+name)
    spec=importlib.util.spec_from_file_location(name,file);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

def save(state):
    target=STATE.with_suffix('.json.new')
    fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'w') as stream:json.dump(state,stream,indent=2);stream.flush();os.fsync(stream.fileno())
    os.replace(target,STATE)

RPC=r"""
import base64,hashlib,json,os,sys
from pathlib import Path
from django.db import connection,transaction
from authentik.brands.models import Brand
from authentik.flows.models import Flow,FlowStageBinding
from authentik.admin.files.manager import get_file_manager
from authentik.admin.files.usage import FileUsage

BRAND=__BRAND__
FLOW=__FLOW__
FIELDS=__FIELDS__
PREFIX=__PREFIX__
FILE_HASHES=__FILE_HASHES__

def hash_json(value):return hashlib.sha256(json.dumps(value,sort_keys=True,default=str).encode()).hexdigest()

def objects(lock=False):
    b=(Brand.objects.select_for_update() if lock else Brand.objects).get(pk=BRAND)
    f=(Flow.objects.select_for_update() if lock else Flow.objects).get(pk=FLOW)
    assert b.domain=='authentik-default' and b.default is True
    assert b.flow_authentication_id is None or str(b.flow_authentication_id)==FLOW
    assert f.slug=='default-authentication-flow' and f.designation=='authentication'
    return b,f

def snapshot(b,f):
    other_brand={field.attname:getattr(b,field.attname) for field in b._meta.concrete_fields if field.name not in FIELDS}
    other_brand['client_certificates']=sorted(str(x) for x in b.client_certificates.values_list('pk',flat=True))
    other_flow={field.attname:getattr(f,field.attname) for field in f._meta.concrete_fields if field.name!='title'}
    bindings=list(FlowStageBinding.objects.filter(target_id=f.pk).values())
    guard=hash_json({'brand':other_brand,'flow':other_flow,'stage_bindings':sorted(bindings,key=hash_json)})
    return {'brand_uuid':str(b.pk),'flow_uuid':str(f.pk),'fields':{name:str(getattr(b,name) or '') for name in FIELDS},'flow_title':f.title,'guard':guard,'stage_binding_count':len(bindings)}

def media():
    manager=get_file_manager(FileUsage.MEDIA);backend=manager.management_backend
    assert getattr(backend,'name',None)=='file' and manager.manageable
    assert backend.base_path.resolve()==Path('/data/media/public')
    parent=backend.base_path.resolve()
    while not parent.exists():parent=parent.parent
    assert os.access(parent,os.W_OK|os.X_OK)
    return manager,backend

def after_values(payload):
    result=payload['after']
    assert set(result)==set(FIELDS)
    assert result['branding_title']=='Plutonium Cloud'
    assert result['branding_logo']==PREFIX+'wordmark.svg'
    assert result['branding_favicon']==PREFIX+'favicon.svg'
    assert result['branding_default_flow_background']==PREFIX+'background.svg'
    assert hashlib.sha256(result['branding_custom_css'].encode()).hexdigest()==FILE_HASHES['authentik.css']
    return result

def main():
    payload=json.load(sys.stdin);action=payload['action']
    if action in ['snapshot','verify']:
        with connection.cursor() as cursor:cursor.execute('SET default_transaction_read_only = on')
        b,f=objects();result=snapshot(b,f);_,backend=media()
        result['asset_paths_available']=not (backend.base_path/PREFIX).exists() and not (backend.base_path/PREFIX).is_symlink()
        if action=='verify':
            expected=after_values(payload)
            assert result['fields']==expected and result['flow_title']=='Welcome home.'
            assert result['guard']==payload['before']['guard']
            for name in ['wordmark.svg','favicon.svg','background.svg']:
                data=(backend.base_path/(PREFIX+name)).read_bytes()
                assert hashlib.sha256(data).hexdigest()==FILE_HASHES['assets/'+name]
        return result
    if action=='apply':
        wanted=after_values(payload)
        assets=payload['assets'];assert set(assets)=={'wordmark.svg','favicon.svg','background.svg'}
        decoded={name:base64.b64decode(value,validate=True) for name,value in assets.items()}
        assert all(hashlib.sha256(data).hexdigest()==FILE_HASHES['assets/'+name] for name,data in decoded.items())
        with transaction.atomic():
            b,f=objects(lock=True);current=snapshot(b,f)
            assert current=={k:v for k,v in payload['before'].items() if k!='asset_paths_available'}
            manager,backend=media()
            folder=backend.base_path/PREFIX
            assert not folder.exists() and not folder.is_symlink()
            folder.mkdir(parents=True,exist_ok=False,mode=0o755)
            for name,data in decoded.items():manager.save_file(PREFIX+name,data)
            for name,value in wanted.items():setattr(b,name,value)
            b.save(update_fields=FIELDS)
            f.title='Welcome home.';f.save(update_fields=['title'])
            result=snapshot(b,f);assert result['fields']==wanted and result['guard']==payload['before']['guard']
        return {'applied':True,'guard_unchanged':True,'stage_binding_count':result['stage_binding_count']}
    if action=='rollback':
        before=payload['before'];after=after_values(payload)
        assert before['brand_uuid']==BRAND and before['flow_uuid']==FLOW and set(before['fields'])==set(FIELDS)
        with transaction.atomic():
            b,f=objects(lock=True);current=snapshot(b,f)
            assert current['fields'] in [before['fields'],after]
            assert current['flow_title'] in [before['flow_title'],'Welcome home.']
            for name,value in before['fields'].items():setattr(b,name,value)
            b.save(update_fields=FIELDS)
            f.title=before['flow_title'];f.save(update_fields=['title'])
            result=snapshot(b,f)
            assert result['fields']==before['fields'] and result['flow_title']==before['flow_title']
        return {'restored':True,'unrelated_configuration_preserved':True,'original_guard_matches':result['guard']==before['guard']}
    raise RuntimeError('Unknown action')
try:
    print('BRAND_THEME_RESULT='+json.dumps(main()))
except Exception as error:
    print('BRAND_THEME_ERROR='+type(error).__name__)
"""

# Keep data out of shell text and process arguments; only static code is passed via -c.
RPC=RPC.replace('__BRAND__',repr(BRAND)).replace('__FLOW__',repr(FLOW)).replace('__FIELDS__',repr(FIELDS)).replace('__PREFIX__',repr(PREFIX)).replace('__FILE_HASHES__',repr(META['files']))

def rpc(payload):
    p=subprocess.run(['docker','exec','-i','homelab-authentik-server','ak','shell','-c',RPC],input=json.dumps(payload),capture_output=True,text=True,timeout=120)
    errors=[x.split('=',1)[1] for x in p.stdout.splitlines() if x.startswith('BRAND_THEME_ERROR=')]
    need(not errors,'Branding operation refused: '+(errors[0] if errors else 'unknown')+'. Sensitive details withheld.')
    need(p.returncode==0,'Identity command failed; raw output withheld.')
    rows=[x.split('=',1)[1] for x in p.stdout.splitlines() if x.startswith('BRAND_THEME_RESULT=')]
    need(len(rows)==1,'Branding operation returned no complete structured report.')
    return json.loads(rows[0])

def health(proxy):
    proxy.identity_health();proxy.existing_apps()
    for host,path in [('auth.plutoniumcloud.com','/-/health/ready/'),('plutoniumcloud.com','/')]:
        status,_,_=proxy.https(host,path);need(status==200,'Existing HTTPS readiness failed: '+host)

def public_brand(proxy):
    status,_,body=proxy.https('auth.plutoniumcloud.com','/api/v3/core/brands/current/')
    need(status==200,'Public brand metadata is unavailable.')
    return json.loads(body)

def asset_request_path(value):
    need(isinstance(value,str),'Public brand asset is missing.')
    parsed=urllib.parse.urlsplit(value)
    need(not parsed.scheme or parsed.scheme=='https','Brand asset is not HTTPS.')
    need(not parsed.netloc or parsed.netloc=='auth.plutoniumcloud.com','Brand asset points outside the identity origin.')
    need(parsed.path in {'/files/media/public/'+PREFIX+name for name in ['wordmark.svg','favicon.svg','background.svg']},'Brand asset path differs from the reviewed assets.')
    need(not parsed.fragment,'Unexpected brand asset fragment.')
    return parsed.path+('?' + parsed.query if parsed.query else '')

def verify_delivery(proxy,after):
    deadline=time.monotonic()+45
    while True:
        value=public_brand(proxy)
        if value.get('branding_title')==after['branding_title'] and value.get('branding_custom_css')==after['branding_custom_css']:break
        need(time.monotonic()<deadline,'New brand metadata is not ready; preserve the protected state.')
        time.sleep(2)
    for field,name in [('branding_logo','wordmark.svg'),('branding_favicon','favicon.svg')]:
        path=asset_request_path(value.get(field))
        status,_,data=proxy.https('auth.plutoniumcloud.com',path)
        need(status==200 and sha(data)==META['files']['assets/'+name],'New brand asset failed integrity/delivery verification.')


def unpack():
    payload=(HERE/'authentik-branding-v1.tar').read_bytes()
    need(sha(payload)==META['payload'],'Reviewed branding archive differs.')
    result={}
    with tarfile.open(fileobj=io.BytesIO(payload),mode='r:') as archive:
        items=archive.getmembers();need(len(items)==len(META['files']) and {x.name for x in items}==set(META['files']),'Branding asset list differs.')
        for item in items:
            need(item.isfile() and item.size<131072,'Unexpected theme archive entry.')
            data=archive.extractfile(item).read();need(sha(data)==META['files'][item.name],'Branding file hash differs.');result[item.name]=data
    css=result['authentik.css'].decode('utf-8')
    need(not re.search(r'@import|url\s*\(|display\s*:\s*none|visibility\s*:\s*hidden|pointer-events\s*:\s*none',css,re.I),'Theme includes unsupported imports or control-hiding rules.')
    for name,data in result.items():
        if name.endswith('.svg'):
            tree=ET.fromstring(data)
            need(not any(x.tag.split('}')[-1] in ['script','foreignObject'] for x in tree.iter()),'Unexpected SVG content.')
            need(not any(k.endswith('href') for x in tree.iter() for k in x.attrib),'External SVG resource references are not allowed.')
    return result

def rollback(proxy,state):
    result=rpc({'action':'rollback','before':state['before'],'after':state['after']})
    need(result.get('restored') is True,'Presentation restore was not confirmed.')
    state['phase']='presentation_restored_verification_pending';save(state)
    print('Previous presentation fields restored; verifying current service health...',flush=True)
    if not result.get('original_guard_matches',True):print('Unrelated identity configuration changes were preserved.',flush=True)
    health(proxy)
    deadline=time.monotonic()+45
    while True:
        value=public_brand(proxy)
        if value.get('branding_title')==state['before']['fields']['branding_title'] and value.get('branding_custom_css')==state['before']['fields']['branding_custom_css']:break
        need(time.monotonic()<deadline,'Restored metadata is not ready yet; keep the backup.')
        time.sleep(2)
    state['phase']='rolled_back_assets_retained';save(state)
    print('BRANDING ROLLED BACK. Previous presentation/title restored; new unused assets retained. No accounts or authentication rules changed.',flush=True)

def main():
    need(os.geteuid()==0,'Run using sudo python3.')
    os.umask(0o077)
    mode=sys.argv[1] if len(sys.argv)==2 else ''
    need(mode in ['check','install','rollback'],'Use check, install, or rollback.')
    lock=os.open('/run/lock/homelab-authentik-branding.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600);fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    proxy=load(HERE/'private-https.py',PROXY_HELPER_SHA,'reviewed_brand_proxy')
    proxy.verify_mount()
    if mode=='rollback':
        need(STATE.is_file(),'No protected branding update record exists.')
        state=json.loads(STATE.read_text());rollback(proxy,state);return
    proxy.verify_proxy();health(proxy)
    need(not ROOT.exists(),'Branding state already exists; preserve it instead of repeating install.')
    inventory=load(HERE/'inspect-branding.py',META['inventory_helper'],'reviewed_brand_inventory').inventory()
    need(inventory.get('brand_uuid')==BRAND and inventory.get('authentication_flow_uuid')==FLOW,'Active identity brand/flow differs from the reviewed inventory.')
    need(inventory.get('media_base_path_resolved')=='/data/media/public' and inventory.get('media_manageable') is True,'Verified persistent media path differs.')
    data=unpack();before=rpc({'action':'snapshot'})
    need(before['fields']['branding_custom_css']=='' and before['fields']['branding_title']=='authentik' and before['flow_title']=='Welcome to authentik!','Existing presentation changed since review; preserve newer choices.')
    need(before['stage_binding_count']>0,'Authentication stage bindings are missing; preserve the flow.')
    need(before['asset_paths_available'] is True,'Proposed new media asset paths are already occupied.')
    after={'branding_title':'Plutonium Cloud','branding_logo':PREFIX+'wordmark.svg','branding_favicon':PREFIX+'favicon.svg','branding_default_flow_background':PREFIX+'background.svg','branding_custom_css':data['authentik.css'].decode('utf-8')}
    print('Verified exact brand/flow, current presentation, persistent media, theme assets and existing HTTPS.',flush=True)
    if mode=='check':
        print('READ-ONLY BRANDING PREFLIGHT PASSED. No settings, files, accounts or authentication changes.',flush=True);return
    ROOT.mkdir(mode=0o700)
    state={'phase':'prepared','before':before,'after':after,'payload':META['payload'],'asset_paths':[PREFIX+name for name in ['wordmark.svg','favicon.svg','background.svg']]}
    save(state)
    print('Protected presentation backup saved. Applying appearance fields and welcome title only...',flush=True)
    try:
        rpc({'action':'apply','before':before,'after':after,'assets':{name:base64.b64encode(data['assets/'+name]).decode('ascii') for name in ['wordmark.svg','favicon.svg','background.svg']}})
        state['phase']='applied';save(state)
        rpc({'action':'verify','before':before,'after':after});verify_delivery(proxy,after);health(proxy)
        state['phase']='awaiting_private_login_verification';save(state)
    except Exception:
        print('Branding verification failed; attempting the guarded presentation rollback.',flush=True)
        rollback(proxy,state)
        raise Stop('New branding did not pass verification; previous presentation restored.')
    print('PRIVATE IDENTITY BRANDING READY. Assets and public branding metadata verified.',flush=True)
    print('Authentication fields and stage bindings unchanged. No service restart, proxy, account, MFA, DNS, firewall or SSH changes.',flush=True)
    print('Keep existing admin/SSH sessions. Test fresh Adrian password+MFA and administrator access privately.',flush=True)

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('STOPPED: '+(str(error) if isinstance(error,Stop) else type(error).__name__+'; sensitive details withheld.'),flush=True)
        print('Preserve all state and paste this output. Do not repeat install or print backup/environment contents.',flush=True)
        sys.exit(1)
