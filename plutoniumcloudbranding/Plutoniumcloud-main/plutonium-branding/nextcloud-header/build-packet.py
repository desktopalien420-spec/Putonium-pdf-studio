from pathlib import Path
import hashlib,tarfile,io,json,re,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parent
files={}
for p in sorted((root/'nextcloud-app').rglob('*')):
 if p.is_file():files['nextcloud-app/'+p.relative_to(root/'nextcloud-app').as_posix()]=p.read_bytes()
files['listener-fixture.php']=(root/'listener-fixture.php').read_bytes()
assert len(files)==7;assert ET.fromstring(files['nextcloud-app/appinfo/info.xml']).findtext('id')=='plutonium_files_brand'
for name,body in files.items():
 if name.endswith('.svg'):
  tree=ET.fromstring(body);assert all(e.tag.split('}')[-1] in ['svg','g','circle','ellipse','text'] for e in tree.iter());assert all(not any(s in a.lower() for s in ['href','onload','onclick']) for e in tree.iter() for a in e.attrib)
with tarfile.open(root/'nextcloud-header-update.tar','w',format=tarfile.USTAR_FORMAT) as tar:
 for name,body in files.items():
  item=tarfile.TarInfo(name);item.size=len(body);item.mode=0o600;item.mtime=0;tar.addfile(item,io.BytesIO(body))
meta={'payload':hashlib.sha256((root/'nextcloud-header-update.tar').read_bytes()).hexdigest(),'files':{n:hashlib.sha256(b).hexdigest() for n,b in files.items()}}
(root/'update-manifest.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
p=root/'deploy-nextcloud-header.py';s=re.sub(r'^META = .*$',lambda m:'META = '+repr(meta),p.read_text(encoding='utf-8'),flags=re.M);compile(s,str(p),'exec');p.write_text(s,encoding='utf-8');print('Header payload/SVG validation passed; SHA256',meta['payload'])
