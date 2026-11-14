#!/usr/bin/env python3
"""Update only the private portal launcher; preserve all identity/app accounts."""
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
import uuid

HERE=Path(__file__).resolve().parent
APP=Path('/srv/homelab-host/portal/app')
ROOT=Path('/var/lib/homelab-portal-launchers')
STATE=ROOT/'state.json'
META={'payload': 'dee37729e1dc8ba9e69132d2ecf6a0546713b6e02b8f647cb3df704d59e521aa', 'before': {'server.cjs': 'f47bf4e4b5bdf99bd5599e65cf2d539931177d1de38e0361011153f8d3766341', 'public/app.js': '79c1fedf38a46e4cd48f9967ed473b5e0b5fd033da09ddf9fe3caf79eaf05cbc'}, 'after': {'server.cjs': '5ebc6b2d7c9ffc0dca9b659786c9308f671936a85d2186bc3014d80d7a7a0a08', 'public/app.js': 'f2cc1c8a284b29c2986e9613fe9cac1b1472a8d81d42d12730836c0188844fb2'}}
FILES=['server.cjs','public/app.js','linked-apps.json']
HELPER_HASH='e9bcb425efd8d02468f1bd4bfc396cfd6fbf43b9d8c877b172650effa7b5a2e1'

class Stop(RuntimeError):pass

def need(value,message):
    if not value:raise Stop(message)

def sha(data):return hashlib.sha256(data).hexdigest()

def run(args,timeout=90):
    p=subprocess.run([str(x) for x in args],capture_output=True,text=True,timeout=timeout)
    need(p.returncode==0,'A verification command failed; raw output withheld.')
    return p.stdout.strip()

def occ(*args):
    return json.loads(run(['docker','exec','--user','www-data','nextcloud-aio-nextcloud','php','/var/www/html/occ',*args,'--output=json']))

def atomic(file,data):
    need(not file.is_symlink(),'Refusing a symbolic link.')
    temp=file.with_name(file.name+'.launcher-update')
    descriptor=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(descriptor,'wb') as stream:
        stream.write(data);stream.flush();os.fsync(stream.fileno())
    temp.chmod(0o644 if file.is_relative_to(APP) else 0o600)
    os.replace(temp,file)

def save(state):atomic(STATE,json.dumps(state,indent=2).encode())

def helper():
    file=HERE/'private-https.py'
    need(sha(file.read_bytes())==HELPER_HASH,'Proxy verification helper differs.')
    spec=importlib.util.spec_from_file_location('private_proxy',file)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    return mod

def cloud_checks(proxy):
    proxy.existing_apps()
    status,_,_=proxy.https('auth.plutoniumcloud.com','/-/health/ready/')
    need(status==200,'Identity HTTPS is not healthy.')

def container():
    item=json.loads(run(['docker','inspect','homelab-portal-web']))[0]
    need(item['State']['Status']=='running','Portal is not running.')
    need(item['Config']['Labels'].get('com.docker.compose.project')=='homelab-portal','Portal project differs.')
    need(any(m.get('Source')==str(APP) and m.get('Destination')=='/app' and m.get('RW') is False for m in item.get('Mounts',[])),'Portal read-only source mount differs.')
    need(item['Config'].get('User')=='1000:1000','Portal container user differs.')
    return item

def mapping():
    for account,admin in [('admin',False),('akadmin',True)]:
        value=occ('user:info',account)
        need(value.get('enabled') is True and ('admin' in value.get('groups',[])) is admin,'Nextcloud daily/recovery privileges differ from the verified setup.')
    rows=occ('user_oidc:provider')
    need(isinstance(rows,list),'Unexpected provider list; preserve settings.')
    providers=[p for p in rows if p.get('discoveryEndpoint')=='https://auth.plutoniumcloud.com/application/o/nextcloud/.well-known/openid-configuration']
    need(len(providers)==1,'Expected one configured Nextcloud provider.')
    provider_id=providers[0].get('id')
    need(type(provider_id) is int and provider_id>0,'Invalid Nextcloud provider ID.')
    code="""
import json
from authentik.core.models import User
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute('SET default_transaction_read_only = on')
u=User.objects.get(uuid='a59fcebe-aee6-4900-b179-1b5c3cd899c2',username='adrian',is_active=True)
assert not u.is_superuser and u.groups.filter(name='plutonium-members').exists()
print('LAUNCH_IDENTITY='+json.dumps({'subject':u.uid,'username':u.username}))
"""
    raw=run(['docker','exec','homelab-authentik-server','ak','shell','-c',code])
    reports=[x.split('=',1)[1] for x in raw.splitlines() if x.startswith('LAUNCH_IDENTITY=')]
    need(len(reports)==1,'Identity report incomplete.')
    identity=json.loads(reports[0])
    need(re.fullmatch('[0-9a-f]{64}',identity.get('subject','')) is not None and identity.get('username')=='adrian','Unexpected gateway identity.')
    return {**identity,'files':'https://cask.plutoniumcloud.com/apps/user_oidc/login/'+str(provider_id),'photos':'https://photos.plutoniumcloud.com/auth/login?autoLaunch=1'}

def key():
    raw=Path('/srv/homelab-host/portal/secrets.env').read_text()
    match=re.fullmatch(r'PC_BRIDGE_KEY=([0-9a-f]{64})\n?',raw)
    need(match is not None,'Existing gateway secret format differs.')
    return match.group(1)

def request(path,headers=None):
    conn=http.client.HTTPConnection('127.0.0.1',13000,timeout=10)
    try:
        conn.request('GET',path,headers=headers or {})
        response=conn.getresponse();body=response.read(1048576)
        return response.status,response.getheader('Location'),body
    finally:conn.close()

def backend_ready():
    deadline=time.monotonic()+45
    while True:
        try:
            status,_,body=request('/healthz')
            if status==200 and json.loads(body).get('ready') is True:return
        except (OSError,http.client.HTTPException):pass
        need(time.monotonic()<deadline,'Portal did not become ready after its restart.')
        time.sleep(2)

def verify(proxy,link):
    headers={'X-Portal-Bridge-Key':key(),'X-Authentik-Uid':link['subject'],'X-Authentik-Username':'adrian','X-Authentik-Name':'Adrian','X-Authentik-Groups':'plutonium-members'}
    status,_,body=request('/api/me',headers)
    need(status==200,'Linked identity API check failed.')
    apps=json.loads(body)['apps']
    need({x['id'] for x in apps if x.get('enabled')}=={'files','photos'},'Unexpected enabled applications.')
    for app in ['files','photos']:
        status,destination,_=request('/launch/'+app,headers)
        need(status==302 and destination==link[app],'Linked launcher destination differs.')
        status,_,_=request('/launch/'+app,{**headers,'X-Authentik-Uid':'another-member'})
        need(status==403,'Another member inherited a linked launcher.')
        status,_,_=request('/launch/'+app,{'X-Authentik-Uid':link['subject'],'X-Authentik-Username':'adrian','X-Authentik-Groups':'plutonium-members'})
        need(status==403,'Direct gateway bypass check failed.')
        status,location,_=proxy.https('plutoniumcloud.com','/launch/'+app)
        need(status in [302,303,401,403] and location!=link[app],'Anonymous proxy request reached a linked application.')
    cloud_checks(proxy)

def rollback(proxy,state):
    for name in FILES:
        path=APP/name
        current=sha(path.read_bytes()) if path.exists() else None
        need(current in [state['before'].get(name),state['after'][name]],'Portal source has unrelated edits; no overwrite performed.')
    for name in FILES:
        path=APP/name
        if state['before'].get(name) is None:
            if path.exists():path.unlink()
        else:
            data=(ROOT/'before'/name).read_bytes()
            need(sha(data)==state['before'][name],'Retained backup differs.')
            atomic(path,data)
    run(['docker','restart','--time','10','homelab-portal-web'])
    backend_ready();cloud_checks(proxy)
    state['phase']='rolled_back';save(state)
    print('LAUNCHER UPDATE ROLLED BACK. Original portal restored; all accounts/data retained.',flush=True)

def main():
    need(os.geteuid()==0,'Run with sudo python3.')
    os.umask(0o077)
    mode=sys.argv[1] if len(sys.argv)==2 else ''
    need(mode in ['install','check','rollback'],'Use check, install, or rollback.')
    descriptor=os.open('/run/lock/homelab-portal.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
    fcntl.flock(descriptor,fcntl.LOCK_EX|fcntl.LOCK_NB)
    proxy=helper();proxy.verify_mount();proxy.verify_proxy();container();cloud_checks(proxy)
    if mode=='rollback':
        need(STATE.is_file(),'No launcher update record exists.')
        rollback(proxy,json.loads(STATE.read_text()));return
    link=mapping()
    print('Verified Adrian identity and Nextcloud account mapping prerequisites.',flush=True)
    if mode=='check':
        print('READ-ONLY LAUNCHER CHECK PASSED. No files, accounts or services changed.',flush=True);return
    need(not ROOT.exists(),'Launcher update record already exists; inspect rather than reinstall.')
    for name,digest in META['before'].items():
        need(sha((APP/name).read_bytes())==digest,'Installed portal source differs; preserve edits.')
    need(not (APP/'linked-apps.json').exists(),'Linked app configuration already exists.')
    payload=(HERE/'launcher-update.tar').read_bytes()
    need(sha(payload)==META['payload'],'Reviewed update archive differs.')
    changes={}
    with tarfile.open(fileobj=io.BytesIO(payload),mode='r:') as archive:
        entries=archive.getmembers()
        need(len(entries)==2 and {x.name for x in entries}==set(META['after']),'Update archive paths differ.')
        for entry in entries:
            need(entry.isfile() and entry.size<262144,'Unexpected archive item.')
            data=archive.extractfile(entry).read()
            need(sha(data)==META['after'][entry.name],'Update source hash differs.')
            changes[entry.name]=data
    changes['linked-apps.json']=json.dumps([link],indent=2).encode()
    ROOT.mkdir(mode=0o700)
    for name in META['before']:
        backup=ROOT/'before'/name;backup.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        backup.write_bytes((APP/name).read_bytes());backup.chmod(0o600)
    state={'phase':'prepared','before':{**META['before'],'linked-apps.json':None},'after':{name:sha(data) for name,data in changes.items()}}
    save(state)
    try:
        for name,data in changes.items():atomic(APP/name,data)
        run(['docker','exec','homelab-portal-web','node','--check','/app/server.cjs'])
        run(['docker','exec','homelab-portal-web','node','--check','/app/public/app.js'])
        print('Restarting only the portal backend; proxy and cloud services stay running.',flush=True)
        run(['docker','restart','--time','10','homelab-portal-web'])
        backend_ready();verify(proxy,link)
        state['phase']='verified';save(state)
    except Exception:
        print('Update verification failed; restoring the original portal files.',flush=True)
        rollback(proxy,state)
        raise Stop('Launcher update did not pass verification; original portal restored.')
    print('FILES AND PHOTOS LAUNCHERS READY FOR ADRIAN.',flush=True)
    print('Other members remain unlinked; anonymous/direct requests blocked. Existing cloud HTTPS healthy.',flush=True)
    print('Next: test both buttons from a fresh Adrian portal session.',flush=True)

if __name__=='__main__':
    try:main()
    except Exception as error:
        print('STOPPED: '+(str(error) if isinstance(error,Stop) else type(error).__name__+'; sensitive details withheld.'),flush=True)
        print('Preserve configuration and paste this output. Do not repeat install.',flush=True)
        sys.exit(1)
