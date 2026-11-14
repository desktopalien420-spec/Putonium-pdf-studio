#!/usr/bin/env python3
"""Read-only OIDC connectivity diagnostics; no config, tokens or credentials printed."""
import json
import os
import subprocess
import sys

JS = r"""
const dns = require('node:dns').promises;
const https = require('node:https');
const host = 'auth.plutoniumcloud.com';
const path = '/application/o/immich/.well-known/openid-configuration';
function code(e) { return String(e?.cause?.code || e?.code || e?.name || 'unknown').replace(/[^A-Za-z0-9_]/g, '').slice(0,64); }
function request(label, address) {
 return new Promise(resolve => {
  const req = https.get({hostname: address || host, servername: host, port:443, path, headers:{Host:host}, rejectUnauthorized:true}, res => {
   let body='';res.on('data', c => { if(body.length<262144) body+=c; });
   res.on('end', () => {let issuer=false;try{issuer=JSON.parse(body).issuer==='https://'+host+'/application/o/immich/';}catch{}
    console.log(label+': HTTP '+res.statusCode+'; issuer matches='+issuer);resolve();});
   res.on('error', e=>{console.log(label+': '+code(e));resolve();});
  });
  const timer=setTimeout(()=>req.destroy(Object.assign(new Error(),{code:'DIAGNOSTIC_TIMEOUT'})),10000);
  req.on('close',()=>clearTimeout(timer));
  req.on('error',e=>{console.log(label+': '+code(e));resolve();});
 });
}
(async()=>{
 try{const a=await Promise.race([dns.lookup(host,{all:true}),new Promise((_,reject)=>setTimeout(()=>reject({code:'DNS_TIMEOUT'}),8000))]);
 console.log('Container DNS: '+a.map(v=>v.address).join(','));}catch(e){console.log('Container DNS: '+code(e));}
 await request('Discovery by hostname');
 await request('Discovery by LAN IP with trusted TLS/SNI','192.168.8.153');
 process.exit(0);
})().catch(e=>{console.log('Diagnostic error: '+code(e));process.exit(1);});
"""
def run(args, text=None, timeout=60):
 p=subprocess.run(args,input=text,capture_output=True,text=True,timeout=timeout)
 if p.returncode: raise RuntimeError('Diagnostic subprocess failed; raw output withheld.')
 return p.stdout
if os.geteuid()!=0:sys.exit('Run with sudo python3.')
try:
 item=json.loads(run(['docker','inspect','homelab-immich-server']))[0]
 print('Immich status: '+str(item['State']['Status']),flush=True)
 for name,net in item.get('NetworkSettings',{}).get('Networks',{}).items():
  info=json.loads(run(['docker','network','inspect',name]))[0]
  bridge=info.get('Options',{}).get('com.docker.network.bridge.name') or ('br-'+info['Id'][:12])
  print('Immich network: '+name+'; bridge='+bridge+'; server IP='+str(net.get('IPAddress')),flush=True)
  print('Network subnets: '+','.join(x.get('Subnet','') for x in info.get('IPAM',{}).get('Config',[])),flush=True)
 raw=run(['docker','exec','-i','homelab-immich-server','node','-'],text=JS,timeout=45)
 # The static diagnostic emits only addresses, status codes and error codes.
 print(raw.strip(),flush=True)
 print('READ-ONLY OIDC CONNECTIVITY CHECK COMPLETE. No configuration or account changes.',flush=True)
except Exception as e:
 print('STOPPED: '+type(e).__name__+'; raw output withheld.',flush=True)
 sys.exit(1)
